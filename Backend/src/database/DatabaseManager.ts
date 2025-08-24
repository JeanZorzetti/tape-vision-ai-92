/**
 * Database Manager - MongoDB Integration for Trading Data
 * Handles all database operations for the trading system
 */

import mongoose, { Connection, Document } from 'mongoose';
import { Logger } from 'winston';
import {
  TradingConfig,
  TradeEntry,
  TradingSession,
  ChartDataPoint,
  MarketData,
  Position,
  PaginatedResponse
} from '@/types/trading';

// MongoDB Schemas
const TradeEntrySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  timestamp: { type: String, required: true },
  action: { type: String, enum: ['BUY', 'SELL', 'ANALYSIS', 'ALERT', 'ERROR'], required: true },
  symbol: { type: String, required: true },
  price: { type: Number },
  quantity: { type: Number },
  confidence: { type: Number },
  reason: { type: String, required: true },
  pnl: { type: Number },
  status: { type: String, enum: ['success', 'pending', 'failed'], required: true },
  orderId: { type: String },
  executionTime: { type: Number },
  slippage: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

const TradingConfigSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  timeframe: { type: Number, required: true },
  riskParameters: {
    maxDailyLoss: { type: Number, required: true },
    maxPositionSize: { type: Number, required: true },
    stopLossPoints: { type: Number, required: true },
    takeProfitPoints: { type: Number, required: true },
    maxDrawdown: { type: Number, required: true },
    consecutiveStopLimit: { type: Number, required: true },
    minimumConfidence: { type: Number, required: true }
  },
  patternSettings: {
    absorptionThreshold: { type: Number, default: 0.7 },
    volumeClusterDistance: { type: Number, default: 5 },
    aggressionThreshold: { type: Number, default: 0.6 }
  },
  analysisSettings: {
    confidenceThreshold: { type: Number, required: true },
    patternWeight: { type: Number, required: true },
    volumeWeight: { type: Number, required: true },
    priceActionWeight: { type: Number, required: true }
  },
  updatedAt: { type: Date, default: Date.now }
});

const TradingSessionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  startTime: { type: Number, required: true },
  endTime: { type: Number },
  totalTrades: { type: Number, default: 0 },
  winningTrades: { type: Number, default: 0 },
  losingTrades: { type: Number, default: 0 },
  totalPnl: { type: Number, default: 0 },
  maxDrawdown: { type: Number, default: 0 },
  sharpeRatio: { type: Number, default: 0 },
  winRate: { type: Number, default: 0 },
  avgWin: { type: Number, default: 0 },
  avgLoss: { type: Number, default: 0 },
  profitFactor: { type: Number, default: 0 },
  trades: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TradeEntry' }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const MarketDataSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  timestamp: { type: Number, required: true },
  price: { type: Number, required: true },
  priceChange: { type: Number, required: true },
  volume: { type: Number, required: true },
  volatility: { type: Number, required: true },
  spread: { type: Number, required: true },
  sessionTime: { type: String, required: true },
  marketPhase: { type: String, enum: ['pre-market', 'open', 'close', 'after-hours'], required: true },
  liquidityLevel: { type: String, enum: ['low', 'medium', 'high'], required: true },
  orderBookImbalance: { type: Number, required: true },
  bid: { type: Number, required: true },
  ask: { type: Number, required: true },
  last: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

const ChartDataSchema = new mongoose.Schema({
  symbol: { type: String, required: true },
  timestamp: { type: Number, required: true },
  open: { type: Number, required: true },
  high: { type: Number, required: true },
  low: { type: Number, required: true },
  close: { type: Number, required: true },
  volume: { type: Number, required: true },
  buyVolume: { type: Number },
  sellVolume: { type: Number },
  orderFlow: { type: Number },
  timeframe: { type: Number, required: true }, // in milliseconds
  createdAt: { type: Date, default: Date.now }
});

// Models
interface ITradeEntry extends Document, TradeEntry {}
interface ITradingConfig extends Document, TradingConfig {}
interface ITradingSession extends Document, TradingSession {}
interface IMarketData extends Document, MarketData {}
interface IChartData extends Document {
  symbol: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
  orderFlow?: number;
  timeframe: number;
}

export class DatabaseManager {
  private connection: Connection | null = null;
  private logger: Logger;
  private isConnected: boolean = false;
  
  // Models
  private TradeEntryModel: mongoose.Model<ITradeEntry>;
  private TradingConfigModel: mongoose.Model<ITradingConfig>;
  private TradingSessionModel: mongoose.Model<ITradingSession>;
  private MarketDataModel: mongoose.Model<IMarketData>;
  private ChartDataModel: mongoose.Model<IChartData>;
  
  private currentTradingSession: ITradingSession | null = null;

  constructor(logger: Logger) {
    this.logger = logger.child({ component: 'DatabaseManager' });
    
    // Create models
    this.TradeEntryModel = mongoose.model<ITradeEntry>('TradeEntry', TradeEntrySchema);
    this.TradingConfigModel = mongoose.model<ITradingConfig>('TradingConfig', TradingConfigSchema);
    this.TradingSessionModel = mongoose.model<ITradingSession>('TradingSession', TradingSessionSchema);
    this.MarketDataModel = mongoose.model<IMarketData>('MarketData', MarketDataSchema);
    this.ChartDataModel = mongoose.model<IChartData>('ChartData', ChartDataSchema);
    
    // Setup mongoose events
    mongoose.connection.on('connected', () => {
      this.logger.info('MongoDB connected successfully');
      this.isConnected = true;
    });
    
    mongoose.connection.on('error', (error) => {
      this.logger.error('MongoDB connection error', error);
      this.isConnected = false;
    });
    
    mongoose.connection.on('disconnected', () => {
      this.logger.info('MongoDB disconnected');
      this.isConnected = false;
    });
  }

  public async connect(): Promise<void> {
    try {
      const mongoUrl = process.env.MONGODB_URL || 'mongodb://localhost:27017/tape-vision-trading';
      
      this.logger.info('Connecting to MongoDB', { url: mongoUrl.replace(/\/\/.*@/, '//***:***@') });
      
      await mongoose.connect(mongoUrl, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        family: 4
      });
      
      this.connection = mongoose.connection;
      
      // Initialize default trading config if not exists
      await this.initializeDefaultConfig();
      
      // Create current trading session
      await this.createCurrentSession();
      
      this.logger.info('Database Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to connect to MongoDB', error);
      throw error;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.connection) {
      await mongoose.connection.close();
      this.connection = null;
      this.isConnected = false;
      this.logger.info('MongoDB disconnected successfully');
    }
  }

  private async initializeDefaultConfig(): Promise<void> {
    try {
      const existingConfig = await this.TradingConfigModel.findOne();
      
      if (!existingConfig) {
        const defaultConfig: TradingConfig = {
          symbol: 'WDO',
          timeframe: 60000,
          riskParameters: {
            maxDailyLoss: 500,
            maxPositionSize: 5,
            stopLossPoints: 15,
            takeProfitPoints: 30,
            maxDrawdown: 1000,
            consecutiveStopLimit: 3,
            minimumConfidence: 90
          },
          patternSettings: {
            absorptionThreshold: 0.7,
            volumeClusterDistance: 5,
            aggressionThreshold: 0.6
          },
          analysisSettings: {
            confidenceThreshold: 90,
            patternWeight: 0.3,
            volumeWeight: 0.3,
            priceActionWeight: 0.4
          }
        };
        
        await new this.TradingConfigModel(defaultConfig).save();
        this.logger.info('Default trading configuration created');
      }
    } catch (error) {
      this.logger.error('Error initializing default config', error);
    }
  }

  private async createCurrentSession(): Promise<void> {
    try {
      // Check if there's an active session today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      
      let activeSession = await this.TradingSessionModel.findOne({
        startTime: { $gte: today.getTime(), $lte: endOfDay.getTime() },
        isActive: true
      });
      
      if (!activeSession) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        activeSession = new this.TradingSessionModel({
          id: sessionId,
          startTime: Date.now(),
          isActive: true
        });
        
        await activeSession.save();
        this.logger.info('New trading session created', { sessionId });
      }
      
      this.currentTradingSession = activeSession;
      
    } catch (error) {
      this.logger.error('Error creating current session', error);
    }
  }

  // Trading Operations
  public async saveTrade(trade: TradeEntry): Promise<ITradeEntry> {
    try {
      const tradeDoc = new this.TradeEntryModel(trade);
      const savedTrade = await tradeDoc.save();
      
      // Add to current session
      if (this.currentTradingSession && ['BUY', 'SELL'].includes(trade.action)) {
        this.currentTradingSession.trades.push(savedTrade._id);
        this.currentTradingSession.totalTrades++;
        
        if (trade.pnl !== undefined) {
          this.currentTradingSession.totalPnl += trade.pnl;
          
          if (trade.pnl > 0) {
            this.currentTradingSession.winningTrades++;
            this.currentTradingSession.avgWin = 
              (this.currentTradingSession.avgWin * (this.currentTradingSession.winningTrades - 1) + trade.pnl) / 
              this.currentTradingSession.winningTrades;
          } else if (trade.pnl < 0) {
            this.currentTradingSession.losingTrades++;
            this.currentTradingSession.avgLoss = 
              (this.currentTradingSession.avgLoss * (this.currentTradingSession.losingTrades - 1) + Math.abs(trade.pnl)) / 
              this.currentTradingSession.losingTrades;
          }
          
          // Update win rate
          this.currentTradingSession.winRate = 
            (this.currentTradingSession.winningTrades / this.currentTradingSession.totalTrades) * 100;
          
          // Update profit factor
          if (this.currentTradingSession.avgLoss > 0) {
            this.currentTradingSession.profitFactor = 
              this.currentTradingSession.avgWin / this.currentTradingSession.avgLoss;
          }
        }
        
        await this.currentTradingSession.save();
      }
      
      this.logger.debug('Trade saved to database', { tradeId: trade.id });
      return savedTrade;
      
    } catch (error) {
      this.logger.error('Error saving trade', error);
      throw error;
    }
  }

  public async getTradingLog(page: number = 1, limit: number = 50, action?: string): Promise<PaginatedResponse<TradeEntry>> {
    try {
      const skip = (page - 1) * limit;
      const query = action ? { action } : {};
      
      const [items, total] = await Promise.all([
        this.TradeEntryModel.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.TradeEntryModel.countDocuments(query)
      ]);
      
      return {
        items: items.map(item => ({
          id: item.id,
          timestamp: item.timestamp,
          action: item.action,
          symbol: item.symbol,
          price: item.price,
          quantity: item.quantity,
          confidence: item.confidence,
          reason: item.reason,
          pnl: item.pnl,
          status: item.status,
          orderId: item.orderId,
          executionTime: item.executionTime,
          slippage: item.slippage
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };
      
    } catch (error) {
      this.logger.error('Error getting trading log', error);
      throw error;
    }
  }

  // Configuration Management
  public async getTradingConfig(): Promise<TradingConfig> {
    try {
      const config = await this.TradingConfigModel.findOne().lean();
      
      if (!config) {
        throw new Error('Trading configuration not found');
      }
      
      return {
        symbol: config.symbol,
        timeframe: config.timeframe,
        riskParameters: config.riskParameters,
        patternSettings: config.patternSettings || {
          absorptionThreshold: 0.7,
          volumeClusterDistance: 5,
          aggressionThreshold: 0.6
        },
        analysisSettings: config.analysisSettings
      };
      
    } catch (error) {
      this.logger.error('Error getting trading config', error);
      throw error;
    }
  }

  public async updateTradingConfig(updates: Partial<TradingConfig>): Promise<TradingConfig> {
    try {
      const updatedConfig = await this.TradingConfigModel.findOneAndUpdate(
        {},
        { ...updates, updatedAt: new Date() },
        { new: true, upsert: true }
      ).lean();
      
      this.logger.info('Trading configuration updated', updates);
      
      return {
        symbol: updatedConfig.symbol,
        timeframe: updatedConfig.timeframe,
        riskParameters: updatedConfig.riskParameters,
        patternSettings: updatedConfig.patternSettings,
        analysisSettings: updatedConfig.analysisSettings
      };
      
    } catch (error) {
      this.logger.error('Error updating trading config', error);
      throw error;
    }
  }

  // Session Management
  public async getCurrentTradingSession(): Promise<TradingSession> {
    try {
      if (!this.currentTradingSession) {
        await this.createCurrentSession();
      }
      
      const session = this.currentTradingSession!;
      
      return {
        id: session.id,
        startTime: session.startTime,
        endTime: session.endTime,
        totalTrades: session.totalTrades,
        winningTrades: session.winningTrades,
        losingTrades: session.losingTrades,
        totalPnl: session.totalPnl,
        maxDrawdown: session.maxDrawdown,
        sharpeRatio: session.sharpeRatio,
        winRate: session.winRate,
        avgWin: session.avgWin,
        avgLoss: session.avgLoss,
        profitFactor: session.profitFactor
      };
      
    } catch (error) {
      this.logger.error('Error getting current session', error);
      throw error;
    }
  }

  // Market Data Storage
  public async saveMarketData(data: MarketData): Promise<void> {
    try {
      const marketDataDoc = new this.MarketDataModel(data);
      await marketDataDoc.save();
      
      // Clean old data (keep last 24 hours)
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
      await this.MarketDataModel.deleteMany({
        timestamp: { $lt: cutoffTime }
      });
      
    } catch (error) {
      this.logger.error('Error saving market data', error);
      // Don't throw - market data saving is not critical
    }
  }

  public async getChartData(timeframe: number, limit: number): Promise<ChartDataPoint[]> {
    try {
      const chartData = await this.ChartDataModel.find({
        timeframe: timeframe
      })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean()
        .exec();
      
      return chartData.map(item => ({
        timestamp: item.timestamp,
        value: item.close,
        volume: item.volume,
        buyVolume: item.buyVolume,
        sellVolume: item.sellVolume,
        orderFlow: item.orderFlow
      })).reverse(); // Reverse to get chronological order
      
    } catch (error) {
      this.logger.error('Error getting chart data', error);
      
      // Return mock data if database fails
      const now = Date.now();
      return Array.from({ length: Math.min(limit, 50) }, (_, i) => ({
        timestamp: now - (limit - i) * timeframe,
        value: 5980 + Math.sin(i * 0.1) * 10 + Math.random() * 5,
        volume: Math.floor(Math.random() * 1000) + 500
      }));
    }
  }

  // Utility Methods
  public isConnectedToDatabase(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }

  public async getHealthStatus(): Promise<{
    connected: boolean;
    readyState: number;
    host?: string;
    name?: string;
  }> {
    return {
      connected: this.isConnected,
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name
    };
  }

  public async cleanupOldData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffTime = cutoffDate.getTime();
      
      const results = await Promise.all([
        this.MarketDataModel.deleteMany({ timestamp: { $lt: cutoffTime } }),
        this.ChartDataModel.deleteMany({ timestamp: { $lt: cutoffTime } }),
        this.TradingSessionModel.updateMany(
          { startTime: { $lt: cutoffTime }, isActive: true },
          { isActive: false, endTime: cutoffTime }
        )
      ]);
      
      this.logger.info('Database cleanup completed', {
        marketDataDeleted: results[0].deletedCount,
        chartDataDeleted: results[1].deletedCount,
        sessionsArchived: results[2].modifiedCount
      });
      
    } catch (error) {
      this.logger.error('Error during database cleanup', error);
    }
  }
}