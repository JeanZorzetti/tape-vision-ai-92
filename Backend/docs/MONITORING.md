# Tape Vision AI - Monitoring & Logging Guide

## Overview

Comprehensive monitoring and logging are crucial for maintaining the reliability, performance, and security of the Tape Vision AI trading system. This guide covers system monitoring, performance metrics, log management, alerting, and troubleshooting procedures.

## Monitoring Architecture

### Monitoring Stack Overview

```
┌─────────────────────────────────────────────────────────┐
│                Application Layer                        │
│  ┌─────────────────────────────────────────────────────┐│
│  │ • Trading Engine Metrics • API Performance         ││
│  │ • WebSocket Connections • Business KPIs            ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ Metrics & Logs
┌─────────────────────▼───────────────────────────────────┐
│              Monitoring Infrastructure                  │
│  ┌─────────────────────────────────────────────────────┐│
│  │ Prometheus (Metrics) │ Winston (Logging)           ││
│  │ Grafana (Dashboards) │ ELK Stack (Log Analysis)    ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ Processed Data
┌─────────────────────▼───────────────────────────────────┐
│              Alerting & Notifications                   │
│  ┌─────────────────────────────────────────────────────┐│
│  │ • Email Alerts    • Slack Notifications            ││
│  │ • SMS Alerts      • Webhook Integrations           ││
│  │ • PagerDuty       • Custom Alert Handlers          ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## System Metrics

### Trading Performance Metrics

#### Core Trading KPIs

```typescript
// Trading performance metrics
interface TradingMetrics {
  // Performance Metrics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;            // Percentage of winning trades
  profitFactor: number;       // Gross profit / Gross loss
  sharpeRatio: number;        // Risk-adjusted return
  maxDrawdown: number;        // Maximum peak-to-trough decline
  
  // P&L Metrics
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalPnL: number;
  averageWin: number;
  averageLoss: number;
  
  // Risk Metrics
  currentRisk: number;
  maxRiskExposure: number;
  riskViolations: number;
  consecutiveStops: number;
  
  // Operational Metrics
  signalsGenerated: number;
  signalsExecuted: number;
  executionSuccessRate: number;
  averageExecutionTime: number;
  
  // AI/Analysis Metrics
  averageConfidence: number;
  patternsDetected: number;
  falseSignals: number;
  algorithmAccuracy: number;
}

class TradingMetricsCollector {
  private metrics: TradingMetrics = this.initializeMetrics();
  private metricsHistory: TradingMetrics[] = [];
  
  constructor(private logger: Logger) {}
  
  updateTradeMetrics(trade: TradeEntry): void {
    this.metrics.totalTrades++;
    
    if (trade.pnl && trade.pnl > 0) {
      this.metrics.winningTrades++;
      this.metrics.totalPnL += trade.pnl;
    } else if (trade.pnl && trade.pnl < 0) {
      this.metrics.losingTrades++;
      this.metrics.totalPnL += trade.pnl;
    }
    
    // Recalculate derived metrics
    this.calculateDerivedMetrics();
    
    // Log metrics update
    this.logger.info('Trading metrics updated', {
      component: 'TradingMetricsCollector',
      totalTrades: this.metrics.totalTrades,
      winRate: this.metrics.winRate,
      dailyPnL: this.metrics.dailyPnL
    });
  }
  
  private calculateDerivedMetrics(): void {
    if (this.metrics.totalTrades > 0) {
      this.metrics.winRate = (this.metrics.winningTrades / this.metrics.totalTrades) * 100;
    }
    
    // Calculate profit factor
    const grossProfit = this.calculateGrossProfit();
    const grossLoss = Math.abs(this.calculateGrossLoss());
    this.metrics.profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;
    
    // Update other derived metrics...
  }
  
  getMetricsSnapshot(): TradingMetrics {
    return { ...this.metrics };
  }
}
```

### System Performance Metrics

#### Application Metrics

```typescript
import * as promClient from 'prom-client';

class SystemMetricsCollector {
  // Trading-specific metrics
  private readonly tradesTotal = new promClient.Counter({
    name: 'trades_total',
    help: 'Total number of trades executed',
    labelNames: ['symbol', 'action', 'status']
  });
  
  private readonly tradePnL = new promClient.Gauge({
    name: 'trade_pnl',
    help: 'Profit/Loss from trades',
    labelNames: ['symbol', 'timeframe']
  });
  
  private readonly signalsGenerated = new promClient.Counter({
    name: 'signals_generated_total',
    help: 'Total number of signals generated',
    labelNames: ['signal_type', 'confidence_range']
  });
  
  private readonly processingLatency = new promClient.Histogram({
    name: 'market_data_processing_duration_seconds',
    help: 'Time taken to process market data',
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1]
  });
  
  // System metrics
  private readonly httpRequestDuration = new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
  });
  
  private readonly websocketConnections = new promClient.Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections'
  });
  
  private readonly databaseQueries = new promClient.Counter({
    name: 'database_queries_total',
    help: 'Total number of database queries',
    labelNames: ['operation', 'collection', 'status']
  });
  
  // Error metrics
  private readonly errors = new promClient.Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['type', 'component', 'severity']
  });
  
  constructor() {
    // Register default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics();
  }
  
  // Trading metrics methods
  recordTrade(trade: TradeEntry): void {
    this.tradesTotal.inc({
      symbol: trade.symbol,
      action: trade.action,
      status: trade.status
    });
    
    if (trade.pnl) {
      this.tradePnL.set(
        { symbol: trade.symbol, timeframe: 'daily' },
        trade.pnl
      );
    }
  }
  
  recordSignal(signal: string, confidence: number): void {
    const confidenceRange = this.getConfidenceRange(confidence);
    this.signalsGenerated.inc({
      signal_type: signal,
      confidence_range: confidenceRange
    });
  }
  
  recordProcessingTime(duration: number): void {
    this.processingLatency.observe(duration);
  }
  
  // System metrics methods
  recordHttpRequest(method: string, route: string, status: number, duration: number): void {
    this.httpRequestDuration
      .labels(method, route, status.toString())
      .observe(duration);
  }
  
  updateWebSocketConnections(count: number): void {
    this.websocketConnections.set(count);
  }
  
  recordDatabaseQuery(operation: string, collection: string, status: string): void {
    this.databaseQueries.inc({ operation, collection, status });
  }
  
  recordError(type: string, component: string, severity: string): void {
    this.errors.inc({ type, component, severity });
  }
  
  private getConfidenceRange(confidence: number): string {
    if (confidence >= 95) return '95-100';
    if (confidence >= 90) return '90-95';
    if (confidence >= 80) return '80-90';
    if (confidence >= 70) return '70-80';
    return 'below-70';
  }
  
  // Expose metrics endpoint
  getMetrics(): string {
    return promClient.register.metrics();
  }
}
```

---

## Logging System

### Logging Architecture

```typescript
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

class LoggingSystem {
  private logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss.SSS'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf((info) => {
          return JSON.stringify({
            timestamp: info.timestamp,
            level: info.level,
            component: info.component || 'unknown',
            message: info.message,
            ...info.metadata
          });
        })
      ),
      
      transports: [
        // Console logging for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        
        // Main application log
        new DailyRotateFile({
          filename: 'logs/application-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '14d',
          level: 'info'
        }),
        
        // Error log
        new DailyRotateFile({
          filename: 'logs/error-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '30d',
          level: 'error'
        }),
        
        // Trading-specific log
        new DailyRotateFile({
          filename: 'logs/trading-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '50m',
          maxFiles: '90d',
          level: 'info',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json()
          )
        }),
        
        // Security audit log
        new DailyRotateFile({
          filename: 'logs/security-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '10m',
          maxFiles: '365d',
          level: 'warn'
        }),
        
        // Performance log
        new DailyRotateFile({
          filename: 'logs/performance-%DATE%.log',
          datePattern: 'YYYY-MM-DD',
          maxSize: '20m',
          maxFiles: '7d',
          level: 'debug'
        })
      ],
      
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({ filename: 'logs/exceptions.log' })
      ],
      
      // Handle unhandled rejections
      rejectionHandlers: [
        new winston.transports.File({ filename: 'logs/rejections.log' })
      ]
    });
  }
  
  // Trading-specific logging methods
  logTrade(trade: TradeEntry, metadata?: any): void {
    this.logger.info('Trade executed', {
      component: 'TradingEngine',
      trade: {
        id: trade.id,
        action: trade.action,
        symbol: trade.symbol,
        price: trade.price,
        quantity: trade.quantity,
        confidence: trade.confidence,
        pnl: trade.pnl,
        status: trade.status
      },
      ...metadata
    });
  }
  
  logSignal(signal: any, analysis: any): void {
    this.logger.info('Signal generated', {
      component: 'SignalGenerator',
      signal: {
        action: signal.action,
        confidence: signal.confidence,
        timestamp: signal.timestamp
      },
      analysis: {
        entryReason: analysis.entryReason,
        componentScores: analysis.componentScores,
        finalCertainty: analysis.finalCertainty
      }
    });
  }
  
  logMarketData(data: MarketData, processingTime: number): void {
    this.logger.debug('Market data processed', {
      component: 'TradingEngine',
      marketData: {
        symbol: data.symbol || 'unknown',
        price: data.price,
        volume: data.volume,
        timestamp: data.timestamp
      },
      performance: {
        processingTime: processingTime,
        memoryUsage: process.memoryUsage().heapUsed
      }
    });
  }
  
  logError(error: Error, component: string, context?: any): void {
    this.logger.error('Application error', {
      component,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });
  }
  
  logSecurityEvent(event: string, details: any): void {
    this.logger.warn('Security event', {
      component: 'Security',
      event,
      details,
      timestamp: new Date().toISOString()
    });
  }
  
  logPerformance(operation: string, duration: number, metadata?: any): void {
    this.logger.debug('Performance metric', {
      component: 'PerformanceMonitor',
      operation,
      duration,
      ...metadata
    });
  }
}
```

### Structured Logging Standards

#### Log Entry Format

```typescript
interface LogEntry {
  timestamp: string;      // ISO 8601 format
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;      // Component that generated the log
  message: string;        // Human-readable message
  requestId?: string;     // Request correlation ID
  userId?: string;        // User identifier (if applicable)
  sessionId?: string;     // Trading session ID
  metadata: any;          // Additional structured data
}

// Example log entries
const examples = {
  trade: {
    timestamp: '2024-01-15T14:30:15.123Z',
    level: 'info',
    component: 'TradingEngine',
    message: 'Trade executed successfully',
    requestId: 'req_12345',
    sessionId: 'session_20240115',
    metadata: {
      trade: {
        id: 'trade_67890',
        action: 'BUY',
        symbol: 'WDO',
        price: 5.125,
        quantity: 2,
        pnl: 25.5,
        executionTime: 1.2
      }
    }
  },
  
  error: {
    timestamp: '2024-01-15T14:30:16.456Z',
    level: 'error',
    component: 'DatabaseManager',
    message: 'Database connection failed',
    requestId: 'req_12346',
    metadata: {
      error: {
        code: 'CONNECTION_TIMEOUT',
        details: 'Connection timeout after 30 seconds',
        stack: 'Error stack trace...'
      },
      operation: 'save_trade_data',
      retryAttempt: 3
    }
  },
  
  performance: {
    timestamp: '2024-01-15T14:30:17.789Z',
    level: 'debug',
    component: 'TapeReader',
    message: 'Pattern recognition completed',
    metadata: {
      performance: {
        processingTime: 2.3,
        patternsAnalyzed: 15,
        memoryUsage: 125.6,
        cpuUsage: 45.2
      },
      marketData: {
        symbol: 'WDO',
        dataPoints: 1000,
        timeframe: 60000
      }
    }
  }
};
```

---

## Dashboard and Visualization

### Grafana Dashboards

#### Trading Performance Dashboard

```json
{
  "dashboard": {
    "title": "Tape Vision AI - Trading Performance",
    "tags": ["trading", "performance"],
    "panels": [
      {
        "title": "Daily P&L",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(trade_pnl[24h]))",
            "legendFormat": "Daily P&L"
          }
        ]
      },
      {
        "title": "Win Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "(sum(trades_total{status=\"success\",pnl=\"positive\"}) / sum(trades_total)) * 100",
            "legendFormat": "Win Rate %"
          }
        ],
        "fieldConfig": {
          "min": 0,
          "max": 100,
          "thresholds": [
            {"color": "red", "value": 0},
            {"color": "yellow", "value": 60},
            {"color": "green", "value": 70}
          ]
        }
      },
      {
        "title": "Trades Over Time",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(trades_total[5m])",
            "legendFormat": "{{action}} - {{symbol}}"
          }
        ]
      },
      {
        "title": "Signal Confidence Distribution",
        "type": "heatmap",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, signals_generated_total)",
            "legendFormat": "95th Percentile"
          }
        ]
      }
    ]
  }
}
```

#### System Health Dashboard

```json
{
  "dashboard": {
    "title": "Tape Vision AI - System Health",
    "panels": [
      {
        "title": "Processing Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, market_data_processing_duration_seconds)",
            "legendFormat": "95th Percentile"
          },
          {
            "expr": "histogram_quantile(0.50, market_data_processing_duration_seconds)",
            "legendFormat": "50th Percentile"
          }
        ]
      },
      {
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes / 1024 / 1024",
            "legendFormat": "Memory MB"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "rate(errors_total[5m])",
            "legendFormat": "Errors per second"
          }
        ]
      },
      {
        "title": "WebSocket Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "websocket_connections_active",
            "legendFormat": "Active Connections"
          }
        ]
      }
    ]
  }
}
```

### Custom Monitoring Dashboards

```typescript
class DashboardManager {
  private grafana: GrafanaAPI;
  
  constructor(grafanaUrl: string, apiKey: string) {
    this.grafana = new GrafanaAPI(grafanaUrl, apiKey);
  }
  
  async createTradingDashboard(): Promise<void> {
    const dashboard = {
      dashboard: {
        title: 'Tape Vision AI - Real-time Trading',
        refresh: '5s',
        time: { from: 'now-1h', to: 'now' },
        panels: [
          this.createPnLPanel(),
          this.createPositionsPanel(),
          this.createSignalsPanel(),
          this.createRiskPanel()
        ]
      }
    };
    
    await this.grafana.createDashboard(dashboard);
  }
  
  private createPnLPanel(): Panel {
    return {
      title: 'Real-time P&L',
      type: 'stat',
      targets: [{
        expr: 'sum(trade_pnl)',
        interval: '1s',
        refId: 'A'
      }],
      fieldConfig: {
        defaults: {
          color: { mode: 'thresholds' },
          thresholds: {
            steps: [
              { color: 'red', value: -100 },
              { color: 'yellow', value: 0 },
              { color: 'green', value: 100 }
            ]
          }
        }
      }
    };
  }
}
```

---

## Alerting System

### Alert Configuration

```typescript
interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  duration: number;        // How long condition must be true
  cooldown: number;        // Minimum time between alerts
  enabled: boolean;
  channels: AlertChannel[];
}

class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  
  constructor(
    private metricsCollector: SystemMetricsCollector,
    private notificationService: NotificationService
  ) {
    this.initializeDefaultRules();
  }
  
  private initializeDefaultRules(): void {
    // Trading performance alerts
    this.addRule({
      name: 'daily_loss_limit',
      condition: 'daily_pnl < -threshold',
      threshold: -400, // 80% of max daily loss
      severity: 'critical',
      duration: 0,
      cooldown: 300000, // 5 minutes
      enabled: true,
      channels: ['email', 'slack', 'sms']
    });
    
    this.addRule({
      name: 'consecutive_stops',
      condition: 'consecutive_stops >= threshold',
      threshold: 2,
      severity: 'high',
      duration: 0,
      cooldown: 600000, // 10 minutes
      enabled: true,
      channels: ['email', 'slack']
    });
    
    this.addRule({
      name: 'low_win_rate',
      condition: 'win_rate < threshold',
      threshold: 50,
      severity: 'medium',
      duration: 3600000, // 1 hour
      cooldown: 1800000,  // 30 minutes
      enabled: true,
      channels: ['email']
    });
    
    // System performance alerts
    this.addRule({
      name: 'high_latency',
      condition: 'processing_latency_p95 > threshold',
      threshold: 10, // 10ms
      severity: 'medium',
      duration: 300000, // 5 minutes
      cooldown: 600000, // 10 minutes
      enabled: true,
      channels: ['slack']
    });
    
    this.addRule({
      name: 'memory_usage',
      condition: 'memory_usage > threshold',
      threshold: 80, // 80% of available memory
      severity: 'high',
      duration: 600000, // 10 minutes
      cooldown: 300000, // 5 minutes
      enabled: true,
      channels: ['email', 'slack']
    });
    
    this.addRule({
      name: 'error_rate',
      condition: 'error_rate > threshold',
      threshold: 5, // 5% error rate
      severity: 'high',
      duration: 300000, // 5 minutes
      cooldown: 300000, // 5 minutes
      enabled: true,
      channels: ['email', 'slack', 'pagerduty']
    });
  }
  
  async evaluateRules(): Promise<void> {
    const metrics = await this.getCurrentMetrics();
    
    for (const [name, rule] of this.rules) {
      if (!rule.enabled) continue;
      
      const conditionMet = this.evaluateCondition(rule, metrics);
      const activeAlert = this.activeAlerts.get(name);
      
      if (conditionMet && !activeAlert) {
        // New alert condition
        await this.triggerAlert(rule, metrics);
      } else if (!conditionMet && activeAlert) {
        // Alert resolved
        await this.resolveAlert(name);
      }
    }
  }
  
  private async triggerAlert(rule: AlertRule, metrics: any): Promise<void> {
    const alert: ActiveAlert = {
      rule: rule.name,
      triggeredAt: Date.now(),
      severity: rule.severity,
      message: this.generateAlertMessage(rule, metrics),
      metrics
    };
    
    this.activeAlerts.set(rule.name, alert);
    
    // Send notifications
    for (const channel of rule.channels) {
      await this.notificationService.send(channel, alert);
    }
    
    // Log alert
    this.logger.warn('Alert triggered', {
      component: 'AlertManager',
      alert: alert.rule,
      severity: alert.severity,
      metrics: alert.metrics
    });
  }
  
  private generateAlertMessage(rule: AlertRule, metrics: any): string {
    switch (rule.name) {
      case 'daily_loss_limit':
        return `Daily loss limit approaching: ${metrics.dailyPnL} points (limit: ${rule.threshold})`;
      
      case 'consecutive_stops':
        return `Consecutive stop losses detected: ${metrics.consecutiveStops}`;
      
      case 'high_latency':
        return `Processing latency too high: ${metrics.processingLatency}ms (threshold: ${rule.threshold}ms)`;
      
      default:
        return `Alert condition met: ${rule.condition}`;
    }
  }
}
```

### Notification Channels

```typescript
class NotificationService {
  constructor(
    private emailService: EmailService,
    private slackService: SlackService,
    private smsService: SMSService,
    private pagerDutyService: PagerDutyService
  ) {}
  
  async send(channel: string, alert: ActiveAlert): Promise<void> {
    try {
      switch (channel) {
        case 'email':
          await this.sendEmail(alert);
          break;
        case 'slack':
          await this.sendSlack(alert);
          break;
        case 'sms':
          await this.sendSMS(alert);
          break;
        case 'pagerduty':
          await this.sendPagerDuty(alert);
          break;
        default:
          throw new Error(`Unknown notification channel: ${channel}`);
      }
    } catch (error) {
      console.error(`Failed to send notification via ${channel}:`, error);
    }
  }
  
  private async sendEmail(alert: ActiveAlert): Promise<void> {
    await this.emailService.send({
      to: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
      subject: `[${alert.severity.toUpperCase()}] Tape Vision AI Alert: ${alert.rule}`,
      html: this.generateEmailHTML(alert)
    });
  }
  
  private async sendSlack(alert: ActiveAlert): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    
    await this.slackService.send({
      channel: process.env.SLACK_ALERT_CHANNEL || '#alerts',
      attachments: [{
        color,
        title: `🚨 ${alert.rule}`,
        text: alert.message,
        fields: [
          { title: 'Severity', value: alert.severity, short: true },
          { title: 'Time', value: new Date(alert.triggeredAt).toISOString(), short: true }
        ],
        ts: Math.floor(alert.triggeredAt / 1000)
      }]
    });
  }
  
  private async sendSMS(alert: ActiveAlert): Promise<void> {
    if (alert.severity !== 'critical') return; // Only send SMS for critical alerts
    
    const message = `CRITICAL: ${alert.rule} - ${alert.message}`;
    const recipients = process.env.SMS_RECIPIENTS?.split(',') || [];
    
    for (const recipient of recipients) {
      await this.smsService.send(recipient, message);
    }
  }
  
  private generateEmailHTML(alert: ActiveAlert): string {
    return `
      <h2 style="color: ${this.getSeverityColor(alert.severity)}">
        Alert: ${alert.rule}
      </h2>
      <p><strong>Severity:</strong> ${alert.severity}</p>
      <p><strong>Time:</strong> ${new Date(alert.triggeredAt).toISOString()}</p>
      <p><strong>Message:</strong> ${alert.message}</p>
      <h3>Metrics:</h3>
      <pre>${JSON.stringify(alert.metrics, null, 2)}</pre>
    `;
  }
  
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#FF0000';
      case 'high': return '#FF8C00';
      case 'medium': return '#FFD700';
      case 'low': return '#32CD32';
      default: return '#808080';
    }
  }
}
```

---

## Log Analysis and Troubleshooting

### Log Analysis Tools

#### ELK Stack Integration

```yaml
# docker-compose.elk.yml
version: '3.8'

services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    container_name: elasticsearch
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.11.0
    container_name: logstash
    ports:
      - "5044:5044"
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline
      - ./logstash/config:/usr/share/logstash/config
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.11.0
    container_name: kibana
    ports:
      - "5601:5601"
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    depends_on:
      - elasticsearch

volumes:
  elasticsearch_data:
```

#### Logstash Configuration

```ruby
# logstash/pipeline/trading.conf
input {
  file {
    path => "/app/logs/trading-*.log"
    start_position => "beginning"
    codec => json
  }
  
  file {
    path => "/app/logs/application-*.log"
    start_position => "beginning"
    codec => json
  }
}

filter {
  # Parse trading logs
  if [component] == "TradingEngine" {
    mutate {
      add_field => { "log_type" => "trading" }
    }
    
    if [metadata][trade] {
      mutate {
        add_field => { 
          "trade_id" => "%{[metadata][trade][id]}"
          "trade_action" => "%{[metadata][trade][action]}"
          "trade_symbol" => "%{[metadata][trade][symbol]}"
          "trade_pnl" => "%{[metadata][trade][pnl]}"
        }
      }
    }
  }
  
  # Parse error logs
  if [level] == "error" {
    mutate {
      add_field => { "log_type" => "error" }
    }
  }
  
  # Add timestamp
  date {
    match => [ "timestamp", "ISO8601" ]
  }
}

output {
  elasticsearch {
    hosts => ["elasticsearch:9200"]
    index => "tape-vision-%{+YYYY.MM.dd}"
  }
  
  # Debug output
  stdout {
    codec => rubydebug
  }
}
```

### Common Log Queries

#### Trading Analysis Queries

```typescript
class LogAnalyzer {
  private elasticClient: ElasticsearchClient;
  
  constructor(elasticUrl: string) {
    this.elasticClient = new ElasticsearchClient({ node: elasticUrl });
  }
  
  // Find all failed trades in the last hour
  async getFailedTrades(timeRange = '1h'): Promise<any[]> {
    const response = await this.elasticClient.search({
      index: 'tape-vision-*',
      body: {
        query: {
          bool: {
            must: [
              { match: { 'component': 'TradingEngine' } },
              { match: { 'metadata.trade.status': 'failed' } },
              {
                range: {
                  timestamp: {
                    gte: `now-${timeRange}`
                  }
                }
              }
            ]
          }
        },
        sort: [
          { timestamp: { order: 'desc' } }
        ]
      }
    });
    
    return response.body.hits.hits;
  }
  
  // Analyze error patterns
  async getErrorPatterns(timeRange = '24h'): Promise<any> {
    const response = await this.elasticClient.search({
      index: 'tape-vision-*',
      body: {
        query: {
          bool: {
            must: [
              { match: { level: 'error' } },
              {
                range: {
                  timestamp: {
                    gte: `now-${timeRange}`
                  }
                }
              }
            ]
          }
        },
        aggs: {
          error_components: {
            terms: {
              field: 'component.keyword',
              size: 10
            }
          },
          error_types: {
            terms: {
              field: 'metadata.error.code.keyword',
              size: 10
            }
          }
        }
      }
    });
    
    return response.body.aggregations;
  }
  
  // Performance analysis
  async getPerformanceMetrics(timeRange = '1h'): Promise<any> {
    const response = await this.elasticClient.search({
      index: 'tape-vision-*',
      body: {
        query: {
          bool: {
            must: [
              { exists: { field: 'metadata.performance.processingTime' } },
              {
                range: {
                  timestamp: {
                    gte: `now-${timeRange}`
                  }
                }
              }
            ]
          }
        },
        aggs: {
          avg_processing_time: {
            avg: {
              field: 'metadata.performance.processingTime'
            }
          },
          max_processing_time: {
            max: {
              field: 'metadata.performance.processingTime'
            }
          },
          percentiles_processing_time: {
            percentiles: {
              field: 'metadata.performance.processingTime',
              percents: [50, 90, 95, 99]
            }
          }
        }
      }
    });
    
    return response.body.aggregations;
  }
}
```

### Troubleshooting Guides

#### Common Issues and Solutions

```typescript
class TroubleshootingGuide {
  private static readonly issues: TroubleshootingIssue[] = [
    {
      symptom: 'High processing latency',
      possibleCauses: [
        'High memory usage',
        'CPU bottleneck',
        'Database connection issues',
        'Large data volumes'
      ],
      diagnosticSteps: [
        'Check system metrics (CPU, memory)',
        'Analyze database query performance',
        'Review processing queue sizes',
        'Check network connectivity'
      ],
      solutions: [
        'Increase system resources',
        'Optimize database queries',
        'Implement data pagination',
        'Add caching layer'
      ]
    },
    
    {
      symptom: 'Trading engine stops unexpectedly',
      possibleCauses: [
        'Risk limit violations',
        'Market data connection loss',
        'Unhandled exceptions',
        'Memory leaks'
      ],
      diagnosticSteps: [
        'Check error logs for exceptions',
        'Verify market data connectivity',
        'Review risk management alerts',
        'Monitor memory usage patterns'
      ],
      solutions: [
        'Implement better error handling',
        'Add connection retry logic',
        'Adjust risk parameters',
        'Fix memory leaks'
      ]
    },
    
    {
      symptom: 'WebSocket connections dropping',
      possibleCauses: [
        'Network instability',
        'Load balancer configuration',
        'Client timeout settings',
        'Server resource limits'
      ],
      diagnosticSteps: [
        'Check network connectivity',
        'Review WebSocket logs',
        'Verify load balancer settings',
        'Monitor connection patterns'
      ],
      solutions: [
        'Implement connection pooling',
        'Adjust timeout settings',
        'Add connection retry logic',
        'Scale WebSocket servers'
      ]
    }
  ];
  
  static getDiagnosticSteps(symptom: string): string[] {
    const issue = this.issues.find(i => 
      i.symptom.toLowerCase().includes(symptom.toLowerCase())
    );
    
    return issue ? issue.diagnosticSteps : [];
  }
  
  static getSolutions(symptom: string): string[] {
    const issue = this.issues.find(i => 
      i.symptom.toLowerCase().includes(symptom.toLowerCase())
    );
    
    return issue ? issue.solutions : [];
  }
}
```

---

## Monitoring Best Practices

### Performance Monitoring

1. **Monitor Key Metrics**
   - Trading performance (P&L, win rate, signals)
   - System performance (latency, memory, CPU)
   - Business metrics (user engagement, system uptime)

2. **Set Appropriate Thresholds**
   - Base thresholds on historical data
   - Account for market conditions
   - Regular threshold reviews and adjustments

3. **Implement Proactive Monitoring**
   - Predictive alerting for potential issues
   - Trend analysis for capacity planning
   - Automated remediation for common problems

### Logging Best Practices

1. **Structured Logging**
   - Use consistent log formats
   - Include correlation IDs
   - Add contextual information

2. **Log Levels**
   - ERROR: System errors requiring attention
   - WARN: Potential issues or degraded performance
   - INFO: Important business events
   - DEBUG: Detailed diagnostic information

3. **Log Management**
   - Implement log rotation
   - Central log aggregation
   - Long-term log retention for compliance

### Security Monitoring

1. **Authentication Events**
   - Login attempts (successful/failed)
   - Privilege escalations
   - Session management events

2. **Data Access**
   - Sensitive data access
   - Configuration changes
   - Trading operations

3. **System Security**
   - Network intrusion attempts
   - Malware detection
   - Vulnerability assessments

---

This monitoring and logging guide provides comprehensive coverage of observability practices for the Tape Vision AI trading system. Proper monitoring is essential for maintaining system reliability, performance, and security in production environments.