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