/**
 * Middleware Index - Central export point for all middleware components
 * 
 * This file provides a centralized way to import and configure all middleware
 * components for the trading API system.
 */

import { authMiddleware, AuthRequest, JWTPayload } from './auth';
import { rateLimitMiddleware, RateLimitConfig } from './rateLimit';
import { errorHandler, TradingError, ErrorResponse } from './errorHandler';
import { requestLogger, LogEntry, TradingLogEntry } from './requestLogger';
import { tradingSession, TradingSession, MarketStatus, TradingHours } from './tradingSession';
import { Request, Response, NextFunction, Application } from 'express';

/**
 * Middleware configuration options
 */
interface MiddlewareConfig {
  auth?: {
    jwtSecret?: string;
    jwtExpires?: string;
    enableApiKey?: boolean;
  };
  rateLimit?: {
    general?: Partial<RateLimitConfig>;
    trading?: Partial<RateLimitConfig>;
    apiKey?: Partial<RateLimitConfig>;
  };
  logging?: {
    enablePerformanceLogging?: boolean;
    enableSecurityLogging?: boolean;
    logLevel?: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  };
  session?: {
    defaultMaxPositions?: number;
    defaultMaxDailyLoss?: number;
    defaultCooldownPeriod?: number;
  };
  errorHandling?: {
    showStackTrace?: boolean;
    enableDetailedErrors?: boolean;
  };
}

/**
 * Main middleware class that orchestrates all middleware components
 */
class TradingMiddleware {
  private config: MiddlewareConfig;

  constructor(config: MiddlewareConfig = {}) {
    this.config = {
      auth: {
        jwtSecret: process.env.JWT_SECRET || 'trading-bot-secret',
        jwtExpires: process.env.JWT_EXPIRES || '24h',
        enableApiKey: true,
        ...config.auth
      },
      rateLimit: {
        general: { maxRequests: 100, windowMs: 15 * 60 * 1000 },
        trading: { maxRequests: 10, windowMs: 60 * 1000 },
        apiKey: { maxRequests: 1000, windowMs: 60 * 1000 },
        ...config.rateLimit
      },
      logging: {
        enablePerformanceLogging: true,
        enableSecurityLogging: true,
        logLevel: 'INFO',
        ...config.logging
      },
      session: {
        defaultMaxPositions: 5,
        defaultMaxDailyLoss: 3, // 3 points as per autonomous bot rules
        defaultCooldownPeriod: 5,
        ...config.session
      },
      errorHandling: {
        showStackTrace: process.env.NODE_ENV === 'development',
        enableDetailedErrors: process.env.NODE_ENV === 'development',
        ...config.errorHandling
      }
    };
  }

  /**
   * Apply all middleware to Express app in correct order
   */
  applyToApp(app: Application): void {
    console.log('🔧 Configuring trading middleware stack...');

    // 1. Request logging (should be first to capture everything)
    app.use(requestLogger.general);
    app.use(requestLogger.performance);

    // 2. General rate limiting
    app.use(rateLimitMiddleware.general(this.config.rateLimit?.general));

    // 3. Error handlers (before routes)
    app.use(errorHandler.validationErrorHandler);
    app.use(errorHandler.rateLimitErrorHandler);
    app.use(errorHandler.databaseErrorHandler);

    // 4. 404 handler for unknown routes
    app.use('*', errorHandler.notFound);

    // 5. Global error handler (must be last)
    app.use(errorHandler.handle);

    console.log('✅ Middleware stack configured successfully');
  }

  /**
   * Get authentication middleware chain for protected routes
   */
  getAuthChain() {
    return [
      authMiddleware.authenticate,
      rateLimitMiddleware.general()
    ];
  }

  /**
   * Get trading middleware chain for trading operations
   */
  getTradingChain() {
    return [
      authMiddleware.authenticate,
      authMiddleware.requireTradingEnabled,
      rateLimitMiddleware.trading,
      tradingSession.validateSession,
      tradingSession.checkTradingLimits,
      tradingSession.checkDailyGoal,
      tradingSession.checkPostAuctionConsolidation,
      requestLogger.trading,
      errorHandler.tradingErrorHandler
    ];
  }

  /**
   * Get admin middleware chain
   */
  getAdminChain() {
    return [
      authMiddleware.authenticate,
      authMiddleware.requireRole(['ADMIN']),
      rateLimitMiddleware.general()
    ];
  }

  /**
   * Get API key middleware chain for external services
   */
  getApiKeyChain() {
    return [
      authMiddleware.authenticateApiKey,
      rateLimitMiddleware.apiKey
    ];
  }

  /**
   * Get WebSocket middleware chain
   */
  getWebSocketChain() {
    return [
      authMiddleware.optionalAuth,
      rateLimitMiddleware.websocket
    ];
  }

  /**
   * Get ML prediction middleware chain
   */
  getMLChain() {
    return [
      authMiddleware.authenticate,
      rateLimitMiddleware.mlPrediction,
      tradingSession.validateSession
    ];
  }

  /**
   * Get data query middleware chain
   */
  getDataQueryChain() {
    return [
      authMiddleware.optionalAuth,
      rateLimitMiddleware.dataQuery
    ];
  }

  /**
   * Middleware for specific trading operations
   */
  trading = {
    // Order management
    placeOrder: [
      ...this.getTradingChain(),
      this.validateOrderParams
    ],

    // Position management
    closePosition: [
      ...this.getTradingChain(),
      this.validatePositionParams
    ],

    // ML predictions
    mlPrediction: [
      ...this.getMLChain(),
      this.validateMLParams
    ],

    // Market data
    marketData: [
      ...this.getDataQueryChain()
    ]
  };

  /**
   * Validation middleware for order parameters
   */
  private validateOrderParams = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const { symbol, quantity, orderType, side } = req.body;

    if (!symbol || !quantity || !orderType || !side) {
      const error = errorHandler.createTradingError(
        'Missing required order parameters',
        'INVALID_ORDER_PARAMS',
        400,
        { 
          required: ['symbol', 'quantity', 'orderType', 'side'],
          received: Object.keys(req.body)
        }
      );
      return next(error);
    }

    // Validate symbol format (mini dollar futures)
    if (!['WDO', 'DOL'].includes(symbol)) {
      const error = errorHandler.createTradingError(
        'Invalid symbol. Only WDO and DOL are supported.',
        'INVALID_SYMBOL',
        400,
        { validSymbols: ['WDO', 'DOL'] }
      );
      return next(error);
    }

    // Validate quantity
    if (quantity <= 0 || quantity > 100) {
      const error = errorHandler.createTradingError(
        'Invalid quantity. Must be between 1 and 100.',
        'INVALID_QUANTITY',
        400,
        { validRange: { min: 1, max: 100 } }
      );
      return next(error);
    }

    // Validate order type
    if (!['MARKET', 'LIMIT', 'STOP'].includes(orderType)) {
      const error = errorHandler.createTradingError(
        'Invalid order type.',
        'INVALID_ORDER_TYPE',
        400,
        { validTypes: ['MARKET', 'LIMIT', 'STOP'] }
      );
      return next(error);
    }

    // Validate side
    if (!['BUY', 'SELL'].includes(side)) {
      const error = errorHandler.createTradingError(
        'Invalid order side.',
        'INVALID_ORDER_SIDE',
        400,
        { validSides: ['BUY', 'SELL'] }
      );
      return next(error);
    }

    next();
  };

  /**
   * Validation middleware for position parameters
   */
  private validatePositionParams = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const { positionId } = req.params;

    if (!positionId) {
      const error = errorHandler.createTradingError(
        'Position ID is required',
        'MISSING_POSITION_ID',
        400
      );
      return next(error);
    }

    next();
  };

  /**
   * Validation middleware for ML prediction parameters
   */
  private validateMLParams = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const { symbol, timeframe } = req.body;

    if (symbol && !['WDO', 'DOL'].includes(symbol)) {
      const error = errorHandler.createTradingError(
        'Invalid symbol for ML prediction',
        'INVALID_ML_SYMBOL',
        400
      );
      return next(error);
    }

    if (timeframe && !['1m', '5m', '15m', '1h'].includes(timeframe)) {
      const error = errorHandler.createTradingError(
        'Invalid timeframe for ML prediction',
        'INVALID_ML_TIMEFRAME',
        400,
        { validTimeframes: ['1m', '5m', '15m', '1h'] }
      );
      return next(error);
    }

    next();
  };

  /**
   * Health check for all middleware components
   */
  healthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    components: { [key: string]: any };
    timestamp: string;
  } {
    const components = {
      auth: { status: 'healthy' },
      rateLimit: rateLimitMiddleware.getStatus({ ip: 'health-check' } as any, 'general'),
      errorHandler: errorHandler.healthCheck(),
      requestLogger: requestLogger.getPerformanceStats(),
      tradingSession: tradingSession.getSessionStats()
    };

    const hasUnhealthyComponents = Object.values(components).some(
      component => component.status === 'unhealthy'
    );

    const hasDegradedComponents = Object.values(components).some(
      component => component.status === 'degraded'
    );

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (hasUnhealthyComponents) {
      overallStatus = 'unhealthy';
    } else if (hasDegradedComponents) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      components,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get middleware configuration
   */
  getConfig(): MiddlewareConfig {
    return { ...this.config };
  }

  /**
   * Update middleware configuration
   */
  updateConfig(newConfig: Partial<MiddlewareConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }
}

// Export individual middleware components
export {
  authMiddleware,
  rateLimitMiddleware,
  errorHandler,
  requestLogger,
  tradingSession,
  TradingMiddleware,
  
  // Types
  AuthRequest,
  JWTPayload,
  RateLimitConfig,
  TradingError,
  ErrorResponse,
  LogEntry,
  TradingLogEntry,
  TradingSession,
  MarketStatus,
  TradingHours,
  MiddlewareConfig
};

// Export configured middleware instance
const tradingMiddleware = new TradingMiddleware();
export default tradingMiddleware;