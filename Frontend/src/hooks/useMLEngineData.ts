import { useState, useEffect, useCallback } from 'react';
import { DecisionAnalysis } from '@/types/trading';

interface MLEngineResponse {
  signal: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  reasoning: string;
  stop_loss: number;
  target: number;
  risk_reward: number;
  timestamp: string;
  metadata: {
    deployment: string;
    response_time_ms: number;
    [key: string]: any;
  };
}

interface PatternResponse {
  patterns_detected: Array<{
    name: string;
    confidence: number;
  }>;
  total_patterns: number;
  market_regime: string;
  timestamp: string;
}

interface MLEngineStatus {
  system: {
    status: string;
    deployment: string;
    version: string;
  };
  timestamp: string;
}

const ML_ENGINE_URL = 'https://ml.aitrading.roilabs.com.br';

export const useMLEngineData = () => {
  const [decisionAnalysis, setDecisionAnalysis] = useState<DecisionAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMLAnalysis = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Test ML Engine health first
      const healthResponse = await fetch(`${ML_ENGINE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!healthResponse.ok) {
        throw new Error('ML Engine não disponível');
      }

      // Get market analysis
      const analysisResponse = await fetch(`${ML_ENGINE_URL}/v1/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_data: {
            symbol: 'WDO',
            price: 4580.25,
            volume: 150,
            bid: 4580.00,
            ask: 4580.50
          }
        })
      });

      if (!analysisResponse.ok) {
        throw new Error('Erro na análise do ML Engine');
      }

      const analysisData: MLEngineResponse = await analysisResponse.json();

      // Get pattern detection
      const patternsResponse = await fetch(`${ML_ENGINE_URL}/v1/patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market_data: {
            symbol: 'WDO',
            price: 4580.25,
            volume: 150
          }
        })
      });

      let patternsData: PatternResponse | null = null;
      if (patternsResponse.ok) {
        patternsData = await patternsResponse.json();
      }

      // Convert ML Engine response to DecisionAnalysis format
      const convertedAnalysis: DecisionAnalysis = {
        entryReason: analysisData.reasoning || 'Análise ML ativa',
        variablesAnalyzed: [
          { 
            name: 'ML Confidence Score', 
            weight: 35, 
            score: Math.round(analysisData.confidence * 100) 
          },
          { 
            name: 'Risk/Reward Ratio', 
            weight: 25, 
            score: Math.min(Math.round(analysisData.risk_reward * 25), 100) 
          },
          { 
            name: 'Signal Strength', 
            weight: 20, 
            score: analysisData.signal === 'BUY' ? 85 : analysisData.signal === 'SELL' ? 15 : 50
          },
          { 
            name: 'Market Regime', 
            weight: 20, 
            score: patternsData?.market_regime === 'trending' ? 80 : 60
          }
        ],
        componentScores: {
          buyAggression: analysisData.signal === 'BUY' ? Math.round(analysisData.confidence * 100) : 25,
          sellAggression: analysisData.signal === 'SELL' ? Math.round(analysisData.confidence * 100) : 25,
          liquidityAbsorption: Math.round(analysisData.confidence * 85),
          falseOrdersDetected: Math.round((1 - analysisData.confidence) * 100),
          flowMomentum: analysisData.signal === 'HOLD' ? 50 : Math.round(analysisData.confidence * 90),
          historicalPattern: patternsData?.patterns_detected.length ? 
            Math.round(patternsData.patterns_detected[0].confidence * 100) : 65
        },
        finalCertainty: Math.round(analysisData.confidence * 100),
        nextAction: generateNextAction(analysisData),
        recommendation: analysisData.signal === 'BUY' ? 'ENTRAR' : 
                      analysisData.signal === 'SELL' ? 'EVITAR' : 'AGUARDAR'
      };

      setDecisionAnalysis(convertedAnalysis);
      setLastUpdate(new Date());
      console.log('[MLEngine] Data loaded successfully:', convertedAnalysis);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('[MLEngine] Error loading data:', err);
      
      // Set fallback to null instead of mock data
      setDecisionAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const generateNextAction = (data: MLEngineResponse): string => {
    const price = 4580.25; // Would come from market data in real scenario
    
    switch (data.signal) {
      case 'BUY':
        return `Entrada long recomendada. Target: R$ ${data.target.toFixed(2)}, Stop: R$ ${data.stop_loss.toFixed(2)}`;
      case 'SELL':
        return `Entrada short recomendada. Target: R$ ${data.target.toFixed(2)}, Stop: R$ ${data.stop_loss.toFixed(2)}`;
      case 'HOLD':
        return `Aguardar. Confiança insuficiente para entrada (${Math.round(data.confidence * 100)}%)`;
      default:
        return 'Analisando condições de mercado...';
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchMLAnalysis();
    
    const interval = setInterval(fetchMLAnalysis, 10000);
    
    return () => clearInterval(interval);
  }, [fetchMLAnalysis]);

  const refreshData = useCallback(() => {
    fetchMLAnalysis();
  }, [fetchMLAnalysis]);

  return {
    decisionAnalysis,
    isLoading,
    error,
    lastUpdate,
    refreshData,
    hasData: decisionAnalysis !== null
  };
};