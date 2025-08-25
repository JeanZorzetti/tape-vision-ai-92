/**
 * Authentication Middleware - Tape Vision Trading System
 * JWT and API Key authentication with role-based access control
 */

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, UserPayload, APIKeyPayload, Permission, UnauthorizedError, ForbiddenError } from '../types/api';
import winston from 'winston';

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  apiKeyHeader: string;
}

interface APIKey {
  id: string;
  key: string;
  name: string;
  permissions: Permission[];
  rateLimit: {
    requests: number;
    window: number;
  };
  isActive: boolean;
  lastUsed?: Date;
}

class AuthenticationService {
  private config: AuthConfig;
  private logger: winston.Logger;
  private apiKeys: Map<string, APIKey> = new Map();

  constructor(config: AuthConfig, logger: winston.Logger) {
    this.config = config;
    this.logger = logger;
    this.loadAPIKeys();
  }

  private loadAPIKeys(): void {
    // In production, load from database
    // For now, we'll use environment variables or configuration
    const apiKeysConfig = process.env.API_KEYS ? JSON.parse(process.env.API_KEYS) : [];
    
    apiKeysConfig.forEach((keyConfig: any) => {
      this.apiKeys.set(keyConfig.key, {
        id: keyConfig.id,
        key: keyConfig.key,
        name: keyConfig.name,
        permissions: keyConfig.permissions || [],
        rateLimit: keyConfig.rateLimit || { requests: 1000, window: 3600000 },
        isActive: keyConfig.isActive !== false
      });
    });

    this.logger.info(`Loaded ${this.apiKeys.size} API keys`);
  }

  public verifyJWT(token: string): UserPayload {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret) as UserPayload;
      
      // Check if token is expired
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        throw new UnauthorizedError('Token expired');
      }

      return decoded;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid token');
      }
      throw error;
    }
  }

  public verifyAPIKey(key: string): APIKeyPayload {
    const apiKey = this.apiKeys.get(key);
    
    if (!apiKey || !apiKey.isActive) {
      throw new UnauthorizedError('Invalid or inactive API key');
    }

    // Update last used
    apiKey.lastUsed = new Date();

    return {
      id: apiKey.id,
      name: apiKey.name,
      permissions: apiKey.permissions,
      rateLimit: apiKey.rateLimit
    };
  }

  public hasPermission(userPermissions: Permission[], requiredPermissions: Permission[]): boolean {
    if (userPermissions.includes('system.admin' as Permission)) {
      return true; // Admin has all permissions
    }

    return requiredPermissions.some(permission => userPermissions.includes(permission));
  }
}

// Initialize authentication service
let authService: AuthenticationService;

export function initializeAuthService(logger: winston.Logger): void {
  const config: AuthConfig = {
    jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    apiKeyHeader: process.env.API_KEY_HEADER || 'x-api-key'
  };

  authService = new AuthenticationService(config, logger);
}

// Main authentication middleware
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'] as string;

    let isAuthenticated = false;

    // Try JWT authentication first
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const userPayload = authService.verifyJWT(token);
        req.user = userPayload;
        isAuthenticated = true;
        
        req.logger?.debug('JWT authentication successful', {
          userId: userPayload.id,
          username: userPayload.username
        });
      } catch (error) {
        req.logger?.warn('JWT authentication failed', { error: error.message });
      }
    }

    // Try API key authentication if JWT failed
    if (!isAuthenticated && apiKeyHeader) {
      try {
        const apiKeyPayload = authService.verifyAPIKey(apiKeyHeader);
        req.apiKey = apiKeyPayload;
        isAuthenticated = true;
        
        req.logger?.debug('API key authentication successful', {
          keyId: apiKeyPayload.id,
          keyName: apiKeyPayload.name
        });
      } catch (error) {
        req.logger?.warn('API key authentication failed', { error: error.message });
      }
    }

    if (!isAuthenticated) {
      throw new UnauthorizedError('Authentication required');
    }

    next();
  } catch (error) {
    next(error);
  }
}

// Permission-based authorization middleware
export function requirePermissions(requiredPermissions: Permission[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      let userPermissions: Permission[] = [];

      if (req.user) {
        userPermissions = req.user.permissions || [];
      } else if (req.apiKey) {
        userPermissions = req.apiKey.permissions || [];
      }

      if (!authService.hasPermission(userPermissions, requiredPermissions)) {
        throw new ForbiddenError(`Insufficient permissions. Required: ${requiredPermissions.join(', ')}`);
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// Optional authentication middleware (doesn't fail if no auth)
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    authMiddleware(req, res, (error) => {
      // Ignore authentication errors for optional auth
      if (error && (error instanceof UnauthorizedError)) {
        return next();
      }
      next(error);
    });
  } catch (error) {
    next();
  }
}

// Trading-specific authorization
export function requireTradingAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requirePermissions(['trading.read', 'trading.write'])(req, res, next);
}

export function requireTradingExecution(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requirePermissions(['trading.execute'])(req, res, next);
}

export function requireMarketDataAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requirePermissions(['market_data.read'])(req, res, next);
}

export function requireRiskAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requirePermissions(['risk.read'])(req, res, next);
}

export function requireSystemAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requirePermissions(['system.read'])(req, res, next);
}

export function requireAdminAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  requirePermissions(['system.admin'])(req, res, next);
}

// JWT utility functions
export function generateToken(payload: Partial<UserPayload>): string {
  if (!authService) {
    throw new Error('Auth service not initialized');
  }

  return jwt.sign(payload, process.env.JWT_SECRET || 'default-secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: 'tape-vision-trading',
    audience: 'trading-api'
  });
}

export function generateRefreshToken(payload: Partial<UserPayload>): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || 'default-refresh-secret', {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: 'tape-vision-trading',
    audience: 'trading-api'
  });
}

export function verifyRefreshToken(token: string): UserPayload {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'default-refresh-secret') as UserPayload;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid refresh token');
    }
    throw error;
  }
}

// Session management
const activeSessions = new Map<string, {
  userId: string;
  sessionId: string;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}>();

export function createSession(userId: string, ipAddress: string, userAgent: string): string {
  const sessionId = jwt.sign({ userId, type: 'session' }, process.env.JWT_SECRET || 'default-secret');
  
  activeSessions.set(sessionId, {
    userId,
    sessionId,
    lastActivity: new Date(),
    ipAddress,
    userAgent
  });

  return sessionId;
}

export function validateSession(sessionId: string): boolean {
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return false;
  }

  // Update last activity
  session.lastActivity = new Date();
  return true;
}

export function removeSession(sessionId: string): void {
  activeSessions.delete(sessionId);
}

export function getActiveSessions(): Array<{
  userId: string;
  sessionId: string;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}> {
  return Array.from(activeSessions.values());
}

// Cleanup expired sessions
setInterval(() => {
  const now = new Date();
  const expiredSessions: string[] = [];

  for (const [sessionId, session] of activeSessions) {
    const timeDiff = now.getTime() - session.lastActivity.getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (timeDiff > maxAge) {
      expiredSessions.push(sessionId);
    }
  }

  expiredSessions.forEach(sessionId => {
    activeSessions.delete(sessionId);
  });

  if (expiredSessions.length > 0) {
    console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
  }
}, 60 * 60 * 1000); // Run every hour