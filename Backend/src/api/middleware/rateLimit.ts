/**
 * Rate Limiting Middleware - Tape Vision Trading System
 * Advanced rate limiting with different limits for different endpoints
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { AuthenticatedRequest, TooManyRequestsError, RateLimitConfig } from '../types/api';
import winston from 'winston';
import Redis from 'ioredis';

interface RateLimitRule {
  path: string;
  method?: string;
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

class RateLimitManager {
  private redis?: Redis;
  private logger: winston.Logger;
  private rules: Map<string, RateLimitRule> = new Map();

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.initializeRedis();
    this.setupRules();
  }

  private initializeRedis(): void {
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL);
        this.logger.info('Rate limiting using Redis store');
      } catch (error) {
        this.logger.error('Failed to connect to Redis for rate limiting', error);
        this.logger.warn('Falling back to in-memory rate limiting');
      }
    }
  }

  private setupRules(): void {
    // General API rules
    this.rules.set('api:general', {
      path: '/api/*',
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000,
      skipSuccessfulRequests: false
    });

    // Authentication rules
    this.rules.set('auth:login', {
      path: '/api/*/auth/login',
      method: 'POST',
      windowMs: 15 * 60 * 1000,
      max: 5, // Strict limit for login attempts
      skipSuccessfulRequests: true
    });

    this.rules.set('auth:register', {
      path: '/api/*/auth/register',
      method: 'POST',
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3,
      skipSuccessfulRequests: true
    });

    // Trading rules
    this.rules.set('trading:orders', {
      path: '/api/*/trading/orders',
      method: 'POST',
      windowMs: 60 * 1000, // 1 minute
      max: 10, // Max 10 orders per minute
      skipSuccessfulRequests: false
    });

    this.rules.set('trading:positions', {
      path: '/api/*/trading/positions/*',
      method: 'DELETE',
      windowMs: 60 * 1000,
      max: 20, // Max 20 position closes per minute
      skipSuccessfulRequests: false
    });

    // Market data rules
    this.rules.set('market:subscribe', {
      path: '/api/*/market-data/subscribe',
      method: 'POST',
      windowMs: 60 * 1000,
      max: 50, // Liberal for market data subscriptions
      skipSuccessfulRequests: true
    });

    this.rules.set('market:historical', {
      path: '/api/*/market-data/historical',
      method: 'GET',
      windowMs: 60 * 1000,
      max: 30, // Historical data requests
      skipSuccessfulRequests: true
    });

    // Risk management rules
    this.rules.set('risk:limits', {
      path: '/api/*/risk/limits',
      method: 'PUT',
      windowMs: 5 * 60 * 1000, // 5 minutes
      max: 5, // Risk limit changes should be infrequent
      skipSuccessfulRequests: true
    });

    // System rules
    this.rules.set('system:emergency', {
      path: '/api/*/system/emergency-stop',
      method: 'POST',
      windowMs: 60 * 1000,
      max: 10, // Allow multiple emergency stops
      skipSuccessfulRequests: false
    });
  }

  public getRuleForPath(path: string, method: string): RateLimitRule | null {
    // Find the most specific rule
    let bestMatch: RateLimitRule | null = null;
    let bestScore = -1;

    for (const rule of this.rules.values()) {
      if (this.pathMatches(path, rule.path) && (!rule.method || rule.method === method)) {
        const score = rule.path.length;
        if (score > bestScore) {
          bestMatch = rule;
          bestScore = score;
        }
      }
    }

    return bestMatch;
  }

  private pathMatches(actualPath: string, rulePath: string): boolean {
    if (rulePath === actualPath) return true;
    
    if (rulePath.includes('*')) {
      const regex = new RegExp('^' + rulePath.replace(/\*/g, '.*') + '$');
      return regex.test(actualPath);
    }
    
    return false;
  }

  public createLimiter(rule: RateLimitRule): any {
    const keyGenerator = (req: AuthenticatedRequest): string => {
      // Generate rate limit key based on user/IP
      let key = `rate_limit:${rule.path}:`;
      
      if (req.user) {
        key += `user:${req.user.id}`;
      } else if (req.apiKey) {
        key += `api:${req.apiKey.id}`;
      } else {
        key += `ip:${req.ip}`;
      }
      
      return key;
    };

    const skipHandler = (req: AuthenticatedRequest): boolean => {
      // Skip rate limiting for admin users in development
      if (process.env.NODE_ENV === 'development' && req.user?.role === 'admin') {
        return true;
      }

      // API key specific limits
      if (req.apiKey) {
        const keyLimit = req.apiKey.rateLimit;
        if (keyLimit.requests === -1) { // Unlimited
          return true;
        }
      }

      return false;
    };

    return rateLimit({
      windowMs: rule.windowMs,
      max: rule.max,
      skipSuccessfulRequests: rule.skipSuccessfulRequests,
      skipFailedRequests: rule.skipFailedRequests,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      skip: skipHandler,
      message: {
        success: false,
        error: 'Rate limit exceeded',
        limit: rule.max,
        windowMs: rule.windowMs,
        retryAfter: Math.ceil(rule.windowMs / 1000),
        timestamp: Date.now()
      },
      handler: (req: AuthenticatedRequest, res: Response) => {
        this.logger.warn('Rate limit exceeded', {
          path: req.path,
          method: req.method,
          userId: req.user?.id,
          apiKeyId: req.apiKey?.id,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        const error = new TooManyRequestsError('Rate limit exceeded');
        res.status(429).json({
          success: false,
          error: error.message,
          code: error.code,
          limit: rule.max,
          windowMs: rule.windowMs,
          retryAfter: Math.ceil(rule.windowMs / 1000),
          timestamp: Date.now(),
          requestId: req.requestId
        });
      }
    });
  }
}

let rateLimitManager: RateLimitManager;

export function initializeRateLimit(logger: winston.Logger): void {
  rateLimitManager = new RateLimitManager(logger);
}

// Dynamic rate limiting middleware
export function rateLimitMiddleware(config?: RateLimitConfig) {
  return (req: AuthenticatedRequest, res: Response, next: any): void => {
    if (!rateLimitManager) {
      return next();
    }

    const rule = rateLimitManager.getRuleForPath(req.path, req.method);
    
    if (!rule) {
      // Use default rate limiting
      const defaultLimiter = rateLimit({
        windowMs: config?.windowMs || 15 * 60 * 1000,
        max: config?.max || 100,
        standardHeaders: true,
        legacyHeaders: false
      });
      
      return defaultLimiter(req, res, next);
    }

    const limiter = rateLimitManager.createLimiter(rule);
    limiter(req, res, next);
  };
}

// Specific rate limiters
export const tradingRateLimit = (req: AuthenticatedRequest, res: Response, next: any): void => {
  if (!rateLimitManager) {
    return next();
  }

  const rule: RateLimitRule = {
    path: '/api/*/trading/*',
    windowMs: 60 * 1000,
    max: 50,
    skipSuccessfulRequests: false
  };

  const limiter = rateLimitManager.createLimiter(rule);
  limiter(req, res, next);
};

export const marketDataRateLimit = (req: AuthenticatedRequest, res: Response, next: any): void => {
  if (!rateLimitManager) {
    return next();
  }

  const rule: RateLimitRule = {
    path: '/api/*/market-data/*',
    windowMs: 60 * 1000,
    max: 100,
    skipSuccessfulRequests: true
  };

  const limiter = rateLimitManager.createLimiter(rule);
  limiter(req, res, next);
};

export const authRateLimit = (req: AuthenticatedRequest, res: Response, next: any): void => {
  if (!rateLimitManager) {
    return next();
  }

  const rule: RateLimitRule = {
    path: '/api/*/auth/*',
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true
  };

  const limiter = rateLimitManager.createLimiter(rule);
  limiter(req, res, next);
};

// Rate limit status endpoint
export function getRateLimitStatus(req: AuthenticatedRequest): any {
  const keyPrefix = req.user ? `user:${req.user.id}` : req.apiKey ? `api:${req.apiKey.id}` : `ip:${req.ip}`;
  
  return {
    user: keyPrefix,
    limits: {
      general: { windowMs: 15 * 60 * 1000, max: 1000 },
      trading: { windowMs: 60 * 1000, max: 50 },
      marketData: { windowMs: 60 * 1000, max: 100 },
      auth: { windowMs: 15 * 60 * 1000, max: 10 }
    }
  };
}

// Rate limit reset (admin only)
export async function resetRateLimit(userKey: string): Promise<void> {
  if (rateLimitManager && rateLimitManager['redis']) {
    const redis = rateLimitManager['redis'];
    const keys = await redis.keys(`rate_limit:*:${userKey}`);
    
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}

export { RateLimitManager };