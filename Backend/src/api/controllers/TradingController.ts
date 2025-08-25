/**
 * Trading Controller - Tape Vision Trading System
 * Handles all trading-related API endpoints including orders, positions, and strategy management
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, PlaceOrderRequest, PlaceOrderResponse } from '../types/api';
import { APIContext } from '../index';
import { 
  MarketData, 
  AIStatus, 
  DecisionAnalysis, 
  TradeEntry, 
  Position, 
  TradingSession,
  TradingConfig,
  ChartDataPoint,
  RiskParameters,
  PatternMatch
} from '../../types/trading';
import { asyncHandler } from '../middleware/errorHandler';
import { transformTradingData } from '../middleware/responseFormatter';

export class TradingController {
  private context: APIContext;

  constructor(context: APIContext) {
    this.context = context;
  }

  /**
   * Get unified trading status (AI status + market data + system health)
   * GET /api/v1/trading/status
   */
  public getStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Get AI status
      const aiStatus: AIStatus = this.context.tradingEngine.getAIStatus();
      
      // Get current market data
      const marketData: MarketData = await this.context.nelogicaService.getCurrentMarketData();
      
      // Get system health
      const systemHealth = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        components: {
          tradingEngine: this.context.tradingEngine.isEngineActive() ? 'healthy' : 'stopped',
          database: 'healthy', // TODO: implement actual database health check
          nelogica: 'healthy', // TODO: implement actual Nelogica health check
          redis: 'healthy' // TODO: implement actual Redis health check
        },
        performance: {
          uptime: this.context.tradingEngine.getUptime(),
          memoryUsage: process.memoryUsage(),
          latency: {
            database: 0, // TODO: implement actual latency measurement
            nelogica: 0 // TODO: implement actual latency measurement
          }
        }
      };

      const statusResponse = {
        aiStatus,
        marketData,
        systemHealth
      };

      res.success(statusResponse, 'Trading status retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get trading status', { error: error.message });
      res.serverError('Failed to retrieve trading status');
    }
  });

  /**
   * Get current market data
   * GET /api/v1/trading/market-data
   */
  public getMarketData = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.query;

    try {
      let marketData: MarketData;

      if (symbol) {
        marketData = await this.context.nelogicaService.getMarketData(symbol as string);
      } else {
        marketData = await this.context.nelogicaService.getCurrentMarketData();
      }

      const transformedData = transformTradingData(marketData);

      res.success(transformedData, 'Market data retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get market data', { error: error.message, symbol });
      res.serverError('Failed to retrieve market data');
    }
  });

  /**
   * Get AI system status
   * GET /api/v1/trading/ai-status
   */
  public getAIStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const aiStatus: AIStatus = this.context.tradingEngine.getAIStatus();
      res.success(aiStatus, 'AI status retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get AI status', { error: error.message });
      res.serverError('Failed to retrieve AI status');
    }
  });

  /**
   * Get current decision analysis
   * GET /api/v1/trading/decision-analysis
   */
  public getDecisionAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const analysis: DecisionAnalysis | null = this.context.tradingEngine.getLastDecisionAnalysis();
      
      if (!analysis) {
        res.notFound('No decision analysis available');
        return;
      }

      res.success(analysis, 'Decision analysis retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get decision analysis', { error: error.message });
      res.serverError('Failed to retrieve decision analysis');
    }
  });

  /**
   * Place a new order
   * POST /api/v1/trading/orders
   */
  public placeOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const orderRequest: PlaceOrderRequest = req.body;

    try {
      // Validate trading engine is active
      if (!this.context.tradingEngine.isEngineActive()) {
        res.conflict('Trading engine is not active');
        return;
      }

      // Check risk limits before placing order
      const riskCheck = await this.context.tradingEngine.checkRiskLimits(orderRequest);
      if (!riskCheck.passed) {
        res.forbidden('Order rejected due to risk limits', riskCheck.violations);
        return;
      }

      // Execute the order
      const executionResult = await this.context.nelogicaService.executeTrade({
        symbol: orderRequest.symbol,
        action: orderRequest.side === 'buy' ? 'BUY' : 'SELL',
        price: orderRequest.price,
        quantity: orderRequest.quantity,
        confidence: 100, // Manual orders have full confidence
        reason: `Manual ${orderRequest.orderType} order`,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      const response: PlaceOrderResponse = {
        orderId: executionResult.id,
        clientOrderId: orderRequest.clientOrderId,
        status: executionResult.status === 'success' ? 'accepted' : 'rejected',
        message: executionResult.status === 'success' ? 'Order placed successfully' : 'Order rejected',
        executionReport: executionResult.status === 'success' ? {
          orderId: executionResult.id,
          symbol: executionResult.symbol,
          side: orderRequest.side,
          quantity: orderRequest.quantity,
          filledQuantity: executionResult.quantity || 0,
          avgPrice: executionResult.price || 0,
          status: 'new',
          timestamp: Date.now(),
          fees: 0 // Calculate actual fees
        } : undefined
      };

      this.context.logger.info('Order placed', {
        userId: req.user?.id,
        orderId: response.orderId,
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        quantity: orderRequest.quantity,
        orderType: orderRequest.orderType
      });

      res.success(response, 'Order processed successfully');
    } catch (error) {
      this.context.logger.error('Failed to place order', { 
        error: error.message, 
        orderRequest,
        userId: req.user?.id 
      });
      res.serverError('Failed to place order');
    }
  });

  /**
   * Get all orders
   * GET /api/v1/trading/orders
   */
  public getOrders = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page = 1, limit = 50, status, symbol } = req.query;

    try {
      const orders = await this.context.databaseManager.getOrders({
        page: Number(page),
        limit: Number(limit),
        status: status as string,
        symbol: symbol as string
      });

      res.paginated(
        orders.items,
        orders.page,
        orders.limit,
        orders.total,
        'Orders retrieved successfully'
      );
    } catch (error) {
      this.context.logger.error('Failed to get orders', { error: error.message });
      res.serverError('Failed to retrieve orders');
    }
  });

  /**
   * Cancel an order
   * DELETE /api/v1/trading/orders/:orderId
   */
  public cancelOrder = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { orderId } = req.params;

    try {
      const result = await this.context.nelogicaService.cancelOrder(orderId);
      
      this.context.logger.info('Order cancelled', {
        userId: req.user?.id,
        orderId
      });

      res.success(result, 'Order cancelled successfully');
    } catch (error) {
      this.context.logger.error('Failed to cancel order', { 
        error: error.message, 
        orderId,
        userId: req.user?.id 
      });
      res.serverError('Failed to cancel order');
    }
  });

  /**
   * Get current positions
   * GET /api/v1/trading/positions
   */
  public getPositions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const currentPosition = this.context.tradingEngine.getCurrentPosition();
      const positions: Position[] = currentPosition ? [currentPosition] : [];
      
      res.success(positions, 'Positions retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get positions', { error: error.message });
      res.serverError('Failed to retrieve positions');
    }
  });

  /**
   * Close a position
   * DELETE /api/v1/trading/positions/:symbol
   */
  public closePosition = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;
    const { percentage = 100 } = req.body;

    try {
      const result = await this.context.nelogicaService.closePosition(symbol, percentage);
      
      this.context.logger.info('Position closed', {
        userId: req.user?.id,
        symbol,
        percentage
      });

      res.success(result, 'Position closed successfully');
    } catch (error) {
      this.context.logger.error('Failed to close position', { 
        error: error.message, 
        symbol,
        userId: req.user?.id 
      });
      res.serverError('Failed to close position');
    }
  });

  /**
   * Get trading configuration
   * GET /api/v1/trading/config
   */
  public getConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const config = this.context.tradingEngine.getConfig();
      res.success(config, 'Trading configuration retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get trading config', { error: error.message });
      res.serverError('Failed to retrieve trading configuration');
    }
  });

  /**
   * Update trading configuration
   * PUT /api/v1/trading/config
   */
  public updateConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const configUpdate = req.body;

    try {
      const updatedConfig = await this.context.tradingEngine.updateConfig(configUpdate);
      
      this.context.logger.info('Trading config updated', {
        userId: req.user?.id,
        changes: Object.keys(configUpdate)
      });

      res.success(updatedConfig, 'Trading configuration updated successfully');
    } catch (error) {
      this.context.logger.error('Failed to update trading config', { 
        error: error.message, 
        configUpdate,
        userId: req.user?.id 
      });
      res.serverError('Failed to update trading configuration');
    }
  });

  /**
   * Get trading log/history
   * GET /api/v1/trading/log
   */
  public getTradingLog = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page = 1, limit = 50, symbol, action, status, startDate, endDate } = req.query;

    try {
      const tradingLog = await this.context.databaseManager.getTradingLog({
        page: Number(page),
        limit: Number(limit),
        symbol: symbol as string,
        action: action as string,
        status: status as string,
        startDate: startDate as string,
        endDate: endDate as string
      });

      res.paginated(
        tradingLog.items,
        tradingLog.page,
        tradingLog.limit,
        tradingLog.total,
        'Trading log retrieved successfully'
      );
    } catch (error) {
      this.context.logger.error('Failed to get trading log', { error: error.message });
      res.serverError('Failed to retrieve trading log');
    }
  });

  /**
   * Get current trading session
   * GET /api/v1/trading/session
   */
  public getTradingSession = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const session = this.context.tradingEngine.getCurrentSession();
      res.success(session, 'Trading session retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get trading session', { error: error.message });
      res.serverError('Failed to retrieve trading session');
    }
  });

  /**
   * Start trading engine
   * POST /api/v1/trading/engine/start
   */
  public startEngine = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await this.context.tradingEngine.start();
      
      this.context.logger.info('Trading engine started', {
        userId: req.user?.id
      });

      res.success({ status: 'started' }, 'Trading engine started successfully');
    } catch (error) {
      this.context.logger.error('Failed to start trading engine', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to start trading engine');
    }
  });

  /**
   * Stop trading engine
   * POST /api/v1/trading/engine/stop
   */
  public stopEngine = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await this.context.tradingEngine.stop();
      
      this.context.logger.info('Trading engine stopped', {
        userId: req.user?.id
      });

      res.success({ status: 'stopped' }, 'Trading engine stopped successfully');
    } catch (error) {
      this.context.logger.error('Failed to stop trading engine', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to stop trading engine');
    }
  });

  /**
   * Emergency stop - immediately halt all trading
   * POST /api/v1/trading/emergency-stop
   */
  public emergencyStop = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { reason = 'Manual emergency stop' } = req.body;

    try {
      this.context.tradingEngine.emergencyStop(reason);
      
      this.context.logger.warn('Emergency stop triggered', {
        userId: req.user?.id,
        reason
      });

      res.success({ status: 'emergency_stopped', reason }, 'Emergency stop executed successfully');
    } catch (error) {
      this.context.logger.error('Failed to execute emergency stop', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to execute emergency stop');
    }
  });

  /**
   * Get pattern matches
   * GET /api/v1/trading/patterns
   */
  public getPatterns = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { limit = 10, minConfidence = 0.7 } = req.query;

    try {
      const patterns = await this.context.tradingEngine.getPatternMatches({
        limit: Number(limit),
        minConfidence: Number(minConfidence)
      });

      res.success(patterns, 'Pattern matches retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get pattern matches', { error: error.message });
      res.serverError('Failed to retrieve pattern matches');
    }
  });

  /**
   * Get performance metrics
   * GET /api/v1/trading/performance
   */
  public getPerformance = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { period = '1d' } = req.query;

    try {
      const performance = await this.context.databaseManager.getPerformanceMetrics(period as string);
      res.success(performance, 'Performance metrics retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get performance metrics', { error: error.message });
      res.serverError('Failed to retrieve performance metrics');
    }
  });

  /**
   * Get chart data
   * GET /api/v1/trading/chart
   */
  public getChartData = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol, timeframe = '1m', limit = 100 } = req.query;

    try {
      const chartData = await this.context.databaseManager.getChartData({
        symbol: symbol as string,
        timeframe: timeframe as string,
        limit: Number(limit)
      });

      res.success(chartData, 'Chart data retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get chart data', { error: error.message });
      res.serverError('Failed to retrieve chart data');
    }
  });

  /**
   * Get trading statistics
   * GET /api/v1/trading/stats
   */
  public getStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const stats = {
        dailyPnL: this.context.tradingEngine.getDailyPnL(),
        tradesCount: this.context.tradingEngine.getTradesCount(),
        winRate: this.context.tradingEngine.getWinRate(),
        isActive: this.context.tradingEngine.isEngineActive(),
        uptime: this.context.tradingEngine.getUptime(),
        lastSignalTime: this.context.tradingEngine.getLastSignalTime(),
        confidenceLevel: this.context.tradingEngine.getAverageConfidence()
      };

      res.success(stats, 'Trading statistics retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get trading stats', { error: error.message });
      res.serverError('Failed to retrieve trading statistics');
    }
  });
}