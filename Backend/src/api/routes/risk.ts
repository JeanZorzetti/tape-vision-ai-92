/**
 * Risk Management Routes - Tape Vision Trading System
 * Defines all risk management API endpoints with proper validation and authorization
 */

import { Router } from 'express';
import { RiskController } from '../controllers/RiskController';
import { validationMiddleware } from '../middleware/validation';
import { requireRiskAccess, requirePermissions } from '../middleware/auth';
import { cacheResponse } from '../middleware/responseFormatter';

export function createRiskRoutes(controller: RiskController): Router {
  const router = Router();

  // Risk Status and Monitoring Routes
  router.get(
    '/status',
    requireRiskAccess,
    controller.getRiskStatus
  );

  router.get(
    '/limits',
    requireRiskAccess,
    cacheResponse(30), // 30 second cache for limits
    controller.getRiskLimits
  );

  router.put(
    '/limits',
    requirePermissions(['risk.write']),
    validationMiddleware.updateRiskLimits,
    controller.updateRiskLimits
  );

  // Risk Violations Routes
  router.get(
    '/violations',
    requireRiskAccess,
    validationMiddleware.pagination,
    controller.getRiskViolations
  );

  router.patch(
    '/violations/:violationId/acknowledge',
    requirePermissions(['risk.write']),
    validationMiddleware.id,
    controller.acknowledgeViolation
  );

  // Risk Analysis Routes
  router.get(
    '/metrics',
    requireRiskAccess,
    validationMiddleware.dateRange,
    cacheResponse(60), // 1 minute cache for metrics
    controller.getRiskMetrics
  );

  router.post(
    '/validate-trade',
    requirePermissions(['trading.read', 'risk.read']),
    controller.validateTrade
  );

  router.get(
    '/position-analysis/:symbol',
    requireRiskAccess,
    validationMiddleware.symbol,
    controller.getPositionRisk
  );

  router.get(
    '/portfolio',
    requireRiskAccess,
    cacheResponse(30), // 30 second cache for portfolio risk
    controller.getPortfolioRisk
  );

  // Advanced Risk Analytics Routes
  router.get(
    '/var',
    requirePermissions(['risk.read', 'analytics.read']),
    controller.getVaR
  );

  router.post(
    '/stress-test',
    requirePermissions(['risk.read', 'analytics.read']),
    controller.runStressTest
  );

  // Risk Alerts Routes
  router.post(
    '/alerts',
    requirePermissions(['risk.write']),
    controller.createRiskAlert
  );

  router.get(
    '/alerts',
    requireRiskAccess,
    validationMiddleware.pagination,
    controller.getRiskAlerts
  );

  router.put(
    '/alerts/:alertId',
    requirePermissions(['risk.write']),
    validationMiddleware.id,
    controller.updateRiskAlert
  );

  router.delete(
    '/alerts/:alertId',
    requirePermissions(['risk.write']),
    validationMiddleware.id,
    controller.deleteRiskAlert
  );

  // Risk Reporting Routes
  router.get(
    '/report',
    requirePermissions(['risk.read', 'analytics.read']),
    validationMiddleware.dateRange,
    cacheResponse(300), // 5 minute cache for reports
    controller.getRiskReport
  );

  return router;
}

export default createRiskRoutes;