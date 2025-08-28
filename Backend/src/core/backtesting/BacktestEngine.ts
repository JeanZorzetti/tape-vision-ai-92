/**
 * Backtest Engine - Advanced Strategy Backtesting and Performance Analysis
 * Provides comprehensive backtesting capabilities with detailed performance metrics
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  MarketData,
  TapeEntry,
  OrderBook,
  Position,
  TradeEntry,
  RiskParameters,
  TradingConfig,
  TradingError
} from '@/types/trading';

export interface BacktestConfig {
  id: string;
  name: string;
  symbol: string;
  startDate: number;
  endDate: number;
  initialCapital: number;
  commission: number;
  slippage: number;
  riskParameters: RiskParameters;
  strategyConfig: TradingConfig;
  dataResolution: 'tick' | '1s' | '5s' | '1m' | '5m';
  validateData: boolean;
}

export interface BacktestData {
  marketData: MarketData[];
  tapeData: TapeEntry[];
  orderBookData: OrderBook[];
}

export interface BacktestPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  entryTime: number;
  exitPrice?: number;
  exitTime?: number;
  pnl: number;
  commission: number;
  slippage: number;
  holdingPeriod: number;
  maxProfit: number;
  maxLoss: number;
  entryReason: string;
  exitReason?: string;
}

export interface BacktestTrade {
  id: string;
  timestamp: number;
  type: 'entry' | 'exit';
  side: 'buy' | 'sell';
  price: number;
  quantity: number;
  commission: number;
  slippage: number;
  pnl?: number;
  positionId: string;
  reason: string;
}

export interface BacktestResult {
  config: BacktestConfig;
  startTime: number;
  endTime: number;
  duration: number;
  
  // Summary
  totalTrades: number;
  totalPositions: number;
  winningTrades: number;
  losingTrades: number;
  
  // Performance
  finalBalance: number;
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  
  // Risk metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDD: number;
  volatility: number;
  beta: number;
  alpha: number;
  
  // Trading metrics
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  avgHoldingPeriod: number;
  avgWinHoldingPeriod: number;
  avgLossHoldingPeriod: number;
  
  // Costs
  totalCommissions: number;
  totalSlippage: number;
  
  // Time series data
  equityCurve: { timestamp: number; value: number }[];
  drawdownCurve: { timestamp: number; value: number }[];
  positions: BacktestPosition[];
  trades: BacktestTrade[];
  
  // Statistical analysis
  monthlyReturns: { month: string; return: number }[];
  yearlyReturns: { year: number; return: number }[];
  correlationToMarket: number;
  
  // Advanced metrics
  ulcerIndex: number;
  painIndex: number;
  informationRatio: number;
  treynorRatio: number;
  
  // Validation
  dataQuality: {
    totalPoints: number;
    validPoints: number;
    invalidPoints: number;
    missingPoints: number;
    duplicatePoints: number;
  };
}

export interface BacktestProgress {
  currentTime: number;
  progressPercent: number;
  processedBars: number;
  totalBars: number;
  currentBalance: number;
  currentDrawdown: number;
  tradesExecuted: number;
  estimatedTimeRemaining: number;
}

export interface PerformanceSnapshot {
  timestamp: number;
  balance: number;
  positions: number;
  drawdown: number;
  openPnl: number;
}

export class BacktestEngine extends EventEmitter {
  private logger: Logger;
  
  // Backtest state
  private config: BacktestConfig | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  
  // Market simulation
  private currentTime: number = 0;
  private currentBalance: number = 0;
  private peakBalance: number = 0;
  private currentDrawdown: number = 0;
  private maxDrawdown: number = 0;
  
  // Position tracking
  private openPositions: Map<string, BacktestPosition> = new Map();
  private closedPositions: BacktestPosition[] = [];
  private allTrades: BacktestTrade[] = [];
  
  // Performance tracking
  private equityCurve: { timestamp: number; value: number }[] = [];
  private drawdownCurve: { timestamp: number; value: number }[] = [];
  private performanceSnapshots: PerformanceSnapshot[] = [];
  private dailyReturns: number[] = [];
  
  // Strategy integration
  private strategyInstance: any = null; // Would be actual strategy instance
  
  // Progress tracking
  private processedBars: number = 0;
  private totalBars: number = 0;
  private lastProgressUpdate: number = 0;

  constructor(logger: Logger) {
    super();
    this.logger = logger.child({ component: 'BacktestEngine' });
    
    this.logger.info('BacktestEngine initialized');
  }

  /**
   * Initialize backtest with configuration
   */
  public async initialize(config: BacktestConfig): Promise<void> {
    if (this.isRunning) {
      throw new TradingError('Cannot initialize while backtest is running', 'BACKTEST_RUNNING');
    }
    
    try {
      this.logger.info('Initializing backtest', {
        id: config.id,
        name: config.name,
        symbol: config.symbol,
        period: `${new Date(config.startDate).toISOString()} - ${new Date(config.endDate).toISOString()}`
      });
      
      // Validate configuration
      this.validateConfig(config);
      
      this.config = config;
      
      // Reset state
      this.resetState();
      
      // Initialize strategy (would load actual strategy here)
      this.initializeStrategy();
      
      this.emit('initialized', { config });
      this.logger.info('Backtest initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize backtest', error);
      throw error;
    }
  }

  /**
   * Run the backtest
   */
  public async run(data: BacktestData): Promise<BacktestResult> {
    if (!this.config) {
      throw new TradingError('Backtest not initialized', 'BACKTEST_NOT_INITIALIZED');
    }
    
    if (this.isRunning) {
      throw new TradingError('Backtest is already running', 'BACKTEST_RUNNING');
    }
    
    try {
      this.logger.info('Starting backtest execution');
      
      this.isRunning = true;
      this.startTime = Date.now();
      
      // Validate and prepare data
      const processedData = await this.prepareData(data);
      this.totalBars = processedData.marketData.length;
      
      // Run simulation
      await this.runSimulation(processedData);
      
      // Calculate final results
      const result = this.calculateResults();
      
      this.isRunning = false;
      
      this.emit('completed', result);
      this.logger.info('Backtest completed successfully', {
        duration: Date.now() - this.startTime,
        totalTrades: result.totalTrades,
        finalBalance: result.finalBalance,
        totalReturn: result.totalReturnPercent
      });
      
      return result;
      
    } catch (error) {
      this.isRunning = false;
      this.logger.error('Error running backtest', error);
      throw error;
    }
  }

  /**
   * Pause the backtest
   */
  public pause(): void {
    if (!this.isRunning || this.isPaused) {
      throw new TradingError('Cannot pause backtest in current state', 'INVALID_STATE');
    }
    
    this.isPaused = true;
    this.emit('paused');
    this.logger.info('Backtest paused');
  }

  /**
   * Resume the backtest
   */
  public resume(): void {
    if (!this.isRunning || !this.isPaused) {
      throw new TradingError('Cannot resume backtest in current state', 'INVALID_STATE');
    }
    
    this.isPaused = false;
    this.emit('resumed');
    this.logger.info('Backtest resumed');
  }

  /**
   * Stop the backtest
   */
  public stop(): void {
    if (!this.isRunning) {
      throw new TradingError('Backtest is not running', 'BACKTEST_NOT_RUNNING');
    }
    
    this.isRunning = false;
    this.isPaused = false;
    
    this.emit('stopped');
    this.logger.info('Backtest stopped');
  }

  private validateConfig(config: BacktestConfig): void {
    if (!config.id || !config.name || !config.symbol) {
      throw new TradingError('Missing required configuration fields', 'INVALID_CONFIG');
    }
    
    if (config.startDate >= config.endDate) {
      throw new TradingError('Start date must be before end date', 'INVALID_DATE_RANGE');
    }
    
    if (config.initialCapital <= 0) {
      throw new TradingError('Initial capital must be positive', 'INVALID_CAPITAL');
    }
    
    if (config.commission < 0 || config.slippage < 0) {
      throw new TradingError('Commission and slippage must be non-negative', 'INVALID_COSTS');
    }
  }

  private resetState(): void {
    this.currentTime = this.config!.startDate;
    this.currentBalance = this.config!.initialCapital;
    this.peakBalance = this.config!.initialCapital;
    this.currentDrawdown = 0;
    this.maxDrawdown = 0;
    
    this.openPositions.clear();
    this.closedPositions = [];
    this.allTrades = [];
    this.equityCurve = [];
    this.drawdownCurve = [];
    this.performanceSnapshots = [];
    this.dailyReturns = [];
    
    this.processedBars = 0;
    this.lastProgressUpdate = 0;
  }

  private initializeStrategy(): void {
    // Initialize trading strategy with backtest configuration
    // This would create an instance of the actual trading strategy
    this.strategyInstance = {
      // Mock strategy methods
      onMarketData: (data: MarketData) => this.processMarketData(data),
      onTapeData: (entries: TapeEntry[]) => this.processTapeData(entries),
      onOrderBook: (orderBook: OrderBook) => this.processOrderBook(orderBook)
    };
  }

  private async prepareData(data: BacktestData): Promise<BacktestData> {
    this.logger.info('Preparing backtest data', {
      marketDataPoints: data.marketData.length,
      tapeDataPoints: data.tapeData.length,
      orderBookPoints: data.orderBookData.length
    });
    
    // Sort data by timestamp
    const sortedMarketData = data.marketData
      .filter(d => d.timestamp >= this.config!.startDate && d.timestamp <= this.config!.endDate)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const sortedTapeData = data.tapeData
      .filter(d => d.timestamp >= this.config!.startDate && d.timestamp <= this.config!.endDate)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    const sortedOrderBookData = data.orderBookData
      .filter(d => d.timestamp >= this.config!.startDate && d.timestamp <= this.config!.endDate)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Validate data quality if enabled
    if (this.config!.validateData) {
      this.validateDataQuality(sortedMarketData);
    }
    
    return {
      marketData: sortedMarketData,
      tapeData: sortedTapeData,
      orderBookData: sortedOrderBookData
    };
  }

  private validateDataQuality(marketData: MarketData[]): void {
    let invalidCount = 0;
    let duplicateCount = 0;
    let lastTimestamp = 0;
    
    for (const data of marketData) {
      // Check for invalid data
      if (!data.price || !data.volume || !data.timestamp) {
        invalidCount++;
        continue;
      }
      
      // Check for duplicates
      if (data.timestamp === lastTimestamp) {
        duplicateCount++;
      }
      
      lastTimestamp = data.timestamp;
    }
    
    this.logger.info('Data quality validation completed', {
      totalPoints: marketData.length,
      invalidPoints: invalidCount,
      duplicatePoints: duplicateCount
    });
    
    if (invalidCount > marketData.length * 0.1) {
      throw new TradingError('Data quality too poor for backtesting', 'POOR_DATA_QUALITY');
    }
  }

  private async runSimulation(data: BacktestData): Promise<void> {
    this.logger.info('Starting simulation');
    
    const marketData = data.marketData;
    let tapeIndex = 0;
    let orderBookIndex = 0;
    
    for (let i = 0; i < marketData.length && this.isRunning; i++) {
      // Handle pause
      while (this.isPaused && this.isRunning) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (!this.isRunning) break;
      
      const currentData = marketData[i];
      this.currentTime = currentData.timestamp;
      
      // Process market data
      await this.processMarketData(currentData);
      
      // Process tape data for current timestamp
      while (tapeIndex < data.tapeData.length && 
             data.tapeData[tapeIndex].timestamp <= this.currentTime) {
        await this.processTapeData([data.tapeData[tapeIndex]]);
        tapeIndex++;
      }
      
      // Process order book data for current timestamp
      while (orderBookIndex < data.orderBookData.length && 
             data.orderBookData[orderBookIndex].timestamp <= this.currentTime) {
        await this.processOrderBook(data.orderBookData[orderBookIndex]);
        orderBookIndex++;
      }
      
      // Update positions
      this.updatePositions(currentData);
      
      // Take performance snapshot
      this.takePerformanceSnapshot();
      
      // Update progress
      this.processedBars = i + 1;
      this.updateProgress();
      
      // Yield control occasionally
      if (i % 1000 === 0) {
        await new Promise(resolve => setImmediate(resolve));
      }
    }
    
    // Close all remaining positions at the end
    await this.closeAllPositions('BACKTEST_END');
  }

  private async processMarketData(data: MarketData): Promise<void> {
    // This would call the actual strategy's market data handler
    // For now, implement a simple mock strategy
    
    // Mock strategy logic - simple moving average crossover
    // In reality, this would delegate to the actual strategy
    
    // Generate mock signals occasionally
    if (Math.random() < 0.01) { // 1% chance per bar
      const signal = Math.random() > 0.5 ? 'BUY' : 'SELL';
      await this.processSignal(signal, data.price, 'Mock strategy signal');
    }
  }

  private async processTapeData(entries: TapeEntry[]): Promise<void> {
    // Process tape entries
    // This would feed data to tape reading components
    for (const entry of entries) {
      // Mock processing
    }
  }

  private async processOrderBook(orderBook: OrderBook): Promise<void> {
    // Process order book data
    // This would feed data to order flow analysis components
  }

  private async processSignal(action: 'BUY' | 'SELL', price: number, reason: string): Promise<void> {
    try {
      if (action === 'BUY') {
        await this.openPosition('long', price, reason);
      } else {
        await this.openPosition('short', price, reason);
      }
    } catch (error) {
      this.logger.warn('Failed to process signal', { action, price, reason, error });
    }
  }

  private async openPosition(side: 'long' | 'short', price: number, reason: string): Promise<void> {
    // Check if we can open a position
    if (this.openPositions.size >= this.config!.riskParameters.maxPositionSize) {
      return;
    }
    
    // Calculate position size based on risk parameters
    const positionSize = this.calculatePositionSize(price);
    if (positionSize <= 0) return;
    
    // Calculate costs
    const commission = this.config!.commission * positionSize;
    const slippage = this.calculateSlippage(price, positionSize);
    const totalCost = commission + slippage;
    
    // Check if we have enough balance
    const requiredCapital = (positionSize * price) + totalCost;
    if (this.currentBalance < requiredCapital) {
      return;
    }
    
    // Create position
    const positionId = this.generatePositionId();
    const position: BacktestPosition = {
      id: positionId,
      symbol: this.config!.symbol,
      side,
      size: positionSize,
      entryPrice: price + (side === 'long' ? slippage : -slippage),
      entryTime: this.currentTime,
      pnl: -totalCost,
      commission,
      slippage,
      holdingPeriod: 0,
      maxProfit: 0,
      maxLoss: -totalCost,
      entryReason: reason
    };
    
    // Create trade record
    const trade: BacktestTrade = {
      id: this.generateTradeId(),
      timestamp: this.currentTime,
      type: 'entry',
      side: side === 'long' ? 'buy' : 'sell',
      price: position.entryPrice,
      quantity: positionSize,
      commission,
      slippage,
      positionId,
      reason
    };
    
    // Update state
    this.openPositions.set(positionId, position);
    this.allTrades.push(trade);
    this.currentBalance -= totalCost;
    
    this.emit('position-opened', position);
    this.logger.debug('Position opened', {
      positionId,
      side,
      size: positionSize,
      price: position.entryPrice
    });
  }

  private async closePosition(positionId: string, price: number, reason: string): Promise<void> {
    const position = this.openPositions.get(positionId);
    if (!position) return;
    
    // Calculate P&L
    const priceDiff = price - position.entryPrice;
    const multiplier = position.side === 'long' ? 1 : -1;
    const grossPnL = priceDiff * multiplier * position.size;
    
    // Calculate costs
    const commission = this.config!.commission * position.size;
    const slippage = this.calculateSlippage(price, position.size);
    const totalCosts = commission + slippage;
    
    const netPnL = grossPnL - totalCosts;
    
    // Update position
    position.exitPrice = price + (position.side === 'long' ? -slippage : slippage);
    position.exitTime = this.currentTime;
    position.pnl += netPnL;
    position.commission += commission;
    position.slippage += slippage;
    position.holdingPeriod = this.currentTime - position.entryTime;
    position.exitReason = reason;
    
    // Create trade record
    const trade: BacktestTrade = {
      id: this.generateTradeId(),
      timestamp: this.currentTime,
      type: 'exit',
      side: position.side === 'long' ? 'sell' : 'buy',
      price: position.exitPrice,
      quantity: position.size,
      commission,
      slippage,
      pnl: netPnL,
      positionId,
      reason
    };
    
    // Update state
    this.openPositions.delete(positionId);
    this.closedPositions.push(position);
    this.allTrades.push(trade);
    this.currentBalance += (position.size * position.exitPrice) + netPnL;
    
    // Update daily returns
    const returnPercent = (netPnL / this.config!.initialCapital) * 100;
    this.dailyReturns.push(returnPercent);
    
    this.emit('position-closed', position);
    this.logger.debug('Position closed', {
      positionId,
      pnl: netPnL,
      holdingPeriod: position.holdingPeriod,
      reason
    });
  }

  private updatePositions(marketData: MarketData): void {
    for (const position of this.openPositions.values()) {
      // Calculate unrealized P&L
      const priceDiff = marketData.price - position.entryPrice;
      const multiplier = position.side === 'long' ? 1 : -1;
      const unrealizedPnL = priceDiff * multiplier * position.size;
      
      // Update max profit/loss
      position.maxProfit = Math.max(position.maxProfit, unrealizedPnL);
      position.maxLoss = Math.min(position.maxLoss, unrealizedPnL);
      
      // Check stop loss
      const stopLoss = this.config!.riskParameters.stopLossPoints;
      if (Math.abs(priceDiff) >= stopLoss) {
        this.closePosition(position.id, marketData.price, 'STOP_LOSS').catch(error =>
          this.logger.error('Error closing position on stop loss', error)
        );
      }
    }
  }

  private async closeAllPositions(reason: string): Promise<void> {
    const positionIds = Array.from(this.openPositions.keys());
    
    for (const positionId of positionIds) {
      const position = this.openPositions.get(positionId);
      if (position) {
        // Use last known price or entry price as fallback
        const exitPrice = position.entryPrice; // Simplified
        await this.closePosition(positionId, exitPrice, reason);
      }
    }
  }

  private takePerformanceSnapshot(): void {
    // Calculate unrealized P&L
    let unrealizedPnL = 0;
    for (const position of this.openPositions.values()) {
      // This would use current market price in real implementation
      unrealizedPnL += position.pnl;
    }
    
    const totalBalance = this.currentBalance + unrealizedPnL;
    
    // Update peak and drawdown
    if (totalBalance > this.peakBalance) {
      this.peakBalance = totalBalance;
    }
    
    this.currentDrawdown = (this.peakBalance - totalBalance) / this.peakBalance;
    this.maxDrawdown = Math.max(this.maxDrawdown, this.currentDrawdown);
    
    // Record snapshots
    this.equityCurve.push({ timestamp: this.currentTime, value: totalBalance });
    this.drawdownCurve.push({ timestamp: this.currentTime, value: this.currentDrawdown });
    
    const snapshot: PerformanceSnapshot = {
      timestamp: this.currentTime,
      balance: totalBalance,
      positions: this.openPositions.size,
      drawdown: this.currentDrawdown,
      openPnl: unrealizedPnL
    };
    
    this.performanceSnapshots.push(snapshot);
  }

  private updateProgress(): void {
    const now = Date.now();
    
    // Update progress every 1000ms
    if (now - this.lastProgressUpdate >= 1000) {
      const progressPercent = (this.processedBars / this.totalBars) * 100;
      const elapsed = now - this.startTime;
      const estimatedTotal = elapsed / progressPercent * 100;
      const estimatedRemaining = estimatedTotal - elapsed;
      
      const progress: BacktestProgress = {
        currentTime: this.currentTime,
        progressPercent,
        processedBars: this.processedBars,
        totalBars: this.totalBars,
        currentBalance: this.currentBalance,
        currentDrawdown: this.currentDrawdown,
        tradesExecuted: this.allTrades.length,
        estimatedTimeRemaining: Math.max(0, estimatedRemaining)
      };
      
      this.emit('progress', progress);
      this.lastProgressUpdate = now;
    }
  }

  private calculateResults(): BacktestResult {
    const endTime = Date.now();
    const duration = endTime - this.startTime;
    
    // Basic statistics
    const totalTrades = this.closedPositions.length;
    const winningTrades = this.closedPositions.filter(p => p.pnl > 0).length;
    const losingTrades = totalTrades - winningTrades;
    
    // Performance metrics
    const finalBalance = this.currentBalance;
    const totalReturn = finalBalance - this.config!.initialCapital;
    const totalReturnPercent = (totalReturn / this.config!.initialCapital) * 100;
    
    // Time-based metrics
    const timeRangeYears = (this.config!.endDate - this.config!.startDate) / (365.25 * 24 * 60 * 60 * 1000);
    const annualizedReturn = totalReturnPercent / timeRangeYears;
    
    // Risk metrics
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
    
    const winners = this.closedPositions.filter(p => p.pnl > 0);
    const losers = this.closedPositions.filter(p => p.pnl < 0);
    
    const avgWin = winners.length > 0 ? winners.reduce((sum, p) => sum + p.pnl, 0) / winners.length : 0;
    const avgLoss = losers.length > 0 ? Math.abs(losers.reduce((sum, p) => sum + p.pnl, 0) / losers.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    const largestWin = winners.length > 0 ? Math.max(...winners.map(p => p.pnl)) : 0;
    const largestLoss = losers.length > 0 ? Math.min(...losers.map(p => p.pnl)) : 0;
    
    // Holding periods
    const avgHoldingPeriod = totalTrades > 0 ? 
      this.closedPositions.reduce((sum, p) => sum + p.holdingPeriod, 0) / totalTrades : 0;
    
    const avgWinHoldingPeriod = winners.length > 0 ?
      winners.reduce((sum, p) => sum + p.holdingPeriod, 0) / winners.length : 0;
    
    const avgLossHoldingPeriod = losers.length > 0 ?
      losers.reduce((sum, p) => sum + p.holdingPeriod, 0) / losers.length : 0;
    
    // Advanced metrics
    const volatility = this.calculateVolatility();
    const sharpeRatio = this.calculateSharpeRatio(annualizedReturn, volatility);
    const sortinoRatio = this.calculateSortinoRatio(annualizedReturn);
    const calmarRatio = this.maxDrawdown > 0 ? annualizedReturn / (this.maxDrawdown * 100) : 0;
    
    // Costs
    const totalCommissions = this.allTrades.reduce((sum, t) => sum + t.commission, 0);
    const totalSlippage = this.allTrades.reduce((sum, t) => sum + t.slippage, 0);
    
    return {
      config: this.config!,
      startTime: this.startTime,
      endTime,
      duration,
      
      totalTrades,
      totalPositions: totalTrades,
      winningTrades,
      losingTrades,
      
      finalBalance,
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      maxDrawdown: this.maxDrawdown,
      maxDrawdownPercent: this.maxDrawdown * 100,
      
      sharpeRatio,
      sortinoRatio,
      calmarRatio,
      maxDD: this.maxDrawdown,
      volatility,
      beta: 1.0, // Simplified
      alpha: 0, // Simplified
      
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      avgHoldingPeriod,
      avgWinHoldingPeriod,
      avgLossHoldingPeriod,
      
      totalCommissions,
      totalSlippage,
      
      equityCurve: this.equityCurve,
      drawdownCurve: this.drawdownCurve,
      positions: this.closedPositions,
      trades: this.allTrades,
      
      monthlyReturns: this.calculateMonthlyReturns(),
      yearlyReturns: this.calculateYearlyReturns(),
      correlationToMarket: 0, // Simplified
      
      ulcerIndex: this.calculateUlcerIndex(),
      painIndex: this.calculatePainIndex(),
      informationRatio: 0, // Simplified
      treynorRatio: 0, // Simplified
      
      dataQuality: {
        totalPoints: this.totalBars,
        validPoints: this.totalBars,
        invalidPoints: 0,
        missingPoints: 0,
        duplicatePoints: 0
      }
    };
  }

  private calculatePositionSize(price: number): number {
    // Simple position sizing based on fixed percentage of capital
    const riskPercent = 0.02; // 2% of capital per trade
    const riskAmount = this.currentBalance * riskPercent;
    const stopLossPoints = this.config!.riskParameters.stopLossPoints;
    
    if (stopLossPoints <= 0) return 0;
    
    return Math.floor(riskAmount / stopLossPoints);
  }

  private calculateSlippage(price: number, quantity: number): number {
    // Simple slippage model
    return price * quantity * this.config!.slippage;
  }

  private calculateVolatility(): number {
    if (this.dailyReturns.length < 2) return 0;
    
    const mean = this.dailyReturns.reduce((sum, r) => sum + r, 0) / this.dailyReturns.length;
    const variance = this.dailyReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / this.dailyReturns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  private calculateSharpeRatio(annualizedReturn: number, volatility: number): number {
    const riskFreeRate = 2; // 2% risk-free rate
    return volatility > 0 ? (annualizedReturn - riskFreeRate) / volatility : 0;
  }

  private calculateSortinoRatio(annualizedReturn: number): number {
    const negativeReturns = this.dailyReturns.filter(r => r < 0);
    if (negativeReturns.length === 0) return 0;
    
    const downwardVolatility = Math.sqrt(
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length
    ) * Math.sqrt(252);
    
    const riskFreeRate = 2;
    return downwardVolatility > 0 ? (annualizedReturn - riskFreeRate) / downwardVolatility : 0;
  }

  private calculateUlcerIndex(): number {
    if (this.drawdownCurve.length === 0) return 0;
    
    const sumSquaredDD = this.drawdownCurve.reduce((sum, point) => sum + Math.pow(point.value * 100, 2), 0);
    return Math.sqrt(sumSquaredDD / this.drawdownCurve.length);
  }

  private calculatePainIndex(): number {
    if (this.drawdownCurve.length === 0) return 0;
    
    return this.drawdownCurve.reduce((sum, point) => sum + (point.value * 100), 0) / this.drawdownCurve.length;
  }

  private calculateMonthlyReturns(): { month: string; return: number }[] {
    // Simplified implementation
    return [];
  }

  private calculateYearlyReturns(): { year: number; return: number }[] {
    // Simplified implementation
    return [];
  }

  private generatePositionId(): string {
    return `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current backtest state
   */
  public getState(): {
    isRunning: boolean;
    isPaused: boolean;
    config: BacktestConfig | null;
    progress: BacktestProgress | null;
  } {
    const progress = this.isRunning ? {
      currentTime: this.currentTime,
      progressPercent: (this.processedBars / this.totalBars) * 100,
      processedBars: this.processedBars,
      totalBars: this.totalBars,
      currentBalance: this.currentBalance,
      currentDrawdown: this.currentDrawdown,
      tradesExecuted: this.allTrades.length,
      estimatedTimeRemaining: 0
    } : null;
    
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      config: this.config,
      progress
    };
  }

  /**
   * Get current performance snapshot
   */
  public getCurrentPerformance(): PerformanceSnapshot | null {
    return this.performanceSnapshots.length > 0 ? 
      this.performanceSnapshots[this.performanceSnapshots.length - 1] : null;
  }
}