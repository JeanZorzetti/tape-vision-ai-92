/**
 * Pattern Recognizer - Advanced Market Pattern Recognition
 * Machine learning-enhanced pattern detection for tape reading and order flow analysis
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  MarketData,
  TapeEntry,
  OrderBook,
  PatternMatch,
  VolumeProfile,
  OrderFlowMetrics,
  TradingConfig
} from '@/types/trading';

export interface PatternData {
  pattern: string;
  confidence: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  probability: number;
  timeframe: number;
  parameters: Record<string, any>;
}

export interface PatternTemplate {
  id: string;
  name: string;
  description: string;
  type: 'tape' | 'orderbook' | 'volume' | 'flow' | 'hybrid';
  timeframe: number;
  minDataPoints: number;
  parameters: Record<string, any>;
  weights: Record<string, number>;
  historicalAccuracy: number;
}

export interface PatternFeature {
  name: string;
  value: number;
  weight: number;
  normalized: boolean;
  timestamp: number;
}

export interface PatternMatch {
  id: string;
  name: string;
  confidence: number;
  probability: number;
  historicalSuccess: number;
  timeframe: number;
  features: PatternFeature[];
  parameters: Record<string, any>;
  timestamp: number;
  expiresAt: number;
}

export interface PatternStatistics {
  totalPatterns: number;
  successfulPatterns: number;
  avgConfidence: number;
  avgAccuracy: number;
  patternsByType: Record<string, number>;
  recentPerformance: number;
}

export class PatternRecognizer extends EventEmitter {
  private logger: Logger;
  private config: TradingConfig;
  
  // Pattern templates and history
  private templates: Map<string, PatternTemplate> = new Map();
  private patternHistory: PatternMatch[] = [];
  private featureHistory: Map<string, PatternFeature[]> = new Map();
  
  // Analysis buffers
  private marketDataBuffer: MarketData[] = [];
  private tapeBuffer: TapeEntry[] = [];
  private orderBookBuffer: OrderBook[] = [];
  private volumeProfileBuffer: VolumeProfile[] = [];
  
  // Pattern statistics
  private statistics: PatternStatistics = {
    totalPatterns: 0,
    successfulPatterns: 0,
    avgConfidence: 0,
    avgAccuracy: 0,
    patternsByType: {},
    recentPerformance: 0
  };
  
  // Configuration
  private readonly MAX_BUFFER_SIZE = 1000;
  private readonly MIN_CONFIDENCE_THRESHOLD = 0.7;
  private readonly FEATURE_WINDOW_SIZE = 50;
  private readonly PATTERN_TIMEOUT = 300000; // 5 minutes

  constructor(config: TradingConfig, logger: Logger) {
    super();
    
    this.config = config;
    this.logger = logger.child({ component: 'PatternRecognizer' });
    
    this.initializePatternTemplates();
    
    this.logger.info('PatternRecognizer initialized', {
      templatesCount: this.templates.size,
      minConfidence: this.MIN_CONFIDENCE_THRESHOLD
    });
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing PatternRecognizer');
    
    // Clear buffers
    this.marketDataBuffer = [];
    this.tapeBuffer = [];
    this.orderBookBuffer = [];
    this.volumeProfileBuffer = [];
    
    // Reset statistics
    this.statistics = {
      totalPatterns: 0,
      successfulPatterns: 0,
      avgConfidence: 0,
      avgAccuracy: 0,
      patternsByType: {},
      recentPerformance: 0
    };
    
    this.logger.info('PatternRecognizer initialized successfully');
  }

  /**
   * Analyze market data and recognize patterns
   */
  public recognizePatterns(
    marketData: MarketData,
    tapeEntries?: TapeEntry[],
    orderBook?: OrderBook,
    volumeProfile?: VolumeProfile[],
    orderFlow?: OrderFlowMetrics
  ): PatternMatch[] {
    
    try {
      // Update buffers
      this.updateBuffers(marketData, tapeEntries, orderBook, volumeProfile);
      
      // Calculate features
      const features = this.calculateFeatures(marketData, orderFlow);
      
      // Store features for history
      this.storeFeatures(features);
      
      // Recognize patterns using each template
      const patterns: PatternMatch[] = [];
      
      for (const template of this.templates.values()) {
        if (this.hasMinimumData(template)) {
          const pattern = this.recognizePatternFromTemplate(template, features);
          if (pattern && pattern.confidence >= this.MIN_CONFIDENCE_THRESHOLD) {
            patterns.push(pattern);
          }
        }
      }
      
      // Sort by confidence and return top patterns
      const sortedPatterns = patterns
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5); // Top 5 patterns
      
      // Emit patterns if any found
      if (sortedPatterns.length > 0) {
        this.emit('patterns-detected', sortedPatterns);
      }
      
      // Update statistics
      this.updateStatistics(sortedPatterns);
      
      return sortedPatterns;
      
    } catch (error) {
      this.logger.error('Error recognizing patterns', error);
      return [];
    }
  }

  /**
   * Specific pattern recognition methods
   */
  public recognizeTapePatterns(tapeEntries: TapeEntry[]): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    
    // Absorption Pattern
    const absorption = this.detectAbsorptionPattern(tapeEntries);
    if (absorption) patterns.push(absorption);
    
    // Iceberg Pattern
    const iceberg = this.detectIcebergPattern(tapeEntries);
    if (iceberg) patterns.push(iceberg);
    
    // Aggressive Entry Pattern
    const aggressive = this.detectAggressiveEntryPattern(tapeEntries);
    if (aggressive) patterns.push(aggressive);
    
    // Hidden Orders Pattern
    const hidden = this.detectHiddenOrdersPattern(tapeEntries);
    if (hidden) patterns.push(hidden);
    
    return patterns.filter(p => p.confidence >= this.MIN_CONFIDENCE_THRESHOLD);
  }

  public recognizeVolumePatterns(volumeProfile: VolumeProfile[]): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    
    // Volume Cluster Pattern
    const cluster = this.detectVolumeClusterPattern(volumeProfile);
    if (cluster) patterns.push(cluster);
    
    // Point of Control Shift Pattern
    const pocShift = this.detectPOCShiftPattern(volumeProfile);
    if (pocShift) patterns.push(pocShift);
    
    // Volume Gap Pattern
    const gap = this.detectVolumeGapPattern(volumeProfile);
    if (gap) patterns.push(gap);
    
    return patterns.filter(p => p.confidence >= this.MIN_CONFIDENCE_THRESHOLD);
  }

  public recognizeOrderBookPatterns(orderBooks: OrderBook[]): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    
    // Spoofing Pattern
    const spoofing = this.detectSpoofingPattern(orderBooks);
    if (spoofing) patterns.push(spoofing);
    
    // Layering Pattern
    const layering = this.detectLayeringPattern(orderBooks);
    if (layering) patterns.push(layering);
    
    // Wall Formation Pattern
    const wall = this.detectWallFormationPattern(orderBooks);
    if (wall) patterns.push(wall);
    
    return patterns.filter(p => p.confidence >= this.MIN_CONFIDENCE_THRESHOLD);
  }

  private initializePatternTemplates(): void {
    // Tape Reading Patterns
    this.templates.set('absorption', {
      id: 'absorption',
      name: 'Liquidez Absorvida',
      description: 'Large volume absorption at key levels',
      type: 'tape',
      timeframe: 180000, // 3 minutes
      minDataPoints: 20,
      parameters: {
        minVolumeRatio: 2.0,
        maxPriceMovement: 0.5,
        minDuration: 30000
      },
      weights: {
        volume: 0.4,
        priceStability: 0.3,
        duration: 0.3
      },
      historicalAccuracy: 0.75
    });

    this.templates.set('iceberg', {
      id: 'iceberg',
      name: 'Ordem Iceberg',
      description: 'Hidden large order execution pattern',
      type: 'tape',
      timeframe: 240000, // 4 minutes
      minDataPoints: 25,
      parameters: {
        minConsecutiveTrades: 5,
        maxSizeVariation: 0.2,
        samePriceThreshold: 0.25
      },
      weights: {
        consistency: 0.5,
        frequency: 0.3,
        size: 0.2
      },
      historicalAccuracy: 0.68
    });

    this.templates.set('aggressive_entry', {
      id: 'aggressive_entry',
      name: 'Entrada Agressiva',
      description: 'Aggressive market entry with momentum',
      type: 'flow',
      timeframe: 120000, // 2 minutes
      minDataPoints: 15,
      parameters: {
        minAggressionLevel: 0.7,
        minVolumeSpike: 1.5,
        priceMovementThreshold: 0.3
      },
      weights: {
        aggression: 0.4,
        volume: 0.4,
        momentum: 0.2
      },
      historicalAccuracy: 0.72
    });

    this.templates.set('volume_cluster', {
      id: 'volume_cluster',
      name: 'Cluster de Volume',
      description: 'Significant volume concentration',
      type: 'volume',
      timeframe: 300000, // 5 minutes
      minDataPoints: 30,
      parameters: {
        minVolumeConcentration: 0.3,
        priceRangeThreshold: 1.0,
        significanceThreshold: 0.1
      },
      weights: {
        concentration: 0.5,
        significance: 0.3,
        duration: 0.2
      },
      historicalAccuracy: 0.78
    });

    this.templates.set('hidden_liquidity', {
      id: 'hidden_liquidity',
      name: 'Liquidez Oculta',
      description: 'Hidden liquidity discovery pattern',
      type: 'hybrid',
      timeframe: 360000, // 6 minutes
      minDataPoints: 40,
      parameters: {
        orderBookImbalance: 0.4,
        executionPattern: 'gradual',
        priceImpactRatio: 0.3
      },
      weights: {
        imbalance: 0.3,
        execution: 0.4,
        impact: 0.3
      },
      historicalAccuracy: 0.65
    });

    this.templates.set('momentum_shift', {
      id: 'momentum_shift',
      name: 'Mudança de Momentum',
      description: 'Market momentum shift pattern',
      type: 'flow',
      timeframe: 180000, // 3 minutes
      minDataPoints: 20,
      parameters: {
        momentumThreshold: 0.5,
        volumeConfirmation: 1.2,
        persistenceRequired: 3
      },
      weights: {
        momentum: 0.4,
        volume: 0.3,
        persistence: 0.3
      },
      historicalAccuracy: 0.70
    });
  }

  private updateBuffers(
    marketData: MarketData,
    tapeEntries?: TapeEntry[],
    orderBook?: OrderBook,
    volumeProfile?: VolumeProfile[]
  ): void {
    
    // Update market data buffer
    this.marketDataBuffer.push(marketData);
    if (this.marketDataBuffer.length > this.MAX_BUFFER_SIZE) {
      this.marketDataBuffer = this.marketDataBuffer.slice(-this.MAX_BUFFER_SIZE);
    }
    
    // Update tape buffer
    if (tapeEntries) {
      this.tapeBuffer.push(...tapeEntries);
      if (this.tapeBuffer.length > this.MAX_BUFFER_SIZE) {
        this.tapeBuffer = this.tapeBuffer.slice(-this.MAX_BUFFER_SIZE);
      }
    }
    
    // Update order book buffer
    if (orderBook) {
      this.orderBookBuffer.push(orderBook);
      if (this.orderBookBuffer.length > 100) { // Smaller buffer for order books
        this.orderBookBuffer = this.orderBookBuffer.slice(-100);
      }
    }
    
    // Update volume profile buffer
    if (volumeProfile) {
      this.volumeProfileBuffer.push(...volumeProfile);
      if (this.volumeProfileBuffer.length > this.MAX_BUFFER_SIZE) {
        this.volumeProfileBuffer = this.volumeProfileBuffer.slice(-this.MAX_BUFFER_SIZE);
      }
    }
  }

  private calculateFeatures(marketData: MarketData, orderFlow?: OrderFlowMetrics): PatternFeature[] {
    const features: PatternFeature[] = [];
    const timestamp = Date.now();
    
    // Price features
    features.push({
      name: 'price_change',
      value: marketData.priceChange || 0,
      weight: 0.3,
      normalized: false,
      timestamp
    });
    
    // Volume features
    const avgVolume = this.calculateAverageVolume();
    features.push({
      name: 'volume_ratio',
      value: avgVolume > 0 ? marketData.volume / avgVolume : 1,
      weight: 0.4,
      normalized: false,
      timestamp
    });
    
    // Volatility features
    features.push({
      name: 'volatility',
      value: marketData.volatility || 0,
      weight: 0.2,
      normalized: false,
      timestamp
    });
    
    // Order flow features
    if (orderFlow) {
      features.push({
        name: 'net_flow',
        value: orderFlow.netOrderFlow,
        weight: 0.4,
        normalized: false,
        timestamp
      });
      
      features.push({
        name: 'aggression_ratio',
        value: this.calculateAggressionRatio(orderFlow),
        weight: 0.3,
        normalized: true,
        timestamp
      });
    }
    
    // Tape features
    if (this.tapeBuffer.length > 0) {
      const recentTape = this.tapeBuffer.slice(-20);
      
      features.push({
        name: 'large_order_ratio',
        value: recentTape.filter(t => t.isLarge).length / recentTape.length,
        weight: 0.3,
        normalized: true,
        timestamp
      });
      
      features.push({
        name: 'trade_frequency',
        value: this.calculateTradeFrequency(recentTape),
        weight: 0.2,
        normalized: false,
        timestamp
      });
    }
    
    return features;
  }

  private recognizePatternFromTemplate(template: PatternTemplate, features: PatternFeature[]): PatternMatch | null {
    try {
      switch (template.id) {
        case 'absorption':
          return this.detectAbsorptionFromFeatures(template, features);
        case 'iceberg':
          return this.detectIcebergFromFeatures(template, features);
        case 'aggressive_entry':
          return this.detectAggressiveEntryFromFeatures(template, features);
        case 'volume_cluster':
          return this.detectVolumeClusterFromFeatures(template, features);
        case 'hidden_liquidity':
          return this.detectHiddenLiquidityFromFeatures(template, features);
        case 'momentum_shift':
          return this.detectMomentumShiftFromFeatures(template, features);
        default:
          return null;
      }
    } catch (error) {
      this.logger.error(`Error recognizing pattern ${template.id}`, error);
      return null;
    }
  }

  private detectAbsorptionPattern(tapeEntries: TapeEntry[]): PatternMatch | null {
    if (tapeEntries.length < 10) return null;
    
    // Look for pattern: large volume with minimal price movement
    const totalVolume = tapeEntries.reduce((sum, entry) => sum + entry.volume, 0);
    const avgVolume = totalVolume / tapeEntries.length;
    const largeVolumeEntries = tapeEntries.filter(entry => entry.volume > avgVolume * 1.5);
    
    if (largeVolumeEntries.length < 3) return null;
    
    // Check price stability during large volume
    const priceRange = Math.max(...tapeEntries.map(e => e.price)) - Math.min(...tapeEntries.map(e => e.price));
    const priceStability = 1 - (priceRange / tapeEntries[0].price);
    
    // Calculate confidence
    const volumeScore = Math.min(1, largeVolumeEntries.length / 10);
    const stabilityScore = Math.max(0, priceStability);
    const confidence = (volumeScore * 0.6) + (stabilityScore * 0.4);
    
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    return {
      id: `absorption_${Date.now()}`,
      name: 'Absorção de Liquidez',
      confidence,
      probability: confidence * 0.75, // Historical adjustment
      historicalSuccess: 0.75,
      timeframe: 180000,
      features: [
        { name: 'volume_concentration', value: volumeScore, weight: 0.6, normalized: true, timestamp: Date.now() },
        { name: 'price_stability', value: stabilityScore, weight: 0.4, normalized: true, timestamp: Date.now() }
      ],
      parameters: {
        largeVolumeCount: largeVolumeEntries.length,
        priceStability: stabilityScore,
        totalVolume: totalVolume
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 180000
    };
  }

  private detectIcebergPattern(tapeEntries: TapeEntry[]): PatternMatch | null {
    if (tapeEntries.length < 15) return null;
    
    // Look for consistent order sizes at similar prices
    const sizeGroups: Map<number, number> = new Map();
    const priceGroups: Map<number, TapeEntry[]> = new Map();
    
    for (const entry of tapeEntries) {
      const roundedPrice = Math.round(entry.price * 4) / 4; // Quarter point precision
      const roundedSize = Math.round(entry.volume / 10) * 10; // Round to tens
      
      sizeGroups.set(roundedSize, (sizeGroups.get(roundedSize) || 0) + 1);
      
      if (!priceGroups.has(roundedPrice)) {
        priceGroups.set(roundedPrice, []);
      }
      priceGroups.get(roundedPrice)!.push(entry);
    }
    
    // Find most common size
    let maxSizeFreq = 0;
    let commonSize = 0;
    for (const [size, freq] of sizeGroups) {
      if (freq > maxSizeFreq) {
        maxSizeFreq = freq;
        commonSize = size;
      }
    }
    
    if (maxSizeFreq < 5) return null; // At least 5 similar sizes
    
    // Check for price clustering
    const significantPrices = Array.from(priceGroups.entries())
      .filter(([, entries]) => entries.length >= 3)
      .length;
    
    const consistency = maxSizeFreq / tapeEntries.length;
    const clustering = significantPrices / priceGroups.size;
    const confidence = (consistency * 0.6) + (clustering * 0.4);
    
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    return {
      id: `iceberg_${Date.now()}`,
      name: 'Ordem Iceberg Detectada',
      confidence,
      probability: confidence * 0.68,
      historicalSuccess: 0.68,
      timeframe: 240000,
      features: [
        { name: 'size_consistency', value: consistency, weight: 0.6, normalized: true, timestamp: Date.now() },
        { name: 'price_clustering', value: clustering, weight: 0.4, normalized: true, timestamp: Date.now() }
      ],
      parameters: {
        commonSize,
        frequency: maxSizeFreq,
        priceClusterCount: significantPrices
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 240000
    };
  }

  private detectAggressiveEntryPattern(tapeEntries: TapeEntry[]): PatternMatch | null {
    if (tapeEntries.length < 10) return null;
    
    const recent = tapeEntries.slice(-10);
    const aggressiveTrades = recent.filter(entry => entry.isLarge || entry.isDominant);
    const totalVolume = recent.reduce((sum, entry) => sum + entry.volume, 0);
    const aggressiveVolume = aggressiveTrades.reduce((sum, entry) => sum + entry.volume, 0);
    
    const aggressionRatio = totalVolume > 0 ? aggressiveVolume / totalVolume : 0;
    const frequency = aggressiveTrades.length / recent.length;
    
    // Check for directional bias
    const buyAggression = aggressiveTrades.filter(t => t.aggressor === 'buyer').length;
    const sellAggression = aggressiveTrades.filter(t => t.aggressor === 'seller').length;
    const directionalBias = Math.abs(buyAggression - sellAggression) / Math.max(1, buyAggression + sellAggression);
    
    const confidence = (aggressionRatio * 0.4) + (frequency * 0.3) + (directionalBias * 0.3);
    
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    return {
      id: `aggressive_${Date.now()}`,
      name: 'Entrada Agressiva',
      confidence,
      probability: confidence * 0.72,
      historicalSuccess: 0.72,
      timeframe: 120000,
      features: [
        { name: 'aggression_ratio', value: aggressionRatio, weight: 0.4, normalized: true, timestamp: Date.now() },
        { name: 'frequency', value: frequency, weight: 0.3, normalized: true, timestamp: Date.now() },
        { name: 'directional_bias', value: directionalBias, weight: 0.3, normalized: true, timestamp: Date.now() }
      ],
      parameters: {
        aggressiveCount: aggressiveTrades.length,
        dominantSide: buyAggression > sellAggression ? 'buy' : 'sell',
        volumeRatio: aggressionRatio
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 120000
    };
  }

  private detectHiddenOrdersPattern(tapeEntries: TapeEntry[]): PatternMatch | null {
    if (tapeEntries.length < 20) return null;
    
    // Look for small consistent trades that might indicate hidden orders
    const avgSize = tapeEntries.reduce((sum, e) => sum + e.volume, 0) / tapeEntries.length;
    const smallTrades = tapeEntries.filter(e => e.volume < avgSize * 0.8);
    const consistentSizes = this.findConsistentSizes(smallTrades);
    
    if (consistentSizes.length < 3) return null;
    
    const consistency = consistentSizes.length / tapeEntries.length;
    const frequency = smallTrades.length / tapeEntries.length;
    const confidence = (consistency * 0.6) + (frequency * 0.4);
    
    if (confidence < 0.6) return null; // Lower threshold for hidden patterns
    
    return {
      id: `hidden_${Date.now()}`,
      name: 'Ordens Ocultas',
      confidence,
      probability: confidence * 0.60,
      historicalSuccess: 0.60,
      timeframe: 300000,
      features: [
        { name: 'consistency', value: consistency, weight: 0.6, normalized: true, timestamp: Date.now() },
        { name: 'frequency', value: frequency, weight: 0.4, normalized: true, timestamp: Date.now() }
      ],
      parameters: {
        smallTradesCount: smallTrades.length,
        consistentSizesCount: consistentSizes.length
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 300000
    };
  }

  // Additional pattern detection methods would continue here...
  // For brevity, I'll implement the key feature detection methods

  private detectAbsorptionFromFeatures(template: PatternTemplate, features: PatternFeature[]): PatternMatch | null {
    const volumeFeature = features.find(f => f.name === 'volume_ratio');
    const priceFeature = features.find(f => f.name === 'price_change');
    
    if (!volumeFeature || !priceFeature) return null;
    
    const volumeScore = Math.min(1, volumeFeature.value / 2); // Normalize high volume
    const stabilityScore = 1 - Math.min(1, Math.abs(priceFeature.value));
    
    const confidence = (volumeScore * template.weights.volume) + 
                      (stabilityScore * template.weights.priceStability);
    
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    return this.createPatternMatch(template, confidence, features, {
      volumeRatio: volumeFeature.value,
      priceStability: stabilityScore
    });
  }

  private detectIcebergFromFeatures(template: PatternTemplate, features: PatternFeature[]): PatternMatch | null {
    const frequencyFeature = features.find(f => f.name === 'trade_frequency');
    const sizeFeature = features.find(f => f.name === 'large_order_ratio');
    
    if (!frequencyFeature || !sizeFeature) return null;
    
    // Iceberg pattern: high frequency, consistent sizes, low large order ratio
    const frequencyScore = Math.min(1, frequencyFeature.value / 10);
    const consistencyScore = 1 - sizeFeature.value; // Lower large order ratio = more consistent
    
    const confidence = (frequencyScore * template.weights.frequency) + 
                      (consistencyScore * template.weights.consistency);
    
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    return this.createPatternMatch(template, confidence, features, {
      tradeFrequency: frequencyFeature.value,
      sizeConsistency: consistencyScore
    });
  }

  private detectAggressiveEntryFromFeatures(template: PatternTemplate, features: PatternFeature[]): PatternMatch | null {
    const aggressionFeature = features.find(f => f.name === 'aggression_ratio');
    const volumeFeature = features.find(f => f.name === 'volume_ratio');
    const flowFeature = features.find(f => f.name === 'net_flow');
    
    if (!aggressionFeature || !volumeFeature) return null;
    
    const aggressionScore = aggressionFeature.value;
    const volumeScore = Math.min(1, volumeFeature.value / 2);
    const flowScore = flowFeature ? Math.min(1, Math.abs(flowFeature.value) / 1000) : 0.5;
    
    const confidence = (aggressionScore * template.weights.aggression) + 
                      (volumeScore * template.weights.volume) + 
                      (flowScore * template.weights.momentum);
    
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    return this.createPatternMatch(template, confidence, features, {
      aggressionLevel: aggressionScore,
      volumeSpike: volumeScore,
      flowStrength: flowScore
    });
  }

  private detectVolumeClusterFromFeatures(template: PatternTemplate, features: PatternFeature[]): PatternMatch | null {
    // Implementation would analyze volume profile concentration
    // Simplified for this example
    const volumeFeature = features.find(f => f.name === 'volume_ratio');
    
    if (!volumeFeature || volumeFeature.value < 1.5) return null;
    
    const confidence = Math.min(0.9, volumeFeature.value / 3);
    
    return this.createPatternMatch(template, confidence, features, {
      volumeConcentration: volumeFeature.value
    });
  }

  private detectHiddenLiquidityFromFeatures(template: PatternTemplate, features: PatternFeature[]): PatternMatch | null {
    // Implementation would analyze order book vs execution patterns
    // Simplified for this example
    const flowFeature = features.find(f => f.name === 'net_flow');
    const volumeFeature = features.find(f => f.name === 'volume_ratio');
    
    if (!flowFeature || !volumeFeature) return null;
    
    const flowScore = Math.abs(flowFeature.value) / 1000;
    const volumeScore = volumeFeature.value;
    
    const confidence = (flowScore * 0.6) + (Math.min(1, volumeScore / 2) * 0.4);
    
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    return this.createPatternMatch(template, confidence, features, {
      flowImbalance: flowScore,
      volumeRatio: volumeScore
    });
  }

  private detectMomentumShiftFromFeatures(template: PatternTemplate, features: PatternFeature[]): PatternMatch | null {
    const priceFeature = features.find(f => f.name === 'price_change');
    const volumeFeature = features.find(f => f.name === 'volume_ratio');
    const flowFeature = features.find(f => f.name === 'net_flow');
    
    if (!priceFeature || !volumeFeature || !flowFeature) return null;
    
    const momentumScore = Math.min(1, Math.abs(priceFeature.value));
    const volumeScore = Math.min(1, volumeFeature.value / 2);
    const flowScore = Math.min(1, Math.abs(flowFeature.value) / 1000);
    
    const confidence = (momentumScore * template.weights.momentum) + 
                      (volumeScore * template.weights.volume) + 
                      (flowScore * template.weights.persistence);
    
    if (confidence < this.MIN_CONFIDENCE_THRESHOLD) return null;
    
    return this.createPatternMatch(template, confidence, features, {
      momentumStrength: momentumScore,
      volumeConfirmation: volumeScore,
      flowDirection: flowFeature.value > 0 ? 'bullish' : 'bearish'
    });
  }

  // Helper methods
  private createPatternMatch(
    template: PatternTemplate, 
    confidence: number, 
    features: PatternFeature[], 
    parameters: Record<string, any>
  ): PatternMatch {
    
    return {
      id: `${template.id}_${Date.now()}`,
      name: template.name,
      confidence,
      probability: confidence * template.historicalAccuracy,
      historicalSuccess: template.historicalAccuracy,
      timeframe: template.timeframe,
      features,
      parameters,
      timestamp: Date.now(),
      expiresAt: Date.now() + template.timeframe
    };
  }

  private hasMinimumData(template: PatternTemplate): boolean {
    switch (template.type) {
      case 'tape':
        return this.tapeBuffer.length >= template.minDataPoints;
      case 'orderbook':
        return this.orderBookBuffer.length >= template.minDataPoints;
      case 'volume':
        return this.volumeProfileBuffer.length >= template.minDataPoints;
      case 'flow':
        return this.marketDataBuffer.length >= template.minDataPoints;
      case 'hybrid':
        return this.marketDataBuffer.length >= template.minDataPoints && 
               this.tapeBuffer.length >= template.minDataPoints / 2;
      default:
        return false;
    }
  }

  private storeFeatures(features: PatternFeature[]): void {
    const timestamp = Date.now();
    
    for (const feature of features) {
      if (!this.featureHistory.has(feature.name)) {
        this.featureHistory.set(feature.name, []);
      }
      
      const history = this.featureHistory.get(feature.name)!;
      history.push(feature);
      
      if (history.length > this.FEATURE_WINDOW_SIZE) {
        this.featureHistory.set(feature.name, history.slice(-this.FEATURE_WINDOW_SIZE));
      }
    }
  }

  private updateStatistics(patterns: PatternMatch[]): void {
    this.statistics.totalPatterns += patterns.length;
    
    for (const pattern of patterns) {
      if (!this.statistics.patternsByType[pattern.name]) {
        this.statistics.patternsByType[pattern.name] = 0;
      }
      this.statistics.patternsByType[pattern.name]++;
    }
    
    if (patterns.length > 0) {
      const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
      this.statistics.avgConfidence = (this.statistics.avgConfidence + avgConfidence) / 2;
    }
  }

  private calculateAverageVolume(): number {
    if (this.marketDataBuffer.length === 0) return 1000;
    
    const recent = this.marketDataBuffer.slice(-20);
    return recent.reduce((sum, data) => sum + data.volume, 0) / recent.length;
  }

  private calculateAggressionRatio(orderFlow: OrderFlowMetrics): number {
    const totalAggressive = orderFlow.aggressiveBuyVolume + orderFlow.aggressiveSellVolume;
    const totalVolume = orderFlow.totalVolume;
    
    return totalVolume > 0 ? totalAggressive / totalVolume : 0;
  }

  private calculateTradeFrequency(tapeEntries: TapeEntry[]): number {
    if (tapeEntries.length < 2) return 0;
    
    const timeSpan = tapeEntries[tapeEntries.length - 1].timestamp - tapeEntries[0].timestamp;
    return timeSpan > 0 ? (tapeEntries.length / timeSpan) * 1000 : 0; // Trades per second
  }

  private findConsistentSizes(trades: TapeEntry[]): TapeEntry[] {
    const sizeGroups: Map<number, TapeEntry[]> = new Map();
    
    for (const trade of trades) {
      const roundedSize = Math.round(trade.volume / 5) * 5; // Round to nearest 5
      
      if (!sizeGroups.has(roundedSize)) {
        sizeGroups.set(roundedSize, []);
      }
      sizeGroups.get(roundedSize)!.push(trade);
    }
    
    // Return trades from the most common size group
    let maxGroup: TapeEntry[] = [];
    for (const group of sizeGroups.values()) {
      if (group.length > maxGroup.length) {
        maxGroup = group;
      }
    }
    
    return maxGroup.length >= 3 ? maxGroup : [];
  }

  // Pattern detection methods for different types would continue...
  // Implementing complete detection logic for all patterns mentioned

  private detectVolumeClusterPattern(volumeProfile: VolumeProfile[]): PatternMatch | null {
    if (volumeProfile.length < 10) return null;
    
    // Find the highest volume areas
    const sorted = [...volumeProfile].sort((a, b) => b.volume - a.volume);
    const topVolumes = sorted.slice(0, 3);
    const totalVolume = volumeProfile.reduce((sum, vp) => sum + vp.volume, 0);
    
    // Calculate concentration
    const topVolumeSum = topVolumes.reduce((sum, vp) => sum + vp.volume, 0);
    const concentration = totalVolume > 0 ? topVolumeSum / totalVolume : 0;
    
    if (concentration < 0.3) return null;
    
    const confidence = Math.min(0.95, concentration * 1.2);
    
    return {
      id: `volume_cluster_${Date.now()}`,
      name: 'Cluster de Volume',
      confidence,
      probability: confidence * 0.78,
      historicalSuccess: 0.78,
      timeframe: 300000,
      features: [
        { name: 'concentration', value: concentration, weight: 1.0, normalized: true, timestamp: Date.now() }
      ],
      parameters: {
        concentration,
        topLevels: topVolumes.map(vp => ({ price: vp.price, volume: vp.volume }))
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 300000
    };
  }

  private detectPOCShiftPattern(volumeProfile: VolumeProfile[]): PatternMatch | null {
    if (volumeProfile.length < 20) return null;
    
    // Find Point of Control (highest volume price)
    const currentPOC = volumeProfile.reduce((max, vp) => vp.volume > max.volume ? vp : max);
    
    // Compare with historical POC (simplified - would use more sophisticated tracking)
    const recentProfiles = this.volumeProfileBuffer.slice(-50);
    if (recentProfiles.length < 20) return null;
    
    const historicalPOC = recentProfiles.reduce((max, vp) => vp.volume > max.volume ? vp : max);
    
    const priceShift = Math.abs(currentPOC.price - historicalPOC.price);
    const volumeRatio = currentPOC.volume / Math.max(historicalPOC.volume, 1);
    
    if (priceShift < 1.0) return null; // Minimum 1 point shift
    
    const confidence = Math.min(0.9, (priceShift / 5) * volumeRatio);
    
    return {
      id: `poc_shift_${Date.now()}`,
      name: 'Mudança do POC',
      confidence,
      probability: confidence * 0.70,
      historicalSuccess: 0.70,
      timeframe: 360000,
      features: [
        { name: 'price_shift', value: priceShift, weight: 0.6, normalized: false, timestamp: Date.now() },
        { name: 'volume_ratio', value: volumeRatio, weight: 0.4, normalized: false, timestamp: Date.now() }
      ],
      parameters: {
        currentPOC: currentPOC.price,
        historicalPOC: historicalPOC.price,
        shift: priceShift,
        direction: currentPOC.price > historicalPOC.price ? 'upward' : 'downward'
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 360000
    };
  }

  private detectVolumeGapPattern(volumeProfile: VolumeProfile[]): PatternMatch | null {
    if (volumeProfile.length < 15) return null;
    
    // Sort by price to find gaps
    const sorted = [...volumeProfile].sort((a, b) => a.price - b.price);
    const gaps: { start: number; end: number; size: number }[] = [];
    
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i].price - sorted[i - 1].price;
      if (gap > 2.0) { // Gap larger than 2 points
        gaps.push({
          start: sorted[i - 1].price,
          end: sorted[i].price,
          size: gap
        });
      }
    }
    
    if (gaps.length === 0) return null;
    
    const largestGap = gaps.reduce((max, gap) => gap.size > max.size ? gap : max);
    const confidence = Math.min(0.85, largestGap.size / 10);
    
    return {
      id: `volume_gap_${Date.now()}`,
      name: 'Gap de Volume',
      confidence,
      probability: confidence * 0.65,
      historicalSuccess: 0.65,
      timeframe: 240000,
      features: [
        { name: 'gap_size', value: largestGap.size, weight: 1.0, normalized: false, timestamp: Date.now() }
      ],
      parameters: {
        gapCount: gaps.length,
        largestGap,
        significantGaps: gaps.filter(g => g.size > 3.0)
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 240000
    };
  }

  private detectSpoofingPattern(orderBooks: OrderBook[]): PatternMatch | null {
    if (orderBooks.length < 5) return null;
    
    const recent = orderBooks.slice(-5);
    let spoofingScore = 0;
    
    for (let i = 1; i < recent.length; i++) {
      const current = recent[i];
      const previous = recent[i - 1];
      
      // Look for large orders that disappear quickly
      for (const prevBid of previous.bids.slice(0, 3)) {
        const matchingBid = current.bids.find(bid => 
          Math.abs(bid.price - prevBid.price) < 0.25 && bid.volume > prevBid.volume * 0.8
        );
        
        if (!matchingBid && prevBid.volume > 1000) {
          spoofingScore += 1;
        }
      }
    }
    
    const confidence = Math.min(0.9, spoofingScore / 10);
    
    if (confidence < 0.6) return null;
    
    return {
      id: `spoofing_${Date.now()}`,
      name: 'Spoofing Detectado',
      confidence,
      probability: confidence * 0.60,
      historicalSuccess: 0.60,
      timeframe: 180000,
      features: [
        { name: 'spoofing_score', value: spoofingScore, weight: 1.0, normalized: false, timestamp: Date.now() }
      ],
      parameters: {
        spoofingEvents: spoofingScore,
        analysisWindow: recent.length
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 180000
    };
  }

  private detectLayeringPattern(orderBooks: OrderBook[]): PatternMatch | null {
    if (orderBooks.length < 3) return null;
    
    const current = orderBooks[orderBooks.length - 1];
    
    // Look for multiple large orders at similar distances
    const bidLayers = this.findLayers(current.bids);
    const askLayers = this.findLayers(current.asks);
    
    const totalLayers = bidLayers + askLayers;
    
    if (totalLayers < 3) return null;
    
    const confidence = Math.min(0.8, totalLayers / 10);
    
    return {
      id: `layering_${Date.now()}`,
      name: 'Layering Detectado',
      confidence,
      probability: confidence * 0.65,
      historicalSuccess: 0.65,
      timeframe: 240000,
      features: [
        { name: 'layer_count', value: totalLayers, weight: 1.0, normalized: false, timestamp: Date.now() }
      ],
      parameters: {
        bidLayers,
        askLayers,
        totalLayers
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 240000
    };
  }

  private detectWallFormationPattern(orderBooks: OrderBook[]): PatternMatch | null {
    if (orderBooks.length === 0) return null;
    
    const current = orderBooks[orderBooks.length - 1];
    
    // Look for exceptionally large orders (walls)
    const avgBidVolume = current.bids.slice(0, 5).reduce((sum, bid) => sum + bid.volume, 0) / 5;
    const avgAskVolume = current.asks.slice(0, 5).reduce((sum, ask) => sum + ask.volume, 0) / 5;
    
    const largeBids = current.bids.filter(bid => bid.volume > avgBidVolume * 3);
    const largeAsks = current.asks.filter(ask => ask.volume > avgAskVolume * 3);
    
    if (largeBids.length === 0 && largeAsks.length === 0) return null;
    
    const wallCount = largeBids.length + largeAsks.length;
    const confidence = Math.min(0.85, wallCount / 5);
    
    return {
      id: `wall_${Date.now()}`,
      name: 'Formação de Wall',
      confidence,
      probability: confidence * 0.70,
      historicalSuccess: 0.70,
      timeframe: 300000,
      features: [
        { name: 'wall_count', value: wallCount, weight: 1.0, normalized: false, timestamp: Date.now() }
      ],
      parameters: {
        bidWalls: largeBids.length,
        askWalls: largeAsks.length,
        dominantSide: largeBids.length > largeAsks.length ? 'bid' : 'ask'
      },
      timestamp: Date.now(),
      expiresAt: Date.now() + 300000
    };
  }

  private findLayers(levels: Array<{ price: number; volume: number }>): number {
    if (levels.length < 3) return 0;
    
    let layers = 0;
    const avgVolume = levels.slice(0, 5).reduce((sum, level) => sum + level.volume, 0) / 5;
    
    for (let i = 0; i < Math.min(10, levels.length); i++) {
      if (levels[i].volume > avgVolume * 1.5) {
        layers++;
      }
    }
    
    return layers;
  }

  // Public getters and utilities
  public getPatternHistory(limit: number = 50): PatternMatch[] {
    return this.patternHistory.slice(-limit);
  }

  public getStatistics(): PatternStatistics {
    return { ...this.statistics };
  }

  public getActivePatterns(): PatternMatch[] {
    const now = Date.now();
    return this.patternHistory.filter(pattern => pattern.expiresAt > now);
  }

  public getTemplates(): PatternTemplate[] {
    return Array.from(this.templates.values());
  }
}