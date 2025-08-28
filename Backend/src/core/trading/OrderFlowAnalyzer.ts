/**
 * Order Flow Analyzer - Advanced Order Flow Analysis
 * Sophisticated analysis of market microstructure and order flow dynamics
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  MarketData,
  OrderBook,
  TapeEntry,
  LiquidityAnalysis,
  OrderFlowMetrics,
  VolumeProfile,
  OrderBookLevel,
  FlowDirection,
  AbsorptionLevel
} from '@/types/trading';

export interface OrderFlowData {
  aggression: number;
  absorption: boolean;
  hiddenLiquidity: number;
  volumeProfile: VolumeProfile[];
  imbalanceRatio: number;
  liquidityGaps: PriceLevel[];
  dominantFlow: FlowDirection;
  confidence: number;
}

export interface PriceLevel {
  price: number;
  bidVolume: number;
  askVolume: number;
  imbalance: number;
  significance: number;
  timestamp: number;
}

export interface FlowAnalysisResult {
  buyFlow: number;
  sellFlow: number;
  netFlow: number;
  momentum: number;
  acceleration: number;
  confidence: number;
  quality: 'high' | 'medium' | 'low';
}

export interface LiquidityProfile {
  totalLiquidity: number;
  bidLiquidity: number;
  askLiquidity: number;
  hiddenEstimate: number;
  depth: number;
  spread: number;
  resilience: number;
}

export interface MarketMicrostructure {
  tickDirection: 1 | -1 | 0;
  effectiveSpread: number;
  priceImpact: number;
  marketImpact: number;
  temporaryImpact: number;
  permanentImpact: number;
  orderBookPressure: number;
}

export class OrderFlowAnalyzer extends EventEmitter {
  private logger: Logger;
  
  // Analysis state
  private recentTicks: MarketData[] = [];
  private recentTapes: TapeEntry[] = [];
  private orderBookHistory: OrderBook[] = [];
  private volumeProfile: Map<number, VolumeProfile> = new Map();
  
  // Flow tracking
  private buyFlowBuffer: number[] = [];
  private sellFlowBuffer: number[] = [];
  private aggressionHistory: number[] = [];
  private liquidityHistory: number[] = [];
  
  // Analysis parameters
  private readonly FLOW_WINDOW_SIZE = 50;
  private readonly AGGRESSION_THRESHOLD = 0.7;
  private readonly HIDDEN_LIQUIDITY_THRESHOLD = 0.3;
  private readonly VOLUME_SIGNIFICANCE_THRESHOLD = 100;
  private readonly PRICE_PRECISION = 0.25;
  private readonly MAX_HISTORY_SIZE = 1000;
  
  // Metrics tracking
  private flowMetrics: OrderFlowMetrics = {
    totalVolume: 0,
    buyVolume: 0,
    sellVolume: 0,
    aggressiveBuyVolume: 0,
    aggressiveSellVolume: 0,
    passiveBuyVolume: 0,
    passiveSellVolume: 0,
    averageTradeSize: 0,
    largeTradeRatio: 0,
    smallTradeRatio: 0,
    buyTradeCount: 0,
    sellTradeCount: 0,
    netOrderFlow: 0,
    flowMomentum: 0,
    flowAcceleration: 0,
    lastUpdate: Date.now()
  };

  constructor(logger: Logger) {
    super();
    this.logger = logger.child({ component: 'OrderFlowAnalyzer' });
    
    this.logger.info('OrderFlowAnalyzer initialized with parameters', {
      flowWindowSize: this.FLOW_WINDOW_SIZE,
      aggressionThreshold: this.AGGRESSION_THRESHOLD,
      pricePrecision: this.PRICE_PRECISION
    });
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing OrderFlowAnalyzer');
    
    // Clear all historical data
    this.recentTicks = [];
    this.recentTapes = [];
    this.orderBookHistory = [];
    this.volumeProfile.clear();
    
    // Reset flow tracking
    this.buyFlowBuffer = [];
    this.sellFlowBuffer = [];
    this.aggressionHistory = [];
    this.liquidityHistory = [];
    
    // Reset metrics
    this.resetFlowMetrics();
    
    this.logger.info('OrderFlowAnalyzer initialized successfully');
  }

  /**
   * Update analysis with new market data
   */
  public updateAnalysis(marketData: MarketData): void {
    try {
      // Store market data
      this.storeMarketData(marketData);
      
      // Analyze flow characteristics
      this.analyzeFlowCharacteristics(marketData);
      
      // Update volume profile
      this.updateVolumeProfile(marketData);
      
      // Calculate market microstructure metrics
      const microstructure = this.calculateMicrostructure(marketData);
      
      // Emit flow analysis update
      this.emit('flow-analysis-updated', {
        marketData,
        flowMetrics: this.getFlowMetrics(),
        microstructure
      });
      
    } catch (error) {
      this.logger.error('Error updating flow analysis', error);
    }
  }

  /**
   * Process order book update
   */
  public processOrderBook(orderBook: OrderBook): void {
    try {
      // Store order book
      this.storeOrderBook(orderBook);
      
      // Analyze liquidity
      const liquidityAnalysis = this.analyzeLiquidity(orderBook);
      
      // Detect liquidity gaps
      const liquidityGaps = this.detectLiquidityGaps(orderBook);
      
      // Calculate order book imbalance
      const imbalance = this.calculateOrderBookImbalance(orderBook);
      
      // Emit liquidity analysis
      this.emit('liquidity-analysis', {
        orderBook,
        analysis: liquidityAnalysis,
        gaps: liquidityGaps,
        imbalance
      });
      
    } catch (error) {
      this.logger.error('Error processing order book', error);
    }
  }

  /**
   * Process tape entries for flow analysis
   */
  public processTapeEntries(entries: TapeEntry[]): void {
    try {
      // Store tape entries
      this.storeTapeEntries(entries);
      
      // Analyze each entry
      entries.forEach(entry => {
        this.analyzeTapeEntry(entry);
      });
      
      // Calculate flow analysis
      const flowAnalysis = this.calculateFlowAnalysis();
      
      // Update aggression metrics
      this.updateAggressionMetrics(entries);
      
      // Emit flow change if significant
      if (flowAnalysis.confidence > 0.7) {
        this.emit('flow-change', flowAnalysis);
      }
      
    } catch (error) {
      this.logger.error('Error processing tape entries', error);
    }
  }

  /**
   * Analyze liquidity levels in order book
   */
  public analyzeLiquidity(orderBook: OrderBook): number {
    if (!orderBook || !orderBook.bids.length || !orderBook.asks.length) {
      return 0;
    }
    
    try {
      // Calculate bid/ask liquidity
      const bidLiquidity = this.calculateSideLiquidity(orderBook.bids);
      const askLiquidity = this.calculateSideLiquidity(orderBook.asks);
      
      // Calculate total available liquidity
      const totalLiquidity = bidLiquidity + askLiquidity;
      
      // Normalize liquidity score (0-1)
      const liquidityScore = Math.min(1, totalLiquidity / 10000); // Normalize to reasonable range
      
      // Store in history for trend analysis
      this.liquidityHistory.push(liquidityScore);
      if (this.liquidityHistory.length > this.FLOW_WINDOW_SIZE) {
        this.liquidityHistory = this.liquidityHistory.slice(-this.FLOW_WINDOW_SIZE);
      }
      
      return liquidityScore;
      
    } catch (error) {
      this.logger.error('Error analyzing liquidity', error);
      return 0;
    }
  }

  /**
   * Comprehensive order flow analysis
   */
  public analyzeFlow(marketData: MarketData, orderBook?: OrderBook, tapeEntries?: TapeEntry[]): OrderFlowData {
    try {
      // Calculate aggression level
      const aggression = this.calculateAggressionLevel();
      
      // Detect absorption patterns
      const absorption = this.detectAbsorption();
      
      // Estimate hidden liquidity
      const hiddenLiquidity = this.estimateHiddenLiquidity(orderBook);
      
      // Generate volume profile
      const volumeProfile = this.generateVolumeProfile();
      
      // Calculate order book imbalance
      const imbalanceRatio = orderBook ? this.calculateOrderBookImbalance(orderBook) : 0;
      
      // Detect liquidity gaps
      const liquidityGaps = orderBook ? this.detectLiquidityGaps(orderBook) : [];
      
      // Determine dominant flow direction
      const dominantFlow = this.getDominantFlow();
      
      // Calculate overall confidence
      const confidence = this.calculateFlowConfidence();
      
      return {
        aggression,
        absorption,
        hiddenLiquidity,
        volumeProfile,
        imbalanceRatio,
        liquidityGaps,
        dominantFlow,
        confidence
      };
      
    } catch (error) {
      this.logger.error('Error analyzing flow', error);
      
      return {
        aggression: 0,
        absorption: false,
        hiddenLiquidity: 0,
        volumeProfile: [],
        imbalanceRatio: 0,
        liquidityGaps: [],
        dominantFlow: 'neutral',
        confidence: 0
      };
    }
  }

  private storeMarketData(data: MarketData): void {
    this.recentTicks.push(data);
    if (this.recentTicks.length > this.MAX_HISTORY_SIZE) {
      this.recentTicks = this.recentTicks.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  private storeOrderBook(orderBook: OrderBook): void {
    this.orderBookHistory.push(orderBook);
    if (this.orderBookHistory.length > 100) { // Keep last 100 order book snapshots
      this.orderBookHistory = this.orderBookHistory.slice(-100);
    }
  }

  private storeTapeEntries(entries: TapeEntry[]): void {
    this.recentTapes.push(...entries);
    if (this.recentTapes.length > this.MAX_HISTORY_SIZE) {
      this.recentTapes = this.recentTapes.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  private analyzeFlowCharacteristics(marketData: MarketData): void {
    // Estimate buy/sell flow based on price movement and volume
    const priceChange = marketData.priceChange || 0;
    const volume = marketData.volume;
    
    if (priceChange > 0) {
      // Upward price movement suggests more buying pressure
      const buyFlow = volume * 0.7; // 70% attributed to buying
      const sellFlow = volume * 0.3;
      
      this.buyFlowBuffer.push(buyFlow);
      this.sellFlowBuffer.push(sellFlow);
      
      this.flowMetrics.buyVolume += buyFlow;
      this.flowMetrics.sellVolume += sellFlow;
      this.flowMetrics.buyTradeCount++;
      
    } else if (priceChange < 0) {
      // Downward price movement suggests more selling pressure
      const buyFlow = volume * 0.3;
      const sellFlow = volume * 0.7;
      
      this.buyFlowBuffer.push(buyFlow);
      this.sellFlowBuffer.push(sellFlow);
      
      this.flowMetrics.buyVolume += buyFlow;
      this.flowMetrics.sellVolume += sellFlow;
      this.flowMetrics.sellTradeCount++;
      
    } else {
      // No price change - split evenly
      const flow = volume * 0.5;
      
      this.buyFlowBuffer.push(flow);
      this.sellFlowBuffer.push(flow);
      
      this.flowMetrics.buyVolume += flow;
      this.flowMetrics.sellVolume += flow;
    }
    
    // Maintain buffer size
    if (this.buyFlowBuffer.length > this.FLOW_WINDOW_SIZE) {
      this.buyFlowBuffer = this.buyFlowBuffer.slice(-this.FLOW_WINDOW_SIZE);
    }
    if (this.sellFlowBuffer.length > this.FLOW_WINDOW_SIZE) {
      this.sellFlowBuffer = this.sellFlowBuffer.slice(-this.FLOW_WINDOW_SIZE);
    }
    
    // Update total volume
    this.flowMetrics.totalVolume += volume;
    
    // Calculate net order flow
    this.flowMetrics.netOrderFlow = this.flowMetrics.buyVolume - this.flowMetrics.sellVolume;
    
    // Update timestamp
    this.flowMetrics.lastUpdate = Date.now();
  }

  private updateVolumeProfile(marketData: MarketData): void {
    const roundedPrice = Math.round(marketData.price / this.PRICE_PRECISION) * this.PRICE_PRECISION;
    
    let profile = this.volumeProfile.get(roundedPrice);
    if (!profile) {
      profile = {
        price: roundedPrice,
        volume: 0,
        buyVolume: 0,
        sellVolume: 0,
        tradeCount: 0,
        averageTradeSize: 0,
        maxTradeSize: 0,
        minTradeSize: Number.MAX_VALUE,
        vwap: roundedPrice,
        poc: false, // Point of Control
        significance: 0
      };
      this.volumeProfile.set(roundedPrice, profile);
    }
    
    // Update profile
    profile.volume += marketData.volume;
    profile.tradeCount++;
    
    // Estimate buy/sell based on price change
    if (marketData.priceChange > 0) {
      profile.buyVolume += marketData.volume * 0.7;
      profile.sellVolume += marketData.volume * 0.3;
    } else if (marketData.priceChange < 0) {
      profile.buyVolume += marketData.volume * 0.3;
      profile.sellVolume += marketData.volume * 0.7;
    } else {
      profile.buyVolume += marketData.volume * 0.5;
      profile.sellVolume += marketData.volume * 0.5;
    }
    
    // Update statistics
    profile.averageTradeSize = profile.volume / profile.tradeCount;
    profile.maxTradeSize = Math.max(profile.maxTradeSize, marketData.volume);
    profile.minTradeSize = Math.min(profile.minTradeSize, marketData.volume);
    
    // Update VWAP
    profile.vwap = (profile.vwap * (profile.tradeCount - 1) + roundedPrice) / profile.tradeCount;
    
    // Calculate significance
    profile.significance = profile.volume / Math.max(this.flowMetrics.totalVolume, 1);
    
    // Clean old entries
    this.cleanVolumeProfile();
  }

  private calculateMicrostructure(marketData: MarketData): MarketMicrostructure {
    const recentData = this.recentTicks.slice(-5);
    if (recentData.length < 2) {
      return {
        tickDirection: 0,
        effectiveSpread: 0,
        priceImpact: 0,
        marketImpact: 0,
        temporaryImpact: 0,
        permanentImpact: 0,
        orderBookPressure: 0
      };
    }
    
    // Calculate tick direction
    const previousPrice = recentData[recentData.length - 2].price;
    const currentPrice = marketData.price;
    const tickDirection = currentPrice > previousPrice ? 1 : currentPrice < previousPrice ? -1 : 0;
    
    // Calculate effective spread
    const effectiveSpread = marketData.ask - marketData.bid;
    
    // Estimate price impact (simplified)
    const priceImpact = Math.abs(marketData.priceChange) / Math.max(marketData.volume, 1);
    
    return {
      tickDirection,
      effectiveSpread,
      priceImpact,
      marketImpact: priceImpact * 0.7,
      temporaryImpact: priceImpact * 0.3,
      permanentImpact: priceImpact * 0.1,
      orderBookPressure: this.calculateOrderBookPressure()
    };
  }

  private analyzeTapeEntry(entry: TapeEntry): void {
    // Classify trade aggression
    if (entry.isLarge || entry.isDominant) {
      if (entry.aggressor === 'buyer') {
        this.flowMetrics.aggressiveBuyVolume += entry.volume;
      } else if (entry.aggressor === 'seller') {
        this.flowMetrics.aggressiveSellVolume += entry.volume;
      }
    } else {
      if (entry.aggressor === 'buyer') {
        this.flowMetrics.passiveBuyVolume += entry.volume;
      } else if (entry.aggressor === 'seller') {
        this.flowMetrics.passiveSellVolume += entry.volume;
      }
    }
    
    // Update trade size statistics
    const totalTrades = this.flowMetrics.buyTradeCount + this.flowMetrics.sellTradeCount;
    if (totalTrades > 0) {
      this.flowMetrics.averageTradeSize = 
        (this.flowMetrics.averageTradeSize * totalTrades + entry.volume) / (totalTrades + 1);
    }
    
    // Update large/small trade ratios
    if (entry.volume > 100) { // Large trade threshold
      this.flowMetrics.largeTradeRatio = (this.flowMetrics.largeTradeRatio * totalTrades + 1) / (totalTrades + 1);
    } else {
      this.flowMetrics.smallTradeRatio = (this.flowMetrics.smallTradeRatio * totalTrades + 1) / (totalTrades + 1);
    }
  }

  private calculateFlowAnalysis(): FlowAnalysisResult {
    if (this.buyFlowBuffer.length < 10) {
      return {
        buyFlow: 0,
        sellFlow: 0,
        netFlow: 0,
        momentum: 0,
        acceleration: 0,
        confidence: 0,
        quality: 'low'
      };
    }
    
    const recentBuyFlow = this.buyFlowBuffer.slice(-20);
    const recentSellFlow = this.sellFlowBuffer.slice(-20);
    
    const buyFlow = recentBuyFlow.reduce((sum, flow) => sum + flow, 0);
    const sellFlow = recentSellFlow.reduce((sum, flow) => sum + flow, 0);
    const netFlow = buyFlow - sellFlow;
    
    // Calculate momentum (rate of change)
    const momentum = this.calculateMomentum();
    
    // Calculate acceleration (change in momentum)
    const acceleration = this.calculateAcceleration();
    
    // Determine quality based on data consistency
    const quality = this.determineFlowQuality(recentBuyFlow, recentSellFlow);
    
    // Calculate confidence
    const confidence = this.calculateFlowAnalysisConfidence(buyFlow, sellFlow, momentum);
    
    return {
      buyFlow,
      sellFlow,
      netFlow,
      momentum,
      acceleration,
      confidence,
      quality
    };
  }

  private calculateSideLiquidity(levels: OrderBookLevel[]): number {
    return levels.reduce((total, level, index) => {
      // Weight closer levels more heavily
      const weight = Math.exp(-index * 0.1);
      return total + (level.volume * weight);
    }, 0);
  }

  private calculateAggressionLevel(): number {
    const aggressiveBuy = this.flowMetrics.aggressiveBuyVolume;
    const aggressiveSell = this.flowMetrics.aggressiveSellVolume;
    const totalAggressive = aggressiveBuy + aggressiveSell;
    
    if (totalAggressive === 0) return 0;
    
    // Return net aggression ratio (-1 to 1)
    return (aggressiveBuy - aggressiveSell) / totalAggressive;
  }

  private detectAbsorption(): boolean {
    // Look for absorption patterns in recent data
    const recentVolumes = this.recentTapes.slice(-20).map(t => t.volume);
    if (recentVolumes.length < 10) return false;
    
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const largeVolumes = recentVolumes.filter(vol => vol > avgVolume * 2);
    
    // Absorption likely if many large volume trades without significant price movement
    return largeVolumes.length > recentVolumes.length * 0.3;
  }

  private estimateHiddenLiquidity(orderBook?: OrderBook): number {
    if (!orderBook) return 0;
    
    // Compare visible liquidity to recent trade volumes
    const visibleLiquidity = this.calculateSideLiquidity(orderBook.bids) + 
                            this.calculateSideLiquidity(orderBook.asks);
    
    const recentVolume = this.recentTapes.slice(-10)
      .reduce((sum, tape) => sum + tape.volume, 0);
    
    if (visibleLiquidity === 0) return 0;
    
    // Estimate hidden liquidity ratio
    const ratio = recentVolume / visibleLiquidity;
    return Math.max(0, Math.min(1, ratio - 1)); // Return excess as hidden estimate
  }

  private generateVolumeProfile(): VolumeProfile[] {
    return Array.from(this.volumeProfile.values())
      .filter(profile => profile.significance > 0.001) // Filter insignificant levels
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20); // Top 20 significant levels
  }

  private calculateOrderBookImbalance(orderBook: OrderBook): number {
    const topBidVolume = orderBook.bids.slice(0, 5).reduce((sum, level) => sum + level.volume, 0);
    const topAskVolume = orderBook.asks.slice(0, 5).reduce((sum, level) => sum + level.volume, 0);
    
    const totalVolume = topBidVolume + topAskVolume;
    if (totalVolume === 0) return 0;
    
    return ((topBidVolume - topAskVolume) / totalVolume) * 100;
  }

  private detectLiquidityGaps(orderBook: OrderBook): PriceLevel[] {
    const gaps: PriceLevel[] = [];
    const spread = orderBook.asks[0].price - orderBook.bids[0].price;
    
    if (spread > this.PRICE_PRECISION * 3) { // Gap larger than 3 ticks
      gaps.push({
        price: (orderBook.bids[0].price + orderBook.asks[0].price) / 2,
        bidVolume: 0,
        askVolume: 0,
        imbalance: 0,
        significance: spread / this.PRICE_PRECISION,
        timestamp: Date.now()
      });
    }
    
    return gaps;
  }

  private getDominantFlow(): FlowDirection {
    const netFlow = this.flowMetrics.netOrderFlow;
    const threshold = this.flowMetrics.totalVolume * 0.1;
    
    if (netFlow > threshold) return 'bullish';
    if (netFlow < -threshold) return 'bearish';
    return 'neutral';
  }

  private calculateFlowConfidence(): number {
    const totalVolume = this.flowMetrics.totalVolume;
    const netFlow = Math.abs(this.flowMetrics.netOrderFlow);
    
    if (totalVolume === 0) return 0;
    
    // Confidence based on flow dominance and volume
    const flowDominance = netFlow / totalVolume;
    const volumeConfidence = Math.min(1, totalVolume / 10000);
    
    return (flowDominance * 0.7) + (volumeConfidence * 0.3);
  }

  private calculateMomentum(): number {
    if (this.buyFlowBuffer.length < 20) return 0;
    
    const recent = this.buyFlowBuffer.slice(-10);
    const older = this.buyFlowBuffer.slice(-20, -10);
    
    const recentAvg = recent.reduce((sum, flow) => sum + flow, 0) / recent.length;
    const olderAvg = older.reduce((sum, flow) => sum + flow, 0) / older.length;
    
    return olderAvg === 0 ? 0 : (recentAvg - olderAvg) / olderAvg;
  }

  private calculateAcceleration(): number {
    // Calculate change in momentum over time
    if (this.aggressionHistory.length < 10) return 0;
    
    const recentMomentum = this.aggressionHistory.slice(-5);
    const olderMomentum = this.aggressionHistory.slice(-10, -5);
    
    const recentAvg = recentMomentum.reduce((sum, m) => sum + m, 0) / recentMomentum.length;
    const olderAvg = olderMomentum.reduce((sum, m) => sum + m, 0) / olderMomentum.length;
    
    return recentAvg - olderAvg;
  }

  private determineFlowQuality(buyFlow: number[], sellFlow: number[]): 'high' | 'medium' | 'low' {
    // Calculate coefficient of variation for consistency
    const buyVariance = this.calculateVariance(buyFlow);
    const sellVariance = this.calculateVariance(sellFlow);
    
    const avgVariance = (buyVariance + sellVariance) / 2;
    
    if (avgVariance < 0.3) return 'high';
    if (avgVariance < 0.7) return 'medium';
    return 'low';
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    
    return mean === 0 ? 0 : Math.sqrt(variance) / mean; // Coefficient of variation
  }

  private calculateFlowAnalysisConfidence(buyFlow: number, sellFlow: number, momentum: number): number {
    const totalFlow = buyFlow + sellFlow;
    if (totalFlow === 0) return 0;
    
    const flowImbalance = Math.abs(buyFlow - sellFlow) / totalFlow;
    const momentumStrength = Math.min(1, Math.abs(momentum));
    const volumeConfidence = Math.min(1, totalFlow / 5000);
    
    return (flowImbalance * 0.4) + (momentumStrength * 0.3) + (volumeConfidence * 0.3);
  }

  private calculateOrderBookPressure(): number {
    if (this.orderBookHistory.length < 2) return 0;
    
    const current = this.orderBookHistory[this.orderBookHistory.length - 1];
    const previous = this.orderBookHistory[this.orderBookHistory.length - 2];
    
    const currentImbalance = this.calculateOrderBookImbalance(current);
    const previousImbalance = this.calculateOrderBookImbalance(previous);
    
    return currentImbalance - previousImbalance;
  }

  private updateAggressionMetrics(entries: TapeEntry[]): void {
    const aggressionSum = entries.reduce((sum, entry) => {
      if (entry.isLarge || entry.isDominant) {
        return sum + (entry.aggressor === 'buyer' ? 1 : -1);
      }
      return sum;
    }, 0);
    
    const aggressionLevel = entries.length > 0 ? aggressionSum / entries.length : 0;
    
    this.aggressionHistory.push(aggressionLevel);
    if (this.aggressionHistory.length > this.FLOW_WINDOW_SIZE) {
      this.aggressionHistory = this.aggressionHistory.slice(-this.FLOW_WINDOW_SIZE);
    }
  }

  private cleanVolumeProfile(): void {
    const cutoffTime = Date.now() - (3600000); // 1 hour
    
    for (const [price, profile] of this.volumeProfile) {
      // Remove profiles with very low significance or old data
      if (profile.significance < 0.001 || profile.volume < this.VOLUME_SIGNIFICANCE_THRESHOLD) {
        this.volumeProfile.delete(price);
      }
    }
    
    // Keep only top 100 most significant levels
    if (this.volumeProfile.size > 100) {
      const sorted = Array.from(this.volumeProfile.entries())
        .sort(([,a], [,b]) => b.significance - a.significance)
        .slice(0, 100);
      
      this.volumeProfile.clear();
      sorted.forEach(([price, profile]) => {
        this.volumeProfile.set(price, profile);
      });
    }
  }

  private resetFlowMetrics(): void {
    this.flowMetrics = {
      totalVolume: 0,
      buyVolume: 0,
      sellVolume: 0,
      aggressiveBuyVolume: 0,
      aggressiveSellVolume: 0,
      passiveBuyVolume: 0,
      passiveSellVolume: 0,
      averageTradeSize: 0,
      largeTradeRatio: 0,
      smallTradeRatio: 0,
      buyTradeCount: 0,
      sellTradeCount: 0,
      netOrderFlow: 0,
      flowMomentum: 0,
      flowAcceleration: 0,
      lastUpdate: Date.now()
    };
  }

  // Public getters
  public getFlowMetrics(): OrderFlowMetrics {
    return { ...this.flowMetrics };
  }

  public getVolumeProfile(): VolumeProfile[] {
    return Array.from(this.volumeProfile.values())
      .sort((a, b) => b.volume - a.volume);
  }

  public getLiquidityProfile(orderBook: OrderBook): LiquidityProfile {
    const bidLiquidity = this.calculateSideLiquidity(orderBook.bids);
    const askLiquidity = this.calculateSideLiquidity(orderBook.asks);
    
    return {
      totalLiquidity: bidLiquidity + askLiquidity,
      bidLiquidity,
      askLiquidity,
      hiddenEstimate: this.estimateHiddenLiquidity(orderBook),
      depth: Math.min(orderBook.bids.length, orderBook.asks.length),
      spread: orderBook.asks[0].price - orderBook.bids[0].price,
      resilience: this.calculateLiquidityResilience(orderBook)
    };
  }

  private calculateLiquidityResilience(orderBook: OrderBook): number {
    // Calculate how quickly liquidity recovers after trades
    // This is a simplified implementation
    const totalLevels = orderBook.bids.length + orderBook.asks.length;
    const avgVolume = (
      orderBook.bids.reduce((sum, level) => sum + level.volume, 0) +
      orderBook.asks.reduce((sum, level) => sum + level.volume, 0)
    ) / totalLevels;
    
    return Math.min(1, avgVolume / 1000); // Normalize to 0-1
  }

  public getCurrentFlow(): FlowDirection {
    return this.getDominantFlow();
  }

  public getFlowStrength(): number {
    const totalFlow = this.flowMetrics.buyVolume + this.flowMetrics.sellVolume;
    if (totalFlow === 0) return 0;
    
    return Math.abs(this.flowMetrics.netOrderFlow) / totalFlow;
  }
}