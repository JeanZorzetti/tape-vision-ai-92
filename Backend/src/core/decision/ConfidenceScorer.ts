/**
 * Advanced Confidence Scoring System
 * 
 * This critical component calculates multi-dimensional confidence scores for trading signals
 * using adaptive weights based on real-time performance. It integrates multiple confidence
 * factors including pattern strength, market conditions, risk assessment, and historical outcomes.
 * 
 * Key Features:
 * - Multi-factor confidence calculation with adaptive weights
 * - Real-time performance tracking and weight adjustment
 * - Bayesian confidence updating based on outcomes
 * - Market regime detection for context-aware scoring
 * - Sub-millisecond scoring performance for high-frequency trading
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  MarketData,
  DecisionAnalysis,
  PatternMatch,
  TapeEntry,
  ComponentScores,
  AnalysisVariable,
  TradingError,
  LiquidityAnalysis
} from '../../types/trading';
import { Logger } from '../../utils/Logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';

export interface ConfidenceFactors {
  patternStrength: number;
  volumeConfidence: number;
  liquidityScore: number;
  marketConditions: number;
  riskAssessment: number;
  historicalAccuracy: number;
  timeFactors: number;
  orderFlowStrength: number;
  volatilityStability: number;
  momentumAlignment: number;
}

export interface AdaptiveWeights {
  patternStrength: number;
  volumeConfidence: number;
  liquidityScore: number;
  marketConditions: number;
  riskAssessment: number;
  historicalAccuracy: number;
  timeFactors: number;
  orderFlowStrength: number;
  volatilityStability: number;
  momentumAlignment: number;
}

export interface ConfidenceResult {
  finalConfidence: number;
  factors: ConfidenceFactors;
  weights: AdaptiveWeights;
  marketRegime: MarketRegime;
  bayesianUpdate: number;
  uncertaintyBounds: [number, number];
  qualityMetrics: QualityMetrics;
  calculationTime: number;
  recommendations: string[];
  warnings: string[];
}

export interface MarketRegime {
  type: 'trending' | 'ranging' | 'volatile' | 'quiet' | 'breakout';
  strength: number;
  duration: number;
  confidence: number;
}

export interface QualityMetrics {
  signalClarity: number;
  dataCompleteness: number;
  factorAgreement: number;
  temporalConsistency: number;
  crossValidation: number;
}

export interface PerformanceTracker {
  totalSignals: number;
  correctPredictions: number;
  falsePositives: number;
  falseNegatives: number;
  avgConfidenceWins: number;
  avgConfidenceLosses: number;
  calibrationError: number;
  lastUpdate: number;
}

export interface BayesianPrior {
  successRate: number;
  sampleSize: number;
  alpha: number; // Beta distribution parameter
  beta: number;  // Beta distribution parameter
}

export class ConfidenceScorer extends EventEmitter {
  private adaptiveWeights: AdaptiveWeights;
  private performanceTracker: PerformanceTracker;
  private bayesianPrior: BayesianPrior;
  private marketRegimeHistory: MarketRegime[] = [];
  private confidenceHistory: number[] = [];
  private outcomeHistory: number[] = [];
  private factorPerformance: Map<string, number[]> = new Map();
  private readonly MAX_HISTORY_SIZE = 1000;
  private readonly MIN_SAMPLES_FOR_ADAPTATION = 50;
  private readonly CALIBRATION_WINDOW = 100;
  
  // Default weights optimized for tape reading strategies
  private readonly DEFAULT_WEIGHTS: AdaptiveWeights = {
    patternStrength: 0.15,
    volumeConfidence: 0.12,
    liquidityScore: 0.10,
    marketConditions: 0.08,
    riskAssessment: 0.15,
    historicalAccuracy: 0.12,
    timeFactors: 0.05,
    orderFlowStrength: 0.18,
    volatilityStability: 0.03,
    momentumAlignment: 0.02
  };

  constructor(
    private logger: Logger,
    private metricsCollector: MetricsCollector
  ) {
    super();
    this.initializeScorer();
  }

  /**
   * Initialize the confidence scorer with default settings
   */
  private initializeScorer(): void {
    this.adaptiveWeights = { ...this.DEFAULT_WEIGHTS };
    
    this.performanceTracker = {
      totalSignals: 0,
      correctPredictions: 0,
      falsePositives: 0,
      falseNegatives: 0,
      avgConfidenceWins: 0,
      avgConfidenceLosses: 0,
      calibrationError: 0,
      lastUpdate: Date.now()
    };

    this.bayesianPrior = {
      successRate: 0.65, // Starting assumption for tape reading strategies
      sampleSize: 100,
      alpha: 65,  // 65 successes
      beta: 35    // 35 failures
    };

    // Initialize factor performance tracking
    Object.keys(this.DEFAULT_WEIGHTS).forEach(factor => {
      this.factorPerformance.set(factor, []);
    });

    this.logger.info('ConfidenceScorer initialized successfully', {
      defaultWeights: this.adaptiveWeights,
      bayesianPrior: this.bayesianPrior
    });
  }

  /**
   * Calculate comprehensive confidence score for a trading signal
   */
  public calculateConfidence(
    marketData: MarketData,
    tapeEntries: TapeEntry[],
    patterns: PatternMatch[],
    decisionAnalysis: DecisionAnalysis,
    liquidityAnalysis: LiquidityAnalysis
  ): ConfidenceResult {
    const startTime = performance.now();

    try {
      // Extract confidence factors
      const factors = this.extractConfidenceFactors(
        marketData,
        tapeEntries,
        patterns,
        decisionAnalysis,
        liquidityAnalysis
      );

      // Detect current market regime
      const marketRegime = this.detectMarketRegime(marketData, tapeEntries);

      // Adjust weights based on market regime and performance
      const adjustedWeights = this.adjustWeightsForRegime(marketRegime);

      // Calculate base confidence score
      const baseConfidence = this.calculateBaseConfidence(factors, adjustedWeights);

      // Apply Bayesian updating
      const bayesianUpdate = this.calculateBayesianUpdate(baseConfidence, factors);

      // Calculate uncertainty bounds
      const uncertaintyBounds = this.calculateUncertaintyBounds(baseConfidence, factors);

      // Calculate quality metrics
      const qualityMetrics = this.calculateQualityMetrics(factors, marketData, tapeEntries);

      // Final confidence with quality adjustment
      const finalConfidence = this.applyQualityAdjustment(
        bayesianUpdate,
        qualityMetrics,
        marketRegime
      );

      const calculationTime = performance.now() - startTime;

      const result: ConfidenceResult = {
        finalConfidence,
        factors,
        weights: adjustedWeights,
        marketRegime,
        bayesianUpdate,
        uncertaintyBounds,
        qualityMetrics,
        calculationTime,
        recommendations: this.generateRecommendations(factors, finalConfidence, marketRegime),
        warnings: this.generateWarnings(factors, qualityMetrics, calculationTime)
      };

      // Update history for continuous learning
      this.updateHistory(result);

      // Record metrics
      this.metricsCollector.recordMetric('confidence_calculation_time', calculationTime);
      this.metricsCollector.recordMetric('confidence_score', finalConfidence);
      this.metricsCollector.recordMetric('confidence_quality', qualityMetrics.signalClarity);

      this.emit('confidence_calculated', result);

      return result;

    } catch (error) {
      const calculationTime = performance.now() - startTime;
      this.logger.error('Confidence calculation failed', error);
      this.metricsCollector.recordMetric('confidence_calculation_error', 1);
      
      throw new TradingError('Confidence calculation failed', 'CONFIDENCE_ERROR', {
        error: error.message,
        calculationTime
      });
    }
  }

  /**
   * Extract all confidence factors from market data
   */
  private extractConfidenceFactors(
    marketData: MarketData,
    tapeEntries: TapeEntry[],
    patterns: PatternMatch[],
    decisionAnalysis: DecisionAnalysis,
    liquidityAnalysis: LiquidityAnalysis
  ): ConfidenceFactors {
    return {
      patternStrength: this.calculatePatternStrength(patterns),
      volumeConfidence: this.calculateVolumeConfidence(tapeEntries, marketData),
      liquidityScore: this.calculateLiquidityScore(liquidityAnalysis, marketData),
      marketConditions: this.calculateMarketConditions(marketData),
      riskAssessment: this.calculateRiskScore(decisionAnalysis, marketData),
      historicalAccuracy: this.calculateHistoricalAccuracy(patterns),
      timeFactors: this.calculateTimeFactors(marketData),
      orderFlowStrength: this.calculateOrderFlowStrength(tapeEntries),
      volatilityStability: this.calculateVolatilityStability(marketData, tapeEntries),
      momentumAlignment: this.calculateMomentumAlignment(tapeEntries, decisionAnalysis)
    };
  }

  /**
   * Calculate pattern strength confidence factor
   */
  private calculatePatternStrength(patterns: PatternMatch[]): number {
    if (patterns.length === 0) return 0;

    // Weight patterns by confidence and historical success
    let totalWeight = 0;
    let weightedScore = 0;

    patterns.forEach(pattern => {
      const weight = pattern.confidence * pattern.historicalSuccess;
      weightedScore += pattern.probability * weight;
      totalWeight += weight;
    });

    const avgScore = totalWeight > 0 ? weightedScore / totalWeight : 0;

    // Boost confidence for multiple confirming patterns
    const confirmationBoost = Math.min(0.2, (patterns.length - 1) * 0.05);
    
    return Math.min(1, avgScore + confirmationBoost);
  }

  /**
   * Calculate volume confidence based on volume analysis
   */
  private calculateVolumeConfidence(tapeEntries: TapeEntry[], marketData: MarketData): number {
    if (tapeEntries.length === 0) return 0;

    const recentEntries = tapeEntries.slice(-20);
    const avgVolume = recentEntries.reduce((sum, entry) => sum + entry.volume, 0) / recentEntries.length;
    
    // Volume consistency
    const volumeVariance = recentEntries.reduce((sum, entry) => {
      return sum + Math.pow(entry.volume - avgVolume, 2);
    }, 0) / recentEntries.length;
    const volumeStability = 1 - Math.min(1, volumeVariance / (avgVolume * avgVolume));

    // Large order presence
    const largeOrders = recentEntries.filter(entry => entry.isLarge).length / recentEntries.length;
    
    // Dominant order flow
    const dominantOrders = recentEntries.filter(entry => entry.isDominant).length / recentEntries.length;

    // Volume relative to market average
    const relativeVolume = Math.min(2, marketData.volume / avgVolume) / 2;

    return (volumeStability * 0.4 + largeOrders * 0.3 + dominantOrders * 0.2 + relativeVolume * 0.1);
  }

  /**
   * Calculate liquidity confidence score
   */
  private calculateLiquidityScore(liquidityAnalysis: LiquidityAnalysis, marketData: MarketData): number {
    const liquidityLevel = marketData.liquidityLevel === 'high' ? 1 : 
                          marketData.liquidityLevel === 'medium' ? 0.6 : 0.2;
    
    const absorptionStrength = Math.min(1, liquidityAnalysis.absorptionLevel);
    const flowDirectionClarity = liquidityAnalysis.flowDirection === 'neutral' ? 0.3 : 0.8;
    const hiddenLiquidityBonus = Math.max(
      liquidityAnalysis.hiddenBuyLiquidity,
      liquidityAnalysis.hiddenSellLiquidity
    ) * 0.2;

    return Math.min(1, 
      liquidityLevel * 0.5 + 
      absorptionStrength * 0.3 + 
      flowDirectionClarity * 0.2 + 
      hiddenLiquidityBonus
    );
  }

  /**
   * Calculate market conditions confidence factor
   */
  private calculateMarketConditions(marketData: MarketData): number {
    let conditionsScore = 0.5; // Neutral baseline

    // Market phase impact
    const phaseScore = {
      'open': 0.9,
      'close': 0.7,
      'pre-market': 0.3,
      'after-hours': 0.2
    };
    conditionsScore *= phaseScore[marketData.marketPhase] || 0.5;

    // Spread quality
    const spreadQuality = marketData.spread < 0.5 ? 1 : 
                         marketData.spread < 1.0 ? 0.8 : 
                         marketData.spread < 2.0 ? 0.6 : 0.3;
    
    // Volatility appropriateness (not too high, not too low)
    const optimalVolatility = marketData.volatility > 0.005 && marketData.volatility < 0.03 ? 1 : 0.7;

    return (conditionsScore + spreadQuality + optimalVolatility) / 3;
  }

  /**
   * Calculate risk assessment confidence factor
   */
  private calculateRiskScore(decisionAnalysis: DecisionAnalysis, marketData: MarketData): number {
    // Lower risk level = higher confidence
    const riskConfidence = Math.max(0, 1 - decisionAnalysis.riskLevel);
    
    // Stop loss proximity (closer stop = higher confidence)
    const stopProximity = decisionAnalysis.stopLoss > 0 ? 
      Math.min(1, 2 / Math.abs(marketData.price - decisionAnalysis.stopLoss)) : 0.5;
    
    // Risk-reward ratio
    const riskRewardRatio = decisionAnalysis.expectedTarget > 0 && decisionAnalysis.stopLoss > 0 ?
      Math.abs(decisionAnalysis.expectedTarget - marketData.price) / 
      Math.abs(marketData.price - decisionAnalysis.stopLoss) : 1;
    
    const riskRewardScore = riskRewardRatio >= 2 ? 1 : 
                           riskRewardRatio >= 1.5 ? 0.8 : 
                           riskRewardRatio >= 1 ? 0.6 : 0.3;

    return (riskConfidence * 0.5 + stopProximity * 0.2 + riskRewardScore * 0.3);
  }

  /**
   * Calculate historical accuracy confidence factor
   */
  private calculateHistoricalAccuracy(patterns: PatternMatch[]): number {
    if (patterns.length === 0) return 0.5;

    const avgHistoricalSuccess = patterns.reduce((sum, pattern) => 
      sum + pattern.historicalSuccess, 0) / patterns.length;
    
    // Boost for patterns with high sample size (more reliable)
    const sampleSizeBoost = patterns.some(p => p.parameters?.sampleSize > 100) ? 0.1 : 0;
    
    return Math.min(1, avgHistoricalSuccess + sampleSizeBoost);
  }

  /**
   * Calculate time-based confidence factors
   */
  private calculateTimeFactors(marketData: MarketData): number {
    const now = new Date(marketData.timestamp);
    const hour = now.getHours();
    const minute = now.getMinutes();
    
    // Optimal trading hours (9:30-11:00 AM and 2:00-3:30 PM EST)
    let timeScore = 0.5;
    
    if ((hour === 9 && minute >= 30) || (hour >= 10 && hour < 11)) {
      timeScore = 1.0; // Morning session
    } else if (hour >= 14 && hour < 15) {
      timeScore = 0.9; // Afternoon session
    } else if (hour >= 15 && minute <= 30) {
      timeScore = 0.8; // Late afternoon
    } else if (marketData.marketPhase === 'open') {
      timeScore = 0.6; // Other market hours
    }

    // Day of week factors (avoid Fridays afternoon and Mondays morning)
    const dayOfWeek = now.getDay();
    if (dayOfWeek === 5 && hour >= 15) { // Friday afternoon
      timeScore *= 0.8;
    } else if (dayOfWeek === 1 && hour < 10) { // Monday morning
      timeScore *= 0.9;
    }

    return timeScore;
  }

  /**
   * Calculate order flow strength
   */
  private calculateOrderFlowStrength(tapeEntries: TapeEntry[]): number {
    if (tapeEntries.length === 0) return 0;

    const recent = tapeEntries.slice(-30);
    
    // Directional flow strength
    const buyVolume = recent.filter(e => e.aggressor === 'buyer')
      .reduce((sum, e) => sum + e.volume, 0);
    const sellVolume = recent.filter(e => e.aggressor === 'seller')
      .reduce((sum, e) => sum + e.volume, 0);
    const totalVolume = buyVolume + sellVolume;
    
    const imbalance = totalVolume > 0 ? Math.abs(buyVolume - sellVolume) / totalVolume : 0;
    
    // Absorption detection
    const absorptionRate = recent.filter(e => e.absorption).length / recent.length;
    
    // Large order dominance
    const dominantOrderRate = recent.filter(e => e.isDominant).length / recent.length;
    
    return (imbalance * 0.5 + absorptionRate * 0.3 + dominantOrderRate * 0.2);
  }

  /**
   * Calculate volatility stability
   */
  private calculateVolatilityStability(marketData: MarketData, tapeEntries: TapeEntry[]): number {
    const recentPrices = tapeEntries.slice(-20).map(e => e.price);
    if (recentPrices.length < 2) return 0.5;

    // Calculate price changes
    const changes = recentPrices.slice(1).map((price, i) => 
      Math.abs(price - recentPrices[i]) / recentPrices[i]);
    
    const avgChange = changes.reduce((sum, change) => sum + change, 0) / changes.length;
    const volatilityConsistency = changes.every(change => 
      Math.abs(change - avgChange) < avgChange * 0.5) ? 1 : 0.5;
    
    // Prefer moderate volatility
    const currentVolatility = marketData.volatility;
    const optimalVolatility = currentVolatility > 0.01 && currentVolatility < 0.025 ? 1 : 0.6;
    
    return (volatilityConsistency + optimalVolatility) / 2;
  }

  /**
   * Calculate momentum alignment
   */
  private calculateMomentumAlignment(tapeEntries: TapeEntry[], decisionAnalysis: DecisionAnalysis): number {
    if (tapeEntries.length < 10) return 0.5;

    const recent = tapeEntries.slice(-10);
    const prices = recent.map(e => e.price);
    
    // Short-term momentum
    const shortMomentum = prices[prices.length - 1] > prices[prices.length - 5] ? 1 : -1;
    
    // Medium-term momentum  
    const mediumMomentum = prices[prices.length - 1] > prices[0] ? 1 : -1;
    
    // Decision alignment with momentum
    const decisionDirection = decisionAnalysis.recommendation === 'ENTRAR' ? 
      (decisionAnalysis.expectedTarget > prices[prices.length - 1] ? 1 : -1) : 0;
    
    const momentumAlignment = decisionDirection !== 0 ? 
      (shortMomentum === decisionDirection ? 0.6 : 0.2) +
      (mediumMomentum === decisionDirection ? 0.4 : 0.1) : 0.5;
    
    return momentumAlignment;
  }

  /**
   * Detect current market regime
   */
  private detectMarketRegime(marketData: MarketData, tapeEntries: TapeEntry[]): MarketRegime {
    const recentPrices = tapeEntries.slice(-50).map(e => e.price);
    if (recentPrices.length < 10) {
      return { type: 'quiet', strength: 0.5, duration: 0, confidence: 0.5 };
    }

    // Calculate price range and trend
    const priceRange = Math.max(...recentPrices) - Math.min(...recentPrices);
    const avgPrice = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
    const relativeRange = priceRange / avgPrice;

    // Trend detection
    const firstHalf = recentPrices.slice(0, 25);
    const secondHalf = recentPrices.slice(25);
    const firstAvg = firstHalf.reduce((sum, p) => sum + p, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, p) => sum + p, 0) / secondHalf.length;
    const trendStrength = Math.abs(secondAvg - firstAvg) / avgPrice;

    // Volume analysis
    const avgVolume = tapeEntries.slice(-50).reduce((sum, e) => sum + e.volume, 0) / 50;
    const volumeSpike = marketData.volume > avgVolume * 1.5;

    // Determine regime
    let regime: MarketRegime;

    if (relativeRange < 0.002 && marketData.volatility < 0.01) {
      regime = { type: 'quiet', strength: 0.8, duration: 30, confidence: 0.8 };
    } else if (trendStrength > 0.005 && !volumeSpike) {
      regime = { type: 'trending', strength: trendStrength * 100, duration: 15, confidence: 0.75 };
    } else if (relativeRange > 0.008 || marketData.volatility > 0.03) {
      regime = { type: 'volatile', strength: marketData.volatility * 100, duration: 10, confidence: 0.7 };
    } else if (volumeSpike && trendStrength > 0.003) {
      regime = { type: 'breakout', strength: 0.9, duration: 5, confidence: 0.8 };
    } else {
      regime = { type: 'ranging', strength: 0.6, duration: 20, confidence: 0.6 };
    }

    // Update regime history
    this.marketRegimeHistory.push(regime);
    if (this.marketRegimeHistory.length > 100) {
      this.marketRegimeHistory.shift();
    }

    return regime;
  }

  /**
   * Adjust weights based on market regime and performance
   */
  private adjustWeightsForRegime(marketRegime: MarketRegime): AdaptiveWeights {
    const adjustedWeights = { ...this.adaptiveWeights };

    switch (marketRegime.type) {
      case 'trending':
        adjustedWeights.momentumAlignment *= 1.3;
        adjustedWeights.patternStrength *= 1.2;
        adjustedWeights.orderFlowStrength *= 0.9;
        break;
        
      case 'ranging':
        adjustedWeights.liquidityScore *= 1.2;
        adjustedWeights.volatilityStability *= 1.3;
        adjustedWeights.momentumAlignment *= 0.8;
        break;
        
      case 'volatile':
        adjustedWeights.riskAssessment *= 1.4;
        adjustedWeights.volatilityStability *= 0.7;
        adjustedWeights.orderFlowStrength *= 1.2;
        break;
        
      case 'quiet':
        adjustedWeights.patternStrength *= 0.8;
        adjustedWeights.volumeConfidence *= 0.7;
        adjustedWeights.timeFactors *= 1.2;
        break;
        
      case 'breakout':
        adjustedWeights.volumeConfidence *= 1.4;
        adjustedWeights.momentumAlignment *= 1.3;
        adjustedWeights.liquidityScore *= 1.1;
        break;
    }

    // Normalize weights to sum to 1
    const totalWeight = Object.values(adjustedWeights).reduce((sum, weight) => sum + weight, 0);
    Object.keys(adjustedWeights).forEach(key => {
      adjustedWeights[key] /= totalWeight;
    });

    return adjustedWeights;
  }

  /**
   * Calculate base confidence using weighted factors
   */
  private calculateBaseConfidence(factors: ConfidenceFactors, weights: AdaptiveWeights): number {
    let weightedSum = 0;
    
    Object.entries(factors).forEach(([factor, value]) => {
      const weight = weights[factor as keyof AdaptiveWeights];
      weightedSum += value * weight;
    });

    return Math.max(0, Math.min(1, weightedSum));
  }

  /**
   * Calculate Bayesian confidence update
   */
  private calculateBayesianUpdate(baseConfidence: number, factors: ConfidenceFactors): number {
    // Update prior based on new evidence
    const evidenceStrength = (factors.patternStrength + factors.historicalAccuracy) / 2;
    const priorConfidence = this.bayesianPrior.alpha / (this.bayesianPrior.alpha + this.bayesianPrior.beta);
    
    // Bayesian updating formula
    const posteriorConfidence = (baseConfidence * evidenceStrength + priorConfidence * (1 - evidenceStrength));
    
    return Math.max(0, Math.min(1, posteriorConfidence));
  }

  /**
   * Calculate uncertainty bounds for confidence interval
   */
  private calculateUncertaintyBounds(confidence: number, factors: ConfidenceFactors): [number, number] {
    // Calculate uncertainty based on factor variance and data quality
    const factorValues = Object.values(factors);
    const mean = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;
    const variance = factorValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / factorValues.length;
    const uncertainty = Math.sqrt(variance) * 0.5; // Scale uncertainty
    
    const lowerBound = Math.max(0, confidence - uncertainty);
    const upperBound = Math.min(1, confidence + uncertainty);
    
    return [lowerBound, upperBound];
  }

  /**
   * Calculate quality metrics for the confidence calculation
   */
  private calculateQualityMetrics(
    factors: ConfidenceFactors,
    marketData: MarketData,
    tapeEntries: TapeEntry[]
  ): QualityMetrics {
    // Signal clarity - how clear and consistent the factors are
    const factorValues = Object.values(factors);
    const mean = factorValues.reduce((sum, val) => sum + val, 0) / factorValues.length;
    const consistency = 1 - Math.sqrt(factorValues.reduce((sum, val) => 
      sum + Math.pow(val - mean, 2), 0) / factorValues.length);
    
    // Data completeness - how much data is available
    const completeness = Math.min(1, tapeEntries.length / 50); // Need at least 50 tape entries for full score
    
    // Factor agreement - how well factors align
    const highFactors = factorValues.filter(val => val > 0.7).length;
    const lowFactors = factorValues.filter(val => val < 0.3).length;
    const agreement = highFactors > lowFactors ? highFactors / factorValues.length : 
                     lowFactors > highFactors ? lowFactors / factorValues.length : 0.5;
    
    // Temporal consistency - consistency over time
    const temporalConsistency = this.confidenceHistory.length > 5 ? 
      this.calculateTemporalConsistency() : 0.5;
    
    // Cross-validation score based on historical performance
    const crossValidation = this.performanceTracker.totalSignals > 20 ? 
      this.performanceTracker.correctPredictions / this.performanceTracker.totalSignals : 0.6;
    
    return {
      signalClarity: consistency,
      dataCompleteness: completeness,
      factorAgreement: agreement,
      temporalConsistency,
      crossValidation
    };
  }

  /**
   * Calculate temporal consistency of confidence scores
   */
  private calculateTemporalConsistency(): number {
    if (this.confidenceHistory.length < 5) return 0.5;
    
    const recent = this.confidenceHistory.slice(-5);
    const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
    
    return Math.max(0, 1 - variance);
  }

  /**
   * Apply quality adjustment to final confidence
   */
  private applyQualityAdjustment(
    bayesianConfidence: number,
    qualityMetrics: QualityMetrics,
    marketRegime: MarketRegime
  ): number {
    const qualityScore = (
      qualityMetrics.signalClarity * 0.3 +
      qualityMetrics.dataCompleteness * 0.2 +
      qualityMetrics.factorAgreement * 0.2 +
      qualityMetrics.temporalConsistency * 0.15 +
      qualityMetrics.crossValidation * 0.15
    );
    
    // Apply quality adjustment
    let adjustedConfidence = bayesianConfidence * (0.7 + qualityScore * 0.3);
    
    // Market regime confidence boost/penalty
    adjustedConfidence *= marketRegime.confidence;
    
    return Math.max(0, Math.min(1, adjustedConfidence));
  }

  /**
   * Generate recommendations based on confidence analysis
   */
  private generateRecommendations(
    factors: ConfidenceFactors,
    finalConfidence: number,
    marketRegime: MarketRegime
  ): string[] {
    const recommendations: string[] = [];
    
    if (finalConfidence >= 0.9) {
      recommendations.push('High confidence signal - consider position sizing increase');
    } else if (finalConfidence >= 0.7) {
      recommendations.push('Good signal quality - proceed with standard position size');
    } else if (finalConfidence >= 0.5) {
      recommendations.push('Moderate confidence - consider reduced position size');
    } else {
      recommendations.push('Low confidence - avoid entry or wait for better setup');
    }
    
    // Factor-specific recommendations
    if (factors.liquidityScore < 0.3) {
      recommendations.push('Low liquidity detected - use limit orders and expect higher slippage');
    }
    
    if (factors.riskAssessment < 0.4) {
      recommendations.push('High risk environment - tighten stop losses');
    }
    
    if (marketRegime.type === 'volatile') {
      recommendations.push('Volatile market - consider wider stops and smaller positions');
    }
    
    if (factors.timeFactors < 0.4) {
      recommendations.push('Suboptimal timing - consider waiting for better market hours');
    }
    
    return recommendations;
  }

  /**
   * Generate warnings based on analysis
   */
  private generateWarnings(
    factors: ConfidenceFactors,
    qualityMetrics: QualityMetrics,
    calculationTime: number
  ): string[] {
    const warnings: string[] = [];
    
    if (calculationTime > 5) { // 5ms threshold
      warnings.push(`Confidence calculation time exceeded threshold: ${calculationTime.toFixed(2)}ms`);
    }
    
    if (qualityMetrics.dataCompleteness < 0.5) {
      warnings.push('Insufficient market data for reliable confidence calculation');
    }
    
    if (qualityMetrics.factorAgreement < 0.4) {
      warnings.push('Low factor agreement - conflicting signals detected');
    }
    
    if (factors.marketConditions < 0.3) {
      warnings.push('Poor market conditions for trading');
    }
    
    if (qualityMetrics.crossValidation < 0.5) {
      warnings.push('Historical performance below average - exercise caution');
    }
    
    return warnings;
  }

  /**
   * Update historical data for continuous learning
   */
  private updateHistory(result: ConfidenceResult): void {
    this.confidenceHistory.push(result.finalConfidence);
    if (this.confidenceHistory.length > this.MAX_HISTORY_SIZE) {
      this.confidenceHistory.shift();
    }
  }

  /**
   * Update confidence scorer based on actual trading outcome
   */
  public updatePerformance(confidence: number, outcome: 'win' | 'loss' | 'breakeven'): void {
    this.performanceTracker.totalSignals++;
    
    const outcomeValue = outcome === 'win' ? 1 : outcome === 'breakeven' ? 0.5 : 0;
    this.outcomeHistory.push(outcomeValue);
    
    if (outcome === 'win') {
      this.performanceTracker.correctPredictions++;
      this.performanceTracker.avgConfidenceWins = 
        (this.performanceTracker.avgConfidenceWins + confidence) / 2;
    } else if (outcome === 'loss') {
      this.performanceTracker.avgConfidenceLosses = 
        (this.performanceTracker.avgConfidenceLosses + confidence) / 2;
    }
    
    // Update Bayesian prior
    if (outcome === 'win') {
      this.bayesianPrior.alpha++;
    } else if (outcome === 'loss') {
      this.bayesianPrior.beta++;
    }
    
    // Recalibrate weights if we have enough samples
    if (this.performanceTracker.totalSignals % this.MIN_SAMPLES_FOR_ADAPTATION === 0) {
      this.recalibrateWeights();
    }
    
    this.performanceTracker.lastUpdate = Date.now();
    
    this.logger.info('Confidence scorer performance updated', {
      outcome,
      confidence,
      totalSignals: this.performanceTracker.totalSignals,
      accuracy: this.performanceTracker.correctPredictions / this.performanceTracker.totalSignals
    });
  }

  /**
   * Recalibrate adaptive weights based on performance
   */
  private recalibrateWeights(): void {
    if (this.performanceTracker.totalSignals < this.MIN_SAMPLES_FOR_ADAPTATION) return;

    // Calculate calibration error
    const recentOutcomes = this.outcomeHistory.slice(-this.CALIBRATION_WINDOW);
    const recentConfidences = this.confidenceHistory.slice(-this.CALIBRATION_WINDOW);
    
    let calibrationError = 0;
    for (let i = 0; i < recentOutcomes.length; i++) {
      calibrationError += Math.pow(recentConfidences[i] - recentOutcomes[i], 2);
    }
    calibrationError = Math.sqrt(calibrationError / recentOutcomes.length);
    
    this.performanceTracker.calibrationError = calibrationError;
    
    // Adjust weights based on individual factor performance
    // This is a simplified approach - in production, you might use more sophisticated methods
    const performanceThreshold = 0.6;
    const currentAccuracy = this.performanceTracker.correctPredictions / this.performanceTracker.totalSignals;
    
    if (currentAccuracy < performanceThreshold) {
      // Reduce weights of underperforming factors
      Object.keys(this.adaptiveWeights).forEach(factor => {
        const factorPerf = this.factorPerformance.get(factor) || [];
        if (factorPerf.length > 10) {
          const factorAccuracy = factorPerf.slice(-20).reduce((sum, val) => sum + val, 0) / 20;
          if (factorAccuracy < performanceThreshold) {
            this.adaptiveWeights[factor as keyof AdaptiveWeights] *= 0.95;
          }
        }
      });
      
      // Normalize weights
      const totalWeight = Object.values(this.adaptiveWeights).reduce((sum, weight) => sum + weight, 0);
      Object.keys(this.adaptiveWeights).forEach(key => {
        this.adaptiveWeights[key as keyof AdaptiveWeights] /= totalWeight;
      });
    }
    
    this.logger.info('Weights recalibrated', {
      accuracy: currentAccuracy,
      calibrationError,
      newWeights: this.adaptiveWeights
    });
  }

  /**
   * Get confidence scorer statistics
   */
  public getPerformanceStats(): any {
    return {
      performance: this.performanceTracker,
      bayesianPrior: this.bayesianPrior,
      currentWeights: this.adaptiveWeights,
      historySize: this.confidenceHistory.length,
      recentRegimes: this.marketRegimeHistory.slice(-5)
    };
  }
}

export default ConfidenceScorer;