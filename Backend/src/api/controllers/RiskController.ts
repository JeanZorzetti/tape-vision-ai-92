/**
 * Risk Management Controller - Tape Vision Trading System
 * Handles risk limits, monitoring, violations, and risk analysis
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, RiskLimits, RiskStatus, RiskViolation } from '../types/api';
import { APIContext } from '../index';
import { RiskParameters, Position } from '../../types/trading';
import { asyncHandler } from '../middleware/errorHandler';

export class RiskController {
  private context: APIContext;

  constructor(context: APIContext) {
    this.context = context;
  }

  /**
   * Get current risk status
   * GET /api/v1/risk/status
   */
  public getRiskStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const riskStatus = await riskManager.getRiskStatus();

      res.success(riskStatus, 'Risk status retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get risk status', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve risk status');
    }
  });

  /**
   * Get risk limits
   * GET /api/v1/risk/limits
   */
  public getRiskLimits = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const limits = riskManager.getCurrentLimits();

      res.success(limits, 'Risk limits retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get risk limits', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve risk limits');
    }
  });

  /**
   * Update risk limits
   * PUT /api/v1/risk/limits
   */
  public updateRiskLimits = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const newLimits: Partial<RiskParameters> = req.body;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      
      // Validate the new limits
      const validationResult = riskManager.validateLimits(newLimits);
      if (!validationResult.isValid) {
        res.error('Invalid risk limits', 400, 'VALIDATION_ERROR', {
          violations: validationResult.violations
        });
        return;
      }

      // Update the limits
      const updatedLimits = await riskManager.updateLimits(newLimits);

      this.context.logger.info('Risk limits updated', {
        userId: req.user?.id,
        changes: Object.keys(newLimits),
        newLimits: updatedLimits
      });

      res.success(updatedLimits, 'Risk limits updated successfully');
    } catch (error) {
      this.context.logger.error('Failed to update risk limits', { 
        error: error.message,
        newLimits,
        userId: req.user?.id 
      });
      res.serverError('Failed to update risk limits');
    }
  });

  /**
   * Get risk violations
   * GET /api/v1/risk/violations
   */
  public getRiskViolations = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page = 1, limit = 50, severity, acknowledged } = req.query;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const violations = await riskManager.getViolations({
        page: Number(page),
        limit: Number(limit),
        severity: severity as 'warning' | 'critical',
        acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined
      });

      res.paginated(
        violations.items,
        violations.page,
        violations.limit,
        violations.total,
        'Risk violations retrieved successfully'
      );
    } catch (error) {
      this.context.logger.error('Failed to get risk violations', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve risk violations');
    }
  });

  /**
   * Acknowledge a risk violation
   * PATCH /api/v1/risk/violations/:violationId/acknowledge
   */
  public acknowledgeViolation = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { violationId } = req.params;
    const { note } = req.body;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const violation = await riskManager.acknowledgeViolation(violationId, {
        acknowledgedBy: req.user?.id || req.apiKey?.id || 'unknown',
        acknowledgedAt: new Date(),
        note
      });

      this.context.logger.info('Risk violation acknowledged', {
        violationId,
        userId: req.user?.id,
        note
      });

      res.success(violation, 'Risk violation acknowledged successfully');
    } catch (error) {
      this.context.logger.error('Failed to acknowledge risk violation', { 
        error: error.message,
        violationId,
        userId: req.user?.id 
      });
      res.serverError('Failed to acknowledge risk violation');
    }
  });

  /**
   * Get risk metrics
   * GET /api/v1/risk/metrics
   */
  public getRiskMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { period = '1d' } = req.query;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const metrics = await riskManager.getRiskMetrics(period as string);

      res.success(metrics, 'Risk metrics retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get risk metrics', { 
        error: error.message,
        period,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve risk metrics');
    }
  });

  /**
   * Validate a potential trade against risk limits
   * POST /api/v1/risk/validate-trade
   */
  public validateTrade = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol, side, quantity, price } = req.body;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const validation = await riskManager.validateTrade({
        symbol,
        side,
        quantity,
        price
      });

      res.success({
        isValid: validation.passed,
        violations: validation.violations,
        riskScore: validation.riskScore,
        maxAllowedQuantity: validation.maxAllowedQuantity,
        riskMetrics: validation.riskMetrics
      }, 'Trade validation completed');
    } catch (error) {
      this.context.logger.error('Failed to validate trade', { 
        error: error.message,
        trade: { symbol, side, quantity, price },
        userId: req.user?.id 
      });
      res.serverError('Failed to validate trade');
    }
  });

  /**
   * Get position risk analysis
   * GET /api/v1/risk/position-analysis/:symbol
   */
  public getPositionRisk = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { symbol } = req.params;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const positionRisk = await riskManager.analyzePositionRisk(symbol);

      if (!positionRisk) {
        res.notFound('No position found for symbol');
        return;
      }

      res.success(positionRisk, `Position risk analysis for ${symbol} retrieved successfully`);
    } catch (error) {
      this.context.logger.error('Failed to get position risk analysis', { 
        error: error.message,
        symbol,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve position risk analysis');
    }
  });

  /**
   * Get portfolio risk summary
   * GET /api/v1/risk/portfolio
   */
  public getPortfolioRisk = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const portfolioRisk = await riskManager.getPortfolioRisk();

      res.success(portfolioRisk, 'Portfolio risk summary retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get portfolio risk', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve portfolio risk');
    }
  });

  /**
   * Get VaR (Value at Risk) calculations
   * GET /api/v1/risk/var
   */
  public getVaR = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { confidence = 95, period = 1 } = req.query;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const var95 = await riskManager.calculateVaR({
        confidenceLevel: Number(confidence),
        holdingPeriod: Number(period)
      });

      res.success(var95, 'VaR calculation completed successfully');
    } catch (error) {
      this.context.logger.error('Failed to calculate VaR', { 
        error: error.message,
        confidence,
        period,
        userId: req.user?.id 
      });
      res.serverError('Failed to calculate VaR');
    }
  });

  /**
   * Get stress test results
   * POST /api/v1/risk/stress-test
   */
  public runStressTest = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { scenarios } = req.body;

    if (!scenarios || !Array.isArray(scenarios)) {
      res.error('Stress test scenarios are required', 400);
      return;
    }

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const stressTestResults = await riskManager.runStressTest(scenarios);

      this.context.logger.info('Stress test completed', {
        userId: req.user?.id,
        scenarioCount: scenarios.length
      });

      res.success(stressTestResults, 'Stress test completed successfully');
    } catch (error) {
      this.context.logger.error('Failed to run stress test', { 
        error: error.message,
        scenarios,
        userId: req.user?.id 
      });
      res.serverError('Failed to run stress test');
    }
  });

  /**
   * Set risk alerts
   * POST /api/v1/risk/alerts
   */
  public createRiskAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { type, threshold, condition, isActive = true } = req.body;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const alert = await riskManager.createAlert({
        type,
        threshold,
        condition,
        isActive,
        createdBy: req.user?.id || req.apiKey?.id || 'unknown',
        createdAt: new Date()
      });

      this.context.logger.info('Risk alert created', {
        alertId: alert.id,
        type,
        threshold,
        userId: req.user?.id
      });

      res.success(alert, 'Risk alert created successfully');
    } catch (error) {
      this.context.logger.error('Failed to create risk alert', { 
        error: error.message,
        alertConfig: { type, threshold, condition },
        userId: req.user?.id 
      });
      res.serverError('Failed to create risk alert');
    }
  });

  /**
   * Get risk alerts
   * GET /api/v1/risk/alerts
   */
  public getRiskAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page = 1, limit = 50, isActive } = req.query;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const alerts = await riskManager.getAlerts({
        page: Number(page),
        limit: Number(limit),
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
      });

      res.paginated(
        alerts.items,
        alerts.page,
        alerts.limit,
        alerts.total,
        'Risk alerts retrieved successfully'
      );
    } catch (error) {
      this.context.logger.error('Failed to get risk alerts', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to retrieve risk alerts');
    }
  });

  /**
   * Update risk alert
   * PUT /api/v1/risk/alerts/:alertId
   */
  public updateRiskAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { alertId } = req.params;
    const updates = req.body;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const alert = await riskManager.updateAlert(alertId, {
        ...updates,
        updatedBy: req.user?.id || req.apiKey?.id || 'unknown',
        updatedAt: new Date()
      });

      this.context.logger.info('Risk alert updated', {
        alertId,
        changes: Object.keys(updates),
        userId: req.user?.id
      });

      res.success(alert, 'Risk alert updated successfully');
    } catch (error) {
      this.context.logger.error('Failed to update risk alert', { 
        error: error.message,
        alertId,
        updates,
        userId: req.user?.id 
      });
      res.serverError('Failed to update risk alert');
    }
  });

  /**
   * Delete risk alert
   * DELETE /api/v1/risk/alerts/:alertId
   */
  public deleteRiskAlert = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { alertId } = req.params;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      await riskManager.deleteAlert(alertId);

      this.context.logger.info('Risk alert deleted', {
        alertId,
        userId: req.user?.id
      });

      res.success({ alertId, status: 'deleted' }, 'Risk alert deleted successfully');
    } catch (error) {
      this.context.logger.error('Failed to delete risk alert', { 
        error: error.message,
        alertId,
        userId: req.user?.id 
      });
      res.serverError('Failed to delete risk alert');
    }
  });

  /**
   * Get risk report
   * GET /api/v1/risk/report
   */
  public getRiskReport = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { startDate, endDate, includeCharts = false } = req.query;

    try {
      const riskManager = this.context.tradingEngine.getRiskManager();
      const report = await riskManager.generateRiskReport({
        startDate: startDate as string,
        endDate: endDate as string,
        includeCharts: includeCharts === 'true'
      });

      res.success(report, 'Risk report generated successfully');
    } catch (error) {
      this.context.logger.error('Failed to generate risk report', { 
        error: error.message,
        startDate,
        endDate,
        userId: req.user?.id 
      });
      res.serverError('Failed to generate risk report');
    }
  });
}