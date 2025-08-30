import { Schema, model, Document, Types } from 'mongoose';

export interface IPosition extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  
  // Position Identification
  positionId: string;
  symbol: string; // e.g., 'WDO', 'WIN'
  market: 'FUTURES' | 'STOCKS' | 'OPTIONS' | 'FOREX';
  
  // Position Details
  side: 'LONG' | 'SHORT';
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  
  // Entry Details
  entryOrders: Types.ObjectId[]; // Reference to Order model
  entryTime: Date;
  entryPrice: number;
  entryQuantity: number;
  
  // Exit Details
  exitOrders: Types.ObjectId[];
  exitTime?: Date;
  exitPrice?: number;
  exitQuantity: number;
  
  // Position Status
  status: 'OPEN' | 'CLOSED' | 'PARTIALLY_CLOSED';
  isActive: boolean;
  
  // P&L Calculations
  unrealizedPnL: number;
  realizedPnL: number;
  totalPnL: number;
  pnLPoints: number; // P&L in points
  pnLPercentage: number; // P&L as percentage
  
  // Risk Management
  stopLoss?: {
    price: number;
    orderId?: string;
    type: 'FIXED' | 'TRAILING' | 'ADAPTIVE';
    distance: number; // Distance in points
    isTriggered: boolean;
    triggerTime?: Date;
  };
  
  takeProfit?: {
    price: number;
    orderId?: string;
    distance: number; // Distance in points
    isTriggered: boolean;
    triggerTime?: Date;
  };
  
  // Risk Metrics
  riskMetrics: {
    maxDrawdown: number;
    maxDrawdownTime?: Date;
    maxProfit: number;
    maxProfitTime?: Date;
    
    initialRisk: number; // Initial risk in currency
    currentRisk: number; // Current risk based on stop loss
    riskRewardRatio: number;
    
    holdTime: number; // Position hold time in minutes
    maxAdverseExcursion: number; // MAE
    maxFavorableExcursion: number; // MFE
  };
  
  // ML/AI Integration
  mlPrediction?: {
    predictionId: Types.ObjectId;
    entryConfidence: number;
    entrySignal: 'BUY' | 'SELL';
    predictedTarget: number;
    predictedStopLoss: number;
    
    currentConfidence?: number;
    exitSignal?: 'HOLD' | 'CLOSE';
    
    accuracy?: number; // Calculated after position close
    modelPerformance?: 'GOOD' | 'AVERAGE' | 'POOR';
  };
  
  // Position Source
  source: 'MANUAL' | 'ML_ENGINE' | 'ALGORITHM' | 'API' | 'HEDGE';
  strategy?: string;
  
  // Market Context
  marketContext: {
    entryVolatility: number;
    entrySpread: number;
    marketPhase: 'TRENDING' | 'RANGING' | 'VOLATILE';
    liquidityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
    
    currentVolatility?: number;
    currentSpread?: number;
  };
  
  // Commission and Fees
  totalCommission: number;
  fees: {
    entry: number;
    exit: number;
    overnight?: number; // For positions held overnight
    financing?: number; // For leveraged positions
    total: number;
  };
  
  // Position Events
  events: Array<{
    timestamp: Date;
    type: 'ENTRY' | 'PARTIAL_EXIT' | 'FULL_EXIT' | 'STOP_LOSS' | 'TAKE_PROFIT' | 'MODIFICATION';
    description: string;
    price?: number;
    quantity?: number;
    metadata?: any;
  }>;
  
  // Performance Metrics
  performance: {
    returnOnInvestment: number; // ROI %
    annualizedReturn: number;
    sharpeRatio?: number;
    calmarRatio?: number;
    
    winRate?: number; // For multiple partial exits
    profitFactor?: number;
    
    efficiency: number; // MFE / MAE ratio
    opportunityCost?: number;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  updatePnL(currentPrice: number): void;
  updateRiskMetrics(): void;
  addEvent(type: string, description: string, metadata?: any): void;
  calculatePerformanceMetrics(): void;
  closePosition(exitPrice: number, exitQuantity?: number): void;
  shouldTriggerStopLoss(currentPrice: number): boolean;
  shouldTriggerTakeProfit(currentPrice: number): boolean;
}

const PositionSchema = new Schema<IPosition>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'TradingSession',
    required: true,
    index: true
  },
  
  // Position Identification
  positionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  
  market: {
    type: String,
    enum: ['FUTURES', 'STOCKS', 'OPTIONS', 'FOREX'],
    default: 'FUTURES',
    required: true
  },
  
  // Position Details
  side: {
    type: String,
    enum: ['LONG', 'SHORT'],
    required: true,
    index: true
  },
  
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantidade deve ser pelo menos 1']
  },
  
  averagePrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  currentPrice: {
    type: Number,
    min: 0
  },
  
  // Entry Details
  entryOrders: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }],
  
  entryTime: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  entryPrice: {
    type: Number,
    required: true,
    min: 0
  },
  
  entryQuantity: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Exit Details
  exitOrders: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }],
  
  exitTime: Date,
  exitPrice: Number,
  
  exitQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Position Status
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED', 'PARTIALLY_CLOSED'],
    default: 'OPEN',
    required: true,
    index: true
  },
  
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  
  // P&L Calculations
  unrealizedPnL: {
    type: Number,
    default: 0
  },
  
  realizedPnL: {
    type: Number,
    default: 0
  },
  
  totalPnL: {
    type: Number,
    default: 0
  },
  
  pnLPoints: {
    type: Number,
    default: 0
  },
  
  pnLPercentage: {
    type: Number,
    default: 0
  },
  
  // Risk Management
  stopLoss: {
    price: Number,
    orderId: String,
    type: {
      type: String,
      enum: ['FIXED', 'TRAILING', 'ADAPTIVE'],
      default: 'FIXED'
    },
    distance: Number,
    isTriggered: { type: Boolean, default: false },
    triggerTime: Date
  },
  
  takeProfit: {
    price: Number,
    orderId: String,
    distance: Number,
    isTriggered: { type: Boolean, default: false },
    triggerTime: Date
  },
  
  // Risk Metrics
  riskMetrics: {
    maxDrawdown: { type: Number, default: 0 },
    maxDrawdownTime: Date,
    maxProfit: { type: Number, default: 0 },
    maxProfitTime: Date,
    
    initialRisk: { type: Number, default: 0 },
    currentRisk: { type: Number, default: 0 },
    riskRewardRatio: { type: Number, default: 0 },
    
    holdTime: { type: Number, default: 0 },
    maxAdverseExcursion: { type: Number, default: 0 },
    maxFavorableExcursion: { type: Number, default: 0 }
  },
  
  // ML/AI Integration
  mlPrediction: {
    predictionId: {
      type: Schema.Types.ObjectId,
      ref: 'MLPrediction'
    },
    entryConfidence: {
      type: Number,
      min: 0,
      max: 1
    },
    entrySignal: {
      type: String,
      enum: ['BUY', 'SELL']
    },
    predictedTarget: Number,
    predictedStopLoss: Number,
    
    currentConfidence: {
      type: Number,
      min: 0,
      max: 1
    },
    exitSignal: {
      type: String,
      enum: ['HOLD', 'CLOSE']
    },
    
    accuracy: {
      type: Number,
      min: 0,
      max: 1
    },
    modelPerformance: {
      type: String,
      enum: ['GOOD', 'AVERAGE', 'POOR']
    }
  },
  
  // Position Source
  source: {
    type: String,
    enum: ['MANUAL', 'ML_ENGINE', 'ALGORITHM', 'API', 'HEDGE'],
    default: 'MANUAL',
    required: true,
    index: true
  },
  
  strategy: {
    type: String,
    index: true
  },
  
  // Market Context
  marketContext: {
    entryVolatility: { type: Number, default: 0 },
    entrySpread: { type: Number, default: 0 },
    marketPhase: {
      type: String,
      enum: ['TRENDING', 'RANGING', 'VOLATILE'],
      default: 'RANGING'
    },
    liquidityLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'MEDIUM'
    },
    
    currentVolatility: Number,
    currentSpread: Number
  },
  
  // Commission and Fees
  totalCommission: {
    type: Number,
    default: 0
  },
  
  fees: {
    entry: { type: Number, default: 0 },
    exit: { type: Number, default: 0 },
    overnight: { type: Number, default: 0 },
    financing: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  // Position Events
  events: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['ENTRY', 'PARTIAL_EXIT', 'FULL_EXIT', 'STOP_LOSS', 'TAKE_PROFIT', 'MODIFICATION'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    price: Number,
    quantity: Number,
    metadata: Schema.Types.Mixed
  }],
  
  // Performance Metrics
  performance: {
    returnOnInvestment: { type: Number, default: 0 },
    annualizedReturn: { type: Number, default: 0 },
    sharpeRatio: Number,
    calmarRatio: Number,
    
    winRate: Number,
    profitFactor: Number,
    
    efficiency: { type: Number, default: 0 },
    opportunityCost: Number
  }
  
}, {
  timestamps: true
});

// Indexes
PositionSchema.index({ userId: 1, status: 1 });
PositionSchema.index({ sessionId: 1, isActive: 1 });
PositionSchema.index({ symbol: 1, createdAt: -1 });
PositionSchema.index({ source: 1, createdAt: -1 });
PositionSchema.index({ entryTime: -1 });

// Methods
PositionSchema.methods.updatePnL = function(currentPrice: number): void {
  if (!currentPrice || currentPrice <= 0) return;
  
  this.currentPrice = currentPrice;
  
  // Calculate P&L in points
  if (this.side === 'LONG') {
    this.pnLPoints = (currentPrice - this.averagePrice) * this.quantity;
  } else {
    this.pnLPoints = (this.averagePrice - currentPrice) * this.quantity;
  }
  
  // For futures (WDO/WIN), 1 point = $1
  const pointValue = this.symbol === 'WDO' ? 1 : 10;
  this.unrealizedPnL = this.pnLPoints * pointValue;
  
  // Total P&L includes realized P&L from partial exits
  this.totalPnL = this.unrealizedPnL + this.realizedPnL;
  
  // P&L percentage based on initial investment
  const initialValue = this.averagePrice * this.entryQuantity * pointValue;
  if (initialValue > 0) {
    this.pnLPercentage = (this.totalPnL / initialValue) * 100;
  }
  
  // Update risk metrics
  this.updateRiskMetrics();
};

PositionSchema.methods.updateRiskMetrics = function(): void {
  // Update max drawdown and max profit
  if (this.unrealizedPnL < this.riskMetrics.maxDrawdown) {
    this.riskMetrics.maxDrawdown = this.unrealizedPnL;
    this.riskMetrics.maxDrawdownTime = new Date();
  }
  
  if (this.unrealizedPnL > this.riskMetrics.maxProfit) {
    this.riskMetrics.maxProfit = this.unrealizedPnL;
    this.riskMetrics.maxProfitTime = new Date();
  }
  
  // Update MAE and MFE
  if (this.unrealizedPnL < 0) {
    this.riskMetrics.maxAdverseExcursion = Math.max(
      this.riskMetrics.maxAdverseExcursion,
      Math.abs(this.unrealizedPnL)
    );
  }
  
  if (this.unrealizedPnL > 0) {
    this.riskMetrics.maxFavorableExcursion = Math.max(
      this.riskMetrics.maxFavorableExcursion,
      this.unrealizedPnL
    );
  }
  
  // Update hold time
  this.riskMetrics.holdTime = Math.floor(
    (Date.now() - this.entryTime.getTime()) / (1000 * 60)
  );
  
  // Calculate efficiency (MFE/MAE ratio)
  if (this.riskMetrics.maxAdverseExcursion > 0) {
    this.performance.efficiency = 
      this.riskMetrics.maxFavorableExcursion / this.riskMetrics.maxAdverseExcursion;
  }
};

PositionSchema.methods.addEvent = function(type: string, description: string, metadata?: any): void {
  this.events.push({
    timestamp: new Date(),
    type: type as any,
    description,
    price: metadata?.price,
    quantity: metadata?.quantity,
    metadata
  });
};

PositionSchema.methods.calculatePerformanceMetrics = function(): void {
  if (this.status === 'CLOSED' && this.riskMetrics.holdTime > 0) {
    // ROI calculation
    const initialValue = this.averagePrice * this.entryQuantity;
    this.performance.returnOnInvestment = (this.totalPnL / initialValue) * 100;
    
    // Annualized return (assuming 252 trading days per year)
    const daysHeld = this.riskMetrics.holdTime / (60 * 24);
    if (daysHeld > 0) {
      this.performance.annualizedReturn = 
        (this.performance.returnOnInvestment / daysHeld) * 252;
    }
    
    // ML prediction accuracy
    if (this.mlPrediction?.entrySignal) {
      const wasCorrect = (
        (this.mlPrediction.entrySignal === 'BUY' && this.totalPnL > 0) ||
        (this.mlPrediction.entrySignal === 'SELL' && this.totalPnL > 0)
      );
      this.mlPrediction.accuracy = wasCorrect ? 1 : 0;
      
      if (this.totalPnL > this.entryPrice * 0.02) {
        this.mlPrediction.modelPerformance = 'GOOD';
      } else if (this.totalPnL >= 0) {
        this.mlPrediction.modelPerformance = 'AVERAGE';
      } else {
        this.mlPrediction.modelPerformance = 'POOR';
      }
    }
  }
};

PositionSchema.methods.closePosition = function(exitPrice: number, exitQuantity?: number): void {
  const quantityToClose = exitQuantity || (this.quantity - this.exitQuantity);
  
  this.exitQuantity += quantityToClose;
  this.exitPrice = exitPrice;
  this.exitTime = new Date();
  
  // Calculate realized P&L for the closed portion
  const pointValue = this.symbol === 'WDO' ? 1 : 10;
  let realizedPoints = 0;
  
  if (this.side === 'LONG') {
    realizedPoints = (exitPrice - this.averagePrice) * quantityToClose;
  } else {
    realizedPoints = (this.averagePrice - exitPrice) * quantityToClose;
  }
  
  this.realizedPnL += realizedPoints * pointValue;
  this.quantity -= quantityToClose;
  
  // Update status
  if (this.quantity === 0) {
    this.status = 'CLOSED';
    this.isActive = false;
    this.unrealizedPnL = 0;
  } else {
    this.status = 'PARTIALLY_CLOSED';
  }
  
  this.totalPnL = this.realizedPnL + this.unrealizedPnL;
  
  // Add event
  this.addEvent(
    this.quantity === 0 ? 'FULL_EXIT' : 'PARTIAL_EXIT',
    `Position ${this.quantity === 0 ? 'closed' : 'partially closed'} at ${exitPrice}`,
    { price: exitPrice, quantity: quantityToClose }
  );
  
  // Calculate final performance metrics if fully closed
  if (this.quantity === 0) {
    this.calculatePerformanceMetrics();
  }
};

PositionSchema.methods.shouldTriggerStopLoss = function(currentPrice: number): boolean {
  if (!this.stopLoss?.price || this.stopLoss.isTriggered) {
    return false;
  }
  
  if (this.side === 'LONG') {
    return currentPrice <= this.stopLoss.price;
  } else {
    return currentPrice >= this.stopLoss.price;
  }
};

PositionSchema.methods.shouldTriggerTakeProfit = function(currentPrice: number): boolean {
  if (!this.takeProfit?.price || this.takeProfit.isTriggered) {
    return false;
  }
  
  if (this.side === 'LONG') {
    return currentPrice >= this.takeProfit.price;
  } else {
    return currentPrice <= this.takeProfit.price;
  }
};

// Static methods
PositionSchema.statics.findOpenPositions = function() {
  return this.find({ status: 'OPEN', isActive: true });
};

PositionSchema.statics.findByUser = function(userId: Types.ObjectId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

PositionSchema.statics.findBySession = function(sessionId: Types.ObjectId) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

export const Position = model<IPosition>('Position', PositionSchema);
export default Position;