/**
 * Trading Routes - Tape Vision Trading System
 * Defines all trading-related API endpoints with proper validation and authorization
 */

import { Router } from 'express';
import { TradingController } from '../controllers/TradingController';
import { validationMiddleware } from '../middleware/validation';
import { 
  requireTradingAccess, 
  requireTradingExecution, 
  requirePermissions 
} from '../middleware/auth';
import { tradingRateLimit } from '../middleware/rateLimit';

export function createTradingRoutes(controller: TradingController): Router {
  const router = Router();

  // Apply trading-specific rate limiting
  router.use(tradingRateLimit);

  // Unified Status Route
  router.get(
    '/status',
    requireTradingAccess,
    controller.getStatus
  );

  // Market Data Routes (Read-only)
  router.get(
    '/market-data',
    requireTradingAccess,
    validationMiddleware.pagination,
    controller.getMarketData
  );

  router.get(
    '/ai-status',
    requireTradingAccess,
    controller.getAIStatus
  );

  router.get(
    '/decision-analysis',
    requireTradingAccess,
    controller.getDecisionAnalysis
  );

  // Order Management Routes
  router.post(
    '/orders',
    requireTradingExecution,
    validationMiddleware.placeOrder,
    controller.placeOrder
  );

  router.get(
    '/orders',
    requireTradingAccess,
    validationMiddleware.pagination,
    controller.getOrders
  );

  router.delete(
    '/orders/:orderId',
    requireTradingExecution,
    validationMiddleware.id,
    controller.cancelOrder
  );

  // Position Management Routes
  router.get(
    '/positions',
    requireTradingAccess,
    controller.getPositions
  );

  router.delete(
    '/positions/:symbol',
    requireTradingExecution,
    validationMiddleware.symbol,
    validationMiddleware.closePosition,
    controller.closePosition
  );

  // Configuration Routes
  router.get(
    '/config',
    requirePermissions(['trading.read']),
    controller.getConfig
  );

  router.put(
    '/config',
    requirePermissions(['trading.write', 'system.write']),
    validationMiddleware.updateConfig,
    controller.updateConfig
  );

  // Trading Log and History Routes
  router.get(
    '/log',
    requireTradingAccess,
    validationMiddleware.tradingLog,
    controller.getTradingLog
  );

  router.get(
    '/session',
    requireTradingAccess,
    controller.getTradingSession
  );

  // Engine Control Routes (High Privilege)
  router.post(
    '/engine/start',
    requirePermissions(['trading.execute', 'system.write']),
    controller.startEngine
  );

  router.post(
    '/engine/stop',
    requirePermissions(['trading.execute', 'system.write']),
    controller.stopEngine
  );

  router.post(
    '/emergency-stop',
    requireTradingExecution,
    controller.emergencyStop
  );

  // Analytics and Reporting Routes
  router.get(
    '/patterns',
    requireTradingAccess,
    validationMiddleware.pagination,
    controller.getPatterns
  );

  router.get(
    '/performance',
    requireTradingAccess,
    validationMiddleware.dateRange,
    controller.getPerformance
  );

  router.get(
    '/chart',
    requireTradingAccess,
    validationMiddleware.getHistoricalData,
    controller.getChartData
  );

  router.get(
    '/stats',
    requireTradingAccess,
    controller.getStats
  );

  return router;
}

export default createTradingRoutes;