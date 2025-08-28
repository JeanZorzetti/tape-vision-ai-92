/**
 * Advanced Performance Analysis System
 * 
 * This critical component provides comprehensive real-time performance analysis
 * for trading strategies, patterns, and overall system performance. It implements
 * sophisticated metrics calculation, risk analysis, and performance attribution.
 * 
 * Key Features:
 * - Real-time performance monitoring and metrics calculation
 * - Risk-adjusted performance measures (Sharpe, Sortino, Calmar ratios)
 * - Detailed performance attribution by strategy, pattern, and timeframe
 * - Advanced statistical analysis and confidence intervals
 * - Performance benchmarking and comparison
 * - Automated performance alerts and notifications
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  MarketData,
  Position,
  Trade,
  TradingError,
  DecisionAnalysis
} from '../../types/trading';
import { Logger } from '../../utils/Logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';

export interface PerformanceMetrics {
  // Core Performance
  totalReturn: number;
  totalReturnPct: number;
  avgReturn: number;
  avgReturnPct: number;
  bestTrade: number;
  worstTrade: number;
  
  // Win/Loss Statistics
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  lossRate: number;
  avgWinningTrade: number;
  avgLosingTrade: number;
  
  // Risk Metrics
  maxDrawdown: number;
  maxDrawdownPct: number;
  currentDrawdown: number;
  volatility: number;
  downSideVolatility: number;
  
  // Risk-Adjusted Returns
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;
  treynorRatio: number;
  
  // Advanced Metrics
  profitFactor: number;
  payoffRatio: number;
  expectedValue: number;
  kelly: number;
  var95: number; // Value at Risk 95%
  var99: number; // Value at Risk 99%
  cvar95: number; // Conditional VaR 95%
  
  // Time-based Analysis
  avgTradeDuration: number;
  avgTimeInMarket: number;
  totalTimeInMarket: number;
  
  // Consistency Metrics
  monthlyReturns: number[];
  consecutiveWins: number;
  consecutiveLosses: number;
  largestWinStreak: number;
  largestLossStreak: number;
  
  // Timestamps
  firstTrade: Date;
  lastTrade: Date;
  analysisTimestamp: Date;
}

export interface PerformanceAttribution {
  byStrategy: Map<string, PerformanceMetrics>;
  byPattern: Map<string, PerformanceMetrics>;
  byTimeOfDay: Map<number, PerformanceMetrics>;
  byDayOfWeek: Map<number, PerformanceMetrics>;
  byMarketCondition: Map<string, PerformanceMetrics>;
  byVolatilityRegime: Map<string, PerformanceMetrics>;
}

export interface RealTimeStats {
  currentPnL: number;
  currentPnLPct: number;
  todayPnL: number;
  todayPnLPct: number;
  thisWeekPnL: number;
  thisMonthPnL: number;
  currentPositions: number;
  currentExposure: number;
  currentRisk: number;
  lastUpdate: Date;
}

export interface PerformanceAlert {
  type: 'drawdown' | 'risk' | 'performance' | 'streak';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
}

export interface BenchmarkComparison {
  benchmarkName: string;
  strategyReturn: number;
  benchmarkReturn: number;
  alpha: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  correlation: number;
}

export interface PerformanceConfig {
  riskFreeRate: number;
  confidenceLevel: number;
  benchmarkSymbol?: string;
  alertThresholds: {
    maxDrawdown: number;
    dailyLoss: number;
    consecutiveLosses: number;
    var95Breach: number;
  };
  windowSizes: {
    volatility: number;
    correlation: number;
    performance: number;
  };
}

export class PerformanceAnalyzer extends EventEmitter {
  private trades: Trade[] = [];
  private positions: Position[] = [];
  private dailyReturns: number[] = [];
  private performanceHistory: Map<Date, PerformanceMetrics> = new Map();
  private realTimeStats: RealTimeStats;
  private currentMetrics: PerformanceMetrics;
  private performanceAttribution: PerformanceAttribution;
  private alerts: PerformanceAlert[] = [];
  private config: PerformanceConfig;

  // Rolling windows for calculations
  private returnsWindow: number[] = [];
  private drawdownWindow: number[] = [];
  private volatilityWindow: number[] = [];
  
  // Benchmark data
  private benchmarkReturns: number[] = [];
  private benchmarkPrices: number[] = [];

  constructor(
    private logger: Logger,
    private metricsCollector: MetricsCollector,
    config?: Partial<PerformanceConfig>
  ) {
    super();
    
    this.config = {
      riskFreeRate: 0.02, // 2% annual risk-free rate
      confidenceLevel: 0.95,
      alertThresholds: {
        maxDrawdown: 0.05, // 5% max drawdown alert
        dailyLoss: 0.02, // 2% daily loss alert
        consecutiveLosses: 5,
        var95Breach: 0.03
      },
      windowSizes: {
        volatility: 252, // 1 year of trading days
        correlation: 60, // 60 days for correlation
        performance: 30  // 30 days for performance windows
      },
      ...config
    };

    this.initializeAnalyzer();
  }

  /**
   * Initialize the performance analyzer
   */
  private initializeAnalyzer(): void {
    this.realTimeStats = {
      currentPnL: 0,
      currentPnLPct: 0,
      todayPnL: 0,
      todayPnLPct: 0,
      thisWeekPnL: 0,
      thisMonthPnL: 0,
      currentPositions: 0,
      currentExposure: 0,
      currentRisk: 0,
      lastUpdate: new Date()
    };

    this.currentMetrics = this.createEmptyMetrics();
    
    this.performanceAttribution = {
      byStrategy: new Map(),
      byPattern: new Map(),
      byTimeOfDay: new Map(),
      byDayOfWeek: new Map(),
      byMarketCondition: new Map(),
      byVolatilityRegime: new Map()
    };

    this.logger.info('PerformanceAnalyzer initialized successfully', {
      config: this.config
    });

    // Start real-time monitoring
    this.startRealTimeMonitoring();
  }

  /**
   * Add a completed trade for analysis
   */
  public addTrade(trade: Trade): void {
    const startTime = performance.now();

    try {
      this.trades.push(trade);
      
      // Update real-time statistics
      this.updateRealTimeStats(trade);
      
      // Recalculate performance metrics
      this.calculatePerformanceMetrics();
      
      // Update performance attribution
      this.updatePerformanceAttribution(trade);
      
      // Check for alerts
      this.checkPerformanceAlerts(trade);
      
      const analysisTime = performance.now() - startTime;
      this.metricsCollector.recordMetric('performance_analysis_time', analysisTime);

      this.logger.debug('Trade added to performance analysis', {
        tradeId: trade.id,
        pnl: trade.realizedPnL,
        totalTrades: this.trades.length,
        analysisTime
      });

      this.emit('trade_analyzed', {
        trade,
        metrics: this.currentMetrics,
        realTimeStats: this.realTimeStats
      });

    } catch (error) {
      this.logger.error('Failed to add trade to performance analysis', error);
      throw new TradingError('Performance analysis failed', 'PERFORMANCE_ANALYSIS_ERROR', error);
    }
  }

  /**
   * Update current position for real-time monitoring
   */
  public updatePosition(position: Position): void {
    const existingIndex = this.positions.findIndex(p => p.symbol === position.symbol);
    
    if (existingIndex >= 0) {
      this.positions[existingIndex] = position;
    } else {
      this.positions.push(position);
    }

    // Update real-time exposure and risk
    this.updateRealTimeExposure();
    
    this.emit('position_updated', {
      position,
      totalPositions: this.positions.length,
      totalExposure: this.realTimeStats.currentExposure
    });
  }

  /**
   * Calculate comprehensive performance metrics
   */
  private calculatePerformanceMetrics(): void {
    if (this.trades.length === 0) {
      this.currentMetrics = this.createEmptyMetrics();
      return;
    }

    const returns = this.trades.map(trade => trade.realizedPnL || 0);
    const returnsPercent = this.trades.map(trade => trade.returnPercent || 0);
    
    // Core Performance
    this.currentMetrics.totalReturn = returns.reduce((sum, ret) => sum + ret, 0);
    this.currentMetrics.totalReturnPct = returnsPercent.reduce((sum, ret) => sum + ret, 0);
    this.currentMetrics.avgReturn = this.currentMetrics.totalReturn / this.trades.length;
    this.currentMetrics.avgReturnPct = this.currentMetrics.totalReturnPct / this.trades.length;
    this.currentMetrics.bestTrade = Math.max(...returns);
    this.currentMetrics.worstTrade = Math.min(...returns);
    
    // Win/Loss Statistics
    const winningTrades = returns.filter(ret => ret > 0);
    const losingTrades = returns.filter(ret => ret < 0);
    
    this.currentMetrics.totalTrades = this.trades.length;
    this.currentMetrics.winningTrades = winningTrades.length;
    this.currentMetrics.losingTrades = losingTrades.length;
    this.currentMetrics.winRate = winningTrades.length / this.trades.length;
    this.currentMetrics.lossRate = losingTrades.length / this.trades.length;
    this.currentMetrics.avgWinningTrade = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, ret) => sum + ret, 0) / winningTrades.length : 0;
    this.currentMetrics.avgLosingTrade = losingTrades.length > 0 ? 
      losingTrades.reduce((sum, ret) => sum + ret, 0) / losingTrades.length : 0;
    
    // Risk Metrics
    this.currentMetrics.maxDrawdown = this.calculateMaxDrawdown(returns);
    this.currentMetrics.maxDrawdownPct = this.calculateMaxDrawdownPercent(returnsPercent);
    this.currentMetrics.currentDrawdown = this.calculateCurrentDrawdown(returns);
    this.currentMetrics.volatility = this.calculateVolatility(returns);
    this.currentMetrics.downSideVolatility = this.calculateDownsideVolatility(returns);
    
    // Risk-Adjusted Returns
    this.currentMetrics.sharpeRatio = this.calculateSharpeRatio(returns);
    this.currentMetrics.sortinoRatio = this.calculateSortinoRatio(returns);
    this.currentMetrics.calmarRatio = this.calculateCalmarRatio();
    
    // Advanced Metrics
    this.currentMetrics.profitFactor = this.calculateProfitFactor(winningTrades, losingTrades);
    this.currentMetrics.payoffRatio = this.calculatePayoffRatio();
    this.currentMetrics.expectedValue = this.currentMetrics.avgReturn;
    this.currentMetrics.kelly = this.calculateKellyPercentage();
    this.currentMetrics.var95 = this.calculateVaR(returns, 0.95);
    this.currentMetrics.var99 = this.calculateVaR(returns, 0.99);
    this.currentMetrics.cvar95 = this.calculateConditionalVaR(returns, 0.95);
    
    // Time-based Analysis
    this.currentMetrics.avgTradeDuration = this.calculateAverageTradeDuration();
    this.currentMetrics.avgTimeInMarket = this.calculateAverageTimeInMarket();
    this.currentMetrics.totalTimeInMarket = this.calculateTotalTimeInMarket();
    
    // Consistency Metrics
    this.currentMetrics.monthlyReturns = this.calculateMonthlyReturns();
    const streaks = this.calculateStreaks(returns);
    this.currentMetrics.consecutiveWins = streaks.currentWinStreak;
    this.currentMetrics.consecutiveLosses = streaks.currentLossStreak;
    this.currentMetrics.largestWinStreak = streaks.maxWinStreak;
    this.currentMetrics.largestLossStreak = streaks.maxLossStreak;
    
    // Timestamps
    this.currentMetrics.firstTrade = new Date(Math.min(...this.trades.map(t => t.openTime)));
    this.currentMetrics.lastTrade = new Date(Math.max(...this.trades.map(t => t.closeTime || t.openTime)));
    this.currentMetrics.analysisTimestamp = new Date();

    // Record key metrics
    this.metricsCollector.recordMetric('total_return', this.currentMetrics.totalReturn);
    this.metricsCollector.recordMetric('win_rate', this.currentMetrics.winRate);
    this.metricsCollector.recordMetric('sharpe_ratio', this.currentMetrics.sharpeRatio);
    this.metricsCollector.recordMetric('max_drawdown', this.currentMetrics.maxDrawdown);
  }

  /**
   * Update real-time statistics
   */
  private updateRealTimeStats(trade: Trade): void {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today.getTime() - (today.getDay() * 24 * 60 * 60 * 1000));
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Update current P&L
    this.realTimeStats.currentPnL += trade.realizedPnL || 0;
    this.realTimeStats.currentPnLPct += trade.returnPercent || 0;

    // Update today's P&L
    if (trade.closeTime && trade.closeTime >= today.getTime()) {
      this.realTimeStats.todayPnL += trade.realizedPnL || 0;
      this.realTimeStats.todayPnLPct += trade.returnPercent || 0;
    }

    // Update this week's P&L
    if (trade.closeTime && trade.closeTime >= thisWeekStart.getTime()) {
      this.realTimeStats.thisWeekPnL += trade.realizedPnL || 0;
    }

    // Update this month's P&L
    if (trade.closeTime && trade.closeTime >= thisMonthStart.getTime()) {
      this.realTimeStats.thisMonthPnL += trade.realizedPnL || 0;
    }

    this.realTimeStats.lastUpdate = now;
  }

  /**
   * Update real-time exposure calculation
   */
  private updateRealTimeExposure(): void {
    this.realTimeStats.currentPositions = this.positions.length;
    
    this.realTimeStats.currentExposure = this.positions.reduce((total, position) => {
      return total + Math.abs(position.quantity * position.currentPrice);
    }, 0);

    this.realTimeStats.currentRisk = this.positions.reduce((total, position) => {
      const positionValue = Math.abs(position.quantity * position.currentPrice);
      const riskPercent = 0.02; // Assume 2% risk per position
      return total + (positionValue * riskPercent);
    }, 0);
  }

  /**
   * Update performance attribution
   */
  private updatePerformanceAttribution(trade: Trade): void {
    // By Strategy
    if (trade.strategy) {
      this.updateAttributionMap(this.performanceAttribution.byStrategy, trade.strategy, trade);
    }

    // By Pattern
    if (trade.pattern) {
      this.updateAttributionMap(this.performanceAttribution.byPattern, trade.pattern, trade);
    }

    // By Time of Day
    const hour = new Date(trade.openTime).getHours();
    this.updateAttributionMap(this.performanceAttribution.byTimeOfDay, hour.toString(), trade);

    // By Day of Week
    const dayOfWeek = new Date(trade.openTime).getDay();
    this.updateAttributionMap(this.performanceAttribution.byDayOfWeek, dayOfWeek.toString(), trade);

    // By Market Condition
    if (trade.marketCondition) {
      this.updateAttributionMap(this.performanceAttribution.byMarketCondition, trade.marketCondition, trade);
    }

    // By Volatility Regime
    const volatilityRegime = this.classifyVolatilityRegime(trade.entryVolatility);
    this.updateAttributionMap(this.performanceAttribution.byVolatilityRegime, volatilityRegime, trade);
  }

  /**
   * Update attribution map with trade data
   */
  private updateAttributionMap(attributionMap: Map<string, PerformanceMetrics>, key: string, trade: Trade): void {
    if (!attributionMap.has(key)) {
      attributionMap.set(key, this.createEmptyMetrics());
    }

    const metrics = attributionMap.get(key)!;
    const returns = [trade.realizedPnL || 0];
    
    metrics.totalTrades++;
    metrics.totalReturn += trade.realizedPnL || 0;
    metrics.totalReturnPct += trade.returnPercent || 0;
    
    if (trade.realizedPnL && trade.realizedPnL > 0) {
      metrics.winningTrades++;
      metrics.avgWinningTrade = (metrics.avgWinningTrade * (metrics.winningTrades - 1) + trade.realizedPnL) / metrics.winningTrades;
    } else if (trade.realizedPnL && trade.realizedPnL < 0) {
      metrics.losingTrades++;
      metrics.avgLosingTrade = (metrics.avgLosingTrade * (metrics.losingTrades - 1) + trade.realizedPnL) / metrics.losingTrades;
    }

    metrics.winRate = metrics.winningTrades / metrics.totalTrades;
    metrics.avgReturn = metrics.totalReturn / metrics.totalTrades;
    metrics.analysisTimestamp = new Date();
  }

  /**
   * Check for performance alerts
   */
  private checkPerformanceAlerts(trade: Trade): void {
    const alerts: PerformanceAlert[] = [];

    // Drawdown alert
    if (this.currentMetrics.currentDrawdown > this.config.alertThresholds.maxDrawdown) {
      alerts.push({
        type: 'drawdown',
        severity: 'high',
        message: `Current drawdown ${(this.currentMetrics.currentDrawdown * 100).toFixed(2)}% exceeds threshold`,
        value: this.currentMetrics.currentDrawdown,
        threshold: this.config.alertThresholds.maxDrawdown,
        timestamp: new Date()
      });
    }

    // Daily loss alert
    if (this.realTimeStats.todayPnLPct < -this.config.alertThresholds.dailyLoss) {
      alerts.push({
        type: 'performance',
        severity: 'medium',
        message: `Daily loss ${(this.realTimeStats.todayPnLPct * 100).toFixed(2)}% exceeds threshold`,
        value: Math.abs(this.realTimeStats.todayPnLPct),
        threshold: this.config.alertThresholds.dailyLoss,
        timestamp: new Date()
      });
    }

    // Consecutive losses alert
    if (this.currentMetrics.consecutiveLosses >= this.config.alertThresholds.consecutiveLosses) {
      alerts.push({
        type: 'streak',
        severity: 'medium',
        message: `${this.currentMetrics.consecutiveLosses} consecutive losses detected`,
        value: this.currentMetrics.consecutiveLosses,
        threshold: this.config.alertThresholds.consecutiveLosses,
        timestamp: new Date()
      });
    }

    // VaR breach alert
    if (this.currentMetrics.var95 > this.config.alertThresholds.var95Breach) {
      alerts.push({
        type: 'risk',
        severity: 'high',
        message: `95% VaR ${(this.currentMetrics.var95 * 100).toFixed(2)}% exceeds threshold`,
        value: this.currentMetrics.var95,
        threshold: this.config.alertThresholds.var95Breach,
        timestamp: new Date()
      });
    }

    // Add new alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.logger.warn('Performance alert triggered', alert);
      this.emit('performance_alert', alert);
    });

    // Limit alert history
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(): void {
    setInterval(() => {
      this.updateRealTimeMetrics();
    }, 1000); // Update every second

    setInterval(() => {
      this.savePerformanceSnapshot();
    }, 60000); // Save snapshot every minute
  }

  /**
   * Update real-time metrics
   */
  private updateRealTimeMetrics(): void {
    // Update unrealized P&L from open positions
    let unrealizedPnL = 0;
    
    for (const position of this.positions) {
      if (position.quantity !== 0) {
        const currentValue = position.quantity * position.currentPrice;
        const costBasis = position.quantity * position.averagePrice;
        unrealizedPnL += currentValue - costBasis;
      }
    }

    // Update real-time stats
    this.realTimeStats.currentPnL = this.currentMetrics.totalReturn + unrealizedPnL;
    this.realTimeStats.lastUpdate = new Date();

    // Emit real-time update
    this.emit('realtime_update', this.realTimeStats);
  }

  /**
   * Save performance snapshot
   */
  private savePerformanceSnapshot(): void {
    const now = new Date();
    this.performanceHistory.set(now, { ...this.currentMetrics });

    // Limit history size (keep last 30 days of minute snapshots)
    const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    
    for (const [date] of this.performanceHistory) {
      if (date < thirtyDaysAgo) {
        this.performanceHistory.delete(date);
      }
    }
  }

  // Calculation methods

  private calculateMaxDrawdown(returns: number[]): number {
    let maxDrawdown = 0;
    let peak = 0;
    let cumulative = 0;

    for (const ret of returns) {
      cumulative += ret;
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateMaxDrawdownPercent(returnsPercent: number[]): number {
    let maxDrawdown = 0;
    let peak = 1;
    let cumulative = 1;

    for (const ret of returnsPercent) {
      cumulative *= (1 + ret);
      if (cumulative > peak) {
        peak = cumulative;
      }
      const drawdown = (peak - cumulative) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateCurrentDrawdown(returns: number[]): number {
    let peak = 0;
    let cumulative = 0;

    for (const ret of returns) {
      cumulative += ret;
      if (cumulative > peak) {
        peak = cumulative;
      }
    }

    return Math.max(0, peak - cumulative);
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance);
  }

  private calculateDownsideVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;

    const negativeReturns = returns.filter(ret => ret < 0);
    if (negativeReturns.length === 0) return 0;

    const mean = negativeReturns.reduce((sum, ret) => sum + ret, 0) / negativeReturns.length;
    const variance = negativeReturns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (negativeReturns.length - 1);
    
    return Math.sqrt(variance);
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    if (volatility === 0) return 0;

    // Assume daily returns, annualize
    const annualizedReturn = avgReturn * 252; // 252 trading days
    const annualizedVol = volatility * Math.sqrt(252);
    
    return (annualizedReturn - this.config.riskFreeRate) / annualizedVol;
  }

  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length < 2) return 0;

    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const downsideVol = this.calculateDownsideVolatility(returns);
    
    if (downsideVol === 0) return 0;

    const annualizedReturn = avgReturn * 252;
    const annualizedDownsideVol = downsideVol * Math.sqrt(252);
    
    return (annualizedReturn - this.config.riskFreeRate) / annualizedDownsideVol;
  }

  private calculateCalmarRatio(): number {
    if (this.currentMetrics.maxDrawdown === 0) return 0;
    
    const annualizedReturn = this.currentMetrics.avgReturn * 252;
    return annualizedReturn / this.currentMetrics.maxDrawdown;
  }

  private calculateProfitFactor(winningTrades: number[], losingTrades: number[]): number {
    const grossProfit = winningTrades.reduce((sum, ret) => sum + ret, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, ret) => sum + ret, 0));
    
    return grossLoss > 0 ? grossProfit / grossLoss : 0;
  }

  private calculatePayoffRatio(): number {
    if (this.currentMetrics.avgLosingTrade === 0) return 0;
    return Math.abs(this.currentMetrics.avgWinningTrade / this.currentMetrics.avgLosingTrade);
  }

  private calculateKellyPercentage(): number {
    const winRate = this.currentMetrics.winRate;
    const payoffRatio = this.calculatePayoffRatio();
    
    if (payoffRatio === 0) return 0;
    return winRate - ((1 - winRate) / payoffRatio);
  }

  private calculateVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;

    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    
    return Math.abs(sortedReturns[index] || 0);
  }

  private calculateConditionalVaR(returns: number[], confidenceLevel: number): number {
    if (returns.length === 0) return 0;

    const var = this.calculateVaR(returns, confidenceLevel);
    const exceedingLosses = returns.filter(ret => ret <= -var);
    
    if (exceedingLosses.length === 0) return var;
    
    return Math.abs(exceedingLosses.reduce((sum, ret) => sum + ret, 0) / exceedingLosses.length);
  }

  private calculateAverageTradeDuration(): number {
    if (this.trades.length === 0) return 0;

    const durations = this.trades
      .filter(trade => trade.closeTime)
      .map(trade => trade.closeTime! - trade.openTime);

    return durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
  }

  private calculateAverageTimeInMarket(): number {
    // Simplified calculation - would need market hours data for accuracy
    return this.calculateAverageTradeDuration();
  }

  private calculateTotalTimeInMarket(): number {
    return this.trades
      .filter(trade => trade.closeTime)
      .reduce((total, trade) => total + (trade.closeTime! - trade.openTime), 0);
  }

  private calculateMonthlyReturns(): number[] {
    const monthlyReturns: number[] = [];
    const monthlyData = new Map<string, number>();

    for (const trade of this.trades) {
      if (!trade.closeTime) continue;
      
      const date = new Date(trade.closeTime);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      
      monthlyData.set(monthKey, (monthlyData.get(monthKey) || 0) + (trade.realizedPnL || 0));
    }

    return Array.from(monthlyData.values());
  }

  private calculateStreaks(returns: number[]): any {
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    let tempWinStreak = 0;
    let tempLossStreak = 0;

    for (let i = returns.length - 1; i >= 0; i--) {
      if (returns[i] > 0) {
        tempWinStreak++;
        tempLossStreak = 0;
        if (i === returns.length - 1) currentWinStreak = tempWinStreak;
      } else if (returns[i] < 0) {
        tempLossStreak++;
        tempWinStreak = 0;
        if (i === returns.length - 1) currentLossStreak = tempLossStreak;
      } else {
        tempWinStreak = 0;
        tempLossStreak = 0;
      }

      maxWinStreak = Math.max(maxWinStreak, tempWinStreak);
      maxLossStreak = Math.max(maxLossStreak, tempLossStreak);
    }

    return {
      currentWinStreak,
      currentLossStreak,
      maxWinStreak,
      maxLossStreak
    };
  }

  private classifyVolatilityRegime(volatility?: number): string {
    if (!volatility) return 'unknown';
    
    if (volatility < 0.01) return 'low';
    if (volatility < 0.02) return 'medium';
    if (volatility < 0.04) return 'high';
    return 'extreme';
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      totalReturn: 0,
      totalReturnPct: 0,
      avgReturn: 0,
      avgReturnPct: 0,
      bestTrade: 0,
      worstTrade: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      lossRate: 0,
      avgWinningTrade: 0,
      avgLosingTrade: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      currentDrawdown: 0,
      volatility: 0,
      downSideVolatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      calmarRatio: 0,
      informationRatio: 0,
      treynorRatio: 0,
      profitFactor: 0,
      payoffRatio: 0,
      expectedValue: 0,
      kelly: 0,
      var95: 0,
      var99: 0,
      cvar95: 0,
      avgTradeDuration: 0,
      avgTimeInMarket: 0,
      totalTimeInMarket: 0,
      monthlyReturns: [],
      consecutiveWins: 0,
      consecutiveLosses: 0,
      largestWinStreak: 0,
      largestLossStreak: 0,
      firstTrade: new Date(),
      lastTrade: new Date(),
      analysisTimestamp: new Date()
    };
  }

  /**
   * Get current performance metrics
   */
  public getCurrentMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get real-time statistics
   */
  public getRealTimeStats(): RealTimeStats {
    return { ...this.realTimeStats };
  }

  /**
   * Get performance attribution
   */
  public getPerformanceAttribution(): PerformanceAttribution {
    return {
      byStrategy: new Map(this.performanceAttribution.byStrategy),
      byPattern: new Map(this.performanceAttribution.byPattern),
      byTimeOfDay: new Map(this.performanceAttribution.byTimeOfDay),
      byDayOfWeek: new Map(this.performanceAttribution.byDayOfWeek),
      byMarketCondition: new Map(this.performanceAttribution.byMarketCondition),
      byVolatilityRegime: new Map(this.performanceAttribution.byVolatilityRegime)
    };
  }

  /**
   * Get recent alerts
   */
  public getRecentAlerts(limit: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Get performance summary for specific timeframe
   */
  public getPerformanceSummary(startDate: Date, endDate: Date): PerformanceMetrics {
    const filteredTrades = this.trades.filter(trade => {
      const tradeDate = new Date(trade.closeTime || trade.openTime);
      return tradeDate >= startDate && tradeDate <= endDate;
    });

    if (filteredTrades.length === 0) {
      return this.createEmptyMetrics();
    }

    // Create temporary analyzer for the filtered data
    const tempAnalyzer = new PerformanceAnalyzer(this.logger, this.metricsCollector);
    filteredTrades.forEach(trade => tempAnalyzer.addTrade(trade));
    
    return tempAnalyzer.getCurrentMetrics();
  }

  /**
   * Export performance data for reporting
   */
  public exportPerformanceData(): any {
    return {
      metrics: this.currentMetrics,
      realTimeStats: this.realTimeStats,
      attribution: {
        byStrategy: Object.fromEntries(this.performanceAttribution.byStrategy),
        byPattern: Object.fromEntries(this.performanceAttribution.byPattern),
        byTimeOfDay: Object.fromEntries(this.performanceAttribution.byTimeOfDay),
        byDayOfWeek: Object.fromEntries(this.performanceAttribution.byDayOfWeek),
        byMarketCondition: Object.fromEntries(this.performanceAttribution.byMarketCondition),
        byVolatilityRegime: Object.fromEntries(this.performanceAttribution.byVolatilityRegime)
      },
      trades: this.trades,
      alerts: this.alerts,
      config: this.config
    };
  }

  /**
   * Reset performance analysis
   */
  public reset(): void {
    this.trades = [];
    this.positions = [];
    this.dailyReturns = [];
    this.performanceHistory.clear();
    this.alerts = [];
    this.returnsWindow = [];
    this.drawdownWindow = [];
    this.volatilityWindow = [];
    
    this.realTimeStats = {
      currentPnL: 0,
      currentPnLPct: 0,
      todayPnL: 0,
      todayPnLPct: 0,
      thisWeekPnL: 0,
      thisMonthPnL: 0,
      currentPositions: 0,
      currentExposure: 0,
      currentRisk: 0,
      lastUpdate: new Date()
    };

    this.currentMetrics = this.createEmptyMetrics();
    
    this.performanceAttribution = {
      byStrategy: new Map(),
      byPattern: new Map(),
      byTimeOfDay: new Map(),
      byDayOfWeek: new Map(),
      byMarketCondition: new Map(),
      byVolatilityRegime: new Map()
    };

    this.logger.info('Performance analyzer reset successfully');
    this.emit('analyzer_reset');
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.performanceHistory.clear();
    this.trades = [];
    this.positions = [];
    this.alerts = [];
    
    this.removeAllListeners();
    this.logger.info('PerformanceAnalyzer disposed successfully');
  }
}

export default PerformanceAnalyzer;