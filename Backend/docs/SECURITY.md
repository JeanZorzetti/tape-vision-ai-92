# Tape Vision AI - Security Documentation

## Overview

Security is paramount in algorithmic trading systems due to the financial risks and sensitive data involved. This document outlines the comprehensive security measures implemented in the Tape Vision AI trading system, including authentication, data protection, network security, and operational security practices.

## Security Architecture

### Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                 Frontend Security                       │
│  ┌─────────────────────────────────────────────────────┐│
│  │ • HTTPS/WSS • Input Validation • XSS Protection    ││
│  │ • CSRF Tokens • Content Security Policy            ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ Encrypted Communication
┌─────────────────────▼───────────────────────────────────┐
│                 API Security                            │
│  ┌─────────────────────────────────────────────────────┐│
│  │ • JWT Authentication • Rate Limiting • CORS        ││
│  │ • Input Validation • SQL Injection Prevention      ││
│  │ • Request Logging • API Key Management             ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ Secure API Layer
┌─────────────────────▼───────────────────────────────────┐
│              Application Security                       │
│  ┌─────────────────────────────────────────────────────┐│
│  │ • Role-Based Access • Session Management           ││
│  │ • Error Handling • Security Headers                ││
│  │ • Audit Logging • Dependency Scanning             ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ Secure Application
┌─────────────────────▼───────────────────────────────────┐
│              Database Security                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │ • Data Encryption • Access Control • Backup Encryption││
│  │ • Connection Security • Query Monitoring           ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────┘
                      │ Encrypted Storage
┌─────────────────────▼───────────────────────────────────┐
│            Infrastructure Security                      │
│  ┌─────────────────────────────────────────────────────┐│
│  │ • Network Segmentation • Firewall Rules            ││
│  │ • Container Security • OS Hardening                ││
│  │ • Monitoring & Alerting • Incident Response        ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

---

## Authentication and Authorization

### JWT-Based Authentication

The system uses JSON Web Tokens (JWT) for secure authentication:

```typescript
// Authentication Configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET, // 256-bit secret key
  expiresIn: '24h',              // Token expiration
  issuer: 'tape-vision-ai',      // Token issuer
  audience: 'trading-system',    // Token audience
  algorithm: 'HS256'             // Signing algorithm
};

// JWT Token Structure
interface JWTPayload {
  userId: string;
  username: string;
  role: 'admin' | 'trader' | 'viewer';
  permissions: string[];
  iat: number;  // Issued at
  exp: number;  // Expires at
  iss: string;  // Issuer
  aud: string;  // Audience
}
```

### Role-Based Access Control (RBAC)

```typescript
// Role Definitions
enum UserRole {
  ADMIN = 'admin',      // Full system access
  TRADER = 'trader',    // Trading operations
  VIEWER = 'viewer'     // Read-only access
}

// Permission Matrix
const permissions = {
  admin: [
    'system.start',
    'system.stop',
    'system.configure',
    'trading.execute',
    'trading.view',
    'users.manage',
    'logs.view',
    'metrics.view'
  ],
  trader: [
    'trading.execute',
    'trading.view',
    'positions.manage',
    'alerts.view'
  ],
  viewer: [
    'trading.view',
    'metrics.view',
    'alerts.view'
  ]
};

// Middleware Implementation
function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    
    if (!user || !user.permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        required: permission
      });
    }
    
    next();
  };
}
```

### API Key Authentication

For service-to-service communication:

```typescript
// API Key Configuration
interface APIKey {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  createdAt: Date;
  expiresAt?: Date;
  rateLimit: {
    requests: number;
    window: number; // in seconds
  };
}

// API Key Validation Middleware
async function validateAPIKey(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required'
    });
  }
  
  try {
    const keyData = await validateAPIKeyAsync(apiKey);
    
    if (!keyData || (keyData.expiresAt && keyData.expiresAt < new Date())) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired API key'
      });
    }
    
    // Check rate limits
    const rateLimitCheck = await checkRateLimit(keyData);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        resetTime: rateLimitCheck.resetTime
      });
    }
    
    req.apiKey = keyData;
    next();
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Authentication service error'
    });
  }
}
```

---

## Data Protection

### Encryption at Rest

All sensitive data is encrypted using AES-256:

```typescript
import crypto from 'crypto';

class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16;  // 128 bits
  
  constructor(private secretKey: string) {
    // Derive encryption key from secret
    this.key = crypto.scryptSync(secretKey, 'salt', this.keyLength);
  }
  
  encrypt(data: string): EncryptedData {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }
  
  decrypt(encryptedData: EncryptedData): string {
    const decipher = crypto.createDecipher(
      this.algorithm,
      this.key,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// Usage for sensitive configuration
class SecureConfig {
  private encryption: EncryptionService;
  
  constructor(secretKey: string) {
    this.encryption = new EncryptionService(secretKey);
  }
  
  encryptSensitiveData(data: any): string {
    const jsonData = JSON.stringify(data);
    const encrypted = this.encryption.encrypt(jsonData);
    return JSON.stringify(encrypted);
  }
  
  decryptSensitiveData(encryptedString: string): any {
    const encryptedData = JSON.parse(encryptedString);
    const decrypted = this.encryption.decrypt(encryptedData);
    return JSON.parse(decrypted);
  }
}
```

### Encryption in Transit

All communication is secured using TLS/SSL:

#### HTTPS Configuration

```typescript
import https from 'https';
import fs from 'fs';

// SSL Certificate Configuration
const sslOptions = {
  key: fs.readFileSync(process.env.SSL_KEY_PATH),
  cert: fs.readFileSync(process.env.SSL_CERT_PATH),
  ca: fs.readFileSync(process.env.SSL_CA_PATH), // Certificate Authority
  
  // Security Options
  ciphers: [
    'ECDHE-RSA-AES128-GCM-SHA256',
    'ECDHE-RSA-AES256-GCM-SHA384',
    'ECDHE-RSA-AES128-SHA256',
    'ECDHE-RSA-AES256-SHA384'
  ].join(':'),
  
  honorCipherOrder: true,
  secureProtocol: 'TLSv1_2_method',
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3'
};

// Create HTTPS server
const server = https.createServer(sslOptions, app);
```

#### WebSocket Secure (WSS) Configuration

```typescript
import { Server as SocketIOServer } from 'socket.io';

const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true
  },
  
  // Use WSS in production
  transports: process.env.NODE_ENV === 'production' 
    ? ['websocket'] 
    : ['polling', 'websocket'],
    
  // Security options
  allowEIO3: false, // Disable Engine.IO v3 support
  pingTimeout: 60000,
  pingInterval: 25000
});
```

### Sensitive Data Handling

```typescript
// Secure configuration management
class SecretManager {
  private static secrets: Map<string, string> = new Map();
  
  static setSecret(key: string, value: string): void {
    // Store encrypted in memory
    const encrypted = this.encrypt(value);
    this.secrets.set(key, encrypted);
    
    // Clear original value from memory
    value = '';
  }
  
  static getSecret(key: string): string {
    const encrypted = this.secrets.get(key);
    if (!encrypted) {
      throw new Error(`Secret ${key} not found`);
    }
    
    return this.decrypt(encrypted);
  }
  
  static clearSecrets(): void {
    this.secrets.clear();
  }
  
  private static encrypt(data: string): string {
    // Implementation using crypto
  }
  
  private static decrypt(data: string): string {
    // Implementation using crypto
  }
}
```

---

## Input Validation and Sanitization

### Request Validation

```typescript
import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Trading request validation schema
const tradeExecutionSchema = Joi.object({
  action: Joi.string().valid('BUY', 'SELL').required(),
  symbol: Joi.string().alphanum().min(2).max(10).required(),
  quantity: Joi.number().integer().min(1).max(100).required(),
  price: Joi.number().positive().precision(4).optional(),
  reason: Joi.string().min(5).max(500).required(),
  confidence: Joi.number().min(0).max(100).optional()
});

// Validation middleware
function validateTradeExecution(req: Request, res: Response, next: NextFunction) {
  const { error, value } = tradeExecutionSchema.validate(req.body);
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid request data',
      details: error.details.map(detail => detail.message),
      timestamp: Date.now()
    });
  }
  
  // Replace request body with validated data
  req.body = value;
  next();
}

// SQL Injection Prevention
import { MongoClient, MongoClientOptions } from 'mongodb';

class SecureDatabase {
  // Always use parameterized queries
  async findTrades(filters: TradeFilters): Promise<Trade[]> {
    const query = {
      symbol: { $eq: filters.symbol }, // Exact match only
      timestamp: {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate)
      },
      // Never use dynamic query construction
      ...(filters.action && { action: { $eq: filters.action } })
    };
    
    return this.collection.find(query).toArray();
  }
  
  // Input sanitization for text fields
  sanitizeText(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/['"]/g, '')  // Remove quotes
      .trim()
      .substring(0, 500);    // Limit length
  }
}
```

### XSS Prevention

```typescript
import helmet from 'helmet';
import { escape } from 'html-escaper';

// Content Security Policy
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// HTML escaping for dynamic content
function sanitizeForHTML(data: any): any {
  if (typeof data === 'string') {
    return escape(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(sanitizeForHTML);
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeForHTML(value);
    }
    return sanitized;
  }
  
  return data;
}
```

---

## Rate Limiting and DDoS Protection

### API Rate Limiting

```typescript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';

// Redis connection for rate limiting
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD
});

// Different rate limits for different endpoints
const createRateLimit = (options: {
  windowMs: number;
  max: number;
  message: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    store: new RedisStore({
      sendCommand: (...args: string[]) => redis.call(...args),
    }),
    windowMs: options.windowMs,
    max: options.max,
    message: {
      success: false,
      error: options.message,
      timestamp: Date.now()
    },
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    
    // Custom key generator (include user ID if authenticated)
    keyGenerator: (req: Request) => {
      return req.user?.id || req.ip;
    },
    
    // Custom handler for rate limit exceeded
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path,
        method: req.method
      });
      
      res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.round(options.windowMs / 1000),
        timestamp: Date.now()
      });
    }
  });
};

// Apply rate limits
app.use('/api/trading/execute', createRateLimit({
  windowMs: 60000,  // 1 minute
  max: 10,          // 10 trades per minute
  message: 'Too many trade requests'
}));

app.use('/api/', createRateLimit({
  windowMs: 900000, // 15 minutes
  max: 1000,        // 1000 requests per 15 minutes
  message: 'Too many API requests',
  skipSuccessfulRequests: true
}));
```

### WebSocket Rate Limiting

```typescript
import { Socket } from 'socket.io';

interface SocketRateLimit {
  messages: number;
  resetTime: number;
}

class WebSocketRateLimiter {
  private limits = new Map<string, SocketRateLimit>();
  private readonly maxMessages = 100;
  private readonly windowMs = 60000; // 1 minute
  
  checkLimit(socket: Socket): boolean {
    const clientId = this.getClientId(socket);
    const now = Date.now();
    
    let limit = this.limits.get(clientId);
    
    if (!limit || now > limit.resetTime) {
      // Reset or create new limit
      limit = {
        messages: 0,
        resetTime: now + this.windowMs
      };
      this.limits.set(clientId, limit);
    }
    
    limit.messages++;
    
    if (limit.messages > this.maxMessages) {
      // Rate limit exceeded
      socket.emit('rate-limit-exceeded', {
        resetTime: limit.resetTime,
        maxMessages: this.maxMessages
      });
      
      return false;
    }
    
    return true;
  }
  
  private getClientId(socket: Socket): string {
    // Use authenticated user ID or IP address
    return socket.data.userId || socket.handshake.address;
  }
}
```

---

## Security Headers

### HTTP Security Headers

```typescript
import helmet from 'helmet';

app.use(helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  
  // X-Frame-Options
  frameguard: { action: 'deny' },
  
  // X-Content-Type-Options
  noSniff: true,
  
  // X-XSS-Protection
  xssFilter: true,
  
  // Referrer Policy
  referrerPolicy: { policy: 'no-referrer' },
  
  // Cross-Origin Policies
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Custom security headers
app.use((req: Request, res: Response, next: NextFunction) => {
  // Remove server information
  res.removeHeader('X-Powered-By');
  
  // Add custom headers
  res.setHeader('X-API-Version', process.env.API_VERSION || '1.0');
  res.setHeader('X-Request-ID', req.headers['x-request-id'] || 'unknown');
  
  next();
});
```

---

## Audit Logging and Monitoring

### Security Event Logging

```typescript
import winston from 'winston';

class SecurityLogger {
  private logger: winston.Logger;
  
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({
          filename: 'logs/security-audit.log',
          maxsize: 10485760, // 10MB
          maxFiles: 10
        }),
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }
  
  logAuthAttempt(event: AuthEvent): void {
    this.logger.info('Authentication attempt', {
      type: 'auth_attempt',
      userId: event.userId,
      username: event.username,
      success: event.success,
      ip: event.ip,
      userAgent: event.userAgent,
      timestamp: new Date().toISOString(),
      failureReason: event.failureReason
    });
  }
  
  logPrivilegedAction(event: PrivilegedActionEvent): void {
    this.logger.warn('Privileged action', {
      type: 'privileged_action',
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      success: event.success,
      ip: event.ip,
      timestamp: new Date().toISOString(),
      additionalData: event.additionalData
    });
  }
  
  logSecurityIncident(event: SecurityIncidentEvent): void {
    this.logger.error('Security incident', {
      type: 'security_incident',
      incidentType: event.incidentType,
      severity: event.severity,
      description: event.description,
      ip: event.ip,
      userAgent: event.userAgent,
      timestamp: new Date().toISOString(),
      additionalData: event.additionalData
    });
  }
  
  logDataAccess(event: DataAccessEvent): void {
    this.logger.info('Data access', {
      type: 'data_access',
      userId: event.userId,
      resource: event.resource,
      action: event.action, // read, write, delete
      success: event.success,
      timestamp: new Date().toISOString(),
      recordCount: event.recordCount
    });
  }
}

// Usage throughout the application
const securityLogger = new SecurityLogger();

// Authentication middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  // Log all authentication attempts
  if (req.path.includes('/auth/')) {
    securityLogger.logAuthAttempt({
      userId: req.body.userId,
      username: req.body.username,
      success: false, // Will be updated in auth handler
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
  }
  
  next();
});
```

### Intrusion Detection

```typescript
class IntrusionDetectionSystem {
  private suspiciousActivityTracker = new Map<string, SuspiciousActivity>();
  
  checkSuspiciousActivity(req: Request): boolean {
    const clientId = req.ip;
    const activity = this.suspiciousActivityTracker.get(clientId) || {
      failedLogins: 0,
      invalidRequests: 0,
      lastActivity: Date.now(),
      blocked: false
    };
    
    // Check for brute force attacks
    if (this.isBruteForceAttempt(req, activity)) {
      this.blockClient(clientId, 'brute_force_attempt');
      return false;
    }
    
    // Check for suspicious patterns
    if (this.hasSuspiciousPatterns(req, activity)) {
      this.flagForReview(clientId, req);
    }
    
    this.suspiciousActivityTracker.set(clientId, activity);
    return !activity.blocked;
  }
  
  private isBruteForceAttempt(req: Request, activity: SuspiciousActivity): boolean {
    if (req.path.includes('/auth/') && req.method === 'POST') {
      const timeDiff = Date.now() - activity.lastActivity;
      
      // More than 5 failed logins in 5 minutes
      if (timeDiff < 300000 && activity.failedLogins > 5) {
        return true;
      }
    }
    
    return false;
  }
  
  private blockClient(clientId: string, reason: string): void {
    const activity = this.suspiciousActivityTracker.get(clientId);
    if (activity) {
      activity.blocked = true;
      activity.blockReason = reason;
      activity.blockTime = Date.now();
    }
    
    // Log security incident
    securityLogger.logSecurityIncident({
      incidentType: 'client_blocked',
      severity: 'high',
      description: `Client blocked for ${reason}`,
      ip: clientId,
      additionalData: { activity }
    });
  }
}
```

---

## Database Security

### MongoDB Security Configuration

```typescript
// Secure MongoDB connection
const mongoOptions: MongoClientOptions = {
  // Authentication
  auth: {
    username: process.env.MONGODB_USERNAME,
    password: process.env.MONGODB_PASSWORD
  },
  authSource: 'admin',
  
  // SSL/TLS
  ssl: process.env.NODE_ENV === 'production',
  sslValidate: true,
  sslCA: process.env.MONGODB_SSL_CA,
  
  // Connection security
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
  // Connection limits
  maxPoolSize: 10,
  minPoolSize: 2,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  
  // Monitoring
  monitorCommands: true
};

// Query security
class SecureDatabaseAccess {
  // Prevent NoSQL injection
  sanitizeQuery(query: any): any {
    if (typeof query !== 'object' || query === null) {
      return query;
    }
    
    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(query)) {
      // Block dangerous operators
      if (key.startsWith('$') && !this.isAllowedOperator(key)) {
        continue;
      }
      
      // Recursively sanitize nested objects
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeQuery(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }
  
  private isAllowedOperator(operator: string): boolean {
    const allowedOperators = [
      '$eq', '$ne', '$gt', '$gte', '$lt', '$lte',
      '$in', '$nin', '$exists', '$type', '$regex',
      '$and', '$or', '$not', '$nor'
    ];
    
    return allowedOperators.includes(operator);
  }
}
```

### Redis Security

```typescript
// Secure Redis configuration
const redisOptions = {
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  
  // TLS encryption
  tls: process.env.NODE_ENV === 'production' ? {
    checkServerIdentity: () => undefined,
  } : undefined,
  
  // Connection security
  connectTimeout: 10000,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  
  // Key prefix for namespace isolation
  keyPrefix: 'tape-vision:',
  
  // Command monitoring
  showFriendlyErrorStack: true
};

// Secure key management
class SecureRedisClient {
  constructor(private client: Redis) {}
  
  async set(key: string, value: any, ttl?: number): Promise<void> {
    // Sanitize key name
    const sanitizedKey = this.sanitizeKey(key);
    
    // Encrypt sensitive data
    const encryptedValue = await this.encryptIfSensitive(value);
    
    if (ttl) {
      await this.client.setex(sanitizedKey, ttl, encryptedValue);
    } else {
      await this.client.set(sanitizedKey, encryptedValue);
    }
  }
  
  async get(key: string): Promise<any> {
    const sanitizedKey = this.sanitizeKey(key);
    const value = await this.client.get(sanitizedKey);
    
    return value ? this.decryptIfSensitive(value) : null;
  }
  
  private sanitizeKey(key: string): string {
    // Remove potentially dangerous characters
    return key.replace(/[^\w\-:]/g, '');
  }
}
```

---

## Container Security

### Docker Security Configuration

```dockerfile
# Use specific version, not latest
FROM node:18.17.0-alpine

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Install security updates
RUN apk add --no-cache dumb-init && \
    apk upgrade

# Set working directory
WORKDIR /app

# Copy package files with proper ownership
COPY --chown=nodejs:nodejs package*.json ./

# Install dependencies with security audit
RUN npm ci --only=production && \
    npm audit fix && \
    npm cache clean --force

# Copy application files
COPY --chown=nodejs:nodejs . .

# Remove unnecessary files
RUN rm -rf tests/ docs/ .git/ *.md

# Use non-root user
USER nodejs

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Start application
CMD ["node", "dist/server.js"]
```

### Docker Compose Security

```yaml
version: '3.8'

services:
  app:
    build: .
    # Run as non-root user
    user: "1001:1001"
    
    # Security options
    security_opt:
      - no-new-privileges:true
    
    # Read-only root filesystem
    read_only: true
    
    # Temporary filesystem for writable directories
    tmpfs:
      - /tmp:rw,size=100M
      - /app/logs:rw,size=500M
    
    # Resource limits
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
    
    # Network security
    networks:
      - app-network
    
    # Environment variables from secrets
    secrets:
      - jwt_secret
      - db_password
    environment:
      - JWT_SECRET_FILE=/run/secrets/jwt_secret
      - DB_PASSWORD_FILE=/run/secrets/db_password

networks:
  app-network:
    driver: bridge
    internal: true

secrets:
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  db_password:
    file: ./secrets/db_password.txt
```

---

## Security Monitoring and Alerting

### Real-time Security Monitoring

```typescript
class SecurityMonitor {
  private alertThresholds = {
    failedLoginAttempts: 5,
    suspiciousRequests: 20,
    rateLimitHits: 50,
    errorRate: 10 // percentage
  };
  
  private metrics = new Map<string, SecurityMetric>();
  
  trackSecurityEvent(event: SecurityEvent): void {
    const metric = this.getOrCreateMetric(event.type);
    metric.count++;
    metric.lastOccurrence = Date.now();
    
    // Check if threshold is exceeded
    if (this.isThresholdExceeded(event.type, metric)) {
      this.triggerSecurityAlert(event.type, metric);
    }
  }
  
  private isThresholdExceeded(eventType: string, metric: SecurityMetric): boolean {
    const threshold = this.alertThresholds[eventType as keyof typeof this.alertThresholds];
    
    if (!threshold) return false;
    
    // Check if threshold exceeded in the last hour
    const oneHourAgo = Date.now() - 3600000;
    const recentCount = metric.timeline.filter(t => t > oneHourAgo).length;
    
    return recentCount >= threshold;
  }
  
  private async triggerSecurityAlert(eventType: string, metric: SecurityMetric): Promise<void> {
    const alert = {
      type: 'security_alert',
      eventType,
      count: metric.count,
      severity: this.calculateSeverity(eventType, metric),
      timestamp: new Date().toISOString(),
      message: `Security threshold exceeded for ${eventType}`
    };
    
    // Log critical alert
    securityLogger.logSecurityIncident({
      incidentType: 'threshold_exceeded',
      severity: alert.severity,
      description: alert.message,
      additionalData: { metric, eventType }
    });
    
    // Send notification
    await this.sendAlert(alert);
  }
  
  private async sendAlert(alert: SecurityAlert): Promise<void> {
    // Email notification
    await this.sendEmailAlert(alert);
    
    // Slack notification
    await this.sendSlackAlert(alert);
    
    // Webhook notification
    await this.sendWebhookAlert(alert);
  }
}
```

### Vulnerability Scanning

```typescript
// Automated dependency scanning
class VulnerabilityScanner {
  async scanDependencies(): Promise<VulnerabilityReport> {
    const { execSync } = require('child_process');
    
    try {
      // Run npm audit
      const auditResult = execSync('npm audit --json', { encoding: 'utf-8' });
      const auditData = JSON.parse(auditResult);
      
      // Run additional security checks
      const securityReport = await this.performSecurityChecks();
      
      return {
        timestamp: new Date().toISOString(),
        vulnerabilities: this.processAuditData(auditData),
        securityChecks: securityReport,
        recommendations: this.generateRecommendations(auditData, securityReport)
      };
      
    } catch (error) {
      console.error('Vulnerability scan failed:', error);
      throw error;
    }
  }
  
  private async performSecurityChecks(): Promise<SecurityCheck[]> {
    const checks: SecurityCheck[] = [];
    
    // Check for weak configurations
    checks.push(await this.checkConfigurationSecurity());
    
    // Check for exposed secrets
    checks.push(await this.checkForExposedSecrets());
    
    // Check SSL/TLS configuration
    checks.push(await this.checkSSLConfiguration());
    
    return checks;
  }
}

// Scheduled vulnerability scanning
import cron from 'node-cron';

cron.schedule('0 2 * * *', async () => {
  const scanner = new VulnerabilityScanner();
  
  try {
    const report = await scanner.scanDependencies();
    
    if (report.vulnerabilities.length > 0) {
      // Send alert for critical vulnerabilities
      await notifySecurityTeam(report);
    }
    
    // Store report for tracking
    await storeVulnerabilityReport(report);
    
  } catch (error) {
    console.error('Scheduled vulnerability scan failed:', error);
  }
});
```

---

## Incident Response

### Security Incident Response Plan

```typescript
enum IncidentSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

interface SecurityIncident {
  id: string;
  type: string;
  severity: IncidentSeverity;
  description: string;
  timestamp: Date;
  affectedSystems: string[];
  status: 'detected' | 'investigating' | 'contained' | 'resolved';
  responder?: string;
  actions: IncidentAction[];
}

class IncidentResponseSystem {
  private activeIncidents = new Map<string, SecurityIncident>();
  
  async reportIncident(incident: Partial<SecurityIncident>): Promise<string> {
    const incidentId = this.generateIncidentId();
    
    const fullIncident: SecurityIncident = {
      id: incidentId,
      timestamp: new Date(),
      status: 'detected',
      actions: [],
      ...incident
    } as SecurityIncident;
    
    this.activeIncidents.set(incidentId, fullIncident);
    
    // Trigger automated response
    await this.triggerAutomatedResponse(fullIncident);
    
    // Notify security team
    await this.notifySecurityTeam(fullIncident);
    
    return incidentId;
  }
  
  private async triggerAutomatedResponse(incident: SecurityIncident): Promise<void> {
    switch (incident.severity) {
      case IncidentSeverity.CRITICAL:
        // Immediate lockdown
        await this.emergencyLockdown(incident);
        break;
        
      case IncidentSeverity.HIGH:
        // Block suspicious IPs
        await this.blockSuspiciousIPs(incident);
        break;
        
      case IncidentSeverity.MEDIUM:
        // Increase monitoring
        await this.increasedMonitoring(incident);
        break;
        
      case IncidentSeverity.LOW:
        // Log and monitor
        await this.logAndMonitor(incident);
        break;
    }
  }
  
  private async emergencyLockdown(incident: SecurityIncident): Promise<void> {
    // Stop trading operations
    await this.stopTradingEngine();
    
    // Disable API access
    await this.disableAPIAccess();
    
    // Isolate affected systems
    await this.isolateAffectedSystems(incident.affectedSystems);
    
    // Record actions
    this.recordAction(incident.id, 'emergency_lockdown', 'System locked down due to critical security incident');
  }
  
  private recordAction(incidentId: string, actionType: string, description: string): void {
    const incident = this.activeIncidents.get(incidentId);
    if (incident) {
      incident.actions.push({
        timestamp: new Date(),
        type: actionType,
        description,
        automated: true
      });
    }
  }
}
```

---

## Security Best Practices

### Development Security Guidelines

1. **Secure Coding Practices**
   - Always validate input data
   - Use parameterized queries
   - Implement proper error handling
   - Never log sensitive information
   - Use secure random number generation

2. **Authentication and Authorization**
   - Implement strong password policies
   - Use multi-factor authentication
   - Implement session timeout
   - Regular access reviews
   - Principle of least privilege

3. **Data Protection**
   - Encrypt sensitive data at rest
   - Use HTTPS/WSS for data in transit
   - Implement proper key management
   - Regular security audits
   - Data loss prevention measures

4. **Infrastructure Security**
   - Keep systems updated
   - Use firewalls and network segmentation
   - Implement intrusion detection
   - Regular vulnerability assessments
   - Backup and disaster recovery plans

### Security Checklist

#### Pre-deployment Security Checklist

- [ ] All dependencies scanned for vulnerabilities
- [ ] Security headers configured
- [ ] HTTPS/WSS enabled
- [ ] Rate limiting implemented
- [ ] Input validation in place
- [ ] Authentication mechanisms tested
- [ ] Audit logging configured
- [ ] Error handling implemented
- [ ] Secrets management configured
- [ ] Database security hardened

#### Regular Security Maintenance

- [ ] Weekly vulnerability scans
- [ ] Monthly security updates
- [ ] Quarterly access reviews
- [ ] Annual penetration testing
- [ ] Incident response plan testing
- [ ] Security awareness training
- [ ] Log analysis and monitoring
- [ ] Backup testing
- [ ] SSL certificate renewals
- [ ] Security policy updates

---

This security documentation provides comprehensive coverage of the security measures implemented in the Tape Vision AI trading system. Regular review and updates of these security measures are essential to maintain the system's security posture against evolving threats.