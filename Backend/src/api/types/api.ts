/**
 * API Type Definitions - Tape Vision Trading System
 * Comprehensive type definitions for API interfaces
 */

import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from 'jsonwebtoken';

// Base API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: number;
  requestId: string;
  version?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Request/Response Enhancement Types
export interface AuthenticatedRequest extends Request {
  user?: UserPayload;
  apiKey?: APIKeyPayload;
  requestId: string;
  startTime: number;
}

export interface UserPayload extends JwtPayload {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  sessionId: string;
}

export interface APIKeyPayload {
  id: string;
  name: string;
  permissions: Permission[];
  rateLimit: {
    requests: number;
    window: number;
  };
}

// User Management Types
export type UserRole = 'admin' | 'trader' | 'analyst' | 'viewer';

export type Permission = 
  | 'trading.read'
  | 'trading.write' 
  | 'trading.execute'
  | 'market_data.read'
  | 'market_data.subscribe'
  | 'risk.read'
  | 'risk.write'
  | 'system.read'
  | 'system.write'
  | 'system.admin'
  | 'users.read'
  | 'users.write'
  | 'analytics.read';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  expiresIn: number;
  user: UserProfile;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
  permissions?: Permission[];
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  permissions?: Permission[];
  isActive?: boolean;
}

// API Configuration Types
export interface APIConfig {
  version: string;
  environment: 'development' | 'production' | 'test';
  cors: {
    origins: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
  };
  auth: {
    jwt: {
      secret: string;
      expiresIn: string;
      refreshExpiresIn: string;
    };
    apiKeys: {
      enabled: boolean;
      headerName: string;
    };
  };
  validation: {
    stripUnknown: boolean;
    abortEarly: boolean;
  };
}

// Trading API Types
export interface PlaceOrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'GTD';
  clientOrderId?: string;
}

export interface PlaceOrderResponse {
  orderId: string;
  clientOrderId?: string;
  status: 'accepted' | 'rejected';
  message?: string;
  executionReport?: OrderExecution;
}

export interface OrderExecution {
  orderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  filledQuantity: number;
  avgPrice: number;
  status: 'new' | 'partially_filled' | 'filled' | 'cancelled' | 'rejected';
  timestamp: number;
  fees: number;
}

export interface PositionSummary {
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  marginUsed: number;
  timestamp: number;
}

// Market Data API Types
export interface MarketDataSubscription {
  symbols: string[];
  channels: ('quotes' | 'trades' | 'orderbook' | 'candles')[];
  depth?: number;
  interval?: string;
}

export interface MarketDataRequest {
  symbol: string;
  interval?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

// Risk Management API Types
export interface RiskLimits {
  maxDailyLoss: number;
  maxPositionSize: number;
  maxDrawdown: number;
  maxOpenPositions: number;
  allowedSymbols: string[];
  tradingHours: {
    start: string;
    end: string;
    timezone: string;
  }[];
}

export interface RiskStatus {
  currentDrawdown: number;
  dailyPnL: number;
  openPositions: number;
  marginUsed: number;
  availableMargin: number;
  riskScore: number;
  violations: RiskViolation[];
}

export interface RiskViolation {
  id: string;
  type: 'daily_loss' | 'position_size' | 'drawdown' | 'margin' | 'hours' | 'symbol';
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  acknowledged: boolean;
}

// System API Types
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'critical';
  uptime: number;
  version: string;
  timestamp: number;
  components: {
    [key: string]: ComponentHealth;
  };
  performance: {
    cpu: number;
    memory: number;
    latency: number;
  };
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'critical' | 'unknown';
  lastCheck: number;
  message?: string;
  metrics?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
  trading: {
    ordersPerSecond: number;
    avgLatency: number;
    errorRate: number;
  };
}

// WebSocket API Types
export interface WSAuthMessage {
  type: 'auth';
  token: string;
}

export interface WSSubscribeMessage {
  type: 'subscribe';
  channel: string;
  params?: Record<string, any>;
}

export interface WSUnsubscribeMessage {
  type: 'unsubscribe';
  channel: string;
}

export interface WSMessage {
  type: string;
  channel?: string;
  data?: any;
  timestamp: number;
  sequence?: number;
}

export interface WSErrorMessage extends WSMessage {
  type: 'error';
  error: {
    code: string;
    message: string;
  };
}

// Validation Types
export interface ValidationSchema {
  [key: string]: any;
}

export interface ValidationError {
  field: string;
  message: string;
  value: any;
}

// Error Types
export interface APIError extends Error {
  code: string;
  statusCode: number;
  details?: any;
}

export class BadRequestError extends Error implements APIError {
  code = 'BAD_REQUEST';
  statusCode = 400;
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'BadRequestError';
  }
}

export class UnauthorizedError extends Error implements APIError {
  code = 'UNAUTHORIZED';
  statusCode = 401;
  constructor(message: string = 'Unauthorized', public details?: any) {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends Error implements APIError {
  code = 'FORBIDDEN';
  statusCode = 403;
  constructor(message: string = 'Forbidden', public details?: any) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class NotFoundError extends Error implements APIError {
  code = 'NOT_FOUND';
  statusCode = 404;
  constructor(message: string = 'Resource not found', public details?: any) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements APIError {
  code = 'CONFLICT';
  statusCode = 409;
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ConflictError';
  }
}

export class TooManyRequestsError extends Error implements APIError {
  code = 'TOO_MANY_REQUESTS';
  statusCode = 429;
  constructor(message: string = 'Too many requests', public details?: any) {
    super(message);
    this.name = 'TooManyRequestsError';
  }
}

export class InternalServerError extends Error implements APIError {
  code = 'INTERNAL_SERVER_ERROR';
  statusCode = 500;
  constructor(message: string = 'Internal server error', public details?: any) {
    super(message);
    this.name = 'InternalServerError';
  }
}

export class ServiceUnavailableError extends Error implements APIError {
  code = 'SERVICE_UNAVAILABLE';
  statusCode = 503;
  constructor(message: string = 'Service unavailable', public details?: any) {
    super(message);
    this.name = 'ServiceUnavailableError';
  }
}

// Middleware Types
export type Middleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => void | Promise<void>;

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request, res: Response) => boolean;
}

// Logging Types
export interface RequestLog {
  requestId: string;
  method: string;
  path: string;
  query: any;
  body: any;
  headers: any;
  ip: string;
  userAgent: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  statusCode?: number;
  responseSize?: number;
  error?: any;
}

// Analytics Types
export interface APIMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    rate: number;
  };
  responses: {
    avg: number;
    p95: number;
    p99: number;
  };
  errors: {
    total: number;
    rate: number;
    byCode: Record<string, number>;
  };
  users: {
    active: number;
    total: number;
  };
}

export interface EndpointMetrics {
  path: string;
  method: string;
  requests: number;
  avgResponseTime: number;
  errorRate: number;
  lastAccessed: number;
}