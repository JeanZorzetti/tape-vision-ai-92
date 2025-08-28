/**
 * Price Engine - Advanced Real-Time Pricing and Valuation Engine
 * Handles price calculations, fair value estimation, and spread analysis
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  MarketData,
  OrderBook,
  TapeEntry,
  TradingError
} from '@/types/trading';

export interface PricePoint {
  timestamp: number;
  price: number;
  volume: number;
  source: 'market' | 'calculated' | 'interpolated';
  confidence: number;
}

export interface FairValueEstimate {
  timestamp: number;
  fairValue: number;
  confidence: number;
  spread: number;
  premium: number;
  discount: number;
  factors: FairValueFactors;
}

export interface FairValueFactors {
  midPoint: number;
  volumeWeightedPrice: number;
  timeWeightedPrice: number;
  orderBookImbalance: number;
  marketMomentum: number;
  liquidityPremium: number;
}

export interface SpreadAnalysis {
  timestamp: number;
  bidAskSpread: number;
  effectiveSpread: number;
  realizedSpread: number;
  priceImpact: number;
  marketWidth: number;
  liquidityScore: number;
}

export interface PriceStatistics {
  current: number;
  open: number;
  high: number;
  low: number;
  close: number;
  vwap: number;
  twap: number;
  volume: number;
  trades: number;
  volatility: number;
  returns: number[];
  beta: number;
}

export interface PricingModel {
  name: string;
  weight: number;
  calculate(data: ModelInputData): number;
  validate(result: number): boolean;
}

export interface ModelInputData {
  marketData: MarketData;
  orderBook?: OrderBook;
  recentTrades: TapeEntry[];
  historicalPrices: PricePoint[];
  volume: number;
  momentum: number;
}

export interface PriceEngineConfig {
  symbol: string;
  tickSize: number;
  maxHistoryMinutes: number;
  fairValueModels: string[];
  spreadAnalysisEnabled: boolean;
  outlierDetection: boolean;
  smoothingEnabled: boolean;
  confidenceThreshold: number;
  updateInterval: number;
}

export class PriceEngine extends EventEmitter {
  private logger: Logger;
  private config: PriceEngineConfig;
  
  // Price data storage
  private priceHistory: PricePoint[] = [];
  private currentPrice: PricePoint | null = null;
  private fairValueHistory: FairValueEstimate[] = [];
  private spreadHistory: SpreadAnalysis[] = [];
  
  // Statistical tracking
  private priceStatistics: PriceStatistics;
  private dailyHigh: number = 0;
  private dailyLow: number = Number.MAX_VALUE;
  private dailyOpen: number = 0;
  private sessionVolume: number = 0;
  private sessionTrades: number = 0;
  
  // Pricing models
  private pricingModels: Map<string, PricingModel> = new Map();
  
  // Real-time calculations
  private volumeSum: number = 0;
  private volumeWeightedSum: number = 0;
  private timeWeightedSum: number = 0;
  private timeWeightedDuration: number = 0;
  
  // Performance metrics
  private processingMetrics = {
    totalCalculations: 0,
    averageLatency: 0,
    errorCount: 0,
    outlierCount: 0
  };
  
  private isActive: boolean = false;
  private lastUpdate: number = 0;

  constructor(config: PriceEngineConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'PriceEngine' });
    
    // Initialize statistics
    this.priceStatistics = {
      current: 0,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      vwap: 0,
      twap: 0,
      volume: 0,
      trades: 0,
      volatility: 0,
      returns: [],
      beta: 1.0
    };
    
    this.initializePricingModels();
    
    this.logger.info('PriceEngine initialized', {
      symbol: config.symbol,
      tickSize: config.tickSize,
      models: config.fairValueModels
    });
  }

  /**
   * Start the price engine
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting PriceEngine');
      
      this.isActive = true;
      this.lastUpdate = Date.now();
      
      this.emit('engine-started');
      this.logger.info('PriceEngine started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start PriceEngine', error);
      throw error;
    }
  }

  /**
   * Stop the price engine
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping PriceEngine');
      
      this.isActive = false;
      
      this.emit('engine-stopped');
      this.logger.info('PriceEngine stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping PriceEngine', error);
      throw error;
    }
  }

  /**
   * Update with new market data
   */
  public async updatePrice(marketData: MarketData, orderBook?: OrderBook): Promise<void> {
    if (!this.isActive) return;
    
    const startTime = performance.now();
    
    try {
      // Create price point
      const pricePoint: PricePoint = {
        timestamp: marketData.timestamp,
        price: marketData.price,
        volume: marketData.volume,
        source: 'market',
        confidence: 1.0
      };
      
      // Validate price
      if (this.config.outlierDetection && this.isOutlier(pricePoint)) {
        this.processingMetrics.outlierCount++;
        this.logger.warn('Outlier price detected', { price: pricePoint.price });
        return;
      }
      
      // Store price point
      this.storePricePoint(pricePoint);
      
      // Update statistics
      this.updateStatistics(pricePoint);
      
      // Calculate fair value
      const fairValue = await this.calculateFairValue(marketData, orderBook);
      
      // Analyze spread if order book available
      if (orderBook && this.config.spreadAnalysisEnabled) {
        const spreadAnalysis = this.analyzeSpread(orderBook, marketData);
        this.storeSpreadAnalysis(spreadAnalysis);
      }
      
      // Update metrics
      const processingTime = performance.now() - startTime;
      this.updateProcessingMetrics(processingTime);
      
      this.emit('price-updated', {
        pricePoint,
        fairValue,
        statistics: this.priceStatistics
      });
      
    } catch (error) {
      this.logger.error('Error updating price', error);
      this.processingMetrics.errorCount++;
    }
  }

  /**
   * Process tape entries for price discovery
   */
  public async processTapeEntries(entries: TapeEntry[]): Promise<void> {
    if (!this.isActive || entries.length === 0) return;
    
    try {
      // Update volume-weighted calculations
      for (const entry of entries) {
        this.volumeSum += entry.volume;
        this.volumeWeightedSum += entry.price * entry.volume;
        
        this.sessionVolume += entry.volume;
        this.sessionTrades++;
        
        // Update daily high/low
        this.dailyHigh = Math.max(this.dailyHigh, entry.price);
        this.dailyLow = Math.min(this.dailyLow, entry.price);
      }
      
      // Update VWAP
      this.priceStatistics.vwap = this.volumeSum > 0 ? 
        this.volumeWeightedSum / this.volumeSum : this.priceStatistics.current;
      
      this.priceStatistics.volume = this.sessionVolume;
      this.priceStatistics.trades = this.sessionTrades;
      
      this.emit('tape-processed', {
        entries: entries.length,
        vwap: this.priceStatistics.vwap,
        volume: this.sessionVolume
      });
      
    } catch (error) {
      this.logger.error('Error processing tape entries', error);
    }
  }

  private initializePricingModels(): void {
    // Mid-point model
    this.pricingModels.set('midpoint', {
      name: 'Mid-Point',
      weight: 0.3,
      calculate: (data: ModelInputData) => {
        if (data.orderBook) {
          const bestBid = data.orderBook.bids[0]?.price || 0;
          const bestAsk = data.orderBook.asks[0]?.price || 0;
          return (bestBid + bestAsk) / 2;
        }
        return data.marketData.price;
      },
      validate: (result: number) => result > 0 && isFinite(result)
    });
    
    // Volume-weighted model
    this.pricingModels.set('vwap', {
      name: 'Volume Weighted Average Price',
      weight: 0.4,
      calculate: (data: ModelInputData) => {
        if (data.recentTrades.length === 0) return data.marketData.price;
        
        let volumeSum = 0;
        let volumeWeightedSum = 0;
        
        for (const trade of data.recentTrades.slice(-20)) {
          volumeSum += trade.volume;
          volumeWeightedSum += trade.price * trade.volume;
        }
        
        return volumeSum > 0 ? volumeWeightedSum / volumeSum : data.marketData.price;
      },
      validate: (result: number) => result > 0 && isFinite(result)
    });
    
    // Time-weighted model
    this.pricingModels.set('twap', {
      name: 'Time Weighted Average Price',
      weight: 0.2,
      calculate: (data: ModelInputData) => {
        if (data.historicalPrices.length === 0) return data.marketData.price;
        
        const recent = data.historicalPrices.slice(-10);
        const sum = recent.reduce((total, point) => total + point.price, 0);
        
        return recent.length > 0 ? sum / recent.length : data.marketData.price;
      },
      validate: (result: number) => result > 0 && isFinite(result)
    });
    
    // Momentum-adjusted model
    this.pricingModels.set('momentum', {
      name: 'Momentum Adjusted',
      weight: 0.1,
      calculate: (data: ModelInputData) => {
        const basePrice = data.marketData.price;
        const momentumAdjustment = data.momentum * this.config.tickSize;
        
        return basePrice + momentumAdjustment;
      },
      validate: (result: number) => result > 0 && isFinite(result)
    });
  }

  private async calculateFairValue(marketData: MarketData, orderBook?: OrderBook): Promise<FairValueEstimate> {
    const recentTrades = this.getRecentTrades(50);
    const historicalPrices = this.priceHistory.slice(-20);
    
    const modelInput: ModelInputData = {
      marketData,
      orderBook,
      recentTrades,
      historicalPrices,
      volume: this.sessionVolume,
      momentum: this.calculateMomentum()
    };
    
    let weightedSum = 0;
    let totalWeight = 0;
    const factors: FairValueFactors = {
      midPoint: 0,
      volumeWeightedPrice: 0,
      timeWeightedPrice: 0,
      orderBookImbalance: 0,
      marketMomentum: 0,
      liquidityPremium: 0
    };
    
    // Calculate using each model
    for (const [modelName, model] of this.pricingModels) {
      if (this.config.fairValueModels.includes(modelName)) {
        try {
          const modelPrice = model.calculate(modelInput);
          
          if (model.validate(modelPrice)) {
            weightedSum += modelPrice * model.weight;
            totalWeight += model.weight;
            
            // Store factor values
            switch (modelName) {
              case 'midpoint':
                factors.midPoint = modelPrice;
                break;
              case 'vwap':
                factors.volumeWeightedPrice = modelPrice;
                break;
              case 'twap':
                factors.timeWeightedPrice = modelPrice;
                break;
            }
          }
        } catch (error) {
          this.logger.warn(`Error in pricing model ${modelName}`, error);
        }
      }
    }
    
    const fairValue = totalWeight > 0 ? weightedSum / totalWeight : marketData.price;
    
    // Calculate additional factors
    if (orderBook) {
      factors.orderBookImbalance = this.calculateOrderBookImbalance(orderBook);
      factors.liquidityPremium = this.calculateLiquidityPremium(orderBook);
    }
    
    factors.marketMomentum = this.calculateMomentum();
    
    // Calculate confidence based on model agreement
    const confidence = this.calculateModelConfidence(fairValue, factors);
    
    const estimate: FairValueEstimate = {
      timestamp: Date.now(),
      fairValue,
      confidence,
      spread: Math.abs(fairValue - marketData.price),
      premium: Math.max(0, marketData.price - fairValue),
      discount: Math.max(0, fairValue - marketData.price),
      factors
    };
    
    this.storeFairValue(estimate);
    
    return estimate;
  }

  private analyzeSpread(orderBook: OrderBook, marketData: MarketData): SpreadAnalysis {
    const bestBid = orderBook.bids[0]?.price || 0;
    const bestAsk = orderBook.asks[0]?.price || 0;
    const midPoint = (bestBid + bestAsk) / 2;
    
    const bidAskSpread = bestAsk - bestBid;
    const effectiveSpread = 2 * Math.abs(marketData.price - midPoint);
    
    // Calculate price impact
    const priceImpact = this.calculatePriceImpact(orderBook);
    
    // Calculate market width (depth at different levels)
    const marketWidth = this.calculateMarketWidth(orderBook);
    
    // Calculate liquidity score
    const liquidityScore = this.calculateLiquidityScore(orderBook);
    
    return {
      timestamp: Date.now(),
      bidAskSpread,
      effectiveSpread,
      realizedSpread: effectiveSpread, // Simplified
      priceImpact,
      marketWidth,
      liquidityScore
    };
  }

  private calculateOrderBookImbalance(orderBook: OrderBook): number {
    const bidVolume = orderBook.bids.slice(0, 5).reduce((sum, level) => sum + level.volume, 0);
    const askVolume = orderBook.asks.slice(0, 5).reduce((sum, level) => sum + level.volume, 0);
    
    const totalVolume = bidVolume + askVolume;
    return totalVolume > 0 ? (bidVolume - askVolume) / totalVolume : 0;
  }

  private calculateLiquidityPremium(orderBook: OrderBook): number {
    const spread = orderBook.asks[0]?.price - orderBook.bids[0]?.price || 0;
    const avgSpread = this.getAverageSpread();
    
    return avgSpread > 0 ? (spread - avgSpread) / avgSpread : 0;
  }

  private calculateMomentum(): number {
    if (this.priceHistory.length < 10) return 0;
    
    const recent = this.priceHistory.slice(-10);
    const older = this.priceHistory.slice(-20, -10);
    
    if (older.length === 0) return 0;
    
    const recentAvg = recent.reduce((sum, p) => sum + p.price, 0) / recent.length;
    const olderAvg = older.reduce((sum, p) => sum + p.price, 0) / older.length;
    
    return (recentAvg - olderAvg) / olderAvg;
  }

  private calculatePriceImpact(orderBook: OrderBook): number {
    // Simplified price impact calculation
    const midPoint = (orderBook.bids[0]?.price + orderBook.asks[0]?.price) / 2;
    const depth = Math.min(orderBook.bids.length, orderBook.asks.length);
    
    if (depth < 3) return 1.0; // High impact for thin books
    
    return Math.max(0.1, 1.0 / depth);
  }

  private calculateMarketWidth(orderBook: OrderBook): number {
    const levels = Math.min(5, orderBook.bids.length, orderBook.asks.length);
    if (levels === 0) return 0;
    
    const highestBid = orderBook.bids[0]?.price || 0;
    const lowestAsk = orderBook.asks[0]?.price || 0;
    const widestBid = orderBook.bids[levels - 1]?.price || 0;
    const widestAsk = orderBook.asks[levels - 1]?.price || 0;
    
    return (widestAsk - widestBid) - (lowestAsk - highestBid);
  }

  private calculateLiquidityScore(orderBook: OrderBook): number {
    let score = 0;
    const maxLevels = 10;
    
    for (let i = 0; i < Math.min(maxLevels, orderBook.bids.length); i++) {
      score += orderBook.bids[i].volume * (1 - i / maxLevels);
    }
    
    for (let i = 0; i < Math.min(maxLevels, orderBook.asks.length); i++) {
      score += orderBook.asks[i].volume * (1 - i / maxLevels);
    }
    
    return score;
  }

  private calculateModelConfidence(fairValue: number, factors: FairValueFactors): number {
    const prices = [
      factors.midPoint,
      factors.volumeWeightedPrice,
      factors.timeWeightedPrice
    ].filter(p => p > 0);
    
    if (prices.length === 0) return 0.5;
    
    // Calculate standard deviation
    const mean = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    const normalizedStdDev = stdDev / mean;
    return Math.max(0.1, Math.min(1.0, 1 - normalizedStdDev * 10));
  }

  private isOutlier(pricePoint: PricePoint): boolean {
    if (this.priceHistory.length < 20) return false;
    
    const recent = this.priceHistory.slice(-20).map(p => p.price);
    const mean = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const variance = recent.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / recent.length;
    const stdDev = Math.sqrt(variance);
    
    // Consider outlier if more than 3 standard deviations away
    return Math.abs(pricePoint.price - mean) > 3 * stdDev;
  }

  private storePricePoint(pricePoint: PricePoint): void {
    this.priceHistory.push(pricePoint);
    this.currentPrice = pricePoint;
    
    // Keep only recent history
    const cutoffTime = Date.now() - (this.config.maxHistoryMinutes * 60000);
    this.priceHistory = this.priceHistory.filter(p => p.timestamp > cutoffTime);
  }

  private storeFairValue(estimate: FairValueEstimate): void {
    this.fairValueHistory.push(estimate);
    
    // Keep only recent estimates
    const cutoffTime = Date.now() - (this.config.maxHistoryMinutes * 60000);
    this.fairValueHistory = this.fairValueHistory.filter(f => f.timestamp > cutoffTime);
  }

  private storeSpreadAnalysis(analysis: SpreadAnalysis): void {
    this.spreadHistory.push(analysis);
    
    // Keep only recent analyses
    const cutoffTime = Date.now() - (this.config.maxHistoryMinutes * 60000);
    this.spreadHistory = this.spreadHistory.filter(s => s.timestamp > cutoffTime);
  }

  private updateStatistics(pricePoint: PricePoint): void {
    this.priceStatistics.current = pricePoint.price;
    
    if (this.dailyOpen === 0) {
      this.dailyOpen = pricePoint.price;
      this.priceStatistics.open = pricePoint.price;
    }
    
    this.priceStatistics.high = Math.max(this.priceStatistics.high, pricePoint.price);
    this.priceStatistics.low = this.priceStatistics.low === 0 ? 
      pricePoint.price : Math.min(this.priceStatistics.low, pricePoint.price);
    
    this.priceStatistics.close = pricePoint.price;
    
    // Update TWAP
    this.timeWeightedSum += pricePoint.price;
    this.timeWeightedDuration += 1;
    this.priceStatistics.twap = this.timeWeightedSum / this.timeWeightedDuration;
    
    // Update volatility and returns
    this.updateVolatilityMetrics();
  }

  private updateVolatilityMetrics(): void {
    if (this.priceHistory.length < 2) return;
    
    const returns = [];
    for (let i = 1; i < Math.min(this.priceHistory.length, 50); i++) {
      const currentPrice = this.priceHistory[i].price;
      const previousPrice = this.priceHistory[i - 1].price;
      
      if (previousPrice > 0) {
        returns.push((currentPrice - previousPrice) / previousPrice);
      }
    }
    
    this.priceStatistics.returns = returns;
    
    if (returns.length > 1) {
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      this.priceStatistics.volatility = Math.sqrt(variance) * Math.sqrt(252); // Annualized
    }
  }

  private updateProcessingMetrics(processingTime: number): void {
    this.processingMetrics.totalCalculations++;
    this.processingMetrics.averageLatency = 
      (this.processingMetrics.averageLatency + processingTime) / 2;
  }

  private getRecentTrades(count: number = 50): TapeEntry[] {
    // This would be populated by tape entries
    // For now, return empty array
    return [];
  }

  private getAverageSpread(): number {
    if (this.spreadHistory.length === 0) return 0;
    
    const recent = this.spreadHistory.slice(-20);
    return recent.reduce((sum, s) => sum + s.bidAskSpread, 0) / recent.length;
  }

  /**
   * Get current fair value
   */
  public getCurrentFairValue(): FairValueEstimate | null {
    return this.fairValueHistory.length > 0 ? 
      this.fairValueHistory[this.fairValueHistory.length - 1] : null;
  }

  /**
   * Get current price statistics
   */
  public getPriceStatistics(): PriceStatistics {
    return { ...this.priceStatistics };
  }

  /**
   * Get recent spread analysis
   */
  public getSpreadAnalysis(count: number = 10): SpreadAnalysis[] {
    return this.spreadHistory.slice(-count);
  }

  /**
   * Get fair value history
   */
  public getFairValueHistory(minutes: number = 60): FairValueEstimate[] {
    const cutoffTime = Date.now() - (minutes * 60000);
    return this.fairValueHistory.filter(f => f.timestamp > cutoffTime);
  }

  /**
   * Get price history
   */
  public getPriceHistory(minutes: number = 60): PricePoint[] {
    const cutoffTime = Date.now() - (minutes * 60000);
    return this.priceHistory.filter(p => p.timestamp > cutoffTime);
  }

  /**
   * Get processing metrics
   */
  public getProcessingMetrics() {
    return { ...this.processingMetrics };
  }

  /**
   * Reset daily statistics
   */
  public resetDaily(): void {
    this.dailyHigh = 0;
    this.dailyLow = Number.MAX_VALUE;
    this.dailyOpen = 0;
    this.sessionVolume = 0;
    this.sessionTrades = 0;
    this.volumeSum = 0;
    this.volumeWeightedSum = 0;
    this.timeWeightedSum = 0;
    this.timeWeightedDuration = 0;
    
    this.priceStatistics.open = 0;
    this.priceStatistics.high = 0;
    this.priceStatistics.low = 0;
    this.priceStatistics.volume = 0;
    this.priceStatistics.trades = 0;
    
    this.logger.info('Daily statistics reset');
  }

  /**
   * Check if engine is ready
   */
  public isReady(): boolean {
    return this.isActive && this.currentPrice !== null;
  }
}