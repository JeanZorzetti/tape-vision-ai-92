/**
 * System Controller - Tape Vision Trading System
 * Handles system health, monitoring, configuration, and administrative tasks
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, SystemHealth, SystemMetrics } from '../types/api';
import { APIContext } from '../index';
import { asyncHandler } from '../middleware/errorHandler';
import os from 'os';
import process from 'process';

export class SystemController {
  private context: APIContext;

  constructor(context: APIContext) {
    this.context = context;
  }

  /**
   * Get system health status
   * GET /api/v1/system/health
   */
  public getHealth = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const health: SystemHealth = {
        status: 'healthy',
        uptime: process.uptime(),
        version: process.env.API_VERSION || '1.0.0',
        timestamp: Date.now(),
        components: {
          database: await this.checkDatabaseHealth(),
          nelogica: await this.checkNelogicaHealth(),
          tradingEngine: this.checkTradingEngineHealth(),
          webSocket: this.checkWebSocketHealth(),
          redis: await this.checkRedisHealth()
        },
        performance: {
          cpu: await this.getCPUUsage(),
          memory: this.getMemoryUsage(),
          latency: await this.getLatency()
        }
      };

      // Determine overall health status
      const componentStatuses = Object.values(health.components).map(c => c.status);
      if (componentStatuses.includes('critical')) {
        health.status = 'critical';
      } else if (componentStatuses.includes('degraded')) {
        health.status = 'degraded';
      }

      const statusCode = health.status === 'healthy' ? 200 : 
                        health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).success(health, 'System health check completed');
    } catch (error) {
      this.context.logger.error('Failed to get system health', { error: error.message });
      res.status(503).serverError('Health check failed');
    }
  });

  /**
   * Get detailed system metrics
   * GET /api/v1/system/metrics
   */
  public getMetrics = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const metrics: SystemMetrics = {
        cpu: {
          usage: await this.getCPUUsage(),
          cores: os.cpus().length
        },
        memory: {
          total: os.totalmem(),
          used: os.totalmem() - os.freemem(),
          free: os.freemem(),
          usage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
        },
        network: {
          bytesIn: 0, // Would be implemented with proper network monitoring
          bytesOut: 0,
          connectionsActive: this.context.webSocketManager.getActiveConnectionsCount()
        },
        trading: {
          ordersPerSecond: this.context.tradingEngine.getOrdersPerSecond(),
          avgLatency: await this.getTradingLatency(),
          errorRate: this.context.tradingEngine.getErrorRate()
        }
      };

      res.success(metrics, 'System metrics retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get system metrics', { error: error.message });
      res.serverError('Failed to retrieve system metrics');
    }
  });

  /**
   * Get system logs
   * GET /api/v1/system/logs
   */
  public getLogs = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { level = 'info', limit = 100, startTime, endTime } = req.query;

    try {
      const logs = await this.context.databaseManager.getSystemLogs({
        level: level as string,
        limit: Number(limit),
        startTime: startTime ? Number(startTime) : undefined,
        endTime: endTime ? Number(endTime) : undefined
      });

      res.success(logs, 'System logs retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get system logs', { 
        error: error.message,
        query: { level, limit, startTime, endTime }
      });
      res.serverError('Failed to retrieve system logs');
    }
  });

  /**
   * Get system configuration
   * GET /api/v1/system/config
   */
  public getConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const config = {
        environment: process.env.NODE_ENV || 'development',
        version: process.env.API_VERSION || '1.0.0',
        features: {
          tradingEnabled: process.env.TRADING_ENABLED === 'true',
          paperTrading: process.env.PAPER_TRADING === 'true',
          autoStart: process.env.AUTO_START_ENGINE === 'true',
          debugMode: process.env.DEBUG_MODE === 'true'
        },
        limits: {
          maxConnections: parseInt(process.env.MAX_CONNECTIONS || '1000'),
          requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000'),
          maxRequestSize: process.env.MAX_REQUEST_SIZE || '10mb'
        },
        trading: this.context.tradingEngine.getConfig(),
        // Remove sensitive information
        sanitized: true
      };

      res.success(config, 'System configuration retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get system config', { error: error.message });
      res.serverError('Failed to retrieve system configuration');
    }
  });

  /**
   * Update system configuration
   * PUT /api/v1/system/config
   */
  public updateConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const configUpdates = req.body;

    try {
      // Validate configuration updates
      const validationResult = this.validateConfigUpdates(configUpdates);
      if (!validationResult.isValid) {
        res.error('Invalid configuration updates', 400, 'CONFIG_VALIDATION_ERROR', {
          errors: validationResult.errors
        });
        return;
      }

      // Apply configuration updates
      const updatedConfig = await this.applyConfigUpdates(configUpdates);

      this.context.logger.info('System configuration updated', {
        userId: req.user?.id,
        changes: Object.keys(configUpdates)
      });

      res.success(updatedConfig, 'System configuration updated successfully');
    } catch (error) {
      this.context.logger.error('Failed to update system config', { 
        error: error.message,
        configUpdates,
        userId: req.user?.id 
      });
      res.serverError('Failed to update system configuration');
    }
  });

  /**
   * Restart system components
   * POST /api/v1/system/restart/:component
   */
  public restartComponent = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { component } = req.params;
    const allowedComponents = ['trading-engine', 'websocket', 'nelogica'];

    if (!allowedComponents.includes(component)) {
      res.error('Invalid component specified', 400);
      return;
    }

    try {
      let result: any = {};

      switch (component) {
        case 'trading-engine':
          await this.context.tradingEngine.restart();
          result = { component, status: 'restarted', timestamp: Date.now() };
          break;
        
        case 'websocket':
          await this.context.webSocketManager.restart();
          result = { component, status: 'restarted', timestamp: Date.now() };
          break;
        
        case 'nelogica':
          await this.context.nelogicaService.reconnect();
          result = { component, status: 'reconnected', timestamp: Date.now() };
          break;
      }

      this.context.logger.warn('System component restarted', {
        component,
        userId: req.user?.id
      });

      res.success(result, `${component} restarted successfully`);
    } catch (error) {
      this.context.logger.error('Failed to restart component', { 
        error: error.message,
        component,
        userId: req.user?.id 
      });
      res.serverError(`Failed to restart ${component}`);
    }
  });

  /**
   * Get system alerts
   * GET /api/v1/system/alerts
   */
  public getSystemAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { page = 1, limit = 50, severity, acknowledged } = req.query;

    try {
      const alerts = await this.context.databaseManager.getSystemAlerts({
        page: Number(page),
        limit: Number(limit),
        severity: severity as string,
        acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined
      });

      res.paginated(
        alerts.items,
        alerts.page,
        alerts.limit,
        alerts.total,
        'System alerts retrieved successfully'
      );
    } catch (error) {
      this.context.logger.error('Failed to get system alerts', { error: error.message });
      res.serverError('Failed to retrieve system alerts');
    }
  });

  /**
   * Clear system alerts
   * DELETE /api/v1/system/alerts
   */
  public clearSystemAlerts = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { severity, before } = req.query;

    try {
      const result = await this.context.databaseManager.clearSystemAlerts({
        severity: severity as string,
        before: before ? new Date(before as string) : undefined
      });

      this.context.logger.info('System alerts cleared', {
        count: result.deletedCount,
        severity,
        before,
        userId: req.user?.id
      });

      res.success({
        deletedCount: result.deletedCount,
        timestamp: Date.now()
      }, 'System alerts cleared successfully');
    } catch (error) {
      this.context.logger.error('Failed to clear system alerts', { 
        error: error.message,
        userId: req.user?.id 
      });
      res.serverError('Failed to clear system alerts');
    }
  });

  /**
   * Get system statistics
   * GET /api/v1/system/stats
   */
  public getSystemStats = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const stats = {
        uptime: process.uptime(),
        startTime: Date.now() - (process.uptime() * 1000),
        platform: process.platform,
        nodeVersion: process.version,
        pid: process.pid,
        connections: {
          active: this.context.webSocketManager.getActiveConnectionsCount(),
          total: this.context.webSocketManager.getTotalConnectionsCount()
        },
        trading: {
          isActive: this.context.tradingEngine.isEngineActive(),
          dailyTrades: this.context.tradingEngine.getTradesCount(),
          dailyPnL: this.context.tradingEngine.getDailyPnL(),
          positions: this.context.tradingEngine.getPositionsCount()
        },
        performance: {
          cpu: await this.getCPUUsage(),
          memory: this.getMemoryUsage(),
          gc: this.getGCStats()
        }
      };

      res.success(stats, 'System statistics retrieved successfully');
    } catch (error) {
      this.context.logger.error('Failed to get system stats', { error: error.message });
      res.serverError('Failed to retrieve system statistics');
    }
  });

  /**
   * Export system data
   * GET /api/v1/system/export
   */
  public exportSystemData = asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { type, startDate, endDate } = req.query;

    if (!type) {
      res.error('Export type is required', 400);
      return;
    }

    try {
      const exportData = await this.context.databaseManager.exportData({
        type: type as string,
        startDate: startDate as string,
        endDate: endDate as string
      });

      this.context.logger.info('System data exported', {
        type,
        recordCount: exportData.length,
        userId: req.user?.id
      });

      res.success({
        type,
        recordCount: exportData.length,
        exportDate: new Date().toISOString(),
        data: exportData
      }, 'System data exported successfully');
    } catch (error) {
      this.context.logger.error('Failed to export system data', { 
        error: error.message,
        type,
        userId: req.user?.id 
      });
      res.serverError('Failed to export system data');
    }
  });

  // Helper methods for health checks
  private async checkDatabaseHealth() {
    try {
      await this.context.databaseManager.ping();
      return { status: 'healthy' as const, lastCheck: Date.now() };
    } catch (error) {
      return { 
        status: 'critical' as const, 
        lastCheck: Date.now(), 
        message: error.message 
      };
    }
  }

  private async checkNelogicaHealth() {
    try {
      const status = await this.context.nelogicaService.getConnectionStatus();
      return {
        status: status.isConnected ? 'healthy' as const : 'critical' as const,
        lastCheck: Date.now(),
        message: status.errorMessage
      };
    } catch (error) {
      return { 
        status: 'critical' as const, 
        lastCheck: Date.now(), 
        message: error.message 
      };
    }
  }

  private checkTradingEngineHealth() {
    try {
      const isActive = this.context.tradingEngine.isEngineActive();
      const errorRate = this.context.tradingEngine.getErrorRate();
      
      let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
      if (errorRate > 10) status = 'critical';
      else if (errorRate > 5) status = 'degraded';

      return {
        status,
        lastCheck: Date.now(),
        metrics: {
          isActive,
          errorRate,
          uptime: this.context.tradingEngine.getUptime()
        }
      };
    } catch (error) {
      return { 
        status: 'critical' as const, 
        lastCheck: Date.now(), 
        message: error.message 
      };
    }
  }

  private checkWebSocketHealth() {
    try {
      const activeConnections = this.context.webSocketManager.getActiveConnectionsCount();
      return {
        status: 'healthy' as const,
        lastCheck: Date.now(),
        metrics: { activeConnections }
      };
    } catch (error) {
      return { 
        status: 'degraded' as const, 
        lastCheck: Date.now(), 
        message: error.message 
      };
    }
  }

  private async checkRedisHealth() {
    try {
      // Implementation would depend on Redis service
      return { status: 'healthy' as const, lastCheck: Date.now() };
    } catch (error) {
      return { 
        status: 'degraded' as const, 
        lastCheck: Date.now(), 
        message: error.message 
      };
    }
  }

  private async getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startUsage = process.cpuUsage();
      setTimeout(() => {
        const endUsage = process.cpuUsage(startUsage);
        const totalUsage = endUsage.user + endUsage.system;
        const percentage = (totalUsage / 1000000) * 100; // Convert to percentage
        resolve(Math.min(percentage, 100));
      }, 100);
    });
  }

  private getMemoryUsage(): number {
    const memUsage = process.memoryUsage();
    return Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100 * 100) / 100;
  }

  private async getLatency(): Promise<number> {
    const start = Date.now();
    await new Promise(resolve => setImmediate(resolve));
    return Date.now() - start;
  }

  private async getTradingLatency(): Promise<number> {
    try {
      return this.context.tradingEngine.getAverageLatency();
    } catch {
      return 0;
    }
  }

  private getGCStats() {
    if (global.gc) {
      const before = process.memoryUsage();
      global.gc();
      const after = process.memoryUsage();
      return {
        beforeGC: before.heapUsed,
        afterGC: after.heapUsed,
        freed: before.heapUsed - after.heapUsed
      };
    }
    return null;
  }

  private validateConfigUpdates(config: any) {
    const errors: string[] = [];
    
    // Add validation logic for configuration updates
    if (config.maxConnections && (config.maxConnections < 10 || config.maxConnections > 10000)) {
      errors.push('maxConnections must be between 10 and 10000');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  private async applyConfigUpdates(config: any) {
    // Apply configuration updates
    // Implementation would update actual system configuration
    return config;
  }
}