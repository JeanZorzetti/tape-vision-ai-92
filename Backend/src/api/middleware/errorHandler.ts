/**
 * Error Handling Middleware - Tape Vision Trading System
 * Centralized error handling with detailed logging and user-friendly responses
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';
import { 
  AuthenticatedRequest, 
  APIError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError
} from '../types/api';
import { TradingError, NelogicaError, RiskError, ValidationError } from '../../types/trading';

interface ErrorResponse {
  success: false;
  error: string;
  code: string;
  message: string;
  details?: any;
  timestamp: number;
  requestId: string;
  stack?: string;
}

class ErrorHandlerService {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  public handleError(error: any, req: AuthenticatedRequest, res: Response): void {
    const requestId = req.requestId || 'unknown';
    const userId = req.user?.id || req.apiKey?.id || 'anonymous';

    // Log the error
    this.logError(error, req, requestId, userId);

    // Determine error type and create response
    const errorResponse = this.createErrorResponse(error, requestId);

    // Send response
    res.status(errorResponse.statusCode).json({
      success: false,
      error: errorResponse.error,
      code: errorResponse.code,
      message: errorResponse.message,
      details: errorResponse.details,
      timestamp: Date.now(),
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }

  private logError(error: any, req: AuthenticatedRequest, requestId: string, userId: string): void {
    const errorContext = {
      requestId,
      userId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      error: {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    };

    // Determine log level based on error type
    if (this.isClientError(error)) {
      this.logger.warn('Client error occurred', errorContext);
    } else if (this.isServerError(error)) {
      this.logger.error('Server error occurred', errorContext);
    } else {
      this.logger.error('Unknown error occurred', errorContext);
    }

    // Special handling for trading errors
    if (error instanceof TradingError || error instanceof NelogicaError || error instanceof RiskError) {
      this.logger.error('Trading system error', {
        ...errorContext,
        tradingContext: error.details
      });
    }
  }

  private createErrorResponse(error: any, requestId: string): ErrorResponse & { statusCode: number } {
    // Handle known error types
    if (error instanceof BadRequestError) {
      return {
        statusCode: 400,
        success: false,
        error: 'Bad Request',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof UnauthorizedError) {
      return {
        statusCode: 401,
        success: false,
        error: 'Unauthorized',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof ForbiddenError) {
      return {
        statusCode: 403,
        success: false,
        error: 'Forbidden',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof NotFoundError) {
      return {
        statusCode: 404,
        success: false,
        error: 'Not Found',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof ConflictError) {
      return {
        statusCode: 409,
        success: false,
        error: 'Conflict',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof TooManyRequestsError) {
      return {
        statusCode: 429,
        success: false,
        error: 'Too Many Requests',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof ServiceUnavailableError) {
      return {
        statusCode: 503,
        success: false,
        error: 'Service Unavailable',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    // Handle trading-specific errors
    if (error instanceof TradingError) {
      return {
        statusCode: 422,
        success: false,
        error: 'Trading Error',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof NelogicaError) {
      return {
        statusCode: 502,
        success: false,
        error: 'External Service Error',
        code: error.code,
        message: 'Nelogica service error occurred',
        details: process.env.NODE_ENV === 'development' ? error.details : undefined,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof RiskError) {
      return {
        statusCode: 403,
        success: false,
        error: 'Risk Management Violation',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    if (error instanceof ValidationError) {
      return {
        statusCode: 400,
        success: false,
        error: 'Validation Error',
        code: error.code,
        message: error.message,
        details: error.details,
        timestamp: Date.now(),
        requestId
      };
    }

    // Handle MongoDB errors
    if (error.name === 'MongoError' || error.name === 'MongooseError') {
      return {
        statusCode: 500,
        success: false,
        error: 'Database Error',
        code: 'DATABASE_ERROR',
        message: 'A database error occurred',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: Date.now(),
        requestId
      };
    }

    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
      return {
        statusCode: 401,
        success: false,
        error: 'Authentication Error',
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        timestamp: Date.now(),
        requestId
      };
    }

    if (error.name === 'TokenExpiredError') {
      return {
        statusCode: 401,
        success: false,
        error: 'Authentication Error',
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
        timestamp: Date.now(),
        requestId
      };
    }

    // Handle Joi validation errors
    if (error.name === 'ValidationError' && error.isJoi) {
      return {
        statusCode: 400,
        success: false,
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.details?.map((detail: any) => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        })),
        timestamp: Date.now(),
        requestId
      };
    }

    // Handle syntax errors
    if (error instanceof SyntaxError) {
      return {
        statusCode: 400,
        success: false,
        error: 'Syntax Error',
        code: 'SYNTAX_ERROR',
        message: 'Invalid JSON in request body',
        timestamp: Date.now(),
        requestId
      };
    }

    // Generic server error
    return {
      statusCode: 500,
      success: false,
      error: 'Internal Server Error',
      code: 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.details : undefined,
      timestamp: Date.now(),
      requestId
    };
  }

  private isClientError(error: any): boolean {
    return error instanceof BadRequestError ||
           error instanceof UnauthorizedError ||
           error instanceof ForbiddenError ||
           error instanceof NotFoundError ||
           error instanceof ConflictError ||
           error instanceof TooManyRequestsError ||
           (error.statusCode && error.statusCode >= 400 && error.statusCode < 500);
  }

  private isServerError(error: any): boolean {
    return error instanceof InternalServerError ||
           error instanceof ServiceUnavailableError ||
           error instanceof NelogicaError ||
           (error.statusCode && error.statusCode >= 500) ||
           (!error.statusCode && !(this.isClientError(error)));
  }
}

let errorHandlerService: ErrorHandlerService;

export function initializeErrorHandler(logger: winston.Logger): void {
  errorHandlerService = new ErrorHandlerService(logger);
}

// Main error handler middleware
export function errorHandler(logger: winston.Logger) {
  if (!errorHandlerService) {
    errorHandlerService = new ErrorHandlerService(logger);
  }

  return (error: any, req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Skip if response already sent
    if (res.headersSent) {
      return next(error);
    }

    errorHandlerService.handleError(error, req, res);
  };
}

// Async error wrapper for route handlers
export function asyncHandler(fn: Function) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Not found handler
export function notFoundHandler(req: AuthenticatedRequest, res: Response): void {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  
  res.status(404).json({
    success: false,
    error: 'Not Found',
    code: error.code,
    message: error.message,
    path: req.path,
    method: req.method,
    timestamp: Date.now(),
    requestId: req.requestId || 'unknown'
  });
}

// Custom error factories
export function createTradingError(message: string, code: string, details?: any): TradingError {
  return new TradingError(message, code, details);
}

export function createValidationError(message: string, errors: any[]): BadRequestError {
  return new BadRequestError(message, { errors });
}

export function createUnauthorizedError(message?: string): UnauthorizedError {
  return new UnauthorizedError(message);
}

export function createForbiddenError(message?: string): ForbiddenError {
  return new ForbiddenError(message);
}

export function createNotFoundError(resource: string): NotFoundError {
  return new NotFoundError(`${resource} not found`);
}

export function createConflictError(message: string, details?: any): ConflictError {
  return new ConflictError(message, details);
}

// Error reporting utilities
export function reportError(error: Error, context?: any): void {
  if (errorHandlerService) {
    errorHandlerService['logger'].error('Manual error report', {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context
    });
  }
}

export function reportCriticalError(error: Error, context?: any): void {
  if (errorHandlerService) {
    errorHandlerService['logger'].error('CRITICAL ERROR REPORTED', {
      level: 'CRITICAL',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    });
  }
  
  // In production, you might want to send this to external monitoring
  // like Sentry, DataDog, etc.
}

export default errorHandler;