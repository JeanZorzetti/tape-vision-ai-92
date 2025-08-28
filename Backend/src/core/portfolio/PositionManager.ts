/**
 * Position Manager - Advanced Portfolio and Position Management
 * Handles position tracking, P&L calculation, and risk monitoring
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  Position,
  TradeEntry,
  MarketData,
  RiskParameters,
  TradingSession,
  TradingError
} from '@/types/trading';

export interface PortfolioMetrics {
  totalValue: number;
  totalPnL: number;
  unrealizedPnL: number;
  realizedPnL: number;
  dayPnL: number;
  totalCommissions: number;
  totalSlippage: number;
  marginUsed: number;
  marginAvailable: number;
  buyingPower: number;
  leverage: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  calmarRatio: number;
}

export interface PositionUpdate {
  positionId: string;
  price: number;
  pnl: number;
  unrealizedPnL: number;
  timestamp: number;
}

export interface RiskMetrics {
  currentDrawdown: number;
  maxDrawdown: number;
  dailyVaR: number;
  positionSizes: Map<string, number>;
  concentrationRisk: number;
  leverageRisk: number;
  portfolioVolatility: number;
  beta: number;
}

export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  positions: Position[];
  metrics: PortfolioMetrics;
  riskMetrics: RiskMetrics;
}

export interface PositionManagerConfig {
  baseCurrency: string;
  initialCapital: number;
  maxPositions: number;
  enableRealTimeValuation: boolean;
  snapshotInterval: number;
  maxHistoryDays: number;
  riskCalculation: {
    enabled: boolean;
    confidenceLevel: number;
    lookbackDays: number;
  };
}

export class PositionManager extends EventEmitter {
  private logger: Logger;
  private config: PositionManagerConfig;
  private riskParameters: RiskParameters;
  
  // Position tracking
  private positions: Map<string, Position> = new Map();
  private closedPositions: Map<string, Position> = new Map();
  private marketData: Map<string, MarketData> = new Map();
  
  // Portfolio state
  private currentValue: number;
  private startingValue: number;
  private dayStartValue: number;
  private totalCommissions: number = 0;
  private totalSlippage: number = 0;
  
  // Performance tracking
  private portfolioHistory: PortfolioSnapshot[] = [];
  private dailyReturns: number[] = [];
  private peakValue: number;
  private currentDrawdown: number = 0;
  private maxDrawdown: number = 0;
  
  // Risk management
  private positionLimits: Map<string, number> = new Map();
  private correlationMatrix: Map<string, Map<string, number>> = new Map();
  
  // Timers
  private snapshotTimer?: NodeJS.Timeout;
  private valuationTimer?: NodeJS.Timeout;
  private isActive: boolean = false;

  constructor(
    config: PositionManagerConfig,
    riskParameters: RiskParameters,
    logger: Logger
  ) {
    super();
    this.config = config;
    this.riskParameters = riskParameters;
    this.logger = logger.child({ component: 'PositionManager' });
    
    // Initialize portfolio values
    this.currentValue = config.initialCapital;
    this.startingValue = config.initialCapital;
    this.dayStartValue = config.initialCapital;
    this.peakValue = config.initialCapital;
    
    this.logger.info('PositionManager initialized', {
      initialCapital: config.initialCapital,
      maxPositions: config.maxPositions,
      enableRealTimeValuation: config.enableRealTimeValuation
    });
  }

  /**
   * Start the position manager
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting PositionManager');
      
      this.isActive = true;
      
      // Start periodic snapshots
      this.startSnapshotTimer();
      
      // Start real-time valuation if enabled
      if (this.config.enableRealTimeValuation) {
        this.startValuationTimer();
      }
      
      this.emit('manager-started');
      this.logger.info('PositionManager started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start PositionManager', error);
      throw error;
    }
  }

  /**
   * Stop the position manager
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping PositionManager');
      
      this.isActive = false;
      
      // Stop timers
      if (this.snapshotTimer) clearInterval(this.snapshotTimer);
      if (this.valuationTimer) clearInterval(this.valuationTimer);
      
      // Create final snapshot
      this.createSnapshot();
      
      this.emit('manager-stopped');
      this.logger.info('PositionManager stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping PositionManager', error);
      throw error;
    }
  }

  /**
   * Open a new position
   */
  public async openPosition(trade: TradeEntry): Promise<Position> {
    if (!this.isActive) {
      throw new TradingError('PositionManager is not active', 'MANAGER_INACTIVE');
    }
    
    // Check position limits
    if (this.positions.size >= this.config.maxPositions) {
      throw new TradingError('Maximum positions reached', 'MAX_POSITIONS_REACHED');
    }
    
    try {
      const position: Position = {
        id: trade.id,
        symbol: trade.symbol,
        side: trade.action === 'BUY' ? 'long' : 'short',
        size: trade.quantity || 0,
        entryPrice: trade.price || 0,
        currentPrice: trade.price || 0,
        pnl: 0,
        unrealizedPnL: 0,
        stopLoss: 0,
        takeProfit: 0,
        entryTime: Date.now(),
        duration: 0
      };
      
      // Set stop loss and take profit if available
      this.setStopLossAndTakeProfit(position);
      
      // Store position
      this.positions.set(position.id, position);
      
      // Update portfolio value
      const commission = trade.executionTime ? this.calculateCommission(trade) : 0;
      const slippage = trade.slippage ? trade.slippage : 0;
      
      this.totalCommissions += commission;
      this.totalSlippage += slippage;
      
      this.logger.info('Position opened', {
        positionId: position.id,
        symbol: position.symbol,
        side: position.side,
        size: position.size,
        entryPrice: position.entryPrice
      });
      
      this.emit('position-opened', position);
      
      // Update portfolio valuation
      this.updatePortfolioValue();
      
      return position;
      
    } catch (error) {
      this.logger.error('Error opening position', error);
      throw error;
    }
  }

  /**
   * Close a position
   */
  public async closePosition(positionId: string, exitPrice: number, reason: string): Promise<Position> {
    const position = this.positions.get(positionId);
    if (!position) {
      throw new TradingError(`Position not found: ${positionId}`, 'POSITION_NOT_FOUND');
    }
    
    try {
      // Calculate final P&L
      const pnl = this.calculatePnL(position, exitPrice);
      
      // Update position
      position.currentPrice = exitPrice;
      position.pnl = pnl;
      position.unrealizedPnL = 0;
      position.duration = Date.now() - position.entryTime;
      
      // Calculate commission and slippage for exit
      const commission = this.calculateExitCommission(position, exitPrice);
      const slippage = this.calculateExitSlippage(position, exitPrice);
      
      position.pnl -= commission + slippage;
      this.totalCommissions += commission;
      this.totalSlippage += slippage;
      
      // Move to closed positions
      this.closedPositions.set(positionId, position);
      this.positions.delete(positionId);
      
      // Update daily returns for statistics
      this.addReturn(pnl);
      
      this.logger.info('Position closed', {
        positionId,
        pnl: pnl.toFixed(2),
        duration: position.duration,
        reason
      });
      
      this.emit('position-closed', { position, reason });
      
      // Update portfolio valuation
      this.updatePortfolioValue();
      
      return position;
      
    } catch (error) {
      this.logger.error('Error closing position', error);
      throw error;
    }
  }

  /**
   * Update position with new market data
   */
  public async updatePosition(symbol: string, marketData: MarketData): Promise<void> {
    if (!this.isActive) return;
    
    try {
      // Store market data
      this.marketData.set(symbol, marketData);
      
      // Update positions for this symbol
      const symbolPositions = Array.from(this.positions.values())
        .filter(pos => pos.symbol === symbol);
      
      for (const position of symbolPositions) {
        const oldUnrealizedPnL = position.unrealizedPnL;
        
        // Update current price and unrealized P&L
        position.currentPrice = marketData.price;
        position.unrealizedPnL = this.calculateUnrealizedPnL(position);
        position.duration = Date.now() - position.entryTime;
        
        // Check stop loss and take profit
        await this.checkStopLossAndTakeProfit(position);
        
        // Emit update if P&L changed significantly
        if (Math.abs(position.unrealizedPnL - oldUnrealizedPnL) > 1) {
          const update: PositionUpdate = {
            positionId: position.id,
            price: marketData.price,
            pnl: position.pnl + position.unrealizedPnL,
            unrealizedPnL: position.unrealizedPnL,
            timestamp: Date.now()
          };
          
          this.emit('position-updated', update);
        }
      }
      
      // Update portfolio value if needed
      if (symbolPositions.length > 0) {
        this.updatePortfolioValue();
      }
      
    } catch (error) {
      this.logger.error('Error updating position', error);
    }
  }

  private setStopLossAndTakeProfit(position: Position): void {
    const stopLossPoints = this.riskParameters.stopLossPoints;
    const takeProfitPoints = this.riskParameters.takeProfitPoints;
    
    if (position.side === 'long') {
      position.stopLoss = position.entryPrice - stopLossPoints;
      position.takeProfit = position.entryPrice + takeProfitPoints;
    } else {
      position.stopLoss = position.entryPrice + stopLossPoints;
      position.takeProfit = position.entryPrice - takeProfitPoints;
    }
  }

  private async checkStopLossAndTakeProfit(position: Position): Promise<void> {
    const currentPrice = position.currentPrice;
    
    // Check stop loss
    if (position.side === 'long' && currentPrice <= position.stopLoss) {
      await this.closePosition(position.id, currentPrice, 'STOP_LOSS');
      return;
    }
    
    if (position.side === 'short' && currentPrice >= position.stopLoss) {
      await this.closePosition(position.id, currentPrice, 'STOP_LOSS');
      return;
    }
    
    // Check take profit
    if (position.side === 'long' && currentPrice >= position.takeProfit) {
      await this.closePosition(position.id, currentPrice, 'TAKE_PROFIT');
      return;
    }
    
    if (position.side === 'short' && currentPrice <= position.takeProfit) {
      await this.closePosition(position.id, currentPrice, 'TAKE_PROFIT');
      return;
    }
  }

  private calculatePnL(position: Position, exitPrice: number): number {
    const priceDiff = exitPrice - position.entryPrice;
    const multiplier = position.side === 'long' ? 1 : -1;
    return priceDiff * multiplier * position.size;
  }

  private calculateUnrealizedPnL(position: Position): number {
    return this.calculatePnL(position, position.currentPrice);
  }

  private calculateCommission(trade: TradeEntry): number {
    // Simplified commission calculation
    return (trade.quantity || 0) * 2.5; // $2.50 per contract
  }

  private calculateExitCommission(position: Position, exitPrice: number): number {
    return position.size * 2.5; // $2.50 per contract
  }

  private calculateExitSlippage(position: Position, exitPrice: number): number {
    // Estimate slippage as 0.1% of trade value
    return Math.abs(exitPrice - position.currentPrice) * position.size * 0.001;
  }

  private updatePortfolioValue(): void {
    // Calculate total unrealized P&L
    const totalUnrealizedPnL = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    // Calculate total realized P&L
    const totalRealizedPnL = Array.from(this.closedPositions.values())
      .reduce((sum, pos) => sum + pos.pnl, 0);
    
    // Update current value
    this.currentValue = this.startingValue + totalRealizedPnL + totalUnrealizedPnL - 
                       this.totalCommissions - this.totalSlippage;
    
    // Update drawdown metrics
    this.updateDrawdownMetrics();
  }

  private updateDrawdownMetrics(): void {
    if (this.currentValue > this.peakValue) {
      this.peakValue = this.currentValue;
      this.currentDrawdown = 0;
    } else {
      this.currentDrawdown = (this.peakValue - this.currentValue) / this.peakValue;
      this.maxDrawdown = Math.max(this.maxDrawdown, this.currentDrawdown);
    }
  }

  private addReturn(pnl: number): void {
    if (this.currentValue > 0) {
      const returnPercent = (pnl / this.currentValue) * 100;
      this.dailyReturns.push(returnPercent);
      
      // Keep only recent returns for calculations
      if (this.dailyReturns.length > 252) { // 1 year of trading days
        this.dailyReturns = this.dailyReturns.slice(-252);
      }
    }
  }

  private startSnapshotTimer(): void {
    this.snapshotTimer = setInterval(() => {
      this.createSnapshot();
    }, this.config.snapshotInterval);
  }

  private startValuationTimer(): void {
    this.valuationTimer = setInterval(() => {
      this.updatePortfolioValue();
      this.emit('valuation-update', this.getPortfolioMetrics());
    }, 1000); // Update every second
  }

  private createSnapshot(): void {
    const snapshot: PortfolioSnapshot = {
      timestamp: Date.now(),
      totalValue: this.currentValue,
      positions: Array.from(this.positions.values()),
      metrics: this.getPortfolioMetrics(),
      riskMetrics: this.getRiskMetrics()
    };
    
    this.portfolioHistory.push(snapshot);
    
    // Cleanup old snapshots
    const cutoffTime = Date.now() - (this.config.maxHistoryDays * 86400000);
    this.portfolioHistory = this.portfolioHistory.filter(s => s.timestamp > cutoffTime);
    
    this.emit('snapshot-created', snapshot);
  }

  /**
   * Get current portfolio metrics
   */
  public getPortfolioMetrics(): PortfolioMetrics {
    const totalUnrealizedPnL = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
    
    const totalRealizedPnL = Array.from(this.closedPositions.values())
      .reduce((sum, pos) => sum + pos.pnl, 0);
    
    const dayPnL = this.currentValue - this.dayStartValue;
    
    // Calculate performance metrics
    const winningTrades = Array.from(this.closedPositions.values()).filter(p => p.pnl > 0).length;
    const totalTrades = this.closedPositions.size;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const winners = Array.from(this.closedPositions.values()).filter(p => p.pnl > 0);
    const losers = Array.from(this.closedPositions.values()).filter(p => p.pnl < 0);
    
    const avgWin = winners.length > 0 ? winners.reduce((sum, p) => sum + p.pnl, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, p) => sum + p.pnl, 0) / losers.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    // Calculate Sharpe ratio
    const avgReturn = this.dailyReturns.length > 0 ? 
      this.dailyReturns.reduce((sum, r) => sum + r, 0) / this.dailyReturns.length : 0;
    const stdDev = this.calculateStandardDeviation(this.dailyReturns);
    const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    
    // Calculate Calmar ratio
    const totalReturn = ((this.currentValue - this.startingValue) / this.startingValue) * 100;
    const calmarRatio = this.maxDrawdown > 0 ? totalReturn / (this.maxDrawdown * 100) : 0;
    
    return {
      totalValue: this.currentValue,
      totalPnL: totalRealizedPnL + totalUnrealizedPnL,
      unrealizedPnL: totalUnrealizedPnL,
      realizedPnL: totalRealizedPnL,
      dayPnL,
      totalCommissions: this.totalCommissions,
      totalSlippage: this.totalSlippage,
      marginUsed: this.calculateMarginUsed(),
      marginAvailable: this.calculateMarginAvailable(),
      buyingPower: this.calculateBuyingPower(),
      leverage: this.calculateLeverage(),
      sharpeRatio,
      maxDrawdown: this.maxDrawdown * 100,
      winRate,
      profitFactor,
      calmarRatio
    };
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    
    return Math.sqrt(avgSquaredDiff);
  }

  private calculateMarginUsed(): number {
    // Simplified margin calculation
    return Array.from(this.positions.values())
      .reduce((sum, pos) => sum + (pos.size * pos.currentPrice * 0.1), 0); // 10% margin requirement
  }

  private calculateMarginAvailable(): number {
    return Math.max(0, this.currentValue - this.calculateMarginUsed());
  }

  private calculateBuyingPower(): number {
    return this.calculateMarginAvailable() * 10; // 10:1 leverage
  }

  private calculateLeverage(): number {
    const totalExposure = Array.from(this.positions.values())
      .reduce((sum, pos) => sum + (pos.size * pos.currentPrice), 0);
    
    return this.currentValue > 0 ? totalExposure / this.currentValue : 0;
  }

  /**
   * Get risk metrics
   */
  public getRiskMetrics(): RiskMetrics {
    const positionSizes = new Map<string, number>();
    let totalExposure = 0;
    
    for (const position of this.positions.values()) {
      const exposure = position.size * position.currentPrice;
      positionSizes.set(position.symbol, exposure);
      totalExposure += Math.abs(exposure);
    }
    
    // Calculate concentration risk (largest position as % of portfolio)
    const maxExposure = Math.max(...Array.from(positionSizes.values()));
    const concentrationRisk = this.currentValue > 0 ? (maxExposure / this.currentValue) * 100 : 0;
    
    // Calculate portfolio volatility
    const portfolioVolatility = this.calculateStandardDeviation(this.dailyReturns);
    
    return {
      currentDrawdown: this.currentDrawdown * 100,
      maxDrawdown: this.maxDrawdown * 100,
      dailyVaR: this.calculateVaR(),
      positionSizes,
      concentrationRisk,
      leverageRisk: this.calculateLeverage(),
      portfolioVolatility,
      beta: 1.0 // Simplified - would need benchmark data
    };
  }

  private calculateVaR(confidenceLevel: number = 0.95): number {
    if (this.dailyReturns.length < 10) return 0;
    
    const sortedReturns = [...this.dailyReturns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    
    return Math.abs(sortedReturns[index] || 0);
  }

  /**
   * Get all active positions
   */
  public getActivePositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by ID
   */
  public getPosition(positionId: string): Position | undefined {
    return this.positions.get(positionId) || this.closedPositions.get(positionId);
  }

  /**
   * Get positions by symbol
   */
  public getPositionsBySymbol(symbol: string): Position[] {
    return Array.from(this.positions.values()).filter(pos => pos.symbol === symbol);
  }

  /**
   * Get closed positions
   */
  public getClosedPositions(limit: number = 100): Position[] {
    return Array.from(this.closedPositions.values())
      .sort((a, b) => (b.entryTime + b.duration) - (a.entryTime + a.duration))
      .slice(0, limit);
  }

  /**
   * Get portfolio history
   */
  public getPortfolioHistory(hours: number = 24): PortfolioSnapshot[] {
    const cutoffTime = Date.now() - (hours * 3600000);
    return this.portfolioHistory.filter(snapshot => snapshot.timestamp > cutoffTime);
  }

  /**
   * Reset daily P&L tracking
   */
  public resetDaily(): void {
    this.dayStartValue = this.currentValue;
    this.logger.info('Daily reset completed', { startValue: this.dayStartValue });
  }

  /**
   * Check if manager is ready
   */
  public isReady(): boolean {
    return this.isActive;
  }

  /**
   * Emergency close all positions
   */
  public async emergencyCloseAll(reason: string): Promise<void> {
    this.logger.error('Emergency close all positions triggered', { reason });
    
    const positionIds = Array.from(this.positions.keys());
    
    for (const positionId of positionIds) {
      try {
        const position = this.positions.get(positionId);
        if (position) {
          await this.closePosition(positionId, position.currentPrice, `EMERGENCY: ${reason}`);
        }
      } catch (error) {
        this.logger.error('Error during emergency close', { positionId, error });
      }
    }
    
    this.emit('emergency-close-all', { reason, timestamp: Date.now() });
  }
}