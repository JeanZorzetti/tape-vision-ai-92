import { Schema, model, Document, Types } from 'mongoose';

export interface IMarketData extends Document {
  _id: Types.ObjectId;
  
  // Market Identification
  symbol: string; // e.g., 'WDO', 'WIN'
  exchange: string; // e.g., 'B3', 'CME'
  market: 'FUTURES' | 'STOCKS' | 'OPTIONS' | 'FOREX';
  
  // Timestamp and Session
  timestamp: Date;
  marketTime: Date; // Exchange local time
  sessionType: 'REGULAR' | 'PRE_MARKET' | 'AFTER_HOURS' | 'EXTENDED';
  
  // Price Data
  price: number; // Current/Last price
  bid: number;
  ask: number;
  spread: number; // Ask - Bid
  spreadPercentage: number;
  
  // OHLC Data
  open: number;
  high: number;
  low: number;
  close?: number; // Only for completed candles
  
  // Volume and Turnover
  volume: number; // Current session volume
  turnover: number; // Volume * Price
  avgVolume: number; // Average volume (20-day)
  
  // Volume Analysis
  volumeProfile: {
    poc: number; // Point of Control
    vah: number; // Value Area High
    val: number; // Value Area Low
    valueAreaVolume: number;
  };
  
  // Order Book Data
  orderBook: {
    bids: Array<{
      price: number;
      size: number;
      orders: number;
    }>;
    asks: Array<{
      price: number;
      size: number;
      orders: number;
    }>;
    totalBidSize: number;
    totalAskSize: number;
    imbalance: number; // -1 to 1 (negative = sell pressure)
  };
  
  // Tick Data
  ticks: Array<{
    timestamp: Date;
    price: number;
    size: number;
    side: 'BUY' | 'SELL' | 'UNKNOWN';
    aggressor: boolean;
  }>;
  
  // Market Statistics
  statistics: {
    change: number; // Price change from previous close
    changePercent: number;
    
    highLow: {
      high52Week: number;
      low52Week: number;
      highToday: number;
      lowToday: number;
    };
    
    volatility: {
      realized: number; // Historical volatility
      implied?: number; // Options implied volatility
      atr: number; // Average True Range
    };
    
    momentum: {
      rsi: number;
      macd: number;
      stochastic: number;
    };
  };
  
  // Market Microstructure
  microstructure: {
    tickSize: number;
    contractSize: number;
    tickValue: number;
    
    // Liquidity measures
    depth: {
      level1: number; // Best bid/ask sizes
      level5: number; // Top 5 levels total size
      level10: number; // Top 10 levels total size
    };
    
    // Flow measures
    buyFlow: number; // Aggressive buy volume
    sellFlow: number; // Aggressive sell volume
    netFlow: number; // Buy - Sell flow
    
    // Institutional activity
    largeTradeThreshold: number;
    largeTradeCount: number;
    largeTradeVolume: number;
    
    // Hidden liquidity indicators
    icebergDetected: number;
    hiddenLiquidity: number;
  };
  
  // Technical Indicators
  technicalIndicators: {
    sma: {
      sma20: number;
      sma50: number;
      sma200: number;
    };
    
    ema: {
      ema9: number;
      ema21: number;
      ema50: number;
    };
    
    vwap: {
      vwap: number;
      vwapDeviation: number;
    };
    
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
      bandwidth: number;
    };
    
    fibonacci: {
      levels: number[];
      support: number;
      resistance: number;
    };
  };
  
  // Market Events
  events: Array<{
    timestamp: Date;
    type: 'NEWS' | 'EARNINGS' | 'DIVIDEND' | 'HALT' | 'RESUME' | 'CIRCUIT_BREAKER';
    description: string;
    impact: 'LOW' | 'MEDIUM' | 'HIGH';
    metadata?: any;
  }>;
  
  // Data Quality
  quality: {
    dataLatency: number; // ms
    tickCount: number;
    gapDetected: boolean;
    anomalyScore: number; // 0-1
    
    sources: Array<{
      name: string;
      weight: number;
      latency: number;
      quality: number;
    }>;
  };
  
  // Market Classification
  classification: {
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    regime: 'TRENDING' | 'RANGING' | 'VOLATILE';
    phase: 'ACCUMULATION' | 'MARKUP' | 'DISTRIBUTION' | 'DECLINE';
    
    strength: number; // 0-1
    confidence: number; // 0-1
  };
  
  // Correlation Data
  correlations: Array<{
    symbol: string;
    correlation: number;
    timestamp: Date;
  }>;
  
  // Options Data (if applicable)
  options?: {
    impliedVolatility: number;
    greeks: {
      delta: number;
      gamma: number;
      theta: number;
      vega: number;
    };
    putCallRatio: number;
  };
  
  // Meta Information
  meta: {
    source: string;
    provider: string;
    feedType: 'REAL_TIME' | 'DELAYED' | 'SIMULATED';
    
    updateCount: number;
    lastUpdateSource: string;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  addTick(tick: any): void;
  updateOrderBook(book: any): void;
  calculateTechnicalIndicators(): void;
  detectAnomalies(): number;
  getMarketPhase(): string;
  isMarketOpen(): boolean;
}

const MarketDataSchema = new Schema<IMarketData>({
  // Market Identification
  symbol: {
    type: String,
    required: true,
    uppercase: true,
    index: true
  },
  
  exchange: {
    type: String,
    required: true,
    uppercase: true
  },
  
  market: {
    type: String,
    enum: ['FUTURES', 'STOCKS', 'OPTIONS', 'FOREX'],
    default: 'FUTURES'
  },
  
  // Timestamp and Session
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  marketTime: {
    type: Date,
    required: true
  },
  
  sessionType: {
    type: String,
    enum: ['REGULAR', 'PRE_MARKET', 'AFTER_HOURS', 'EXTENDED'],
    default: 'REGULAR'
  },
  
  // Price Data
  price: {
    type: Number,
    required: true,
    min: 0
  },
  
  bid: {
    type: Number,
    required: true,
    min: 0
  },
  
  ask: {
    type: Number,
    required: true,
    min: 0
  },
  
  spread: {
    type: Number,
    min: 0
  },
  
  spreadPercentage: {
    type: Number,
    min: 0
  },
  
  // OHLC Data
  open: {
    type: Number,
    required: true,
    min: 0
  },
  
  high: {
    type: Number,
    required: true,
    min: 0
  },
  
  low: {
    type: Number,
    required: true,
    min: 0
  },
  
  close: {
    type: Number,
    min: 0
  },
  
  // Volume and Turnover
  volume: {
    type: Number,
    default: 0,
    min: 0
  },
  
  turnover: {
    type: Number,
    default: 0,
    min: 0
  },
  
  avgVolume: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Volume Profile
  volumeProfile: {
    poc: Number,
    vah: Number,
    val: Number,
    valueAreaVolume: Number
  },
  
  // Order Book Data
  orderBook: {
    bids: [{
      price: { type: Number, min: 0 },
      size: { type: Number, min: 0 },
      orders: { type: Number, min: 0 }
    }],
    asks: [{
      price: { type: Number, min: 0 },
      size: { type: Number, min: 0 },
      orders: { type: Number, min: 0 }
    }],
    totalBidSize: { type: Number, default: 0 },
    totalAskSize: { type: Number, default: 0 },
    imbalance: { type: Number, min: -1, max: 1 }
  },
  
  // Tick Data (limited to recent ticks)
  ticks: [{
    timestamp: Date,
    price: { type: Number, min: 0 },
    size: { type: Number, min: 0 },
    side: {
      type: String,
      enum: ['BUY', 'SELL', 'UNKNOWN']
    },
    aggressor: Boolean
  }],
  
  // Market Statistics
  statistics: {
    change: Number,
    changePercent: Number,
    
    highLow: {
      high52Week: Number,
      low52Week: Number,
      highToday: Number,
      lowToday: Number
    },
    
    volatility: {
      realized: { type: Number, min: 0 },
      implied: { type: Number, min: 0 },
      atr: { type: Number, min: 0 }
    },
    
    momentum: {
      rsi: { type: Number, min: 0, max: 100 },
      macd: Number,
      stochastic: { type: Number, min: 0, max: 100 }
    }
  },
  
  // Market Microstructure
  microstructure: {
    tickSize: { type: Number, min: 0 },
    contractSize: { type: Number, min: 1 },
    tickValue: { type: Number, min: 0 },
    
    depth: {
      level1: { type: Number, min: 0 },
      level5: { type: Number, min: 0 },
      level10: { type: Number, min: 0 }
    },
    
    buyFlow: { type: Number, min: 0 },
    sellFlow: { type: Number, min: 0 },
    netFlow: Number,
    
    largeTradeThreshold: { type: Number, min: 0 },
    largeTradeCount: { type: Number, min: 0 },
    largeTradeVolume: { type: Number, min: 0 },
    
    icebergDetected: { type: Number, min: 0 },
    hiddenLiquidity: { type: Number, min: 0 }
  },
  
  // Technical Indicators
  technicalIndicators: {
    sma: {
      sma20: Number,
      sma50: Number,
      sma200: Number
    },
    
    ema: {
      ema9: Number,
      ema21: Number,
      ema50: Number
    },
    
    vwap: {
      vwap: Number,
      vwapDeviation: Number
    },
    
    bollinger: {
      upper: Number,
      middle: Number,
      lower: Number,
      bandwidth: Number
    },
    
    fibonacci: {
      levels: [Number],
      support: Number,
      resistance: Number
    }
  },
  
  // Market Events
  events: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['NEWS', 'EARNINGS', 'DIVIDEND', 'HALT', 'RESUME', 'CIRCUIT_BREAKER']
    },
    description: String,
    impact: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH']
    },
    metadata: Schema.Types.Mixed
  }],
  
  // Data Quality
  quality: {
    dataLatency: { type: Number, min: 0 },
    tickCount: { type: Number, min: 0 },
    gapDetected: { type: Boolean, default: false },
    anomalyScore: { type: Number, min: 0, max: 1 },
    
    sources: [{
      name: String,
      weight: { type: Number, min: 0, max: 1 },
      latency: { type: Number, min: 0 },
      quality: { type: Number, min: 0, max: 1 }
    }]
  },
  
  // Market Classification
  classification: {
    trend: {
      type: String,
      enum: ['BULLISH', 'BEARISH', 'SIDEWAYS'],
      default: 'SIDEWAYS'
    },
    regime: {
      type: String,
      enum: ['TRENDING', 'RANGING', 'VOLATILE'],
      default: 'RANGING'
    },
    phase: {
      type: String,
      enum: ['ACCUMULATION', 'MARKUP', 'DISTRIBUTION', 'DECLINE']
    },
    
    strength: { type: Number, min: 0, max: 1 },
    confidence: { type: Number, min: 0, max: 1 }
  },
  
  // Correlation Data
  correlations: [{
    symbol: String,
    correlation: { type: Number, min: -1, max: 1 },
    timestamp: Date
  }],
  
  // Options Data
  options: {
    impliedVolatility: Number,
    greeks: {
      delta: Number,
      gamma: Number,
      theta: Number,
      vega: Number
    },
    putCallRatio: Number
  },
  
  // Meta Information
  meta: {
    source: String,
    provider: String,
    feedType: {
      type: String,
      enum: ['REAL_TIME', 'DELAYED', 'SIMULATED'],
      default: 'REAL_TIME'
    },
    
    updateCount: { type: Number, default: 1 },
    lastUpdateSource: String
  }
  
}, {
  timestamps: true
});

// Indexes
MarketDataSchema.index({ symbol: 1, timestamp: -1 });
MarketDataSchema.index({ timestamp: -1 });
MarketDataSchema.index({ 'classification.trend': 1 });
MarketDataSchema.index({ 'quality.dataLatency': 1 });

// TTL index to auto-delete old tick data (keep 24 hours)
MarketDataSchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

// Virtual for market status
MarketDataSchema.virtual('isOpen').get(function() {
  return this.sessionType === 'REGULAR';
});

// Methods
MarketDataSchema.methods.addTick = function(tick: any): void {
  // Limit ticks array to last 1000 ticks
  if (this.ticks.length >= 1000) {
    this.ticks.shift();
  }
  
  this.ticks.push({
    timestamp: tick.timestamp || new Date(),
    price: tick.price,
    size: tick.size,
    side: tick.side || 'UNKNOWN',
    aggressor: tick.aggressor || false
  });
  
  // Update price and statistics
  this.price = tick.price;
  this.volume += tick.size;
  this.turnover += tick.price * tick.size;
  
  // Update high/low
  if (tick.price > this.high) {
    this.high = tick.price;
    this.statistics.highLow.highToday = tick.price;
  }
  
  if (tick.price < this.low) {
    this.low = tick.price;
    this.statistics.highLow.lowToday = tick.price;
  }
  
  // Update flow data
  if (tick.aggressor && tick.side === 'BUY') {
    this.microstructure.buyFlow += tick.size;
  } else if (tick.aggressor && tick.side === 'SELL') {
    this.microstructure.sellFlow += tick.size;
  }
  
  this.microstructure.netFlow = this.microstructure.buyFlow - this.microstructure.sellFlow;
  
  this.quality.tickCount += 1;
};

MarketDataSchema.methods.updateOrderBook = function(book: any): void {
  this.orderBook = {
    bids: book.bids.slice(0, 10), // Keep top 10 levels
    asks: book.asks.slice(0, 10),
    totalBidSize: book.bids.reduce((sum: number, level: any) => sum + level.size, 0),
    totalAskSize: book.asks.reduce((sum: number, level: any) => sum + level.size, 0),
    imbalance: 0
  };
  
  // Calculate imbalance
  const totalSize = this.orderBook.totalBidSize + this.orderBook.totalAskSize;
  if (totalSize > 0) {
    this.orderBook.imbalance = (this.orderBook.totalBidSize - this.orderBook.totalAskSize) / totalSize;
  }
  
  // Update bid/ask
  if (book.bids.length > 0) {
    this.bid = book.bids[0].price;
  }
  
  if (book.asks.length > 0) {
    this.ask = book.asks[0].price;
  }
  
  // Update spread
  this.spread = this.ask - this.bid;
  if (this.price > 0) {
    this.spreadPercentage = (this.spread / this.price) * 100;
  }
};

MarketDataSchema.methods.calculateTechnicalIndicators = function(): void {
  // This would implement actual technical indicator calculations
  // For now, we'll set placeholder values
  
  this.statistics.change = this.price - this.open;
  this.statistics.changePercent = ((this.price - this.open) / this.open) * 100;
  
  // Volatility calculation (simplified ATR)
  this.statistics.volatility.atr = this.high - this.low;
  
  // Simple trend detection
  if (this.statistics.changePercent > 0.5) {
    this.classification.trend = 'BULLISH';
  } else if (this.statistics.changePercent < -0.5) {
    this.classification.trend = 'BEARISH';
  } else {
    this.classification.trend = 'SIDEWAYS';
  }
};

MarketDataSchema.methods.detectAnomalies = function(): number {
  let anomalyScore = 0;
  
  // Check for unusual volume
  if (this.avgVolume > 0 && this.volume > this.avgVolume * 3) {
    anomalyScore += 0.3;
  }
  
  // Check for unusual price movement
  if (Math.abs(this.statistics.changePercent) > 5) {
    anomalyScore += 0.4;
  }
  
  // Check for unusual spread
  if (this.spreadPercentage > 0.1) {
    anomalyScore += 0.2;
  }
  
  // Check for data gaps
  if (this.quality.gapDetected) {
    anomalyScore += 0.1;
  }
  
  this.quality.anomalyScore = Math.min(anomalyScore, 1);
  return this.quality.anomalyScore;
};

MarketDataSchema.methods.getMarketPhase = function(): string {
  const changePercent = Math.abs(this.statistics.changePercent);
  const volumeRatio = this.avgVolume > 0 ? this.volume / this.avgVolume : 1;
  
  if (changePercent > 2 && volumeRatio > 1.5) {
    return this.statistics.changePercent > 0 ? 'MARKUP' : 'DECLINE';
  } else if (changePercent < 0.5 && volumeRatio < 0.8) {
    return 'ACCUMULATION';
  } else if (changePercent > 1 && volumeRatio > 2) {
    return 'DISTRIBUTION';
  }
  
  return 'RANGING';
};

MarketDataSchema.methods.isMarketOpen = function(): boolean {
  const now = new Date();
  const marketHour = now.getHours();
  
  // Simplified market hours (9:00 - 17:30 for B3)
  return marketHour >= 9 && marketHour < 18 && this.sessionType === 'REGULAR';
};

// Static methods
MarketDataSchema.statics.findLatest = function(symbol: string) {
  return this.findOne({ symbol }).sort({ timestamp: -1 });
};

MarketDataSchema.statics.findByTimeRange = function(
  symbol: string, 
  startTime: Date, 
  endTime: Date
) {
  return this.find({
    symbol,
    timestamp: { $gte: startTime, $lte: endTime }
  }).sort({ timestamp: 1 });
};

export const MarketData = model<IMarketData>('MarketData', MarketDataSchema);
export default MarketData;