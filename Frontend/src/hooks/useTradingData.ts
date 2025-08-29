import { useState, useCallback, useMemo, useEffect } from 'react';
import { AIStatus, DecisionAnalysis, MarketData, TradeEntry, ChartDataPoint } from '@/types/trading';
import { apiService } from '@/lib/api';
import { useMLEngineData } from './useMLEngineData';

// Custom hook for trading data management
export const useTradingData = () => {
  // Use real ML Engine data
  const mlEngineData = useMLEngineData();
  
  // Real data from backend API
  const [aiStatus, setAiStatus] = useState<AIStatus>({
    confidence: 0,
    status: 'analyzing',
    lastAnalysis: 'Carregando...',
    patternsDetected: [],
    marketContext: 'Conectando ao backend...',
    entrySignals: 0,
    aggressionLevel: 'low',
    hiddenLiquidity: false,
    processingLatency: 0,
    memoryUsage: 0
  });

  const [marketData, setMarketData] = useState<MarketData>({
    price: 0,
    priceChange: 0,
    volume: 0,
    volatility: 0,
    spread: 0,
    sessionTime: 'Carregando...',
    marketPhase: 'close',
    liquidityLevel: 'low',
    orderBookImbalance: 0,
    timestamp: Date.now(),
    bid: 0,
    ask: 0,
    last: 0,
    high: 0,
    low: 0
  });

  const [tradingLog, setTradingLog] = useState<TradeEntry[]>([]);

  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load trading data from backend
  const loadTradingData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await apiService.getTradingStatus();
      
      // Update AI status
      setAiStatus(response.aiStatus);
      
      // Update market data
      setMarketData(response.marketData);
      
      // Generate sample chart data based on market price
      if (response.marketData.price > 0) {
        const basePrice = response.marketData.price;
        const now = Date.now();
        const newChartData = Array.from({ length: 50 }, (_, i) => ({
          timestamp: now - (50 - i) * 60000,
          value: basePrice + Math.sin(i * 0.1) * 10 + Math.random() * 5,
          volume: Math.floor(Math.random() * 1000) + 500
        }));
        setChartData(newChartData);
      }
      
      console.log('[TradingData] Data loaded successfully from backend');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load trading data';
      setError(errorMessage);
      console.error('[TradingData] Error loading data:', err);
      
      // Set fallback data on error
      setAiStatus(prev => ({
        ...prev,
        status: 'error',
        marketContext: 'Erro ao conectar com o backend'
      }));
      
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh data periodically
  useEffect(() => {
    loadTradingData();
    
    // Set up polling every 5 seconds
    const interval = setInterval(loadTradingData, 5000);
    
    return () => clearInterval(interval);
  }, [loadTradingData]);

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
    decisionAnalysis: mlEngineData.decisionAnalysis, // Use real ML Engine data
    marketData,
    tradingLog,
    chartData,
    tradingMetrics,
    addTradeEntry,
    updateChartData,
    setChartData,
    loadTradingData,
    isLoading: isLoading || mlEngineData.isLoading,
    error: error || mlEngineData.error,
    mlEngineError: mlEngineData.error,
    mlEngineLastUpdate: mlEngineData.lastUpdate,
    refreshMLData: mlEngineData.refreshData,
    hasMLData: mlEngineData.hasData
  };
};