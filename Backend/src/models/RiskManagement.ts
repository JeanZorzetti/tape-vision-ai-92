import { Schema, model, Document, Types } from 'mongoose';

export interface IRiskManagement extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  
  // Risk Profile
  riskProfile: {
    level: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE' | 'VERY_AGGRESSIVE';
    maxDailyLoss: number;
    maxDailyLossPercentage: number;
    maxPositionSize: number;
    maxPositionSizePercentage: number;
    
    // Advanced limits
    maxDrawdown: number;
    maxConsecutiveLosses: number;
    maxOpenPositions: number;
    maxLeverage: number;
    
    // Time-based limits
    maxTradingHours: number; // Max hours per day
    cooldownPeriod: number; // Minutes after max loss hit
    
    // Correlation limits
    maxCorrelatedPositions: number;
    correlationThreshold: number;
  };
  
  // Current Risk Metrics
  currentRisk: {
    dailyPnL: number;
    dailyLoss: number;
    dailyGain: number;
    
    unrealizedPnL: number;
    realizedPnL: number;
    totalPnL: number;
    
    currentDrawdown: number;
    maxDrawdownToday: number;
    
    consecutiveWins: number;
    consecutiveLosses: number;
    
    openPositions: number;
    totalExposure: number;
    
    riskScore: number; // 0-100
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };
  
  // Position Limits
  positionLimits: {
    maxPositionValue: number;
    maxPositionCount: number;
    
    // Per instrument limits
    instrumentLimits: Array<{
      symbol: string;
      maxPositions: number;
      maxValue: number;
      currentPositions: number;
      currentValue: number;
    }>;
    
    // Sector/correlation limits
    sectorLimits: Array<{
      sector: string;
      maxExposure: number;
      currentExposure: number;
    }>;
  };
  
  // Risk Events
  riskEvents: Array<{
    timestamp: Date;
    type: 'LIMIT_BREACH' | 'WARNING' | 'EMERGENCY_STOP' | 'MARGIN_CALL' | 'RECOVERY' | 'MANUAL_OVERRIDE';
    severity: 'INFO' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
    description: string;
    
    metrics: {
      triggeredLimit: string;
      currentValue: number;
      limitValue: number;
      riskScore: number;
    };
    
    actions: Array<{
      type: 'BLOCK_TRADING' | 'CLOSE_POSITIONS' | 'REDUCE_SIZE' | 'NOTIFY_USER' | 'EMERGENCY_STOP';
      executed: boolean;
      timestamp?: Date;
      result?: string;
    }>;
    
    metadata?: any;
  }>;
  
  // Monitoring Rules
  monitoringRules: Array<{
    ruleId: string;
    name: string;
    description: string;
    
    condition: {
      metric: string; // e.g., 'dailyLoss', 'consecutiveLosses'
      operator: 'GREATER_THAN' | 'LESS_THAN' | 'EQUALS' | 'PERCENTAGE_OF';
      threshold: number;
      
      // Time-based conditions
      timeWindow?: number; // minutes
      frequency?: 'REAL_TIME' | 'MINUTE' | 'HOUR' | 'DAY';
    };
    
    actions: Array<{
      type: string;
      parameters: any;
      priority: number;
    }>;
    
    isActive: boolean;
    lastTriggered?: Date;
    triggerCount: number;
  }>;
  
  // Circuit Breakers
  circuitBreakers: {
    dailyLossBreaker: {
      enabled: boolean;
      threshold: number;
      triggered: boolean;
      triggerTime?: Date;
      resetTime?: Date;
    };
    
    drawdownBreaker: {
      enabled: boolean;
      threshold: number;
      triggered: boolean;
      triggerTime?: Date;
      resetTime?: Date;
    };
    
    velocityBreaker: {
      enabled: boolean;
      lossVelocity: number; // Loss per minute threshold
      triggered: boolean;
      triggerTime?: Date;
      resetTime?: Date;
    };
    
    consecutiveLossBreaker: {
      enabled: boolean;
      threshold: number;
      triggered: boolean;
      triggerTime?: Date;
      resetTime?: Date;
    };
  };
  
  // Margin and Leverage
  marginManagement: {
    availableMargin: number;
    usedMargin: number;
    marginUtilization: number; // Percentage
    
    maintenanceMargin: number;
    initialMargin: number;
    
    marginLevel: number; // Equity / Used Margin
    marginCallThreshold: number;
    
    leverageRatio: number;
    maxLeverageAllowed: number;
  };
  
  // Performance Analytics
  performance: {
    // Risk-adjusted returns
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    
    // Risk metrics
    valueAtRisk: number; // VaR 95%
    expectedShortfall: number; // ES 95%
    maxDrawdownPeriod: number; // Days
    
    // Efficiency metrics
    profitFactor: number;
    recoveryFactor: number;
    ulcerIndex: number;
    
    // Behavioral metrics
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
    
    winRate: number;
    lossRate: number;
    
    avgTimeInWinners: number; // Minutes
    avgTimeInLosers: number;
  };
  
  // ML Risk Scoring
  mlRiskScoring: {
    enabled: boolean;
    modelVersion: string;
    
    currentScore: number; // 0-100
    confidence: number; // 0-1
    
    factors: {
      tradingBehavior: number;
      marketConditions: number;
      portfolioRisk: number;
      historicalPerformance: number;
    };
    
    recommendations: string[];
    lastUpdate: Date;
  };
  
  // Stress Testing
  stressTesting: {
    enabled: boolean;
    
    scenarios: Array<{
      name: string;
      description: string;
      marketShock: number; // Percentage move
      
      estimatedLoss: number;
      impactScore: number; // 0-100
      
      lastTested: Date;
    }>;
    
    worstCaseScenario: {
      estimatedLoss: number;
      probability: number;
      description: string;
    };
  };
  
  // Configuration
  config: {
    autoRiskManagement: boolean;
    emergencyStopEnabled: boolean;
    
    notificationSettings: {
      emailAlerts: boolean;
      smsAlerts: boolean;
      pushNotifications: boolean;
      
      thresholds: {
        warning: number; // Risk score
        critical: number;
        emergency: number;
      };
    };
    
    reportingFrequency: 'REAL_TIME' | 'HOURLY' | 'DAILY';
    
    recoverySettings: {
      autoResumeEnabled: boolean;
      cooldownPeriod: number; // Minutes
      requiredImprovement: number; // Risk score improvement needed
    };
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  calculateRiskScore(): number;
  checkAllLimits(): Array<any>;
  triggerCircuitBreaker(type: string, reason: string): void;
  addRiskEvent(event: any): void;
  canTrade(): boolean;
  getPositionSizeRecommendation(symbol: string, confidence: number): number;
  updateRiskMetrics(): void;
}

const RiskManagementSchema = new Schema<IRiskManagement>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  sessionId: {
    type: Schema.Types.ObjectId,
    ref: 'TradingSession',
    index: true
  },
  
  // Risk Profile
  riskProfile: {
    level: {
      type: String,
      enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE', 'VERY_AGGRESSIVE'],
      default: 'MODERATE'
    },
    
    maxDailyLoss: {
      type: Number,
      default: 500,
      min: 0
    },
    
    maxDailyLossPercentage: {
      type: Number,
      default: 2,
      min: 0,
      max: 100
    },
    
    maxPositionSize: {
      type: Number,
      default: 2,
      min: 1
    },
    
    maxPositionSizePercentage: {
      type: Number,
      default: 10,
      min: 0,
      max: 100
    },
    
    maxDrawdown: {
      type: Number,
      default: 1000,
      min: 0
    },
    
    maxConsecutiveLosses: {
      type: Number,
      default: 3,
      min: 1
    },
    
    maxOpenPositions: {
      type: Number,
      default: 5,
      min: 1
    },
    
    maxLeverage: {
      type: Number,
      default: 10,
      min: 1
    },
    
    maxTradingHours: {
      type: Number,
      default: 8,
      min: 1,
      max: 24
    },
    
    cooldownPeriod: {
      type: Number,
      default: 30,
      min: 0
    },
    
    maxCorrelatedPositions: {
      type: Number,
      default: 3,
      min: 1
    },
    
    correlationThreshold: {
      type: Number,
      default: 0.7,
      min: 0,
      max: 1
    }
  },
  
  // Current Risk Metrics
  currentRisk: {
    dailyPnL: { type: Number, default: 0 },
    dailyLoss: { type: Number, default: 0 },
    dailyGain: { type: Number, default: 0 },
    
    unrealizedPnL: { type: Number, default: 0 },
    realizedPnL: { type: Number, default: 0 },
    totalPnL: { type: Number, default: 0 },
    
    currentDrawdown: { type: Number, default: 0 },
    maxDrawdownToday: { type: Number, default: 0 },
    
    consecutiveWins: { type: Number, default: 0 },
    consecutiveLosses: { type: Number, default: 0 },
    
    openPositions: { type: Number, default: 0 },
    totalExposure: { type: Number, default: 0 },
    
    riskScore: { type: Number, default: 0, min: 0, max: 100 },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'LOW'
    }
  },
  
  // Position Limits
  positionLimits: {
    maxPositionValue: { type: Number, default: 10000 },
    maxPositionCount: { type: Number, default: 5 },
    
    instrumentLimits: [{
      symbol: { type: String, required: true },
      maxPositions: { type: Number, min: 1 },
      maxValue: { type: Number, min: 0 },
      currentPositions: { type: Number, default: 0 },
      currentValue: { type: Number, default: 0 }
    }],
    
    sectorLimits: [{
      sector: String,
      maxExposure: { type: Number, min: 0 },
      currentExposure: { type: Number, default: 0 }
    }]
  },
  
  // Risk Events
  riskEvents: [{
    timestamp: {
      type: Date,
      default: Date.now
    },
    
    type: {
      type: String,
      enum: ['LIMIT_BREACH', 'WARNING', 'EMERGENCY_STOP', 'MARGIN_CALL', 'RECOVERY', 'MANUAL_OVERRIDE'],
      required: true
    },
    
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL', 'EMERGENCY'],
      required: true
    },
    
    description: {
      type: String,
      required: true
    },
    
    metrics: {
      triggeredLimit: String,
      currentValue: Number,
      limitValue: Number,
      riskScore: Number
    },
    
    actions: [{
      type: {
        type: String,
        enum: ['BLOCK_TRADING', 'CLOSE_POSITIONS', 'REDUCE_SIZE', 'NOTIFY_USER', 'EMERGENCY_STOP']
      },
      executed: { type: Boolean, default: false },
      timestamp: Date,
      result: String
    }],
    
    metadata: Schema.Types.Mixed
  }],
  
  // Monitoring Rules
  monitoringRules: [{
    ruleId: { type: String, required: true },
    name: { type: String, required: true },
    description: String,
    
    condition: {
      metric: { type: String, required: true },
      operator: {
        type: String,
        enum: ['GREATER_THAN', 'LESS_THAN', 'EQUALS', 'PERCENTAGE_OF'],
        required: true
      },
      threshold: { type: Number, required: true },
      
      timeWindow: Number,
      frequency: {
        type: String,
        enum: ['REAL_TIME', 'MINUTE', 'HOUR', 'DAY'],
        default: 'REAL_TIME'
      }
    },
    
    actions: [{
      type: String,
      parameters: Schema.Types.Mixed,
      priority: { type: Number, min: 1, max: 10 }
    }],
    
    isActive: { type: Boolean, default: true },
    lastTriggered: Date,
    triggerCount: { type: Number, default: 0 }
  }],
  
  // Circuit Breakers
  circuitBreakers: {
    dailyLossBreaker: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, default: 500 },
      triggered: { type: Boolean, default: false },
      triggerTime: Date,
      resetTime: Date
    },
    
    drawdownBreaker: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, default: 1000 },
      triggered: { type: Boolean, default: false },
      triggerTime: Date,
      resetTime: Date
    },
    
    velocityBreaker: {
      enabled: { type: Boolean, default: true },
      lossVelocity: { type: Number, default: 50 }, // $50 per minute
      triggered: { type: Boolean, default: false },
      triggerTime: Date,
      resetTime: Date
    },
    
    consecutiveLossBreaker: {
      enabled: { type: Boolean, default: true },
      threshold: { type: Number, default: 3 },
      triggered: { type: Boolean, default: false },
      triggerTime: Date,
      resetTime: Date
    }
  },
  
  // Margin and Leverage
  marginManagement: {
    availableMargin: { type: Number, default: 0 },
    usedMargin: { type: Number, default: 0 },
    marginUtilization: { type: Number, default: 0, min: 0, max: 100 },
    
    maintenanceMargin: { type: Number, default: 0 },
    initialMargin: { type: Number, default: 0 },
    
    marginLevel: { type: Number, default: 100 },
    marginCallThreshold: { type: Number, default: 30 },
    
    leverageRatio: { type: Number, default: 1 },
    maxLeverageAllowed: { type: Number, default: 10 }
  },
  
  // Performance Analytics
  performance: {
    sharpeRatio: { type: Number, default: 0 },
    sortinoRatio: { type: Number, default: 0 },
    calmarRatio: { type: Number, default: 0 },
    
    valueAtRisk: { type: Number, default: 0 },
    expectedShortfall: { type: Number, default: 0 },
    maxDrawdownPeriod: { type: Number, default: 0 },
    
    profitFactor: { type: Number, default: 0 },
    recoveryFactor: { type: Number, default: 0 },
    ulcerIndex: { type: Number, default: 0 },
    
    averageWin: { type: Number, default: 0 },
    averageLoss: { type: Number, default: 0 },
    largestWin: { type: Number, default: 0 },
    largestLoss: { type: Number, default: 0 },
    
    winRate: { type: Number, default: 0 },
    lossRate: { type: Number, default: 0 },
    
    avgTimeInWinners: { type: Number, default: 0 },
    avgTimeInLosers: { type: Number, default: 0 }
  },
  
  // ML Risk Scoring
  mlRiskScoring: {
    enabled: { type: Boolean, default: false },
    modelVersion: String,
    
    currentScore: { type: Number, default: 50, min: 0, max: 100 },
    confidence: { type: Number, default: 0, min: 0, max: 1 },
    
    factors: {
      tradingBehavior: { type: Number, default: 0, min: 0, max: 100 },
      marketConditions: { type: Number, default: 0, min: 0, max: 100 },
      portfolioRisk: { type: Number, default: 0, min: 0, max: 100 },
      historicalPerformance: { type: Number, default: 0, min: 0, max: 100 }
    },
    
    recommendations: [String],
    lastUpdate: Date
  },
  
  // Stress Testing
  stressTesting: {
    enabled: { type: Boolean, default: false },
    
    scenarios: [{
      name: String,
      description: String,
      marketShock: Number,
      
      estimatedLoss: Number,
      impactScore: { type: Number, min: 0, max: 100 },
      
      lastTested: Date
    }],
    
    worstCaseScenario: {
      estimatedLoss: Number,
      probability: { type: Number, min: 0, max: 1 },
      description: String
    }
  },
  
  // Configuration
  config: {
    autoRiskManagement: { type: Boolean, default: true },
    emergencyStopEnabled: { type: Boolean, default: true },
    
    notificationSettings: {
      emailAlerts: { type: Boolean, default: true },
      smsAlerts: { type: Boolean, default: false },
      pushNotifications: { type: Boolean, default: true },
      
      thresholds: {
        warning: { type: Number, default: 60 },
        critical: { type: Number, default: 80 },
        emergency: { type: Number, default: 95 }
      }
    },
    
    reportingFrequency: {
      type: String,
      enum: ['REAL_TIME', 'HOURLY', 'DAILY'],
      default: 'REAL_TIME'
    },
    
    recoverySettings: {
      autoResumeEnabled: { type: Boolean, default: false },
      cooldownPeriod: { type: Number, default: 60 },
      requiredImprovement: { type: Number, default: 20 }
    }
  }
  
}, {
  timestamps: true
});

// Indexes
RiskManagementSchema.index({ userId: 1 });
RiskManagementSchema.index({ sessionId: 1 });
RiskManagementSchema.index({ 'currentRisk.riskScore': -1 });
RiskManagementSchema.index({ 'riskEvents.timestamp': -1 });

// Methods
RiskManagementSchema.methods.calculateRiskScore = function(): number {
  let score = 0;
  
  // Daily loss component (30% weight)
  const dailyLossRatio = Math.abs(this.currentRisk.dailyLoss) / this.riskProfile.maxDailyLoss;
  score += Math.min(dailyLossRatio * 30, 30);
  
  // Drawdown component (25% weight)
  const drawdownRatio = Math.abs(this.currentRisk.currentDrawdown) / this.riskProfile.maxDrawdown;
  score += Math.min(drawdownRatio * 25, 25);
  
  // Consecutive losses component (20% weight)
  const consecutiveLossRatio = this.currentRisk.consecutiveLosses / this.riskProfile.maxConsecutiveLosses;
  score += Math.min(consecutiveLossRatio * 20, 20);
  
  // Position exposure component (15% weight)
  const exposureRatio = this.currentRisk.totalExposure / this.positionLimits.maxPositionValue;
  score += Math.min(exposureRatio * 15, 15);
  
  // Margin utilization component (10% weight)
  score += Math.min(this.marginManagement.marginUtilization * 0.1, 10);
  
  this.currentRisk.riskScore = Math.min(Math.round(score), 100);
  
  // Update risk level
  if (this.currentRisk.riskScore >= 95) {
    this.currentRisk.riskLevel = 'CRITICAL';
  } else if (this.currentRisk.riskScore >= 80) {
    this.currentRisk.riskLevel = 'HIGH';
  } else if (this.currentRisk.riskScore >= 60) {
    this.currentRisk.riskLevel = 'MEDIUM';
  } else {
    this.currentRisk.riskLevel = 'LOW';
  }
  
  return this.currentRisk.riskScore;
};

RiskManagementSchema.methods.checkAllLimits = function(): Array<any> {
  const violations = [];
  
  // Check daily loss limit
  if (Math.abs(this.currentRisk.dailyLoss) >= this.riskProfile.maxDailyLoss) {
    violations.push({
      type: 'DAILY_LOSS_LIMIT',
      severity: 'CRITICAL',
      current: this.currentRisk.dailyLoss,
      limit: this.riskProfile.maxDailyLoss
    });
  }
  
  // Check consecutive losses
  if (this.currentRisk.consecutiveLosses >= this.riskProfile.maxConsecutiveLosses) {
    violations.push({
      type: 'CONSECUTIVE_LOSS_LIMIT',
      severity: 'CRITICAL',
      current: this.currentRisk.consecutiveLosses,
      limit: this.riskProfile.maxConsecutiveLosses
    });
  }
  
  // Check drawdown limit
  if (Math.abs(this.currentRisk.currentDrawdown) >= this.riskProfile.maxDrawdown) {
    violations.push({
      type: 'DRAWDOWN_LIMIT',
      severity: 'CRITICAL',
      current: this.currentRisk.currentDrawdown,
      limit: this.riskProfile.maxDrawdown
    });
  }
  
  // Check position limits
  if (this.currentRisk.openPositions >= this.riskProfile.maxOpenPositions) {
    violations.push({
      type: 'POSITION_COUNT_LIMIT',
      severity: 'WARNING',
      current: this.currentRisk.openPositions,
      limit: this.riskProfile.maxOpenPositions
    });
  }
  
  // Check margin level
  if (this.marginManagement.marginLevel <= this.marginManagement.marginCallThreshold) {
    violations.push({
      type: 'MARGIN_CALL',
      severity: 'CRITICAL',
      current: this.marginManagement.marginLevel,
      limit: this.marginManagement.marginCallThreshold
    });
  }
  
  return violations;
};

RiskManagementSchema.methods.triggerCircuitBreaker = function(type: string, reason: string): void {
  const breaker = (this.circuitBreakers as any)[type];
  if (breaker && breaker.enabled && !breaker.triggered) {
    breaker.triggered = true;
    breaker.triggerTime = new Date();
    
    this.addRiskEvent({
      type: 'EMERGENCY_STOP',
      severity: 'EMERGENCY',
      description: `Circuit breaker triggered: ${type} - ${reason}`,
      metrics: {
        triggeredLimit: type,
        riskScore: this.currentRisk.riskScore
      },
      actions: [{
        type: 'EMERGENCY_STOP',
        executed: true,
        timestamp: new Date()
      }]
    });
  }
};

RiskManagementSchema.methods.addRiskEvent = function(event: any): void {
  this.riskEvents.push({
    timestamp: new Date(),
    type: event.type,
    severity: event.severity,
    description: event.description,
    metrics: event.metrics || {},
    actions: event.actions || [],
    metadata: event.metadata
  });
  
  // Keep only last 1000 events
  if (this.riskEvents.length > 1000) {
    this.riskEvents = this.riskEvents.slice(-1000);
  }
};

RiskManagementSchema.methods.canTrade = function(): boolean {
  // Check if any circuit breakers are triggered
  const breakersTriggered = Object.values(this.circuitBreakers).some((breaker: any) => 
    breaker.enabled && breaker.triggered
  );
  
  if (breakersTriggered) {
    return false;
  }
  
  // Check limit violations
  const violations = this.checkAllLimits();
  const criticalViolations = violations.filter(v => v.severity === 'CRITICAL');
  
  return criticalViolations.length === 0;
};

RiskManagementSchema.methods.getPositionSizeRecommendation = function(
  symbol: string, 
  confidence: number
): number {
  const baseSize = this.riskProfile.maxPositionSize;
  
  // Adjust for confidence (50% to 100% of max size)
  let adjustedSize = baseSize * (0.5 + (confidence * 0.5));
  
  // Reduce size if risk score is high
  if (this.currentRisk.riskScore > 70) {
    adjustedSize *= 0.5;
  } else if (this.currentRisk.riskScore > 50) {
    adjustedSize *= 0.75;
  }
  
  // Check instrument-specific limits
  const instrumentLimit = this.positionLimits.instrumentLimits.find(l => l.symbol === symbol);
  if (instrumentLimit) {
    const availablePositions = instrumentLimit.maxPositions - instrumentLimit.currentPositions;
    adjustedSize = Math.min(adjustedSize, availablePositions);
  }
  
  return Math.max(Math.floor(adjustedSize), 1);
};

RiskManagementSchema.methods.updateRiskMetrics = function(): void {
  // This would be called periodically to update risk metrics
  this.calculateRiskScore();
  
  // Update margin utilization
  if (this.marginManagement.availableMargin > 0) {
    this.marginManagement.marginUtilization = 
      (this.marginManagement.usedMargin / 
       (this.marginManagement.availableMargin + this.marginManagement.usedMargin)) * 100;
  }
  
  // Update margin level
  if (this.marginManagement.usedMargin > 0) {
    const equity = this.marginManagement.availableMargin + this.marginManagement.usedMargin + this.currentRisk.unrealizedPnL;
    this.marginManagement.marginLevel = (equity / this.marginManagement.usedMargin) * 100;
  }
  
  // Check for limit violations
  const violations = this.checkAllLimits();
  violations.forEach(violation => {
    if (violation.severity === 'CRITICAL') {
      this.addRiskEvent({
        type: 'LIMIT_BREACH',
        severity: violation.severity,
        description: `${violation.type} breached: ${violation.current} >= ${violation.limit}`,
        metrics: {
          triggeredLimit: violation.type,
          currentValue: violation.current,
          limitValue: violation.limit,
          riskScore: this.currentRisk.riskScore
        }
      });
    }
  });
};

// Static methods
RiskManagementSchema.statics.findByUser = function(userId: Types.ObjectId) {
  return this.findOne({ userId });
};

RiskManagementSchema.statics.findHighRiskUsers = function() {
  return this.find({ 'currentRisk.riskLevel': { $in: ['HIGH', 'CRITICAL'] } });
};

export const RiskManagement = model<IRiskManagement>('RiskManagement', RiskManagementSchema);
export default RiskManagement;