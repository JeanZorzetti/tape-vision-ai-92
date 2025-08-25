/**
 * API Entry Point - Tape Vision Trading System
 * Centralizes all API routes and middleware configuration
 */

import express, { Router } from 'express';
import winston from 'winston';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

// Import middleware
import { authMiddleware } from './middleware/auth';
import { validationMiddleware } from './middleware/validation';
import { rateLimitMiddleware } from './middleware/rateLimit';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { responseFormatter } from './middleware/responseFormatter';

// Import controllers
import { TradingController } from './controllers/TradingController';
import { MarketDataController } from './controllers/MarketDataController';
import { RiskController } from './controllers/RiskController';
import { SystemController } from './controllers/SystemController';
import { AuthController } from './controllers/AuthController';
import { UserController } from './controllers/UserController';

// Import routes
import { createTradingRoutes } from './routes/trading';
import { createMarketDataRoutes } from './routes/marketData';
import { createRiskRoutes } from './routes/risk';
import { createSystemRoutes } from './routes/system';
import { createAuthRoutes } from './routes/auth';
import { createUserRoutes } from './routes/user';
import { createWebSocketRoutes } from './routes/websocket';

// Import WebSocket handlers
import { WebSocketHandlers } from './websocket/handlers';

// Types
import { APIConfig } from './types/api';
import { TradingEngine } from '../core/trading/TradingEngine';
import { DatabaseManager } from '../database/DatabaseManager';
import { NelogicaService } from '../services/nelogica/NelogicaService';
import { WebSocketManager } from '../websocket/WebSocketManager';

export interface APIContext {
  tradingEngine: TradingEngine;
  databaseManager: DatabaseManager;
  nelogicaService: NelogicaService;
  webSocketManager: WebSocketManager;
  logger: winston.Logger;
}

export class TradingAPI {
  private app: express.Application;
  private config: APIConfig;
  private context: APIContext;
  
  // Controllers
  private tradingController!: TradingController;
  private marketDataController!: MarketDataController;
  private riskController!: RiskController;
  private systemController!: SystemController;
  private authController!: AuthController;
  private userController!: UserController;
  
  // WebSocket handlers
  private webSocketHandlers!: WebSocketHandlers;

  constructor(app: express.Application, config: APIConfig, context: APIContext) {
    this.app = app;
    this.config = config;
    this.context = context;
    
    this.initializeControllers();
    this.initializeWebSocketHandlers();
  }

  private initializeControllers(): void {
    this.tradingController = new TradingController(this.context);
    this.marketDataController = new MarketDataController(this.context);
    this.riskController = new RiskController(this.context);
    this.systemController = new SystemController(this.context);
    this.authController = new AuthController(this.context);
    this.userController = new UserController(this.context);
  }

  private initializeWebSocketHandlers(): void {
    this.webSocketHandlers = new WebSocketHandlers(this.context);
  }

  public setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    }));

    // CORS configuration for API
    this.app.use('/api', cors({
      origin: this.config.cors.origins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-API-Key', 
        'X-Request-ID',
        'X-Client-Version'
      ]
    }));

    // Compression
    this.app.use(compression());

    // Request parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware
    this.app.use('/api', requestLogger(this.context.logger));
    this.app.use('/api', responseFormatter());
    this.app.use('/api', rateLimitMiddleware(this.config.rateLimit));
  }

  public setupRoutes(): void {
    const apiRouter = Router();

    // Health check (no auth required)
    apiRouter.get('/health', this.systemController.getHealth.bind(this.systemController));

    // Public routes (no auth required)
    apiRouter.use('/auth', createAuthRoutes(this.authController));

    // Protected routes (require authentication)
    apiRouter.use('/trading', authMiddleware, createTradingRoutes(this.tradingController));
    apiRouter.use('/market-data', authMiddleware, createMarketDataRoutes(this.marketDataController));
    apiRouter.use('/risk', authMiddleware, createRiskRoutes(this.riskController));
    apiRouter.use('/system', authMiddleware, createSystemRoutes(this.systemController));
    apiRouter.use('/users', authMiddleware, createUserRoutes(this.userController));
    apiRouter.use('/ws', authMiddleware, createWebSocketRoutes(this.webSocketHandlers));

    // Mount API router
    this.app.use('/api/v1', apiRouter);

    // API versioning
    this.app.use('/api', (req, res, next) => {
      // Default to v1 if no version specified
      if (!req.path.startsWith('/v')) {
        req.url = '/v1' + req.url;
      }
      next();
    });
  }

  public setupErrorHandling(): void {
    // 404 handler for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'API endpoint not found',
        path: req.path,
        method: req.method,
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    });

    // Global error handler
    this.app.use('/api', errorHandler(this.context.logger));
  }

  public setupWebSocketHandlers(): void {
    // WebSocket event handlers are initialized in the WebSocketHandlers class
    // They will be connected when the WebSocket server is created
    this.webSocketHandlers.initialize();
  }

  public initialize(): void {
    this.context.logger.info('Initializing Trading API');
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
    this.setupWebSocketHandlers();
    
    this.context.logger.info('Trading API initialized successfully');
  }

  public getControllers() {
    return {
      trading: this.tradingController,
      marketData: this.marketDataController,
      risk: this.riskController,
      system: this.systemController,
      auth: this.authController,
      user: this.userController
    };
  }

  public getWebSocketHandlers() {
    return this.webSocketHandlers;
  }
}

export default TradingAPI;