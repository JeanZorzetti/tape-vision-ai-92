import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'TRADER' | 'ADMIN' | 'VIEWER';
    permissions: string[];
    tradingEnabled: boolean;
  };
}

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  tradingEnabled: boolean;
  iat: number;
  exp: number;
}

class AuthMiddleware {
  private readonly JWT_SECRET = process.env.JWT_SECRET || 'trading-bot-secret-key';
  private readonly JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

  /**
   * Verify JWT token and authenticate user
   */
  authenticate = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Access token required',
          code: 'AUTH_TOKEN_MISSING'
        });
        return;
      }

      const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
      
      // Validate token payload
      if (!decoded.userId || !decoded.email) {
        res.status(401).json({
          success: false,
          error: 'Invalid token payload',
          code: 'AUTH_TOKEN_INVALID'
        });
        return;
      }

      // Check if token is expired (additional check)
      if (decoded.exp < Date.now() / 1000) {
        res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'AUTH_TOKEN_EXPIRED'
        });
        return;
      }

      // Attach user info to request
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        role: decoded.role as 'TRADER' | 'ADMIN' | 'VIEWER',
        permissions: decoded.permissions || [],
        tradingEnabled: decoded.tradingEnabled || false
      };

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          error: 'Invalid token',
          code: 'AUTH_TOKEN_INVALID'
        });
      } else if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          error: 'Token expired',
          code: 'AUTH_TOKEN_EXPIRED'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Authentication error',
          code: 'AUTH_ERROR'
        });
      }
    }
  };

  /**
   * Check if user has required permissions
   */
  requirePermission = (requiredPermissions: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: `Required permissions: ${requiredPermissions.join(', ')}`,
          code: 'AUTH_INSUFFICIENT_PERMISSIONS'
        });
        return;
      }

      next();
    };
  };

  /**
   * Check if user has required role
   */
  requireRole = (requiredRoles: Array<'TRADER' | 'ADMIN' | 'VIEWER'>) => {
    return (req: AuthRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
          code: 'AUTH_REQUIRED'
        });
        return;
      }

      if (!requiredRoles.includes(req.user.role)) {
        res.status(403).json({
          success: false,
          error: `Required roles: ${requiredRoles.join(', ')}`,
          code: 'AUTH_INSUFFICIENT_ROLE'
        });
        return;
      }

      next();
    };
  };

  /**
   * Ensure user has trading enabled
   */
  requireTradingEnabled = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User not authenticated',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    if (!req.user.tradingEnabled) {
      res.status(403).json({
        success: false,
        error: 'Trading not enabled for this user',
        code: 'TRADING_DISABLED'
      });
      return;
    }

    next();
  };

  /**
   * Generate JWT token for user
   */
  generateToken = (user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    tradingEnabled: boolean;
  }): string => {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions,
      tradingEnabled: user.tradingEnabled
    };

    return jwt.sign(payload, this.JWT_SECRET, {
      expiresIn: this.JWT_EXPIRES
    });
  };

  /**
   * Hash password for storage
   */
  hashPassword = async (password: string): Promise<string> => {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  };

  /**
   * Verify password against hash
   */
  verifyPassword = async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
  };

  /**
   * Extract token from request headers
   */
  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check for token in query params (for WebSocket connections)
    const queryToken = req.query.token as string;
    if (queryToken) {
      return queryToken;
    }

    // Check for token in cookies
    const cookieToken = req.cookies?.auth_token;
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Middleware for API key authentication (for external services)
   */
  authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
    const apiKey = req.headers['x-api-key'] as string;
    const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

    if (!apiKey || !validApiKeys.includes(apiKey)) {
      res.status(401).json({
        success: false,
        error: 'Invalid API key',
        code: 'AUTH_INVALID_API_KEY'
      });
      return;
    }

    next();
  };

  /**
   * Optional authentication - doesn't fail if no token
   */
  optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);
      
      if (token) {
        const decoded = jwt.verify(token, this.JWT_SECRET) as JWTPayload;
        req.user = {
          id: decoded.userId,
          email: decoded.email,
          role: decoded.role as 'TRADER' | 'ADMIN' | 'VIEWER',
          permissions: decoded.permissions || [],
          tradingEnabled: decoded.tradingEnabled || false
        };
      }
    } catch (error) {
      // Ignore authentication errors for optional auth
    }
    
    next();
  };
}

const authMiddleware = new AuthMiddleware();

export {
  authMiddleware,
  AuthRequest,
  JWTPayload
};