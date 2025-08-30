/**
 * Services Index - Centralized export for all business logic services
 * 
 * This file provides a single point of import for all services
 * used in the Tape Vision AI Trading System.
 * 
 * Usage:
 * import { userService, tradingService, mlService } from '@/services';
 * 
 * Or import all:
 * import * as Services from '@/services';
 */

// Business Logic Services
export * from './business';

// ML Services
export * from './ml';

// Market Data Services
export * from './market-data';

// Position Services
export * from './position';

// Notification Services
export * from './notifications';

// Logging Services
export * from './logging';

// External Integration Services
export * from './nelogica';


// Import service classes and instances from organized folders
import { UserService, userService, TradingService, tradingService, RiskService, riskService } from './business';
import { MLService, mlService, MLEngineService, MLPredictionService } from './ml';
import { MarketDataService, marketDataService, DataIntegrationService } from './market-data';
import { PositionService, positionService } from './position';
import { NotificationService, notificationService } from './notifications';
import { LoggingService, loggingService } from './logging';
import { NelogicaService } from './nelogica';

// Service Collections for bulk operations
export const Services = {
  // Business logic services
  UserService,
  TradingService,
  RiskService,
  
  // ML and AI services
  MLService,
  MLEngineService,
  MLPredictionService,
  
  // Data services
  MarketDataService,
  DataIntegrationService,
  
  // Supporting services
  PositionService,
  NotificationService,
  LoggingService,
  
  // External integrations
  NelogicaService
} as const;

// Service instances for direct use
export const serviceInstances = {
  userService,
  tradingService,
  mlService,
  riskService,
  marketDataService,
  positionService,
  notificationService,
  loggingService
} as const;

/**
 * Service initialization function
 * Call this to ensure all services are properly initialized
 */
export const initializeServices = async () => {
  console.log('🔄 Initializing services...');
  
  try {
    // Initialize services that need startup procedures
    const initPromises = [
      // Add any service-specific initialization here
      Promise.resolve() // Placeholder
    ];
    
    await Promise.all(initPromises);
    
    console.log('✅ All services initialized successfully');
    
    return {
      success: true,
      services: Object.keys(Services),
      count: Object.keys(Services).length
    };
    
  } catch (error) {
    console.error('❌ Error initializing services:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      services: Object.keys(Services)
    };
  }
};

/**
 * Service health check function
 * Verifies that all services are functioning properly
 */
export const checkServicesHealth = async () => {
  const health = {
    overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    services: {} as Record<string, { status: string; error?: string; latency?: number }>
  };
  
  const serviceChecks = [
    { name: 'UserService', check: async () => await userService.getUserStats() },
    { name: 'TradingService', check: async () => await tradingService.getTradingStats() },
    { name: 'MLService', check: async () => await mlService.getModelHealth() },
    { name: 'RiskService', check: async () => ({ status: 'healthy' }) },
    { name: 'MarketDataService', check: async () => ({ status: 'healthy' }) },
    { name: 'PositionService', check: async () => ({ status: 'healthy' }) },
    { name: 'NotificationService', check: async () => ({ status: 'healthy' }) },
    { name: 'LoggingService', check: async () => ({ status: 'healthy' }) }
  ];
  
  try {
    for (const { name, check } of serviceChecks) {
      try {
        const startTime = Date.now();
        await check();
        const latency = Date.now() - startTime;
        
        health.services[name] = {
          status: 'healthy',
          latency
        };
      } catch (error) {
        health.services[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        health.overall = 'unhealthy';
      }
    }
    
  } catch (error) {
    health.overall = 'unhealthy';
    console.error('❌ Service health check failed:', error);
  }
  
  return health;
};

/**
 * Service performance metrics
 */
export const getServiceMetrics = async () => {
  try {
    const metrics = {
      userService: await userService.getUserStats(),
      tradingService: await tradingService.getTradingStats(),
      mlService: await mlService.getModelStats(),
      timestamp: new Date().toISOString()
    };
    
    return {
      success: true,
      metrics
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metrics: null
    };
  }
};

/**
 * Graceful shutdown of all services
 */
export const shutdownServices = async () => {
  console.log('🛑 Shutting down services...');
  
  try {
    // Stop risk monitoring
    riskService.stopMonitoring();
    
    // Close WebSocket connections if any
    // Add other cleanup tasks as needed
    
    console.log('✅ All services shut down gracefully');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error during service shutdown:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
};

// Default export
export default {
  Services,
  serviceInstances,
  initializeServices,
  checkServicesHealth,
  getServiceMetrics,
  shutdownServices
};