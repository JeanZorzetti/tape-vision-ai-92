import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message: string; // Error message
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimitMiddleware {
  private store: RateLimitStore = {};
  private cleanupInterval: NodeJS.Timer;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * General rate limiting
   */
  general = (config: Partial<RateLimitConfig> = {}) => {
    const defaultConfig: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      message: 'Too many requests, please try again later',
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };

    const finalConfig = { ...defaultConfig, ...config };

    return (req: Request, res: Response, next: NextFunction): void => {
      const key = this.generateKey(req, 'general');
      const now = Date.now();
      const windowStart = now - finalConfig.windowMs;

      // Initialize or reset if window expired
      if (!this.store[key] || this.store[key].resetTime < windowStart) {
        this.store[key] = {
          count: 0,
          resetTime: now + finalConfig.windowMs
        };
      }

      this.store[key].count++;

      // Set rate limit headers
      const remaining = Math.max(0, finalConfig.maxRequests - this.store[key].count);
      const resetTime = Math.ceil(this.store[key].resetTime / 1000);

      res.set({
        'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetTime.toString()
      });

      if (this.store[key].count > finalConfig.maxRequests) {
        res.status(429).json({
          success: false,
          error: finalConfig.message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
        });
        return;
      }

      next();
    };
  };

  /**
   * Strict rate limiting for trading operations
   */
  trading = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const config: RateLimitConfig = {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 10, // Maximum 10 trading operations per minute
      message: 'Trading rate limit exceeded. Maximum 10 operations per minute.',
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };

    const key = this.generateKey(req, 'trading');
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Initialize or reset if window expired
    if (!this.store[key] || this.store[key].resetTime < windowStart) {
      this.store[key] = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    this.store[key].count++;

    // Set headers
    const remaining = Math.max(0, config.maxRequests - this.store[key].count);
    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': remaining.toString(),
      'X-RateLimit-Reset': Math.ceil(this.store[key].resetTime / 1000).toString()
    });

    if (this.store[key].count > config.maxRequests) {
      // Log excessive trading attempts
      console.warn(`Trading rate limit exceeded for user: ${req.user?.id} (${req.ip})`);
      
      res.status(429).json({
        success: false,
        error: config.message,
        code: 'TRADING_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
      });
      return;
    }

    next();
  };

  /**
   * API key rate limiting (higher limits for authenticated services)
   */
  apiKey = (req: Request, res: Response, next: NextFunction): void => {
    const config: RateLimitConfig = {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 1000, // 1000 requests per minute for API keys
      message: 'API rate limit exceeded',
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };

    const apiKey = req.headers['x-api-key'] as string;
    const key = `apikey_${apiKey}_${req.ip}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    if (!this.store[key] || this.store[key].resetTime < windowStart) {
      this.store[key] = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    this.store[key].count++;

    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, config.maxRequests - this.store[key].count).toString(),
      'X-RateLimit-Reset': Math.ceil(this.store[key].resetTime / 1000).toString()
    });

    if (this.store[key].count > config.maxRequests) {
      res.status(429).json({
        success: false,
        error: config.message,
        code: 'API_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
      });
      return;
    }

    next();
  };

  /**
   * WebSocket connection rate limiting
   */
  websocket = (req: Request, res: Response, next: NextFunction): void => {
    const config: RateLimitConfig = {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 5, // Maximum 5 WebSocket connections per 5 minutes
      message: 'WebSocket connection rate limit exceeded',
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };

    const key = this.generateKey(req, 'websocket');
    const now = Date.now();
    const windowStart = now - config.windowMs;

    if (!this.store[key] || this.store[key].resetTime < windowStart) {
      this.store[key] = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    this.store[key].count++;

    if (this.store[key].count > config.maxRequests) {
      res.status(429).json({
        success: false,
        error: config.message,
        code: 'WEBSOCKET_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
      });
      return;
    }

    next();
  };

  /**
   * Data query rate limiting (for market data requests)
   */
  dataQuery = (req: Request, res: Response, next: NextFunction): void => {
    const config: RateLimitConfig = {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 60, // 60 queries per minute
      message: 'Data query rate limit exceeded',
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };

    const key = this.generateKey(req, 'dataquery');
    const now = Date.now();
    const windowStart = now - config.windowMs;

    if (!this.store[key] || this.store[key].resetTime < windowStart) {
      this.store[key] = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    this.store[key].count++;

    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, config.maxRequests - this.store[key].count).toString(),
      'X-RateLimit-Reset': Math.ceil(this.store[key].resetTime / 1000).toString()
    });

    if (this.store[key].count > config.maxRequests) {
      res.status(429).json({
        success: false,
        error: config.message,
        code: 'DATA_QUERY_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
      });
      return;
    }

    next();
  };

  /**
   * Machine Learning prediction rate limiting
   */
  mlPrediction = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const config: RateLimitConfig = {
      windowMs: 1 * 60 * 1000, // 1 minute
      maxRequests: 30, // 30 ML predictions per minute
      message: 'ML prediction rate limit exceeded',
      skipSuccessfulRequests: false,
      skipFailedRequests: false
    };

    const key = this.generateKey(req, 'mlprediction');
    const now = Date.now();
    const windowStart = now - config.windowMs;

    if (!this.store[key] || this.store[key].resetTime < windowStart) {
      this.store[key] = {
        count: 0,
        resetTime: now + config.windowMs
      };
    }

    this.store[key].count++;

    res.set({
      'X-RateLimit-Limit': config.maxRequests.toString(),
      'X-RateLimit-Remaining': Math.max(0, config.maxRequests - this.store[key].count).toString(),
      'X-RateLimit-Reset': Math.ceil(this.store[key].resetTime / 1000).toString()
    });

    if (this.store[key].count > config.maxRequests) {
      res.status(429).json({
        success: false,
        error: config.message,
        code: 'ML_PREDICTION_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((this.store[key].resetTime - now) / 1000)
      });
      return;
    }

    next();
  };

  /**
   * Generate unique key for rate limiting
   */
  private generateKey(req: AuthRequest | Request, prefix: string): string {
    const userInfo = 'user' in req && req.user ? req.user.id : 'anonymous';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `${prefix}_${userInfo}_${ip}`;
  }

  /**
   * Clean up expired entries from store
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, value] of Object.entries(this.store)) {
      if (value.resetTime < now) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      delete this.store[key];
    });

    if (keysToDelete.length > 0) {
      console.log(`Rate limit cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Get current rate limit status for a key
   */
  getStatus(req: AuthRequest | Request, type: string): {
    count: number;
    remaining: number;
    resetTime: number;
  } {
    const key = this.generateKey(req, type);
    const entry = this.store[key];

    if (!entry) {
      return { count: 0, remaining: Infinity, resetTime: 0 };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, 100 - entry.count), // Default max of 100
      resetTime: entry.resetTime
    };
  }

  /**
   * Reset rate limit for a specific key (admin function)
   */
  reset(req: AuthRequest | Request, type: string): void {
    const key = this.generateKey(req, type);
    delete this.store[key];
  }

  /**
   * Destroy cleanup interval
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

const rateLimitMiddleware = new RateLimitMiddleware();

export { rateLimitMiddleware, RateLimitConfig };