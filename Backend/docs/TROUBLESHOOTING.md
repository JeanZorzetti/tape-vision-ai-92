# Tape Vision AI - Troubleshooting Guide

## Overview

This guide provides comprehensive troubleshooting procedures for the Tape Vision AI trading system. It covers common issues, diagnostic procedures, and resolution steps for various system components.

## Quick Reference

| Symptom | Likely Cause | Quick Fix | See Section |
|---------|--------------|-----------|-------------|
| High latency (>10ms) | CPU/Memory overload | Restart services, check resources | [Performance Issues](#performance-issues) |
| WebSocket disconnects | Network issues | Check network, restart WebSocket | [Connectivity Issues](#connectivity-issues) |
| Trading engine stops | Risk limit hit | Check logs, review risk settings | [Trading Issues](#trading-issues) |
| Database connection fails | MongoDB down | Check MongoDB status | [Database Issues](#database-issues) |
| API requests failing | Rate limiting | Check rate limits, API health | [API Issues](#api-issues) |
| Memory leaks | Code issues | Monitor heap, restart if needed | [Memory Issues](#memory-issues) |

---

## System Health Check

### Quick Health Assessment

Run this comprehensive health check to identify system issues:

```bash
# System health check script
#!/bin/bash

echo "=== Tape Vision AI Health Check ==="

# 1. Check system resources
echo "1. System Resources:"
echo "   CPU Usage: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)%"
echo "   Memory Usage: $(free | grep Mem | awk '{printf("%.1f%%", $3/$2 * 100.0)}')"
echo "   Disk Usage: $(df -h / | awk 'NR==2 {print $5}')"

# 2. Check processes
echo "2. Process Status:"
echo "   Trading Backend: $(pgrep -f 'node.*server' > /dev/null && echo 'Running' || echo 'Stopped')"
echo "   MongoDB: $(pgrep mongod > /dev/null && echo 'Running' || echo 'Stopped')"
echo "   Redis: $(pgrep redis-server > /dev/null && echo 'Running' || echo 'Stopped')"

# 3. Check network connectivity
echo "3. Network Connectivity:"
echo "   MongoDB: $(timeout 5 nc -z localhost 27017 && echo 'Connected' || echo 'Failed')"
echo "   Redis: $(timeout 5 nc -z localhost 6379 && echo 'Connected' || echo 'Failed')"

# 4. Check application health
echo "4. Application Health:"
echo "   API Health: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/health)"
echo "   WebSocket: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3002/health)"

# 5. Check logs for errors
echo "5. Recent Errors:"
echo "   Error count (last 1h): $(grep -c "ERROR" logs/application-$(date +%Y-%m-%d).log 2>/dev/null || echo "0")"
echo "   Latest error: $(tail -n 1 logs/error-$(date +%Y-%m-%d).log 2>/dev/null || echo "None")"
```

### Health Check Endpoints

```bash
# API Health Check
curl -X GET http://localhost:3001/health

# Expected Response:
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "uptime": 3600.5,
    "memory": {...},
    "engine": {
      "active": true,
      "dailyPnL": 150.5,
      "tradesCount": 5
    }
  }
}

# WebSocket Health Check
curl -X GET http://localhost:3002/health

# Database Connection Check
curl -X GET http://localhost:3001/api/system/database/status
```

---

## Performance Issues

### High Processing Latency

**Symptoms:**
- Market data processing >10ms
- Slow API response times
- Trading signals delayed
- UI lag or unresponsiveness

**Diagnostic Steps:**

1. **Check System Resources:**
```bash
# Monitor real-time resource usage
htop

# Check CPU usage by process
ps aux --sort=-%cpu | head -20

# Check memory usage
free -h
cat /proc/meminfo

# Check disk I/O
iostat -x 1 5
```

2. **Check Application Performance:**
```bash
# Monitor Node.js performance
node --prof --prof-process --v8-prof-processor-args=--preprocess -j isolate*.log

# Check garbage collection
node --trace-gc --trace-gc-verbose

# Monitor event loop lag
node --trace-warnings
```

3. **Database Performance:**
```bash
# MongoDB performance
db.runCommand({serverStatus: 1})
db.runCommand({collStats: "trades"})

# Check slow queries
db.setProfilingLevel(2, {slowms: 100})
db.system.profile.find().sort({ts: -1}).limit(5)
```

**Solutions:**

1. **Resource Optimization:**
```typescript
// Optimize garbage collection
process.env.NODE_OPTIONS = "--max-old-space-size=4096 --gc-interval=100";

// Memory management
const memoryUsage = process.memoryUsage();
if (memoryUsage.heapUsed > 1024 * 1024 * 1024) { // 1GB
  global.gc && global.gc();
}
```

2. **Database Optimization:**
```javascript
// Add indexes for frequently queried fields
db.trades.createIndex({"timestamp": -1})
db.trades.createIndex({"symbol": 1, "timestamp": -1})

// Optimize aggregation pipelines
db.trades.aggregate([
  { $match: { timestamp: { $gte: startTime } } },
  { $group: { _id: "$symbol", totalPnL: { $sum: "$pnl" } } }
])
```

3. **Code Optimization:**
```typescript
// Use streaming for large data sets
const stream = db.collection('trades').find({}).stream();
stream.on('data', (doc) => {
  // Process each document
});

// Implement connection pooling
const mongoOptions = {
  maxPoolSize: 20,
  minPoolSize: 5,
  maxIdleTimeMS: 30000
};
```

### Memory Issues

**Symptoms:**
- Increasing memory usage over time
- Out of memory errors
- System becomes unresponsive
- Garbage collection taking too long

**Diagnostic Steps:**

1. **Memory Profiling:**
```bash
# Generate heap dump
kill -SIGUSR2 <node_pid>

# Analyze heap dump with v8-profiler
node --inspect server.js
```

2. **Monitor Memory Usage:**
```typescript
class MemoryMonitor {
  static monitor(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      const formatMB = (bytes: number) => Math.round(bytes / 1024 / 1024);
      
      console.log({
        heapUsed: formatMB(usage.heapUsed),
        heapTotal: formatMB(usage.heapTotal),
        external: formatMB(usage.external),
        rss: formatMB(usage.rss)
      });
      
      // Alert if memory usage too high
      if (usage.heapUsed > 1024 * 1024 * 1024) { // 1GB
        console.warn('High memory usage detected');
      }
    }, 30000);
  }
}
```

**Solutions:**

1. **Memory Leak Detection:**
```typescript
// Use WeakMap for caching to prevent memory leaks
const cache = new WeakMap();

// Clean up event listeners
process.on('exit', () => {
  // Cleanup code
});

// Use streaming for large datasets
const processLargeDataset = async (data: any[]) => {
  for (const chunk of data) {
    await processChunk(chunk);
    // Allow garbage collection between chunks
    await new Promise(resolve => setImmediate(resolve));
  }
};
```

2. **Garbage Collection Tuning:**
```bash
# Node.js GC options
node --max-old-space-size=4096 \
     --optimize-for-size \
     --gc-interval=100 \
     server.js
```

---

## Connectivity Issues

### WebSocket Connection Problems

**Symptoms:**
- Frequent WebSocket disconnections
- Failed to connect to WebSocket server
- Real-time data not updating
- Connection timeout errors

**Diagnostic Steps:**

1. **Test WebSocket Connection:**
```bash
# Test WebSocket connectivity
npm install -g wscat
wscat -c ws://localhost:3002

# Check WebSocket server status
netstat -tulpn | grep :3002

# Monitor connection logs
tail -f logs/websocket-$(date +%Y-%m-%d).log
```

2. **Network Diagnostics:**
```bash
# Check network latency
ping -c 5 localhost

# Check port availability
telnet localhost 3002

# Monitor network connections
ss -tuln | grep 3002
```

**Solutions:**

1. **Connection Resilience:**
```typescript
class ResilientWebSocket {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectInterval = 1000;

  connect(): void {
    this.socket = io('ws://localhost:3002', {
      transports: ['websocket'],
      timeout: 20000,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectInterval
    });

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.handleReconnection();
    });
  }

  private handleReconnection(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Reconnection attempt ${this.reconnectAttempts}`);
        this.connect();
      }, this.reconnectInterval * this.reconnectAttempts);
    }
  }
}
```

2. **Server Configuration:**
```typescript
// WebSocket server optimization
const io = new Server(server, {
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 10000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket'],
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST']
  }
});
```

### Database Connection Issues

**Symptoms:**
- MongoDB connection timeouts
- Redis connection failures
- Database queries hanging
- Connection pool exhaustion

**Diagnostic Steps:**

1. **MongoDB Diagnostics:**
```bash
# Check MongoDB status
systemctl status mongod

# Test MongoDB connection
mongo --eval "db.runCommand('ping')"

# Check MongoDB logs
tail -f /var/log/mongodb/mongod.log

# Monitor connections
db.serverStatus().connections
```

2. **Redis Diagnostics:**
```bash
# Check Redis status
redis-cli ping

# Monitor Redis connections
redis-cli info clients

# Check Redis logs
tail -f /var/log/redis/redis-server.log
```

**Solutions:**

1. **Connection Pool Optimization:**
```typescript
// MongoDB connection optimization
const mongoOptions: MongoClientOptions = {
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  family: 4,
  retryWrites: true
};

// Redis connection optimization  
const redisOptions = {
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  keepAlive: true
};
```

2. **Health Check Implementation:**
```typescript
class DatabaseHealthChecker {
  async checkMongoDB(): Promise<boolean> {
    try {
      await this.mongoClient.admin().ping();
      return true;
    } catch (error) {
      console.error('MongoDB health check failed:', error);
      return false;
    }
  }

  async checkRedis(): Promise<boolean> {
    try {
      await this.redisClient.ping();
      return true;
    } catch (error) {
      console.error('Redis health check failed:', error);
      return false;
    }
  }
}
```

---

## Trading Issues

### Trading Engine Stops Unexpectedly

**Symptoms:**
- Trading engine status shows "stopped"
- No new signals generated
- Positions not being managed
- Error logs showing engine failures

**Diagnostic Steps:**

1. **Check Engine Logs:**
```bash
# Check trading engine logs
grep -A 10 -B 10 "TradingEngine.*stop\|error\|fail" logs/trading-$(date +%Y-%m-%d).log

# Check error logs
tail -n 50 logs/error-$(date +%Y-%m-%d).log

# Check system logs
journalctl -u tape-vision-backend -f
```

2. **Check Risk Limits:**
```bash
# Check current risk metrics
curl -X GET http://localhost:3001/api/trading/session

# Check risk violations
grep "risk.*violation\|limit.*exceeded" logs/trading-$(date +%Y-%m-%d).log
```

**Solutions:**

1. **Engine Recovery:**
```typescript
class TradingEngineRecovery {
  async attemptRecovery(): Promise<void> {
    try {
      // Save current state
      const state = await this.saveEngineState();
      
      // Check risk limits
      const riskCheck = await this.checkRiskLimits();
      if (!riskCheck.passed) {
        throw new Error(`Risk limit violation: ${riskCheck.violation}`);
      }
      
      // Restart engine
      await this.tradingEngine.stop();
      await this.tradingEngine.start();
      
      // Restore state
      await this.restoreEngineState(state);
      
      console.log('Trading engine recovered successfully');
    } catch (error) {
      console.error('Engine recovery failed:', error);
      await this.notifyOperators(error);
    }
  }
}
```

2. **Risk Limit Management:**
```typescript
class RiskLimitManager {
  async resetDailyLimits(): Promise<void> {
    // Reset daily counters at start of new trading day
    const today = new Date().toDateString();
    const lastReset = await this.getLastResetDate();
    
    if (today !== lastReset) {
      await this.resetCounters();
      await this.setLastResetDate(today);
      console.log('Daily risk limits reset');
    }
  }
  
  async adjustLimitsForVolatility(): Promise<void> {
    const volatility = await this.getCurrentVolatility();
    const baseStopLoss = this.config.baseStopLoss;
    
    // Adjust stop loss based on volatility
    const adjustedStopLoss = baseStopLoss * (1 + volatility * 0.5);
    await this.updateStopLossParameters(adjustedStopLoss);
  }
}
```

### Incorrect Signal Generation

**Symptoms:**
- Signals generated with low confidence
- Contradictory signals
- No signals generated during active market
- Poor signal accuracy

**Diagnostic Steps:**

1. **Signal Analysis:**
```bash
# Check recent signals
curl -X GET "http://localhost:3001/api/trading/log?action=SIGNAL&limit=20"

# Analyze signal confidence distribution
grep "confidence" logs/trading-$(date +%Y-%m-%d).log | awk '{print $NF}' | sort -n
```

2. **Component Analysis:**
```typescript
class SignalDiagnostics {
  async diagnoseSignalIssues(): Promise<DiagnosticReport> {
    const components = {
      tapeReader: await this.testTapeReaderComponent(),
      orderFlowAnalyzer: await this.testOrderFlowComponent(),
      patternRecognizer: await this.testPatternComponent(),
      signalGenerator: await this.testSignalGeneratorComponent()
    };
    
    return {
      components,
      overallHealth: this.calculateOverallHealth(components),
      recommendations: this.generateRecommendations(components)
    };
  }
}
```

**Solutions:**

1. **Component Recalibration:**
```typescript
class SignalRecalibration {
  async recalibrateComponents(): Promise<void> {
    // Recalibrate pattern recognition thresholds
    const recentPerformance = await this.getRecentPatternPerformance();
    await this.adjustPatternThresholds(recentPerformance);
    
    // Adjust confidence scoring weights
    const componentPerformance = await this.getComponentPerformance();
    await this.rebalanceComponentWeights(componentPerformance);
    
    // Update historical success rates
    await this.updateHistoricalSuccessRates();
  }
}
```

---

## API Issues

### API Request Failures

**Symptoms:**
- 5xx server errors
- Timeout errors
- Rate limit exceeded errors
- Authentication failures

**Diagnostic Steps:**

1. **API Health Check:**
```bash
# Test API endpoints
curl -X GET http://localhost:3001/health
curl -X GET http://localhost:3001/api/trading/market-data
curl -X GET http://localhost:3001/api/trading/ai-status

# Check API logs
grep "ERROR\|5[0-9][0-9]" logs/application-$(date +%Y-%m-%d).log

# Monitor API performance
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/api/trading/market-data
```

2. **Rate Limiting Check:**
```bash
# Check current rate limits
curl -I http://localhost:3001/api/trading/market-data

# Expected headers:
# X-RateLimit-Limit: 100
# X-RateLimit-Remaining: 95
# X-RateLimit-Reset: 1640995200
```

**Solutions:**

1. **API Recovery:**
```typescript
class APIRecoveryService {
  async recoverAPI(): Promise<void> {
    try {
      // Check database connections
      await this.checkDatabaseHealth();
      
      // Restart API server if needed
      if (!await this.isAPIHealthy()) {
        await this.restartAPIServer();
      }
      
      // Clear rate limit cache if needed
      await this.clearRateLimitCache();
      
      console.log('API service recovered');
    } catch (error) {
      console.error('API recovery failed:', error);
    }
  }
}
```

2. **Rate Limit Management:**
```typescript
class RateLimitManager {
  async adjustRateLimits(usage: UsageMetrics): Promise<void> {
    if (usage.errorRate > 0.05) { // 5% error rate
      // Reduce rate limits temporarily
      await this.temporarilyReduceLimits(0.5);
    } else if (usage.errorRate < 0.01) { // 1% error rate
      // Restore normal rate limits
      await this.restoreNormalLimits();
    }
  }
}
```

---

## Data Issues

### Market Data Feed Problems

**Symptoms:**
- Stale market data
- Missing data points
- Incorrect timestamps
- Data format errors

**Diagnostic Steps:**

1. **Data Quality Check:**
```typescript
class DataQualityChecker {
  async checkDataQuality(data: MarketData[]): Promise<QualityReport> {
    return {
      completeness: this.checkCompleteness(data),
      accuracy: this.checkAccuracy(data),
      timeliness: this.checkTimeliness(data),
      consistency: this.checkConsistency(data)
    };
  }
  
  private checkCompleteness(data: MarketData[]): number {
    const expectedDataPoints = this.calculateExpectedDataPoints();
    return (data.length / expectedDataPoints) * 100;
  }
}
```

2. **Feed Diagnostics:**
```bash
# Check Nelogica connection
curl -X GET http://localhost:3001/api/system/nelogica/status

# Monitor data feed
tail -f logs/market-data-$(date +%Y-%m-%d).log
```

**Solutions:**

1. **Data Feed Recovery:**
```typescript
class DataFeedRecovery {
  async recoverDataFeed(): Promise<void> {
    try {
      // Reconnect to data source
      await this.nelogicaService.reconnect();
      
      // Fill data gaps from backup sources
      await this.fillDataGaps();
      
      // Validate data integrity
      await this.validateDataIntegrity();
      
      console.log('Data feed recovered');
    } catch (error) {
      console.error('Data feed recovery failed:', error);
      await this.activateBackupDataSource();
    }
  }
}
```

---

## System Monitoring

### Automated Diagnostics

```typescript
class SystemDiagnostics {
  private diagnostics = [
    this.checkSystemResources,
    this.checkDatabaseHealth,
    this.checkAPIHealth,
    this.checkTradingEngine,
    this.checkDataFeed,
    this.checkWebSocketHealth
  ];

  async runDiagnostics(): Promise<DiagnosticReport> {
    const results = await Promise.all(
      this.diagnostics.map(async (diagnostic) => {
        try {
          return await diagnostic.call(this);
        } catch (error) {
          return {
            name: diagnostic.name,
            status: 'failed',
            error: error.message
          };
        }
      })
    );

    return {
      timestamp: new Date(),
      results,
      overallHealth: this.calculateOverallHealth(results),
      recommendations: this.generateRecommendations(results)
    };
  }
}
```

### Health Check Automation

```bash
#!/bin/bash
# Automated health check script

HEALTH_CHECK_URL="http://localhost:3001/health"
ALERT_EMAIL="admin@tapevision.ai"

check_health() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_CHECK_URL)
    
    if [ "$response" != "200" ]; then
        echo "Health check failed with status: $response"
        send_alert "System health check failed"
        return 1
    fi
    
    return 0
}

send_alert() {
    local message="$1"
    echo "$message" | mail -s "Tape Vision AI Alert" $ALERT_EMAIL
}

# Run health check every minute
while true; do
    if ! check_health; then
        echo "$(date): Health check failed"
    fi
    sleep 60
done
```

---

## Recovery Procedures

### System Recovery Checklist

1. **Immediate Assessment:**
   - [ ] Identify affected components
   - [ ] Assess impact on trading operations
   - [ ] Check for data integrity issues
   - [ ] Verify user impact

2. **Emergency Actions:**
   - [ ] Activate emergency stop if needed
   - [ ] Close open positions if at risk
   - [ ] Switch to backup systems if available
   - [ ] Notify stakeholders

3. **Diagnostic Phase:**
   - [ ] Run comprehensive diagnostics
   - [ ] Check system logs
   - [ ] Verify external dependencies
   - [ ] Identify root cause

4. **Recovery Actions:**
   - [ ] Execute recovery procedures
   - [ ] Restart affected services
   - [ ] Verify system functionality
   - [ ] Resume normal operations

5. **Post-Recovery:**
   - [ ] Conduct post-incident analysis
   - [ ] Update monitoring and alerts
   - [ ] Implement preventive measures
   - [ ] Document lessons learned

### Backup and Restore Procedures

```bash
# Database backup and restore
backup_database() {
    mongodump --out /backup/$(date +%Y%m%d_%H%M%S)
    echo "Database backup completed"
}

restore_database() {
    local backup_dir="$1"
    mongorestore "$backup_dir"
    echo "Database restore completed"
}

# Configuration backup
backup_configuration() {
    tar -czf /backup/config_$(date +%Y%m%d_%H%M%S).tar.gz config/
    echo "Configuration backup completed"
}
```

---

## Support Escalation

### Escalation Levels

**Level 1: Automated Resolution**
- Automatic restart procedures
- Basic health checks and recovery
- Standard error handling

**Level 2: Operations Team**
- Manual intervention required
- System configuration changes
- Performance optimization

**Level 3: Development Team**
- Code-related issues
- Algorithm problems
- System architecture issues

**Level 4: Executive Team**
- Business-critical failures
- Regulatory compliance issues
- Major security incidents

### Contact Information

```typescript
interface SupportContact {
  level: number;
  role: string;
  contact: string;
  escalationTime: number; // minutes
}

const supportContacts: SupportContact[] = [
  { level: 1, role: "Automated Systems", contact: "system@tapevision.ai", escalationTime: 0 },
  { level: 2, role: "Operations Team", contact: "+55-11-99999-0001", escalationTime: 15 },
  { level: 3, role: "Development Team", contact: "+55-11-99999-0002", escalationTime: 30 },
  { level: 4, role: "Executive Team", contact: "+55-11-99999-0003", escalationTime: 60 }
];
```

---

## Preventive Maintenance

### Regular Maintenance Tasks

**Daily Tasks:**
- System health check
- Log rotation and cleanup
- Performance metrics review
- Database maintenance

**Weekly Tasks:**
- Full system backup
- Security updates
- Performance optimization
- Configuration review

**Monthly Tasks:**
- Comprehensive system audit
- Capacity planning review
- Disaster recovery testing
- Security assessment

### Maintenance Schedule

```typescript
class MaintenanceScheduler {
  private schedule = [
    { task: 'healthCheck', frequency: 'hourly' },
    { task: 'logCleanup', frequency: 'daily' },
    { task: 'databaseMaintenance', frequency: 'daily' },
    { task: 'systemBackup', frequency: 'weekly' },
    { task: 'securityUpdate', frequency: 'weekly' },
    { task: 'performanceOptimization', frequency: 'monthly' },
    { task: 'disasterRecoveryTest', frequency: 'monthly' }
  ];

  async executeMaintenance(): Promise<void> {
    for (const item of this.schedule) {
      if (this.isScheduledToRun(item)) {
        await this.executeMaintenanceTask(item.task);
      }
    }
  }
}
```

---

This troubleshooting guide provides comprehensive procedures for diagnosing and resolving issues in the Tape Vision AI trading system. Regular use of these procedures will help maintain system reliability and performance.

**Important Notes:**
- Always follow the escalation procedures for critical issues
- Document all troubleshooting actions for future reference
- Test recovery procedures regularly to ensure they work correctly
- Keep this guide updated with new issues and solutions

For additional support, contact the development team or create an issue in the project repository.