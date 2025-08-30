import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  details?: any;
  timestamp: string;
  requestId?: string;
  stack?: string;
}

interface TradingError extends Error {
  code?: string;
  statusCode?: number;
  details?: any;
  isTradingError?: boolean;
}

class ErrorHandlerMiddleware {
  /**
   * Global error handler middleware
   */
  handle = (error: TradingError, req: AuthRequest, res: Response, next: NextFunction): void => {
    // Log error details
    this.logError(error, req);

    // Don't send error if response already sent
    if (res.headersSent) {
      return next(error);
    }

    const errorResponse: ErrorResponse = {
      success: false,
      error: this.getErrorMessage(error),
      code: this.getErrorCode(error),
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(req)
    };

    // Add details for development environment
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = error.details;
      errorResponse.stack = error.stack;
    }

    const statusCode = this.getStatusCode(error);
    res.status(statusCode).json(errorResponse);
  };

  /**
   * Async error wrapper for route handlers
   */
  asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };

  /**
   * Not found handler
   */
  notFound = (req: Request, res: Response, next: NextFunction): void => {
    const error: TradingError = new Error(`Route not found: ${req.method} ${req.path}`);
    error.statusCode = 404;
    error.code = 'ROUTE_NOT_FOUND';
    next(error);
  };

  /**
   * Trading-specific error handler
   */
  tradingErrorHandler = (error: TradingError, req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!error.isTradingError) {
      return next(error);
    }

    // Log critical trading errors
    console.error('🚨 TRADING ERROR:', {
      user: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString(),
      stack: error.stack
    });

    // Special handling for different trading error types
    let statusCode = 400;
    let errorCode = 'TRADING_ERROR';

    switch (error.code) {
      case 'INSUFFICIENT_BALANCE':
        statusCode = 402;
        errorCode = 'INSUFFICIENT_BALANCE';
        break;
      case 'MARKET_CLOSED':
        statusCode = 409;
        errorCode = 'MARKET_CLOSED';
        break;
      case 'POSITION_LIMIT_EXCEEDED':
        statusCode = 409;
        errorCode = 'POSITION_LIMIT_EXCEEDED';
        break;
      case 'INVALID_ORDER_PARAMS':
        statusCode = 400;
        errorCode = 'INVALID_ORDER_PARAMS';
        break;
      case 'ORDER_EXECUTION_FAILED':
        statusCode = 500;
        errorCode = 'ORDER_EXECUTION_FAILED';
        break;
      case 'RISK_LIMIT_EXCEEDED':
        statusCode = 409;
        errorCode = 'RISK_LIMIT_EXCEEDED';
        break;
    }

    res.status(statusCode).json({
      success: false,
      error: error.message,
      code: errorCode,
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(req)
    });
  };

  /**
   * Validation error handler
   */
  validationErrorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
    if (error.name === 'ValidationError' || error.code === 'VALIDATION_ERROR') {
      const validationErrors = this.parseValidationErrors(error);
      
      res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validationErrors,
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(req)
      });
      return;
    }

    next(error);
  };

  /**
   * Rate limit error handler
   */
  rateLimitErrorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
    if (error.code && error.code.includes('RATE_LIMIT_EXCEEDED')) {
      res.status(429).json({
        success: false,
        error: error.message || 'Rate limit exceeded',
        code: error.code,
        retryAfter: error.retryAfter || 60,
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(req)
      });
      return;
    }

    next(error);
  };

  /**
   * Database error handler
   */
  databaseErrorHandler = (error: any, req: Request, res: Response, next: NextFunction): void => {
    if (error.code === 11000 || error.code === 'DUPLICATE_KEY') {
      res.status(409).json({
        success: false,
        error: 'Duplicate resource',
        code: 'DUPLICATE_RESOURCE',
        details: this.parseDuplicateKeyError(error),
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(req)
      });
      return;
    }

    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      console.error('Database error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Database error',
        code: 'DATABASE_ERROR',
        timestamp: new Date().toISOString(),
        requestId: this.generateRequestId(req)
      });
      return;
    }

    next(error);
  };

  /**
   * WebSocket error handler
   */
  websocketErrorHandler = (error: TradingError, ws: any, req: AuthRequest): void => {
    console.error('WebSocket error:', {
      user: req.user?.id,
      error: error.message,
      code: error.code,
      timestamp: new Date().toISOString()
    });

    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'error',
        error: {
          message: error.message,
          code: error.code || 'WEBSOCKET_ERROR',
          timestamp: new Date().toISOString()
        }
      }));
    }
  };

  /**
   * Create trading error
   */
  createTradingError = (message: string, code: string, statusCode: number = 400, details?: any): TradingError => {
    const error: TradingError = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    error.details = details;
    error.isTradingError = true;
    return error;
  };

  /**
   * Get appropriate status code for error
   */
  private getStatusCode(error: TradingError): number {
    if (error.statusCode) {
      return error.statusCode;
    }

    // Default status codes based on error type
    if (error.name === 'ValidationError') return 400;
    if (error.name === 'UnauthorizedError') return 401;
    if (error.name === 'ForbiddenError') return 403;
    if (error.name === 'NotFoundError') return 404;
    if (error.name === 'ConflictError') return 409;
    
    return 500; // Internal server error
  }

  /**
   * Get error code
   */
  private getErrorCode(error: TradingError): string {
    if (error.code) {
      return error.code;
    }

    // Generate code based on error type
    switch (error.name) {
      case 'ValidationError': return 'VALIDATION_ERROR';
      case 'UnauthorizedError': return 'UNAUTHORIZED';
      case 'ForbiddenError': return 'FORBIDDEN';
      case 'NotFoundError': return 'NOT_FOUND';
      case 'ConflictError': return 'CONFLICT';
      default: return 'INTERNAL_ERROR';
    }
  }

  /**
   * Get safe error message
   */
  private getErrorMessage(error: TradingError): string {
    // Don't expose sensitive internal errors in production
    if (process.env.NODE_ENV === 'production') {
      switch (this.getErrorCode(error)) {
        case 'INTERNAL_ERROR':
          return 'Internal server error';
        case 'DATABASE_ERROR':
          return 'Database error occurred';
        default:
          return error.message || 'An error occurred';
      }
    }

    return error.message || 'An error occurred';
  }

  /**
   * Log error with context
   */
  private logError(error: TradingError, req: AuthRequest): void {
    const errorLog = {
      timestamp: new Date().toISOString(),
      requestId: this.generateRequestId(req),
      user: req.user?.id || 'anonymous',
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        statusCode: error.statusCode,
        stack: error.stack
      }
    };

    // Use appropriate log level based on status code
    const statusCode = this.getStatusCode(error);
    if (statusCode >= 500) {
      console.error('🚨 SERVER ERROR:', errorLog);
    } else if (statusCode >= 400) {
      console.warn('⚠️  CLIENT ERROR:', errorLog);
    } else {
      console.log('ℹ️  ERROR:', errorLog);
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(req: Request): string {
    return req.headers['x-request-id'] as string || 
           `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Parse validation errors
   */
  private parseValidationErrors(error: any): any {
    if (error.errors) {
      const validationErrors: any = {};
      for (const [field, fieldError] of Object.entries(error.errors)) {
        validationErrors[field] = (fieldError as any).message;
      }
      return validationErrors;
    }

    if (error.details) {
      return error.details;
    }

    return { general: error.message };
  }

  /**
   * Parse duplicate key error
   */
  private parseDuplicateKeyError(error: any): any {
    if (error.keyPattern) {
      const duplicateFields = Object.keys(error.keyPattern);
      return {
        fields: duplicateFields,
        message: `Duplicate value for: ${duplicateFields.join(', ')}`
      };
    }

    return { message: 'Duplicate resource' };
  }

  /**
   * Health check for error handler
   */
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'operational',
      timestamp: new Date().toISOString()
    };
  }
}

const errorHandler = new ErrorHandlerMiddleware();

export { 
  errorHandler,
  TradingError,
  ErrorResponse
};