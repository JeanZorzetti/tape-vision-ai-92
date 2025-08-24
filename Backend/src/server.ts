/**
 * Main Server - Tape Vision Trading Backend
 * High-performance algorithmic trading server with real-time capabilities
 */

import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from 'dotenv';
import winston from 'winston';
import path from 'path';

// Import core components
import { WebSocketManager } from './websocket/WebSocketManager';
import { TradingEngine } from './core/trading/TradingEngine';
import { createTradingRoutes } from './routes/tradingRoutes';
import { DatabaseManager } from './database/DatabaseManager';
import { NelogicaService } from './services/nelogica/NelogicaService';
import { 
  TradingConfig,
  MarketData,
  AIStatus,
  DecisionAnalysis,
  TradeEntry,
  Position,
  TradingSession,
  SystemHealth
} from './types/trading';

// Load environment variables
config();

class TradingServer {
  private app: express.Application;
  private server: http.Server;
  private logger: winston.Logger;
  private webSocketManager!: WebSocketManager;
  private tradingEngine!: TradingEngine;
  private databaseManager!: DatabaseManager;
  private nelogicaService!: NelogicaService;
  
  private readonly port: number;
  private readonly environment: string;
  private isShuttingDown: boolean = false;

  constructor() {
    this.port = parseInt(process.env.PORT || '3001');
    this.environment = process.env.NODE_ENV || 'development';
    
    // Initialize Express app
    this.app = express();
    this.server = http.createServer(this.app);
    
    // Initialize logger
    this.logger = this.createLogger();
    
    this.logger.info('Trading Server initializing', {
      port: this.port,
      environment: this.environment,
      nodeVersion: process.version
    });
  }

  private createLogger(): winston.Logger {
    const logFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    );

    return winston.createLogger({
      level: this.environment === 'production' ? 'info' : 'debug',
      format: logFormat,
      defaultMeta: { service: 'trading-backend' },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        }),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 10
        })
      ]
    });
  }

  public async initialize(): Promise<void> {
    try {
      // Setup middleware
      this.setupMiddleware();
      
      // Initialize core services
      await this.initializeServices();
      
      // Setup routes
      this.setupRoutes();
      
      // Setup WebSocket
      this.setupWebSocket();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      this.logger.info('Trading Server initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Trading Server', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false
    }));
    
    // CORS configuration
    this.app.use(cors({
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
      optionsSuccessStatus: 200
    }));
    
    // Compression
    this.app.use(compression());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.environment === 'production' ? 100 : 1000, // requests per window
      message: {
        success: false,
        error: 'Too many requests from this IP',
        timestamp: Date.now(),
        requestId: 'rate-limited'
      }
    });
    this.app.use('/api/', limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Request logging
    this.app.use((req, res, next) => {
      const start = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - start;
        this.logger.info('HTTP Request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration,
          userAgent: req.get('User-Agent'),
          ip: req.ip
        });
      });
      
      next();
    });
  }

  private async initializeServices(): Promise<void> {
    // Initialize Database
    this.databaseManager = new DatabaseManager(this.logger);
    await this.databaseManager.connect();
    
    // Initialize Nelogica service
    this.nelogicaService = new NelogicaService({
      apiUrl: process.env.NELOGICA_API_URL || 'https://api.nelogica.com.br',
      username: process.env.NELOGICA_USERNAME || '',
      password: process.env.NELOGICA_PASSWORD || '',
      dllPath: process.env.NELOGICA_DLL_PATH || '',
      environment: (process.env.NELOGICA_ENV as 'demo' | 'production') || 'demo',
      autoReconnect: true,
      timeout: 30000
    }, this.logger);
    
    // Initialize Trading Engine with configuration
    const tradingConfig: TradingConfig = {
      symbol: process.env.TRADING_SYMBOL || 'WDO',
      timeframe: parseInt(process.env.TRADING_TIMEFRAME || '60000'),
      riskParameters: {
        maxDailyLoss: parseFloat(process.env.MAX_DAILY_LOSS || '500'),
        maxPositionSize: parseInt(process.env.MAX_POSITION_SIZE || '5'),
        stopLossPoints: parseFloat(process.env.STOP_LOSS_POINTS || '15'),
        takeProfitPoints: parseFloat(process.env.TAKE_PROFIT_POINTS || '30'),
        maxDrawdown: parseFloat(process.env.MAX_DRAWDOWN || '1000'),
        consecutiveStopLimit: parseInt(process.env.CONSECUTIVE_STOP_LIMIT || '3'),
        minimumConfidence: parseFloat(process.env.MINIMUM_CONFIDENCE || '90')
      },
      patternSettings: {
        absorptionThreshold: 0.7,
        volumeClusterDistance: 5,
        aggressionThreshold: 0.6
      },
      analysisSettings: {
        confidenceThreshold: parseFloat(process.env.MINIMUM_CONFIDENCE || '90'),
        patternWeight: 0.3,
        volumeWeight: 0.3,
        priceActionWeight: 0.4
      }
    };
    
    this.tradingEngine = new TradingEngine(tradingConfig, this.logger);
    
    // Connect services
    await this.connectServices();
  }

  private async connectServices(): Promise<void> {
    // Setup event handlers between services
    this.tradingEngine.on('market-data-processed', (data) => {
      if (this.webSocketManager) {
        this.webSocketManager.broadcastMarketData(data.data);
        this.webSocketManager.broadcastAIStatus(data.aiStatus);
      }
    });
    
    this.tradingEngine.on('signal-generated', (signal) => {
      if (this.webSocketManager) {
        this.webSocketManager.broadcastSignal(signal);
      }
    });
    
    this.tradingEngine.on('trade-executed', (data) => {
      if (this.webSocketManager) {
        this.webSocketManager.broadcastTrade(data.trade);
      }
    });
    
    this.tradingEngine.on('emergency-stop', (data) => {
      if (this.webSocketManager) {
        this.webSocketManager.broadcastNotification({
          id: `emergency-${Date.now()}`,
          type: 'error',
          title: 'PARADA DE EMERGÊNCIA',
          message: data.reason,
          timestamp: new Date(),
          priority: 'critical'
        });
      }
    });
    
    // Connect Nelogica service to trading engine
    this.nelogicaService.on('market-data', (data: MarketData) => {
      this.tradingEngine.processMarketData(data);
    });
    
    this.nelogicaService.on('order-book', (orderBook) => {
      this.tradingEngine.processOrderBook(orderBook);
    });
    
    this.nelogicaService.on('connection-status', (status) => {
      this.logger.info('Nelogica connection status changed', status);
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        engine: {
          active: this.tradingEngine.isEngineActive(),
          dailyPnL: this.tradingEngine.getDailyPnL(),
          tradesCount: this.tradingEngine.getTradesCount()
        }
      };
      
      res.json(health);
    });
    
    // API routes
    const controller = new TradingController(
      this.tradingEngine,
      this.databaseManager,
      this.nelogicaService,
      this.logger
    );
    
    this.app.use('/api/trading', createTradingRoutes(controller, this.logger));
    
    // Static files (if any)
    this.app.use('/static', express.static(path.join(__dirname, '../static')));
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    });
  }

  private setupWebSocket(): void {
    this.webSocketManager = new WebSocketManager(this.server, this.logger);
    
    this.webSocketManager.on('client-connected', (data) => {
      this.logger.info('WebSocket client connected', data);
    });
    
    this.webSocketManager.on('client-disconnected', (data) => {
      this.logger.info('WebSocket client disconnected', data);
    });
  }

  private setupErrorHandling(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught Exception', error);
      this.gracefulShutdown(1);
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled Rejection at:', { promise, reason });
      this.gracefulShutdown(1);
    });
    
    // Express error handler
    this.app.use((err: any, req: any, res: any, next: any) => {
      this.logger.error('Express error', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
      });
      
      if (res.headersSent) {
        return next(err);
      }
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] || 'unknown'
      });
    });
  }

  private setupGracefulShutdown(): void {
    // Handle shutdown signals
    process.on('SIGTERM', () => {
      this.logger.info('SIGTERM received, starting graceful shutdown');
      this.gracefulShutdown(0);
    });
    
    process.on('SIGINT', () => {
      this.logger.info('SIGINT received, starting graceful shutdown');
      this.gracefulShutdown(0);
    });
  }

  public async start(): Promise<void> {
    try {
      await this.initialize();
      
      this.server.listen(this.port, () => {
        this.logger.info('Trading Server started', {
          port: this.port,
          environment: this.environment,
          pid: process.pid
        });
        
        // Start trading engine in production
        if (this.environment === 'production' && process.env.AUTO_START_ENGINE === 'true') {
          setTimeout(() => {
            this.tradingEngine.start().catch((error) => {
              this.logger.error('Failed to auto-start trading engine', error);
            });
          }, 5000); // Wait 5 seconds for all services to stabilize
        }
      });
      
    } catch (error) {
      this.logger.error('Failed to start Trading Server', error);
      process.exit(1);
    }
  }

  private async gracefulShutdown(exitCode: number): Promise<void> {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    this.logger.info('Starting graceful shutdown...');
    
    try {
      // Stop accepting new connections
      this.server.close(() => {
        this.logger.info('HTTP server closed');
      });
      
      // Stop trading engine
      if (this.tradingEngine) {
        await this.tradingEngine.stop();
        this.logger.info('Trading engine stopped');
      }
      
      // Close WebSocket connections
      if (this.webSocketManager) {
        await this.webSocketManager.shutdown();
        this.logger.info('WebSocket manager shut down');
      }
      
      // Disconnect from Nelogica
      if (this.nelogicaService) {
        await this.nelogicaService.disconnect();
        this.logger.info('Nelogica service disconnected');
      }
      
      // Close database connection
      if (this.databaseManager) {
        await this.databaseManager.disconnect();
        this.logger.info('Database disconnected');
      }
      
      this.logger.info('Graceful shutdown completed');
      process.exit(exitCode);
      
    } catch (error) {
      this.logger.error('Error during graceful shutdown', error);
      process.exit(1);
    }
  }
}

// Trading Controller Implementation
class TradingController {
  constructor(
    private tradingEngine: TradingEngine,
    private databaseManager: DatabaseManager,
    private nelogicaService: NelogicaService,
    private logger: winston.Logger
  ) {}

  async getMarketData(): Promise<MarketData> {
    // This would typically come from the trading engine or market data service
    return this.nelogicaService.getCurrentMarketData();
  }

  async getAIStatus(): Promise<AIStatus> {
    return this.tradingEngine.getAIStatus();
  }

  async getDecisionAnalysis(): Promise<DecisionAnalysis | null> {
    return this.tradingEngine.getLastDecisionAnalysis();
  }

  async getTradingLog(page: number, limit: number): Promise<any> {
    return this.databaseManager.getTradingLog(page, limit);
  }

  async getPositions(): Promise<Position[]> {
    const position = this.tradingEngine.getCurrentPosition();
    return position ? [position] : [];
  }

  async getTradingConfig(): Promise<TradingConfig> {
    return this.databaseManager.getTradingConfig();
  }

  async updateTradingConfig(config: Partial<TradingConfig>): Promise<TradingConfig> {
    return this.databaseManager.updateTradingConfig(config);
  }

  async executeTrade(trade: Partial<TradeEntry>): Promise<TradeEntry> {
    return this.nelogicaService.executeTrade(trade);
  }

  async closePosition(positionId: string): Promise<TradeEntry> {
    return this.nelogicaService.closePosition(positionId);
  }

  async emergencyStop(): Promise<void> {
    this.tradingEngine.emergencyStop('Manual emergency stop triggered');
  }

  async startEngine(): Promise<void> {
    await this.tradingEngine.start();
  }

  async stopEngine(): Promise<void> {
    await this.tradingEngine.stop();
  }

  async getTradingSession(): Promise<TradingSession> {
    return this.databaseManager.getCurrentTradingSession();
  }

  async getChartData(timeframe: number, limit: number): Promise<any[]> {
    return this.databaseManager.getChartData(timeframe, limit);
  }
}

// Start the server if this file is executed directly
if (require.main === module) {
  const server = new TradingServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export default TradingServer;