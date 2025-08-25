/**
 * WebSocket Routes - Tape Vision Trading System
 * HTTP endpoints for WebSocket connection management
 */

import { Router } from 'express';
import { WebSocketHandlers } from '../websocket/handlers';
import { validationMiddleware } from '../middleware/validation';
import { requireMarketDataAccess } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthenticatedRequest } from '../types/api';
import { Response } from 'express';

export function createWebSocketRoutes(handlers: WebSocketHandlers): Router {
  const router = Router();

  /**
   * Get WebSocket connection info
   * GET /api/v1/ws/info
   */
  router.get('/info', asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const info = {
      endpoint: '/socket.io',
      protocols: ['websocket', 'polling'],
      authentication: 'JWT or API Key required',
      channels: [
        'market-data',
        'order-book', 
        'tape',
        'ai-status',
        'signals',
        'trades',
        'notifications',
        'system-status'
      ],
      permissions: {
        'market-data': ['market_data.read'],
        'order-book': ['market_data.read'],
        'tape': ['market_data.read'],
        'ai-status': ['trading.read'],
        'signals': ['trading.read'],
        'trades': ['trading.read'],
        'notifications': ['trading.read'],
        'system-status': ['system.read']
      }
    };

    res.success(info, 'WebSocket connection information');
  }));

  /**
   * Get active WebSocket connections (admin only)
   * GET /api/v1/ws/connections
   */
  router.get('/connections', asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const stats = {
      activeConnections: handlers.getActiveConnectionsCount(),
      totalConnections: handlers.getTotalConnectionsCount(),
      timestamp: Date.now()
    };

    res.success(stats, 'WebSocket connection statistics');
  }));

  /**
   * Get user's active subscriptions
   * GET /api/v1/ws/subscriptions
   */
  router.get('/subscriptions', 
    requireMarketDataAccess,
    asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
      const userId = req.user?.id || req.apiKey?.id || 'anonymous';
      const subscriptions = handlers.getUserSubscriptions(userId);

      res.success(subscriptions, 'Active subscriptions retrieved');
    })
  );

  return router;
}

export default createWebSocketRoutes;