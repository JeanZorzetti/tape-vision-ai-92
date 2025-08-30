/**
 * Trading API Routes
 * RESTful endpoints for trading operations and data access
 * Integrated with Services Architecture
 */

import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Logger } from 'winston';
import { 
  APIResponse,
  MarketData,
  AIStatus,
  DecisionAnalysis,
  TradeEntry,
  TradingConfig,
  Position,
  TradingSession,
  PaginatedResponse
} from '@/types/trading';

// Import services
import { serviceInstances } from '../services';

interface TradingController {
  getMarketData(): Promise<MarketData>;
  getAIStatus(): Promise<AIStatus>;
  getDecisionAnalysis(): Promise<DecisionAnalysis | null>;
  getTradingLog(page: number, limit: number): Promise<PaginatedResponse<TradeEntry>>;
  getPositions(): Promise<Position[]>;
  getTradingConfig(): Promise<TradingConfig>;
  updateTradingConfig(config: Partial<TradingConfig>): Promise<TradingConfig>;
  executeTrade(trade: Partial<TradeEntry>): Promise<TradeEntry>;
  closePosition(positionId: string): Promise<TradeEntry>;
  emergencyStop(): Promise<void>;
  startEngine(): Promise<void>;
  stopEngine(): Promise<void>;
  getTradingSession(): Promise<TradingSession>;
  getChartData(timeframe: number, limit: number): Promise<any[]>;
}

export function createTradingRoutes(controller: TradingController, logger: Logger): Router {
  const router = Router();

  // Validation middleware
  const handleValidationErrors = (req: any, res: any, next: any) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const response: APIResponse = {
        success: false,
        error: `Validation error: ${errors.array().map(e => e.msg).join(', ')}`,
        timestamp: Date.now(),
        requestId: req.headers['x-request-id'] || 'unknown'
      };
      return res.status(400).json(response);
    }
    next();
  };

  // Response wrapper
  const sendResponse = (res: any, data?: any, error?: string) => {
    const response: APIResponse = {
      success: !error,
      data: error ? undefined : data,
      error,
      timestamp: Date.now(),
      requestId: res.locals.requestId || 'unknown'
    };
    
    const statusCode = error ? 500 : 200;
    res.status(statusCode).json(response);
  };

  // Request ID middleware
  router.use((req, res, next) => {
    res.locals.requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    next();
  });

  /**
   * GET /api/trading/market-data
   * Get current market data
   */
  router.get('/market-data', async (req, res) => {
    try {
      const marketData = await controller.getMarketData();
      sendResponse(res, marketData);
    } catch (error) {
      logger.error('Error getting market data', error);
      sendResponse(res, undefined, 'Failed to get market data');
    }
  });

  /**
   * GET /api/trading/ai-status
   * Get AI system status
   */
  router.get('/ai-status', async (req, res) => {
    try {
      const aiStatus = await controller.getAIStatus();
      sendResponse(res, aiStatus);
    } catch (error) {
      logger.error('Error getting AI status', error);
      sendResponse(res, undefined, 'Failed to get AI status');
    }
  });

  /**
   * GET /api/trading/decision-analysis
   * Get latest decision analysis
   */
  router.get('/decision-analysis', async (req, res) => {
    try {
      const analysis = await controller.getDecisionAnalysis();
      sendResponse(res, analysis);
    } catch (error) {
      logger.error('Error getting decision analysis', error);
      sendResponse(res, undefined, 'Failed to get decision analysis');
    }
  });

  /**
   * GET /api/trading/log
   * Get trading log with pagination
   */
  router.get('/log',
    [
      query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
      query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
      query('action').optional().isIn(['BUY', 'SELL', 'ANALYSIS', 'ALERT', 'ERROR']).withMessage('Invalid action filter')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        
        const tradingLog = await controller.getTradingLog(page, limit);
        sendResponse(res, tradingLog);
      } catch (error) {
        logger.error('Error getting trading log', error);
        sendResponse(res, undefined, 'Failed to get trading log');
      }
    }
  );

  /**
   * GET /api/trading/positions
   * Get current positions
   */
  router.get('/positions', async (req, res) => {
    try {
      const positions = await controller.getPositions();
      sendResponse(res, positions);
    } catch (error) {
      logger.error('Error getting positions', error);
      sendResponse(res, undefined, 'Failed to get positions');
    }
  });

  /**
   * GET /api/trading/config
   * Get trading configuration
   */
  router.get('/config', async (req, res) => {
    try {
      const config = await controller.getTradingConfig();
      sendResponse(res, config);
    } catch (error) {
      logger.error('Error getting trading config', error);
      sendResponse(res, undefined, 'Failed to get trading config');
    }
  });

  /**
   * PUT /api/trading/config
   * Update trading configuration
   */
  router.put('/config',
    [
      body('symbol').optional().isString().isLength({ min: 2, max: 10 }).withMessage('Invalid symbol'),
      body('timeframe').optional().isInt({ min: 1000, max: 86400000 }).withMessage('Invalid timeframe'),
      body('riskParameters.maxDailyLoss').optional().isFloat({ min: 0 }).withMessage('Invalid max daily loss'),
      body('riskParameters.maxPositionSize').optional().isInt({ min: 1 }).withMessage('Invalid max position size'),
      body('riskParameters.stopLossPoints').optional().isFloat({ min: 0.1 }).withMessage('Invalid stop loss points'),
      body('riskParameters.minimumConfidence').optional().isFloat({ min: 0, max: 100 }).withMessage('Invalid minimum confidence')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const updatedConfig = await controller.updateTradingConfig(req.body);
        sendResponse(res, updatedConfig);
      } catch (error) {
        logger.error('Error updating trading config', error);
        sendResponse(res, undefined, 'Failed to update trading config');
      }
    }
  );

  /**
   * POST /api/trading/execute
   * Execute a trade (enhanced with services)
   */
  router.post('/execute',
    [
      body('action').isIn(['BUY', 'SELL']).withMessage('Action must be BUY or SELL'),
      body('symbol').isString().isLength({ min: 2, max: 10 }).withMessage('Invalid symbol'),
      body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
      body('price').optional().isFloat({ min: 0 }).withMessage('Invalid price'),
      body('reason').isString().isLength({ min: 5, max: 200 }).withMessage('Reason must be 5-200 characters'),
      body('userId').optional().isString().withMessage('Invalid user ID')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const userId = req.body.userId || 'system';
        
        // Pre-execution risk check
        const riskCheck = await serviceInstances.riskService.checkTradeRisk(userId, req.body);
        
        if (!riskCheck.approved) {
          logger.warn('Trade rejected by risk service', { 
            userId, 
            trade: req.body, 
            reasons: riskCheck.reasons 
          });
          
          // Send risk warning notification
          await serviceInstances.notificationService.sendNotification(
            userId,
            'RISK_REJECTION',
            `Trade rejected: ${riskCheck.reasons.join(', ')}`
          );
          
          return sendResponse(res, undefined, `Trade rejected by risk management: ${riskCheck.reasons.join(', ')}`);
        }
        
        // Execute trade through controller
        const trade = await controller.executeTrade({
          ...req.body,
          userId
        });
        
        // Post-execution services integration
        try {
          // Log the trade
          await serviceInstances.loggingService.logTrade(userId, 'TRADE_EXECUTED', trade);
          
          // Update position
          await serviceInstances.positionService.updatePosition(userId, trade);
          
          // Send success notification
          await serviceInstances.notificationService.sendNotification(
            userId,
            'TRADE_EXECUTED',
            `Trade executed successfully: ${trade.action} ${trade.quantity} ${trade.symbol} @ ${trade.price}`
          );
          
        } catch (serviceError) {
          logger.error('Error in post-execution services', serviceError);
          // Don't fail the trade, just log the service error
        }
        
        sendResponse(res, trade);
      } catch (error) {
        logger.error('Error executing trade', error);
        sendResponse(res, undefined, 'Failed to execute trade');
      }
    }
  );

  /**
   * POST /api/trading/close-position/:positionId
   * Close a specific position
   */
  router.post('/close-position/:positionId',
    [
      param('positionId').isString().isLength({ min: 1 }).withMessage('Invalid position ID')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const trade = await controller.closePosition(req.params.positionId);
        sendResponse(res, trade);
      } catch (error) {
        logger.error('Error closing position', error);
        sendResponse(res, undefined, 'Failed to close position');
      }
    }
  );

  /**
   * POST /api/trading/emergency-stop
   * Trigger emergency stop
   */
  router.post('/emergency-stop', async (req, res) => {
    try {
      await controller.emergencyStop();
      sendResponse(res, { message: 'Emergency stop executed successfully' });
    } catch (error) {
      logger.error('Error executing emergency stop', error);
      sendResponse(res, undefined, 'Failed to execute emergency stop');
    }
  });

  /**
   * POST /api/trading/start
   * Start the trading engine
   */
  router.post('/start', async (req, res) => {
    try {
      await controller.startEngine();
      sendResponse(res, { message: 'Trading engine started successfully' });
    } catch (error) {
      logger.error('Error starting trading engine', error);
      sendResponse(res, undefined, 'Failed to start trading engine');
    }
  });

  /**
   * POST /api/trading/stop
   * Stop the trading engine
   */
  router.post('/stop', async (req, res) => {
    try {
      await controller.stopEngine();
      sendResponse(res, { message: 'Trading engine stopped successfully' });
    } catch (error) {
      logger.error('Error stopping trading engine', error);
      sendResponse(res, undefined, 'Failed to stop trading engine');
    }
  });

  /**
   * GET /api/trading/session
   * Get current trading session statistics
   */
  router.get('/session', async (req, res) => {
    try {
      const session = await controller.getTradingSession();
      sendResponse(res, session);
    } catch (error) {
      logger.error('Error getting trading session', error);
      sendResponse(res, undefined, 'Failed to get trading session');
    }
  });

  /**
   * GET /api/trading/chart-data
   * Get chart data for visualization
   */
  router.get('/chart-data',
    [
      query('timeframe').optional().isInt({ min: 1000 }).withMessage('Invalid timeframe'),
      query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const timeframe = parseInt(req.query.timeframe as string) || 60000; // 1 minute default
        const limit = parseInt(req.query.limit as string) || 100;
        
        const chartData = await controller.getChartData(timeframe, limit);
        sendResponse(res, chartData);
      } catch (error) {
        logger.error('Error getting chart data', error);
        sendResponse(res, undefined, 'Failed to get chart data');
      }
    }
  );

  /**
   * GET /api/trading/ml/predictions
   * Get ML predictions (enhanced with services)
   */
  router.get('/ml/predictions', async (req, res) => {
    try {
      const predictions = await serviceInstances.mlService.getPredictions('WDO');
      sendResponse(res, predictions);
    } catch (error) {
      logger.error('Error getting ML predictions', error);
      // Fallback to controller if service fails
      try {
        const fallbackPredictions = [{
          signal: 'HOLD',
          confidence: 0.5,
          reasoning: 'Service temporarily unavailable',
          stopLoss: 0,
          target: 0,
          riskReward: 1.5,
          timestamp: new Date().toISOString(),
          responseTime: 0,
          modelVersion: '1.0.0',
          featuresCount: 0,
          patterns: [],
          marketRegime: 'unknown'
        }];
        sendResponse(res, fallbackPredictions);
      } catch (fallbackError) {
        sendResponse(res, undefined, 'Failed to get ML predictions');
      }
    }
  });

  /**
   * GET /api/trading/risk-status
   * Get current risk status
   */
  router.get('/risk-status', async (req, res) => {
    try {
      const userId = req.query.userId as string || 'system';
      const riskStatus = await serviceInstances.riskService.getRiskStatus(userId);
      sendResponse(res, riskStatus);
    } catch (error) {
      logger.error('Error getting risk status', error);
      sendResponse(res, undefined, 'Failed to get risk status');
    }
  });

  /**
   * GET /api/trading/user-stats
   * Get user trading statistics
   */
  router.get('/user-stats', async (req, res) => {
    try {
      const stats = await serviceInstances.userService.getUserStats();
      sendResponse(res, stats);
    } catch (error) {
      logger.error('Error getting user stats', error);
      sendResponse(res, undefined, 'Failed to get user stats');
    }
  });

  /**
   * POST /api/trading/positions/update
   * Update position via service (called internally)
   */
  router.post('/positions/update',
    [
      body('userId').isString().withMessage('User ID is required'),
      body('trade').isObject().withMessage('Trade object is required')
    ],
    handleValidationErrors,
    async (req: any, res: any) => {
      try {
        const { userId, trade } = req.body;
        await serviceInstances.positionService.updatePosition(userId, trade);
        
        // Log the position update
        await serviceInstances.loggingService.logTrade(userId, 'POSITION_UPDATE', trade);
        
        sendResponse(res, { message: 'Position updated successfully' });
      } catch (error) {
        logger.error('Error updating position', error);
        sendResponse(res, undefined, 'Failed to update position');
      }
    }
  );

  /**
   * GET /api/trading/services/health
   * Get health status of all trading services
   */
  router.get('/services/health', async (req, res) => {
    try {
      const { checkServicesHealth } = await import('../services');
      const health = await checkServicesHealth();
      sendResponse(res, health);
    } catch (error) {
      logger.error('Error checking services health', error);
      sendResponse(res, undefined, 'Failed to check services health');
    }
  });

  // Error handling middleware
  router.use((error: any, req: any, res: any, next: any) => {
    logger.error('Trading route error', {
      error: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      body: req.body
    });

    const response: APIResponse = {
      success: false,
      error: 'Internal server error',
      timestamp: Date.now(),
      requestId: res.locals.requestId || 'unknown'
    };

    res.status(500).json(response);
  });

  return router;
}