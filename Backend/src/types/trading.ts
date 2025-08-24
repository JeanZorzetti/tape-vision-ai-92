/**
 * Core Trading Types - Backend Implementation
 * Matches frontend types for seamless integration
 */

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
  timestamp: number;
  bid: number;
  ask: number;
  last: number;
  high: number;
  low: number;
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
  processingLatency: number;
  memoryUsage: number;
}

export interface DecisionAnalysis {
  entryReason: string;
  variablesAnalyzed: AnalysisVariable[];
  componentScores: ComponentScores;
  finalCertainty: number;
  nextAction: string;
  recommendation: 'ENTRAR' | 'AGUARDAR' | 'EVITAR';
  riskLevel: number;
  expectedTarget: number;
  stopLoss: number;
  timeframe: number;
}

export interface AnalysisVariable {
  name: string;
  weight: number;
  score: number;
  confidence: number;
  lastUpdate: number;
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
  orderId?: string;
  executionTime?: number;
  slippage?: number;
}

export interface ChartDataPoint {
  timestamp: number;
  value: number;
  volume: number;
  buyVolume?: number;
  sellVolume?: number;
  orderFlow?: number;
}

export interface ConnectionStatus {
  isConnected: boolean;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastHeartbeat: string;
  connectionTime?: string;
  errorMessage?: string;
  latency?: number;
}

export interface NelogicaConfig {
  apiUrl: string;
  username: string;
  password: string;
  dllPath: string;
  environment: 'demo' | 'production';
  autoReconnect: boolean;
  timeout: number;
}

// Tape Reading Specific Types
export interface OrderBookLevel {
  price: number;
  volume: number;
  orders: number;
  timestamp: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  timestamp: number;
  spread: number;
  depth: number;
}

export interface TapeEntry {
  timestamp: number;
  price: number;
  volume: number;
  aggressor: 'buyer' | 'seller' | 'unknown';
  orderType: 'market' | 'limit' | 'stop';
  isLarge: boolean;
  isDominant: boolean;
  absorption: boolean;
}

export interface LiquidityAnalysis {
  hiddenBuyLiquidity: number;
  hiddenSellLiquidity: number;
  absorptionLevel: number;
  rejectionStrength: number;
  flowDirection: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

export interface PatternMatch {
  id: string;
  name: string;
  confidence: number;
  probability: number;
  historicalSuccess: number;
  timeframe: number;
  parameters: Record<string, any>;
}

// Risk Management Types
export interface RiskParameters {
  maxDailyLoss: number;
  maxPositionSize: number;
  stopLossPoints: number;
  takeProfitPoints: number;
  maxDrawdown: number;
  consecutiveStopLimit: number;
  minimumConfidence: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  unrealizedPnl: number;
  stopLoss: number;
  takeProfit: number;
  entryTime: number;
  duration: number;
}

export interface TradingSession {
  id: string;
  startTime: number;
  endTime?: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
}

// WebSocket Message Types
export interface WSMessage {
  type: string;
  payload: any;
  timestamp: number;
  sequence?: number;
}

export interface MarketDataMessage extends WSMessage {
  type: 'market_data';
  payload: MarketData;
}

export interface OrderBookMessage extends WSMessage {
  type: 'order_book';
  payload: OrderBook;
}

export interface TapeMessage extends WSMessage {
  type: 'tape';
  payload: TapeEntry[];
}

export interface SignalMessage extends WSMessage {
  type: 'signal';
  payload: {
    signal: 'BUY' | 'SELL' | 'WAIT';
    confidence: number;
    analysis: DecisionAnalysis;
  };
}

export interface SystemMessage extends WSMessage {
  type: 'system' | 'ai_status';
  payload: {
    status: AIStatus;
    health: SystemHealth;
  };
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  latency: number;
  uptime: number;
  errors: number;
  warnings: number;
}

// Notification Types
export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'trade';

export interface NotificationAction {
  label: string;
  action: string;
  data?: any;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: Date;
  action?: NotificationAction;
  duration?: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  requestId: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Configuration Types
export interface TradingConfig {
  symbol: string;
  timeframe: number;
  riskParameters: RiskParameters;
  patternSettings: Record<string, any>;
  analysisSettings: {
    confidenceThreshold: number;
    patternWeight: number;
    volumeWeight: number;
    priceActionWeight: number;
  };
}

// Error Types
export class TradingError extends Error {
  public readonly code: string;
  public readonly details?: any;
  
  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'TradingError';
    this.code = code;
    this.details = details;
  }
}

export class NelogicaError extends TradingError {
  constructor(message: string, details?: any) {
    super(message, 'NELOGICA_ERROR', details);
    this.name = 'NelogicaError';
  }
}

export class RiskError extends TradingError {
  constructor(message: string, details?: any) {
    super(message, 'RISK_ERROR', details);
    this.name = 'RiskError';
  }
}

export class ValidationError extends TradingError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}