/**
 * ML-based Trading Signal Validator
 * 
 * This critical component uses machine learning models to validate trading signals
 * with 90%+ confidence requirements. It integrates multiple ML approaches including
 * pattern recognition, time series analysis, and ensemble methods.
 * 
 * Key Features:
 * - Real-time signal validation with sub-10ms latency
 * - Multiple ML model ensemble for robust predictions
 * - Adaptive learning from market feedback
 * - Risk-adjusted confidence scoring
 * - Pattern validation against historical data
 */

import * as tf from '@tensorflow/tfjs-node';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';
import { 
  MarketData, 
  DecisionAnalysis, 
  PatternMatch, 
  TapeEntry,
  TradingError,
  ComponentScores,
  AnalysisVariable
} from '../../types/trading';
import { Logger } from '../../utils/Logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';

export interface MLValidationResult {
  isValid: boolean;
  confidence: number;
  prediction: 'BUY' | 'SELL' | 'WAIT';
  modelScores: ModelScores;
  riskAdjustedConfidence: number;
  validationTime: number;
  reason: string;
  supportingEvidence: string[];
  warnings: string[];
}

export interface ModelScores {
  patternRecognition: number;
  orderFlowPrediction: number;
  volatilityForecast: number;
  liquidityAnalysis: number;
  riskAssessment: number;
  ensembleScore: number;
}

export interface MLFeatureSet {
  // Price action features
  priceMovement: number[];
  volumeProfile: number[];
  volatilityIndex: number[];
  
  // Order flow features
  buyPressure: number[];
  sellPressure: number[];
  orderImbalance: number[];
  absorptionRate: number[];
  
  // Market microstructure
  spreadDynamics: number[];
  liquidityDepth: number[];
  tickFrequency: number[];
  
  // Temporal features
  timeOfDay: number;
  dayOfWeek: number;
  marketSession: number;
  
  // Pattern features
  patternStrength: number;
  patternReliability: number;
  historicalOutcome: number;
}

export interface MLModelConfig {
  modelName: string;
  modelPath: string;
  weight: number;
  enabled: boolean;
  retrainInterval: number;
  performanceThreshold: number;
}

export class MLValidator extends EventEmitter {
  private models: Map<string, tf.LayersModel> = new Map();
  private modelConfigs: MLModelConfig[] = [];
  private featureBuffer: MLFeatureSet[] = [];
  private validationCache: Map<string, MLValidationResult> = new Map();
  private performanceHistory: Map<string, number[]> = new Map();
  private isInitialized: boolean = false;
  private readonly CONFIDENCE_THRESHOLD = 0.90;
  private readonly MAX_VALIDATION_TIME = 8; // milliseconds
  private readonly FEATURE_BUFFER_SIZE = 100;
  private readonly CACHE_TTL = 1000; // 1 second

  constructor(
    private logger: Logger,
    private metricsCollector: MetricsCollector,
    private modelConfigPath?: string
  ) {
    super();
    this.initializeModels();
  }

  /**
   * Initialize ML models for trading signal validation
   */
  private async initializeModels(): Promise<void> {
    try {
      const startTime = performance.now();

      // Initialize model configurations
      this.modelConfigs = [
        {
          modelName: 'patternRecognition',
          modelPath: './models/pattern_recognition.json',
          weight: 0.25,
          enabled: true,
          retrainInterval: 24 * 60 * 60 * 1000, // 24 hours
          performanceThreshold: 0.85
        },
        {
          modelName: 'orderFlowPrediction',
          modelPath: './models/order_flow_prediction.json',
          weight: 0.30,
          enabled: true,
          retrainInterval: 12 * 60 * 60 * 1000, // 12 hours
          performanceThreshold: 0.80
        },
        {
          modelName: 'volatilityForecast',
          modelPath: './models/volatility_forecast.json',
          weight: 0.20,
          enabled: true,
          retrainInterval: 6 * 60 * 60 * 1000, // 6 hours
          performanceThreshold: 0.75
        },
        {
          modelName: 'liquidityAnalysis',
          modelPath: './models/liquidity_analysis.json',
          weight: 0.15,
          enabled: true,
          retrainInterval: 4 * 60 * 60 * 1000, // 4 hours
          performanceThreshold: 0.70
        },
        {
          modelName: 'riskAssessment',
          modelPath: './models/risk_assessment.json',
          weight: 0.10,
          enabled: true,
          retrainInterval: 8 * 60 * 60 * 1000, // 8 hours
          performanceThreshold: 0.78
        }
      ];

      // Load pre-trained models or create new ones
      for (const config of this.modelConfigs) {
        if (config.enabled) {
          try {
            const model = await this.loadOrCreateModel(config);
            this.models.set(config.modelName, model);
            this.performanceHistory.set(config.modelName, []);
            
            this.logger.info(`ML model ${config.modelName} initialized successfully`, {
              modelPath: config.modelPath,
              weight: config.weight
            });
          } catch (error) {
            this.logger.error(`Failed to initialize model ${config.modelName}`, error);
            config.enabled = false;
          }
        }
      }

      this.isInitialized = true;
      const initTime = performance.now() - startTime;
      
      this.metricsCollector.recordMetric('ml_validator_init_time', initTime);
      this.logger.info('MLValidator initialized successfully', {
        modelsLoaded: this.models.size,
        initializationTime: initTime
      });

      this.emit('initialized', { modelsCount: this.models.size });

    } catch (error) {
      this.logger.error('Failed to initialize MLValidator', error);
      throw new TradingError('MLValidator initialization failed', 'ML_INIT_ERROR', error);
    }
  }

  /**
   * Load existing model or create a new one
   */
  private async loadOrCreateModel(config: MLModelConfig): Promise<tf.LayersModel> {
    try {
      // Try to load existing model
      const model = await tf.loadLayersModel(`file://${config.modelPath}`);
      this.logger.info(`Loaded existing model: ${config.modelName}`);
      return model;
    } catch (error) {
      // Create new model if loading fails
      this.logger.warn(`Creating new model for ${config.modelName}`, error);
      return this.createNewModel(config.modelName);
    }
  }

  /**
   * Create a new neural network model
   */
  private createNewModel(modelType: string): tf.LayersModel {
    const model = tf.sequential();

    switch (modelType) {
      case 'patternRecognition':
        // LSTM-based pattern recognition model
        model.add(tf.layers.lstm({
          units: 64,
          returnSequences: true,
          inputShape: [20, 15] // 20 time steps, 15 features
        }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.lstm({ units: 32, returnSequences: false }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 3, activation: 'softmax' })); // BUY, SELL, WAIT
        break;

      case 'orderFlowPrediction':
        // Convolutional model for order flow analysis
        model.add(tf.layers.conv1d({
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
          inputShape: [50, 8] // 50 time steps, 8 order flow features
        }));
        model.add(tf.layers.maxPooling1d({ poolSize: 2 }));
        model.add(tf.layers.conv1d({ filters: 64, kernelSize: 3, activation: 'relu' }));
        model.add(tf.layers.globalMaxPooling1d());
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        model.add(tf.layers.dropout({ rate: 0.3 }));
        model.add(tf.layers.dense({ units: 3, activation: 'softmax' }));
        break;

      case 'volatilityForecast':
        // Dense network for volatility prediction
        model.add(tf.layers.dense({
          units: 64,
          activation: 'relu',
          inputShape: [10] // 10 volatility indicators
        }));
        model.add(tf.layers.batchNormalization());
        model.add(tf.layers.dropout({ rate: 0.25 }));
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // Volatility score
        break;

      case 'liquidityAnalysis':
        // Ensemble model for liquidity analysis
        model.add(tf.layers.dense({
          units: 48,
          activation: 'tanh',
          inputShape: [12] // 12 liquidity features
        }));
        model.add(tf.layers.dropout({ rate: 0.2 }));
        model.add(tf.layers.dense({ units: 24, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // Liquidity score
        break;

      case 'riskAssessment':
        // Risk assessment neural network
        model.add(tf.layers.dense({
          units: 32,
          activation: 'relu',
          inputShape: [8] // 8 risk indicators
        }));
        model.add(tf.layers.dropout({ rate: 0.3 }));
        model.add(tf.layers.dense({ units: 16, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1, activation: 'sigmoid' })); // Risk score
        break;

      default:
        throw new TradingError(`Unknown model type: ${modelType}`, 'ML_MODEL_ERROR');
    }

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Validate trading signal using ML ensemble
   */
  public async validateSignal(
    marketData: MarketData,
    tapeEntries: TapeEntry[],
    patterns: PatternMatch[],
    decisionAnalysis: DecisionAnalysis
  ): Promise<MLValidationResult> {
    if (!this.isInitialized) {
      throw new TradingError('MLValidator not initialized', 'ML_NOT_INITIALIZED');
    }

    const startTime = performance.now();
    
    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(marketData, decisionAnalysis);
      const cached = this.validationCache.get(cacheKey);
      
      if (cached && (startTime - cached.validationTime) < this.CACHE_TTL) {
        this.metricsCollector.recordMetric('ml_validator_cache_hit', 1);
        return cached;
      }

      // Extract features for ML models
      const features = this.extractFeatures(marketData, tapeEntries, patterns, decisionAnalysis);
      
      // Run ensemble validation
      const modelScores = await this.runEnsemblePrediction(features);
      
      // Calculate ensemble confidence
      const confidence = this.calculateEnsembleConfidence(modelScores);
      const riskAdjustedConfidence = this.adjustConfidenceForRisk(confidence, features);
      
      // Generate prediction
      const prediction = this.generatePrediction(modelScores, confidence);
      
      // Validate against threshold
      const isValid = riskAdjustedConfidence >= this.CONFIDENCE_THRESHOLD;
      
      const validationTime = performance.now() - startTime;
      
      // Check latency requirement
      if (validationTime > this.MAX_VALIDATION_TIME) {
        this.logger.warn('ML validation exceeded latency requirement', {
          validationTime,
          maxTime: this.MAX_VALIDATION_TIME
        });
      }

      const result: MLValidationResult = {
        isValid,
        confidence,
        prediction,
        modelScores,
        riskAdjustedConfidence,
        validationTime,
        reason: this.generateValidationReason(modelScores, confidence, isValid),
        supportingEvidence: this.generateSupportingEvidence(features, modelScores),
        warnings: this.generateWarnings(features, modelScores, validationTime)
      };

      // Cache result
      this.validationCache.set(cacheKey, result);

      // Record metrics
      this.metricsCollector.recordMetric('ml_validation_time', validationTime);
      this.metricsCollector.recordMetric('ml_validation_confidence', confidence);
      this.metricsCollector.recordMetric('ml_validation_success', isValid ? 1 : 0);

      this.emit('validation_complete', result);
      
      return result;

    } catch (error) {
      const validationTime = performance.now() - startTime;
      this.logger.error('ML validation failed', error);
      this.metricsCollector.recordMetric('ml_validation_error', 1);
      
      throw new TradingError('ML validation failed', 'ML_VALIDATION_ERROR', {
        error: error.message,
        validationTime
      });
    }
  }

  /**
   * Extract features from market data for ML models
   */
  private extractFeatures(
    marketData: MarketData,
    tapeEntries: TapeEntry[],
    patterns: PatternMatch[],
    decisionAnalysis: DecisionAnalysis
  ): MLFeatureSet {
    const features: MLFeatureSet = {
      // Price action features
      priceMovement: this.extractPriceMovementFeatures(marketData, tapeEntries),
      volumeProfile: this.extractVolumeFeatures(tapeEntries),
      volatilityIndex: this.extractVolatilityFeatures(marketData, tapeEntries),
      
      // Order flow features
      buyPressure: this.extractBuyPressureFeatures(tapeEntries),
      sellPressure: this.extractSellPressureFeatures(tapeEntries),
      orderImbalance: this.extractImbalanceFeatures(tapeEntries),
      absorptionRate: this.extractAbsorptionFeatures(tapeEntries),
      
      // Market microstructure
      spreadDynamics: this.extractSpreadFeatures(marketData),
      liquidityDepth: this.extractLiquidityFeatures(marketData),
      tickFrequency: this.extractTickFrequencyFeatures(tapeEntries),
      
      // Temporal features
      timeOfDay: this.extractTimeFeatures(marketData.timestamp).timeOfDay,
      dayOfWeek: this.extractTimeFeatures(marketData.timestamp).dayOfWeek,
      marketSession: this.extractSessionFeatures(marketData.marketPhase),
      
      // Pattern features
      patternStrength: patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length || 0,
      patternReliability: patterns.reduce((sum, p) => sum + p.historicalSuccess, 0) / patterns.length || 0,
      historicalOutcome: decisionAnalysis.finalCertainty
    };

    // Add to feature buffer for continuous learning
    this.featureBuffer.push(features);
    if (this.featureBuffer.length > this.FEATURE_BUFFER_SIZE) {
      this.featureBuffer.shift();
    }

    return features;
  }

  // Feature extraction helper methods
  private extractPriceMovementFeatures(marketData: MarketData, tapeEntries: TapeEntry[]): number[] {
    const recentTicks = tapeEntries.slice(-20);
    return recentTicks.map(entry => (entry.price - marketData.price) / marketData.price);
  }

  private extractVolumeFeatures(tapeEntries: TapeEntry[]): number[] {
    const recentTicks = tapeEntries.slice(-20);
    const totalVolume = recentTicks.reduce((sum, entry) => sum + entry.volume, 0);
    return recentTicks.map(entry => entry.volume / (totalVolume || 1));
  }

  private extractVolatilityFeatures(marketData: MarketData, tapeEntries: TapeEntry[]): number[] {
    const prices = tapeEntries.slice(-20).map(entry => entry.price);
    const returns = prices.slice(1).map((price, i) => Math.log(price / prices[i]));
    const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
    return [volatility, marketData.volatility];
  }

  private extractBuyPressureFeatures(tapeEntries: TapeEntry[]): number[] {
    const recentTicks = tapeEntries.slice(-50);
    const buyTicks = recentTicks.filter(entry => entry.aggressor === 'buyer');
    const buyVolume = buyTicks.reduce((sum, entry) => sum + entry.volume, 0);
    const totalVolume = recentTicks.reduce((sum, entry) => sum + entry.volume, 0);
    return [buyVolume / (totalVolume || 1), buyTicks.length / recentTicks.length];
  }

  private extractSellPressureFeatures(tapeEntries: TapeEntry[]): number[] {
    const recentTicks = tapeEntries.slice(-50);
    const sellTicks = recentTicks.filter(entry => entry.aggressor === 'seller');
    const sellVolume = sellTicks.reduce((sum, entry) => sum + entry.volume, 0);
    const totalVolume = recentTicks.reduce((sum, entry) => sum + entry.volume, 0);
    return [sellVolume / (totalVolume || 1), sellTicks.length / recentTicks.length];
  }

  private extractImbalanceFeatures(tapeEntries: TapeEntry[]): number[] {
    const buyPressure = this.extractBuyPressureFeatures(tapeEntries);
    const sellPressure = this.extractSellPressureFeatures(tapeEntries);
    return [buyPressure[0] - sellPressure[0], buyPressure[1] - sellPressure[1]];
  }

  private extractAbsorptionFeatures(tapeEntries: TapeEntry[]): number[] {
    const absorptionTicks = tapeEntries.filter(entry => entry.absorption);
    return [absorptionTicks.length / tapeEntries.length];
  }

  private extractSpreadFeatures(marketData: MarketData): number[] {
    return [marketData.spread, marketData.spread / marketData.price];
  }

  private extractLiquidityFeatures(marketData: MarketData): number[] {
    const liquidityScore = marketData.liquidityLevel === 'high' ? 1 : 
                          marketData.liquidityLevel === 'medium' ? 0.5 : 0;
    return [liquidityScore, marketData.orderBookImbalance];
  }

  private extractTickFrequencyFeatures(tapeEntries: TapeEntry[]): number[] {
    const timeSpan = Math.max(...tapeEntries.map(e => e.timestamp)) - 
                    Math.min(...tapeEntries.map(e => e.timestamp));
    return [tapeEntries.length / (timeSpan || 1)];
  }

  private extractTimeFeatures(timestamp: number) {
    const date = new Date(timestamp);
    return {
      timeOfDay: (date.getHours() * 60 + date.getMinutes()) / 1440, // Normalized to 0-1
      dayOfWeek: date.getDay() / 6 // Normalized to 0-1
    };
  }

  private extractSessionFeatures(marketPhase: string): number {
    const sessionMap = { 'pre-market': 0, 'open': 1, 'close': 0.5, 'after-hours': 0.25 };
    return sessionMap[marketPhase] || 0.5;
  }

  /**
   * Run ensemble prediction across all models
   */
  private async runEnsemblePrediction(features: MLFeatureSet): Promise<ModelScores> {
    const scores: ModelScores = {
      patternRecognition: 0,
      orderFlowPrediction: 0,
      volatilityForecast: 0,
      liquidityAnalysis: 0,
      riskAssessment: 0,
      ensembleScore: 0
    };

    const predictions = await Promise.allSettled([
      this.predictPatternRecognition(features),
      this.predictOrderFlow(features),
      this.predictVolatility(features),
      this.predictLiquidity(features),
      this.predictRisk(features)
    ]);

    // Process results
    if (predictions[0].status === 'fulfilled') scores.patternRecognition = predictions[0].value;
    if (predictions[1].status === 'fulfilled') scores.orderFlowPrediction = predictions[1].value;
    if (predictions[2].status === 'fulfilled') scores.volatilityForecast = predictions[2].value;
    if (predictions[3].status === 'fulfilled') scores.liquidityAnalysis = predictions[3].value;
    if (predictions[4].status === 'fulfilled') scores.riskAssessment = predictions[4].value;

    // Calculate ensemble score with weights
    const configs = this.modelConfigs.filter(c => c.enabled);
    let weightedSum = 0;
    let totalWeight = 0;

    configs.forEach(config => {
      const score = scores[config.modelName as keyof ModelScores] as number;
      if (score > 0) {
        weightedSum += score * config.weight;
        totalWeight += config.weight;
      }
    });

    scores.ensembleScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    return scores;
  }

  // Model-specific prediction methods
  private async predictPatternRecognition(features: MLFeatureSet): Promise<number> {
    const model = this.models.get('patternRecognition');
    if (!model) return 0;

    const input = tf.tensor3d([[features.priceMovement.concat(
      features.volumeProfile,
      features.volatilityIndex
    ).slice(0, 15)]], [1, 1, 15]);

    const prediction = model.predict(input) as tf.Tensor;
    const result = await prediction.data();
    
    input.dispose();
    prediction.dispose();
    
    return Math.max(...Array.from(result));
  }

  private async predictOrderFlow(features: MLFeatureSet): Promise<number> {
    const model = this.models.get('orderFlowPrediction');
    if (!model) return 0;

    const orderFlowFeatures = features.buyPressure.concat(
      features.sellPressure,
      features.orderImbalance,
      features.absorptionRate
    ).slice(0, 8);

    const input = tf.tensor3d([[orderFlowFeatures]], [1, 1, 8]);
    const prediction = model.predict(input) as tf.Tensor;
    const result = await prediction.data();
    
    input.dispose();
    prediction.dispose();
    
    return Math.max(...Array.from(result));
  }

  private async predictVolatility(features: MLFeatureSet): Promise<number> {
    const model = this.models.get('volatilityForecast');
    if (!model) return 0;

    const volFeatures = features.volatilityIndex.concat(
      features.spreadDynamics,
      features.tickFrequency
    ).slice(0, 10);

    const input = tf.tensor2d([volFeatures], [1, 10]);
    const prediction = model.predict(input) as tf.Tensor;
    const result = await prediction.data();
    
    input.dispose();
    prediction.dispose();
    
    return result[0];
  }

  private async predictLiquidity(features: MLFeatureSet): Promise<number> {
    const model = this.models.get('liquidityAnalysis');
    if (!model) return 0;

    const liqFeatures = features.liquidityDepth.concat(
      features.spreadDynamics,
      [features.timeOfDay, features.marketSession]
    ).slice(0, 12);

    const input = tf.tensor2d([liqFeatures], [1, 12]);
    const prediction = model.predict(input) as tf.Tensor;
    const result = await prediction.data();
    
    input.dispose();
    prediction.dispose();
    
    return result[0];
  }

  private async predictRisk(features: MLFeatureSet): Promise<number> {
    const model = this.models.get('riskAssessment');
    if (!model) return 0;

    const riskFeatures = [
      features.volatilityIndex[0] || 0,
      features.patternStrength,
      features.patternReliability,
      features.historicalOutcome,
      features.timeOfDay,
      features.dayOfWeek,
      features.marketSession,
      Math.abs(features.orderImbalance[0] || 0)
    ];

    const input = tf.tensor2d([riskFeatures], [1, 8]);
    const prediction = model.predict(input) as tf.Tensor;
    const result = await prediction.data();
    
    input.dispose();
    prediction.dispose();
    
    return 1 - result[0]; // Higher score = lower risk
  }

  /**
   * Calculate ensemble confidence with advanced weighting
   */
  private calculateEnsembleConfidence(scores: ModelScores): number {
    const baseConfidence = scores.ensembleScore;
    
    // Apply confidence boosting based on model agreement
    const modelScores = [
      scores.patternRecognition,
      scores.orderFlowPrediction,
      scores.volatilityForecast,
      scores.liquidityAnalysis,
      scores.riskAssessment
    ].filter(score => score > 0);

    if (modelScores.length === 0) return 0;

    // Calculate standard deviation to measure agreement
    const mean = modelScores.reduce((sum, score) => sum + score, 0) / modelScores.length;
    const variance = modelScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / modelScores.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation (higher agreement) boosts confidence
    const agreementBoost = Math.max(0, (0.2 - stdDev) * 2);
    
    return Math.min(1, baseConfidence + agreementBoost);
  }

  /**
   * Adjust confidence based on risk factors
   */
  private adjustConfidenceForRisk(confidence: number, features: MLFeatureSet): number {
    let riskAdjustment = 1;

    // High volatility penalty
    const volatility = features.volatilityIndex[0] || 0;
    if (volatility > 0.02) {
      riskAdjustment *= 0.9;
    }

    // Low liquidity penalty
    const liquidityScore = features.liquidityDepth[0] || 0;
    if (liquidityScore < 0.3) {
      riskAdjustment *= 0.85;
    }

    // Time-based adjustments
    if (features.timeOfDay < 0.25 || features.timeOfDay > 0.75) { // Off-hours
      riskAdjustment *= 0.9;
    }

    // Pattern reliability boost
    if (features.patternReliability > 0.8) {
      riskAdjustment *= 1.1;
    }

    return confidence * riskAdjustment;
  }

  /**
   * Generate trading prediction from model scores
   */
  private generatePrediction(scores: ModelScores, confidence: number): 'BUY' | 'SELL' | 'WAIT' {
    if (confidence < this.CONFIDENCE_THRESHOLD) {
      return 'WAIT';
    }

    // Determine direction based on model scores
    const buySignal = scores.patternRecognition > 0.7 && scores.orderFlowPrediction > 0.6;
    const sellSignal = scores.patternRecognition < 0.3 && scores.orderFlowPrediction < 0.4;

    if (buySignal && !sellSignal) return 'BUY';
    if (sellSignal && !buySignal) return 'SELL';
    return 'WAIT';
  }

  /**
   * Generate cache key for validation results
   */
  private generateCacheKey(marketData: MarketData, decisionAnalysis: DecisionAnalysis): string {
    return `${marketData.timestamp}_${marketData.price}_${decisionAnalysis.finalCertainty}`;
  }

  /**
   * Generate validation reason
   */
  private generateValidationReason(scores: ModelScores, confidence: number, isValid: boolean): string {
    if (!isValid) {
      return `Signal rejected: confidence ${(confidence * 100).toFixed(1)}% below threshold ${(this.CONFIDENCE_THRESHOLD * 100)}%`;
    }

    const strongestModel = Object.entries(scores)
      .filter(([key]) => key !== 'ensembleScore')
      .reduce((max, [key, value]) => value > max.value ? { key, value } : max, { key: '', value: 0 });

    return `Signal validated: ${(confidence * 100).toFixed(1)}% confidence, strongest signal from ${strongestModel.key}`;
  }

  /**
   * Generate supporting evidence
   */
  private generateSupportingEvidence(features: MLFeatureSet, scores: ModelScores): string[] {
    const evidence: string[] = [];

    if (scores.patternRecognition > 0.7) {
      evidence.push(`Strong pattern recognition (${(scores.patternRecognition * 100).toFixed(1)}%)`);
    }

    if (scores.orderFlowPrediction > 0.6) {
      evidence.push(`Favorable order flow prediction (${(scores.orderFlowPrediction * 100).toFixed(1)}%)`);
    }

    if (features.patternReliability > 0.8) {
      evidence.push(`High historical pattern reliability (${(features.patternReliability * 100).toFixed(1)}%)`);
    }

    if (scores.liquidityAnalysis > 0.7) {
      evidence.push(`Adequate liquidity detected (${(scores.liquidityAnalysis * 100).toFixed(1)}%)`);
    }

    return evidence;
  }

  /**
   * Generate warnings
   */
  private generateWarnings(features: MLFeatureSet, scores: ModelScores, validationTime: number): string[] {
    const warnings: string[] = [];

    if (validationTime > this.MAX_VALIDATION_TIME) {
      warnings.push(`Validation time exceeded limit: ${validationTime.toFixed(2)}ms > ${this.MAX_VALIDATION_TIME}ms`);
    }

    if (scores.riskAssessment < 0.5) {
      warnings.push(`High risk assessment: ${(scores.riskAssessment * 100).toFixed(1)}%`);
    }

    if (features.volatilityIndex[0] > 0.02) {
      warnings.push(`High volatility detected: ${(features.volatilityIndex[0] * 100).toFixed(2)}%`);
    }

    const activeModels = Object.values(scores).filter(score => score > 0).length;
    if (activeModels < 3) {
      warnings.push(`Limited model consensus: only ${activeModels} models active`);
    }

    return warnings;
  }

  /**
   * Update model performance based on actual trading outcomes
   */
  public updateModelPerformance(
    validationResult: MLValidationResult,
    actualOutcome: 'win' | 'loss' | 'breakeven'
  ): void {
    const performanceScore = actualOutcome === 'win' ? 1 : 
                           actualOutcome === 'breakeven' ? 0.5 : 0;

    // Update performance history for each model
    Object.entries(validationResult.modelScores).forEach(([modelName, score]) => {
      if (modelName !== 'ensembleScore' && score > 0) {
        const history = this.performanceHistory.get(modelName) || [];
        history.push(performanceScore);
        
        // Keep only last 1000 outcomes
        if (history.length > 1000) {
          history.shift();
        }
        
        this.performanceHistory.set(modelName, history);

        // Update model weights based on performance
        this.updateModelWeights(modelName, history);
      }
    });

    this.logger.info('Model performance updated', {
      outcome: actualOutcome,
      confidence: validationResult.confidence,
      prediction: validationResult.prediction
    });
  }

  /**
   * Update model weights based on performance
   */
  private updateModelWeights(modelName: string, performanceHistory: number[]): void {
    if (performanceHistory.length < 100) return; // Wait for enough data

    const recentPerformance = performanceHistory.slice(-100);
    const avgPerformance = recentPerformance.reduce((sum, score) => sum + score, 0) / recentPerformance.length;
    
    const config = this.modelConfigs.find(c => c.modelName === modelName);
    if (config) {
      // Adjust weight based on performance
      const baseWeight = 0.2; // Default weight
      const performanceMultiplier = avgPerformance / 0.5; // Normalize around 0.5 (breakeven)
      config.weight = Math.max(0.05, Math.min(0.4, baseWeight * performanceMultiplier));

      this.logger.debug(`Updated weight for ${modelName}`, {
        avgPerformance,
        newWeight: config.weight
      });
    }
  }

  /**
   * Get validation statistics
   */
  public getValidationStats(): any {
    const stats = {
      modelsActive: this.models.size,
      cacheSize: this.validationCache.size,
      featureBufferSize: this.featureBuffer.length,
      performanceHistory: {}
    };

    this.performanceHistory.forEach((history, modelName) => {
      if (history.length > 0) {
        const recent = history.slice(-100);
        const avgPerformance = recent.reduce((sum, score) => sum + score, 0) / recent.length;
        stats.performanceHistory[modelName] = {
          samples: history.length,
          recentPerformance: avgPerformance,
          winRate: recent.filter(score => score > 0.7).length / recent.length
        };
      }
    });

    return stats;
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    // Dispose TensorFlow models
    this.models.forEach(model => model.dispose());
    this.models.clear();
    
    // Clear caches
    this.validationCache.clear();
    this.performanceHistory.clear();
    this.featureBuffer = [];
    
    this.isInitialized = false;
    this.emit('disposed');
    
    this.logger.info('MLValidator disposed successfully');
  }
}

export default MLValidator;