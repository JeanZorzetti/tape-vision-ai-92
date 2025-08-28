/**
 * Event Processor - Ultra High-Performance Event Processing Engine
 * Handles real-time event processing with minimal latency and maximum throughput
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import { performance } from 'perf_hooks';

export interface TradingEvent {
  id: string;
  type: string;
  timestamp: number;
  sequence: number;
  source: string;
  priority: EventPriority;
  payload: any;
  metadata?: Record<string, any>;
  correlationId?: string;
  parentEventId?: string;
}

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export interface EventHandler {
  id: string;
  name: string;
  eventTypes: string[];
  priority: number;
  maxLatency: number;
  enabled: boolean;
  handler: (event: TradingEvent) => Promise<void> | void;
  filter?: (event: TradingEvent) => boolean;
  errorHandler?: (error: Error, event: TradingEvent) => void;
}

export interface EventQueue {
  name: string;
  priority: EventPriority;
  maxSize: number;
  dropPolicy: 'head' | 'tail' | 'reject';
  events: TradingEvent[];
}

export interface ProcessingMetrics {
  totalEvents: number;
  processedEvents: number;
  droppedEvents: number;
  errorEvents: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  throughput: number;
  queueDepth: number;
  handlerLatencies: Map<string, number>;
  lastUpdate: number;
}

export interface EventProcessorConfig {
  maxQueueSize: number;
  maxHandlers: number;
  processingInterval: number;
  enableBatching: boolean;
  batchSize: number;
  enableMetrics: boolean;
  metricsInterval: number;
  circuitBreaker: {
    enabled: boolean;
    errorThreshold: number;
    timeoutMs: number;
    recoveryTimeMs: number;
  };
  deadLetterQueue: {
    enabled: boolean;
    maxSize: number;
    retryAttempts: number;
  };
}

export interface CircuitBreakerState {
  isOpen: boolean;
  errorCount: number;
  lastFailTime: number;
  nextRetryTime: number;
}

export class EventProcessor extends EventEmitter {
  private logger: Logger;
  private config: EventProcessorConfig;
  
  // Event storage and processing
  private eventQueues: Map<EventPriority, EventQueue> = new Map();
  private handlers: Map<string, EventHandler> = new Map();
  private deadLetterQueue: TradingEvent[] = [];
  
  // Processing state
  private isActive: boolean = false;
  private isProcessing: boolean = false;
  private processingLoop?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;
  
  // Performance tracking
  private metrics: ProcessingMetrics = {
    totalEvents: 0,
    processedEvents: 0,
    droppedEvents: 0,
    errorEvents: 0,
    averageLatency: 0,
    maxLatency: 0,
    minLatency: Number.MAX_VALUE,
    throughput: 0,
    queueDepth: 0,
    handlerLatencies: new Map(),
    lastUpdate: Date.now()
  };
  
  // Circuit breaker states
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Sequence tracking
  private lastSequence: number = 0;
  private sequenceGaps: Set<number> = new Set();
  
  // Batch processing
  private batchBuffer: TradingEvent[] = [];
  private lastBatchTime: number = Date.now();

  constructor(config: EventProcessorConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'EventProcessor' });
    
    this.initializeQueues();
    
    this.logger.info('EventProcessor initialized', {
      maxQueueSize: config.maxQueueSize,
      enableBatching: config.enableBatching,
      batchSize: config.batchSize
    });
  }

  /**
   * Start the event processor
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting EventProcessor');
      
      this.isActive = true;
      this.lastSequence = 0;
      this.metrics.lastUpdate = Date.now();
      
      // Start processing loop
      this.startProcessingLoop();
      
      // Start metrics collection if enabled
      if (this.config.enableMetrics) {
        this.startMetricsCollection();
      }
      
      this.emit('processor-started');
      this.logger.info('EventProcessor started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start EventProcessor', error);
      throw error;
    }
  }

  /**
   * Stop the event processor
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping EventProcessor');
      
      this.isActive = false;
      
      // Stop processing loop
      if (this.processingLoop) {
        clearInterval(this.processingLoop);
      }
      
      // Stop metrics timer
      if (this.metricsTimer) {
        clearInterval(this.metricsTimer);
      }
      
      // Process remaining events
      await this.processRemainingEvents();
      
      this.emit('processor-stopped');
      this.logger.info('EventProcessor stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping EventProcessor', error);
      throw error;
    }
  }

  /**
   * Submit an event for processing
   */
  public submitEvent(event: Omit<TradingEvent, 'id' | 'sequence'>): boolean {
    if (!this.isActive) {
      this.logger.warn('EventProcessor is not active, dropping event');
      return false;
    }
    
    try {
      // Create complete event
      const completeEvent: TradingEvent = {
        ...event,
        id: this.generateEventId(),
        sequence: ++this.lastSequence,
        timestamp: event.timestamp || Date.now()
      };
      
      // Validate event
      if (!this.validateEvent(completeEvent)) {
        this.logger.warn('Invalid event dropped', { eventType: completeEvent.type });
        this.metrics.droppedEvents++;
        return false;
      }
      
      // Add to appropriate queue
      const success = this.enqueueEvent(completeEvent);
      
      if (success) {
        this.metrics.totalEvents++;
        
        // Trigger immediate processing for critical events
        if (completeEvent.priority === 'critical' && !this.isProcessing) {
          setImmediate(() => this.processEvents());
        }
      } else {
        this.metrics.droppedEvents++;
      }
      
      return success;
      
    } catch (error) {
      this.logger.error('Error submitting event', error);
      this.metrics.errorEvents++;
      return false;
    }
  }

  /**
   * Register an event handler
   */
  public registerHandler(handler: EventHandler): void {
    if (this.handlers.size >= this.config.maxHandlers) {
      throw new Error(`Maximum handlers limit reached: ${this.config.maxHandlers}`);
    }
    
    this.handlers.set(handler.id, handler);
    this.circuitBreakers.set(handler.id, {
      isOpen: false,
      errorCount: 0,
      lastFailTime: 0,
      nextRetryTime: 0
    });
    
    this.logger.info('Event handler registered', {
      handlerId: handler.id,
      name: handler.name,
      eventTypes: handler.eventTypes
    });
  }

  /**
   * Unregister an event handler
   */
  public unregisterHandler(handlerId: string): void {
    this.handlers.delete(handlerId);
    this.circuitBreakers.delete(handlerId);
    this.metrics.handlerLatencies.delete(handlerId);
    
    this.logger.info('Event handler unregistered', { handlerId });
  }

  /**
   * Enable/disable a handler
   */
  public setHandlerEnabled(handlerId: string, enabled: boolean): void {
    const handler = this.handlers.get(handlerId);
    if (handler) {
      handler.enabled = enabled;
      this.logger.info('Handler enabled state changed', { handlerId, enabled });
    }
  }

  private initializeQueues(): void {
    const priorities: EventPriority[] = ['critical', 'high', 'normal', 'low'];
    
    for (const priority of priorities) {
      this.eventQueues.set(priority, {
        name: `${priority}-queue`,
        priority,
        maxSize: this.getQueueMaxSize(priority),
        dropPolicy: priority === 'critical' ? 'reject' : 'tail',
        events: []
      });
    }
  }

  private getQueueMaxSize(priority: EventPriority): number {
    switch (priority) {
      case 'critical': return Math.floor(this.config.maxQueueSize * 0.1);
      case 'high': return Math.floor(this.config.maxQueueSize * 0.3);
      case 'normal': return Math.floor(this.config.maxQueueSize * 0.5);
      case 'low': return Math.floor(this.config.maxQueueSize * 0.1);
      default: return this.config.maxQueueSize;
    }
  }

  private validateEvent(event: TradingEvent): boolean {
    return !!(
      event.id &&
      event.type &&
      event.timestamp > 0 &&
      event.sequence > 0 &&
      event.source &&
      event.priority
    );
  }

  private enqueueEvent(event: TradingEvent): boolean {
    const queue = this.eventQueues.get(event.priority);
    if (!queue) {
      this.logger.error('Unknown event priority', { priority: event.priority });
      return false;
    }
    
    // Check queue capacity
    if (queue.events.length >= queue.maxSize) {
      return this.handleQueueOverflow(queue, event);
    }
    
    // Add to queue
    queue.events.push(event);
    
    // Update queue depth metric
    this.updateQueueDepthMetric();
    
    return true;
  }

  private handleQueueOverflow(queue: EventQueue, event: TradingEvent): boolean {
    switch (queue.dropPolicy) {
      case 'reject':
        this.logger.warn('Queue full, rejecting event', {
          queueName: queue.name,
          eventType: event.type
        });
        return false;
        
      case 'head':
        queue.events.shift(); // Remove oldest
        queue.events.push(event);
        this.logger.debug('Queue full, dropped head event', { queueName: queue.name });
        return true;
        
      case 'tail':
        this.logger.debug('Queue full, dropping current event', {
          queueName: queue.name,
          eventType: event.type
        });
        return false;
        
      default:
        return false;
    }
  }

  private startProcessingLoop(): void {
    this.processingLoop = setInterval(async () => {
      await this.processEvents();
    }, this.config.processingInterval);
  }

  private async processEvents(): Promise<void> {
    if (!this.isActive || this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      // Process queues by priority
      const priorities: EventPriority[] = ['critical', 'high', 'normal', 'low'];
      
      for (const priority of priorities) {
        const queue = this.eventQueues.get(priority);
        if (queue && queue.events.length > 0) {
          await this.processQueue(queue);
        }
      }
      
      // Process batched events if enabled
      if (this.config.enableBatching) {
        await this.processBatch();
      }
      
    } catch (error) {
      this.logger.error('Error in processing loop', error);
      this.metrics.errorEvents++;
    } finally {
      this.isProcessing = false;
    }
  }

  private async processQueue(queue: EventQueue): Promise<void> {
    const eventsToProcess = queue.events.splice(0, this.config.batchSize || 10);
    
    if (this.config.enableBatching && queue.priority !== 'critical') {
      // Add to batch buffer for non-critical events
      this.batchBuffer.push(...eventsToProcess);
      return;
    }
    
    // Process immediately for critical events
    for (const event of eventsToProcess) {
      await this.processEvent(event);
    }
  }

  private async processEvent(event: TradingEvent): Promise<void> {
    const startTime = performance.now();
    
    try {
      // Find handlers for this event type
      const applicableHandlers = this.getApplicableHandlers(event);
      
      if (applicableHandlers.length === 0) {
        this.logger.debug('No handlers for event', { eventType: event.type });
        return;
      }
      
      // Process with each handler
      const handlerPromises = applicableHandlers.map(handler => 
        this.processWithHandler(handler, event)
      );
      
      await Promise.all(handlerPromises);
      
      this.metrics.processedEvents++;
      
    } catch (error) {
      this.logger.error('Error processing event', { eventId: event.id, error });
      this.metrics.errorEvents++;
      
      // Add to dead letter queue if enabled
      if (this.config.deadLetterQueue.enabled) {
        this.addToDeadLetterQueue(event);
      }
    } finally {
      // Update latency metrics
      const latency = performance.now() - startTime;
      this.updateLatencyMetrics(latency);
    }
  }

  private async processWithHandler(handler: EventHandler, event: TradingEvent): Promise<void> {
    // Check circuit breaker
    if (this.isCircuitBreakerOpen(handler.id)) {
      return;
    }
    
    const startTime = performance.now();
    
    try {
      // Apply filter if present
      if (handler.filter && !handler.filter(event)) {
        return;
      }
      
      // Execute handler
      await Promise.resolve(handler.handler(event));
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker(handler.id);
      
    } catch (error) {
      this.logger.error('Handler execution failed', {
        handlerId: handler.id,
        eventId: event.id,
        error
      });
      
      // Update circuit breaker
      this.updateCircuitBreaker(handler.id);
      
      // Call error handler if present
      if (handler.errorHandler) {
        try {
          handler.errorHandler(error as Error, event);
        } catch (errorHandlerError) {
          this.logger.error('Error handler failed', errorHandlerError);
        }
      }
      
      throw error;
    } finally {
      // Update handler latency
      const latency = performance.now() - startTime;
      this.metrics.handlerLatencies.set(handler.id, latency);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.batchBuffer.length === 0) return;
    
    const now = Date.now();
    const timeSinceLastBatch = now - this.lastBatchTime;
    
    // Process batch if buffer is full or timeout reached
    if (this.batchBuffer.length >= this.config.batchSize || 
        timeSinceLastBatch >= this.config.processingInterval) {
      
      const batchToProcess = this.batchBuffer.splice(0);
      this.lastBatchTime = now;
      
      // Process batch events
      for (const event of batchToProcess) {
        await this.processEvent(event);
      }
    }
  }

  private getApplicableHandlers(event: TradingEvent): EventHandler[] {
    const handlers = Array.from(this.handlers.values());
    
    return handlers.filter(handler => 
      handler.enabled &&
      handler.eventTypes.includes(event.type) &&
      !this.isCircuitBreakerOpen(handler.id)
    ).sort((a, b) => b.priority - a.priority); // Higher priority first
  }

  private isCircuitBreakerOpen(handlerId: string): boolean {
    if (!this.config.circuitBreaker.enabled) return false;
    
    const state = this.circuitBreakers.get(handlerId);
    if (!state) return false;
    
    if (state.isOpen) {
      const now = Date.now();
      if (now >= state.nextRetryTime) {
        // Try to recover
        state.isOpen = false;
        state.errorCount = 0;
        this.logger.info('Circuit breaker recovered', { handlerId });
      }
    }
    
    return state.isOpen;
  }

  private updateCircuitBreaker(handlerId: string): void {
    if (!this.config.circuitBreaker.enabled) return;
    
    const state = this.circuitBreakers.get(handlerId);
    if (!state) return;
    
    state.errorCount++;
    state.lastFailTime = Date.now();
    
    if (state.errorCount >= this.config.circuitBreaker.errorThreshold) {
      state.isOpen = true;
      state.nextRetryTime = Date.now() + this.config.circuitBreaker.recoveryTimeMs;
      
      this.logger.warn('Circuit breaker opened', {
        handlerId,
        errorCount: state.errorCount
      });
    }
  }

  private resetCircuitBreaker(handlerId: string): void {
    const state = this.circuitBreakers.get(handlerId);
    if (state) {
      state.errorCount = 0;
      state.isOpen = false;
    }
  }

  private addToDeadLetterQueue(event: TradingEvent): void {
    if (this.deadLetterQueue.length >= this.config.deadLetterQueue.maxSize) {
      this.deadLetterQueue.shift(); // Remove oldest
    }
    
    this.deadLetterQueue.push({
      ...event,
      metadata: {
        ...event.metadata,
        failedAt: Date.now(),
        retryCount: (event.metadata?.retryCount || 0) + 1
      }
    });
  }

  private updateLatencyMetrics(latency: number): void {
    this.metrics.averageLatency = (this.metrics.averageLatency + latency) / 2;
    this.metrics.maxLatency = Math.max(this.metrics.maxLatency, latency);
    this.metrics.minLatency = Math.min(this.metrics.minLatency, latency);
  }

  private updateQueueDepthMetric(): void {
    let totalDepth = 0;
    for (const queue of this.eventQueues.values()) {
      totalDepth += queue.events.length;
    }
    this.metrics.queueDepth = totalDepth;
  }

  private startMetricsCollection(): void {
    this.metricsTimer = setInterval(() => {
      this.calculateThroughput();
      this.emit('metrics-updated', this.metrics);
    }, this.config.metricsInterval);
  }

  private calculateThroughput(): void {
    const now = Date.now();
    const timeDiff = (now - this.metrics.lastUpdate) / 1000; // seconds
    
    if (timeDiff > 0) {
      this.metrics.throughput = this.metrics.processedEvents / timeDiff;
    }
    
    this.metrics.lastUpdate = now;
  }

  private async processRemainingEvents(): Promise<void> {
    this.logger.info('Processing remaining events before shutdown');
    
    let remainingEvents = 0;
    for (const queue of this.eventQueues.values()) {
      remainingEvents += queue.events.length;
    }
    
    if (remainingEvents > 0) {
      this.logger.info('Processing remaining events', { count: remainingEvents });
      await this.processEvents();
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ProcessingMetrics {
    this.updateQueueDepthMetric();
    return { ...this.metrics };
  }

  /**
   * Get queue statistics
   */
  public getQueueStats(): Array<{ priority: EventPriority; depth: number; maxSize: number }> {
    return Array.from(this.eventQueues.entries()).map(([priority, queue]) => ({
      priority,
      depth: queue.events.length,
      maxSize: queue.maxSize
    }));
  }

  /**
   * Get handler statistics
   */
  public getHandlerStats(): Array<{
    id: string;
    name: string;
    enabled: boolean;
    latency: number;
    circuitBreakerOpen: boolean;
  }> {
    return Array.from(this.handlers.values()).map(handler => ({
      id: handler.id,
      name: handler.name,
      enabled: handler.enabled,
      latency: this.metrics.handlerLatencies.get(handler.id) || 0,
      circuitBreakerOpen: this.isCircuitBreakerOpen(handler.id)
    }));
  }

  /**
   * Get dead letter queue
   */
  public getDeadLetterQueue(): TradingEvent[] {
    return [...this.deadLetterQueue];
  }

  /**
   * Clear dead letter queue
   */
  public clearDeadLetterQueue(): void {
    this.deadLetterQueue.length = 0;
    this.logger.info('Dead letter queue cleared');
  }

  /**
   * Flush all queues
   */
  public async flushQueues(): Promise<void> {
    this.logger.info('Flushing all event queues');
    await this.processEvents();
  }

  /**
   * Check if processor is ready
   */
  public isReady(): boolean {
    return this.isActive && !this.isProcessing;
  }

  /**
   * Emergency stop processing
   */
  public emergencyStop(reason: string): void {
    this.logger.error('Emergency stop triggered', { reason });
    
    this.isActive = false;
    
    if (this.processingLoop) {
      clearInterval(this.processingLoop);
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }
    
    this.emit('emergency-stop', { reason, timestamp: Date.now() });
  }
}