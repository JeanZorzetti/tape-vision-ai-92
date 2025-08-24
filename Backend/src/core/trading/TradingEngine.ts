/**
 * Core Trading Engine - Advanced Tape Reading System
 * High-performance algorithmic trading engine focused on order flow analysis
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import { 
  MarketData, 
  TapeEntry, 
  OrderBook, 
  DecisionAnalysis, 
  AIStatus, 
  TradeEntry,
  Position,
  RiskParameters,
  TradingConfig,
  PatternMatch,
  LiquidityAnalysis
} from '@/types/trading';
import { TapeReader } from './TapeReader';
import { OrderFlowAnalyzer } from './OrderFlowAnalyzer';
import { RiskManager } from '../risk/RiskManager';
import { PatternRecognizer } from '../patterns/PatternRecognizer';
import { SignalGenerator } from '../analysis/SignalGenerator';

export class TradingEngine extends EventEmitter {
  private logger: Logger;
  private tapeReader: TapeReader;
  private orderFlowAnalyzer: OrderFlowAnalyzer;
  private riskManager: RiskManager;
  private patternRecognizer: PatternRecognizer;
  private signalGenerator: SignalGenerator;
  
  private isActive: boolean = false;
  private currentPosition: Position | null = null;
  private marketData: MarketData | null = null;
  private orderBook: OrderBook | null = null;
  private tapeEntries: TapeEntry[] = [];
  
  private config: TradingConfig;
  private aiStatus: AIStatus;
  private lastDecisionAnalysis: DecisionAnalysis | null = null;
  
  // Performance metrics
  private processedTicks: number = 0;
  private lastProcessingTime: number = 0;
  private averageLatency: number = 0;
  
  // Trading state
  private dailyPnL: number = 0;
  private tradesCount: number = 0;
  private consecutiveStops: number = 0;
  private sessionStartTime: number = Date.now();

  constructor(
    config: TradingConfig,
    logger: Logger
  ) {
    super();
    
    this.config = config;
    this.logger = logger.child({ component: 'TradingEngine' });
    
    this.initializeComponents();
    this.setupEventHandlers();
    this.initializeAIStatus();
    
    this.logger.info('Trading Engine initialized', {
      symbol: config.symbol,
      timeframe: config.timeframe,
      confidenceThreshold: config.analysisSettings.confidenceThreshold
    });
  }

  private initializeComponents(): void {
    this.tapeReader = new TapeReader(this.config, this.logger);
    this.orderFlowAnalyzer = new OrderFlowAnalyzer();
    this.riskManager = new RiskManager(this.config.riskParameters, this.logger);
    this.patternRecognizer = new PatternRecognizer();
    this.signalGenerator = new SignalGenerator();
  }

  private setupEventHandlers(): void {
    this.tapeReader.on('pattern-detected', this.onPatternDetected.bind(this));
    this.orderFlowAnalyzer.on('flow-change', this.onFlowChange.bind(this));
    this.riskManager.on('risk-alert', this.onRiskAlert.bind(this));
    this.signalGenerator.on('signal-generated', this.onSignalGenerated.bind(this));
  }

  private initializeAIStatus(): void {
    this.aiStatus = {
      confidence: 0,
      status: 'paused',
      lastAnalysis: new Date().toLocaleTimeString('pt-BR'),
      patternsDetected: [],
      marketContext: 'Sistema inicializando...',
      entrySignals: 0,
      aggressionLevel: 'low',
      hiddenLiquidity: false,
      processingLatency: 0,
      memoryUsage: 0
    };
  }

  /**
   * Start the trading engine
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting trading engine');
      
      // Initialize all components
      await this.tapeReader.initialize();
      await this.orderFlowAnalyzer.initialize();
      await this.riskManager.initialize();
      await this.patternRecognizer.initialize();
      
      this.isActive = true;
      this.aiStatus.status = 'active';
      this.sessionStartTime = Date.now();
      
      this.emit('engine-started');
      this.logger.info('Trading engine started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start trading engine', error);
      this.aiStatus.status = 'error';
      throw error;
    }
  }

  /**
   * Stop the trading engine
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping trading engine');
      
      this.isActive = false;
      this.aiStatus.status = 'paused';
      
      // Close any open positions
      if (this.currentPosition) {
        await this.closePosition('EMERGENCY_STOP');
      }
      
      this.emit('engine-stopped');
      this.logger.info('Trading engine stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping trading engine', error);
      throw error;
    }
  }

  /**
   * Process new market data
   */
  public async processMarketData(data: MarketData): Promise<void> {
    if (!this.isActive) return;
    
    const startTime = Date.now();
    
    try {
      this.marketData = data;
      this.processedTicks++;
      
      // Update AI status
      this.aiStatus.lastAnalysis = new Date(data.timestamp).toLocaleTimeString('pt-BR');
      this.updateSystemMetrics();
      
      // Process through tape reader
      await this.tapeReader.processTick(data);
      
      // Update order flow analysis
      if (this.orderBook) {
        this.orderFlowAnalyzer.updateAnalysis(data);
      }
      
      // Check for risk violations
      await this.riskManager.checkRisk(data, this.currentPosition, this.dailyPnL);
      
      // Generate market context
      this.updateMarketContext(data);
      
      // Emit updated status
      this.emit('market-data-processed', {
        data,
        aiStatus: this.aiStatus,
        position: this.currentPosition
      });
      
    } catch (error) {
      this.logger.error('Error processing market data', error);
      this.aiStatus.status = 'error';
    } finally {
      // Update processing latency
      const processingTime = Date.now() - startTime;
      this.lastProcessingTime = processingTime;
      this.averageLatency = (this.averageLatency + processingTime) / 2;
      this.aiStatus.processingLatency = this.averageLatency;
    }
  }

  /**
   * Process order book update
   */
  public async processOrderBook(orderBook: OrderBook): Promise<void> {
    if (!this.isActive) return;
    
    try {
      this.orderBook = orderBook;
      
      // Analyze liquidity
      const liquidityAnalysis = this.orderFlowAnalyzer.analyzeLiquidity(orderBook);
      this.aiStatus.hiddenLiquidity = liquidityAnalysis > 0.5;
      
      // Update spread and imbalance
      if (this.marketData) {
        this.marketData.spread = orderBook.spread;
        this.marketData.orderBookImbalance = this.calculateOrderBookImbalance(orderBook);
      }
      
      this.emit('order-book-updated', { orderBook, liquidityAnalysis });
      
    } catch (error) {
      this.logger.error('Error processing order book', error);
    }
  }

  /**
   * Process tape entries (time and sales)
   */
  public async processTapeEntries(entries: TapeEntry[]): Promise<void> {
    if (!this.isActive) return;
    
    try {
      this.tapeEntries.push(...entries);
      
      // Keep only recent entries (last 1000)
      if (this.tapeEntries.length > 1000) {
        this.tapeEntries = this.tapeEntries.slice(-1000);
      }
      
      // Process through tape reader
      for (const entry of entries) {
        await this.tapeReader.processTapeEntry(entry);
      }
      
      // Update aggression level
      this.updateAggressionLevel(entries);
      
      this.emit('tape-processed', { entries, totalEntries: this.tapeEntries.length });
      
    } catch (error) {
      this.logger.error('Error processing tape entries', error);
    }
  }

  private updateAggressionLevel(entries: TapeEntry[]): void {
    const recentEntries = entries.slice(-20); // Last 20 entries
    const largeOrders = recentEntries.filter(e => e.isLarge).length;
    const dominantOrders = recentEntries.filter(e => e.isDominant).length;
    
    if (dominantOrders > 5 || largeOrders > 8) {
      this.aiStatus.aggressionLevel = 'high';
    } else if (dominantOrders > 2 || largeOrders > 4) {
      this.aiStatus.aggressionLevel = 'medium';
    } else {
      this.aiStatus.aggressionLevel = 'low';
    }
  }

  private calculateOrderBookImbalance(orderBook: OrderBook): number {
    const totalBidVolume = orderBook.bids.reduce((sum, level) => sum + level.volume, 0);
    const totalAskVolume = orderBook.asks.reduce((sum, level) => sum + level.volume, 0);
    
    if (totalBidVolume + totalAskVolume === 0) return 0;
    
    return ((totalBidVolume - totalAskVolume) / (totalBidVolume + totalAskVolume)) * 100;
  }

  private updateMarketContext(data: MarketData): void {
    const contexts = [];
    
    // Price trend
    if (data.priceChange > 0) {
      contexts.push(`Mercado em alta (+${data.priceChange.toFixed(2)})`);
    } else if (data.priceChange < 0) {
      contexts.push(`Mercado em baixa (${data.priceChange.toFixed(2)})`);
    } else {
      contexts.push('Mercado lateral');
    }
    
    // Volume analysis
    if (data.volume > 10000) {
      contexts.push('volume elevado');
    } else if (data.volume > 5000) {
      contexts.push('volume médio');
    } else {
      contexts.push('volume baixo');
    }
    
    // Volatility
    if (data.volatility > 2.0) {
      contexts.push('alta volatilidade');
    } else if (data.volatility > 1.0) {
      contexts.push('volatilidade moderada');
    } else {
      contexts.push('baixa volatilidade');
    }
    
    // Liquidity
    contexts.push(`liquidez ${data.liquidityLevel}`);
    
    this.aiStatus.marketContext = contexts.join(', ') + '.';
  }

  private updateSystemMetrics(): void {
    // Update memory usage (simplified)
    const memUsage = process.memoryUsage();
    this.aiStatus.memoryUsage = Math.round(memUsage.heapUsed / 1024 / 1024);
  }

  private async onPatternDetected(pattern: PatternMatch): Promise<void> {
    this.logger.info('Pattern detected', { pattern });
    
    // Add to detected patterns
    this.aiStatus.patternsDetected.push(`${pattern.name} (${pattern.confidence.toFixed(1)}%)`);
    
    // Keep only last 5 patterns
    if (this.aiStatus.patternsDetected.length > 5) {
      this.aiStatus.patternsDetected = this.aiStatus.patternsDetected.slice(-5);
    }
    
    // Generate signal based on pattern
    this.signalGenerator.evaluatePattern(pattern);
  }

  private onFlowChange(flowData: LiquidityAnalysis): void {
    this.logger.debug('Order flow change detected', { flowData });
    
    // Update entry signals
    if (flowData.confidence > 0.8) {
      this.aiStatus.entrySignals = Math.min(this.aiStatus.entrySignals + 1, 5);
    }
  }

  private onRiskAlert(alert: { type: string; message: string; severity: 'warning' | 'critical' }): void {
    this.logger.warn('Risk alert triggered', alert);
    
    if (alert.severity === 'critical') {
      this.emergencyStop(alert.message);
    }
    
    this.emit('risk-alert', alert);
  }

  private async onSignalGenerated(signal: {
    action: 'BUY' | 'SELL' | 'WAIT';
    confidence: number;
    analysis: DecisionAnalysis;
  }): Promise<void> {
    
    this.logger.info('Signal generated', { 
      action: signal.action, 
      confidence: signal.confidence 
    });
    
    this.lastDecisionAnalysis = signal.analysis;
    this.aiStatus.confidence = signal.confidence;
    
    if (signal.action !== 'WAIT' && signal.confidence >= this.config.analysisSettings.confidenceThreshold) {
      await this.executeSignal({
        action: signal.action as 'BUY' | 'SELL',
        confidence: signal.confidence,
        analysis: signal.analysis
      });
    }
    
    this.emit('signal-generated', signal);
  }

  private async executeSignal(signal: { action: 'BUY' | 'SELL'; confidence: number; analysis: DecisionAnalysis }): Promise<void> {
    try {
      // Check if we can trade
      if (!this.canTrade()) {
        this.logger.warn('Trading blocked by risk management');
        return;
      }
      
      // Calculate position size
      const positionSize = await this.riskManager.calculatePositionSize(
        this.marketData!.price,
        signal.analysis.stopLoss
      );
      
      // Create trade entry
      const tradeEntry: TradeEntry = {
        id: this.generateTradeId(),
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        action: signal.action,
        symbol: this.config.symbol,
        price: this.marketData!.price,
        quantity: positionSize,
        confidence: signal.confidence,
        reason: signal.analysis.entryReason,
        status: 'pending'
      };
      
      // Execute trade (this would call the broker API)
      await this.executeTrade(tradeEntry);
      
    } catch (error) {
      this.logger.error('Error executing signal', error);
      this.aiStatus.status = 'error';
    }
  }

  private canTrade(): boolean {
    // Check daily loss limit
    if (this.dailyPnL <= -this.config.riskParameters.maxDailyLoss) {
      return false;
    }
    
    // Check consecutive stops
    if (this.consecutiveStops >= this.config.riskParameters.consecutiveStopLimit) {
      return false;
    }
    
    // Check if already in position
    if (this.currentPosition) {
      return false;
    }
    
    return true;
  }

  private async executeTrade(trade: TradeEntry): Promise<void> {
    // This would integrate with the actual broker API
    this.logger.info('Executing trade', { trade });
    
    // Simulate trade execution
    trade.status = 'success';
    trade.executionTime = Date.now();
    
    // Create position
    this.currentPosition = {
      id: trade.id,
      symbol: trade.symbol,
      side: trade.action === 'BUY' ? 'long' : 'short',
      size: trade.quantity!,
      entryPrice: trade.price!,
      currentPrice: trade.price!,
      pnl: 0,
      unrealizedPnl: 0,
      stopLoss: this.lastDecisionAnalysis!.stopLoss,
      takeProfit: this.lastDecisionAnalysis!.expectedTarget,
      entryTime: Date.now(),
      duration: 0
    };
    
    this.tradesCount++;
    
    this.emit('trade-executed', { trade, position: this.currentPosition });
  }

  private async closePosition(reason: string): Promise<void> {
    if (!this.currentPosition) return;
    
    // Calculate final PnL
    const pnl = this.calculatePositionPnL(this.currentPosition);
    this.dailyPnL += pnl;
    
    // Update consecutive stops
    if (pnl < 0) {
      this.consecutiveStops++;
    } else {
      this.consecutiveStops = 0;
    }
    
    const tradeEntry: TradeEntry = {
      id: this.generateTradeId(),
      timestamp: new Date().toLocaleTimeString('pt-BR'),
      action: this.currentPosition.side === 'long' ? 'SELL' : 'BUY',
      symbol: this.currentPosition.symbol,
      price: this.marketData!.price,
      quantity: this.currentPosition.size,
      reason: reason,
      pnl: pnl,
      status: 'success'
    };
    
    this.logger.info('Position closed', { 
      position: this.currentPosition, 
      pnl, 
      reason 
    });
    
    this.currentPosition = null;
    
    this.emit('position-closed', { trade: tradeEntry, pnl });
  }

  private calculatePositionPnL(position: Position): number {
    if (!this.marketData) return 0;
    
    const priceDiff = this.marketData.price - position.entryPrice;
    const multiplier = position.side === 'long' ? 1 : -1;
    
    return priceDiff * multiplier * position.size;
  }

  public emergencyStop(reason: string): void {
    this.logger.warn('Emergency stop triggered', { reason });
    
    this.isActive = false;
    this.aiStatus.status = 'error';
    
    // Close position if exists
    if (this.currentPosition) {
      this.closePosition(`EMERGENCY: ${reason}`);
    }
    
    this.emit('emergency-stop', { reason });
  }

  private generateTradeId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Getters for current state
  public getAIStatus(): AIStatus {
    return { ...this.aiStatus };
  }

  public getLastDecisionAnalysis(): DecisionAnalysis | null {
    return this.lastDecisionAnalysis ? { ...this.lastDecisionAnalysis } : null;
  }

  public getCurrentPosition(): Position | null {
    return this.currentPosition ? { ...this.currentPosition } : null;
  }

  public getDailyPnL(): number {
    return this.dailyPnL;
  }

  public getTradesCount(): number {
    return this.tradesCount;
  }

  public isEngineActive(): boolean {
    return this.isActive;
  }
}