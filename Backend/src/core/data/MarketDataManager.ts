/**
 * Market Data Manager - High-Performance Real-Time Data Processing
 * Handles all market data streams with ultra-low latency requirements
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  MarketData,
  OrderBook,
  TapeEntry,
  ConnectionStatus,
  MarketDataMessage,
  OrderBookMessage,
  TapeMessage,
  SystemHealth
} from '@/types/trading';

export interface DataFeed {
  id: string;
  name: string;
  type: 'primary' | 'secondary' | 'backup';
  status: ConnectionStatus;
  latency: number;
  dataQuality: number;
  reconnectAttempts: number;
}

export interface DataQualityMetrics {
  totalMessages: number;
  validMessages: number;
  invalidMessages: number;
  duplicateMessages: number;
  outOfOrderMessages: number;
  averageLatency: number;
  maxLatency: number;
  minLatency: number;
  messagesPerSecond: number;
  lastUpdate: number;
}

export interface MarketDataConfig {
  symbol: string;
  dataFeeds: DataFeed[];
  bufferSize: number;
  qualityThreshold: number;
  maxLatency: number;
  reconnectAttempts: number;
  heartbeatInterval: number;
  compression: boolean;
}

export class MarketDataManager extends EventEmitter {
  private logger: Logger;
  private config: MarketDataConfig;
  
  // Data storage
  private currentMarketData: Map<string, MarketData> = new Map();
  private currentOrderBooks: Map<string, OrderBook> = new Map();
  private recentTicks: Map<string, MarketData[]> = new Map();
  private tapeBuffer: Map<string, TapeEntry[]> = new Map();
  
  // Performance tracking
  private dataFeeds: Map<string, DataFeed> = new Map();
  private qualityMetrics: Map<string, DataQualityMetrics> = new Map();
  private lastSequence: Map<string, number> = new Map();
  
  // Processing state
  private isActive: boolean = false;
  private processingStats = {
    totalProcessed: 0,
    errorsCount: 0,
    startTime: Date.now(),
    lastProcessTime: 0,
    averageProcessingTime: 0
  };
  
  private heartbeatTimer?: NodeJS.Timeout;
  private cleanupTimer?: NodeJS.Timeout;
  private metricsTimer?: NodeJS.Timeout;

  constructor(config: MarketDataConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'MarketDataManager' });
    
    this.initializeDataFeeds();
    this.initializeMetrics();
    this.setupCleanupTasks();
    
    this.logger.info('MarketDataManager initialized', {
      symbol: config.symbol,
      feeds: config.dataFeeds.length,
      bufferSize: config.bufferSize
    });
  }

  private initializeDataFeeds(): void {
    this.config.dataFeeds.forEach(feed => {
      this.dataFeeds.set(feed.id, {
        ...feed,
        status: {
          isConnected: false,
          status: 'disconnected',
          lastHeartbeat: new Date().toISOString()
        },
        latency: 0,
        dataQuality: 0,
        reconnectAttempts: 0
      });
    });
  }

  private initializeMetrics(): void {
    this.config.dataFeeds.forEach(feed => {
      this.qualityMetrics.set(feed.id, {
        totalMessages: 0,
        validMessages: 0,
        invalidMessages: 0,
        duplicateMessages: 0,
        outOfOrderMessages: 0,
        averageLatency: 0,
        maxLatency: 0,
        minLatency: Number.MAX_VALUE,
        messagesPerSecond: 0,
        lastUpdate: Date.now()
      });
      this.lastSequence.set(feed.id, 0);
    });
  }

  private setupCleanupTasks(): void {
    // Cleanup old data every 30 seconds
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, 30000);

    // Update metrics every 5 seconds
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, 5000);
  }

  /**
   * Start the market data manager
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting MarketDataManager');
      
      this.isActive = true;
      this.processingStats.startTime = Date.now();
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Connect to all data feeds
      await this.connectToFeeds();
      
      this.emit('manager-started');
      this.logger.info('MarketDataManager started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start MarketDataManager', error);
      throw error;
    }
  }

  /**
   * Stop the market data manager
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping MarketDataManager');
      
      this.isActive = false;
      
      // Stop timers
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (this.cleanupTimer) clearInterval(this.cleanupTimer);
      if (this.metricsTimer) clearInterval(this.metricsTimer);
      
      // Disconnect from all feeds
      await this.disconnectFromFeeds();
      
      this.emit('manager-stopped');
      this.logger.info('MarketDataManager stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping MarketDataManager', error);
      throw error;
    }
  }

  /**
   * Process incoming market data message
   */
  public async processMarketData(feedId: string, message: MarketDataMessage): Promise<void> {
    if (!this.isActive) return;
    
    const startTime = performance.now();
    
    try {
      // Validate message
      if (!this.validateMarketData(message.payload)) {
        this.updateQualityMetric(feedId, 'invalidMessages');
        this.logger.warn('Invalid market data received', { feedId, data: message.payload });
        return;
      }
      
      // Check for duplicates
      if (this.isDuplicate(feedId, message)) {
        this.updateQualityMetric(feedId, 'duplicateMessages');
        return;
      }
      
      // Check sequence
      if (this.isOutOfOrder(feedId, message)) {
        this.updateQualityMetric(feedId, 'outOfOrderMessages');
        this.logger.debug('Out of order message', { feedId, sequence: message.sequence });
      }
      
      // Calculate latency
      const latency = Date.now() - message.timestamp;
      this.updateLatencyMetrics(feedId, latency);
      
      // Store market data
      this.storeMarketData(message.payload);
      
      // Update statistics
      this.updateQualityMetric(feedId, 'validMessages');
      this.processingStats.totalProcessed++;
      
      // Emit event
      this.emit('market-data', {
        feedId,
        data: message.payload,
        latency,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.logger.error('Error processing market data', error);
      this.updateQualityMetric(feedId, 'invalidMessages');
      this.processingStats.errorsCount++;
    } finally {
      // Update processing time
      const processingTime = performance.now() - startTime;
      this.processingStats.lastProcessTime = processingTime;
      this.processingStats.averageProcessingTime = 
        (this.processingStats.averageProcessingTime + processingTime) / 2;
    }
  }

  /**
   * Process incoming order book message
   */
  public async processOrderBook(feedId: string, message: OrderBookMessage): Promise<void> {
    if (!this.isActive) return;
    
    try {
      // Validate order book
      if (!this.validateOrderBook(message.payload)) {
        this.updateQualityMetric(feedId, 'invalidMessages');
        return;
      }
      
      // Store order book
      this.currentOrderBooks.set(this.config.symbol, message.payload);
      
      // Update statistics
      this.updateQualityMetric(feedId, 'validMessages');
      
      // Emit event
      this.emit('order-book', {
        feedId,
        orderBook: message.payload,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.logger.error('Error processing order book', error);
      this.processingStats.errorsCount++;
    }
  }

  /**
   * Process incoming tape message
   */
  public async processTape(feedId: string, message: TapeMessage): Promise<void> {
    if (!this.isActive) return;
    
    try {
      // Validate tape entries
      const validEntries = message.payload.filter(entry => this.validateTapeEntry(entry));
      
      if (validEntries.length === 0) {
        this.updateQualityMetric(feedId, 'invalidMessages');
        return;
      }
      
      // Store tape entries
      this.storeTapeEntries(validEntries);
      
      // Update statistics
      this.updateQualityMetric(feedId, 'validMessages');
      
      // Emit event
      this.emit('tape', {
        feedId,
        entries: validEntries,
        timestamp: Date.now()
      });
      
    } catch (error) {
      this.logger.error('Error processing tape', error);
      this.processingStats.errorsCount++;
    }
  }

  private validateMarketData(data: MarketData): boolean {
    return !!(
      data.price > 0 &&
      data.volume >= 0 &&
      data.timestamp > 0 &&
      data.bid > 0 &&
      data.ask > 0 &&
      data.bid <= data.ask
    );
  }

  private validateOrderBook(orderBook: OrderBook): boolean {
    return !!(
      orderBook.bids.length > 0 &&
      orderBook.asks.length > 0 &&
      orderBook.timestamp > 0 &&
      orderBook.bids[0].price < orderBook.asks[0].price
    );
  }

  private validateTapeEntry(entry: TapeEntry): boolean {
    return !!(
      entry.price > 0 &&
      entry.volume > 0 &&
      entry.timestamp > 0
    );
  }

  private isDuplicate(feedId: string, message: MarketDataMessage): boolean {
    // Simple duplicate detection based on timestamp and price
    const recent = this.recentTicks.get(this.config.symbol) || [];
    return recent.some(tick => 
      Math.abs(tick.timestamp - message.payload.timestamp) < 100 &&
      tick.price === message.payload.price
    );
  }

  private isOutOfOrder(feedId: string, message: MarketDataMessage): boolean {
    if (!message.sequence) return false;
    
    const lastSeq = this.lastSequence.get(feedId) || 0;
    const isOutOfOrder = message.sequence <= lastSeq;
    
    if (!isOutOfOrder) {
      this.lastSequence.set(feedId, message.sequence);
    }
    
    return isOutOfOrder;
  }

  private storeMarketData(data: MarketData): void {
    // Store current data
    this.currentMarketData.set(this.config.symbol, data);
    
    // Store in recent ticks buffer
    let recentTicks = this.recentTicks.get(this.config.symbol) || [];
    recentTicks.push(data);
    
    // Keep only recent data
    if (recentTicks.length > this.config.bufferSize) {
      recentTicks = recentTicks.slice(-this.config.bufferSize);
    }
    
    this.recentTicks.set(this.config.symbol, recentTicks);
  }

  private storeTapeEntries(entries: TapeEntry[]): void {
    let buffer = this.tapeBuffer.get(this.config.symbol) || [];
    buffer.push(...entries);
    
    // Keep only recent entries
    if (buffer.length > this.config.bufferSize * 2) {
      buffer = buffer.slice(-this.config.bufferSize * 2);
    }
    
    this.tapeBuffer.set(this.config.symbol, buffer);
  }

  private updateQualityMetric(feedId: string, metric: keyof DataQualityMetrics): void {
    const metrics = this.qualityMetrics.get(feedId);
    if (metrics) {
      if (typeof metrics[metric] === 'number') {
        (metrics[metric] as number)++;
      }
      metrics.totalMessages++;
      metrics.lastUpdate = Date.now();
    }
  }

  private updateLatencyMetrics(feedId: string, latency: number): void {
    const feed = this.dataFeeds.get(feedId);
    const metrics = this.qualityMetrics.get(feedId);
    
    if (feed && metrics) {
      feed.latency = latency;
      
      metrics.averageLatency = (metrics.averageLatency + latency) / 2;
      metrics.maxLatency = Math.max(metrics.maxLatency, latency);
      metrics.minLatency = Math.min(metrics.minLatency, latency);
    }
  }

  private async connectToFeeds(): Promise<void> {
    // This would connect to actual data feeds
    // For now, simulate connections
    for (const [feedId, feed] of this.dataFeeds) {
      feed.status = {
        isConnected: true,
        status: 'connected',
        lastHeartbeat: new Date().toISOString(),
        connectionTime: new Date().toISOString()
      };
      
      this.logger.info('Connected to data feed', { feedId, type: feed.type });
    }
  }

  private async disconnectFromFeeds(): Promise<void> {
    for (const [feedId, feed] of this.dataFeeds) {
      feed.status = {
        isConnected: false,
        status: 'disconnected',
        lastHeartbeat: new Date().toISOString()
      };
      
      this.logger.info('Disconnected from data feed', { feedId });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }

  private sendHeartbeat(): void {
    const now = new Date().toISOString();
    
    for (const [feedId, feed] of this.dataFeeds) {
      if (feed.status.isConnected) {
        feed.status.lastHeartbeat = now;
      }
    }
    
    this.emit('heartbeat', { timestamp: now, feeds: Array.from(this.dataFeeds.keys()) });
  }

  private cleanupOldData(): void {
    const cutoffTime = Date.now() - (300000); // 5 minutes
    
    // Cleanup recent ticks
    for (const [symbol, ticks] of this.recentTicks) {
      const filteredTicks = ticks.filter(tick => tick.timestamp > cutoffTime);
      this.recentTicks.set(symbol, filteredTicks);
    }
    
    // Cleanup tape buffer
    for (const [symbol, entries] of this.tapeBuffer) {
      const filteredEntries = entries.filter(entry => entry.timestamp > cutoffTime);
      this.tapeBuffer.set(symbol, filteredEntries);
    }
  }

  private updateMetrics(): void {
    for (const [feedId, metrics] of this.qualityMetrics) {
      const timeDiff = (Date.now() - metrics.lastUpdate) / 1000;
      if (timeDiff > 0) {
        metrics.messagesPerSecond = metrics.validMessages / timeDiff;
      }
      
      // Calculate data quality
      const feed = this.dataFeeds.get(feedId);
      if (feed && metrics.totalMessages > 0) {
        const validRatio = metrics.validMessages / metrics.totalMessages;
        const latencyScore = Math.max(0, 1 - (feed.latency / this.config.maxLatency));
        feed.dataQuality = (validRatio * 0.7) + (latencyScore * 0.3);
      }
    }
  }

  /**
   * Get current market data for symbol
   */
  public getMarketData(symbol: string = this.config.symbol): MarketData | undefined {
    return this.currentMarketData.get(symbol);
  }

  /**
   * Get current order book for symbol
   */
  public getOrderBook(symbol: string = this.config.symbol): OrderBook | undefined {
    return this.currentOrderBooks.get(symbol);
  }

  /**
   * Get recent ticks for symbol
   */
  public getRecentTicks(symbol: string = this.config.symbol, count: number = 100): MarketData[] {
    const ticks = this.recentTicks.get(symbol) || [];
    return ticks.slice(-count);
  }

  /**
   * Get recent tape entries for symbol
   */
  public getRecentTape(symbol: string = this.config.symbol, count: number = 100): TapeEntry[] {
    const entries = this.tapeBuffer.get(symbol) || [];
    return entries.slice(-count);
  }

  /**
   * Get data feed status
   */
  public getDataFeedStatus(): DataFeed[] {
    return Array.from(this.dataFeeds.values());
  }

  /**
   * Get quality metrics
   */
  public getQualityMetrics(): DataQualityMetrics[] {
    return Array.from(this.qualityMetrics.values());
  }

  /**
   * Get system health metrics
   */
  public getSystemHealth(): SystemHealth {
    const totalErrors = this.processingStats.errorsCount;
    const uptime = Date.now() - this.processingStats.startTime;
    
    return {
      cpu: 0, // Would be calculated from actual system metrics
      memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      latency: this.processingStats.averageProcessingTime,
      uptime: Math.round(uptime / 1000),
      errors: totalErrors,
      warnings: 0
    };
  }

  /**
   * Check if manager is ready for trading
   */
  public isReady(): boolean {
    if (!this.isActive) return false;
    
    // Check if at least one primary feed is connected with good quality
    const primaryFeeds = Array.from(this.dataFeeds.values())
      .filter(feed => feed.type === 'primary');
    
    return primaryFeeds.some(feed => 
      feed.status.isConnected && 
      feed.dataQuality >= this.config.qualityThreshold
    );
  }

  /**
   * Emergency shutdown
   */
  public emergencyShutdown(reason: string): void {
    this.logger.error('Emergency shutdown triggered', { reason });
    
    this.isActive = false;
    
    // Stop all timers
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    if (this.metricsTimer) clearInterval(this.metricsTimer);
    
    this.emit('emergency-shutdown', { reason, timestamp: Date.now() });
  }
}