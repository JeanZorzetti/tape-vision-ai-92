/**
 * Adaptive Pattern Learning System
 * 
 * This critical component continuously learns market patterns through real-time feedback
 * and adapts trading algorithms based on evolving market conditions. It implements
 * sophisticated machine learning techniques for pattern discovery, validation, and evolution.
 * 
 * Key Features:
 * - Real-time pattern discovery from market microstructure
 * - Adaptive learning with continuous feedback loops
 * - Pattern evolution tracking and validation
 * - Automated feature engineering for new patterns
 * - Performance-based pattern scoring and ranking
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import * as tf from '@tensorflow/tfjs-node';
import {
  MarketData,
  TapeEntry,
  PatternMatch,
  DecisionAnalysis,
  TradingError,
  Position
} from '../../types/trading';
import { Logger } from '../../utils/Logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';

export interface LearnedPattern {
  id: string;
  name: string;
  type: PatternType;
  features: PatternFeatures;
  parameters: PatternParameters;
  performance: PatternPerformance;
  confidence: number;
  reliability: number;
  sampleSize: number;
  lastSeen: number;
  createdAt: number;
  updatedAt: number;
  isActive: boolean;
}

export interface PatternFeatures {
  priceAction: number[];
  volumeProfile: number[];
  orderFlow: number[];
  timeSignature: number[];
  marketContext: number[];
  technicalIndicators: number[];
}

export interface PatternParameters {
  entryThreshold: number;
  exitThreshold: number;
  stopLossDistance: number;
  takeProfitDistance: number;
  timeWindow: number;
  volumeThreshold: number;
  confidenceRequired: number;
}

export interface PatternPerformance {
  totalOccurrences: number;
  successfulTrades: number;
  failedTrades: number;
  avgReturn: number;
  maxReturn: number;
  minReturn: number;
  sharpeRatio: number;
  winRate: number;
  avgDuration: number;
  volatilityAdjustedReturn: number;
  maxDrawdown: number;
  profitFactor: number;
}

export interface LearningFeedback {
  patternId: string;
  outcome: 'success' | 'failure' | 'partial';
  actualReturn: number;
  duration: number;
  marketConditions: MarketConditions;
  slippage: number;
  timestamp: number;
}

export interface MarketConditions {
  volatility: number;
  volume: number;
  spread: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  strength: number;
  session: 'opening' | 'mid' | 'closing';
}

export interface PatternDiscovery {
  candidatePattern: LearnedPattern;
  confidence: number;
  supportingEvidence: number;
  similarPatterns: string[];
  validationRequired: boolean;
}

export enum PatternType {
  TAPE_READING = 'tape_reading',
  ORDER_FLOW = 'order_flow',
  ABSORPTION = 'absorption',
  LIQUIDITY_SWEEP = 'liquidity_sweep',
  MOMENTUM_SHIFT = 'momentum_shift',
  VOLUME_SPIKE = 'volume_spike',
  PRICE_REJECTION = 'price_rejection',
  HIDDEN_LIQUIDITY = 'hidden_liquidity'
}

export interface LearningConfig {
  minSampleSize: number;
  confidenceThreshold: number;
  maxPatterns: number;
  learningRate: number;
  forgettingFactor: number;
  validationPeriod: number;
  patternExpiryDays: number;
}

export class PatternLearner extends EventEmitter {
  private learnedPatterns: Map<string, LearnedPattern> = new Map();
  private patternBuffer: Map<string, any[]> = new Map();
  private feedbackHistory: LearningFeedback[] = [];
  private featureExtractor: tf.LayersModel | null = null;
  private patternClassifier: tf.LayersModel | null = null;
  private discoveryThreshold: number = 0.75;
  private validationModel: tf.LayersModel | null = null;
  
  private readonly config: LearningConfig = {
    minSampleSize: 20,
    confidenceThreshold: 0.8,
    maxPatterns: 100,
    learningRate: 0.01,
    forgettingFactor: 0.99,
    validationPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
    patternExpiryDays: 30
  };

  constructor(
    private logger: Logger,
    private metricsCollector: MetricsCollector
  ) {
    super();
    this.initializeLearningSystem();
  }

  /**
   * Initialize the pattern learning system
   */
  private async initializeLearningSystem(): Promise<void> {
    try {
      const startTime = performance.now();

      // Initialize neural networks for pattern learning
      await this.initializeNeuralNetworks();

      // Load existing patterns from storage
      await this.loadExistingPatterns();

      // Initialize pattern buffers
      Object.values(PatternType).forEach(type => {
        this.patternBuffer.set(type, []);
      });

      const initTime = performance.now() - startTime;
      
      this.metricsCollector.recordMetric('pattern_learner_init_time', initTime);
      this.logger.info('PatternLearner initialized successfully', {
        patternsLoaded: this.learnedPatterns.size,
        initializationTime: initTime
      });

      this.emit('initialized', { patternsCount: this.learnedPatterns.size });

    } catch (error) {
      this.logger.error('Failed to initialize PatternLearner', error);
      throw new TradingError('PatternLearner initialization failed', 'PATTERN_LEARNER_INIT_ERROR', error);
    }
  }

  /**
   * Initialize neural networks for pattern learning
   */
  private async initializeNeuralNetworks(): Promise<void> {
    try {
      // Feature extraction network - autoencoder for dimensionality reduction
      this.featureExtractor = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [100], units: 64, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.1 }),
          tf.layers.dense({ units: 16, activation: 'relu' }), // Compressed features
          tf.layers.dense({ units: 32, activation: 'relu' }),
          tf.layers.dense({ units: 64, activation: 'relu' }),
          tf.layers.dense({ units: 100, activation: 'linear' }) // Reconstruction
        ]
      });

      this.featureExtractor.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError'
      });

      // Pattern classification network
      this.patternClassifier = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [16], units: 32, activation: 'relu' }),
          tf.layers.batchNormalization(),
          tf.layers.dropout({ rate: 0.3 }),
          tf.layers.dense({ units: 24, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: Object.keys(PatternType).length, activation: 'softmax' })
        ]
      });

      this.patternClassifier.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });

      // Pattern validation network
      this.validationModel = tf.sequential({
        layers: [
          tf.layers.dense({ inputShape: [20], units: 16, activation: 'relu' }),
          tf.layers.dropout({ rate: 0.2 }),
          tf.layers.dense({ units: 8, activation: 'relu' }),
          tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Success probability
        ]
      });

      this.validationModel.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });

      this.logger.info('Neural networks initialized for pattern learning');

    } catch (error) {
      this.logger.error('Failed to initialize neural networks', error);
      throw error;
    }
  }

  /**
   * Load existing patterns from storage
   */
  private async loadExistingPatterns(): Promise<void> {
    // In a real implementation, this would load from a database
    // For now, we'll initialize with some baseline patterns
    const baselinePatterns = this.createBaselinePatterns();
    
    baselinePatterns.forEach(pattern => {
      this.learnedPatterns.set(pattern.id, pattern);
    });

    this.logger.info(`Loaded ${baselinePatterns.length} baseline patterns`);
  }

  /**
   * Create baseline patterns for initial learning
   */
  private createBaselinePatterns(): LearnedPattern[] {
    return [
      {
        id: 'aggressive_absorption_buy',
        name: 'Aggressive Buy Absorption',
        type: PatternType.ABSORPTION,
        features: {
          priceAction: [1, 0.8, 0.9, 1.1, 1.2],
          volumeProfile: [2, 2.5, 3, 2.8, 2.2],
          orderFlow: [0.8, 0.9, 0.95, 0.85, 0.7],
          timeSignature: [0.9, 1.0, 0.8],
          marketContext: [0.7, 0.8, 0.9],
          technicalIndicators: [0.75, 0.82]
        },
        parameters: {
          entryThreshold: 0.85,
          exitThreshold: 0.3,
          stopLossDistance: 1.0,
          takeProfitDistance: 2.0,
          timeWindow: 300000, // 5 minutes
          volumeThreshold: 1.5,
          confidenceRequired: 0.8
        },
        performance: {
          totalOccurrences: 45,
          successfulTrades: 32,
          failedTrades: 13,
          avgReturn: 0.15,
          maxReturn: 0.8,
          minReturn: -0.5,
          sharpeRatio: 1.2,
          winRate: 0.71,
          avgDuration: 180000, // 3 minutes
          volatilityAdjustedReturn: 0.18,
          maxDrawdown: 0.3,
          profitFactor: 2.1
        },
        confidence: 0.82,
        reliability: 0.78,
        sampleSize: 45,
        lastSeen: Date.now() - 3600000, // 1 hour ago
        createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        updatedAt: Date.now() - 3600000,
        isActive: true
      },
      {
        id: 'momentum_shift_reversal',
        name: 'Momentum Shift Reversal',
        type: PatternType.MOMENTUM_SHIFT,
        features: {
          priceAction: [-0.5, -0.3, 0.1, 0.4, 0.7],
          volumeProfile: [1.2, 1.8, 2.5, 2.2, 1.9],
          orderFlow: [-0.8, -0.6, 0.2, 0.7, 0.9],
          timeSignature: [0.8, 0.9, 1.0],
          marketContext: [0.6, 0.8, 0.9],
          technicalIndicators: [0.65, 0.78]
        },
        parameters: {
          entryThreshold: 0.8,
          exitThreshold: 0.25,
          stopLossDistance: 1.2,
          takeProfitDistance: 2.5,
          timeWindow: 450000, // 7.5 minutes
          volumeThreshold: 1.8,
          confidenceRequired: 0.75
        },
        performance: {
          totalOccurrences: 28,
          successfulTrades: 19,
          failedTrades: 9,
          avgReturn: 0.22,
          maxReturn: 1.2,
          minReturn: -0.7,
          sharpeRatio: 1.4,
          winRate: 0.68,
          avgDuration: 240000, // 4 minutes
          volatilityAdjustedReturn: 0.25,
          maxDrawdown: 0.4,
          profitFactor: 2.3
        },
        confidence: 0.79,
        reliability: 0.74,
        sampleSize: 28,
        lastSeen: Date.now() - 7200000, // 2 hours ago
        createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000, // 25 days ago
        updatedAt: Date.now() - 7200000,
        isActive: true
      }
    ];
  }

  /**
   * Analyze incoming market data for pattern discovery
   */
  public async analyzeForPatterns(
    marketData: MarketData,
    tapeEntries: TapeEntry[],
    windowSize: number = 50
  ): Promise<PatternDiscovery[]> {
    if (!this.featureExtractor || !this.patternClassifier) {
      throw new TradingError('Pattern learning models not initialized', 'MODELS_NOT_READY');
    }

    const startTime = performance.now();
    const discoveries: PatternDiscovery[] = [];

    try {
      // Extract features from current market state
      const currentFeatures = this.extractMarketFeatures(marketData, tapeEntries, windowSize);
      
      // Check for existing pattern matches first
      const existingMatches = await this.matchExistingPatterns(currentFeatures);
      
      // Look for new pattern candidates
      const newCandidates = await this.discoverNewPatterns(currentFeatures, marketData);
      
      discoveries.push(...existingMatches, ...newCandidates);

      // Update pattern buffers for continuous learning
      this.updatePatternBuffers(currentFeatures, marketData);

      const analysisTime = performance.now() - startTime;
      
      this.metricsCollector.recordMetric('pattern_analysis_time', analysisTime);
      this.metricsCollector.recordMetric('patterns_discovered', discoveries.length);

      if (discoveries.length > 0) {
        this.emit('patterns_discovered', discoveries);
      }

      return discoveries;

    } catch (error) {
      this.logger.error('Pattern analysis failed', error);
      throw new TradingError('Pattern analysis failed', 'PATTERN_ANALYSIS_ERROR', error);
    }
  }

  /**
   * Extract comprehensive market features for pattern analysis
   */
  private extractMarketFeatures(
    marketData: MarketData,
    tapeEntries: TapeEntry[],
    windowSize: number
  ): PatternFeatures {
    const recentTape = tapeEntries.slice(-windowSize);
    
    return {
      priceAction: this.extractPriceActionFeatures(recentTape, marketData),
      volumeProfile: this.extractVolumeProfileFeatures(recentTape),
      orderFlow: this.extractOrderFlowFeatures(recentTape),
      timeSignature: this.extractTimeSignatureFeatures(marketData, recentTape),
      marketContext: this.extractMarketContextFeatures(marketData),
      technicalIndicators: this.extractTechnicalIndicators(recentTape, marketData)
    };
  }

  /**
   * Extract price action features
   */
  private extractPriceActionFeatures(tapeEntries: TapeEntry[], marketData: MarketData): number[] {
    if (tapeEntries.length === 0) return new Array(20).fill(0);

    const prices = tapeEntries.map(entry => entry.price);
    const returns = prices.slice(1).map((price, i) => (price - prices[i]) / prices[i]);
    
    // Calculate various price action metrics
    const features = [
      // Price momentum
      returns.slice(-5).reduce((sum, ret) => sum + ret, 0), // 5-period momentum
      returns.slice(-10).reduce((sum, ret) => sum + ret, 0), // 10-period momentum
      
      // Price volatility
      this.calculateVolatility(returns.slice(-10)),
      this.calculateVolatility(returns.slice(-20)),
      
      // Price levels
      (marketData.price - Math.min(...prices.slice(-20))) / marketData.price,
      (Math.max(...prices.slice(-20)) - marketData.price) / marketData.price,
      
      // Support/Resistance strength
      this.calculateSupportResistanceStrength(prices),
      
      // Price acceleration
      ...this.calculatePriceAcceleration(prices.slice(-10))
    ];

    // Pad or truncate to ensure consistent length
    return features.slice(0, 20).concat(new Array(Math.max(0, 20 - features.length)).fill(0));
  }

  /**
   * Extract volume profile features
   */
  private extractVolumeProfileFeatures(tapeEntries: TapeEntry[]): number[] {
    if (tapeEntries.length === 0) return new Array(20).fill(0);

    const volumes = tapeEntries.map(entry => entry.volume);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    
    const features = [
      // Volume trends
      volumes.slice(-5).reduce((sum, vol) => sum + vol, 0) / (avgVolume * 5),
      volumes.slice(-10).reduce((sum, vol) => sum + vol, 0) / (avgVolume * 10),
      
      // Volume spikes
      volumes.filter(vol => vol > avgVolume * 2).length / volumes.length,
      volumes.filter(vol => vol > avgVolume * 3).length / volumes.length,
      
      // Volume distribution
      ...this.calculateVolumeDistribution(volumes),
      
      // Volume-price relationship
      ...this.calculateVolumePriceRelationship(tapeEntries.slice(-15))
    ];

    return features.slice(0, 20).concat(new Array(Math.max(0, 20 - features.length)).fill(0));
  }

  /**
   * Extract order flow features
   */
  private extractOrderFlowFeatures(tapeEntries: TapeEntry[]): number[] {
    if (tapeEntries.length === 0) return new Array(20).fill(0);

    const buyTicks = tapeEntries.filter(entry => entry.aggressor === 'buyer');
    const sellTicks = tapeEntries.filter(entry => entry.aggressor === 'seller');
    
    const buyVolume = buyTicks.reduce((sum, tick) => sum + tick.volume, 0);
    const sellVolume = sellTicks.reduce((sum, tick) => sum + tick.volume, 0);
    const totalVolume = buyVolume + sellVolume;
    
    const features = [
      // Order flow imbalance
      totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0,
      
      // Aggressor ratios
      buyTicks.length / tapeEntries.length,
      sellTicks.length / tapeEntries.length,
      
      // Large order analysis
      tapeEntries.filter(entry => entry.isLarge).length / tapeEntries.length,
      tapeEntries.filter(entry => entry.isDominant).length / tapeEntries.length,
      
      // Absorption analysis
      tapeEntries.filter(entry => entry.absorption).length / tapeEntries.length,
      
      // Order flow momentum
      ...this.calculateOrderFlowMomentum(tapeEntries.slice(-10))
    ];

    return features.slice(0, 20).concat(new Array(Math.max(0, 20 - features.length)).fill(0));
  }

  /**
   * Extract time signature features
   */
  private extractTimeSignatureFeatures(marketData: MarketData, tapeEntries: TapeEntry[]): number[] {
    const now = new Date(marketData.timestamp);
    
    return [
      // Time of day (normalized)
      (now.getHours() * 60 + now.getMinutes()) / 1440,
      
      // Market session
      marketData.marketPhase === 'open' ? 1 : 
      marketData.marketPhase === 'close' ? 0.7 : 
      marketData.marketPhase === 'pre-market' ? 0.3 : 0.1,
      
      // Tick frequency
      tapeEntries.length > 1 ? 
        tapeEntries.length / ((tapeEntries[tapeEntries.length - 1].timestamp - tapeEntries[0].timestamp) / 1000) : 0
    ];
  }

  /**
   * Extract market context features
   */
  private extractMarketContextFeatures(marketData: MarketData): number[] {
    return [
      // Volatility regime
      marketData.volatility,
      
      // Liquidity conditions
      marketData.liquidityLevel === 'high' ? 1 : 
      marketData.liquidityLevel === 'medium' ? 0.6 : 0.2,
      
      // Spread conditions
      Math.min(1, marketData.spread / 2), // Normalize spread
      
      // Order book imbalance
      marketData.orderBookImbalance
    ];
  }

  /**
   * Extract technical indicators
   */
  private extractTechnicalIndicators(tapeEntries: TapeEntry[], marketData: MarketData): number[] {
    if (tapeEntries.length < 10) return [0, 0, 0, 0];

    const prices = tapeEntries.map(entry => entry.price);
    
    return [
      // Simple moving average comparison
      marketData.price > this.calculateSMA(prices.slice(-10)) ? 1 : 0,
      
      // Price position in range
      (marketData.price - Math.min(...prices.slice(-20))) / 
      (Math.max(...prices.slice(-20)) - Math.min(...prices.slice(-20))),
      
      // Relative strength
      this.calculateRelativeStrength(prices.slice(-14)),
      
      // Momentum oscillator
      this.calculateMomentumOscillator(prices.slice(-10))
    ];
  }

  // Helper calculation methods
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private calculateSupportResistanceStrength(prices: number[]): number {
    // Simplified support/resistance calculation
    const levels = new Map<number, number>();
    const tolerance = 0.001; // 0.1% tolerance

    prices.forEach(price => {
      const level = Math.round(price / tolerance) * tolerance;
      levels.set(level, (levels.get(level) || 0) + 1);
    });

    const maxTouches = Math.max(...levels.values());
    return maxTouches / prices.length;
  }

  private calculatePriceAcceleration(prices: number[]): number[] {
    if (prices.length < 3) return [0, 0, 0];
    
    const velocities = prices.slice(1).map((price, i) => price - prices[i]);
    const accelerations = velocities.slice(1).map((vel, i) => vel - velocities[i]);
    
    return [
      velocities[velocities.length - 1] || 0,
      accelerations[accelerations.length - 1] || 0,
      accelerations.reduce((sum, acc) => sum + acc, 0) / accelerations.length || 0
    ];
  }

  private calculateVolumeDistribution(volumes: number[]): number[] {
    if (volumes.length === 0) return [0, 0, 0, 0];

    volumes.sort((a, b) => a - b);
    const q1 = volumes[Math.floor(volumes.length * 0.25)];
    const median = volumes[Math.floor(volumes.length * 0.5)];
    const q3 = volumes[Math.floor(volumes.length * 0.75)];
    const max = volumes[volumes.length - 1];

    return [q1 / max, median / max, q3 / max, (q3 - q1) / max]; // IQR
  }

  private calculateVolumePriceRelationship(entries: TapeEntry[]): number[] {
    if (entries.length < 5) return [0, 0, 0];

    // Calculate price-volume correlation
    const prices = entries.map(e => e.price);
    const volumes = entries.map(e => e.volume);
    
    const correlation = this.calculateCorrelation(prices, volumes);
    const avgPriceVolume = entries.reduce((sum, e) => sum + (e.price * e.volume), 0) / entries.length;
    const volumeWeightedPrice = avgPriceVolume / volumes.reduce((sum, v) => sum + v, 0) * volumes.length;

    return [correlation, avgPriceVolume / 1000000, volumeWeightedPrice];
  }

  private calculateOrderFlowMomentum(entries: TapeEntry[]): number[] {
    if (entries.length < 5) return [0, 0, 0, 0];

    const buyMomentum = entries.filter(e => e.aggressor === 'buyer')
      .reduce((sum, e, i, arr) => sum + e.volume * Math.pow(0.9, arr.length - i - 1), 0);
    
    const sellMomentum = entries.filter(e => e.aggressor === 'seller')
      .reduce((sum, e, i, arr) => sum + e.volume * Math.pow(0.9, arr.length - i - 1), 0);
    
    const totalMomentum = buyMomentum + sellMomentum;
    const netMomentum = totalMomentum > 0 ? (buyMomentum - sellMomentum) / totalMomentum : 0;

    return [
      buyMomentum / 1000,
      sellMomentum / 1000,
      netMomentum,
      totalMomentum / 1000
    ];
  }

  private calculateSMA(prices: number[]): number {
    return prices.reduce((sum, price) => sum + price, 0) / prices.length;
  }

  private calculateRelativeStrength(prices: number[]): number {
    if (prices.length < 2) return 0.5;
    
    const gains = [];
    const losses = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains.push(change);
      else if (change < 0) losses.push(-change);
    }
    
    const avgGain = gains.length > 0 ? gains.reduce((sum, gain) => sum + gain, 0) / gains.length : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((sum, loss) => sum + loss, 0) / losses.length : 0;
    
    if (avgLoss === 0) return 1;
    const rs = avgGain / avgLoss;
    return rs / (1 + rs); // RSI formula normalized to 0-1
  }

  private calculateMomentumOscillator(prices: number[]): number {
    if (prices.length < 5) return 0;
    const currentPrice = prices[prices.length - 1];
    const pastPrice = prices[prices.length - 5];
    return (currentPrice - pastPrice) / pastPrice;
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length < 2) return 0;

    const n = x.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumX2 = x.reduce((sum, val) => sum + val * val, 0);
    const sumY2 = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Match current features against existing patterns
   */
  private async matchExistingPatterns(currentFeatures: PatternFeatures): Promise<PatternDiscovery[]> {
    const matches: PatternDiscovery[] = [];

    for (const [patternId, pattern] of this.learnedPatterns) {
      if (!pattern.isActive) continue;

      const similarity = this.calculatePatternSimilarity(currentFeatures, pattern.features);
      
      if (similarity > pattern.parameters.confidenceRequired) {
        matches.push({
          candidatePattern: pattern,
          confidence: similarity,
          supportingEvidence: pattern.sampleSize,
          similarPatterns: this.findSimilarPatterns(pattern, 3),
          validationRequired: false
        });
      }
    }

    return matches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Calculate similarity between feature sets
   */
  private calculatePatternSimilarity(features1: PatternFeatures, features2: PatternFeatures): number {
    const weights = {
      priceAction: 0.25,
      volumeProfile: 0.20,
      orderFlow: 0.25,
      timeSignature: 0.10,
      marketContext: 0.15,
      technicalIndicators: 0.05
    };

    let totalSimilarity = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([feature, weight]) => {
      const f1 = features1[feature as keyof PatternFeatures] as number[];
      const f2 = features2[feature as keyof PatternFeatures] as number[];
      
      if (f1.length > 0 && f2.length > 0) {
        const similarity = this.calculateVectorSimilarity(f1, f2);
        totalSimilarity += similarity * weight;
        totalWeight += weight;
      }
    });

    return totalWeight > 0 ? totalSimilarity / totalWeight : 0;
  }

  /**
   * Calculate similarity between two feature vectors
   */
  private calculateVectorSimilarity(v1: number[], v2: number[]): number {
    const minLength = Math.min(v1.length, v2.length);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < minLength; i++) {
      dotProduct += v1[i] * v2[i];
      norm1 += v1[i] * v1[i];
      norm2 += v2[i] * v2[i];
    }

    const magnitude = Math.sqrt(norm1) * Math.sqrt(norm2);
    return magnitude > 0 ? dotProduct / magnitude : 0;
  }

  /**
   * Discover new pattern candidates
   */
  private async discoverNewPatterns(
    currentFeatures: PatternFeatures,
    marketData: MarketData
  ): Promise<PatternDiscovery[]> {
    if (!this.patternClassifier) return [];

    const discoveries: PatternDiscovery[] = [];

    try {
      // Use neural network to classify potential new patterns
      const flattenedFeatures = this.flattenFeatures(currentFeatures);
      const input = tf.tensor2d([flattenedFeatures.slice(0, 16)], [1, 16]);
      
      const prediction = this.patternClassifier.predict(input) as tf.Tensor;
      const predictionData = await prediction.data();
      
      input.dispose();
      prediction.dispose();

      // Check if any pattern type has high confidence
      const patternTypes = Object.values(PatternType);
      predictionData.forEach((confidence, index) => {
        if (confidence > this.discoveryThreshold && index < patternTypes.length) {
          const patternType = patternTypes[index];
          
          // Create candidate pattern
          const candidate = this.createCandidatePattern(
            patternType,
            currentFeatures,
            confidence,
            marketData
          );

          discoveries.push({
            candidatePattern: candidate,
            confidence,
            supportingEvidence: 1, // New pattern
            similarPatterns: [],
            validationRequired: true
          });
        }
      });

    } catch (error) {
      this.logger.error('New pattern discovery failed', error);
    }

    return discoveries;
  }

  /**
   * Flatten pattern features for neural network input
   */
  private flattenFeatures(features: PatternFeatures): number[] {
    const flattened: number[] = [];
    
    flattened.push(...features.priceAction.slice(0, 5));
    flattened.push(...features.volumeProfile.slice(0, 3));
    flattened.push(...features.orderFlow.slice(0, 4));
    flattened.push(...features.timeSignature.slice(0, 2));
    flattened.push(...features.marketContext.slice(0, 2));
    flattened.push(...features.technicalIndicators.slice(0, 2));
    
    // Pad to ensure consistent length
    while (flattened.length < 20) {
      flattened.push(0);
    }
    
    return flattened.slice(0, 20);
  }

  /**
   * Create a candidate pattern from discovered features
   */
  private createCandidatePattern(
    patternType: PatternType,
    features: PatternFeatures,
    confidence: number,
    marketData: MarketData
  ): LearnedPattern {
    const patternId = `${patternType}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      id: patternId,
      name: `Discovered ${patternType.replace('_', ' ')} Pattern`,
      type: patternType,
      features,
      parameters: this.generateDefaultParameters(patternType, confidence),
      performance: this.createEmptyPerformance(),
      confidence,
      reliability: 0.5, // Will be updated with feedback
      sampleSize: 1,
      lastSeen: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isActive: false // Needs validation first
    };
  }

  /**
   * Generate default parameters for a pattern type
   */
  private generateDefaultParameters(patternType: PatternType, confidence: number): PatternParameters {
    const baseParams: PatternParameters = {
      entryThreshold: 0.75,
      exitThreshold: 0.3,
      stopLossDistance: 1.0,
      takeProfitDistance: 2.0,
      timeWindow: 300000, // 5 minutes
      volumeThreshold: 1.2,
      confidenceRequired: 0.8
    };

    // Adjust parameters based on pattern type
    switch (patternType) {
      case PatternType.ABSORPTION:
        baseParams.entryThreshold = 0.8;
        baseParams.takeProfitDistance = 1.5;
        break;
      
      case PatternType.MOMENTUM_SHIFT:
        baseParams.timeWindow = 600000; // 10 minutes
        baseParams.takeProfitDistance = 2.5;
        break;
      
      case PatternType.VOLUME_SPIKE:
        baseParams.volumeThreshold = 2.0;
        baseParams.timeWindow = 180000; // 3 minutes
        break;
      
      case PatternType.LIQUIDITY_SWEEP:
        baseParams.stopLossDistance = 0.8;
        baseParams.entryThreshold = 0.85;
        break;
    }

    // Adjust for discovery confidence
    baseParams.confidenceRequired = Math.max(0.7, confidence * 0.9);

    return baseParams;
  }

  /**
   * Create empty performance metrics for new patterns
   */
  private createEmptyPerformance(): PatternPerformance {
    return {
      totalOccurrences: 0,
      successfulTrades: 0,
      failedTrades: 0,
      avgReturn: 0,
      maxReturn: 0,
      minReturn: 0,
      sharpeRatio: 0,
      winRate: 0,
      avgDuration: 0,
      volatilityAdjustedReturn: 0,
      maxDrawdown: 0,
      profitFactor: 0
    };
  }

  /**
   * Find similar patterns to a given pattern
   */
  private findSimilarPatterns(targetPattern: LearnedPattern, maxResults: number): string[] {
    const similarities: { id: string; similarity: number }[] = [];

    for (const [patternId, pattern] of this.learnedPatterns) {
      if (patternId === targetPattern.id) continue;

      const similarity = this.calculatePatternSimilarity(
        targetPattern.features,
        pattern.features
      );

      similarities.push({ id: patternId, similarity });
    }

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults)
      .map(s => s.id);
  }

  /**
   * Update pattern buffers for continuous learning
   */
  private updatePatternBuffers(features: PatternFeatures, marketData: MarketData): void {
    // Store features for future training
    Object.values(PatternType).forEach(type => {
      const buffer = this.patternBuffer.get(type) || [];
      buffer.push({
        features,
        timestamp: marketData.timestamp,
        marketData: {
          price: marketData.price,
          volume: marketData.volume,
          volatility: marketData.volatility
        }
      });

      // Limit buffer size
      if (buffer.length > 1000) {
        buffer.shift();
      }

      this.patternBuffer.set(type, buffer);
    });
  }

  /**
   * Process learning feedback from trading outcomes
   */
  public processFeedback(feedback: LearningFeedback): void {
    this.feedbackHistory.push(feedback);
    
    // Update pattern performance
    const pattern = this.learnedPatterns.get(feedback.patternId);
    if (pattern) {
      this.updatePatternPerformance(pattern, feedback);
      
      // Update reliability based on recent performance
      this.updatePatternReliability(pattern);
      
      // Check if pattern should be deactivated
      this.evaluatePatternStatus(pattern);
      
      this.logger.info('Pattern feedback processed', {
        patternId: feedback.patternId,
        outcome: feedback.outcome,
        newWinRate: pattern.performance.winRate
      });
    }

    // Trigger model retraining if we have enough feedback
    if (this.feedbackHistory.length % 100 === 0) {
      this.scheduleModelRetraining();
    }
  }

  /**
   * Update pattern performance metrics
   */
  private updatePatternPerformance(pattern: LearnedPattern, feedback: LearningFeedback): void {
    const perf = pattern.performance;
    perf.totalOccurrences++;

    if (feedback.outcome === 'success') {
      perf.successfulTrades++;
      perf.maxReturn = Math.max(perf.maxReturn, feedback.actualReturn);
    } else if (feedback.outcome === 'failure') {
      perf.failedTrades++;
      perf.minReturn = Math.min(perf.minReturn, feedback.actualReturn);
    }

    // Update averages
    perf.avgReturn = (perf.avgReturn * (perf.totalOccurrences - 1) + feedback.actualReturn) / perf.totalOccurrences;
    perf.avgDuration = (perf.avgDuration * (perf.totalOccurrences - 1) + feedback.duration) / perf.totalOccurrences;
    
    // Recalculate derived metrics
    perf.winRate = perf.totalOccurrences > 0 ? perf.successfulTrades / perf.totalOccurrences : 0;
    perf.profitFactor = perf.failedTrades > 0 && perf.minReturn < 0 ? 
      (perf.successfulTrades * Math.abs(perf.avgReturn)) / (perf.failedTrades * Math.abs(perf.minReturn)) : 0;

    pattern.updatedAt = Date.now();
    pattern.sampleSize = perf.totalOccurrences;
  }

  /**
   * Update pattern reliability score
   */
  private updatePatternReliability(pattern: LearnedPattern): void {
    const recentFeedback = this.feedbackHistory
      .filter(f => f.patternId === pattern.id)
      .slice(-20); // Last 20 occurrences

    if (recentFeedback.length >= 5) {
      const recentSuccesses = recentFeedback.filter(f => f.outcome === 'success').length;
      const recentReliability = recentSuccesses / recentFeedback.length;
      
      // Exponential moving average for reliability
      pattern.reliability = pattern.reliability * 0.7 + recentReliability * 0.3;
    }
  }

  /**
   * Evaluate whether pattern should remain active
   */
  private evaluatePatternStatus(pattern: LearnedPattern): void {
    // Deactivate patterns with poor recent performance
    if (pattern.sampleSize >= this.config.minSampleSize) {
      if (pattern.reliability < 0.4 || pattern.performance.winRate < 0.4) {
        pattern.isActive = false;
        this.logger.warn(`Pattern deactivated due to poor performance: ${pattern.id}`, {
          reliability: pattern.reliability,
          winRate: pattern.performance.winRate
        });
      }
    }

    // Activate patterns that have proven themselves
    if (!pattern.isActive && pattern.sampleSize >= this.config.minSampleSize) {
      if (pattern.reliability > 0.65 && pattern.performance.winRate > 0.6) {
        pattern.isActive = true;
        this.logger.info(`Pattern activated: ${pattern.id}`, {
          reliability: pattern.reliability,
          winRate: pattern.performance.winRate
        });
      }
    }

    // Remove very old patterns with poor performance
    const age = Date.now() - pattern.createdAt;
    const maxAge = this.config.patternExpiryDays * 24 * 60 * 60 * 1000;
    
    if (age > maxAge && pattern.performance.winRate < 0.5) {
      this.learnedPatterns.delete(pattern.id);
      this.logger.info(`Expired pattern removed: ${pattern.id}`);
    }
  }

  /**
   * Schedule model retraining with accumulated feedback
   */
  private scheduleModelRetraining(): void {
    // This would typically be done asynchronously
    setTimeout(() => {
      this.retrainModels();
    }, 1000);
  }

  /**
   * Retrain models with accumulated feedback
   */
  private async retrainModels(): Promise<void> {
    try {
      this.logger.info('Starting model retraining with new feedback');

      // Prepare training data from feedback
      const trainingData = this.prepareTrainingData();
      
      if (trainingData.features.length < 50) {
        this.logger.info('Insufficient data for retraining');
        return;
      }

      // Retrain pattern classifier
      await this.retrainPatternClassifier(trainingData);
      
      // Retrain validation model
      await this.retrainValidationModel(trainingData);

      this.logger.info('Model retraining completed successfully');

    } catch (error) {
      this.logger.error('Model retraining failed', error);
    }
  }

  /**
   * Prepare training data from feedback history
   */
  private prepareTrainingData(): { features: number[][], labels: number[], outcomes: number[] } {
    const features: number[][] = [];
    const labels: number[] = [];
    const outcomes: number[] = [];

    // Extract training examples from successful patterns
    for (const pattern of this.learnedPatterns.values()) {
      if (pattern.sampleSize >= 5) {
        const flattenedFeatures = this.flattenFeatures(pattern.features);
        const patternTypeIndex = Object.values(PatternType).indexOf(pattern.type);
        
        features.push(flattenedFeatures);
        labels.push(patternTypeIndex);
        outcomes.push(pattern.performance.winRate);
      }
    }

    return { features, labels, outcomes };
  }

  /**
   * Retrain the pattern classification model
   */
  private async retrainPatternClassifier(trainingData: any): Promise<void> {
    if (!this.patternClassifier) return;

    const xs = tf.tensor2d(trainingData.features);
    const ys = tf.oneHot(trainingData.labels, Object.keys(PatternType).length);

    await this.patternClassifier.fit(xs, ys, {
      epochs: 10,
      batchSize: 16,
      validationSplit: 0.2,
      shuffle: true
    });

    xs.dispose();
    ys.dispose();
  }

  /**
   * Retrain the validation model
   */
  private async retrainValidationModel(trainingData: any): Promise<void> {
    if (!this.validationModel) return;

    // Use pattern features + performance metrics for validation
    const validationFeatures = trainingData.features.map((features: number[], i: number) => 
      features.slice(0, 16).concat([
        trainingData.outcomes[i], // Win rate
        this.learnedPatterns.get(Object.values(this.learnedPatterns)[i]?.id)?.reliability || 0.5,
        this.learnedPatterns.get(Object.values(this.learnedPatterns)[i]?.id)?.confidence || 0.5,
        this.learnedPatterns.get(Object.values(this.learnedPatterns)[i]?.id)?.sampleSize || 0
      ]).slice(0, 20)
    );

    const xs = tf.tensor2d(validationFeatures);
    const ys = tf.tensor2d(trainingData.outcomes.map((outcome: number) => [outcome > 0.6 ? 1 : 0]));

    await this.validationModel.fit(xs, ys, {
      epochs: 15,
      batchSize: 8,
      validationSplit: 0.2
    });

    xs.dispose();
    ys.dispose();
  }

  /**
   * Get learning system statistics
   */
  public getLearningStats(): any {
    const activePatterns = Array.from(this.learnedPatterns.values()).filter(p => p.isActive);
    const totalFeedback = this.feedbackHistory.length;
    
    return {
      totalPatterns: this.learnedPatterns.size,
      activePatterns: activePatterns.length,
      totalFeedback,
      recentFeedback: this.feedbackHistory.slice(-100).length,
      avgPatternReliability: activePatterns.reduce((sum, p) => sum + p.reliability, 0) / activePatterns.length,
      avgWinRate: activePatterns.reduce((sum, p) => sum + p.performance.winRate, 0) / activePatterns.length,
      patternTypes: this.getPatternTypeDistribution(),
      bufferSizes: Object.fromEntries(this.patternBuffer.entries())
    };
  }

  /**
   * Get pattern type distribution
   */
  private getPatternTypeDistribution(): any {
    const distribution: any = {};
    
    Object.values(PatternType).forEach(type => {
      distribution[type] = Array.from(this.learnedPatterns.values())
        .filter(p => p.type === type && p.isActive).length;
    });

    return distribution;
  }

  /**
   * Get active patterns for trading
   */
  public getActivePatterns(): LearnedPattern[] {
    return Array.from(this.learnedPatterns.values())
      .filter(pattern => pattern.isActive)
      .sort((a, b) => b.reliability - a.reliability);
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    // Dispose TensorFlow models
    if (this.featureExtractor) {
      this.featureExtractor.dispose();
      this.featureExtractor = null;
    }
    
    if (this.patternClassifier) {
      this.patternClassifier.dispose();
      this.patternClassifier = null;
    }
    
    if (this.validationModel) {
      this.validationModel.dispose();
      this.validationModel = null;
    }

    // Clear data
    this.learnedPatterns.clear();
    this.patternBuffer.clear();
    this.feedbackHistory = [];

    this.emit('disposed');
    this.logger.info('PatternLearner disposed successfully');
  }
}

export default PatternLearner;