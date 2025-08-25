/**
 * Market Data Routes - Tape Vision Trading System
 * Defines all market data API endpoints with proper validation and authorization
 */

import { Router } from 'express';
import { MarketDataController } from '../controllers/MarketDataController';
import { validationMiddleware } from '../middleware/validation';
import { requireMarketDataAccess, requirePermissions } from '../middleware/auth';
import { marketDataRateLimit } from '../middleware/rateLimit';
import { cacheResponse } from '../middleware/responseFormatter';

export function createMarketDataRoutes(controller: MarketDataController): Router {
  const router = Router();

  // Apply market data specific rate limiting
  router.use(marketDataRateLimit);

  // Real-time Quote Routes
  router.get(
    '/quote/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    cacheResponse(5), // 5 second cache for quotes
    controller.getQuote
  );

  router.post(
    '/quotes',
    requireMarketDataAccess,
    controller.getMultipleQuotes
  );

  // Historical Data Routes
  router.get(
    '/historical/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    validationMiddleware.getHistoricalData,
    cacheResponse(30), // 30 second cache for historical data
    controller.getHistoricalData
  );

  // Order Book Routes
  router.get(
    '/orderbook/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    validationMiddleware.getOrderBook,
    controller.getOrderBook
  );

  // Trade Data Routes
  router.get(
    '/trades/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    controller.getTrades
  );

  // WebSocket Subscription Routes
  router.post(
    '/subscribe',
    requirePermissions(['market_data.subscribe']),
    validationMiddleware.subscribeMarketData,
    controller.subscribeMarketData
  );

  router.delete(
    '/subscribe/:subscriptionId',
    requirePermissions(['market_data.subscribe']),
    validationMiddleware.id,
    controller.unsubscribeMarketData
  );

  router.get(
    '/subscriptions',
    requireMarketDataAccess,
    controller.getSubscriptions
  );

  // Market Analysis Routes
  router.get(
    '/stats/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    validationMiddleware.dateRange,
    cacheResponse(60), // 1 minute cache for stats
    controller.getMarketStats
  );

  router.get(
    '/liquidity/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    controller.getLiquidityAnalysis
  );

  router.get(
    '/volume-profile/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    validationMiddleware.dateRange,
    cacheResponse(120), // 2 minute cache for volume profile
    controller.getVolumeProfile
  );

  router.get(
    '/depth/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    controller.getMarketDepth
  );

  router.get(
    '/order-flow/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    controller.getOrderFlow
  );

  // Market Session and Info Routes
  router.get(
    '/session/:symbol',
    requireMarketDataAccess,
    validationMiddleware.symbol,
    cacheResponse(300), // 5 minute cache for session info
    controller.getMarketSession
  );

  router.get(
    '/search',
    requireMarketDataAccess,
    controller.searchSymbols
  );

  return router;
}

export default createMarketDataRoutes;