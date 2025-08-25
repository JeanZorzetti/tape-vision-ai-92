/**
 * Request Logging Middleware - Tape Vision Trading System
 * Comprehensive request/response logging with performance metrics
 */

import { Response, NextFunction } from 'express';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../types/api';

interface RequestMetrics {
  requestId: string;
  method: string;
  path: string;
  query: any;
  body: any;
  headers: any;
  ip: string;
  userAgent: string;
  userId?: string;
  apiKeyId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  error?: any;
}

class RequestLoggerService {
  private logger: winston.Logger;
  private activeRequests: Map<string, RequestMetrics> = new Map();

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  public logRequest(req: AuthenticatedRequest, res: Response): void {
    // Generate unique request ID
    const requestId = uuidv4();
    req.requestId = requestId;
    req.startTime = Date.now();

    // Extract user information
    const userId = req.user?.id;
    const apiKeyId = req.apiKey?.id;

    // Create request metrics
    const metrics: RequestMetrics = {
      requestId,
      method: req.method,
      path: req.path,
      query: req.query,
      body: this.sanitizeBody(req.body),
      headers: this.sanitizeHeaders(req.headers),
      ip: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'unknown',
      userId,
      apiKeyId,
      startTime: req.startTime
    };

    // Store active request
    this.activeRequests.set(requestId, metrics);

    // Add response logging
    this.setupResponseLogging(res, requestId);

    // Log request start
    this.logger.info('HTTP Request Started', {
      requestId,
      method: req.method,
      path: req.path,
      userId,
      apiKeyId,
      ip: metrics.ip,
      userAgent: metrics.userAgent,
      timestamp: new Date().toISOString()
    });
  }

  private setupResponseLogging(res: Response, requestId: string): void {
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;

    // Override res.send to capture response body
    res.send = function(body: any) {
      responseBody = body;
      return originalSend.call(this, body);
    };

    // Override res.json to capture JSON response
    res.json = function(body: any) {
      responseBody = body;
      return originalJson.call(this, body);
    };

    // Log when response is finished
    res.on('finish', () => {
      this.logResponse(requestId, res, responseBody);
    });

    // Log when response is closed (client disconnected)
    res.on('close', () => {
      if (!res.headersSent) {
        this.logResponse(requestId, res, null, 'Client disconnected');
      }
    });
  }

  private logResponse(requestId: string, res: Response, responseBody: any, error?: string): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;

    const endTime = Date.now();
    const duration = endTime - metrics.startTime;

    // Update metrics
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.statusCode = res.statusCode;
    metrics.responseSize = this.getResponseSize(responseBody);

    if (error) {
      metrics.error = error;
    }

    // Determine log level based on status code and duration
    const logLevel = this.getLogLevel(res.statusCode, duration, error);

    // Log response completion
    this.logger[logLevel]('HTTP Request Completed', {
      requestId,
      method: metrics.method,
      path: metrics.path,
      statusCode: metrics.statusCode,
      duration,
      responseSize: metrics.responseSize,
      userId: metrics.userId,
      apiKeyId: metrics.apiKeyId,
      ip: metrics.ip,
      userAgent: metrics.userAgent,
      timestamp: new Date().toISOString(),
      ...(error && { error }),
      ...(this.shouldLogResponseBody(metrics.path, res.statusCode) && { 
        responseBody: this.sanitizeResponseBody(responseBody) 
      })
    });

    // Log performance warnings
    if (duration > 5000) {
      this.logger.warn('Slow request detected', {
        requestId,
        path: metrics.path,
        duration,
        threshold: 5000
      });
    }

    // Clean up
    this.activeRequests.delete(requestId);
  }

  private getLogLevel(statusCode: number, duration: number, error?: string): string {
    if (error) return 'error';
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    if (duration > 10000) return 'warn';
    return 'info';
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };

    // Remove sensitive headers
    const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie', 'x-access-token'];
    
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });

    return {
      'content-type': sanitized['content-type'],
      'user-agent': sanitized['user-agent'],
      'accept': sanitized['accept'],
      'origin': sanitized['origin'],
      'referer': sanitized['referer'],
      'x-forwarded-for': sanitized['x-forwarded-for'],
      'x-real-ip': sanitized['x-real-ip']
    };
  }

  private sanitizeResponseBody(body: any): any {
    if (!body) return body;

    try {
      const parsed = typeof body === 'string' ? JSON.parse(body) : body;
      
      if (parsed.token) parsed.token = '[REDACTED]';
      if (parsed.refreshToken) parsed.refreshToken = '[REDACTED]';
      if (parsed.apiKey) parsed.apiKey = '[REDACTED]';
      
      return parsed;
    } catch {
      return '[RESPONSE_BODY_NOT_JSON]';
    }
  }

  private getClientIP(req: any): string {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           'unknown';
  }

  private getResponseSize(responseBody: any): number {
    if (!responseBody) return 0;
    
    try {
      return Buffer.byteLength(JSON.stringify(responseBody), 'utf8');
    } catch {
      return 0;
    }
  }

  private shouldLogResponseBody(path: string, statusCode: number): boolean {
    // Log response body for errors or specific paths
    if (statusCode >= 400) return true;
    
    // Don't log response body for large data endpoints
    const skipPaths = ['/market-data/historical', '/trading/log'];
    return !skipPaths.some(skipPath => path.includes(skipPath));
  }

  public getActiveRequests(): RequestMetrics[] {
    return Array.from(this.activeRequests.values());
  }

  public getRequestMetrics(requestId: string): RequestMetrics | undefined {
    return this.activeRequests.get(requestId);
  }
}

let requestLoggerService: RequestLoggerService;

export function initializeRequestLogger(logger: winston.Logger): void {
  requestLoggerService = new RequestLoggerService(logger);
}

// Main request logger middleware
export function requestLogger(logger: winston.Logger) {
  if (!requestLoggerService) {
    requestLoggerService = new RequestLoggerService(logger);
  }

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Add logger to request for use in other middleware
    req.logger = logger;

    requestLoggerService.logRequest(req, res);
    next();
  };
}

// Performance monitoring middleware
export function performanceMonitor(threshold: number = 1000) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      
      if (duration > threshold) {
        req.logger?.warn('Performance threshold exceeded', {
          requestId: req.requestId,
          path: req.path,
          method: req.method,
          duration,
          threshold,
          statusCode: res.statusCode
        });
      }
    });

    next();
  };
}

// Request correlation middleware
export function correlationId() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Use existing request ID or generate new one
    const correlationId = req.headers['x-correlation-id'] as string || req.requestId || uuidv4();
    
    req.requestId = correlationId;
    res.setHeader('X-Correlation-ID', correlationId);
    
    next();
  };
}

// Request size monitoring
export function requestSizeMonitor(maxSize: number = 10 * 1024 * 1024) { // 10MB default
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    
    if (contentLength > maxSize) {
      req.logger?.warn('Large request detected', {
        requestId: req.requestId,
        path: req.path,
        contentLength,
        maxSize
      });
    }

    next();
  };
}

// API metrics collection
export function collectAPIMetrics() {
  const metrics = {
    requests: new Map<string, number>(),
    responses: new Map<string, number[]>(),
    errors: new Map<string, number>()
  };

  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const key = `${req.method}:${req.route?.path || req.path}`;
    const start = Date.now();

    // Count request
    metrics.requests.set(key, (metrics.requests.get(key) || 0) + 1);

    res.on('finish', () => {
      const duration = Date.now() - start;
      
      // Track response times
      if (!metrics.responses.has(key)) {
        metrics.responses.set(key, []);
      }
      metrics.responses.get(key)!.push(duration);

      // Track errors
      if (res.statusCode >= 400) {
        metrics.errors.set(key, (metrics.errors.get(key) || 0) + 1);
      }
    });

    next();
  };
}

// Get request logger service for external use
export function getRequestLoggerService(): RequestLoggerService | undefined {
  return requestLoggerService;
}

// Export types
export type { RequestMetrics };

export default requestLogger;