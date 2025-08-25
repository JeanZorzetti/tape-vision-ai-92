/**
 * System Management Routes - Tape Vision Trading System
 * Defines all system management API endpoints with proper validation and authorization
 */

import { Router } from 'express';
import { SystemController } from '../controllers/SystemController';
import { validationMiddleware } from '../middleware/validation';
import { requireSystemAccess, requireAdminAccess, requirePermissions } from '../middleware/auth';
import { cacheResponse } from '../middleware/responseFormatter';

export function createSystemRoutes(controller: SystemController): Router {
  const router = Router();

  // Public health check (no authentication required for basic monitoring)
  router.get(
    '/health',
    controller.getHealth
  );

  // System monitoring routes (require system access)
  router.get(
    '/metrics',
    requireSystemAccess,
    cacheResponse(30), // 30 second cache for metrics
    controller.getMetrics
  );

  router.get(
    '/stats',
    requireSystemAccess,
    cacheResponse(60), // 1 minute cache for stats
    controller.getSystemStats
  );

  // System logs routes (admin access required)
  router.get(
    '/logs',
    requireAdminAccess,
    validationMiddleware.pagination,
    controller.getLogs
  );

  // Configuration routes
  router.get(
    '/config',
    requireSystemAccess,
    cacheResponse(300), // 5 minute cache for config
    controller.getConfig
  );

  router.put(
    '/config',
    requirePermissions(['system.admin']),
    validationMiddleware.updateConfig,
    controller.updateConfig
  );

  // System control routes (admin only)
  router.post(
    '/restart/:component',
    requireAdminAccess,
    controller.restartComponent
  );

  // System alerts routes
  router.get(
    '/alerts',
    requireSystemAccess,
    validationMiddleware.pagination,
    controller.getSystemAlerts
  );

  router.delete(
    '/alerts',
    requirePermissions(['system.admin']),
    controller.clearSystemAlerts
  );

  // Data export routes (admin access required)
  router.get(
    '/export',
    requireAdminAccess,
    validationMiddleware.dateRange,
    controller.exportSystemData
  );

  return router;
}

export default createSystemRoutes;