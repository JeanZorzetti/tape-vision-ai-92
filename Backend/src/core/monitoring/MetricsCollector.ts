/**
 * Metrics Collector - Comprehensive Performance Monitoring and Analytics
 * Collects, aggregates, and analyzes system and trading performance metrics
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import { performance } from 'perf_hooks';

export interface SystemMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    packetsIn: number;
    packetsOut: number;
    connections: number;
  };
  disk: {
    usage: number;
    available: number;
    reads: number;
    writes: number;
  };
  uptime: number;
}

export interface TradingMetrics {
  timestamp: number;
  positions: {
    active: number;
    total: number;
    totalValue: number;
    pnl: number;
    unrealizedPnl: number;
    maxDrawdown: number;
  };
  orders: {
    active: number;
    total: number;
    filled: number;
    canceled: number;
    rejected: number;
    fillRate: number;
    avgExecutionTime: number;
  };
  market: {
    ticksProcessed: number;
    messagesProcessed: number;
    avgLatency: number;
    maxLatency: number;
    dataQuality: number;
    connectionsActive: number;
  };
  strategy: {
    signalsGenerated: number;
    tradesExecuted: number;
    winRate: number;
    profitFactor: number;
    sharpeRatio: number;
    confidence: number;
  };
}

export interface PerformanceMetrics {
  timestamp: number;
  latency: {
    marketData: number;
    orderExecution: number;
    signalGeneration: number;
    riskCheck: number;
    totalPipeline: number;
  };
  throughput: {
    ticksPerSecond: number;
    ordersPerSecond: number;
    eventsPerSecond: number;
    messagesPerSecond: number;
  };
  errors: {
    total: number;
    rate: number;
    byType: Map<string, number>;
    critical: number;
  };
  availability: {
    uptime: number;
    downtime: number;
    uptimePercentage: number;
    mtbf: number; // Mean Time Between Failures
    mttr: number; // Mean Time To Recovery
  };
}

export interface AlertThreshold {
  id: string;
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'equals';
  value: number;
  duration: number; // milliseconds
  enabled: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface Alert {
  id: string;
  thresholdId: string;
  timestamp: number;
  metric: string;
  value: number;
  threshold: number;
  condition: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: number;
}

export interface MetricsSummary {
  period: 'minute' | 'hour' | 'day';
  startTime: number;
  endTime: number;
  system: {
    avgCpuUsage: number;
    maxCpuUsage: number;
    avgMemoryUsage: number;
    maxMemoryUsage: number;
    totalErrors: number;
    uptime: number;
  };
  trading: {
    totalTrades: number;
    totalVolume: number;
    totalPnl: number;
    winRate: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  performance: {
    avgLatency: number;
    maxLatency: number;
    avgThroughput: number;
    maxThroughput: number;
    errorRate: number;
  };
}

export interface MetricsCollectorConfig {
  collectionInterval: number;
  retentionPeriod: number; // in hours
  alertsEnabled: boolean;
  exportEnabled: boolean;
  exportInterval: number;
  aggregationLevels: ('minute' | 'hour' | 'day')[];
  maxDataPoints: number;
  thresholds: AlertThreshold[];
}

export class MetricsCollector extends EventEmitter {
  private logger: Logger;
  private config: MetricsCollectorConfig;
  
  // Metrics storage
  private systemMetricsHistory: SystemMetrics[] = [];
  private tradingMetricsHistory: TradingMetrics[] = [];
  private performanceMetricsHistory: PerformanceMetrics[] = [];
  
  // Current metrics
  private currentSystemMetrics: SystemMetrics | null = null;
  private currentTradingMetrics: TradingMetrics | null = null;
  private currentPerformanceMetrics: PerformanceMetrics | null = null;
  
  // Alerts
  private alertThresholds: Map<string, AlertThreshold> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  
  // Aggregated data
  private aggregatedMetrics: Map<string, MetricsSummary[]> = new Map();
  
  // Timers and state
  private collectionTimer?: NodeJS.Timeout;
  private exportTimer?: NodeJS.Timeout;
  private isActive: boolean = false;
  
  // Performance tracking
  private startTime: number = Date.now();
  private downtime: number = 0;
  private lastFailureTime: number = 0;
  private failureCount: number = 0;
  private recoveryTimes: number[] = [];

  constructor(config: MetricsCollectorConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'MetricsCollector' });
    
    this.initializeThresholds();
    this.initializeAggregationMaps();
    
    this.logger.info('MetricsCollector initialized', {
      collectionInterval: config.collectionInterval,
      retentionPeriod: config.retentionPeriod,
      alertsEnabled: config.alertsEnabled
    });
  }

  /**
   * Start the metrics collector
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting MetricsCollector');
      
      this.isActive = true;
      this.startTime = Date.now();
      
      // Start collection timer
      this.collectionTimer = setInterval(async () => {
        await this.collectMetrics();
      }, this.config.collectionInterval);
      
      // Start export timer if enabled
      if (this.config.exportEnabled) {
        this.exportTimer = setInterval(async () => {
          await this.exportMetrics();
        }, this.config.exportInterval);
      }
      
      // Initial collection
      await this.collectMetrics();
      
      this.emit('collector-started');
      this.logger.info('MetricsCollector started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start MetricsCollector', error);
      throw error;
    }
  }

  /**
   * Stop the metrics collector
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping MetricsCollector');
      
      this.isActive = false;
      
      // Stop timers
      if (this.collectionTimer) clearInterval(this.collectionTimer);
      if (this.exportTimer) clearInterval(this.exportTimer);
      
      // Final collection
      await this.collectMetrics();
      
      // Export final metrics if enabled
      if (this.config.exportEnabled) {
        await this.exportMetrics();
      }
      
      this.emit('collector-stopped');
      this.logger.info('MetricsCollector stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping MetricsCollector', error);
      throw error;
    }
  }

  /**
   * Record custom metric
   */
  public recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    try {
      const metric = {
        name,
        value,
        timestamp: Date.now(),
        tags: tags || {}
      };
      
      this.emit('custom-metric', metric);
      
    } catch (error) {
      this.logger.error('Error recording custom metric', error);
    }
  }

  /**
   * Record performance timing
   */
  public recordTiming(operation: string, duration: number): void {
    try {
      const timing = {
        operation,
        duration,
        timestamp: Date.now()
      };
      
      this.emit('timing-recorded', timing);
      
    } catch (error) {
      this.logger.error('Error recording timing', error);
    }
  }

  /**
   * Record error occurrence
   */
  public recordError(error: Error, context?: Record<string, any>): void {
    try {
      const errorMetric = {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
        context: context || {}
      };
      
      this.emit('error-recorded', errorMetric);
      
      // Update current performance metrics
      if (this.currentPerformanceMetrics) {
        this.currentPerformanceMetrics.errors.total++;
        this.currentPerformanceMetrics.errors.byType.set(
          errorMetric.type,
          (this.currentPerformanceMetrics.errors.byType.get(errorMetric.type) || 0) + 1
        );
      }
      
    } catch (recordError) {
      this.logger.error('Error recording error metric', recordError);
    }
  }

  private async collectMetrics(): Promise<void> {
    if (!this.isActive) return;
    
    try {
      // Collect system metrics
      const systemMetrics = await this.collectSystemMetrics();
      this.currentSystemMetrics = systemMetrics;
      this.systemMetricsHistory.push(systemMetrics);
      
      // Collect trading metrics (would integrate with actual trading components)
      const tradingMetrics = this.collectTradingMetrics();
      this.currentTradingMetrics = tradingMetrics;
      this.tradingMetricsHistory.push(tradingMetrics);
      
      // Collect performance metrics
      const performanceMetrics = this.collectPerformanceMetrics();
      this.currentPerformanceMetrics = performanceMetrics;
      this.performanceMetricsHistory.push(performanceMetrics);
      
      // Cleanup old metrics
      this.cleanupOldMetrics();
      
      // Check alerts
      if (this.config.alertsEnabled) {
        this.checkAlerts();
      }
      
      // Aggregate metrics
      this.aggregateMetrics();
      
      this.emit('metrics-collected', {
        system: systemMetrics,
        trading: tradingMetrics,
        performance: performanceMetrics
      });
      
    } catch (error) {
      this.logger.error('Error collecting metrics', error);
      this.recordError(error as Error);
    }
  }

  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // In a real implementation, you would use libraries like 'os-utils' or 'systeminformation'
    // to get actual system metrics. This is a simplified version.
    
    return {
      timestamp: Date.now(),
      cpu: {
        usage: 0, // Would calculate actual CPU usage
        loadAverage: [0, 0, 0], // Would use os.loadavg()
        cores: require('os').cpus().length
      },
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      network: {
        bytesIn: 0,
        bytesOut: 0,
        packetsIn: 0,
        packetsOut: 0,
        connections: 0
      },
      disk: {
        usage: 0,
        available: 0,
        reads: 0,
        writes: 0
      },
      uptime: process.uptime() * 1000
    };
  }

  private collectTradingMetrics(): TradingMetrics {
    // This would integrate with actual trading components
    // For now, return mock data
    
    return {
      timestamp: Date.now(),
      positions: {
        active: 0,
        total: 0,
        totalValue: 0,
        pnl: 0,
        unrealizedPnl: 0,
        maxDrawdown: 0
      },
      orders: {
        active: 0,
        total: 0,
        filled: 0,
        canceled: 0,
        rejected: 0,
        fillRate: 0,
        avgExecutionTime: 0
      },
      market: {
        ticksProcessed: 0,
        messagesProcessed: 0,
        avgLatency: 0,
        maxLatency: 0,
        dataQuality: 1.0,
        connectionsActive: 1
      },
      strategy: {
        signalsGenerated: 0,
        tradesExecuted: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        confidence: 0
      }
    };
  }

  private collectPerformanceMetrics(): PerformanceMetrics {
    const currentTime = Date.now();
    const totalUptime = currentTime - this.startTime;
    const uptimePercentage = totalUptime > 0 ? ((totalUptime - this.downtime) / totalUptime) * 100 : 100;
    
    return {
      timestamp: currentTime,
      latency: {
        marketData: 0,
        orderExecution: 0,
        signalGeneration: 0,
        riskCheck: 0,
        totalPipeline: 0
      },
      throughput: {
        ticksPerSecond: 0,
        ordersPerSecond: 0,
        eventsPerSecond: 0,
        messagesPerSecond: 0
      },
      errors: {
        total: 0,
        rate: 0,
        byType: new Map(),
        critical: 0
      },
      availability: {
        uptime: totalUptime - this.downtime,
        downtime: this.downtime,
        uptimePercentage,
        mtbf: this.calculateMTBF(),
        mttr: this.calculateMTTR()
      }
    };
  }

  private checkAlerts(): void {
    if (!this.currentSystemMetrics || !this.currentPerformanceMetrics) return;
    
    for (const threshold of this.alertThresholds.values()) {
      if (!threshold.enabled) continue;
      
      const currentValue = this.getMetricValue(threshold.metric);
      if (currentValue === null) continue;
      
      const shouldAlert = this.evaluateThreshold(currentValue, threshold);
      
      if (shouldAlert && !this.activeAlerts.has(threshold.id)) {
        this.triggerAlert(threshold, currentValue);
      } else if (!shouldAlert && this.activeAlerts.has(threshold.id)) {
        this.resolveAlert(threshold.id);
      }
    }
  }

  private getMetricValue(metricPath: string): number | null {
    // Parse metric path like "system.cpu.usage" or "performance.latency.marketData"
    const parts = metricPath.split('.');
    let current: any = {
      system: this.currentSystemMetrics,
      trading: this.currentTradingMetrics,
      performance: this.currentPerformanceMetrics
    };
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return typeof current === 'number' ? current : null;
  }

  private evaluateThreshold(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.condition) {
      case 'above': return value > threshold.value;
      case 'below': return value < threshold.value;
      case 'equals': return value === threshold.value;
      default: return false;
    }
  }

  private triggerAlert(threshold: AlertThreshold, currentValue: number): void {
    const alert: Alert = {
      id: this.generateAlertId(),
      thresholdId: threshold.id,
      timestamp: Date.now(),
      metric: threshold.metric,
      value: currentValue,
      threshold: threshold.value,
      condition: threshold.condition,
      priority: threshold.priority,
      message: `${threshold.name}: ${threshold.metric} is ${currentValue} (${threshold.condition} ${threshold.value})`,
      acknowledged: false
    };
    
    this.activeAlerts.set(threshold.id, alert);
    this.alertHistory.push(alert);
    
    this.logger.warn('Alert triggered', {
      alertId: alert.id,
      threshold: threshold.name,
      metric: threshold.metric,
      value: currentValue,
      priority: threshold.priority
    });
    
    this.emit('alert-triggered', alert);
  }

  private resolveAlert(thresholdId: string): void {
    const alert = this.activeAlerts.get(thresholdId);
    if (alert) {
      this.activeAlerts.delete(thresholdId);
      
      this.logger.info('Alert resolved', {
        alertId: alert.id,
        metric: alert.metric,
        duration: Date.now() - alert.timestamp
      });
      
      this.emit('alert-resolved', alert);
    }
  }

  private aggregateMetrics(): void {
    // Aggregate metrics by different time periods
    for (const period of this.config.aggregationLevels) {
      const summary = this.createSummary(period);
      
      let summaries = this.aggregatedMetrics.get(period);
      if (!summaries) {
        summaries = [];
        this.aggregatedMetrics.set(period, summaries);
      }
      
      summaries.push(summary);
      
      // Keep only recent summaries
      const maxSummaries = this.getMaxSummaries(period);
      if (summaries.length > maxSummaries) {
        summaries.splice(0, summaries.length - maxSummaries);
      }
    }
  }

  private createSummary(period: 'minute' | 'hour' | 'day'): MetricsSummary {
    const periodMs = this.getPeriodMs(period);
    const endTime = Date.now();
    const startTime = endTime - periodMs;
    
    // Filter metrics within the period
    const systemMetrics = this.systemMetricsHistory.filter(m => m.timestamp >= startTime);
    const performanceMetrics = this.performanceMetricsHistory.filter(m => m.timestamp >= startTime);
    
    return {
      period,
      startTime,
      endTime,
      system: {
        avgCpuUsage: this.average(systemMetrics.map(m => m.cpu.usage)),
        maxCpuUsage: Math.max(...systemMetrics.map(m => m.cpu.usage)),
        avgMemoryUsage: this.average(systemMetrics.map(m => m.memory.percentage)),
        maxMemoryUsage: Math.max(...systemMetrics.map(m => m.memory.percentage)),
        totalErrors: performanceMetrics.reduce((sum, m) => sum + m.errors.total, 0),
        uptime: systemMetrics.length > 0 ? systemMetrics[systemMetrics.length - 1].uptime : 0
      },
      trading: {
        totalTrades: 0,
        totalVolume: 0,
        totalPnl: 0,
        winRate: 0,
        sharpeRatio: 0,
        maxDrawdown: 0
      },
      performance: {
        avgLatency: this.average(performanceMetrics.map(m => m.latency.totalPipeline)),
        maxLatency: Math.max(...performanceMetrics.map(m => m.latency.totalPipeline)),
        avgThroughput: this.average(performanceMetrics.map(m => m.throughput.messagesPerSecond)),
        maxThroughput: Math.max(...performanceMetrics.map(m => m.throughput.messagesPerSecond)),
        errorRate: this.average(performanceMetrics.map(m => m.errors.rate))
      }
    };
  }

  private cleanupOldMetrics(): void {
    const cutoffTime = Date.now() - (this.config.retentionPeriod * 3600000);
    
    this.systemMetricsHistory = this.systemMetricsHistory.filter(m => m.timestamp > cutoffTime);
    this.tradingMetricsHistory = this.tradingMetricsHistory.filter(m => m.timestamp > cutoffTime);
    this.performanceMetricsHistory = this.performanceMetricsHistory.filter(m => m.timestamp > cutoffTime);
    
    // Also limit by max data points
    if (this.systemMetricsHistory.length > this.config.maxDataPoints) {
      this.systemMetricsHistory = this.systemMetricsHistory.slice(-this.config.maxDataPoints);
    }
    
    if (this.tradingMetricsHistory.length > this.config.maxDataPoints) {
      this.tradingMetricsHistory = this.tradingMetricsHistory.slice(-this.config.maxDataPoints);
    }
    
    if (this.performanceMetricsHistory.length > this.config.maxDataPoints) {
      this.performanceMetricsHistory = this.performanceMetricsHistory.slice(-this.config.maxDataPoints);
    }
  }

  private async exportMetrics(): Promise<void> {
    try {
      const exportData = {
        timestamp: Date.now(),
        system: this.currentSystemMetrics,
        trading: this.currentTradingMetrics,
        performance: this.currentPerformanceMetrics,
        alerts: Array.from(this.activeAlerts.values()),
        summaries: Object.fromEntries(this.aggregatedMetrics)
      };
      
      this.emit('metrics-exported', exportData);
      
    } catch (error) {
      this.logger.error('Error exporting metrics', error);
    }
  }

  private initializeThresholds(): void {
    for (const threshold of this.config.thresholds) {
      this.alertThresholds.set(threshold.id, threshold);
    }
  }

  private initializeAggregationMaps(): void {
    for (const period of this.config.aggregationLevels) {
      this.aggregatedMetrics.set(period, []);
    }
  }

  private calculateMTBF(): number {
    if (this.failureCount === 0) return 0;
    const totalRuntime = Date.now() - this.startTime;
    return totalRuntime / this.failureCount;
  }

  private calculateMTTR(): number {
    if (this.recoveryTimes.length === 0) return 0;
    return this.average(this.recoveryTimes);
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private getPeriodMs(period: 'minute' | 'hour' | 'day'): number {
    switch (period) {
      case 'minute': return 60 * 1000;
      case 'hour': return 60 * 60 * 1000;
      case 'day': return 24 * 60 * 60 * 1000;
    }
  }

  private getMaxSummaries(period: 'minute' | 'hour' | 'day'): number {
    switch (period) {
      case 'minute': return 1440; // 24 hours
      case 'hour': return 168; // 7 days
      case 'day': return 30; // 30 days
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current metrics
   */
  public getCurrentMetrics(): {
    system: SystemMetrics | null;
    trading: TradingMetrics | null;
    performance: PerformanceMetrics | null;
  } {
    return {
      system: this.currentSystemMetrics,
      trading: this.currentTradingMetrics,
      performance: this.currentPerformanceMetrics
    };
  }

  /**
   * Get metrics history
   */
  public getMetricsHistory(hours: number = 1): {
    system: SystemMetrics[];
    trading: TradingMetrics[];
    performance: PerformanceMetrics[];
  } {
    const cutoffTime = Date.now() - (hours * 3600000);
    
    return {
      system: this.systemMetricsHistory.filter(m => m.timestamp > cutoffTime),
      trading: this.tradingMetricsHistory.filter(m => m.timestamp > cutoffTime),
      performance: this.performanceMetricsHistory.filter(m => m.timestamp > cutoffTime)
    };
  }

  /**
   * Get active alerts
   */
  public getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  public getAlertHistory(hours: number = 24): Alert[] {
    const cutoffTime = Date.now() - (hours * 3600000);
    return this.alertHistory.filter(alert => alert.timestamp > cutoffTime);
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.acknowledged = true;
        alert.acknowledgedBy = acknowledgedBy;
        alert.acknowledgedAt = Date.now();
        
        this.emit('alert-acknowledged', alert);
        return true;
      }
    }
    return false;
  }

  /**
   * Get aggregated metrics
   */
  public getAggregatedMetrics(period: 'minute' | 'hour' | 'day'): MetricsSummary[] {
    return this.aggregatedMetrics.get(period) || [];
  }

  /**
   * Add custom threshold
   */
  public addThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.set(threshold.id, threshold);
    this.logger.info('Alert threshold added', { thresholdId: threshold.id, name: threshold.name });
  }

  /**
   * Remove threshold
   */
  public removeThreshold(thresholdId: string): void {
    this.alertThresholds.delete(thresholdId);
    
    // Resolve any active alert for this threshold
    if (this.activeAlerts.has(thresholdId)) {
      this.resolveAlert(thresholdId);
    }
    
    this.logger.info('Alert threshold removed', { thresholdId });
  }

  /**
   * Check if collector is ready
   */
  public isReady(): boolean {
    return this.isActive && this.currentSystemMetrics !== null;
  }
}