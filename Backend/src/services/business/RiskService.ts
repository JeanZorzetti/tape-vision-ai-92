import { Types } from 'mongoose';
import { 
  RiskManagement, 
  IRiskManagement, 
  TradingSession,
  Position, 
  Order,
  User 
} from '../models';

interface RiskAssessment {
  canTrade: boolean;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: Array<{
    type: string;
    severity: 'INFO' | 'WARNING' | 'CRITICAL';
    message: string;
    current: number;
    limit: number;
  }>;
  recommendations: string[];
}

interface PositionSizeRecommendation {
  recommendedSize: number;
  maxSize: number;
  reasoning: string[];
  riskAdjustment: number;
}

interface CircuitBreakerStatus {
  triggered: boolean;
  type?: string;
  reason?: string;
  triggerTime?: Date;
  resetTime?: Date;
  canReset: boolean;
}

interface StressTestScenario {
  name: string;
  description: string;
  marketShock: number;
  estimatedLoss: number;
  probability: number;
}

export class RiskService {
  private static instance: RiskService;
  private monitoringInterval?: NodeJS.Timeout;

  public static getInstance(): RiskService {
    if (!RiskService.instance) {
      RiskService.instance = new RiskService();
    }
    return RiskService.instance;
  }

  constructor() {
    this.startRealTimeMonitoring();
  }

  /**
   * Risk Assessment
   */
  public async assessRisk(userId: string, sessionId?: string): Promise<RiskAssessment> {
    try {
      const riskProfile = await RiskManagement.findOne({ userId });
      
      if (!riskProfile) {
        // Create default risk profile if none exists
        await this.createDefaultRiskProfile(userId);
        return this.assessRisk(userId, sessionId);
      }

      // Update current risk metrics
      await this.updateRiskMetrics(riskProfile);

      // Check all risk limits
      const violations = riskProfile.checkAllLimits();

      // Calculate overall risk score
      const riskScore = riskProfile.calculateRiskScore();

      // Generate recommendations
      const recommendations = this.generateRiskRecommendations(riskProfile, violations);

      return {
        canTrade: riskProfile.canTrade(),
        riskScore,
        riskLevel: riskProfile.currentRisk.riskLevel,
        violations,
        recommendations
      };

    } catch (error) {
      console.error('Risk assessment error:', error);
      return {
        canTrade: false,
        riskScore: 100,
        riskLevel: 'CRITICAL',
        violations: [{
          type: 'SYSTEM_ERROR',
          severity: 'CRITICAL',
          message: 'Risk assessment failed',
          current: 0,
          limit: 0
        }],
        recommendations: ['Contact system administrator']
      };
    }
  }

  public async validateOrderRisk(
    userId: string,
    orderData: {
      symbol: string;
      side: 'BUY' | 'SELL';
      quantity: number;
      price?: number;
    }
  ): Promise<{ 
    allowed: boolean; 
    reason?: string; 
    adjustedQuantity?: number;
    riskMetrics: {
      positionValue: number;
      riskAmount: number;
      portfolioRisk: number;
    };
  }> {
    try {
      const riskProfile = await RiskManagement.findOne({ userId });
      
      if (!riskProfile || !riskProfile.canTrade()) {
        return {
          allowed: false,
          reason: 'Trading blocked by risk management',
          riskMetrics: { positionValue: 0, riskAmount: 0, portfolioRisk: 0 }
        };
      }

      const estimatedPrice = orderData.price || 4580; // Use market price if not provided
      const positionValue = orderData.quantity * estimatedPrice;
      
      // Check position size limits
      if (orderData.quantity > riskProfile.riskProfile.maxPositionSize) {
        const adjustedQuantity = riskProfile.riskProfile.maxPositionSize;
        return {
          allowed: true,
          reason: 'Quantity reduced due to position size limit',
          adjustedQuantity,
          riskMetrics: {
            positionValue: adjustedQuantity * estimatedPrice,
            riskAmount: adjustedQuantity * estimatedPrice * 0.02, // 2% risk
            portfolioRisk: riskProfile.currentRisk.riskScore
          }
        };
      }

      // Check daily loss limits
      const potentialRisk = positionValue * 0.02; // Assume 2% risk per trade
      if (Math.abs(riskProfile.currentRisk.dailyLoss) + potentialRisk > riskProfile.riskProfile.maxDailyLoss) {
        return {
          allowed: false,
          reason: 'Order would exceed daily loss limit',
          riskMetrics: {
            positionValue,
            riskAmount: potentialRisk,
            portfolioRisk: riskProfile.currentRisk.riskScore
          }
        };
      }

      // Check correlation limits
      const correlationCheck = await this.checkCorrelationRisk(userId, orderData.symbol);
      if (!correlationCheck.allowed) {
        return {
          allowed: false,
          reason: correlationCheck.reason,
          riskMetrics: {
            positionValue,
            riskAmount: potentialRisk,
            portfolioRisk: riskProfile.currentRisk.riskScore
          }
        };
      }

      return {
        allowed: true,
        riskMetrics: {
          positionValue,
          riskAmount: potentialRisk,
          portfolioRisk: riskProfile.currentRisk.riskScore
        }
      };

    } catch (error) {
      console.error('Order risk validation error:', error);
      return {
        allowed: false,
        reason: 'Risk validation failed',
        riskMetrics: { positionValue: 0, riskAmount: 0, portfolioRisk: 100 }
      };
    }
  }

  /**
   * Position Sizing
   */
  public async getPositionSizeRecommendation(
    userId: string,
    signal: {
      symbol: string;
      confidence: number;
      riskRewardRatio: number;
      stopLoss?: number;
      target?: number;
    }
  ): Promise<PositionSizeRecommendation> {
    try {
      const riskProfile = await RiskManagement.findOne({ userId });
      
      if (!riskProfile) {
        return {
          recommendedSize: 1,
          maxSize: 1,
          reasoning: ['Default position size - no risk profile found'],
          riskAdjustment: 1
        };
      }

      // Base position size from risk profile
      let baseSize = riskProfile.riskProfile.maxPositionSize;
      const reasoning: string[] = [];

      // Adjust for confidence (50% to 100% of max size)
      const confidenceAdjustment = 0.5 + (signal.confidence * 0.5);
      let adjustedSize = baseSize * confidenceAdjustment;
      reasoning.push(`Confidence adjustment: ${(confidenceAdjustment * 100).toFixed(1)}%`);

      // Adjust for risk/reward ratio
      if (signal.riskRewardRatio > 2) {
        adjustedSize *= 1.2; // Increase size for better risk/reward
        reasoning.push('Increased size for favorable risk/reward ratio');
      } else if (signal.riskRewardRatio < 1.5) {
        adjustedSize *= 0.8; // Reduce size for poor risk/reward
        reasoning.push('Reduced size for unfavorable risk/reward ratio');
      }

      // Adjust for current risk score
      const riskAdjustment = this.calculateRiskAdjustment(riskProfile.currentRisk.riskScore);
      adjustedSize *= riskAdjustment;
      if (riskAdjustment < 1) {
        reasoning.push(`Reduced size due to high risk score (${riskProfile.currentRisk.riskScore})`);
      }

      // Adjust for consecutive losses
      if (riskProfile.currentRisk.consecutiveLosses >= 2) {
        adjustedSize *= 0.5;
        reasoning.push('Reduced size due to consecutive losses');
      }

      // Apply instrument-specific limits
      const instrumentLimit = riskProfile.positionLimits.instrumentLimits.find(
        l => l.symbol === signal.symbol
      );
      
      if (instrumentLimit) {
        const availableSize = instrumentLimit.maxPositions - instrumentLimit.currentPositions;
        adjustedSize = Math.min(adjustedSize, availableSize);
        reasoning.push(`Applied instrument-specific limit for ${signal.symbol}`);
      }

      const recommendedSize = Math.max(Math.floor(adjustedSize), 1);

      return {
        recommendedSize,
        maxSize: baseSize,
        reasoning,
        riskAdjustment
      };

    } catch (error) {
      console.error('Position size recommendation error:', error);
      return {
        recommendedSize: 1,
        maxSize: 1,
        reasoning: ['Error calculating position size - using minimum'],
        riskAdjustment: 0.5
      };
    }
  }

  /**
   * Circuit Breakers
   */
  public async checkCircuitBreakers(userId: string): Promise<CircuitBreakerStatus> {
    try {
      const riskProfile = await RiskManagement.findOne({ userId });
      
      if (!riskProfile) {
        return { triggered: false, canReset: false };
      }

      const breakers = riskProfile.circuitBreakers;
      
      // Check each circuit breaker
      const breakerTypes = ['dailyLossBreaker', 'drawdownBreaker', 'velocityBreaker', 'consecutiveLossBreaker'];
      
      for (const breakerType of breakerTypes) {
        const breaker = breakers[breakerType as keyof typeof breakers] as any;
        
        if (breaker.enabled && breaker.triggered) {
          const canReset = this.canResetCircuitBreaker(breaker, breakerType);
          
          return {
            triggered: true,
            type: breakerType,
            reason: this.getCircuitBreakerReason(breakerType),
            triggerTime: breaker.triggerTime,
            resetTime: breaker.resetTime,
            canReset
          };
        }
      }

      return { triggered: false, canReset: false };

    } catch (error) {
      console.error('Circuit breaker check error:', error);
      return { triggered: true, canReset: false };
    }
  }

  public async triggerCircuitBreaker(
    userId: string,
    type: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const riskProfile = await RiskManagement.findOne({ userId });
      
      if (!riskProfile) {
        return {
          success: false,
          error: 'Risk profile not found'
        };
      }

      riskProfile.triggerCircuitBreaker(type, reason);
      await riskProfile.save();

      // Close all open positions
      await this.emergencyCloseAllPositions(userId, `Circuit breaker: ${type}`);

      return { success: true };

    } catch (error) {
      console.error('Trigger circuit breaker error:', error);
      return {
        success: false,
        error: 'Failed to trigger circuit breaker'
      };
    }
  }

  public async resetCircuitBreaker(
    userId: string,
    type: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const riskProfile = await RiskManagement.findOne({ userId });
      
      if (!riskProfile) {
        return {
          success: false,
          error: 'Risk profile not found'
        };
      }

      const breaker = (riskProfile.circuitBreakers as any)[type];
      
      if (!breaker || !this.canResetCircuitBreaker(breaker, type)) {
        return {
          success: false,
          error: 'Circuit breaker cannot be reset at this time'
        };
      }

      breaker.triggered = false;
      breaker.resetTime = new Date();

      riskProfile.addRiskEvent({
        type: 'RECOVERY',
        severity: 'INFO',
        description: `Circuit breaker ${type} manually reset`,
        actions: [{
          type: 'MANUAL_OVERRIDE',
          executed: true,
          timestamp: new Date()
        }]
      });

      await riskProfile.save();

      return { success: true };

    } catch (error) {
      console.error('Reset circuit breaker error:', error);
      return {
        success: false,
        error: 'Failed to reset circuit breaker'
      };
    }
  }

  /**
   * Stress Testing
   */
  public async runStressTest(
    userId: string,
    scenarios?: StressTestScenario[]
  ): Promise<{
    success: boolean;
    results?: Array<{
      scenario: string;
      estimatedLoss: number;
      impactScore: number;
      survivable: boolean;
    }>;
    worstCase?: {
      estimatedLoss: number;
      probability: number;
      scenario: string;
    };
    error?: string;
  }> {
    try {
      const defaultScenarios: StressTestScenario[] = [
        {
          name: 'Market Crash 10%',
          description: '10% market decline',
          marketShock: -0.10,
          estimatedLoss: 0,
          probability: 0.05
        },
        {
          name: 'Flash Crash 5%',
          description: '5% flash crash in 1 hour',
          marketShock: -0.05,
          estimatedLoss: 0,
          probability: 0.15
        },
        {
          name: 'Volatility Spike',
          description: 'Volatility increases 3x',
          marketShock: -0.03,
          estimatedLoss: 0,
          probability: 0.25
        },
        {
          name: 'Gap Down Opening',
          description: '2% gap down at market open',
          marketShock: -0.02,
          estimatedLoss: 0,
          probability: 0.30
        }
      ];

      const testScenarios = scenarios || defaultScenarios;
      
      // Get user's current positions
      const positions = await Position.find({ 
        userId, 
        status: { $in: ['OPEN', 'PARTIALLY_CLOSED'] }
      });

      const results = [];
      let worstLoss = 0;
      let worstScenario = '';
      let worstProbability = 0;

      for (const scenario of testScenarios) {
        let totalLoss = 0;

        // Calculate impact on each position
        for (const position of positions) {
          const positionValue = position.quantity * position.averagePrice;
          const shockImpact = positionValue * Math.abs(scenario.marketShock);
          
          // Account for position side
          if (position.side === 'LONG') {
            totalLoss += scenario.marketShock < 0 ? shockImpact : 0;
          } else {
            totalLoss += scenario.marketShock > 0 ? shockImpact : 0;
          }
        }

        const impactScore = Math.min((totalLoss / 10000) * 100, 100); // Scale to 0-100
        const survivable = totalLoss < 5000; // Arbitrary survival threshold

        results.push({
          scenario: scenario.name,
          estimatedLoss: totalLoss,
          impactScore,
          survivable
        });

        // Track worst case
        if (totalLoss > worstLoss) {
          worstLoss = totalLoss;
          worstScenario = scenario.name;
          worstProbability = scenario.probability;
        }
      }

      // Update risk profile with stress test results
      const riskProfile = await RiskManagement.findOne({ userId });
      if (riskProfile) {
        riskProfile.stressTesting = {
          enabled: true,
          scenarios: testScenarios.map(s => ({
            name: s.name,
            description: s.description,
            marketShock: s.marketShock,
            estimatedLoss: results.find(r => r.scenario === s.name)?.estimatedLoss || 0,
            impactScore: results.find(r => r.scenario === s.name)?.impactScore || 0,
            lastTested: new Date()
          })),
          worstCaseScenario: {
            estimatedLoss: worstLoss,
            probability: worstProbability,
            description: worstScenario
          }
        };

        await riskProfile.save();
      }

      return {
        success: true,
        results,
        worstCase: {
          estimatedLoss: worstLoss,
          probability: worstProbability,
          scenario: worstScenario
        }
      };

    } catch (error) {
      console.error('Stress test error:', error);
      return {
        success: false,
        error: 'Failed to run stress test'
      };
    }
  }

  /**
   * Real-time Monitoring
   */
  private startRealTimeMonitoring(): void {
    // Run risk monitoring every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.monitorAllUsers();
      } catch (error) {
        console.error('Risk monitoring error:', error);
      }
    }, 30000);
  }

  private async monitorAllUsers(): Promise<void> {
    try {
      const activeRiskProfiles = await RiskManagement.find({
        'currentRisk.riskLevel': { $in: ['HIGH', 'CRITICAL'] }
      });

      for (const profile of activeRiskProfiles) {
        const assessment = await this.assessRisk(profile.userId.toString());
        
        if (assessment.riskScore >= 90) {
          await this.triggerCircuitBreaker(
            profile.userId.toString(),
            'riskScore',
            `Critical risk score: ${assessment.riskScore}`
          );
        }
      }
    } catch (error) {
      console.error('Monitor all users error:', error);
    }
  }

  /**
   * Private Helper Methods
   */
  private async updateRiskMetrics(riskProfile: IRiskManagement): Promise<void> {
    try {
      // Get user's current positions and orders
      const [positions, orders, session] = await Promise.all([
        Position.find({ userId: riskProfile.userId }),
        Order.find({ userId: riskProfile.userId }),
        TradingSession.findOne({ userId: riskProfile.userId, status: 'ACTIVE' })
      ]);

      // Calculate current metrics
      const openPositions = positions.filter(p => p.status === 'OPEN');
      const totalPnL = positions.reduce((sum, p) => sum + p.totalPnL, 0);
      const unrealizedPnL = openPositions.reduce((sum, p) => sum + p.unrealizedPnL, 0);
      const realizedPnL = totalPnL - unrealizedPnL;

      // Update risk profile
      riskProfile.currentRisk = {
        ...riskProfile.currentRisk,
        openPositions: openPositions.length,
        totalPnL,
        unrealizedPnL,
        realizedPnL,
        dailyPnL: session ? session.stats.totalPnL : totalPnL,
        totalExposure: openPositions.reduce((sum, p) => sum + (p.quantity * p.averagePrice), 0)
      };

      riskProfile.updateRiskMetrics();
      await riskProfile.save();

    } catch (error) {
      console.error('Update risk metrics error:', error);
    }
  }

  private async createDefaultRiskProfile(userId: string): Promise<void> {
    try {
      const user = await User.findById(userId);
      if (!user) throw new Error('User not found');

      const riskProfile = new RiskManagement({
        userId: new Types.ObjectId(userId),
        riskProfile: {
          level: 'MODERATE',
          maxDailyLoss: user.maxDailyLoss || 500,
          maxPositionSize: user.maxPositionSize || 2,
          maxDrawdown: 1000,
          maxConsecutiveLosses: 3
        }
      });

      await riskProfile.save();
    } catch (error) {
      console.error('Create default risk profile error:', error);
    }
  }

  private generateRiskRecommendations(
    riskProfile: IRiskManagement,
    violations: any[]
  ): string[] {
    const recommendations: string[] = [];

    if (riskProfile.currentRisk.riskScore >= 80) {
      recommendations.push('Consider reducing position sizes');
      recommendations.push('Review stop loss levels');
    }

    if (riskProfile.currentRisk.consecutiveLosses >= 2) {
      recommendations.push('Take a trading break to reassess strategy');
    }

    if (violations.some(v => v.type === 'DAILY_LOSS_LIMIT')) {
      recommendations.push('Daily loss limit reached - trading suspended');
    }

    if (riskProfile.marginManagement.marginUtilization > 80) {
      recommendations.push('High margin utilization - consider closing positions');
    }

    return recommendations;
  }

  private async checkCorrelationRisk(userId: string, symbol: string): Promise<{
    allowed: boolean;
    reason?: string;
  }> {
    // Simplified correlation check
    // In production, this would analyze actual correlations between instruments
    
    try {
      const existingPositions = await Position.find({
        userId,
        status: 'OPEN'
      });

      const sameSymbolPositions = existingPositions.filter(p => p.symbol === symbol);
      
      if (sameSymbolPositions.length >= 3) {
        return {
          allowed: false,
          reason: 'Too many positions in same instrument'
        };
      }

      return { allowed: true };

    } catch (error) {
      return {
        allowed: false,
        reason: 'Correlation check failed'
      };
    }
  }

  private calculateRiskAdjustment(riskScore: number): number {
    if (riskScore >= 90) return 0.2;
    if (riskScore >= 80) return 0.4;
    if (riskScore >= 70) return 0.6;
    if (riskScore >= 60) return 0.8;
    return 1.0;
  }

  private canResetCircuitBreaker(breaker: any, type: string): boolean {
    if (!breaker.triggered) return false;
    
    const cooldownPeriod = this.getCircuitBreakerCooldown(type);
    const timeSinceTriggered = Date.now() - breaker.triggerTime?.getTime();
    
    return timeSinceTriggered > cooldownPeriod;
  }

  private getCircuitBreakerCooldown(type: string): number {
    const cooldowns = {
      dailyLossBreaker: 4 * 60 * 60 * 1000, // 4 hours
      drawdownBreaker: 2 * 60 * 60 * 1000,  // 2 hours
      velocityBreaker: 1 * 60 * 60 * 1000,  // 1 hour
      consecutiveLossBreaker: 30 * 60 * 1000 // 30 minutes
    };

    return cooldowns[type as keyof typeof cooldowns] || 60 * 60 * 1000;
  }

  private getCircuitBreakerReason(type: string): string {
    const reasons = {
      dailyLossBreaker: 'Daily loss limit exceeded',
      drawdownBreaker: 'Maximum drawdown exceeded',
      velocityBreaker: 'Loss velocity too high',
      consecutiveLossBreaker: 'Too many consecutive losses'
    };

    return reasons[type as keyof typeof reasons] || 'Circuit breaker triggered';
  }

  private async emergencyCloseAllPositions(userId: string, reason: string): Promise<void> {
    try {
      const openPositions = await Position.find({
        userId,
        status: { $in: ['OPEN', 'PARTIALLY_CLOSED'] }
      });

      for (const position of openPositions) {
        position.closePosition(position.currentPrice || position.averagePrice);
        position.addEvent('EMERGENCY_STOP', reason);
        await position.save();
      }
    } catch (error) {
      console.error('Emergency close positions error:', error);
    }
  }

  /**
   * Cleanup
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
}

// Export singleton instance
export const riskService = RiskService.getInstance();
export default riskService;