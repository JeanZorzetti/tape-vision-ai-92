import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

interface LogEntry {
  timestamp: string;
  requestId: string;
  method: string;
  url: string;
  statusCode?: number;
  responseTime: number;
  userAgent?: string;
  ip: string;
  user?: {
    id: string;
    email: string;
    role: string;
  };
  body?: any;
  query?: any;
  params?: any;
  headers?: { [key: string]: string };
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
}

interface TradingLogEntry extends LogEntry {
  tradingContext?: {
    symbol?: string;
    orderType?: string;
    quantity?: number;
    price?: number;
    side?: 'BUY' | 'SELL';
    strategy?: string;
  };
}

class RequestLoggerMiddleware {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 10000;
  private cpuUsageStart?: NodeJS.CpuUsage;

  constructor() {
    // Initialize CPU usage tracking
    this.cpuUsageStart = process.cpuUsage();
  }

  /**
   * General request logging middleware
   */
  general = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const startCpuUsage = process.cpuUsage();
    const requestId = this.generateRequestId(req);

    // Add request ID to headers
    res.setHeader('X-Request-ID', requestId);
    req.headers['x-request-id'] = requestId;

    // Override res.json to capture response data
    const originalJson = res.json;
    let responseBody: any;

    res.json = function(body: any) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    // Log request
    console.log(`📥 ${req.method} ${req.originalUrl} - ${requestId}`);

    // Handle response completion
    res.on('finish', () => {
      const responseTime = Date.now() - startTime;
      const endCpuUsage = process.cpuUsage(startCpuUsage);

      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        user: req.user ? {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        } : undefined,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        params: Object.keys(req.params).length > 0 ? req.params : undefined,
        performance: {
          memoryUsage: process.memoryUsage(),
          cpuUsage: endCpuUsage
        }
      };

      // Add sensitive data only in development
      if (process.env.NODE_ENV === 'development') {
        logEntry.body = this.sanitizeBody(req.body);
        logEntry.headers = this.sanitizeHeaders(req.headers);
      }

      this.addLog(logEntry);
      this.logResponse(logEntry, responseBody);
    });

    next();
  };

  /**
   * Trading-specific request logging
   */
  trading = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const requestId = this.generateRequestId(req);

    // Extract trading context
    const tradingContext = this.extractTradingContext(req);

    // Log trading request with high priority
    console.log(`🎯 TRADING ${req.method} ${req.originalUrl} - ${requestId}`, tradingContext);

    res.on('finish', () => {
      const responseTime = Date.now() - startTime;

      const logEntry: TradingLogEntry = {
        timestamp: new Date().toISOString(),
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        responseTime,
        userAgent: req.get('User-Agent'),
        ip: req.ip || 'unknown',
        user: req.user ? {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role
        } : undefined,
        tradingContext,
        performance: {
          memoryUsage: process.memoryUsage()
        }
      };

      this.addLog(logEntry);

      // Special handling for trading responses
      if (res.statusCode >= 400) {
        console.error(`🚨 TRADING ERROR: ${res.statusCode} - ${requestId}`, {
          user: req.user?.id,
          context: tradingContext,
          responseTime
        });
      } else {
        console.log(`✅ TRADING SUCCESS: ${res.statusCode} - ${requestId} (${responseTime}ms)`);
      }
    });

    next();
  };

  /**
   * WebSocket connection logging
   */
  websocket = (req: AuthRequest, socket: any): void => {
    const requestId = this.generateRequestId(req);
    const connectTime = Date.now();

    console.log(`🔌 WebSocket CONNECT - ${requestId}`, {
      user: req.user?.id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      requestId,
      method: 'WEBSOCKET',
      url: req.originalUrl,
      responseTime: 0,
      userAgent: req.get('User-Agent'),
      ip: req.ip || 'unknown',
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      } : undefined,
      performance: {
        memoryUsage: process.memoryUsage()
      }
    };

    this.addLog(logEntry);

    // Log WebSocket events
    socket.on('message', (message: string) => {
      try {
        const data = JSON.parse(message);
        console.log(`📨 WebSocket MESSAGE - ${requestId}`, {
          type: data.type,
          user: req.user?.id
        });
      } catch (error) {
        console.warn(`⚠️ WebSocket INVALID_MESSAGE - ${requestId}`, { message });
      }
    });

    socket.on('close', (code: number, reason: string) => {
      const sessionDuration = Date.now() - connectTime;
      console.log(`🔌 WebSocket DISCONNECT - ${requestId}`, {
        code,
        reason,
        sessionDuration,
        user: req.user?.id
      });

      // Log session summary
      const sessionLog: LogEntry = {
        ...logEntry,
        timestamp: new Date().toISOString(),
        responseTime: sessionDuration,
        statusCode: code
      };

      this.addLog(sessionLog);
    });

    socket.on('error', (error: Error) => {
      console.error(`🚨 WebSocket ERROR - ${requestId}`, {
        error: error.message,
        user: req.user?.id
      });

      const errorLog: LogEntry = {
        ...logEntry,
        timestamp: new Date().toISOString(),
        statusCode: 500,
        error: {
          message: error.message,
          stack: error.stack
        }
      };

      this.addLog(errorLog);
    });
  };

  /**
   * API performance monitoring
   */
  performance = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const endMemory = process.memoryUsage();
      
      const responseTimeNs = endTime - startTime;
      const responseTimeMs = Number(responseTimeNs) / 1_000_000;

      // Log performance metrics for slow requests (>1000ms)
      if (responseTimeMs > 1000) {
        console.warn(`🐌 SLOW REQUEST: ${req.method} ${req.originalUrl}`, {
          responseTime: `${responseTimeMs.toFixed(2)}ms`,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal
          }
        });
      }

      // Set performance headers
      res.setHeader('X-Response-Time', `${responseTimeMs.toFixed(2)}ms`);
      res.setHeader('X-Memory-Usage', `${(endMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    });

    next();
  };

  /**
   * Security event logging
   */
  security = (req: AuthRequest, event: string, details?: any): void => {
    const securityLog = {
      timestamp: new Date().toISOString(),
      event,
      details,
      user: req.user?.id || 'anonymous',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.originalUrl,
      method: req.method
    };

    console.warn(`🔒 SECURITY EVENT: ${event}`, securityLog);
  };

  /**
   * Generate unique request ID
   */
  private generateRequestId(req: Request): string {
    const existing = req.headers['x-request-id'] as string;
    if (existing) return existing;

    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Extract trading context from request
   */
  private extractTradingContext(req: Request): any {
    const context: any = {};

    // Extract from body
    if (req.body) {
      context.symbol = req.body.symbol;
      context.orderType = req.body.orderType;
      context.quantity = req.body.quantity;
      context.price = req.body.price;
      context.side = req.body.side;
      context.strategy = req.body.strategy;
    }

    // Extract from params/query
    context.symbol = context.symbol || req.params.symbol || req.query.symbol;
    context.side = context.side || req.params.side || req.query.side;

    return context;
  }

  /**
   * Sanitize request body for logging
   */
  private sanitizeBody(body: any): any {
    if (!body) return undefined;

    const sanitized = { ...body };
    
    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'creditCard'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Sanitize headers for logging
   */
  private sanitizeHeaders(headers: any): { [key: string]: string } {
    const sanitized: { [key: string]: string } = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value as string;
      }
    }

    return sanitized;
  }

  /**
   * Add log entry to memory store
   */
  private addLog(logEntry: LogEntry): void {
    this.logs.push(logEntry);

    // Keep only recent logs
    if (this.logs.length > this.MAX_LOGS) {
      this.logs = this.logs.slice(-this.MAX_LOGS);
    }
  }

  /**
   * Log response details
   */
  private logResponse(logEntry: LogEntry, responseBody?: any): void {
    const statusEmoji = this.getStatusEmoji(logEntry.statusCode || 500);
    const timeColor = logEntry.responseTime > 1000 ? '🟥' : logEntry.responseTime > 500 ? '🟨' : '🟩';

    console.log(`📤 ${statusEmoji} ${logEntry.method} ${logEntry.url} ${logEntry.statusCode} ${timeColor} ${logEntry.responseTime}ms - ${logEntry.requestId}`);

    // Log additional details for errors
    if (logEntry.statusCode && logEntry.statusCode >= 400 && responseBody?.error) {
      console.error(`   Error: ${responseBody.error} (${responseBody.code})`);
    }
  }

  /**
   * Get emoji for status code
   */
  private getStatusEmoji(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return '✅';
    if (statusCode >= 300 && statusCode < 400) return '↩️';
    if (statusCode >= 400 && statusCode < 500) return '⚠️';
    return '🚨';
  }

  /**
   * Get recent logs
   */
  getLogs(limit: number = 100): LogEntry[] {
    return this.logs.slice(-limit);
  }

  /**
   * Get logs by user
   */
  getLogsByUser(userId: string, limit: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.user?.id === userId)
      .slice(-limit);
  }

  /**
   * Get trading logs
   */
  getTradingLogs(limit: number = 50): TradingLogEntry[] {
    return this.logs
      .filter(log => log.url.includes('/trading/') || (log as TradingLogEntry).tradingContext)
      .slice(-limit) as TradingLogEntry[];
  }

  /**
   * Get error logs
   */
  getErrorLogs(limit: number = 50): LogEntry[] {
    return this.logs
      .filter(log => log.statusCode && log.statusCode >= 400)
      .slice(-limit);
  }

  /**
   * Get performance stats
   */
  getPerformanceStats(): {
    totalRequests: number;
    averageResponseTime: number;
    errorRate: number;
    slowRequests: number;
  } {
    if (this.logs.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        errorRate: 0,
        slowRequests: 0
      };
    }

    const totalRequests = this.logs.length;
    const averageResponseTime = this.logs.reduce((sum, log) => sum + log.responseTime, 0) / totalRequests;
    const errorCount = this.logs.filter(log => log.statusCode && log.statusCode >= 400).length;
    const slowRequests = this.logs.filter(log => log.responseTime > 1000).length;

    return {
      totalRequests,
      averageResponseTime: Math.round(averageResponseTime),
      errorRate: Math.round((errorCount / totalRequests) * 100),
      slowRequests
    };
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
    console.log('📝 Request logs cleared');
  }
}

const requestLogger = new RequestLoggerMiddleware();

export { 
  requestLogger, 
  LogEntry, 
  TradingLogEntry 
};