/**
 * Models Index - Centralized export for all database models
 * 
 * This file provides a single point of import for all MongoDB models
 * used in the Tape Vision AI Trading System.
 * 
 * Usage:
 * import { User, Order, Position } from '@/models';
 * 
 * Or import all:
 * import * as Models from '@/models';
 */

// Core Models
export { User, IUser } from './User';
export { TradingSession, ITradingSession } from './TradingSession';
export { Order, IOrder } from './Order';
export { Position, IPosition } from './Position';
export { MLPrediction, IMLPrediction } from './MLPrediction';
export { MarketData, IMarketData } from './MarketData';
export { RiskManagement, IRiskManagement } from './RiskManagement';

// Model Collections for bulk operations
export const Models = {
  User,
  TradingSession,
  Order,
  Position,
  MLPrediction,
  MarketData,
  RiskManagement
} as const;

// Type exports for TypeScript support
export type {
  IUser,
  ITradingSession,
  IOrder,
  IPosition,
  IMLPrediction,
  IMarketData,
  IRiskManagement
};

// Import statements for re-export
import { User } from './User';
import { TradingSession } from './TradingSession';
import { Order } from './Order';
import { Position } from './Position';
import { MLPrediction } from './MLPrediction';
import { MarketData } from './MarketData';
import { RiskManagement } from './RiskManagement';

/**
 * Model initialization function
 * Call this to ensure all models are properly initialized with MongoDB
 */
export const initializeModels = async () => {
  console.log('🔄 Initializing models...');
  
  try {
    // Create indexes for all models
    await Promise.all([
      User.createIndexes(),
      TradingSession.createIndexes(),
      Order.createIndexes(),
      Position.createIndexes(),
      MLPrediction.createIndexes(),
      MarketData.createIndexes(),
      RiskManagement.createIndexes()
    ]);
    
    console.log('✅ All models initialized successfully');
    
    return {
      success: true,
      models: Object.keys(Models),
      count: Object.keys(Models).length
    };
    
  } catch (error) {
    console.error('❌ Error initializing models:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      models: Object.keys(Models)
    };
  }
};

/**
 * Model health check function
 * Verifies that all models can connect to the database
 */
export const checkModelsHealth = async () => {
  const health = {
    overall: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    models: {} as Record<string, { status: string; error?: string; count?: number }>
  };
  
  const modelChecks = [
    { name: 'User', model: User },
    { name: 'TradingSession', model: TradingSession },
    { name: 'Order', model: Order },
    { name: 'Position', model: Position },
    { name: 'MLPrediction', model: MLPrediction },
    { name: 'MarketData', model: MarketData },
    { name: 'RiskManagement', model: RiskManagement }
  ];
  
  try {
    for (const { name, model } of modelChecks) {
      try {
        const count = await model.countDocuments({});
        health.models[name] = {
          status: 'healthy',
          count
        };
      } catch (error) {
        health.models[name] = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        health.overall = 'unhealthy';
      }
    }
    
  } catch (error) {
    health.overall = 'unhealthy';
    console.error('❌ Model health check failed:', error);
  }
  
  return health;
};

/**
 * Cleanup function for development/testing
 * WARNING: This will delete ALL data from ALL collections
 */
export const cleanupAllModels = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot cleanup models in production environment');
  }
  
  console.log('🧹 Cleaning up all models...');
  
  try {
    await Promise.all([
      User.deleteMany({}),
      TradingSession.deleteMany({}),
      Order.deleteMany({}),
      Position.deleteMany({}),
      MLPrediction.deleteMany({}),
      MarketData.deleteMany({}),
      RiskManagement.deleteMany({})
    ]);
    
    console.log('✅ All models cleaned up');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Error cleaning up models:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

/**
 * Create default admin user for system initialization
 */
export const createDefaultAdmin = async () => {
  try {
    const existingAdmin = await User.findOne({ role: 'ADMIN' });
    
    if (!existingAdmin) {
      const adminUser = new User({
        email: 'admin@aitrading.com',
        password: 'admin2025', // Will be hashed by pre-save middleware
        name: 'System Administrator',
        role: 'ADMIN',
        permissions: [
          'TRADING_ENABLED',
          'ML_ACCESS',
          'ADMIN_ACCESS',
          'API_ACCESS',
          'RISK_OVERRIDE',
          'SESSION_MANAGEMENT',
          'USER_MANAGEMENT',
          'SYSTEM_CONFIG'
        ],
        isVerified: true,
        maxDailyLoss: 10000,
        maxPositionSize: 10
      });
      
      await adminUser.save();
      console.log('✅ Default admin user created');
      
      return { success: true, user: adminUser };
    } else {
      console.log('ℹ️  Admin user already exists');
      return { success: true, user: existingAdmin };
    }
    
  } catch (error) {
    console.error('❌ Error creating default admin:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
};

/**
 * Model statistics for monitoring
 */
export const getModelStatistics = async () => {
  try {
    const stats = await Promise.all([
      User.countDocuments({}).then(count => ({ model: 'User', count })),
      TradingSession.countDocuments({}).then(count => ({ model: 'TradingSession', count })),
      Order.countDocuments({}).then(count => ({ model: 'Order', count })),
      Position.countDocuments({}).then(count => ({ model: 'Position', count })),
      MLPrediction.countDocuments({}).then(count => ({ model: 'MLPrediction', count })),
      MarketData.countDocuments({}).then(count => ({ model: 'MarketData', count })),
      RiskManagement.countDocuments({}).then(count => ({ model: 'RiskManagement', count }))
    ]);
    
    const totalDocuments = stats.reduce((sum, stat) => sum + stat.count, 0);
    
    return {
      success: true,
      statistics: stats,
      totalDocuments,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      statistics: [],
      totalDocuments: 0
    };
  }
};

// Default export
export default {
  Models,
  initializeModels,
  checkModelsHealth,
  cleanupAllModels,
  createDefaultAdmin,
  getModelStatistics
};