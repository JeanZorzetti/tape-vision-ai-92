// Trading Types - Centralized type definitions

export interface MarketData {
  price: number;
  priceChange: number;
  volume: number;
  volatility: number;
  spread: number;
  sessionTime: string;
  marketPhase: 'pre-market' | 'open' | 'close' | 'after-hours';
  liquidityLevel: 'low' | 'medium' | 'high';
  orderBookImbalance: number;
}

export interface AIStatus {
  confidence: number;
  status: 'active' | 'paused' | 'analyzing' | 'error';
  lastAnalysis: string;
  patternsDetected: string[];
  marketContext: string;
  entrySignals: number;
  aggressionLevel: 'low' | 'medium' | 'high';
  hiddenLiquidity: boolean;
}

export interface DecisionAnalysis {
  entryReason: string;
  variablesAnalyzed: AnalysisVariable[];
  componentScores: ComponentScores;
  finalCertainty: number;
  nextAction: string;
  recommendation: 'ENTRAR' | 'AGUARDAR' | 'EVITAR';
}

export interface AnalysisVariable {
  name: string;
  weight: number;
  score: number;
}

export interface ComponentScores {
  buyAggression: number;
  sellAggression: number;
  liquidityAbsorption: number;
  falseOrdersDetected: number;
  flowMomentum: number;
  historicalPattern: number;
}

export interface TradeEntry {
  id: string;
  timestamp: string;
  action: 'BUY' | 'SELL' | 'ANALYSIS' | 'ALERT' | 'ERROR';
  symbol: string;
  price?: number;
  quantity?: number;
  confidence?: number;
  reason: string;
  pnl?: number;
  status: 'success' | 'pending' | 'failed';
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  volume: number;
}

export interface ConnectionStatus {
  isConnected: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastHeartbeat: string;
}

export interface NelogicaConfig {
  apiKey: string;
  endpoint: string;
  symbol: string;
  updateInterval: number;
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'trade';

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  action?: NotificationAction;
  duration?: number;
}

export interface SystemHealth {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  components: {
    tradingEngine: 'healthy' | 'stopped' | 'error';
    database: 'healthy' | 'disconnected' | 'error';
    nelogica: 'healthy' | 'disconnected' | 'error';
    redis: 'healthy' | 'disconnected' | 'error';
  };
  performance: {
    uptime: number;
    memoryUsage: {
      rss: number;
      heapTotal: number;
      heapUsed: number;
      external: number;
      arrayBuffers: number;
    };
    latency: {
      database: number;
      nelogica: number;
    };
  };
}

export interface TradingConfig {
  analysisSettings: {
    confidenceThreshold: number;
    maxSignalsPerHour: number;
    enablePatternRecognition: boolean;
    processingTimeout: number;
    memoryLimit: number;
  };
  riskParameters: {
    maxDailyLoss: number;
    maxPositionSize: number;
    emergencyStopEnabled: boolean;
  };
  general: {
    enabled: boolean;
    autoTrading: boolean;
    debugMode: boolean;
  };
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  realizedPnL: number;
  timestamp: string;
  status: 'open' | 'closed' | 'closing';
}

export interface TradingSession {
  id: string;
  startTime: string;
  endTime?: string;
  totalTrades: number;
  totalPnL: number;
  winRate: number;
  status: 'active' | 'paused' | 'completed';
  performance: {
    bestTrade: number;
    worstTrade: number;
    averageTrade: number;
    sharpeRatio: number;
  };
}

export interface RiskParameters {
  maxDailyLoss: number;
  maxPositionSize: number;
  maxDrawdown: number;
  maxConcurrentPositions: number;
  riskPerTrade: number;
  emergencyStopEnabled: boolean;
}

export interface PatternMatch {
  id: string;
  name: string;
  confidence: number;
  timestamp: string;
  symbol: string;
  context: string;
  signals: string[];
  recommendation: 'buy' | 'sell' | 'hold';
}