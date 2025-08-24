import { useState, useCallback, useMemo } from 'react';
import { AIStatus, DecisionAnalysis, MarketData, TradeEntry, ChartDataPoint } from '@/types/trading';

// Custom hook for trading data management
export const useTradingData = () => {
  // Sample data - In real app, this would come from API/WebSocket
  const [aiStatus] = useState<AIStatus>({
    confidence: 87.5,
    status: 'active',
    lastAnalysis: '14:32:15',
    patternsDetected: [
      'Absorção de liquidez em 5.980',
      'Rejeição em resistência histórica',
      'Aumento de volume anômalo'
    ],
    marketContext: 'Mercado em tendência de alta com pressão compradora crescente. Identificado cluster de ordens em 5.975-5.980.',
    entrySignals: 3,
    aggressionLevel: 'high',
    hiddenLiquidity: true
  });

  const [decisionAnalysis] = useState<DecisionAnalysis>({
    entryReason: 'Confluência de fatores técnicos: absorção de liquidez em suporte, rejeição de ordens falsas e aumento de agressão compradora.',
    variablesAnalyzed: [
      { name: 'Volume Profile', weight: 25, score: 92 },
      { name: 'Order Flow Imbalance', weight: 20, score: 88 },
      { name: 'Price Action Context', weight: 15, score: 85 },
      { name: 'Historical Pattern Match', weight: 15, score: 78 },
      { name: 'Market Microstructure', weight: 25, score: 95 }
    ],
    componentScores: {
      buyAggression: 92,
      sellAggression: 23,
      liquidityAbsorption: 88,
      falseOrdersDetected: 67,
      flowMomentum: 85,
      historicalPattern: 78
    },
    finalCertainty: 87.5,
    nextAction: 'Aguardar confirmação acima de 5.985 para entrada long com stop em 5.970.',
    recommendation: 'ENTRAR'
  });

  const [marketData] = useState<MarketData>({
    price: 5982.50,
    priceChange: 15.75,
    volume: 125000,
    volatility: 1.8,
    spread: 2,
    sessionTime: '14:32:15',
    marketPhase: 'open',
    liquidityLevel: 'high',
    orderBookImbalance: 35
  });

  const [tradingLog, setTradingLog] = useState<TradeEntry[]>([
    {
      id: '1',
      timestamp: '14:32:15',
      action: 'ANALYSIS',
      symbol: 'WDO',
      confidence: 87.5,
      reason: 'Confluência técnica detectada - preparando entrada',
      status: 'success'
    },
    {
      id: '2',
      timestamp: '14:31:42',
      action: 'ALERT',
      symbol: 'WDO',
      reason: 'Absorção de liquidez em 5.980 - monitorar',
      status: 'success'
    },
    {
      id: '3',
      timestamp: '14:30:18',
      action: 'BUY',
      symbol: 'WDO',
      price: 5975.25,
      quantity: 5,
      confidence: 91.2,
      reason: 'Entrada confirmada após rejeição',
      pnl: 36.25,
      status: 'success'
    }
  ]);

  const [chartData, setChartData] = useState<ChartDataPoint[]>(() => {
    const now = Date.now();
    return Array.from({ length: 50 }, (_, i) => ({
      timestamp: now - (50 - i) * 60000,
      value: 5980 + Math.sin(i * 0.1) * 10 + Math.random() * 5,
      volume: Math.floor(Math.random() * 1000) + 500
    }));
  });

  const addTradeEntry = useCallback((entry: Omit<TradeEntry, 'id'>) => {
    const newEntry: TradeEntry = {
      ...entry,
      id: Date.now().toString()
    };
    setTradingLog(prev => [newEntry, ...prev]);
  }, []);

  const updateChartData = useCallback((newPoint: ChartDataPoint) => {
    setChartData(prev => [...prev.slice(1), newPoint]);
  }, []);

  // Memoized derived values
  const tradingMetrics = useMemo(() => ({
    totalTrades: tradingLog.filter(entry => ['BUY', 'SELL'].includes(entry.action)).length,
    totalPnL: tradingLog.reduce((sum, entry) => sum + (entry.pnl || 0), 0),
    winRate: (() => {
      const trades = tradingLog.filter(entry => entry.pnl !== undefined);
      const winners = trades.filter(entry => (entry.pnl || 0) > 0);
      return trades.length > 0 ? (winners.length / trades.length) * 100 : 0;
    })(),
    avgConfidence: tradingLog.reduce((sum, entry) => sum + (entry.confidence || 0), 0) / tradingLog.length
  }), [tradingLog]);

  return {
    aiStatus,
    decisionAnalysis,
    marketData,
    tradingLog,
    chartData,
    tradingMetrics,
    addTradeEntry,
    updateChartData,
    setChartData
  };
};