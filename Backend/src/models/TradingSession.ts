import { Schema, model, Document, Types } from 'mongoose';

export interface ITradingSession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: string;
  
  // Session Status
  status: 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'EMERGENCY_STOPPED';
  startTime: Date;
  endTime?: Date;
  lastActivity: Date;
  
  // Trading Configuration for this session
  config: {
    maxDailyLoss: number;
    maxPositionSize: number;
    targetPoints: number;
    stopLossPoints: number;
    riskRewardRatio: number;
    maxConsecutiveLosses: number;
    enableMLTrading: boolean;
    emergencyStopEnabled: boolean;
  };
  
  // Session Statistics
  stats: {
    totalOrders: number;
    executedOrders: number;
    cancelledOrders: number;
    
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    
    totalPnL: number;
    realizedPnL: number;
    unrealizedPnL: number;
    
    maxDrawdown: number;
    currentDrawdown: number;
    
    winRate: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    
    pointsTraded: number;
    avgHoldTime: number; // in minutes
    
    largestWin: number;
    largestLoss: number;
    consecutiveWins: number;
    consecutiveLosses: number;
    maxConsecutiveLosses: number;
  };
  
  // Risk Management
  riskMetrics: {
    dailyLoss: number;
    dailyLossLimit: number;
    consecutiveLosses: number;
    consecutiveLossLimit: number;
    
    isBlocked: boolean;
    blockReason?: string;
    blockTime?: Date;
    
    riskScore: number; // 0-100
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  
  // ML/AI Integration
  mlMetrics: {
    predictionsUsed: number;
    correctPredictions: number;
    accuracyRate: number;
    
    avgConfidenceUsed: number;
    minConfidenceThreshold: number;
    
    mlPnL: number;
    manualPnL: number;
  };
  
  // Session Events
  events: Array<{
    timestamp: Date;
    type: 'START' | 'PAUSE' | 'RESUME' | 'STOP' | 'EMERGENCY_STOP' | 'RISK_BLOCK' | 'CONFIG_CHANGE';
    description: string;
    metadata?: any;
  }>;
  
  // Connection Status
  connections: {
    broker: {
      connected: boolean;
      lastHeartbeat?: Date;
      connectionId?: string;
    };
    
    mlEngine: {
      connected: boolean;
      lastPrediction?: Date;
      predictionLatency?: number;
    };
    
    marketData: {
      connected: boolean;
      lastTick?: Date;
      tickLatency?: number;
    };
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  updateStats(): void;
  addEvent(type: string, description: string, metadata?: any): void;
  calculateRiskScore(): number;
  isWithinRiskLimits(): boolean;
  canTrade(): boolean;
  emergencyStop(reason: string): void;
}

const TradingSessionSchema = new Schema<ITradingSession>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  status: {
    type: String,
    enum: ['ACTIVE', 'PAUSED', 'STOPPED', 'EMERGENCY_STOPPED'],
    default: 'ACTIVE',
    index: true
  },
  
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  
  endTime: {
    type: Date
  },
  
  lastActivity: {
    type: Date,
    default: Date.now
  },
  
  // Trading Configuration
  config: {
    maxDailyLoss: {
      type: Number,
      default: 500,
      min: 0
    },
    
    maxPositionSize: {
      type: Number,
      default: 2,
      min: 1
    },
    
    targetPoints: {
      type: Number,
      default: 2,
      min: 0.5
    },
    
    stopLossPoints: {
      type: Number,
      default: 1.5,
      min: 0.25
    },
    
    riskRewardRatio: {
      type: Number,
      default: 1.33,
      min: 1
    },
    
    maxConsecutiveLosses: {
      type: Number,
      default: 3,
      min: 1
    },
    
    enableMLTrading: {
      type: Boolean,
      default: true
    },
    
    emergencyStopEnabled: {
      type: Boolean,
      default: true
    }
  },
  
  // Session Statistics
  stats: {
    totalOrders: { type: Number, default: 0 },
    executedOrders: { type: Number, default: 0 },
    cancelledOrders: { type: Number, default: 0 },
    
    totalTrades: { type: Number, default: 0 },
    winningTrades: { type: Number, default: 0 },
    losingTrades: { type: Number, default: 0 },
    
    totalPnL: { type: Number, default: 0 },
    realizedPnL: { type: Number, default: 0 },
    unrealizedPnL: { type: Number, default: 0 },
    
    maxDrawdown: { type: Number, default: 0 },
    currentDrawdown: { type: Number, default: 0 },
    
    winRate: { type: Number, default: 0 },
    avgWin: { type: Number, default: 0 },
    avgLoss: { type: Number, default: 0 },
    profitFactor: { type: Number, default: 0 },
    
    pointsTraded: { type: Number, default: 0 },
    avgHoldTime: { type: Number, default: 0 },
    
    largestWin: { type: Number, default: 0 },
    largestLoss: { type: Number, default: 0 },
    consecutiveWins: { type: Number, default: 0 },
    consecutiveLosses: { type: Number, default: 0 },
    maxConsecutiveLosses: { type: Number, default: 0 }
  },
  
  // Risk Management
  riskMetrics: {
    dailyLoss: { type: Number, default: 0 },
    dailyLossLimit: { type: Number, default: 500 },
    consecutiveLosses: { type: Number, default: 0 },
    consecutiveLossLimit: { type: Number, default: 3 },
    
    isBlocked: { type: Boolean, default: false },
    blockReason: String,
    blockTime: Date,
    
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW'
    }
  },
  
  // ML/AI Integration
  mlMetrics: {
    predictionsUsed: { type: Number, default: 0 },
    correctPredictions: { type: Number, default: 0 },
    accuracyRate: { type: Number, default: 0 },
    
    avgConfidenceUsed: { type: Number, default: 0 },
    minConfidenceThreshold: { type: Number, default: 0.7 },
    
    mlPnL: { type: Number, default: 0 },
    manualPnL: { type: Number, default: 0 }
  },
  
  // Session Events
  events: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['START', 'PAUSE', 'RESUME', 'STOP', 'EMERGENCY_STOP', 'RISK_BLOCK', 'CONFIG_CHANGE'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    metadata: Schema.Types.Mixed
  }],
  
  // Connection Status
  connections: {
    broker: {
      connected: { type: Boolean, default: false },
      lastHeartbeat: Date,
      connectionId: String
    },
    
    mlEngine: {
      connected: { type: Boolean, default: false },
      lastPrediction: Date,
      predictionLatency: Number
    },
    
    marketData: {
      connected: { type: Boolean, default: false },
      lastTick: Date,
      tickLatency: Number
    }
  }
  
}, {
  timestamps: true
});

// Indexes
TradingSessionSchema.index({ userId: 1, status: 1 });
TradingSessionSchema.index({ sessionId: 1 });
TradingSessionSchema.index({ startTime: -1 });
TradingSessionSchema.index({ 'riskMetrics.isBlocked': 1 });

// Methods
TradingSessionSchema.methods.updateStats = function(): void {
  // Calculate win rate
  if (this.stats.totalTrades > 0) {
    this.stats.winRate = (this.stats.winningTrades / this.stats.totalTrades) * 100;
  }
  
  // Calculate profit factor
  if (this.stats.avgLoss > 0) {
    this.stats.profitFactor = this.stats.avgWin / Math.abs(this.stats.avgLoss);
  }
  
  // Update ML accuracy
  if (this.mlMetrics.predictionsUsed > 0) {
    this.mlMetrics.accuracyRate = (this.mlMetrics.correctPredictions / this.mlMetrics.predictionsUsed) * 100;
  }
  
  this.lastActivity = new Date();
};

TradingSessionSchema.methods.addEvent = function(type: string, description: string, metadata?: any): void {
  this.events.push({
    timestamp: new Date(),
    type,
    description,
    metadata
  });
  
  this.lastActivity = new Date();
};

TradingSessionSchema.methods.calculateRiskScore = function(): number {
  let score = 0;
  
  // Daily loss component (40% weight)
  const lossRatio = Math.abs(this.riskMetrics.dailyLoss) / this.riskMetrics.dailyLossLimit;
  score += Math.min(lossRatio * 40, 40);
  
  // Consecutive losses component (30% weight)
  const lossConsecutiveRatio = this.riskMetrics.consecutiveLosses / this.riskMetrics.consecutiveLossLimit;
  score += Math.min(lossConsecutiveRatio * 30, 30);
  
  // Drawdown component (20% weight)
  const drawdownRatio = Math.abs(this.stats.currentDrawdown) / this.config.maxDailyLoss;
  score += Math.min(drawdownRatio * 20, 20);
  
  // Win rate component (10% weight)
  const winRatePenalty = this.stats.winRate < 30 ? (30 - this.stats.winRate) / 3 : 0;
  score += Math.min(winRatePenalty, 10);
  
  this.riskMetrics.riskScore = Math.min(Math.round(score), 100);
  
  // Update risk level
  if (this.riskMetrics.riskScore >= 90) {
    this.riskMetrics.riskLevel = 'CRITICAL';
  } else if (this.riskMetrics.riskScore >= 70) {
    this.riskMetrics.riskLevel = 'HIGH';
  } else if (this.riskMetrics.riskScore >= 40) {
    this.riskMetrics.riskLevel = 'MEDIUM';
  } else {
    this.riskMetrics.riskLevel = 'LOW';
  }
  
  return this.riskMetrics.riskScore;
};

TradingSessionSchema.methods.isWithinRiskLimits = function(): boolean {
  return !this.riskMetrics.isBlocked &&
         Math.abs(this.riskMetrics.dailyLoss) < this.riskMetrics.dailyLossLimit &&
         this.riskMetrics.consecutiveLosses < this.riskMetrics.consecutiveLossLimit &&
         this.riskMetrics.riskScore < 90;
};

TradingSessionSchema.methods.canTrade = function(): boolean {
  return this.status === 'ACTIVE' &&
         this.isWithinRiskLimits() &&
         this.connections.broker.connected;
};

TradingSessionSchema.methods.emergencyStop = function(reason: string): void {
  this.status = 'EMERGENCY_STOPPED';
  this.endTime = new Date();
  this.addEvent('EMERGENCY_STOP', `Emergency stop triggered: ${reason}`, { reason });
  
  this.riskMetrics.isBlocked = true;
  this.riskMetrics.blockReason = reason;
  this.riskMetrics.blockTime = new Date();
};

// Static methods
TradingSessionSchema.statics.findActiveSessions = function() {
  return this.find({ status: 'ACTIVE' });
};

TradingSessionSchema.statics.findByUser = function(userId: Types.ObjectId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

export const TradingSession = model<ITradingSession>('TradingSession', TradingSessionSchema);
export default TradingSession;