/**
 * Market Data Controller - Tape Vision Trading System
 * Handles market data subscriptions, historical data, and real-time feeds
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, MarketDataSubscription } from '../types/api';
import { APIContext } from '../index';
import { 
  MarketData, 
  OrderBook, 
  TapeEntry, 
  ChartDataPoint,
  LiquidityAnalysis 
} from '../../types/trading';
import { asyncHandler } from '../middleware/errorHandler';
import { transformMarketData } from '../middleware/responseFormatter';

export class MarketDataController {
  private context: APIContext;

  constructor(context: APIContext) {
    this.context = context;
  }

  /**
   * Get real-time market data for specific symbol
   * GET /api/v1/market-data/quote/:symbol
   */
  public getQuote = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;

    try {
      const marketData = await this.context.nelogicaService.getMarketData(symbol);
      const transformedData = transformMarketData(marketData);

      res.success(transformedData, `Market data for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get market quote', { 
        error: error.message, 
        symbol,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve market quote');
    }
  });

  /**
   * Get multiple quotes
   * POST /api/v1/market-data/quotes
   */
  public getMultipleQuotes = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbols } = req.body;

    if (!Array.isArray(symbols) || symbols.length === 0) {
      res.error('Symbols array is required and cannot be empty', 400);
      return;
    }

    if (symbols.length > 50) {
      res.error('Maximum 50 symbols allowed per request', 400);
      return;
    }

    try {
      const quotes = await Promise.allSettled(
        symbols.map(symbol => this.context.nelogicaService.getMarketData(symbol))
      );

      const results = quotes.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            symbol: symbols[index],
            data: transformMarketData(result.value),
            success: true
          };
        } else {
          return {
            symbol: symbols[index],
            error: result.reason?.message || 'Failed to retrieve data',
            success: false
          };
        }
      });

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      res.success({
        quotes: successful,
        errors: failed.length > 0 ? failed : undefined,
        summary: {
          total: symbols.length,
          successful: successful.length,
          failed: failed.length
        }
      }, 'Multiple quotes retrieved');
    } catch (error) {
      this.context.logger.error('Failed to get multiple quotes', { 
        error: error.message, 
        symbols,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve multiple quotes');
    }
  });

  /**
   * Get historical data
   * GET /api/v1/market-data/historical/:symbol
   */
  public getHistoricalData = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;
    const { interval, startTime, endTime, limit } = req.query;

    try {
      const historicalData = await this.context.nelogicaService.getHistoricalData({
        symbol,
        interval: interval as string,
        startTime: startTime ? Number(startTime) : undefined,
        endTime: endTime ? Number(endTime) : undefined,
        limit: limit ? Number(limit) : 500
      });

      res.success(historicalData, `Historical data for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get historical data', { 
        error: error.message, 
        symbol,
        interval,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve historical data');
    }
  });

  /**
   * Get order book
   * GET /api/v1/market-data/orderbook/:symbol
   */
  public getOrderBook = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;
    const { depth = 100 } = req.query;

    try {
      const orderBook = await this.context.nelogicaService.getOrderBook(symbol, Number(depth));
      res.success(orderBook, `Order book for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get order book', { 
        error: error.message, 
        symbol,
        depth,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve order book');
    }
  });

  /**
   * Get recent trades (tape)
   * GET /api/v1/market-data/trades/:symbol
   */
  public getTrades = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;
    const { limit = 100 } = req.query;

    try {
      const trades = await this.context.nelogicaService.getRecentTrades(symbol, Number(limit));
      res.success(trades, `Recent trades for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get recent trades', { 
        error: error.message, 
        symbol,
        limit,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve recent trades');
    }
  });

  /**
   * Subscribe to real-time market data
   * POST /api/v1/market-data/subscribe
   */
  public subscribeMarketData = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const subscription: MarketDataSubscription = req.body;

    try {
      // Validate subscription limits
      if (subscription.symbols.length > 20) {
        res.error('Maximum 20 symbols allowed per subscription', 400);
        return;
      }

      // Subscribe through WebSocket manager
      const subscriptionId = await this.context.webSocketManager.subscribeMarketData(
        req.user?.id || req.apiKey?.id || 'anonymous',
        subscription
      );

      this.context.logger.info('Market data subscription created', {
        subscriptionId,
        userId: req.user?.id,
        symbols: subscription.symbols,
        channels: subscription.channels
      });

      res.success({
        subscriptionId,
        symbols: subscription.symbols,
        channels: subscription.channels,
        status: 'subscribed'
      }, 'Market data subscription created successfully');
    } catch (error) {
      this.context.logger.error('Failed to create market data subscription', { 
        error: error.message, 
        subscription,
        userId: req.user?.id 
      });
      res.serverError('Failed to create market data subscription');
    }
  });

  /**
   * Unsubscribe from market data
   * DELETE /api/v1/market-data/subscribe/:subscriptionId
   */
  public unsubscribeMarketData = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { subscriptionId } = req.params;

    try {
      await this.context.webSocketManager.unsubscribeMarketData(
        req.user?.id || req.apiKey?.id || 'anonymous',
        subscriptionId
      );

      this.context.logger.info('Market data subscription cancelled', {
        subscriptionId,
        userId: req.user?.id
      });

      res.success({
        subscriptionId,
        status: 'unsubscribed'
      }, 'Market data subscription cancelled successfully');
    } catch (error) {
      this.context.logger.error('Failed to cancel market data subscription', { 
        error: error.message, 
        subscriptionId,
        userId: req.user?.id 
      });
      res.serverError('Failed to cancel market data subscription');
    }
  });

  /**
   * Get active subscriptions
   * GET /api/v1/market-data/subscriptions
   */
  public getSubscriptions = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id || req.apiKey?.id || 'anonymous';
      const subscriptions = this.context.webSocketManager.getUserSubscriptions(userId);

      res.success(subscriptions, 'Active subscriptions retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get subscriptions', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve subscriptions');
    }
  });

  /**
   * Get market statistics
   * GET /api/v1/market-data/stats/:symbol
   */
  public getMarketStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;
    const { period = '1d' } = req.query;

    try {
      const stats = await this.context.databaseManager.getMarketStatistics(symbol, period as string);
      res.success(stats, `Market statistics for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get market stats', { 
        error: error.message, 
        symbol,
        period,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve market statistics');
    }
  });

  /**
   * Get liquidity analysis
   * GET /api/v1/market-data/liquidity/:symbol
   */
  public getLiquidityAnalysis = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;

    try {
      const liquidityAnalysis = await this.context.tradingEngine.analyzeLiquidity(symbol);
      res.success(liquidityAnalysis, `Liquidity analysis for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get liquidity analysis', { 
        error: error.message, 
        symbol,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve liquidity analysis');
    }
  });

  /**
   * Get volume profile
   * GET /api/v1/market-data/volume-profile/:symbol
   */
  public getVolumeProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;
    const { startTime, endTime } = req.query;

    try {
      const volumeProfile = await this.context.databaseManager.getVolumeProfile({
        symbol,
        startTime: startTime ? Number(startTime) : undefined,
        endTime: endTime ? Number(endTime) : undefined
      });

      res.success(volumeProfile, `Volume profile for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get volume profile', { 
        error: error.message, 
        symbol,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve volume profile');
    }
  });

  /**
   * Get market depth analysis
   * GET /api/v1/market-data/depth/:symbol
   */
  public getMarketDepth = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;

    try {
      const depthAnalysis = await this.context.tradingEngine.analyzeMarketDepth(symbol);
      res.success(depthAnalysis, `Market depth analysis for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get market depth', { 
        error: error.message, 
        symbol,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve market depth analysis');
    }
  });

  /**
   * Get order flow data
   * GET /api/v1/market-data/order-flow/:symbol
   */
  public getOrderFlow = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;
    const { timeframe = '1m', limit = 100 } = req.query;

    try {
      const orderFlow = await this.context.databaseManager.getOrderFlowData({
        symbol,
        timeframe: timeframe as string,
        limit: Number(limit)
      });

      res.success(orderFlow, `Order flow data for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get order flow data', { 
        error: error.message, 
        symbol,
        timeframe,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve order flow data');
    }
  });

  /**
   * Get market session info
   * GET /api/v1/market-data/session/:symbol
   */
  public getMarketSession = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;

    try {
      const sessionInfo = await this.context.nelogicaService.getMarketSessionInfo(symbol);
      res.success(sessionInfo, `Market session info for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get market session info', { 
        error: error.message, 
        symbol,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve market session info');
    }
  });

  /**
   * Search symbols
   * GET /api/v1/market-data/search
   */
  public searchSymbols = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { query, limit = 20 } = req.query;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      res.error('Search query must be at least 2 characters long', 400);
      return;
    }

    try {
      const symbols = await this.context.nelogicaService.searchSymbols(query as string, Number(limit));
      res.success(symbols, 'Symbol search completed successfully');
    } catch (error) {
      this.context.logger.error('Failed to search symbols', { 
        error: error.message, 
        query,
        userId: req.user?.id 
      });
      res.serverError('Failed to search symbols');
    }
  });
}