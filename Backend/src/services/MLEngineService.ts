/**
 * ML Engine Service - Communication layer with Python ML Engine
 * Handles all communication between TypeScript backend and Python ML components
 */
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { EventEmitter } from 'eventemitter3';
import { Logger } from 'winston';
import { 
  MarketData, 
  TapeEntry, 
  OrderFlowAnalysis,
  DecisionAnalysis,
  PatternMatch 
} from '@/types/trading';

// Python ML Engine API Types
interface MLAnalysisRequest {
  market_data: {
    timestamp: string;
    symbol: string;
    price: number;
    volume: number;
    bid: number;
    ask: number;
    spread: number;
  };
  tape_data: Array<{
    price: number;
    volume: number;
    aggressor_side: 'buy' | 'sell';
    timestamp: string;
    order_type: string;
  }>;
  order_flow: {
    bid_volume: number;
    ask_volume: number;
    imbalance_ratio: number;
    aggression_score: number;
    hidden_liquidity: number;
    cumulative_delta: number;
  };
  context: Record<string, any>;
}

interface MLAnalysisResponse {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  stop_loss: number;
  target: number;
  risk_reward: number;
  pattern_matched: string;
  timestamp: string;
  metadata: Record<string, any>;
}

interface MLPatternResponse {
  patterns_detected: string[];
  confidence_scores: Record<string, number>;
  market_regime: string;
  volatility_state: string;
  recommendation: string;
}

interface MLModelStatus {
  timestamp: string;
  models: Record<string, string>;
  configuration: Record<string, any>;
  performance: Record<string, any>;
}

export class MLEngineService extends EventEmitter {
  private client: AxiosInstance;
  private logger: Logger;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 5000; // 5 seconds
  private requestTimeout: number = 5000; // 5 seconds
  
  // Performance metrics
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private averageLatency: number = 0;
  private lastResponseTime: number = 0;
  
  // Caching for performance
  private lastAnalysis: MLAnalysisResponse | null = null;
  private analysisCache = new Map<string, { response: MLAnalysisResponse; timestamp: number }>();
  private cacheTimeout: number = 1000; // 1 second cache

  constructor(
    private mlEngineUrl: string = process.env.ML_ENGINE_URL || 'https://ml.aitradingapi.roilabs.com.br',
    logger: Logger
  ) {
    super();
    
    this.logger = logger.child({ component: 'MLEngineService' });
    
    this.client = axios.create({
      baseURL: this.mlEngineUrl,
      timeout: this.requestTimeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Trading-Backend/1.0'
      }
    });
    
    this.setupAxiosInterceptors();
    this.startHealthCheck();
    
    this.logger.info('ML Engine Service initialized', {
      url: this.mlEngineUrl,
      timeout: this.requestTimeout
    });
  }

  private setupAxiosInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.totalRequests++;
        config.metadata = { startTime: Date.now() };
        return config;
      },
      (error) => {
        this.logger.error('ML Engine request error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        const endTime = Date.now();
        const startTime = response.config.metadata?.startTime || endTime;
        const latency = endTime - startTime;
        
        this.successfulRequests++;
        this.lastResponseTime = latency;
        this.averageLatency = (this.averageLatency + latency) / 2;
        
        this.logger.debug('ML Engine response received', {
          url: response.config.url,
          status: response.status,
          latency: `${latency}ms`
        });
        
        return response;
      },
      (error) => {
        const endTime = Date.now();
        const startTime = error.config?.metadata?.startTime || endTime;
        const latency = endTime - startTime;
        
        this.logger.error('ML Engine response error', {
          url: error.config?.url,
          status: error.response?.status,
          message: error.message,
          latency: `${latency}ms`
        });
        
        if (error.response?.status >= 500) {
          this.handleConnectionError(error);
        }
        
        return Promise.reject(error);
      }
    );
  }

  private async startHealthCheck(): Promise<void> {
    this.checkConnection();
    
    // Health check every 30 seconds
    setInterval(() => {
      this.checkConnection();
    }, 30000);
  }

  private async checkConnection(): Promise<void> {
    try {
      const response = await this.client.get('/health', { timeout: 2000 });
      
      if (response.status === 200) {
        if (!this.isConnected) {
          this.logger.info('ML Engine connection established');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
        }
      }
    } catch (error) {
      if (this.isConnected) {
        this.logger.warn('ML Engine connection lost');
        this.isConnected = false;
        this.emit('disconnected');
      }
      this.handleConnectionError(error);
    }
  }

  private handleConnectionError(error: any): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      
      this.logger.warn(`ML Engine reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, {
        error: error.message,
        delay: this.reconnectDelay
      });
      
      setTimeout(() => {
        this.checkConnection();
      }, this.reconnectDelay);
    } else {
      this.logger.error('ML Engine max reconnection attempts exceeded');
      this.emit('max-reconnect-attempts-exceeded');
    }
  }

  /**
   * Analyze market data using Python ML Engine
   */
  public async analyzeMarketData(
    marketData: MarketData,
    tapeData: TapeEntry[],
    orderFlow: OrderFlowAnalysis
  ): Promise<MLAnalysisResponse | null> {
    try {
      if (!this.isConnected) {
        this.logger.warn('ML Engine not connected, using fallback analysis');
        return this.getFallbackAnalysis(marketData);
      }

      // Check cache first
      const cacheKey = this.generateCacheKey(marketData, tapeData);
      const cachedResult = this.analysisCache.get(cacheKey);
      
      if (cachedResult && (Date.now() - cachedResult.timestamp) < this.cacheTimeout) {
        this.logger.debug('Using cached ML analysis');
        return cachedResult.response;
      }

      const startTime = Date.now();

      // Prepare request data
      const requestData: MLAnalysisRequest = {
        market_data: {
          timestamp: new Date(marketData.timestamp).toISOString(),
          symbol: marketData.symbol,
          price: marketData.price,
          volume: marketData.volume,
          bid: marketData.bid,
          ask: marketData.ask,
          spread: marketData.spread
        },
        tape_data: tapeData.slice(-50).map(entry => ({
          price: entry.price,
          volume: entry.volume,
          aggressor_side: entry.side as 'buy' | 'sell',
          timestamp: new Date(entry.timestamp).toISOString(),
          order_type: entry.isMarketOrder ? 'market' : 'limit'
        })),
        order_flow: {
          bid_volume: orderFlow.bidVolume,
          ask_volume: orderFlow.askVolume,
          imbalance_ratio: orderFlow.imbalance,
          aggression_score: orderFlow.aggressionLevel,
          hidden_liquidity: orderFlow.hiddenLiquidity,
          cumulative_delta: orderFlow.cumulativeDelta
        },
        context: {
          session_time: Date.now() - (Date.now() % 86400000), // Start of day
          market_state: marketData.marketState,
          volatility: marketData.volatility
        }
      };

      // Make request to Python ML Engine
      const response: AxiosResponse<MLAnalysisResponse> = await this.client.post(
        '/v1/analyze',
        requestData
      );

      const analysisResult = response.data;
      
      // Cache the result
      this.analysisCache.set(cacheKey, {
        response: analysisResult,
        timestamp: Date.now()
      });

      // Clean old cache entries
      this.cleanCache();

      this.lastAnalysis = analysisResult;

      const endTime = Date.now();
      this.logger.info('ML analysis completed', {
        signal: analysisResult.signal,
        confidence: analysisResult.confidence,
        pattern: analysisResult.pattern_matched,
        latency: `${endTime - startTime}ms`
      });

      this.emit('analysis-completed', {
        request: requestData,
        response: analysisResult,
        latency: endTime - startTime
      });

      return analysisResult;

    } catch (error) {
      this.logger.error('Error in ML analysis', error);
      
      // Return fallback analysis on error
      return this.getFallbackAnalysis(marketData);
    }
  }

  /**
   * Detect patterns using Python ML Engine
   */
  public async detectPatterns(
    marketData: MarketData,
    tapeData: TapeEntry[],
    orderFlow: OrderFlowAnalysis
  ): Promise<MLPatternResponse | null> {
    try {
      if (!this.isConnected) {
        this.logger.warn('ML Engine not connected for pattern detection');
        return null;
      }

      const requestData: MLAnalysisRequest = {
        market_data: {
          timestamp: new Date(marketData.timestamp).toISOString(),
          symbol: marketData.symbol,
          price: marketData.price,
          volume: marketData.volume,
          bid: marketData.bid,
          ask: marketData.ask,
          spread: marketData.spread
        },
        tape_data: tapeData.slice(-100).map(entry => ({
          price: entry.price,
          volume: entry.volume,
          aggressor_side: entry.side as 'buy' | 'sell',
          timestamp: new Date(entry.timestamp).toISOString(),
          order_type: entry.isMarketOrder ? 'market' : 'limit'
        })),
        order_flow: {
          bid_volume: orderFlow.bidVolume,
          ask_volume: orderFlow.askVolume,
          imbalance_ratio: orderFlow.imbalance,
          aggression_score: orderFlow.aggressionLevel,
          hidden_liquidity: orderFlow.hiddenLiquidity,
          cumulative_delta: orderFlow.cumulativeDelta
        },
        context: {}
      };

      const response: AxiosResponse<MLPatternResponse> = await this.client.post(
        '/v1/patterns',
        requestData
      );

      this.logger.debug('Pattern detection completed', {
        patterns: response.data.patterns_detected.length,
        market_regime: response.data.market_regime
      });

      return response.data;

    } catch (error) {
      this.logger.error('Error in pattern detection', error);
      return null;
    }
  }

  /**
   * Get ML model status
   */
  public async getModelStatus(): Promise<MLModelStatus | null> {
    try {
      if (!this.isConnected) {
        return null;
      }

      const response: AxiosResponse<MLModelStatus> = await this.client.get('/v1/status');
      return response.data;

    } catch (error) {
      this.logger.error('Error getting model status', error);
      return null;
    }
  }

  /**
   * Trigger model retraining
   */
  public async retrainModels(force: boolean = false): Promise<boolean> {
    try {
      if (!this.isConnected) {
        this.logger.warn('Cannot retrain models - ML Engine not connected');
        return false;
      }

      const response: AxiosResponse = await this.client.post('/v1/retrain', { force });
      
      this.logger.info('Model retraining initiated', { force });
      return response.status === 200;

    } catch (error) {
      this.logger.error('Error initiating model retraining', error);
      return false;
    }
  }

  /**
   * Convert ML analysis to DecisionAnalysis format
   */
  public convertToDecisionAnalysis(mlResponse: MLAnalysisResponse, marketData: MarketData): DecisionAnalysis {
    return {
      action: mlResponse.signal as 'BUY' | 'SELL' | 'WAIT',
      confidence: mlResponse.confidence,
      reasoning: mlResponse.reasoning,
      entryReason: `ML Pattern: ${mlResponse.pattern_matched}`,
      stopLoss: mlResponse.stop_loss,
      expectedTarget: mlResponse.target,
      riskReward: mlResponse.risk_reward,
      marketContext: mlResponse.metadata.market_regime || 'unknown',
      timeframe: '1m', // Default timeframe
      timestamp: Date.now(),
      factors: {
        priceAction: mlResponse.metadata.pattern_scores || {},
        volume: { score: mlResponse.confidence * 0.8 },
        momentum: { score: mlResponse.confidence * 0.9 },
        volatility: { score: 0.7 },
        liquidity: { score: mlResponse.metadata.volatility_adjusted ? 0.8 : 0.6 }
      }
    };
  }

  /**
   * Fallback analysis when ML Engine is unavailable
   */
  private getFallbackAnalysis(marketData: MarketData): MLAnalysisResponse {
    const now = new Date().toISOString();
    
    return {
      signal: 'HOLD',
      confidence: 0.5,
      reasoning: 'ML Engine unavailable - using fallback analysis',
      stop_loss: marketData.price - 1.5,
      target: marketData.price + 2.0,
      risk_reward: 1.33,
      pattern_matched: 'fallback',
      timestamp: now,
      metadata: {
        fallback_mode: true,
        ml_engine_status: 'disconnected'
      }
    };
  }

  private generateCacheKey(marketData: MarketData, tapeData: TapeEntry[]): string {
    const priceLevel = Math.round(marketData.price * 4) / 4; // Round to nearest 0.25
    const volumeLevel = Math.round(marketData.volume / 10) * 10; // Round to nearest 10
    const tapeHash = tapeData.slice(-10).reduce((hash, entry) => hash + entry.volume, 0);
    
    return `${marketData.symbol}-${priceLevel}-${volumeLevel}-${tapeHash}`;
  }

  private cleanCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    for (const [key, value] of this.analysisCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout * 5) { // 5x cache timeout
        expiredKeys.push(key);
      }
    }
    
    expiredKeys.forEach(key => this.analysisCache.delete(key));
    
    if (expiredKeys.length > 0) {
      this.logger.debug(`Cleaned ${expiredKeys.length} expired cache entries`);
    }
  }

  /**
   * Get service performance metrics
   */
  public getPerformanceMetrics() {
    const successRate = this.totalRequests > 0 ? (this.successfulRequests / this.totalRequests) * 100 : 0;
    
    return {
      isConnected: this.isConnected,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      successRate: successRate,
      averageLatency: this.averageLatency,
      lastResponseTime: this.lastResponseTime,
      cacheSize: this.analysisCache.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }

  /**
   * Get last analysis result
   */
  public getLastAnalysis(): MLAnalysisResponse | null {
    return this.lastAnalysis;
  }

  /**
   * Check if service is connected
   */
  public isServiceConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Manually trigger connection check
   */
  public async reconnect(): Promise<void> {
    this.reconnectAttempts = 0;
    await this.checkConnection();
  }

  /**
   * Shutdown the service
   */
  public shutdown(): void {
    this.logger.info('Shutting down ML Engine Service');
    this.isConnected = false;
    this.analysisCache.clear();
    this.removeAllListeners();
  }
}