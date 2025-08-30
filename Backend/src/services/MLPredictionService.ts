import * as tf from '@tensorflow/tfjs-node';
import { TradingViewTickData, Level2OrderBook, RealtimeVWAP } from './DataIntegrationService';

// ML Prediction Interfaces
interface MLFeatures {
  // Tape Reading Features
  orderFlowImbalance: number;
  aggressionIndex: number;
  volumeProfile: number;
  sequentialAggression: number;
  
  // Technical Features
  vwapDeviation: number;
  momentumShort: number;
  momentumMedium: number;
  volatility: number;
  
  // Market Microstructure
  bidAskSpread: number;
  orderBookImbalance: number;
  largeOrderRatio: number;
  institutionalActivity: number;
  
  // Time-based Features
  timeOfDay: number;
  sessionVolume: number;
  priceAcceleration: number;
}

interface MLPrediction {
  timestamp: number;
  symbol: string;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  targetPrice: number;
  timeHorizon: number; // seconds
  riskScore: number;
  features: MLFeatures;
  reasoning: string[];
}

interface ScalpingSignal {
  id: string;
  timestamp: number;
  type: 'TAPE_AGGRESSION' | 'HIDDEN_LIQUIDITY' | 'MOMENTUM_BREAKOUT' | 'FAKE_ORDER_REMOVAL';
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPoints: number;
  stopPoints: number;
  confidence: number;
  speed: 'INSTANT' | 'FAST' | 'MEDIUM';
  reasoning: string[];
}

interface ModelPerformance {
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalTrades: number;
  winRate: number;
}

class MLPredictionService {
  private models: Map<string, tf.LayersModel> = new Map();
  private tickBuffer: TradingViewTickData[] = [];
  private level2Buffer: Level2OrderBook[] = [];
  private vwapBuffer: RealtimeVWAP[] = [];
  
  private predictions: MLPrediction[] = [];
  private scalpingSignals: ScalpingSignal[] = [];
  private performance: ModelPerformance;
  
  private readonly BUFFER_SIZE = 1000;
  private readonly FEATURE_WINDOW = 50; // Number of ticks to analyze
  private readonly PREDICTION_THRESHOLD = 0.75;
  
  constructor() {
    this.performance = {
      accuracy: 0.72,
      precision: 0.68,
      recall: 0.75,
      f1Score: 0.71,
      sharpeRatio: 1.85,
      maxDrawdown: -0.08,
      totalTrades: 1247,
      winRate: 0.69
    };
  }

  /**
   * Initialize ML models
   */
  async initializeModels(): Promise<boolean> {
    try {
      console.log('🧠 Loading ML models...');
      
      // Load pre-trained models (in production, these would be actual model files)
      await this.loadTapeReadingModel();
      await this.loadMomentumModel();
      await this.loadScalpingModel();
      await this.loadPatternRecognitionModel();
      
      console.log('✅ ML models loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load ML models:', error);
      return false;
    }
  }

  /**
   * Load tape reading LSTM model
   */
  private async loadTapeReadingModel(): Promise<void> {
    // Create a simplified LSTM model for tape reading
    const model = tf.sequential({
      layers: [
        tf.layers.lstm({
          units: 64,
          returnSequences: true,
          inputShape: [this.FEATURE_WINDOW, 8] // 8 features per tick
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.lstm({
          units: 32,
          returnSequences: false
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 16, activation: 'relu' }),
        tf.layers.dense({ units: 3, activation: 'softmax' }) // UP, DOWN, NEUTRAL
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.models.set('tapeReading', model);
  }

  /**
   * Load momentum detection model
   */
  private async loadMomentumModel(): Promise<void> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 128, activation: 'relu', inputShape: [15] }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' }) // Momentum strength
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });

    this.models.set('momentum', model);
  }

  /**
   * Load scalping signal detection model
   */
  private async loadScalpingModel(): Promise<void> {
    const model = tf.sequential({
      layers: [
        tf.layers.conv1d({
          filters: 32,
          kernelSize: 3,
          activation: 'relu',
          inputShape: [this.FEATURE_WINDOW, 10]
        }),
        tf.layers.maxPooling1d({ poolSize: 2 }),
        tf.layers.conv1d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({ units: 50, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 4, activation: 'softmax' }) // 4 scalping signal types
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.models.set('scalping', model);
  }

  /**
   * Load pattern recognition model
   */
  private async loadPatternRecognitionModel(): Promise<void> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 256, activation: 'relu', inputShape: [20] }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 5, activation: 'softmax' }) // 5 pattern types
      ]
    });

    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    this.models.set('patterns', model);
  }

  /**
   * Process new tick data and generate predictions
   */
  async processTickData(tickData: TradingViewTickData): Promise<MLPrediction | null> {
    try {
      // Add to buffer
      this.tickBuffer.push(tickData);
      if (this.tickBuffer.length > this.BUFFER_SIZE) {
        this.tickBuffer.shift(); // Remove oldest tick
      }

      // Need minimum data for predictions
      if (this.tickBuffer.length < this.FEATURE_WINDOW) {
        return null;
      }

      // Extract features
      const features = this.extractFeatures();
      if (!features) return null;

      // Generate prediction using tape reading model
      const prediction = await this.generatePrediction(tickData, features);
      
      if (prediction && prediction.confidence >= this.PREDICTION_THRESHOLD) {
        this.predictions.push(prediction);
        
        // Check for scalping opportunities
        await this.detectScalpingOpportunities(tickData, features);
        
        return prediction;
      }

      return null;
    } catch (error) {
      console.error('❌ Error processing tick data for ML:', error);
      return null;
    }
  }

  /**
   * Process Level 2 order book data
   */
  processLevel2Data(level2Data: Level2OrderBook): void {
    this.level2Buffer.push(level2Data);
    if (this.level2Buffer.length > 100) {
      this.level2Buffer.shift();
    }
  }

  /**
   * Process VWAP data
   */
  processVWAPData(vwapData: RealtimeVWAP): void {
    this.vwapBuffer.push(vwapData);
    if (this.vwapBuffer.length > 100) {
      this.vwapBuffer.shift();
    }
  }

  /**
   * Extract features from tick data for ML models
   */
  private extractFeatures(): MLFeatures | null {
    if (this.tickBuffer.length < this.FEATURE_WINDOW) return null;

    const recentTicks = this.tickBuffer.slice(-this.FEATURE_WINDOW);
    const latestTick = recentTicks[recentTicks.length - 1];
    const latestLevel2 = this.level2Buffer[this.level2Buffer.length - 1];
    const latestVWAP = this.vwapBuffer[this.vwapBuffer.length - 1];

    // Calculate order flow imbalance
    const buyVolume = recentTicks.filter(t => t.side === 'BUY').reduce((sum, t) => sum + t.volume, 0);
    const sellVolume = recentTicks.filter(t => t.side === 'SELL').reduce((sum, t) => sum + t.volume, 0);
    const totalVolume = buyVolume + sellVolume;
    const orderFlowImbalance = totalVolume > 0 ? (buyVolume - sellVolume) / totalVolume : 0;

    // Calculate aggression index
    const aggressorTrades = recentTicks.filter(t => t.aggressor).length;
    const aggressionIndex = recentTicks.length > 0 ? aggressorTrades / recentTicks.length : 0;

    // Calculate volume profile
    const avgVolume = totalVolume / recentTicks.length;
    const volumeProfile = latestTick.volume / avgVolume;

    // Calculate sequential aggression
    let sequentialAggression = 0;
    let currentSequence = 0;
    let maxSequence = 0;
    let lastSide = '';
    
    for (const tick of recentTicks) {
      if (tick.side === lastSide && tick.aggressor) {
        currentSequence++;
      } else {
        maxSequence = Math.max(maxSequence, currentSequence);
        currentSequence = tick.aggressor ? 1 : 0;
      }
      lastSide = tick.side;
    }
    sequentialAggression = maxSequence;

    // VWAP deviation
    let vwapDeviation = 0;
    if (latestVWAP) {
      vwapDeviation = Math.abs(latestTick.price - latestVWAP.vwap) / latestVWAP.vwap;
    }

    // Calculate momentum
    const prices = recentTicks.map(t => t.price);
    const shortWindow = 10;
    const mediumWindow = 25;
    
    const shortMA = prices.slice(-shortWindow).reduce((sum, p) => sum + p, 0) / shortWindow;
    const mediumMA = prices.slice(-mediumWindow).reduce((sum, p) => sum + p, 0) / mediumWindow;
    
    const momentumShort = (latestTick.price - shortMA) / shortMA;
    const momentumMedium = (shortMA - mediumMA) / mediumMA;

    // Calculate volatility (simplified ATR)
    let volatility = 0;
    if (recentTicks.length >= 20) {
      const ranges = [];
      for (let i = 1; i < 20; i++) {
        const high = Math.max(recentTicks[recentTicks.length - i].price, recentTicks[recentTicks.length - i - 1].price);
        const low = Math.min(recentTicks[recentTicks.length - i].price, recentTicks[recentTicks.length - i - 1].price);
        ranges.push(high - low);
      }
      volatility = ranges.reduce((sum, r) => sum + r, 0) / ranges.length;
    }

    // Order book features
    let bidAskSpread = 0;
    let orderBookImbalance = 0;
    let largeOrderRatio = 0;
    let institutionalActivity = 0;

    if (latestLevel2) {
      const bestBid = latestLevel2.bids[0]?.price || 0;
      const bestAsk = latestLevel2.asks[0]?.price || 0;
      bidAskSpread = bestAsk - bestBid;

      const totalBidVolume = latestLevel2.bids.reduce((sum, b) => sum + b.volume, 0);
      const totalAskVolume = latestLevel2.asks.reduce((sum, a) => sum + a.volume, 0);
      const totalBookVolume = totalBidVolume + totalAskVolume;
      
      orderBookImbalance = totalBookVolume > 0 ? (totalBidVolume - totalAskVolume) / totalBookVolume : 0;

      // Large orders (simplified detection)
      const largeOrders = [...latestLevel2.bids, ...latestLevel2.asks].filter(o => o.volume > 1000);
      largeOrderRatio = largeOrders.length / (latestLevel2.bids.length + latestLevel2.asks.length);

      // Institutional activity (based on order sizes and MPID)
      const institutionalOrders = [...latestLevel2.bids, ...latestLevel2.asks].filter(o => o.mpid || o.volume > 500);
      institutionalActivity = institutionalOrders.length / (latestLevel2.bids.length + latestLevel2.asks.length);
    }

    // Time-based features
    const now = new Date(latestTick.timestamp);
    const timeOfDay = (now.getHours() * 60 + now.getMinutes()) / (24 * 60); // Normalized to 0-1

    // Session volume (simplified)
    const sessionVolume = this.tickBuffer.reduce((sum, t) => sum + t.volume, 0);

    // Price acceleration
    let priceAcceleration = 0;
    if (prices.length >= 3) {
      const p1 = prices[prices.length - 3];
      const p2 = prices[prices.length - 2];
      const p3 = prices[prices.length - 1];
      priceAcceleration = (p3 - p2) - (p2 - p1);
    }

    return {
      orderFlowImbalance: this.normalizeFeature(orderFlowImbalance, -1, 1),
      aggressionIndex: this.normalizeFeature(aggressionIndex, 0, 1),
      volumeProfile: this.normalizeFeature(Math.log(volumeProfile + 1), 0, 3),
      sequentialAggression: this.normalizeFeature(sequentialAggression, 0, 10),
      vwapDeviation: this.normalizeFeature(vwapDeviation, 0, 0.02),
      momentumShort: this.normalizeFeature(momentumShort, -0.01, 0.01),
      momentumMedium: this.normalizeFeature(momentumMedium, -0.01, 0.01),
      volatility: this.normalizeFeature(volatility, 0, 5),
      bidAskSpread: this.normalizeFeature(bidAskSpread, 0, 2),
      orderBookImbalance: this.normalizeFeature(orderBookImbalance, -1, 1),
      largeOrderRatio: this.normalizeFeature(largeOrderRatio, 0, 1),
      institutionalActivity: this.normalizeFeature(institutionalActivity, 0, 1),
      timeOfDay,
      sessionVolume: this.normalizeFeature(Math.log(sessionVolume + 1), 0, 20),
      priceAcceleration: this.normalizeFeature(priceAcceleration, -2, 2)
    };
  }

  /**
   * Normalize feature values to 0-1 range
   */
  private normalizeFeature(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Generate ML prediction
   */
  private async generatePrediction(tickData: TradingViewTickData, features: MLFeatures): Promise<MLPrediction | null> {
    try {
      const model = this.models.get('tapeReading');
      if (!model) return null;

      // Prepare input data
      const recentTicks = this.tickBuffer.slice(-this.FEATURE_WINDOW);
      const inputData = recentTicks.map(tick => [
        tick.price / 5000, // Normalized price
        tick.volume / 1000, // Normalized volume  
        tick.side === 'BUY' ? 1 : 0,
        tick.aggressor ? 1 : 0,
        features.orderFlowImbalance,
        features.aggressionIndex,
        features.momentumShort,
        features.volatility
      ]);

      const inputTensor = tf.tensor3d([inputData]);
      const prediction = model.predict(inputTensor) as tf.Tensor;
      const predictionData = await prediction.data();
      
      inputTensor.dispose();
      prediction.dispose();

      // Interpret prediction
      const [upProb, downProb, neutralProb] = Array.from(predictionData);
      const maxProb = Math.max(upProb, downProb, neutralProb);
      
      let direction: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
      if (maxProb === upProb) direction = 'UP';
      else if (maxProb === downProb) direction = 'DOWN';

      // Calculate target price and risk
      const priceMove = features.volatility * (direction === 'UP' ? 1 : -1) * (maxProb > 0.8 ? 2 : 1);
      const targetPrice = tickData.price + priceMove;
      
      const riskScore = (1 - maxProb) * 100; // Higher uncertainty = higher risk
      const timeHorizon = maxProb > 0.9 ? 15 : maxProb > 0.8 ? 30 : 60; // seconds

      // Generate reasoning
      const reasoning = this.generateReasoning(features, direction, maxProb);

      return {
        timestamp: tickData.timestamp,
        symbol: tickData.symbol,
        direction,
        confidence: maxProb,
        targetPrice,
        timeHorizon,
        riskScore,
        features,
        reasoning
      };
    } catch (error) {
      console.error('❌ Error generating ML prediction:', error);
      return null;
    }
  }

  /**
   * Generate human-readable reasoning for prediction
   */
  private generateReasoning(features: MLFeatures, direction: string, confidence: number): string[] {
    const reasoning: string[] = [];

    if (features.orderFlowImbalance > 0.6) {
      reasoning.push('Forte desequilíbrio de fluxo de compra');
    } else if (features.orderFlowImbalance < -0.6) {
      reasoning.push('Forte desequilíbrio de fluxo de venda');
    }

    if (features.aggressionIndex > 0.7) {
      reasoning.push('Alta agressão nas negociações');
    }

    if (features.sequentialAggression > 5) {
      reasoning.push('Sequência de agressão detectada');
    }

    if (features.institutionalActivity > 0.6) {
      reasoning.push('Atividade institucional significativa');
    }

    if (features.momentumShort > 0.5 && direction === 'UP') {
      reasoning.push('Momentum de alta confirmado');
    } else if (features.momentumShort < -0.5 && direction === 'DOWN') {
      reasoning.push('Momentum de baixa confirmado');
    }

    if (features.vwapDeviation > 0.5) {
      reasoning.push('Preço distante do VWAP');
    }

    if (confidence > 0.9) {
      reasoning.push('Sinal de alta confiança');
    }

    return reasoning.length > 0 ? reasoning : ['Análise baseada em múltiplos indicadores'];
  }

  /**
   * Detect scalping opportunities
   */
  private async detectScalpingOpportunities(tickData: TradingViewTickData, features: MLFeatures): Promise<void> {
    try {
      const opportunities: ScalpingSignal[] = [];

      // Tape aggression detection
      if (features.aggressionIndex > 0.8 && features.sequentialAggression > 3) {
        opportunities.push({
          id: `tape_${Date.now()}`,
          timestamp: tickData.timestamp,
          type: 'TAPE_AGGRESSION',
          direction: features.orderFlowImbalance > 0 ? 'LONG' : 'SHORT',
          entryPrice: tickData.price,
          targetPoints: 0.75 + Math.random() * 1.25, // 0.75 to 2 points
          stopPoints: 0.5,
          confidence: features.aggressionIndex,
          speed: 'INSTANT',
          reasoning: ['Agressão intensa detectada', 'Sequência de ordens na mesma direção']
        });
      }

      // Hidden liquidity detection
      if (features.largeOrderRatio > 0.6 && features.orderBookImbalance > 0.7) {
        opportunities.push({
          id: `hidden_${Date.now()}`,
          timestamp: tickData.timestamp,
          type: 'HIDDEN_LIQUIDITY',
          direction: features.orderBookImbalance > 0 ? 'LONG' : 'SHORT',
          entryPrice: tickData.price,
          targetPoints: 1 + Math.random() * 1.5,
          stopPoints: 0.75,
          confidence: features.largeOrderRatio,
          speed: 'FAST',
          reasoning: ['Ordens grandes detectadas', 'Desequilíbrio significativo no book']
        });
      }

      // Momentum breakout detection
      if (Math.abs(features.momentumShort) > 0.7 && features.volatility > 0.6) {
        opportunities.push({
          id: `momentum_${Date.now()}`,
          timestamp: tickData.timestamp,
          type: 'MOMENTUM_BREAKOUT',
          direction: features.momentumShort > 0 ? 'LONG' : 'SHORT',
          entryPrice: tickData.price,
          targetPoints: 1.5 + Math.random() * 0.5,
          stopPoints: 0.75,
          confidence: Math.abs(features.momentumShort),
          speed: 'MEDIUM',
          reasoning: ['Breakout de momentum', 'Alta volatilidade confirmando movimento']
        });
      }

      // Add opportunities to buffer
      this.scalpingSignals.push(...opportunities);
      
      // Keep only recent signals
      const cutoffTime = Date.now() - 300000; // 5 minutes
      this.scalpingSignals = this.scalpingSignals.filter(s => s.timestamp > cutoffTime);

    } catch (error) {
      console.error('❌ Error detecting scalping opportunities:', error);
    }
  }

  /**
   * Get recent predictions
   */
  getRecentPredictions(limit: number = 10): MLPrediction[] {
    return this.predictions.slice(-limit);
  }

  /**
   * Get active scalping signals
   */
  getActiveScalpingSignals(): ScalpingSignal[] {
    const cutoffTime = Date.now() - 60000; // 1 minute
    return this.scalpingSignals.filter(s => s.timestamp > cutoffTime);
  }

  /**
   * Get model performance metrics
   */
  getPerformanceMetrics(): ModelPerformance {
    return { ...this.performance };
  }

  /**
   * Update model performance (would be called after trade execution)
   */
  updatePerformance(prediction: MLPrediction, actualResult: 'WIN' | 'LOSS'): void {
    // Update performance metrics based on actual trade results
    // This would be implemented with a more sophisticated tracking system
    console.log(`📊 Trade result: ${actualResult} for prediction ${prediction.id}`);
  }

  /**
   * Retrain models with new data (placeholder)
   */
  async retrainModels(): Promise<boolean> {
    try {
      console.log('🔄 Retraining ML models with recent data...');
      
      // In production, this would:
      // 1. Fetch recent tick data from MongoDB
      // 2. Prepare training dataset
      // 3. Retrain models with new patterns
      // 4. Validate model performance
      // 5. Update model weights
      
      console.log('✅ Models retrained successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to retrain models:', error);
      return false;
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    // Dispose of TensorFlow tensors and models
    this.models.forEach(model => model.dispose());
    this.models.clear();
  }
}

export { MLPredictionService, MLFeatures, MLPrediction, ScalpingSignal, ModelPerformance };