import { Schema, model, Document, Types } from 'mongoose';

export interface IOrder extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  
  // Order Identification
  orderId: string; // Internal order ID
  brokerOrderId?: string; // Broker's order ID
  clientOrderId?: string; // Client's order ID
  
  // Instrument
  symbol: string; // e.g., 'WDO', 'WIN'
  market: 'FUTURES' | 'STOCKS' | 'OPTIONS' | 'FOREX';
  
  // Order Details
  side: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT' | 'OCO' | 'BRACKET';
  quantity: number;
  price?: number; // For limit orders
  stopPrice?: number; // For stop orders
  
  // Order Status
  status: 'PENDING' | 'SUBMITTED' | 'PARTIAL_FILLED' | 'FILLED' | 'CANCELLED' | 'REJECTED' | 'EXPIRED';
  timeInForce: 'DAY' | 'GTC' | 'IOC' | 'FOK';
  
  // Execution Details
  executedQuantity: number;
  remainingQuantity: number;
  avgExecutionPrice?: number;
  
  // Fills
  fills: Array<{
    fillId: string;
    quantity: number;
    price: number;
    timestamp: Date;
    commission?: number;
    commissionAsset?: string;
  }>;
  
  // P&L
  grossPnL?: number;
  netPnL?: number;
  commission: number;
  fees: {
    brokerage: number;
    exchange: number;
    clearing: number;
    regulatory: number;
    total: number;
  };
  
  // Risk Management
  parentOrderId?: Types.ObjectId; // For bracket/OCO orders
  childOrders?: Types.ObjectId[]; // Stop loss, take profit orders
  
  stopLoss?: {
    price: number;
    orderId?: string;
    triggered: boolean;
    triggerTime?: Date;
  };
  
  takeProfit?: {
    price: number;
    orderId?: string;
    triggered: boolean;
    triggerTime?: Date;
  };
  
  // ML/AI Integration
  mlPrediction?: {
    predictionId: Types.ObjectId;
    confidence: number;
    signal: 'BUY' | 'SELL' | 'HOLD';
    reasoning: string;
    modelVersion: string;
  };
  
  // Order Source
  source: 'MANUAL' | 'ML_ENGINE' | 'ALGORITHM' | 'API' | 'EMERGENCY_STOP';
  strategy?: string;
  
  // Timing
  createdAt: Date;
  submittedAt?: Date;
  executedAt?: Date;
  cancelledAt?: Date;
  
  // Validation and Compliance
  validationChecks: {
    riskCheck: boolean;
    marginCheck: boolean;
    positionLimitCheck: boolean;
    dailyLossCheck: boolean;
  };
  
  compliance: {
    preTradeChecks: boolean;
    postTradeChecks: boolean;
    regulatoryFlags: string[];
  };
  
  // Error Handling
  errorCode?: string;
  errorMessage?: string;
  rejectionReason?: string;
  
  // Timestamps
  updatedAt: Date;
  
  // Methods
  calculatePnL(): { grossPnL: number; netPnL: number };
  updateStatus(newStatus: string): void;
  addFill(fill: any): void;
  cancel(reason?: string): void;
  isActive(): boolean;
  canModify(): boolean;
}

const OrderSchema = new Schema<IOrder>({
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
  
  // Order Identification
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  brokerOrderId: {
    type: String,
    sparse: true,
    index: true
  },
  
  clientOrderId: {
    type: String,
    sparse: true,
    index: true
  },
  
  // Instrument
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
  
  // Order Details
  side: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true,
    index: true
  },
  
  orderType: {
    type: String,
    enum: ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'OCO', 'BRACKET'],
    default: 'MARKET',
    required: true
  },
  
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantidade deve ser pelo menos 1']
  },
  
  price: {
    type: Number,
    min: 0
  },
  
  stopPrice: {
    type: Number,
    min: 0
  },
  
  // Order Status
  status: {
    type: String,
    enum: ['PENDING', 'SUBMITTED', 'PARTIAL_FILLED', 'FILLED', 'CANCELLED', 'REJECTED', 'EXPIRED'],
    default: 'PENDING',
    required: true,
    index: true
  },
  
  timeInForce: {
    type: String,
    enum: ['DAY', 'GTC', 'IOC', 'FOK'],
    default: 'DAY'
  },
  
  // Execution Details
  executedQuantity: {
    type: Number,
    default: 0,
    min: 0
  },
  
  remainingQuantity: {
    type: Number,
    default: function() { return this.quantity; }
  },
  
  avgExecutionPrice: {
    type: Number,
    min: 0
  },
  
  // Fills
  fills: [{
    fillId: {
      type: String,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    commission: {
      type: Number,
      default: 0
    },
    commissionAsset: String
  }],
  
  // P&L
  grossPnL: {
    type: Number,
    default: 0
  },
  
  netPnL: {
    type: Number,
    default: 0
  },
  
  commission: {
    type: Number,
    default: 0
  },
  
  fees: {
    brokerage: { type: Number, default: 0 },
    exchange: { type: Number, default: 0 },
    clearing: { type: Number, default: 0 },
    regulatory: { type: Number, default: 0 },
    total: { type: Number, default: 0 }
  },
  
  // Risk Management
  parentOrderId: {
    type: Schema.Types.ObjectId,
    ref: 'Order'
  },
  
  childOrders: [{
    type: Schema.Types.ObjectId,
    ref: 'Order'
  }],
  
  stopLoss: {
    price: Number,
    orderId: String,
    triggered: { type: Boolean, default: false },
    triggerTime: Date
  },
  
  takeProfit: {
    price: Number,
    orderId: String,
    triggered: { type: Boolean, default: false },
    triggerTime: Date
  },
  
  // ML/AI Integration
  mlPrediction: {
    predictionId: {
      type: Schema.Types.ObjectId,
      ref: 'MLPrediction'
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1
    },
    signal: {
      type: String,
      enum: ['BUY', 'SELL', 'HOLD']
    },
    reasoning: String,
    modelVersion: String
  },
  
  // Order Source
  source: {
    type: String,
    enum: ['MANUAL', 'ML_ENGINE', 'ALGORITHM', 'API', 'EMERGENCY_STOP'],
    default: 'MANUAL',
    required: true,
    index: true
  },
  
  strategy: {
    type: String,
    index: true
  },
  
  // Timing
  submittedAt: Date,
  executedAt: Date,
  cancelledAt: Date,
  
  // Validation and Compliance
  validationChecks: {
    riskCheck: { type: Boolean, default: false },
    marginCheck: { type: Boolean, default: false },
    positionLimitCheck: { type: Boolean, default: false },
    dailyLossCheck: { type: Boolean, default: false }
  },
  
  compliance: {
    preTradeChecks: { type: Boolean, default: false },
    postTradeChecks: { type: Boolean, default: false },
    regulatoryFlags: [String]
  },
  
  // Error Handling
  errorCode: String,
  errorMessage: String,
  rejectionReason: String
  
}, {
  timestamps: true
});

// Indexes
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ sessionId: 1, status: 1 });
OrderSchema.index({ symbol: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ source: 1, createdAt: -1 });

// Virtual for order value
OrderSchema.virtual('orderValue').get(function() {
  if (this.price) {
    return this.quantity * this.price;
  }
  return 0;
});

// Methods
OrderSchema.methods.calculatePnL = function(): { grossPnL: number; netPnL: number } {
  if (this.fills.length === 0 || !this.avgExecutionPrice) {
    return { grossPnL: 0, netPnL: 0 };
  }
  
  // For futures, PnL is calculated based on points
  // For WDO, 1 point = $1
  const pointValue = this.symbol === 'WDO' ? 1 : 10; // Adjust based on instrument
  
  // This is a simplified calculation - actual implementation would need market price
  let grossPnL = 0;
  let totalCommission = this.commission + this.fees.total;
  
  // Calculate based on fills
  this.fills.forEach(fill => {
    grossPnL += fill.quantity * fill.price * pointValue;
  });
  
  this.grossPnL = grossPnL;
  this.netPnL = grossPnL - totalCommission;
  
  return { grossPnL: this.grossPnL, netPnL: this.netPnL };
};

OrderSchema.methods.updateStatus = function(newStatus: string): void {
  const oldStatus = this.status;
  this.status = newStatus as any;
  
  // Update timestamps based on status
  switch (newStatus) {
    case 'SUBMITTED':
      this.submittedAt = new Date();
      break;
    case 'FILLED':
    case 'PARTIAL_FILLED':
      if (!this.executedAt) {
        this.executedAt = new Date();
      }
      break;
    case 'CANCELLED':
      this.cancelledAt = new Date();
      break;
  }
  
  // Update remaining quantity
  this.remainingQuantity = this.quantity - this.executedQuantity;
};

OrderSchema.methods.addFill = function(fill: any): void {
  this.fills.push({
    fillId: fill.fillId || `F${Date.now()}`,
    quantity: fill.quantity,
    price: fill.price,
    timestamp: fill.timestamp || new Date(),
    commission: fill.commission || 0,
    commissionAsset: fill.commissionAsset
  });
  
  // Update execution details
  this.executedQuantity += fill.quantity;
  this.remainingQuantity = this.quantity - this.executedQuantity;
  
  // Calculate average execution price
  const totalValue = this.fills.reduce((sum, f) => sum + (f.quantity * f.price), 0);
  const totalQuantity = this.fills.reduce((sum, f) => sum + f.quantity, 0);
  this.avgExecutionPrice = totalValue / totalQuantity;
  
  // Update status
  if (this.remainingQuantity === 0) {
    this.updateStatus('FILLED');
  } else {
    this.updateStatus('PARTIAL_FILLED');
  }
  
  // Recalculate P&L
  this.calculatePnL();
};

OrderSchema.methods.cancel = function(reason?: string): void {
  if (this.isActive()) {
    this.updateStatus('CANCELLED');
    if (reason) {
      this.rejectionReason = reason;
    }
  }
};

OrderSchema.methods.isActive = function(): boolean {
  return ['PENDING', 'SUBMITTED', 'PARTIAL_FILLED'].includes(this.status);
};

OrderSchema.methods.canModify = function(): boolean {
  return ['PENDING', 'SUBMITTED'].includes(this.status);
};

// Static methods
OrderSchema.statics.findActiveOrders = function() {
  return this.find({ 
    status: { $in: ['PENDING', 'SUBMITTED', 'PARTIAL_FILLED'] }
  });
};

OrderSchema.statics.findByUser = function(userId: Types.ObjectId) {
  return this.find({ userId }).sort({ createdAt: -1 });
};

OrderSchema.statics.findBySession = function(sessionId: Types.ObjectId) {
  return this.find({ sessionId }).sort({ createdAt: -1 });
};

export const Order = model<IOrder>('Order', OrderSchema);
export default Order;