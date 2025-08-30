import { useState, useEffect, useCallback } from 'react';
import { DecisionAnalysis } from '@/types/trading';
import { apiService } from '@/lib/api';
import { useAuth } from './useAuth';

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

// ML Engine communication through Backend middleware

export const useMLEngineData = () => {
  const { isAuthenticated, canTrade } = useAuth();
  const [decisionAnalysis, setDecisionAnalysis] = useState<DecisionAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchMLAnalysis = useCallback(async () => {
    // Only fetch if user is authenticated and can trade
    if (!isAuthenticated || !canTrade()) {
      setDecisionAnalysis(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // Get ML predictions through Backend (protected endpoint)
      const predictions = await apiService.getMLPredictions();
      
      console.log('[MLEngine] Raw predictions data:', predictions);
      
      if (!predictions || predictions.length === 0) {
        throw new Error('Nenhuma previsão ML disponível');
      }

      // Get the latest prediction with safety checks
      const latestPrediction = predictions[0];
      console.log('[MLEngine] Latest prediction:', latestPrediction);
      
      if (!latestPrediction || typeof latestPrediction !== 'object') {
        throw new Error('Dados de previsão ML inválidos');
      }
      
      // Format as MLEngineResponse with robust fallbacks
      let analysisData: MLEngineResponse;
      try {
        analysisData = {
          signal: latestPrediction.signal || 'HOLD',
          confidence: typeof latestPrediction.confidence === 'number' ? latestPrediction.confidence : 0.5,
          reasoning: latestPrediction.reasoning || 'Análise ML ativa',
          stop_loss: latestPrediction.stopLoss || latestPrediction.stop_loss || 0,
          target: latestPrediction.target || 0,
          risk_reward: latestPrediction.riskReward || latestPrediction.risk_reward || 1.5,
          timestamp: latestPrediction.timestamp || new Date().toISOString(),
          metadata: {
            deployment: 'production',
            response_time_ms: latestPrediction.responseTime || 150,
            model_version: latestPrediction.modelVersion || '1.0',
            features_count: latestPrediction.featuresCount || 42
          }
        };
        console.log('[MLEngine] Analysis data created:', analysisData);
      } catch (analysisError) {
        console.error('[MLEngine] Error creating analysis data:', analysisError);
        throw new Error('Erro ao processar dados de análise ML');
      }

      // Mock pattern data (could be expanded to real Backend endpoint)
      let patternsData: PatternResponse;
      try {
        patternsData = {
          patterns_detected: Array.isArray(latestPrediction.patterns) ? latestPrediction.patterns : [
            { name: 'Breakout Pattern', confidence: analysisData.confidence },
            { name: 'Volume Surge', confidence: analysisData.confidence * 0.9 }
          ],
          total_patterns: Array.isArray(latestPrediction.patterns) ? latestPrediction.patterns.length : 2,
          market_regime: latestPrediction.marketRegime || 'trending',
          timestamp: analysisData.timestamp
        };
        console.log('[MLEngine] Pattern data created:', patternsData);
      } catch (patternError) {
        console.error('[MLEngine] Error creating pattern data:', patternError);
        // Use fallback pattern data
        patternsData = {
          patterns_detected: [
            { name: 'Breakout Pattern', confidence: 0.75 },
            { name: 'Volume Surge', confidence: 0.65 }
          ],
          total_patterns: 2,
          market_regime: 'trending',
          timestamp: new Date().toISOString()
        };
      }

      // Convert ML Engine response to DecisionAnalysis format
      let convertedAnalysis: DecisionAnalysis;
      try {
        convertedAnalysis = {
          entryReason: analysisData.reasoning || 'Análise ML ativa',
          variablesAnalyzed: [
            { 
              name: 'ML Confidence Score', 
              weight: 35, 
              score: Math.round((analysisData.confidence || 0) * 100) 
            },
            { 
              name: 'Risk/Reward Ratio', 
              weight: 25, 
              score: Math.min(Math.round((analysisData.risk_reward || 1.5) * 25), 100) 
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
            buyAggression: analysisData.signal === 'BUY' ? Math.round((analysisData.confidence || 0) * 100) : 25,
            sellAggression: analysisData.signal === 'SELL' ? Math.round((analysisData.confidence || 0) * 100) : 25,
            liquidityAbsorption: Math.round((analysisData.confidence || 0) * 85),
            falseOrdersDetected: Math.round((1 - (analysisData.confidence || 0)) * 100),
            flowMomentum: analysisData.signal === 'HOLD' ? 50 : Math.round((analysisData.confidence || 0) * 90),
            historicalPattern: patternsData?.patterns_detected?.length ? 
              Math.round((patternsData.patterns_detected[0]?.confidence || 0) * 100) : 65
          },
          finalCertainty: Math.round((analysisData.confidence || 0) * 100),
          nextAction: generateNextAction(analysisData),
          recommendation: analysisData.signal === 'BUY' ? 'ENTRAR' : 
                        analysisData.signal === 'SELL' ? 'EVITAR' : 'AGUARDAR'
        };
        console.log('[MLEngine] Decision analysis created:', convertedAnalysis);
      } catch (conversionError) {
        console.error('[MLEngine] Error creating decision analysis:', conversionError);
        throw new Error('Erro ao converter análise ML para formato da interface');
      }

      setDecisionAnalysis(convertedAnalysis);
      setLastUpdate(new Date());
      console.log('[MLEngine] Data loaded successfully via Backend:', convertedAnalysis);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('[MLEngine] Error loading data via Backend:', err);
      
      // Don't show authentication errors if user is not supposed to be authenticated
      if (!isAuthenticated) {
        setDecisionAnalysis(null);
        setError(null);
        setIsLoading(false);
        return;
      }
      
      // Set fallback to null instead of mock data
      setDecisionAnalysis(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, canTrade]);

  const generateNextAction = (data: MLEngineResponse): string => {
    const price = 4580.25; // Would come from market data in real scenario
    
    if (!data || !data.signal) {
      return 'Aguardando dados de análise...';
    }
    
    switch (data.signal) {
      case 'BUY':
        return `Entrada long recomendada. Target: R$ ${(data.target || 0).toFixed(2)}, Stop: R$ ${(data.stop_loss || 0).toFixed(2)}`;
      case 'SELL':
        return `Entrada short recomendada. Target: R$ ${(data.target || 0).toFixed(2)}, Stop: R$ ${(data.stop_loss || 0).toFixed(2)}`;
      case 'HOLD':
        return `Aguardar. Confiança insuficiente para entrada (${Math.round((data.confidence || 0) * 100)}%)`;
      default:
        return 'Analisando condições de mercado...';
    }
  };

  // Auto-refresh every 10 seconds only if authenticated and can trade
  useEffect(() => {
    if (isAuthenticated && canTrade()) {
      fetchMLAnalysis();
      
      const interval = setInterval(fetchMLAnalysis, 10000);
      
      return () => clearInterval(interval);
    } else {
      // Clear data when not authenticated
      setDecisionAnalysis(null);
      setError(null);
      setIsLoading(false);
    }
  }, [fetchMLAnalysis, isAuthenticated, canTrade]);

  const refreshData = useCallback(() => {
    fetchMLAnalysis();
  }, [fetchMLAnalysis]);

  return {
    decisionAnalysis,
    isLoading,
    error,
    lastUpdate,
    refreshData,
    hasData: decisionAnalysis !== null,
    isAuthenticated,
    canTrade: canTrade()
  };
};