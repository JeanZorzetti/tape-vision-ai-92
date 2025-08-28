/**
 * Signal Generator - Advanced Trading Signal Generation
 * Sophisticated signal generation combining multiple analysis techniques
 * Now integrated with Python ML Engine for enhanced AI capabilities
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  DecisionAnalysis,
  PatternMatch,
  MarketData,
  OrderBook,
  TapeEntry,
  LiquidityAnalysis,
  OrderFlowMetrics,
  TradingConfig,
  SignalStrength,
  MarketCondition,
  TradingSignal as BaseTradingSignal
} from '@/types/trading';
import { OrderFlowData } from '../trading/OrderFlowAnalyzer';
import { MLEngineService } from '../../services/MLEngineService';

export interface TradingSignal extends BaseTradingSignal {
  action: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  analysis: DecisionAnalysis;
  strength: SignalStrength;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  marketCondition: MarketCondition;
  riskLevel: number;
  expectedReward: number;
  timeDecay: number;
  validUntil: number;
}

export interface SignalComponent {
  name: string;
  score: number;
  weight: number;
  confidence: number;
  description: string;
  timeframe: number;
  decay: number;
}

export interface MarketContext {
  trend: 'strong_bullish' | 'weak_bullish' | 'neutral' | 'weak_bearish' | 'strong_bearish';
  volatility: 'very_high' | 'high' | 'medium' | 'low' | 'very_low';
  liquidity: 'excellent' | 'good' | 'fair' | 'poor';
  momentum: number;
  strength: number;
  quality: number;
}

export interface SignalParams {
  minimumConfidence: number;
  aggressionWeight: number;
  liquidityWeight: number;
  patternWeight: number;
  momentumWeight: number;
  volumeWeight: number;
  timeDecayRate: number;
  signalTimeout: number;
}

export class SignalGenerator extends EventEmitter {
  private logger: Logger;
  private config: TradingConfig;
  private params: SignalParams;
  
  // Signal history and state
  private signalHistory: TradingSignal[] = [];
  private activeSignals: Map<string, TradingSignal> = new Map();
  private components: Map<string, SignalComponent> = new Map();
  
  // Analysis state
  private lastMarketData?: MarketData;
  private lastOrderBook?: OrderBook;
  private lastOrderFlow?: OrderFlowData;
  private recentPatterns: PatternMatch[] = [];
  private marketContext: MarketContext;
  
  // Performance tracking
  private signalMetrics = {
    totalSignals: 0,
    bullishSignals: 0,
    bearishSignals: 0,
    highConfidenceSignals: 0,
    averageConfidence: 0,
    averageAccuracy: 0,
    lastSignalTime: 0
  };

  // Signal generation parameters
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.85;
  private readonly EXCELLENT_THRESHOLD = 0.95;
  private readonly GOOD_THRESHOLD = 0.90;
  private readonly FAIR_THRESHOLD = 0.85;
  private readonly SIGNAL_TIMEOUT = 300000; // 5 minutes
  private readonly MAX_SIGNAL_HISTORY = 1000;

  constructor(config: TradingConfig, logger: Logger) {
    super();
    
    this.config = config;
    this.logger = logger.child({ component: 'SignalGenerator' });
    
    // Initialize signal parameters
    this.params = {
      minimumConfidence: config.analysisSettings.confidenceThreshold,
      aggressionWeight: 0.25,
      liquidityWeight: 0.20,
      patternWeight: 0.25,
      momentumWeight: 0.15,
      volumeWeight: 0.15,
      timeDecayRate: 0.1,
      signalTimeout: this.SIGNAL_TIMEOUT
    };
    
    this.marketContext = this.initializeMarketContext();
    
    this.logger.info('SignalGenerator initialized', {
      minimumConfidence: this.params.minimumConfidence,
      signalTimeout: this.params.signalTimeout
    });
  }

  /**
   * Evaluate pattern and generate signal
   */
  public evaluatePattern(pattern: PatternMatch): void {
    try {
      // Store pattern for context
      this.recentPatterns.push(pattern);
      if (this.recentPatterns.length > 20) {
        this.recentPatterns = this.recentPatterns.slice(-20);
      }
      
      // Update pattern component
      this.updatePatternComponent(pattern);
      
      // Generate signal if pattern is significant
      if (pattern.confidence >= 0.7) {
        const signal = this.generateSignalFromPattern(pattern);
        if (signal.confidence >= this.params.minimumConfidence) {
          this.emitSignal(signal);
        }
      }
      
    } catch (error) {
      this.logger.error('Error evaluating pattern', error);
    }
  }

  /**
   * Generate comprehensive trading signal
   */
  public generateSignal(
    marketData: MarketData,
    orderBook?: OrderBook,
    orderFlow?: OrderFlowData,
    patterns?: PatternMatch[]
  ): TradingSignal {
    
    try {
      // Update state
      this.updateState(marketData, orderBook, orderFlow, patterns);
      
      // Update market context
      this.updateMarketContext(marketData, orderBook, orderFlow);
      
      // Calculate signal components
      this.calculateSignalComponents(marketData, orderBook, orderFlow, patterns);
      
      // Generate final signal
      const signal = this.synthesizeSignal();
      
      // Store signal if significant
      if (signal.confidence > 0.5) {
        this.storeSignal(signal);
      }
      
      return signal;
      
    } catch (error) {
      this.logger.error('Error generating signal', error);
      return this.createEmptySignal();
    }
  }

  /**
   * Evaluate multiple data inputs for signal generation
   */
  public evaluateMultiple(inputs: {
    marketData: MarketData;
    orderBook?: OrderBook;
    orderFlow?: OrderFlowData;
    patterns?: PatternMatch[];
    liquidityAnalysis?: LiquidityAnalysis;
    flowMetrics?: OrderFlowMetrics;
  }): TradingSignal {
    
    return this.generateSignal(
      inputs.marketData,
      inputs.orderBook,
      inputs.orderFlow,
      inputs.patterns
    );
  }

  private updateState(
    marketData: MarketData,
    orderBook?: OrderBook,
    orderFlow?: OrderFlowData,
    patterns?: PatternMatch[]
  ): void {
    
    this.lastMarketData = marketData;
    this.lastOrderBook = orderBook;
    this.lastOrderFlow = orderFlow;
    
    if (patterns) {
      this.recentPatterns.push(...patterns);
      if (this.recentPatterns.length > 20) {
        this.recentPatterns = this.recentPatterns.slice(-20);
      }
    }
  }

  private updateMarketContext(
    marketData: MarketData,
    orderBook?: OrderBook,
    orderFlow?: OrderFlowData
  ): void {
    
    // Analyze trend strength
    const trend = this.analyzeTrendStrength(marketData);
    
    // Analyze volatility
    const volatility = this.analyzeVolatility(marketData);
    
    // Analyze liquidity
    const liquidity = this.analyzeLiquidityCondition(orderBook);
    
    // Calculate momentum
    const momentum = this.calculateMomentum(marketData);
    
    // Calculate overall strength
    const strength = this.calculateMarketStrength(marketData, orderFlow);
    
    // Calculate quality
    const quality = this.calculateMarketQuality(marketData, orderBook, orderFlow);
    
    this.marketContext = {
      trend,
      volatility,
      liquidity,
      momentum,
      strength,
      quality
    };
  }

  private calculateSignalComponents(
    marketData: MarketData,
    orderBook?: OrderBook,
    orderFlow?: OrderFlowData,
    patterns?: PatternMatch[]
  ): void {
    
    this.components.clear();
    
    // Aggression component
    if (orderFlow) {
      this.components.set('aggression', {
        name: 'Order Flow Aggression',
        score: this.calculateAggressionScore(orderFlow),
        weight: this.params.aggressionWeight,
        confidence: this.calculateAggressionConfidence(orderFlow),
        description: `Aggression level: ${orderFlow.aggression.toFixed(2)}`,
        timeframe: 180000, // 3 minutes
        decay: this.params.timeDecayRate
      });
    }
    
    // Liquidity component
    if (orderBook && orderFlow) {
      this.components.set('liquidity', {
        name: 'Liquidity Analysis',
        score: this.calculateLiquidityScore(orderBook, orderFlow),
        weight: this.params.liquidityWeight,
        confidence: this.calculateLiquidityConfidence(orderFlow),
        description: `Hidden liquidity: ${(orderFlow.hiddenLiquidity * 100).toFixed(1)}%`,
        timeframe: 240000, // 4 minutes
        decay: this.params.timeDecayRate * 0.8
      });
    }
    
    // Pattern component
    if (patterns && patterns.length > 0) {
      const bestPattern = patterns.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );
      
      this.components.set('pattern', {
        name: 'Pattern Recognition',
        score: this.calculatePatternScore(bestPattern),
        weight: this.params.patternWeight,
        confidence: bestPattern.confidence,
        description: `Pattern: ${bestPattern.name}`,
        timeframe: bestPattern.timeframe || 300000, // 5 minutes
        decay: this.params.timeDecayRate * 1.2
      });
    }
    
    // Momentum component
    this.components.set('momentum', {
      name: 'Price Momentum',
      score: this.calculateMomentumScore(marketData),
      weight: this.params.momentumWeight,
      confidence: this.calculateMomentumConfidence(marketData),
      description: `Momentum: ${this.marketContext.momentum.toFixed(2)}`,
      timeframe: 120000, // 2 minutes
      decay: this.params.timeDecayRate * 1.5
    });
    
    // Volume component
    this.components.set('volume', {
      name: 'Volume Analysis',
      score: this.calculateVolumeScore(marketData),
      weight: this.params.volumeWeight,
      confidence: this.calculateVolumeConfidence(marketData),
      description: `Volume: ${marketData.volume.toLocaleString()}`,
      timeframe: 180000, // 3 minutes
      decay: this.params.timeDecayRate
    });
  }

  private synthesizeSignal(): TradingSignal {
    if (this.components.size === 0) {
      return this.createEmptySignal();
    }
    
    // Calculate weighted scores
    let totalScore = 0;
    let totalWeight = 0;
    let totalConfidence = 0;
    const componentScores: Record<string, number> = {};
    const variablesAnalyzed: string[] = [];
    
    for (const [name, component] of this.components) {
      const weightedScore = component.score * component.weight;
      const weightedConfidence = component.confidence * component.weight;
      
      totalScore += weightedScore;
      totalWeight += component.weight;
      totalConfidence += weightedConfidence;
      
      componentScores[name] = component.score;
      variablesAnalyzed.push(component.description);
    }
    
    // Normalize scores
    const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
    const finalConfidence = totalWeight > 0 ? totalConfidence / totalWeight : 0;
    
    // Determine action
    const action = this.determineAction(finalScore, finalConfidence);
    
    // Calculate quality
    const quality = this.calculateSignalQuality(finalConfidence);
    
    // Calculate risk and reward
    const riskLevel = this.calculateRiskLevel(finalConfidence, action);
    const expectedReward = this.calculateExpectedReward(finalScore, finalConfidence);
    
    // Calculate time decay and validity
    const timeDecay = this.calculateTimeDecay();
    const validUntil = Date.now() + this.params.signalTimeout;
    
    // Determine entry reason
    const entryReason = this.generateEntryReason(action, componentScores);
    
    // Create decision analysis
    const analysis: DecisionAnalysis = {
      entryReason,
      variablesAnalyzed,
      componentScores: {
        buyAggression: componentScores.aggression || 0,
        sellAggression: -(componentScores.aggression || 0),
        liquidityAbsorption: componentScores.liquidity || 0,
        falseOrdersDetected: 0, // Would be calculated from specific analysis
        flowMomentum: componentScores.momentum || 0,
        historicalPattern: componentScores.pattern || 0
      },
      finalCertainty: finalConfidence * 100,
      nextAction: this.getNextActionDescription(action, finalConfidence),
      recommendation: this.getRecommendation(action, finalConfidence),
      riskLevel,
      expectedTarget: this.calculateTargetPrice(action, expectedReward),
      stopLoss: this.calculateStopLoss(action, riskLevel),
      timeframe: this.calculateTimeframe(finalConfidence)
    };
    
    return {
      action,
      confidence: finalConfidence,
      analysis,
      strength: this.mapConfidenceToStrength(finalConfidence),
      quality,
      marketCondition: this.getMarketCondition(),
      riskLevel,
      expectedReward,
      timeDecay,
      validUntil
    };
  }

  private determineAction(score: number, confidence: number): 'BUY' | 'SELL' | 'WAIT' {
    if (confidence < this.params.minimumConfidence) {
      return 'WAIT';
    }
    
    // Strong bullish signal
    if (score > 0.6 && confidence >= this.GOOD_THRESHOLD) {
      return 'BUY';
    }
    
    // Strong bearish signal
    if (score < -0.6 && confidence >= this.GOOD_THRESHOLD) {
      return 'SELL';
    }
    
    return 'WAIT';
  }

  private calculateAggressionScore(orderFlow: OrderFlowData): number {
    // Convert aggression (-1 to 1) to signal score
    return orderFlow.aggression;
  }

  private calculateAggressionConfidence(orderFlow: OrderFlowData): number {
    // Higher confidence with stronger aggression and good volume
    const aggressionStrength = Math.abs(orderFlow.aggression);
    const volumeConfidence = Math.min(1, orderFlow.volumeProfile.length / 10);
    
    return (aggressionStrength * 0.7) + (volumeConfidence * 0.3);
  }

  private calculateLiquidityScore(orderBook: OrderBook, orderFlow: OrderFlowData): number {
    // Positive score for hidden liquidity discovery, negative for liquidity gaps
    const hiddenLiquidityScore = orderFlow.hiddenLiquidity * 2 - 1; // Convert 0-1 to -1 to 1
    const gapsScore = orderFlow.liquidityGaps.length > 0 ? -0.3 : 0;
    
    return Math.max(-1, Math.min(1, hiddenLiquidityScore + gapsScore));
  }

  private calculateLiquidityConfidence(orderFlow: OrderFlowData): number {
    return orderFlow.confidence;
  }

  private calculatePatternScore(pattern: PatternMatch): number {
    // Convert pattern confidence to signal score based on pattern type
    const baseScore = (pattern.confidence - 0.5) * 2; // Convert 0.5-1 to 0-1
    
    // Adjust based on historical success rate
    const successAdjustment = (pattern.historicalSuccess - 0.5) * 2;
    
    return Math.max(-1, Math.min(1, baseScore * successAdjustment));
  }

  private calculateMomentumScore(marketData: MarketData): number {
    if (!this.lastMarketData) return 0;
    
    // Calculate price momentum
    const priceChange = marketData.price - this.lastMarketData.price;
    const percentChange = priceChange / this.lastMarketData.price;
    
    // Normalize to -1 to 1 range
    return Math.max(-1, Math.min(1, percentChange * 100));
  }

  private calculateMomentumConfidence(marketData: MarketData): number {
    // Higher confidence with higher volume
    const volumeConfidence = Math.min(1, marketData.volume / 1000);
    const volatilityConfidence = 1 - Math.min(1, marketData.volatility / 5);
    
    return (volumeConfidence * 0.6) + (volatilityConfidence * 0.4);
  }

  private calculateVolumeScore(marketData: MarketData): number {
    // Volume score based on above/below average volume
    // This would typically use historical volume data
    const avgVolume = 1000; // Placeholder - should be calculated from history
    const volumeRatio = marketData.volume / avgVolume;
    
    // Convert to score: above average = positive, below = negative
    return Math.max(-1, Math.min(1, (volumeRatio - 1) * 0.5));
  }

  private calculateVolumeConfidence(marketData: MarketData): number {
    // Higher confidence with more significant volume deviations
    const avgVolume = 1000; // Placeholder
    const volumeRatio = marketData.volume / avgVolume;
    const deviation = Math.abs(volumeRatio - 1);
    
    return Math.min(1, deviation);
  }

  private calculateSignalQuality(confidence: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (confidence >= this.EXCELLENT_THRESHOLD) return 'excellent';
    if (confidence >= this.GOOD_THRESHOLD) return 'good';
    if (confidence >= this.FAIR_THRESHOLD) return 'fair';
    return 'poor';
  }

  private calculateRiskLevel(confidence: number, action: 'BUY' | 'SELL' | 'WAIT'): number {
    if (action === 'WAIT') return 0;
    
    // Higher confidence = lower risk
    const baseRisk = 1 - confidence;
    
    // Adjust based on market conditions
    const volatilityRisk = this.marketContext.volatility === 'very_high' ? 0.3 : 0;
    const liquidityRisk = this.marketContext.liquidity === 'poor' ? 0.2 : 0;
    
    return Math.min(1, baseRisk + volatilityRisk + liquidityRisk);
  }

  private calculateExpectedReward(score: number, confidence: number): number {
    // Expected reward based on signal strength and confidence
    const baseReward = Math.abs(score) * confidence;
    
    // Adjust for market conditions
    const trendMultiplier = this.marketContext.trend.includes('strong') ? 1.2 : 1.0;
    const liquidityMultiplier = this.marketContext.liquidity === 'excellent' ? 1.1 : 1.0;
    
    return baseReward * trendMultiplier * liquidityMultiplier;
  }

  private calculateTimeDecay(): number {
    const timeSinceLastSignal = Date.now() - this.signalMetrics.lastSignalTime;
    const decayFactor = Math.exp(-timeSinceLastSignal / (60000 * 5)); // 5-minute half-life
    
    return decayFactor;
  }

  private generateEntryReason(action: 'BUY' | 'SELL' | 'WAIT', componentScores: Record<string, number>): string {
    if (action === 'WAIT') return 'Insufficient signal strength';
    
    const reasons: string[] = [];
    
    if (componentScores.aggression > 0.5) {
      reasons.push('Strong buying aggression detected');
    } else if (componentScores.aggression < -0.5) {
      reasons.push('Strong selling pressure detected');
    }
    
    if (componentScores.liquidity > 0.5) {
      reasons.push('Hidden liquidity discovered');
    }
    
    if (componentScores.pattern > 0.5) {
      reasons.push('Bullish pattern confirmed');
    } else if (componentScores.pattern < -0.5) {
      reasons.push('Bearish pattern confirmed');
    }
    
    if (componentScores.momentum > 0.5) {
      reasons.push('Strong upward momentum');
    } else if (componentScores.momentum < -0.5) {
      reasons.push('Strong downward momentum');
    }
    
    return reasons.length > 0 ? reasons.join(', ') : 'Multiple confluence factors';
  }

  private getNextActionDescription(action: 'BUY' | 'SELL' | 'WAIT', confidence: number): string {
    switch (action) {
      case 'BUY':
        return `Execute long position with ${(confidence * 100).toFixed(1)}% confidence`;
      case 'SELL':
        return `Execute short position with ${(confidence * 100).toFixed(1)}% confidence`;
      case 'WAIT':
        return 'Monitor for stronger signal';
    }
  }

  private getRecommendation(action: 'BUY' | 'SELL' | 'WAIT', confidence: number): string {
    const confidenceText = confidence >= 0.95 ? 'FORTE' : confidence >= 0.90 ? 'MODERADA' : 'FRACA';
    
    switch (action) {
      case 'BUY':
        return `COMPRAR - Confiança ${confidenceText}`;
      case 'SELL':
        return `VENDER - Confiança ${confidenceText}`;
      case 'WAIT':
        return 'AGUARDAR - Sinal insuficiente';
    }
  }

  private calculateTargetPrice(action: 'BUY' | 'SELL' | 'WAIT', expectedReward: number): number {
    if (!this.lastMarketData || action === 'WAIT') return 0;
    
    const currentPrice = this.lastMarketData.price;
    const targetDistance = expectedReward * 2; // 2 points target for mini dollar
    
    return action === 'BUY' ? 
      currentPrice + targetDistance : 
      currentPrice - targetDistance;
  }

  private calculateStopLoss(action: 'BUY' | 'SELL' | 'WAIT', riskLevel: number): number {
    if (!this.lastMarketData || action === 'WAIT') return 0;
    
    const currentPrice = this.lastMarketData.price;
    const stopDistance = Math.max(1, riskLevel * 1.5); // Dynamic stop based on risk
    
    return action === 'BUY' ? 
      currentPrice - stopDistance : 
      currentPrice + stopDistance;
  }

  private calculateTimeframe(confidence: number): number {
    // Higher confidence signals last longer
    return Math.round(confidence * 300000); // Up to 5 minutes
  }

  private mapConfidenceToStrength(confidence: number): SignalStrength {
    if (confidence >= 0.95) return 'very_strong';
    if (confidence >= 0.90) return 'strong';
    if (confidence >= 0.80) return 'medium';
    if (confidence >= 0.70) return 'weak';
    return 'very_weak';
  }

  private getMarketCondition(): MarketCondition {
    // Simplified market condition based on context
    if (this.marketContext.volatility === 'very_high') return 'volatile';
    if (this.marketContext.liquidity === 'poor') return 'illiquid';
    if (this.marketContext.trend.includes('strong')) return 'trending';
    return 'normal';
  }

  // Helper methods for market context analysis
  private analyzeTrendStrength(marketData: MarketData): MarketContext['trend'] {
    const priceChange = marketData.priceChange || 0;
    const percentChange = Math.abs(priceChange) / marketData.price * 100;
    
    if (priceChange > 0) {
      return percentChange > 0.5 ? 'strong_bullish' : 'weak_bullish';
    } else if (priceChange < 0) {
      return percentChange > 0.5 ? 'strong_bearish' : 'weak_bearish';
    }
    return 'neutral';
  }

  private analyzeVolatility(marketData: MarketData): MarketContext['volatility'] {
    const vol = marketData.volatility || 0;
    
    if (vol > 3.0) return 'very_high';
    if (vol > 2.0) return 'high';
    if (vol > 1.0) return 'medium';
    if (vol > 0.5) return 'low';
    return 'very_low';
  }

  private analyzeLiquidityCondition(orderBook?: OrderBook): MarketContext['liquidity'] {
    if (!orderBook || !orderBook.bids.length || !orderBook.asks.length) {
      return 'poor';
    }
    
    const spread = orderBook.asks[0].price - orderBook.bids[0].price;
    const topBidVolume = orderBook.bids[0].volume;
    const topAskVolume = orderBook.asks[0].volume;
    const totalTopVolume = topBidVolume + topAskVolume;
    
    if (spread <= 0.5 && totalTopVolume > 1000) return 'excellent';
    if (spread <= 1.0 && totalTopVolume > 500) return 'good';
    if (spread <= 2.0 && totalTopVolume > 200) return 'fair';
    return 'poor';
  }

  private calculateMomentum(marketData: MarketData): number {
    return (marketData.priceChange || 0) / marketData.price;
  }

  private calculateMarketStrength(marketData: MarketData, orderFlow?: OrderFlowData): number {
    const volumeStrength = Math.min(1, marketData.volume / 1000);
    const flowStrength = orderFlow ? Math.abs(orderFlow.aggression) : 0;
    
    return (volumeStrength * 0.5) + (flowStrength * 0.5);
  }

  private calculateMarketQuality(marketData: MarketData, orderBook?: OrderBook, orderFlow?: OrderFlowData): number {
    let quality = 0.5; // Base quality
    
    // Good spread
    if (orderBook) {
      const spread = orderBook.asks[0].price - orderBook.bids[0].price;
      quality += spread <= 1.0 ? 0.2 : -0.1;
    }
    
    // Good volume
    quality += marketData.volume > 500 ? 0.2 : -0.1;
    
    // Flow confidence
    if (orderFlow) {
      quality += orderFlow.confidence * 0.3;
    }
    
    return Math.max(0, Math.min(1, quality));
  }

  private generateSignalFromPattern(pattern: PatternMatch): TradingSignal {
    // Generate signal specifically from pattern
    const action: 'BUY' | 'SELL' | 'WAIT' = 
      pattern.confidence >= 0.9 ? 
        (pattern.parameters?.direction === 'bullish' ? 'BUY' : 'SELL') : 
        'WAIT';
    
    return this.createSignalFromComponents(action, pattern.confidence, {
      pattern: pattern.confidence
    });
  }

  private updatePatternComponent(pattern: PatternMatch): void {
    this.components.set('pattern', {
      name: 'Pattern Recognition',
      score: this.calculatePatternScore(pattern),
      weight: this.params.patternWeight,
      confidence: pattern.confidence,
      description: `Pattern: ${pattern.name}`,
      timeframe: pattern.timeframe || 300000,
      decay: this.params.timeDecayRate * 1.2
    });
  }

  private createSignalFromComponents(
    action: 'BUY' | 'SELL' | 'WAIT', 
    confidence: number, 
    componentScores: Record<string, number>
  ): TradingSignal {
    
    const analysis: DecisionAnalysis = {
      entryReason: this.generateEntryReason(action, componentScores),
      variablesAnalyzed: Object.keys(componentScores),
      componentScores: {
        buyAggression: componentScores.aggression || 0,
        sellAggression: -(componentScores.aggression || 0),
        liquidityAbsorption: componentScores.liquidity || 0,
        falseOrdersDetected: 0,
        flowMomentum: componentScores.momentum || 0,
        historicalPattern: componentScores.pattern || 0
      },
      finalCertainty: confidence * 100,
      nextAction: this.getNextActionDescription(action, confidence),
      recommendation: this.getRecommendation(action, confidence),
      riskLevel: this.calculateRiskLevel(confidence, action),
      expectedTarget: this.calculateTargetPrice(action, confidence),
      stopLoss: this.calculateStopLoss(action, this.calculateRiskLevel(confidence, action)),
      timeframe: this.calculateTimeframe(confidence)
    };
    
    return {
      action,
      confidence,
      analysis,
      strength: this.mapConfidenceToStrength(confidence),
      quality: this.calculateSignalQuality(confidence),
      marketCondition: this.getMarketCondition(),
      riskLevel: this.calculateRiskLevel(confidence, action),
      expectedReward: confidence,
      timeDecay: this.calculateTimeDecay(),
      validUntil: Date.now() + this.params.signalTimeout
    };
  }

  private createEmptySignal(): TradingSignal {
    const analysis: DecisionAnalysis = {
      entryReason: 'No sufficient signal detected',
      variablesAnalyzed: [],
      componentScores: {
        buyAggression: 0,
        sellAggression: 0,
        liquidityAbsorption: 0,
        falseOrdersDetected: 0,
        flowMomentum: 0,
        historicalPattern: 0
      },
      finalCertainty: 0,
      nextAction: 'Monitor market conditions',
      recommendation: 'AGUARDAR',
      riskLevel: 0,
      expectedTarget: 0,
      stopLoss: 0,
      timeframe: 0
    };
    
    return {
      action: 'WAIT',
      confidence: 0,
      analysis,
      strength: 'very_weak',
      quality: 'poor',
      marketCondition: 'normal',
      riskLevel: 0,
      expectedReward: 0,
      timeDecay: 1,
      validUntil: Date.now() + 60000
    };
  }

  private initializeMarketContext(): MarketContext {
    return {
      trend: 'neutral',
      volatility: 'medium',
      liquidity: 'fair',
      momentum: 0,
      strength: 0.5,
      quality: 0.5
    };
  }

  private storeSignal(signal: TradingSignal): void {
    this.signalHistory.push(signal);
    if (this.signalHistory.length > this.MAX_SIGNAL_HISTORY) {
      this.signalHistory = this.signalHistory.slice(-this.MAX_SIGNAL_HISTORY);
    }
    
    // Update metrics
    this.signalMetrics.totalSignals++;
    this.signalMetrics.lastSignalTime = Date.now();
    
    if (signal.action === 'BUY') this.signalMetrics.bullishSignals++;
    if (signal.action === 'SELL') this.signalMetrics.bearishSignals++;
    if (signal.confidence >= this.GOOD_THRESHOLD) this.signalMetrics.highConfidenceSignals++;
    
    this.signalMetrics.averageConfidence = 
      (this.signalMetrics.averageConfidence + signal.confidence) / 2;
  }

  private emitSignal(signal: TradingSignal): void {
    this.logger.info('Signal generated', {
      action: signal.action,
      confidence: signal.confidence,
      quality: signal.quality,
      riskLevel: signal.riskLevel
    });
    
    this.emit('signal-generated', signal);
  }

  // Public getters and utilities
  public getSignalHistory(limit: number = 50): TradingSignal[] {
    return this.signalHistory.slice(-limit);
  }

  public getSignalMetrics() {
    return { ...this.signalMetrics };
  }

  public getActiveSignals(): TradingSignal[] {
    const now = Date.now();
    return Array.from(this.activeSignals.values()).filter(signal => signal.validUntil > now);
  }

  public getMarketContext(): MarketContext {
    return { ...this.marketContext };
  }
}