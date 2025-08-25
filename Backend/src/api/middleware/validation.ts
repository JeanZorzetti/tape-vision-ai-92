/**
 * Request Validation Middleware - Tape Vision Trading System
 * Comprehensive input validation and sanitization using Joi
 */

import { Response, NextFunction } from 'express';
import Joi from 'joi';
import { AuthenticatedRequest, ValidationError, BadRequestError } from '../types/api';

// Custom validation schemas
export const commonSchemas = {
  // Common field validations
  id: Joi.string().uuid().required(),
  optionalId: Joi.string().uuid().optional(),
  
  // Pagination
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(1000).default(50),
  
  // Date/Time
  timestamp: Joi.number().integer().min(0),
  dateString: Joi.string().isoDate(),
  
  // Trading specific
  symbol: Joi.string().uppercase().min(2).max(10).pattern(/^[A-Z0-9]+$/),
  price: Joi.number().positive().precision(4),
  quantity: Joi.number().positive().integer(),
  percentage: Joi.number().min(0).max(100),
  
  // User authentication
  username: Joi.string().alphanum().min(3).max(30),
  email: Joi.string().email(),
  password: Joi.string().min(8).pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#\$%\^&\*])')),
  
  // API specific
  requestId: Joi.string().uuid(),
  clientOrderId: Joi.string().max(64).optional()
};

// Trading validation schemas
export const tradingSchemas = {
  placeOrder: Joi.object({
    symbol: commonSchemas.symbol.required(),
    side: Joi.string().valid('buy', 'sell').required(),
    quantity: commonSchemas.quantity.required(),
    orderType: Joi.string().valid('market', 'limit', 'stop', 'stop_limit').required(),
    price: Joi.when('orderType', {
      is: Joi.string().valid('limit', 'stop_limit'),
      then: commonSchemas.price.required(),
      otherwise: commonSchemas.price.optional()
    }),
    stopPrice: Joi.when('orderType', {
      is: Joi.string().valid('stop', 'stop_limit'),
      then: commonSchemas.price.required(),
      otherwise: commonSchemas.price.optional()
    }),
    timeInForce: Joi.string().valid('GTC', 'IOC', 'FOK', 'GTD').default('GTC'),
    clientOrderId: commonSchemas.clientOrderId
  }),
  
  cancelOrder: Joi.object({
    orderId: commonSchemas.id.required(),
    clientOrderId: commonSchemas.clientOrderId
  }),
  
  modifyOrder: Joi.object({
    orderId: commonSchemas.id.required(),
    quantity: commonSchemas.quantity.optional(),
    price: commonSchemas.price.optional(),
    stopPrice: commonSchemas.price.optional()
  }),
  
  closePosition: Joi.object({
    symbol: commonSchemas.symbol.required(),
    percentage: commonSchemas.percentage.default(100)
  }),
  
  updateRiskLimits: Joi.object({
    maxDailyLoss: Joi.number().positive().required(),
    maxPositionSize: commonSchemas.quantity.required(),
    maxDrawdown: Joi.number().positive().required(),
    maxOpenPositions: Joi.number().integer().min(1).max(50).required(),
    allowedSymbols: Joi.array().items(commonSchemas.symbol).min(1).required(),
    tradingHours: Joi.array().items(Joi.object({
      start: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      end: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      timezone: Joi.string().required()
    })).required()
  })
};

// Market data validation schemas
export const marketDataSchemas = {
  subscribe: Joi.object({
    symbols: Joi.array().items(commonSchemas.symbol).min(1).max(50).required(),
    channels: Joi.array().items(Joi.string().valid('quotes', 'trades', 'orderbook', 'candles')).min(1).required(),
    depth: Joi.number().integer().min(1).max(100).default(10),
    interval: Joi.string().valid('1s', '5s', '10s', '30s', '1m', '5m', '15m', '1h', '4h', '1d').default('1s')
  }),
  
  getHistoricalData: Joi.object({
    symbol: commonSchemas.symbol.required(),
    interval: Joi.string().valid('1m', '5m', '15m', '30m', '1h', '4h', '1d').required(),
    startTime: commonSchemas.timestamp.optional(),
    endTime: commonSchemas.timestamp.optional(),
    limit: Joi.number().integer().min(1).max(5000).default(500)
  }),
  
  getOrderBook: Joi.object({
    symbol: commonSchemas.symbol.required(),
    depth: Joi.number().integer().min(1).max(1000).default(100)
  })
};

// Authentication validation schemas
export const authSchemas = {
  login: Joi.object({
    username: commonSchemas.username.required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false)
  }),
  
  register: Joi.object({
    username: commonSchemas.username.required(),
    email: commonSchemas.email.required(),
    password: commonSchemas.password.required(),
    firstName: Joi.string().max(50).optional(),
    lastName: Joi.string().max(50).optional(),
    role: Joi.string().valid('admin', 'trader', 'analyst', 'viewer').default('trader')
  }),
  
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),
  
  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: commonSchemas.password.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  })
};

// System validation schemas
export const systemSchemas = {
  updateConfig: Joi.object({
    riskParameters: Joi.object({
      maxDailyLoss: Joi.number().positive(),
      maxPositionSize: commonSchemas.quantity,
      stopLossPoints: Joi.number().positive(),
      takeProfitPoints: Joi.number().positive(),
      maxDrawdown: Joi.number().positive(),
      consecutiveStopLimit: Joi.number().integer().min(1).max(10),
      minimumConfidence: Joi.number().min(0).max(100)
    }).optional(),
    
    analysisSettings: Joi.object({
      confidenceThreshold: Joi.number().min(0).max(100),
      patternWeight: Joi.number().min(0).max(1),
      volumeWeight: Joi.number().min(0).max(1),
      priceActionWeight: Joi.number().min(0).max(1)
    }).optional(),
    
    patternSettings: Joi.object().pattern(Joi.string(), Joi.any()).optional()
  })
};

// Query parameter validation schemas
export const querySchemas = {
  pagination: Joi.object({
    page: commonSchemas.page,
    limit: commonSchemas.limit,
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  dateRange: Joi.object({
    startDate: commonSchemas.dateString.optional(),
    endDate: commonSchemas.dateString.optional(),
    timezone: Joi.string().default('America/Sao_Paulo')
  }).and('startDate', 'endDate'),
  
  tradingLog: Joi.object({
    page: commonSchemas.page,
    limit: commonSchemas.limit,
    symbol: commonSchemas.symbol.optional(),
    action: Joi.string().valid('BUY', 'SELL', 'ANALYSIS', 'ALERT', 'ERROR').optional(),
    status: Joi.string().valid('success', 'pending', 'failed').optional(),
    startDate: commonSchemas.dateString.optional(),
    endDate: commonSchemas.dateString.optional()
  })
};

// Generic validation middleware factory
export function validateRequest(schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      let dataToValidate: any;
      
      switch (source) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        default:
          dataToValidate = req.body;
      }

      const { error, value } = schema.validate(dataToValidate, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        throw new BadRequestError('Validation failed', { errors: validationErrors });
      }

      // Replace the original data with validated and sanitized data
      switch (source) {
        case 'body':
          req.body = value;
          break;
        case 'query':
          req.query = value;
          break;
        case 'params':
          req.params = value;
          break;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Specific validation middleware
export const validationMiddleware = {
  // Trading validations
  placeOrder: validateRequest(tradingSchemas.placeOrder),
  cancelOrder: validateRequest(tradingSchemas.cancelOrder),
  modifyOrder: validateRequest(tradingSchemas.modifyOrder),
  closePosition: validateRequest(tradingSchemas.closePosition),
  updateRiskLimits: validateRequest(tradingSchemas.updateRiskLimits),
  
  // Market data validations
  subscribeMarketData: validateRequest(marketDataSchemas.subscribe),
  getHistoricalData: validateRequest(marketDataSchemas.getHistoricalData, 'query'),
  getOrderBook: validateRequest(marketDataSchemas.getOrderBook, 'query'),
  
  // Authentication validations
  login: validateRequest(authSchemas.login),
  register: validateRequest(authSchemas.register),
  refreshToken: validateRequest(authSchemas.refreshToken),
  changePassword: validateRequest(authSchemas.changePassword),
  
  // System validations
  updateConfig: validateRequest(systemSchemas.updateConfig),
  
  // Query validations
  pagination: validateRequest(querySchemas.pagination, 'query'),
  dateRange: validateRequest(querySchemas.dateRange, 'query'),
  tradingLog: validateRequest(querySchemas.tradingLog, 'query'),
  
  // Parameter validations
  id: validateRequest(Joi.object({ id: commonSchemas.id }), 'params'),
  symbol: validateRequest(Joi.object({ symbol: commonSchemas.symbol }), 'params')
};

// Custom validation functions
export function validateSymbol(symbol: string): boolean {
  const { error } = commonSchemas.symbol.validate(symbol);
  return !error;
}

export function validatePrice(price: number): boolean {
  const { error } = commonSchemas.price.validate(price);
  return !error;
}

export function validateQuantity(quantity: number): boolean {
  const { error } = commonSchemas.quantity.validate(quantity);
  return !error;
}

export function validateDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return false;
  }
  
  return start <= end && end <= new Date();
}

// Sanitization utilities
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, '');
}

export function sanitizeNumber(input: any): number | null {
  const num = parseFloat(input);
  return isNaN(num) ? null : num;
}

export function sanitizeBoolean(input: any): boolean {
  if (typeof input === 'boolean') return input;
  if (typeof input === 'string') {
    return ['true', '1', 'yes', 'on'].includes(input.toLowerCase());
  }
  return Boolean(input);
}

// Advanced validation rules
export const advancedRules = {
  // Trading specific business rules
  validateOrderPrice: (orderType: string, price?: number, stopPrice?: number): boolean => {
    switch (orderType) {
      case 'market':
        return price === undefined;
      case 'limit':
        return price !== undefined && price > 0;
      case 'stop':
        return stopPrice !== undefined && stopPrice > 0;
      case 'stop_limit':
        return price !== undefined && stopPrice !== undefined && price > 0 && stopPrice > 0;
      default:
        return false;
    }
  },
  
  validateTradingHours: (tradingHours: Array<{start: string, end: string}>): boolean => {
    return tradingHours.every(session => {
      const start = session.start.split(':').map(Number);
      const end = session.end.split(':').map(Number);
      
      const startMinutes = start[0] * 60 + start[1];
      const endMinutes = end[0] * 60 + end[1];
      
      return startMinutes < endMinutes || endMinutes < startMinutes; // Handle overnight sessions
    });
  },
  
  validateRiskLimits: (limits: any): boolean => {
    return limits.maxDailyLoss > 0 && 
           limits.maxPositionSize > 0 && 
           limits.maxDrawdown >= limits.maxDailyLoss;
  }
};

export default validationMiddleware;