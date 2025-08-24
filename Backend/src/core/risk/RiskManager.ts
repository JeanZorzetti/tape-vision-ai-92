/**
 * Risk Management System - Advanced Risk Controls
 * Implements comprehensive risk management for algorithmic trading
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  RiskParameters,
  Position,
  MarketData,
  RiskError
} from '../../types/trading';

interface RiskMetrics {
  dailyPnL: number;
  maxDrawdown: number;
  consecutiveStops: number;
  currentDrawdown: number;
  peakBalance: number;
  totalTrades: number;
  winningTrades: number;
  avgWinSize: number;
  avgLossSize: number;
  largestWin: number;
  largestLoss: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  maxConsecutiveLosses: number;
  currentConsecutiveLosses: number;
}

interface RiskAlert {
  type: 'warning' | 'critical';
  category: 'position_size' | 'daily_loss' | 'drawdown' | 'consecutive_stops' | 'volatility' | 'liquidity';
  message: string;
  severity: number; // 1-10
  action: 'monitor' | 'reduce_size' | 'stop_trading' | 'emergency_stop';
  timestamp: number;
}

interface VolatilityMetrics {
  current: number;
  average: number;
  stdDev: number;
  percentile95: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export class RiskManager extends EventEmitter {
  private logger: Logger;
  private parameters: RiskParameters;
  
  // Risk state
  private riskMetrics: RiskMetrics;
  private volatilityHistory: number[] = [];
  private priceHistory: number[] = [];
  private volumeHistory: number[] = [];
  
  // Risk controls
  private tradingAllowed: boolean = true;
  private emergencyStopTriggered: boolean = false;
  private positionSizeMultiplier: number = 1.0;
  
  // Risk monitoring
  private lastRiskCheck: number = 0;
  private riskAlerts: RiskAlert[] = [];
  private sessionStartBalance: number = 0;
  private sessionPeakBalance: number = 0;
  
  // Circuit breaker states
  private circuitBreakerActive: boolean = false;
  private circuitBreakerResetTime: number = 0;
  
  // Constants
  private readonly MAX_POSITION_SIZE_REDUCTION = 0.1; // 10% of original
  private readonly VOLATILITY_SPIKE_THRESHOLD = 2.0; // 2x average
  private readonly LIQUIDITY_SPIKE_THRESHOLD = 0.5; // 50% reduction
  private readonly CIRCUIT_BREAKER_DURATION = 300000; // 5 minutes
  private readonly RISK_CHECK_INTERVAL = 1000; // 1 second

  constructor(parameters: RiskParameters, logger: Logger) {
    super();
    
    this.parameters = parameters;
    this.logger = logger.child({ component: 'RiskManager' });
    
    this.initializeRiskMetrics();
    
    this.logger.info('Risk Manager initialized', {
      maxDailyLoss: parameters.maxDailyLoss,
      maxPositionSize: parameters.maxPositionSize,
      stopLossPoints: parameters.stopLossPoints,
      minimumConfidence: parameters.minimumConfidence
    });
  }

  public async initialize(): Promise<void> {
    try {
      this.sessionStartBalance = 0; // This would come from account balance
      this.sessionPeakBalance = 0;
      this.lastRiskCheck = Date.now();
      
      // Start risk monitoring
      this.startRiskMonitoring();
      
      this.logger.info('Risk Manager initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Risk Manager', error);
      throw error;
    }
  }

  private initializeRiskMetrics(): void {
    this.riskMetrics = {
      dailyPnL: 0,
      maxDrawdown: 0,
      consecutiveStops: 0,
      currentDrawdown: 0,
      peakBalance: 0,
      totalTrades: 0,
      winningTrades: 0,
      avgWinSize: 0,
      avgLossSize: 0,
      largestWin: 0,
      largestLoss: 0,
      winRate: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxConsecutiveLosses: 0,
      currentConsecutiveLosses: 0
    };
  }

  private startRiskMonitoring(): void {
    setInterval(() => {
      this.performRiskCheck();
    }, this.RISK_CHECK_INTERVAL);
  }

  /**
   * Primary risk check - called for every market update
   */
  public async checkRisk(
    marketData: MarketData,
    currentPosition: Position | null,
    dailyPnL: number
  ): Promise<void> {
    try {
      this.lastRiskCheck = Date.now();
      this.riskMetrics.dailyPnL = dailyPnL;
      
      // Update market data history
      this.updateMarketHistory(marketData);
      
      // Check daily loss limit
      await this.checkDailyLossLimit(dailyPnL);
      
      // Check position size
      if (currentPosition) {
        await this.checkPositionSize(currentPosition, marketData);
        await this.checkStopLoss(currentPosition, marketData);
      }
      
      // Check volatility
      await this.checkVolatility(marketData);
      
      // Check liquidity
      await this.checkLiquidity(marketData);
      
      // Check drawdown
      await this.checkDrawdown(dailyPnL);
      
      // Check consecutive losses
      await this.checkConsecutiveLosses();
      
      // Update circuit breaker
      this.updateCircuitBreaker();
      
    } catch (error) {
      this.logger.error('Error during risk check', error);
      this.triggerAlert({
        type: 'critical',
        category: 'position_size',
        message: `Risk check failed: ${error instanceof Error ? error.message : String(error)}`,
        severity: 10,
        action: 'monitor',
        timestamp: Date.now()
      });
    }
  }

  private updateMarketHistory(marketData: MarketData): void {
    // Update volatility history
    this.volatilityHistory.push(marketData.volatility);
    if (this.volatilityHistory.length > 100) {
      this.volatilityHistory = this.volatilityHistory.slice(-100);
    }
    
    // Update price history
    this.priceHistory.push(marketData.price);
    if (this.priceHistory.length > 100) {
      this.priceHistory = this.priceHistory.slice(-100);
    }
    
    // Update volume history
    this.volumeHistory.push(marketData.volume);
    if (this.volumeHistory.length > 100) {
      this.volumeHistory = this.volumeHistory.slice(-100);
    }
  }

  private async checkDailyLossLimit(dailyPnL: number): Promise<void> {
    const lossThreshold = -this.parameters.maxDailyLoss;
    
    if (dailyPnL <= lossThreshold) {
      this.tradingAllowed = false;
      
      this.triggerAlert({
        type: 'critical',
        category: 'daily_loss',
        message: `Daily loss limit reached: ${dailyPnL.toFixed(2)} (limit: ${lossThreshold})`,
        severity: 10,
        action: 'stop_trading',
        timestamp: Date.now()
      });
      
      throw new RiskError('Daily loss limit exceeded', {
        dailyPnL,
        limit: lossThreshold
      });
    }
    
    // Warning at 80% of limit
    if (dailyPnL <= lossThreshold * 0.8) {
      this.triggerAlert({
        type: 'warning',
        category: 'daily_loss',
        message: `Approaching daily loss limit: ${dailyPnL.toFixed(2)} (80% of limit)`,
        severity: 7,
        action: 'reduce_size',
        timestamp: Date.now()
      });
      
      this.positionSizeMultiplier = Math.max(0.5, this.positionSizeMultiplier * 0.8);
    }
  }

  private async checkPositionSize(position: Position, marketData: MarketData): Promise<void> {
    if (position.size > this.parameters.maxPositionSize) {
      this.triggerAlert({
        type: 'critical',
        category: 'position_size',
        message: `Position size exceeds limit: ${position.size} > ${this.parameters.maxPositionSize}`,
        severity: 9,
        action: 'emergency_stop',
        timestamp: Date.now()
      });
      
      throw new RiskError('Position size limit exceeded', {
        currentSize: position.size,
        maxSize: this.parameters.maxPositionSize
      });
    }
    
    // Check position value relative to account
    const positionValue = position.size * marketData.price;
    const maxPositionValue = this.parameters.maxPositionSize * marketData.price;
    
    if (positionValue > maxPositionValue * 1.1) { // 10% buffer
      this.triggerAlert({
        type: 'warning',
        category: 'position_size',
        message: `Position value approaching limit: $${positionValue.toFixed(2)}`,
        severity: 6,
        action: 'monitor',
        timestamp: Date.now()
      });
    }
  }

  private async checkStopLoss(position: Position, marketData: MarketData): Promise<void> {
    const currentPrice = marketData.price;
    const unrealizedPnL = this.calculateUnrealizedPnL(position, currentPrice);
    
    // Dynamic stop loss adjustment based on volatility
    const volatilityAdjustment = this.calculateVolatilityAdjustment();
    const adjustedStopLoss = this.parameters.stopLossPoints * volatilityAdjustment;
    
    if (Math.abs(unrealizedPnL) > adjustedStopLoss) {
      this.triggerAlert({
        type: 'critical',
        category: 'position_size',
        message: `Stop loss triggered: ${unrealizedPnL.toFixed(2)} points`,
        severity: 8,
        action: 'emergency_stop',
        timestamp: Date.now()
      });
      
      this.emit('stop-loss-triggered', {
        position,
        unrealizedPnL,
        stopLoss: adjustedStopLoss
      });
    }
  }

  private calculateUnrealizedPnL(position: Position, currentPrice: number): number {
    const priceDiff = currentPrice - position.entryPrice;
    const multiplier = position.side === 'long' ? 1 : -1;
    return priceDiff * multiplier * position.size;
  }

  private calculateVolatilityAdjustment(): number {
    if (this.volatilityHistory.length < 10) return 1.0;
    
    const currentVol = this.volatilityHistory[this.volatilityHistory.length - 1];
    const avgVol = this.volatilityHistory.reduce((sum, vol) => sum + vol, 0) / this.volatilityHistory.length;
    
    // Increase stop loss in high volatility
    return Math.max(0.5, Math.min(2.0, currentVol / avgVol));
  }

  private async checkVolatility(marketData: MarketData): Promise<void> {
    const volatilityMetrics = this.calculateVolatilityMetrics();
    
    if (volatilityMetrics.current > volatilityMetrics.percentile95) {
      this.triggerAlert({
        type: 'warning',
        category: 'volatility',
        message: `High volatility detected: ${volatilityMetrics.current.toFixed(2)} (95th percentile: ${volatilityMetrics.percentile95.toFixed(2)})`,
        severity: 6,
        action: 'reduce_size',
        timestamp: Date.now()
      });
      
      this.positionSizeMultiplier = Math.max(0.3, this.positionSizeMultiplier * 0.7);
    }
    
    // Extreme volatility check
    if (volatilityMetrics.current > volatilityMetrics.average * this.VOLATILITY_SPIKE_THRESHOLD) {
      this.triggerAlert({
        type: 'critical',
        category: 'volatility',
        message: `Extreme volatility spike: ${volatilityMetrics.current.toFixed(2)}x average`,
        severity: 9,
        action: 'stop_trading',
        timestamp: Date.now()
      });
      
      this.activateCircuitBreaker('High volatility');
    }
  }

  private calculateVolatilityMetrics(): VolatilityMetrics {
    if (this.volatilityHistory.length < 10) {
      return {
        current: 0,
        average: 0,
        stdDev: 0,
        percentile95: 0,
        trend: 'stable'
      };
    }
    
    const current = this.volatilityHistory[this.volatilityHistory.length - 1];
    const average = this.volatilityHistory.reduce((sum, vol) => sum + vol, 0) / this.volatilityHistory.length;
    
    // Calculate standard deviation
    const variance = this.volatilityHistory.reduce((sum, vol) => sum + Math.pow(vol - average, 2), 0) / this.volatilityHistory.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate 95th percentile
    const sorted = [...this.volatilityHistory].sort((a, b) => a - b);
    const percentile95 = sorted[Math.floor(sorted.length * 0.95)];
    
    // Determine trend
    const recent = this.volatilityHistory.slice(-5);
    const older = this.volatilityHistory.slice(-10, -5);
    const recentAvg = recent.reduce((sum, vol) => sum + vol, 0) / recent.length;
    const olderAvg = older.reduce((sum, vol) => sum + vol, 0) / older.length;
    
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const change = recentAvg / olderAvg;
    if (change > 1.1) trend = 'increasing';
    else if (change < 0.9) trend = 'decreasing';
    
    return {
      current,
      average,
      stdDev,
      percentile95,
      trend
    };
  }

  private async checkLiquidity(marketData: MarketData): Promise<void> {
    // Check for liquidity spikes (low liquidity)
    if (marketData.liquidityLevel === 'low' && marketData.volume < this.getAverageVolume() * this.LIQUIDITY_SPIKE_THRESHOLD) {
      this.triggerAlert({
        type: 'warning',
        category: 'liquidity',
        message: `Low liquidity detected: ${marketData.volume} (avg: ${this.getAverageVolume().toFixed(0)})`,
        severity: 5,
        action: 'reduce_size',
        timestamp: Date.now()
      });
      
      this.positionSizeMultiplier = Math.max(0.2, this.positionSizeMultiplier * 0.6);
    }
  }

  private getAverageVolume(): number {
    if (this.volumeHistory.length === 0) return 1000;
    return this.volumeHistory.reduce((sum, vol) => sum + vol, 0) / this.volumeHistory.length;
  }

  private async checkDrawdown(dailyPnL: number): Promise<void> {
    // Update peak balance
    if (dailyPnL > this.sessionPeakBalance) {
      this.sessionPeakBalance = dailyPnL;
    }
    
    // Calculate current drawdown
    const currentDrawdown = this.sessionPeakBalance - dailyPnL;
    this.riskMetrics.currentDrawdown = currentDrawdown;
    
    // Update max drawdown
    if (currentDrawdown > this.riskMetrics.maxDrawdown) {
      this.riskMetrics.maxDrawdown = currentDrawdown;
    }
    
    // Check drawdown limit
    if (currentDrawdown > this.parameters.maxDrawdown) {
      this.triggerAlert({
        type: 'critical',
        category: 'drawdown',
        message: `Maximum drawdown exceeded: ${currentDrawdown.toFixed(2)} (limit: ${this.parameters.maxDrawdown})`,
        severity: 10,
        action: 'stop_trading',
        timestamp: Date.now()
      });
      
      throw new RiskError('Maximum drawdown exceeded', {
        currentDrawdown,
        maxDrawdown: this.parameters.maxDrawdown
      });
    }
    
    // Warning at 80% of drawdown limit
    if (currentDrawdown > this.parameters.maxDrawdown * 0.8) {
      this.triggerAlert({
        type: 'warning',
        category: 'drawdown',
        message: `Approaching maximum drawdown: ${currentDrawdown.toFixed(2)} (80% of limit)`,
        severity: 7,
        action: 'reduce_size',
        timestamp: Date.now()
      });
    }
  }

  private async checkConsecutiveLosses(): Promise<void> {
    if (this.riskMetrics.consecutiveStops >= this.parameters.consecutiveStopLimit) {
      this.tradingAllowed = false;
      
      this.triggerAlert({
        type: 'critical',
        category: 'consecutive_stops',
        message: `Consecutive stop limit reached: ${this.riskMetrics.consecutiveStops}`,
        severity: 9,
        action: 'stop_trading',
        timestamp: Date.now()
      });
      
      throw new RiskError('Consecutive stop limit exceeded', {
        consecutiveStops: this.riskMetrics.consecutiveStops,
        limit: this.parameters.consecutiveStopLimit
      });
    }
  }

  private activateCircuitBreaker(reason: string): void {
    this.circuitBreakerActive = true;
    this.circuitBreakerResetTime = Date.now() + this.CIRCUIT_BREAKER_DURATION;
    this.tradingAllowed = false;
    
    this.logger.warn('Circuit breaker activated', { reason, duration: this.CIRCUIT_BREAKER_DURATION });
    
    this.emit('circuit-breaker-activated', { reason, resetTime: this.circuitBreakerResetTime });
  }

  private updateCircuitBreaker(): void {
    if (this.circuitBreakerActive && Date.now() > this.circuitBreakerResetTime) {
      this.circuitBreakerActive = false;
      this.tradingAllowed = true;
      
      this.logger.info('Circuit breaker reset');
      this.emit('circuit-breaker-reset');
    }
  }

  private performRiskCheck(): void {
    // Regular risk monitoring
    const timeSinceLastCheck = Date.now() - this.lastRiskCheck;
    
    if (timeSinceLastCheck > 30000) { // 30 seconds
      this.triggerAlert({
        type: 'warning',
        category: 'position_size',
        message: `Risk check stale: ${Math.round(timeSinceLastCheck / 1000)}s since last update`,
        severity: 4,
        action: 'monitor',
        timestamp: Date.now()
      });
    }
    
    // Clean old alerts
    this.riskAlerts = this.riskAlerts.filter(alert => 
      Date.now() - alert.timestamp < 3600000 // Keep alerts for 1 hour
    );
  }

  private triggerAlert(alert: RiskAlert): void {
    this.riskAlerts.push(alert);
    
    this.logger.warn('Risk alert triggered', alert);
    this.emit('risk-alert', alert);
    
    // Auto-execute critical actions
    if (alert.action === 'emergency_stop') {
      this.emergencyStopTriggered = true;
      this.tradingAllowed = false;
    } else if (alert.action === 'stop_trading') {
      this.tradingAllowed = false;
    }
  }

  /**
   * Calculate position size based on risk parameters
   */
  public async calculatePositionSize(entryPrice: number, stopLoss: number): Promise<number> {
    if (!this.tradingAllowed) {
      throw new RiskError('Trading not allowed by risk manager');
    }
    
    // Calculate risk per unit
    const riskPerUnit = Math.abs(entryPrice - stopLoss);
    
    if (riskPerUnit === 0) {
      throw new RiskError('Invalid stop loss - no risk defined');
    }
    
    // Calculate base position size (1% of account per trade)
    const accountRisk = this.parameters.maxDailyLoss * 0.01; // 1% of daily limit
    const baseSize = Math.floor(accountRisk / riskPerUnit);
    
    // Apply risk multipliers
    let adjustedSize = baseSize * this.positionSizeMultiplier;
    
    // Apply maximum position size limit
    adjustedSize = Math.min(adjustedSize, this.parameters.maxPositionSize);
    
    // Minimum position size
    adjustedSize = Math.max(1, Math.floor(adjustedSize));
    
    this.logger.debug('Position size calculated', {
      entryPrice,
      stopLoss,
      riskPerUnit,
      baseSize,
      adjustedSize,
      sizeMultiplier: this.positionSizeMultiplier
    });
    
    return adjustedSize;
  }

  /**
   * Update trade outcome for risk metrics
   */
  public updateTradeOutcome(pnl: number, wasStop: boolean): void {
    this.riskMetrics.totalTrades++;
    
    if (pnl > 0) {
      this.riskMetrics.winningTrades++;
      this.riskMetrics.currentConsecutiveLosses = 0;
      this.riskMetrics.largestWin = Math.max(this.riskMetrics.largestWin, pnl);
      
      // Update average win
      this.riskMetrics.avgWinSize = 
        (this.riskMetrics.avgWinSize * (this.riskMetrics.winningTrades - 1) + pnl) / 
        this.riskMetrics.winningTrades;
    } else {
      this.riskMetrics.currentConsecutiveLosses++;
      this.riskMetrics.maxConsecutiveLosses = Math.max(
        this.riskMetrics.maxConsecutiveLosses, 
        this.riskMetrics.currentConsecutiveLosses
      );
      
      if (wasStop) {
        this.riskMetrics.consecutiveStops++;
      }
      
      this.riskMetrics.largestLoss = Math.min(this.riskMetrics.largestLoss, pnl);
      
      // Update average loss
      const totalLosses = this.riskMetrics.totalTrades - this.riskMetrics.winningTrades;
      this.riskMetrics.avgLossSize = 
        (this.riskMetrics.avgLossSize * (totalLosses - 1) + Math.abs(pnl)) / totalLosses;
    }
    
    // Reset consecutive stops on winning trade
    if (pnl > 0) {
      this.riskMetrics.consecutiveStops = 0;
    }
    
    // Update derived metrics
    this.riskMetrics.winRate = (this.riskMetrics.winningTrades / this.riskMetrics.totalTrades) * 100;
    
    if (this.riskMetrics.avgLossSize > 0) {
      this.riskMetrics.profitFactor = this.riskMetrics.avgWinSize / this.riskMetrics.avgLossSize;
    }
  }

  // Getters
  public isTradingAllowed(): boolean {
    return this.tradingAllowed && !this.emergencyStopTriggered && !this.circuitBreakerActive;
  }

  public getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  public getRecentAlerts(minutes: number = 60): RiskAlert[] {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.riskAlerts.filter(alert => alert.timestamp > cutoff);
  }

  public getPositionSizeMultiplier(): number {
    return this.positionSizeMultiplier;
  }

  public resetDailyMetrics(): void {
    this.riskMetrics.dailyPnL = 0;
    this.riskMetrics.consecutiveStops = 0;
    this.riskMetrics.currentDrawdown = 0;
    this.sessionStartBalance = 0;
    this.sessionPeakBalance = 0;
    this.positionSizeMultiplier = 1.0;
    this.tradingAllowed = true;
    this.emergencyStopTriggered = false;
    
    this.logger.info('Daily risk metrics reset');
  }

  public emergencyStop(): void {
    this.emergencyStopTriggered = true;
    this.tradingAllowed = false;
    
    this.triggerAlert({
      type: 'critical',
      category: 'position_size',
      message: 'Manual emergency stop triggered',
      severity: 10,
      action: 'emergency_stop',
      timestamp: Date.now()
    });
  }
}