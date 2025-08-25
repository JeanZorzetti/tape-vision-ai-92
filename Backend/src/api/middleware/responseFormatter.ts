/**
 * Response Formatting Middleware - Tape Vision Trading System
 * Consistent API response formatting and data transformation
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, APIResponse, PaginatedResponse } from '../types/api';

interface FormattedResponse<T = any> extends APIResponse<T> {
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    performance?: {
      processingTime: number;
      memoryUsage: number;
    };
    cache?: {
      hit: boolean;
      ttl?: number;
    };
  };
}

class ResponseFormatterService {
  public formatSuccess<T>(data: T, message?: string, meta?: any): FormattedResponse<T> {
    return {
      success: true,
      data,
      message,
      timestamp: Date.now(),
      requestId: 'will-be-set-by-middleware',
      version: process.env.API_VERSION || '1.0.0',
      meta
    };
  }

  public formatPaginatedResponse<T>(
    items: T[], 
    page: number, 
    limit: number, 
    total: number,
    message?: string
  ): PaginatedResponse<T> {
    const totalPages = Math.ceil(total / limit);
    
    return {
      success: true,
      data: items,
      message,
      timestamp: Date.now(),
      requestId: 'will-be-set-by-middleware',
      version: process.env.API_VERSION || '1.0.0',
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  public formatError(error: string, code?: string, details?: any): Omit<FormattedResponse, 'data'> {
    return {
      success: false,
      error,
      message: error,
      timestamp: Date.now(),
      requestId: 'will-be-set-by-middleware',
      version: process.env.API_VERSION || '1.0.0',
      ...(code && { code }),
      ...(details && { meta: { details } })
    };
  }

  public addPerformanceMetrics(response: any, startTime: number): any {
    const processingTime = Date.now() - startTime;
    const memoryUsage = process.memoryUsage();

    return {
      ...response,
      meta: {
        ...response.meta,
        performance: {
          processingTime,
          memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024 * 100) / 100 // MB
        }
      }
    };
  }

  public addCacheInfo(response: any, cacheHit: boolean, ttl?: number): any {
    return {
      ...response,
      meta: {
        ...response.meta,
        cache: {
          hit: cacheHit,
          ...(ttl && { ttl })
        }
      }
    };
  }
}

const responseFormatterService = new ResponseFormatterService();

// Main response formatter middleware
export function responseFormatter() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    const originalJson = res.json;

    // Add helper methods to response object
    res.success = function<T>(data: T, message?: string, meta?: any): Response {
      const formattedResponse = responseFormatterService.formatSuccess(data, message, meta);
      formattedResponse.requestId = req.requestId || 'unknown';
      
      // Add performance metrics if enabled
      if (req.startTime) {
        responseFormatterService.addPerformanceMetrics(formattedResponse, req.startTime);
      }

      return this.json(formattedResponse);
    };

    res.paginated = function<T>(
      items: T[], 
      page: number, 
      limit: number, 
      total: number,
      message?: string
    ): Response {
      const formattedResponse = responseFormatterService.formatPaginatedResponse(
        items, page, limit, total, message
      );
      formattedResponse.requestId = req.requestId || 'unknown';

      // Add performance metrics if enabled
      if (req.startTime) {
        responseFormatterService.addPerformanceMetrics(formattedResponse, req.startTime);
      }

      return this.json(formattedResponse);
    };

    res.error = function(error: string, statusCode: number = 400, code?: string, details?: any): Response {
      const formattedResponse = responseFormatterService.formatError(error, code, details);
      formattedResponse.requestId = req.requestId || 'unknown';

      return this.status(statusCode).json(formattedResponse);
    };

    res.notFound = function(resource: string = 'Resource'): Response {
      const formattedResponse = responseFormatterService.formatError(
        `${resource} not found`,
        'NOT_FOUND'
      );
      formattedResponse.requestId = req.requestId || 'unknown';

      return this.status(404).json(formattedResponse);
    };

    res.unauthorized = function(message: string = 'Unauthorized'): Response {
      const formattedResponse = responseFormatterService.formatError(
        message,
        'UNAUTHORIZED'
      );
      formattedResponse.requestId = req.requestId || 'unknown';

      return this.status(401).json(formattedResponse);
    };

    res.forbidden = function(message: string = 'Forbidden'): Response {
      const formattedResponse = responseFormatterService.formatError(
        message,
        'FORBIDDEN'
      );
      formattedResponse.requestId = req.requestId || 'unknown';

      return this.status(403).json(formattedResponse);
    };

    res.conflict = function(message: string, details?: any): Response {
      const formattedResponse = responseFormatterService.formatError(
        message,
        'CONFLICT',
        details
      );
      formattedResponse.requestId = req.requestId || 'unknown';

      return this.status(409).json(formattedResponse);
    };

    res.tooManyRequests = function(message: string = 'Too many requests'): Response {
      const formattedResponse = responseFormatterService.formatError(
        message,
        'TOO_MANY_REQUESTS'
      );
      formattedResponse.requestId = req.requestId || 'unknown';

      return this.status(429).json(formattedResponse);
    };

    res.serverError = function(message: string = 'Internal server error', details?: any): Response {
      const formattedResponse = responseFormatterService.formatError(
        message,
        'INTERNAL_SERVER_ERROR',
        details
      );
      formattedResponse.requestId = req.requestId || 'unknown';

      return this.status(500).json(formattedResponse);
    };

    // Override original methods to ensure consistency
    res.send = function(body: any): Response {
      // If body is already formatted, send as-is
      if (body && typeof body === 'object' && body.hasOwnProperty('success')) {
        return originalSend.call(this, body);
      }

      // Format plain responses
      const formattedResponse = responseFormatterService.formatSuccess(body);
      formattedResponse.requestId = req.requestId || 'unknown';

      return originalSend.call(this, formattedResponse);
    };

    res.json = function(obj: any): Response {
      // If object is already formatted, send as-is
      if (obj && typeof obj === 'object' && obj.hasOwnProperty('success')) {
        return originalJson.call(this, obj);
      }

      // Format plain JSON responses
      const formattedResponse = responseFormatterService.formatSuccess(obj);
      formattedResponse.requestId = req.requestId || 'unknown';

      return originalJson.call(this, formattedResponse);
    };

    next();
  };
}

// Data transformation utilities
export function transformTradingData(data: any): any {
  if (!data) return data;

  // Transform trading-specific data
  if (data.price !== undefined) {
    data.price = parseFloat(data.price.toFixed(4));
  }

  if (data.quantity !== undefined) {
    data.quantity = parseInt(data.quantity);
  }

  if (data.timestamp !== undefined && typeof data.timestamp === 'number') {
    data.timestamp = Math.floor(data.timestamp);
  }

  return data;
}

export function transformMarketData(data: any): any {
  if (!data) return data;

  // Transform market data fields
  const numericFields = ['price', 'volume', 'bid', 'ask', 'high', 'low', 'spread'];
  
  numericFields.forEach(field => {
    if (data[field] !== undefined) {
      data[field] = parseFloat(Number(data[field]).toFixed(4));
    }
  });

  if (data.timestamp !== undefined) {
    data.timestamp = Math.floor(data.timestamp);
  }

  return data;
}

export function transformUserData(data: any): any {
  if (!data) return data;

  // Remove sensitive fields
  delete data.password;
  delete data.passwordHash;
  delete data.__v;

  // Format dates
  if (data.createdAt) {
    data.createdAt = new Date(data.createdAt).toISOString();
  }

  if (data.updatedAt) {
    data.updatedAt = new Date(data.updatedAt).toISOString();
  }

  if (data.lastLogin) {
    data.lastLogin = new Date(data.lastLogin).toISOString();
  }

  return data;
}

// Response caching utilities
export function cacheResponse(ttl: number = 300) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const originalJson = res.json;

    res.json = function(obj: any): Response {
      // Add cache headers
      this.set('Cache-Control', `public, max-age=${ttl}`);
      this.set('ETag', generateETag(obj));

      // Add cache info to response
      if (obj && typeof obj === 'object') {
        responseFormatterService.addCacheInfo(obj, false, ttl);
      }

      return originalJson.call(this, obj);
    };

    next();
  };
}

function generateETag(data: any): string {
  const crypto = require('crypto');
  return crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex');
}

// Conditional response middleware
export function conditionalResponse() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const originalJson = res.json;

    res.json = function(obj: any): Response {
      // Handle If-None-Match header
      const clientETag = req.headers['if-none-match'];
      const currentETag = generateETag(obj);

      if (clientETag && clientETag === currentETag) {
        return this.status(304).send();
      }

      this.set('ETag', currentETag);
      return originalJson.call(this, obj);
    };

    next();
  };
}

// Response compression middleware
export function compressResponse() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const originalJson = res.json;

    res.json = function(obj: any): Response {
      // Set compression hints
      if (obj && JSON.stringify(obj).length > 1024) {
        this.set('Content-Type', 'application/json; charset=utf-8');
      }

      return originalJson.call(this, obj);
    };

    next();
  };
}

// Extend Express Response interface
declare global {
  namespace Express {
    interface Response {
      success<T>(data: T, message?: string, meta?: any): Response;
      paginated<T>(items: T[], page: number, limit: number, total: number, message?: string): Response;
      error(error: string, statusCode?: number, code?: string, details?: any): Response;
      notFound(resource?: string): Response;
      unauthorized(message?: string): Response;
      forbidden(message?: string): Response;
      conflict(message: string, details?: any): Response;
      tooManyRequests(message?: string): Response;
      serverError(message?: string, details?: any): Response;
    }
  }
}

export { ResponseFormatterService };
export default responseFormatter;