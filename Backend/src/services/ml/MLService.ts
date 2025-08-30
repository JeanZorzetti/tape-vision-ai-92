import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { MLPrediction, IMLPrediction, MarketData, IMarketData } from '../models';
import { Types } from 'mongoose';

interface MLEngineConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  authHeader?: string;
}

interface PredictionRequest {
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h';
  marketData?: {
    price: number;
    volume: number;
    volatility: number;
    orderBook?: any;
  };
  userId?: string;
  sessionId?: string;
}

interface MLEngineResponse {
  success: boolean;
  data?: {
    signal: 'BUY' | 'SELL' | 'HOLD';
    confidence: number;
    targetPrice: number;
    stopLossPrice: number;
    riskRewardRatio: number;
    timeHorizon: 'SCALP' | 'INTRADAY' | 'SWING';
    reasoning: {
      primaryFactors: string[];
      textExplanation: string;
    };
    features?: any;
    modelMetadata?: {
      modelId: string;
      version: string;
      computationTime: number;
    };
  };
  error?: string;
  latency?: number;
}

interface ModelHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  accuracy: number;
  lastPrediction: Date;
  errorRate: number;
}

export class MLService {
  private static instance: MLService;
  private client: AxiosInstance;
  private config: MLEngineConfig;
  private healthMetrics: ModelHealth;
  private connectionPool: Map<string, AxiosInstance> = new Map();

  constructor() {
    this.config = {
      baseUrl: process.env.ML_ENGINE_URL || 'http://localhost:8000',
      apiKey: process.env.ML_ENGINE_API_KEY || 'ml-engine-key-2025',
      timeout: parseInt(process.env.ML_ENGINE_TIMEOUT || '10000'),
      retryAttempts: parseInt(process.env.ML_ENGINE_RETRIES || '3'),
      authHeader: process.env.ML_ENGINE_AUTH_HEADER
    };

    this.client = this.createAxiosClient(this.config);
    
    this.healthMetrics = {
      status: 'healthy',
      latency: 0,
      accuracy: 0,
      lastPrediction: new Date(),
      errorRate: 0
    };

    // Initialize health monitoring
    this.startHealthMonitoring();
  }

  public static getInstance(): MLService {
    if (!MLService.instance) {
      MLService.instance = new MLService();
    }
    return MLService.instance;
  }

  /**
   * ML Prediction Methods
   */
  public async getPrediction(request: PredictionRequest): Promise<{
    success: boolean;
    prediction?: IMLPrediction;
    error?: string;
  }> {
    const startTime = Date.now();

    try {
      // Enhance request with latest market data if not provided
      if (!request.marketData) {
        const latestMarketData = await MarketData.findOne({ 
          symbol: request.symbol 
        }).sort({ timestamp: -1 });

        if (latestMarketData) {
          request.marketData = {
            price: latestMarketData.price,
            volume: latestMarketData.volume,
            volatility: latestMarketData.statistics.volatility.realized || 0,
            orderBook: latestMarketData.orderBook
          };
        }
      }

      // Call ML Engine
      const response = await this.callMLEngine('/predict', request);
      
      const latency = Date.now() - startTime;
      this.updateHealthMetrics(true, latency);

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'ML Engine returned no prediction data'
        };
      }

      // Create and save prediction to database
      const prediction = await this.createPredictionRecord(request, response.data, latency);

      return {
        success: true,
        prediction
      };

    } catch (error) {
      const latency = Date.now() - startTime;
      this.updateHealthMetrics(false, latency);
      
      console.error('ML prediction error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'ML prediction failed'
      };
    }
  }

  public async getBatchPredictions(requests: PredictionRequest[]): Promise<{
    success: boolean;
    predictions?: IMLPrediction[];
    errors?: string[];
  }> {
    const startTime = Date.now();
    const results = [];
    const errors = [];

    try {
      // Process requests in parallel with concurrency limit
      const BATCH_SIZE = 5;
      const batches = this.chunkArray(requests, BATCH_SIZE);

      for (const batch of batches) {
        const batchPromises = batch.map(req => this.getPrediction(req));
        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled' && result.value.success) {
            results.push(result.value.prediction!);
          } else {
            const error = result.status === 'rejected' 
              ? result.reason 
              : result.value.error;
            errors.push(`Request ${index}: ${error}`);
          }
        });
      }

      const latency = Date.now() - startTime;
      this.updateHealthMetrics(errors.length === 0, latency / requests.length);

      return {
        success: errors.length < requests.length, // Partial success is ok
        predictions: results,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      console.error('Batch ML predictions error:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Batch prediction failed']
      };
    }
  }

  public async updatePredictionConfidence(
    predictionId: string,
    newConfidence: number,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const prediction = await MLPrediction.findById(predictionId);
      
      if (!prediction) {
        return {
          success: false,
          error: 'Prediction not found'
        };
      }

      prediction.updateConfidence(newConfidence, reason);
      await prediction.save();

      return { success: true };

    } catch (error) {
      console.error('Update prediction confidence error:', error);
      return {
        success: false,
        error: 'Failed to update prediction confidence'
      };
    }
  }

  /**
   * Model Management
   */
  public async getModelHealth(): Promise<ModelHealth> {
    try {
      const response = await this.callMLEngine('/health');
      
      if (response.success && response.data) {
        this.healthMetrics = {
          ...this.healthMetrics,
          ...response.data
        };
      }

      return this.healthMetrics;

    } catch (error) {
      console.error('Get model health error:', error);
      this.healthMetrics.status = 'unhealthy';
      return this.healthMetrics;
    }
  }

  public async getModelStats(): Promise<{
    success: boolean;
    stats?: {
      totalPredictions: number;
      accuracyRate: number;
      averageConfidence: number;
      predictionsBySignal: Record<string, number>;
      recentPerformance: Array<{
        date: string;
        accuracy: number;
        count: number;
      }>;
    };
    error?: string;
  }> {
    try {
      // Get stats from database
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const [
        totalPredictions,
        predictions
      ] = await Promise.all([
        MLPrediction.countDocuments({ 
          timestamp: { $gte: thirtyDaysAgo }
        }),
        MLPrediction.find({ 
          timestamp: { $gte: thirtyDaysAgo },
          outcome: { $exists: true }
        })
      ]);

      const accurateCount = predictions.filter(p => p.outcome?.accuracy === 1).length;
      const accuracyRate = predictions.length > 0 ? accurateCount / predictions.length : 0;
      
      const averageConfidence = predictions.length > 0 
        ? predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length 
        : 0;

      const predictionsBySignal = predictions.reduce((acc, p) => {
        acc[p.signal] = (acc[p.signal] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Calculate daily performance for last 7 days
      const recentPerformance = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

        const dailyPredictions = predictions.filter(p => 
          p.timestamp >= startOfDay && p.timestamp < endOfDay
        );

        const dailyAccurate = dailyPredictions.filter(p => p.outcome?.accuracy === 1).length;
        const dailyAccuracy = dailyPredictions.length > 0 
          ? dailyAccurate / dailyPredictions.length 
          : 0;

        recentPerformance.push({
          date: startOfDay.toISOString().split('T')[0],
          accuracy: dailyAccuracy,
          count: dailyPredictions.length
        });
      }

      return {
        success: true,
        stats: {
          totalPredictions,
          accuracyRate,
          averageConfidence,
          predictionsBySignal,
          recentPerformance
        }
      };

    } catch (error) {
      console.error('Get model stats error:', error);
      return {
        success: false,
        error: 'Failed to get model statistics'
      };
    }
  }

  /**
   * Model Training and Updates
   */
  public async retrain model(
    modelId: string,
    trainingConfig?: {
      lookbackDays: number;
      features: string[];
      hyperparameters?: Record<string, any>;
    }
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      const config = trainingConfig || {
        lookbackDays: 30,
        features: ['price', 'volume', 'volatility', 'orderBook'],
        hyperparameters: {
          learningRate: 0.001,
          epochs: 100,
          batchSize: 32
        }
      };

      const response = await this.callMLEngine('/retrain', {
        modelId,
        config
      });

      if (response.success && response.data) {
        return {
          success: true,
          jobId: response.data.jobId
        };
      }

      return {
        success: false,
        error: response.error || 'Retraining request failed'
      };

    } catch (error) {
      console.error('Retrain model error:', error);
      return {
        success: false,
        error: 'Failed to initiate model retraining'
      };
    }
  }

  public async getTrainingStatus(jobId: string): Promise<{
    success: boolean;
    status?: 'pending' | 'running' | 'completed' | 'failed';
    progress?: number;
    eta?: number;
    error?: string;
  }> {
    try {
      const response = await this.callMLEngine(`/training/status/${jobId}`);
      
      if (response.success && response.data) {
        return {
          success: true,
          ...response.data
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to get training status'
      };

    } catch (error) {
      console.error('Get training status error:', error);
      return {
        success: false,
        error: 'Failed to get training status'
      };
    }
  }

  /**
   * Prediction Feedback
   */
  public async submitPredictionFeedback(
    predictionId: string,
    outcome: {
      actualResult: 'WIN' | 'LOSS' | 'BREAKEVEN';
      actualReturn: number;
      executionPrice?: number;
      exitPrice?: number;
      holdTime?: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update local prediction
      const prediction = await MLPrediction.findById(predictionId);
      if (!prediction) {
        return {
          success: false,
          error: 'Prediction not found'
        };
      }

      prediction.recordOutcome(outcome.actualResult, outcome.actualReturn);
      await prediction.save();

      // Send feedback to ML Engine for model improvement
      try {
        await this.callMLEngine('/feedback', {
          predictionId,
          outcome,
          originalPrediction: {
            signal: prediction.signal,
            confidence: prediction.confidence,
            targetPrice: prediction.targetPrice,
            stopLossPrice: prediction.stopLossPrice
          }
        });
      } catch (error) {
        console.warn('Failed to send feedback to ML Engine:', error);
        // Don't fail the entire operation if ML Engine feedback fails
      }

      return { success: true };

    } catch (error) {
      console.error('Submit prediction feedback error:', error);
      return {
        success: false,
        error: 'Failed to submit prediction feedback'
      };
    }
  }

  /**
   * Private Helper Methods
   */
  private createAxiosClient(config: MLEngineConfig): AxiosInstance {
    const client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.apiKey,
        ...(config.authHeader && { 'Authorization': config.authHeader })
      }
    });

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    client.interceptors.response.use(
      (response) => {
        const latency = Date.now() - (response.config.metadata?.startTime || Date.now());
        this.updateHealthMetrics(true, latency);
        return response;
      },
      (error) => {
        const latency = Date.now() - (error.config?.metadata?.startTime || Date.now());
        this.updateHealthMetrics(false, latency);
        return Promise.reject(error);
      }
    );

    return client;
  }

  private async callMLEngine(endpoint: string, data?: any): Promise<MLEngineResponse> {
    const maxRetries = this.config.retryAttempts;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const config: AxiosRequestConfig = {
          timeout: this.config.timeout,
          ...(data && { data })
        };

        const response = data 
          ? await this.client.post(endpoint, data, config)
          : await this.client.get(endpoint, config);

        return {
          success: true,
          data: response.data,
          latency: response.headers['x-response-time'] || 
                   Date.now() - (response.config.metadata?.startTime || Date.now())
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }
    }

    return {
      success: false,
      error: lastError!.message
    };
  }

  private async createPredictionRecord(
    request: PredictionRequest,
    mlResponse: any,
    latency: number
  ): Promise<IMLPrediction> {
    const predictionId = `PRED_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const expirationTime = new Date();
    switch (mlResponse.timeHorizon) {
      case 'SCALP':
        expirationTime.setMinutes(expirationTime.getMinutes() + 15);
        break;
      case 'INTRADAY':
        expirationTime.setHours(expirationTime.getHours() + 4);
        break;
      case 'SWING':
        expirationTime.setDate(expirationTime.getDate() + 3);
        break;
      default:
        expirationTime.setHours(expirationTime.getHours() + 1);
    }

    const prediction = new MLPrediction({
      predictionId,
      modelId: mlResponse.modelMetadata?.modelId || 'default-model',
      modelVersion: mlResponse.modelMetadata?.version || '1.0',
      
      symbol: request.symbol,
      timestamp: new Date(),
      marketPrice: request.marketData?.price || 0,
      
      signal: mlResponse.signal,
      confidence: mlResponse.confidence,
      strength: this.mapConfidenceToStrength(mlResponse.confidence),
      
      targetPrice: mlResponse.targetPrice,
      stopLossPrice: mlResponse.stopLossPrice,
      entryPrice: request.marketData?.price || mlResponse.targetPrice,
      
      riskRewardRatio: mlResponse.riskRewardRatio,
      expectedReturn: Math.abs(mlResponse.targetPrice - (request.marketData?.price || 0)),
      maxRisk: Math.abs((request.marketData?.price || 0) - mlResponse.stopLossPrice),
      
      timeHorizon: mlResponse.timeHorizon,
      expirationTime,
      
      reasoning: {
        primaryFactors: mlResponse.reasoning?.primaryFactors || [],
        supportingFactors: [],
        riskFactors: [],
        textExplanation: mlResponse.reasoning?.textExplanation || '',
        confidenceBreakdown: {
          technical: mlResponse.confidence * 0.4,
          orderFlow: mlResponse.confidence * 0.3,
          patterns: mlResponse.confidence * 0.2,
          sentiment: mlResponse.confidence * 0.1
        }
      },
      
      metadata: {
        trainingDataSize: 0,
        featureCount: Object.keys(mlResponse.features || {}).length,
        modelComplexity: 'MEDIUM',
        computationTime: latency,
        dataLatency: 0,
        environment: 'PRODUCTION',
        version: '1.0'
      },
      
      quality: {
        dataQuality: 0.9,
        featureRelevance: 0.85,
        modelStability: 0.8,
        anomalyScore: 0.1,
        uncertaintyScore: 1 - mlResponse.confidence
      },

      ...(request.userId && { userId: new Types.ObjectId(request.userId) }),
      ...(request.sessionId && { sessionId: new Types.ObjectId(request.sessionId) })
    });

    await prediction.save();
    return prediction;
  }

  private mapConfidenceToStrength(confidence: number): 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG' {
    if (confidence >= 0.9) return 'VERY_STRONG';
    if (confidence >= 0.75) return 'STRONG';
    if (confidence >= 0.6) return 'MODERATE';
    return 'WEAK';
  }

  private updateHealthMetrics(success: boolean, latency: number): void {
    this.healthMetrics.latency = (this.healthMetrics.latency * 0.9) + (latency * 0.1);
    
    if (success) {
      this.healthMetrics.lastPrediction = new Date();
      this.healthMetrics.errorRate = this.healthMetrics.errorRate * 0.95;
    } else {
      this.healthMetrics.errorRate = Math.min(this.healthMetrics.errorRate + 0.1, 1);
    }

    // Update overall status
    if (this.healthMetrics.errorRate > 0.5 || this.healthMetrics.latency > 30000) {
      this.healthMetrics.status = 'unhealthy';
    } else if (this.healthMetrics.errorRate > 0.2 || this.healthMetrics.latency > 10000) {
      this.healthMetrics.status = 'degraded';
    } else {
      this.healthMetrics.status = 'healthy';
    }
  }

  private startHealthMonitoring(): void {
    // Check health every 5 minutes
    setInterval(async () => {
      try {
        await this.getModelHealth();
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, 5 * 60 * 1000);
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Configuration Management
   */
  public updateConfig(newConfig: Partial<MLEngineConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.client = this.createAxiosClient(this.config);
  }

  public getConfig(): MLEngineConfig {
    return { ...this.config };
  }

  /**
   * Connection Pool Management (for multiple ML models)
   */
  public addModelEndpoint(modelId: string, config: MLEngineConfig): void {
    this.connectionPool.set(modelId, this.createAxiosClient(config));
  }

  public removeModelEndpoint(modelId: string): void {
    this.connectionPool.delete(modelId);
  }
}

// Export singleton instance
export const mlService = MLService.getInstance();
export default mlService;