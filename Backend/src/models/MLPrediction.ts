import { Schema, model, Document, Types } from 'mongoose';

export interface IMLPrediction extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  sessionId?: Types.ObjectId;
  
  // Prediction Identification
  predictionId: string;
  modelId: string;
  modelVersion: string;
  
  // Market Context
  symbol: string; // e.g., 'WDO', 'WIN'
  timestamp: Date;
  marketPrice: number;
  
  // ML Prediction Data
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number; // 0-1
  strength: 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';
  
  // Price Targets
  targetPrice: number;
  stopLossPrice: number;
  entryPrice: number;
  
  // Risk/Reward
  riskRewardRatio: number;
  expectedReturn: number;
  maxRisk: number;
  
  // Time Horizon
  timeHorizon: 'SCALP' | 'INTRADAY' | 'SWING' | 'POSITION'; // 5min, 1-4h, 1-5d, >5d
  expirationTime: Date;
  
  // ML Model Features
  features: {
    // Technical Indicators
    technical: {
      rsi: number;
      macd: number;
      bollinger: number;
      vwap: number;
      ema: number[];
      volume: number;
    };
    
    // Order Flow Analysis
    orderFlow: {
      buyAggression: number;
      sellAggression: number;
      liquidityImbalance: number;
      hiddenLiquidity: number;
      volumeProfile: number;
    };
    
    // Market Microstructure
    microstructure: {
      spread: number;
      depth: number;
      tickDirection: number;
      orderBookImbalance: number;
      tradeSize: number;
    };
    
    // Pattern Recognition
    patterns: Array<{
      name: string;
      confidence: number;
      type: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    }>;
    
    // Market Sentiment
    sentiment: {
      newsScore: number;
      socialScore: number;
      institutionalFlow: number;
      retailFlow: number;
    };
  };
  
  // Model Performance
  performance: {
    accuracy: number; // Historical accuracy of this model
    precision: number;
    recall: number;
    f1Score: number;
    sharpeRatio: number;
    
    // Recent performance
    recentAccuracy: number; // Last 100 predictions
    streakCorrect: number;
    streakWrong: number;
  };
  
  // Prediction Reasoning
  reasoning: {
    primaryFactors: string[]; // Main factors driving the prediction
    supportingFactors: string[];
    riskFactors: string[];
    
    textExplanation: string;
    confidenceBreakdown: {
      technical: number;
      orderFlow: number;
      patterns: number;
      sentiment: number;
    };
  };
  
  // Real-time Updates
  updates: Array<{
    timestamp: Date;
    newConfidence: number;
    newSignal?: 'BUY' | 'SELL' | 'HOLD';
    reason: string;
    marketPrice: number;
  }>;
  
  // Prediction Status
  status: 'ACTIVE' | 'EXECUTED' | 'EXPIRED' | 'CANCELLED' | 'INVALIDATED';
  
  // Execution Details
  execution?: {
    orderId: Types.ObjectId;
    positionId: Types.ObjectId;
    executionTime: Date;
    executionPrice: number;
    slippage: number;
  };
  
  // Outcome Tracking
  outcome?: {
    actualResult: 'WIN' | 'LOSS' | 'BREAKEVEN';
    actualReturn: number;
    actualMaxDrawdown: number;
    actualMaxProfit: number;
    
    durationToTarget: number; // Minutes to reach target
    durationToStop: number; // Minutes to hit stop
    
    accuracy: number; // 1 if correct, 0 if wrong
    returnAccuracy: number; // How close predicted vs actual return
  };
  
  // Model Metadata
  metadata: {
    trainingDataSize: number;
    featureCount: number;
    modelComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
    
    computationTime: number; // ms
    dataLatency: number; // ms
    
    environment: 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION';
    version: string;
  };
  
  // Quality Metrics
  quality: {
    dataQuality: number; // 0-1
    featureRelevance: number;
    modelStability: number;
    
    anomalyScore: number; // How unusual this prediction is
    uncertaintyScore: number; // Model uncertainty
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  updateConfidence(newConfidence: number, reason: string): void;
  invalidate(reason: string): void;
  recordOutcome(result: 'WIN' | 'LOSS' | 'BREAKEVEN', actualReturn: number): void;
  calculateAccuracy(): number;
  isExpired(): boolean;
  shouldExecute(): boolean;
}

const MLPredictionSchema = new Schema<IMLPrediction>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'TradingSession',
    index: true
  },
  
  // Prediction Identification
  predictionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  modelId: {
    type: String,
    required: true,
    index: true
  },
  
  modelVersion: {
    type: String,
    required: true
  },
  
  // Market Context
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  marketPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  // ML Prediction Data
  signal: {
    type: String,
    enum: ['BUY', 'SELL', 'HOLD'],
    required: true,
    index: true
  },
  
  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1
  },
  
  strength: {
    type: String,
    enum: ['WEAK', 'MODERATE', 'STRONG', 'VERY_STRONG'],
    required: true
  },
  
  // Price Targets
  targetPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  stopLossPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  entryPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Risk/Reward
  riskRewardRatio: {
    type: Number,
    required: true,
    min: 0
  },
  
  expectedReturn: {
    type: Number,
    required: true
  },
  
  maxRisk: {
    type: Number,
    required: true
  },
  
  // Time Horizon
  timeHorizon: {
    type: String,
    enum: ['SCALP', 'INTRADAY', 'SWING', 'POSITION'],
    default: 'INTRADAY'
  },
  
  expirationTime: {
    type: Date,
    required: true,
    index: true
  },
  
  // ML Model Features
  features: {
    technical: {
      rsi: { type: Number, min: 0, max: 100 },
      macd: Number,
      bollinger: Number,
      vwap: Number,
      ema: [Number],
      volume: Number
    },
    
    orderFlow: {
      buyAggression: { type: Number, min: 0, max: 1 },
      sellAggression: { type: Number, min: 0, max: 1 },
      liquidityImbalance: Number,
      hiddenLiquidity: Number,
      volumeProfile: Number
    },
    
    microstructure: {
      spread: Number,
      depth: Number,
      tickDirection: Number,
      orderBookImbalance: Number,
      tradeSize: Number
    },
    
    patterns: [{
      name: String,
      confidence: { type: Number, min: 0, max: 1 },
      type: {
        type: String,
        enum: ['BULLISH', 'BEARISH', 'NEUTRAL']
      }
    }],
    
    sentiment: {
      newsScore: { type: Number, min: -1, max: 1 },
      socialScore: { type: Number, min: -1, max: 1 },
      institutionalFlow: Number,
      retailFlow: Number
    }
  },
  
  // Model Performance
  performance: {
    accuracy: { type: Number, min: 0, max: 1 },
    precision: { type: Number, min: 0, max: 1 },
    recall: { type: Number, min: 0, max: 1 },
    f1Score: { type: Number, min: 0, max: 1 },
    sharpeRatio: Number,
    
    recentAccuracy: { type: Number, min: 0, max: 1 },
    streakCorrect: { type: Number, default: 0 },
    streakWrong: { type: Number, default: 0 }
  },
  
  // Prediction Reasoning
  reasoning: {
    primaryFactors: [String],
    supportingFactors: [String],
    riskFactors: [String],
    
    textExplanation: {
      type: String,
      required: true
    },
    
    confidenceBreakdown: {
      technical: { type: Number, min: 0, max: 1 },
      orderFlow: { type: Number, min: 0, max: 1 },
      patterns: { type: Number, min: 0, max: 1 },
      sentiment: { type: Number, min: 0, max: 1 }
    }
  },
  
  // Real-time Updates
  updates: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    newConfidence: {
      type: Number,
      min: 0,
      max: 1
    },
    newSignal: {
      type: String,
      enum: ['BUY', 'SELL', 'HOLD']
    },
    reason: String,
    marketPrice: Number
  }],
  
  // Prediction Status
  status: {
    type: String,
    enum: ['ACTIVE', 'EXECUTED', 'EXPIRED', 'CANCELLED', 'INVALIDATED'],
    default: 'ACTIVE',
    index: true
  },
  
  // Execution Details
  execution: {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order'
    },
    positionId: {
      type: Schema.Types.ObjectId,
      ref: 'Position'
    },
    executionTime: Date,
    executionPrice: Number,
    slippage: Number
  },
  
  // Outcome Tracking
  outcome: {
    actualResult: {
      type: String,
      enum: ['WIN', 'LOSS', 'BREAKEVEN']
    },
    actualReturn: Number,
    actualMaxDrawdown: Number,
    actualMaxProfit: Number,
    
    durationToTarget: Number,
    durationToStop: Number,
    
    accuracy: { type: Number, min: 0, max: 1 },
    returnAccuracy: { type: Number, min: 0, max: 1 }
  },
  
  // Model Metadata
  metadata: {
    trainingDataSize: Number,
    featureCount: Number,
    modelComplexity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH']
    },
    
    computationTime: Number,
    dataLatency: Number,
    
    environment: {
      type: String,
      enum: ['DEVELOPMENT', 'STAGING', 'PRODUCTION'],
      default: 'PRODUCTION'
    },
    version: String
  },
  
  // Quality Metrics
  quality: {
    dataQuality: { type: Number, min: 0, max: 1 },
    featureRelevance: { type: Number, min: 0, max: 1 },
    modelStability: { type: Number, min: 0, max: 1 },
    
    anomalyScore: { type: Number, min: 0, max: 1 },
    uncertaintyScore: { type: Number, min: 0, max: 1 }
  }
  
}, {
  timestamps: true
});

// Indexes
MLPredictionSchema.index({ modelId: 1, timestamp: -1 });
MLPredictionSchema.index({ symbol: 1, timestamp: -1 });
MLPredictionSchema.index({ signal: 1, confidence: -1 });
MLPredictionSchema.index({ status: 1, expirationTime: 1 });
MLPredictionSchema.index({ 'performance.accuracy': -1 });

// Virtual for age in minutes
MLPredictionSchema.virtual('ageMinutes').get(function() {
  return Math.floor((Date.now() - this.timestamp.getTime()) / (1000 * 60));
});

// Methods
MLPredictionSchema.methods.updateConfidence = function(newConfidence: number, reason: string): void {
  this.updates.push({
    timestamp: new Date(),
    newConfidence,
    reason,
    marketPrice: this.marketPrice
  });
  
  this.confidence = newConfidence;
  
  // Update strength based on new confidence
  if (newConfidence >= 0.9) {
    this.strength = 'VERY_STRONG';
  } else if (newConfidence >= 0.75) {
    this.strength = 'STRONG';
  } else if (newConfidence >= 0.6) {
    this.strength = 'MODERATE';
  } else {
    this.strength = 'WEAK';
  }
};

MLPredictionSchema.methods.invalidate = function(reason: string): void {
  this.status = 'INVALIDATED';
  this.updates.push({
    timestamp: new Date(),
    newConfidence: 0,
    reason: `Invalidated: ${reason}`,
    marketPrice: this.marketPrice
  });
};

MLPredictionSchema.methods.recordOutcome = function(
  result: 'WIN' | 'LOSS' | 'BREAKEVEN', 
  actualReturn: number
): void {
  this.outcome = {
    actualResult: result,
    actualReturn,
    actualMaxDrawdown: 0, // Would be calculated from position data
    actualMaxProfit: 0,   // Would be calculated from position data
    durationToTarget: 0,  // Would be calculated based on execution
    durationToStop: 0,    // Would be calculated based on execution
    accuracy: result === 'WIN' ? 1 : 0,
    returnAccuracy: Math.max(0, 1 - Math.abs(this.expectedReturn - actualReturn) / Math.abs(this.expectedReturn))
  };
  
  this.status = 'EXECUTED';
};

MLPredictionSchema.methods.calculateAccuracy = function(): number {
  if (!this.outcome) {
    return 0;
  }
  
  // Weighted accuracy considering both direction and magnitude
  const directionAccuracy = this.outcome.accuracy;
  const magnitudeAccuracy = this.outcome.returnAccuracy || 0;
  
  // Weight: 70% direction, 30% magnitude
  return (directionAccuracy * 0.7) + (magnitudeAccuracy * 0.3);
};

MLPredictionSchema.methods.isExpired = function(): boolean {
  return this.expirationTime < new Date();
};

MLPredictionSchema.methods.shouldExecute = function(): boolean {
  return this.status === 'ACTIVE' &&
         !this.isExpired() &&
         this.confidence >= 0.7 &&
         this.quality.dataQuality >= 0.8 &&
         this.signal !== 'HOLD';
};

// Static methods
MLPredictionSchema.statics.findActivePredictions = function() {
  return this.find({ 
    status: 'ACTIVE',
    expirationTime: { $gt: new Date() }
  }).sort({ confidence: -1 });
};

MLPredictionSchema.statics.findByModel = function(modelId: string) {
  return this.find({ modelId }).sort({ timestamp: -1 });
};

MLPredictionSchema.statics.findHighConfidence = function(minConfidence: number = 0.8) {
  return this.find({ 
    status: 'ACTIVE',
    confidence: { $gte: minConfidence },
    expirationTime: { $gt: new Date() }
  }).sort({ confidence: -1 });
};

export const MLPrediction = model<IMLPrediction>('MLPrediction', MLPredictionSchema);
export default MLPrediction;