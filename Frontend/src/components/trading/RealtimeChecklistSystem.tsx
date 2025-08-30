import React, { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, TrendingUp, TrendingDown, Target, Zap, Star, AlertTriangle, PlayCircle, StopCircle } from 'lucide-react';

interface ChecklistItem {
  id: string;
  category: 'ORDER_FLOW' | 'ORDER_BOOK' | 'MARKET_CONTEXT' | 'SPEED_INTENSITY' | 'INSTITUTIONAL' | 'ABSORPTION' | 'PATTERNS';
  name: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL' | 'WAITING';
  weight: number;
  confidence: number;
  lastUpdate: number;
  details?: string;
  criticalLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface TradeSignal {
  direction: 'BUY' | 'SELL';
  strength: number;
  confidence: number;
  entry: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  reasoning: string[];
  riskReward: number;
  timeframe: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ChecklistEvaluation {
  overallScore: number;
  categoryScores: {
    ORDER_FLOW: number;
    ORDER_BOOK: number;
    MARKET_CONTEXT: number;
    SPEED_INTENSITY: number;
    INSTITUTIONAL: number;
    ABSORPTION: number;
    PATTERNS: number;
  };
  alignment: {
    bullishAlignment: number;
    bearishAlignment: number;
    dominantDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    alignmentStrength: number;
  };
  recommendation: 'STRONG_BUY' | 'BUY' | 'WAIT' | 'SELL' | 'STRONG_SELL' | 'NO_TRADE';
  readyToTrade: boolean;
  blockers: string[];
  greenLights: string[];
}

interface RealtimeChecklistData {
  checklist: ChecklistItem[];
  evaluation: ChecklistEvaluation;
  currentSignal: TradeSignal | null;
  marketConditions: {
    phase: string;
    volatility: string;
    trend: string;
    sessionTime: string;
    favorability: number;
  };
  alerts: {
    type: 'ALIGNMENT_ACHIEVED' | 'SIGNAL_GENERATED' | 'BLOCKER_DETECTED' | 'CONDITIONS_CHANGED';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: number;
  }[];
  isActive: boolean;
  lastUpdate: number;
}

const RealtimeChecklistSystem: React.FC = () => {
  const [data, setData] = useState<RealtimeChecklistData | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showOnlyFailed, setShowOnlyFailed] = useState(false);
  const [autoTrade, setAutoTrade] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateChecklistData = (): RealtimeChecklistData => {
      const currentPrice = 4580.25;
      
      // Generate comprehensive checklist
      const checklistItems: ChecklistItem[] = [
        // Order Flow
        {
          id: 'of_aggression',
          category: 'ORDER_FLOW',
          name: 'Agressão Dominante',
          description: 'Agressão clara em uma direção nas últimas negociações',
          status: Math.random() > 0.3 ? 'PASS' : Math.random() > 0.5 ? 'PARTIAL' : 'FAIL',
          weight: 0.15,
          confidence: 0.7 + Math.random() * 0.3,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH',
          details: 'Agressão de compra dominando últimos 5 minutos'
        },
        {
          id: 'of_sequence',
          category: 'ORDER_FLOW',
          name: 'Sequência de Padrões',
          description: 'Padrões consistentes na sequência de ordens',
          status: Math.random() > 0.4 ? 'PASS' : Math.random() > 0.6 ? 'PARTIAL' : 'FAIL',
          weight: 0.12,
          confidence: 0.6 + Math.random() * 0.4,
          lastUpdate: Date.now(),
          criticalLevel: 'MEDIUM'
        },
        {
          id: 'of_volume_trend',
          category: 'ORDER_FLOW',
          name: 'Tendência de Volume',
          description: 'Volume crescente na direção da tendência',
          status: Math.random() > 0.35 ? 'PASS' : 'FAIL',
          weight: 0.1,
          confidence: 0.8 + Math.random() * 0.2,
          lastUpdate: Date.now(),
          criticalLevel: 'MEDIUM'
        },

        // Order Book
        {
          id: 'ob_large_orders',
          category: 'ORDER_BOOK',
          name: 'Ordens Grandes',
          description: 'Presença de ordens grandes no book',
          status: Math.random() > 0.3 ? 'PASS' : 'FAIL',
          weight: 0.13,
          confidence: 0.75 + Math.random() * 0.25,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        },
        {
          id: 'ob_fake_removal',
          category: 'ORDER_BOOK',
          name: 'Remoção de Ordens Falsas',
          description: 'Detecção de remoção de ordens falsas',
          status: Math.random() > 0.7 ? 'PASS' : 'WAITING',
          weight: 0.08,
          confidence: 0.9 + Math.random() * 0.1,
          lastUpdate: Date.now(),
          criticalLevel: 'MEDIUM'
        },
        {
          id: 'ob_defense',
          category: 'ORDER_BOOK',
          name: 'Análise de Defesa',
          description: 'Níveis sendo defendidos ativamente',
          status: Math.random() > 0.4 ? 'PASS' : 'PARTIAL',
          weight: 0.11,
          confidence: 0.7 + Math.random() * 0.3,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        },

        // Market Context
        {
          id: 'mc_vwap',
          category: 'MARKET_CONTEXT',
          name: 'Posição vs VWAP',
          description: 'Posição favorável em relação ao VWAP',
          status: Math.random() > 0.25 ? 'PASS' : 'FAIL',
          weight: 0.12,
          confidence: 0.85 + Math.random() * 0.15,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        },
        {
          id: 'mc_support_resistance',
          category: 'MARKET_CONTEXT',
          name: 'Suporte/Resistência',
          description: 'Proximidade de níveis importantes',
          status: Math.random() > 0.3 ? 'PASS' : 'PARTIAL',
          weight: 0.1,
          confidence: 0.8 + Math.random() * 0.2,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        },
        {
          id: 'mc_trend',
          category: 'MARKET_CONTEXT',
          name: 'Alinhamento de Tendência',
          description: 'Todas as tendências alinhadas',
          status: Math.random() > 0.4 ? 'PASS' : 'FAIL',
          weight: 0.14,
          confidence: 0.9 + Math.random() * 0.1,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        },

        // Speed & Intensity
        {
          id: 'si_speed',
          category: 'SPEED_INTENSITY',
          name: 'Velocidade Adequada',
          description: 'Velocidade de negociação dentro do esperado',
          status: Math.random() > 0.35 ? 'PASS' : 'PARTIAL',
          weight: 0.09,
          confidence: 0.75 + Math.random() * 0.25,
          lastUpdate: Date.now(),
          criticalLevel: 'MEDIUM'
        },
        {
          id: 'si_institutional',
          category: 'SPEED_INTENSITY',
          name: 'Player Dominante',
          description: 'Identificação do player dominante',
          status: Math.random() > 0.5 ? 'PASS' : 'WAITING',
          weight: 0.08,
          confidence: 0.7 + Math.random() * 0.3,
          lastUpdate: Date.now(),
          criticalLevel: 'LOW'
        },

        // Institutional
        {
          id: 'inst_flow',
          category: 'INSTITUTIONAL',
          name: 'Fluxo Institucional',
          description: 'Fluxo institucional claro',
          status: Math.random() > 0.4 ? 'PASS' : 'FAIL',
          weight: 0.13,
          confidence: 0.8 + Math.random() * 0.2,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        },
        {
          id: 'inst_consistency',
          category: 'INSTITUTIONAL',
          name: 'Consistência de Players',
          description: 'Players institucionais sendo consistentes',
          status: Math.random() > 0.6 ? 'PASS' : 'PARTIAL',
          weight: 0.07,
          confidence: 0.65 + Math.random() * 0.35,
          lastUpdate: Date.now(),
          criticalLevel: 'MEDIUM'
        },

        // Absorption & Exhaustion
        {
          id: 'ae_absorption',
          category: 'ABSORPTION',
          name: 'Níveis de Absorção',
          description: 'Absorção efetiva nos níveis chave',
          status: Math.random() > 0.45 ? 'PASS' : 'FAIL',
          weight: 0.11,
          confidence: 0.75 + Math.random() * 0.25,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        },
        {
          id: 'ae_exhaustion',
          category: 'ABSORPTION',
          name: 'Sinais de Exaustão',
          description: 'Ausência de sinais de exaustão prematura',
          status: Math.random() > 0.3 ? 'PASS' : 'WAITING',
          weight: 0.09,
          confidence: 0.8 + Math.random() * 0.2,
          lastUpdate: Date.now(),
          criticalLevel: 'MEDIUM'
        },

        // Patterns
        {
          id: 'pt_setup',
          category: 'PATTERNS',
          name: 'Setup Favorável',
          description: 'Padrão de alta qualidade identificado',
          status: Math.random() > 0.5 ? 'PASS' : Math.random() > 0.7 ? 'PARTIAL' : 'FAIL',
          weight: 0.15,
          confidence: 0.85 + Math.random() * 0.15,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        },
        {
          id: 'pt_risk_reward',
          category: 'PATTERNS',
          name: 'Risk/Reward',
          description: 'Relação risco/retorno adequada (min 1:2)',
          status: Math.random() > 0.4 ? 'PASS' : 'FAIL',
          weight: 0.12,
          confidence: 0.9 + Math.random() * 0.1,
          lastUpdate: Date.now(),
          criticalLevel: 'HIGH'
        }
      ];

      // Calculate category scores
      const categoryScores = {
        ORDER_FLOW: 0,
        ORDER_BOOK: 0,
        MARKET_CONTEXT: 0,
        SPEED_INTENSITY: 0,
        INSTITUTIONAL: 0,
        ABSORPTION: 0,
        PATTERNS: 0
      };

      Object.keys(categoryScores).forEach(category => {
        const items = checklistItems.filter(item => item.category === category);
        const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
        const weightedScore = items.reduce((sum, item) => {
          const score = item.status === 'PASS' ? 1 : item.status === 'PARTIAL' ? 0.5 : 0;
          return sum + (score * item.weight * item.confidence);
        }, 0);
        categoryScores[category as keyof typeof categoryScores] = totalWeight > 0 ? (weightedScore / totalWeight) * 100 : 0;
      });

      // Calculate overall score
      const overallScore = Object.values(categoryScores).reduce((sum, score) => sum + score, 0) / Object.keys(categoryScores).length;

      // Calculate alignment
      const passedItems = checklistItems.filter(item => item.status === 'PASS');
      const bullishItems = passedItems.filter(item => Math.random() > 0.5).length;
      const bearishItems = passedItems.length - bullishItems;
      const totalPassed = passedItems.length;

      const bullishAlignment = totalPassed > 0 ? (bullishItems / totalPassed) * 100 : 0;
      const bearishAlignment = totalPassed > 0 ? (bearishItems / totalPassed) * 100 : 0;
      const alignmentStrength = Math.abs(bullishAlignment - bearishAlignment);
      
      const dominantDirection = alignmentStrength > 20 ? 
        (bullishAlignment > bearishAlignment ? 'BULLISH' : 'BEARISH') : 'NEUTRAL';

      // Determine recommendation
      let recommendation: ChecklistEvaluation['recommendation'] = 'NO_TRADE';
      let readyToTrade = false;
      
      if (overallScore >= 85 && alignmentStrength > 60) {
        recommendation = dominantDirection === 'BULLISH' ? 'STRONG_BUY' : 'STRONG_SELL';
        readyToTrade = true;
      } else if (overallScore >= 70 && alignmentStrength > 40) {
        recommendation = dominantDirection === 'BULLISH' ? 'BUY' : 'SELL';
        readyToTrade = alignmentStrength > 50;
      } else if (overallScore >= 50) {
        recommendation = 'WAIT';
      }

      // Generate blockers and green lights
      const blockers = checklistItems
        .filter(item => item.status === 'FAIL' && item.criticalLevel === 'HIGH')
        .map(item => item.name);
      
      const greenLights = checklistItems
        .filter(item => item.status === 'PASS' && item.confidence > 0.8)
        .map(item => item.name);

      // Generate trade signal if conditions are met
      let currentSignal: TradeSignal | null = null;
      if (readyToTrade && overallScore > 75) {
        const direction = dominantDirection === 'BULLISH' ? 'BUY' : 'SELL';
        const entry = currentPrice + (Math.random() - 0.5) * 2;
        const stopDistance = 3 + Math.random() * 5;
        const stopLoss = direction === 'BUY' ? entry - stopDistance : entry + stopDistance;
        const targetDistance = stopDistance * (1.5 + Math.random() * 2);
        const target1 = direction === 'BUY' ? entry + targetDistance : entry - targetDistance;
        const target2 = direction === 'BUY' ? target1 + targetDistance * 0.6 : target1 - targetDistance * 0.6;

        currentSignal = {
          direction,
          strength: alignmentStrength,
          confidence: overallScore,
          entry,
          stopLoss,
          target1,
          target2,
          riskReward: Math.abs(target1 - entry) / Math.abs(entry - stopLoss),
          timeframe: '5m',
          urgency: overallScore > 90 ? 'HIGH' : overallScore > 80 ? 'MEDIUM' : 'LOW',
          reasoning: greenLights.slice(0, 5)
        };
      }

      // Generate alerts
      const alerts = [];
      if (readyToTrade && overallScore > 85) {
        alerts.push({
          type: 'ALIGNMENT_ACHIEVED' as const,
          message: `Alinhamento ${dominantDirection.toLowerCase()} forte detectado (${overallScore.toFixed(0)}%)`,
          severity: 'HIGH' as const,
          timestamp: Date.now()
        });
      }
      if (currentSignal) {
        alerts.push({
          type: 'SIGNAL_GENERATED' as const,
          message: `Sinal de ${currentSignal.direction} gerado - Entrada: ${currentSignal.entry.toFixed(2)}`,
          severity: 'HIGH' as const,
          timestamp: Date.now()
        });
      }
      if (blockers.length > 0) {
        alerts.push({
          type: 'BLOCKER_DETECTED' as const,
          message: `${blockers.length} bloqueadores críticos detectados`,
          severity: 'MEDIUM' as const,
          timestamp: Date.now()
        });
      }

      const evaluation: ChecklistEvaluation = {
        overallScore,
        categoryScores,
        alignment: {
          bullishAlignment,
          bearishAlignment,
          dominantDirection,
          alignmentStrength
        },
        recommendation,
        readyToTrade,
        blockers,
        greenLights
      };

      return {
        checklist: checklistItems,
        evaluation,
        currentSignal,
        marketConditions: {
          phase: 'ACTIVE_TRADING',
          volatility: 'NORMAL',
          trend: dominantDirection,
          sessionTime: 'MARKET_HOURS',
          favorability: overallScore
        },
        alerts: alerts.slice(0, 3),
        isActive: true,
        lastUpdate: Date.now()
      };
    };

    const updateData = () => {
      setData(generateChecklistData());
      setIsLoading(false);
    };

    updateData();
    const interval = setInterval(updateData, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASS': return <CheckCircle className="text-green-400" size={20} />;
      case 'FAIL': return <XCircle className="text-red-400" size={20} />;
      case 'PARTIAL': return <Clock className="text-yellow-400" size={20} />;
      case 'WAITING': return <Clock className="text-gray-400" size={20} />;
      default: return <Clock className="text-gray-400" size={20} />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ORDER_FLOW': return '🔎';
      case 'ORDER_BOOK': return '📊';
      case 'MARKET_CONTEXT': return '🧩';
      case 'SPEED_INTENSITY': return '⚡';
      case 'INSTITUTIONAL': return '🏦';
      case 'ABSORPTION': return '🧱';
      case 'PATTERNS': return '🎯';
      default: return '📋';
    }
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'STRONG_BUY': return 'bg-green-500 text-white';
      case 'BUY': return 'bg-green-400 text-white';
      case 'STRONG_SELL': return 'bg-red-500 text-white';
      case 'SELL': return 'bg-red-400 text-white';
      case 'WAIT': return 'bg-yellow-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-64"></div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredChecklist = showOnlyFailed ? 
    data.checklist.filter(item => item.status === 'FAIL') : 
    data.checklist;

  const categories = Object.keys(data.evaluation.categoryScores) as (keyof typeof data.evaluation.categoryScores)[];

  return (
    <div className="space-y-6">
      {/* Header with Overall Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h3 className="text-xl font-semibold text-white">📋 Sistema de Checklist em Tempo Real</h3>
          <div className="flex items-center gap-2">
            {data.isActive ? (
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            ) : (
              <div className="w-3 h-3 bg-red-400 rounded-full" />
            )}
            <span className="text-sm text-gray-400">
              {data.isActive ? 'ATIVO' : 'INATIVO'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setAutoTrade(!autoTrade)}
            className={`px-3 py-2 rounded flex items-center gap-2 ${
              autoTrade ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
            } text-white transition-colors`}
          >
            {autoTrade ? <StopCircle size={16} /> : <PlayCircle size={16} />}
            {autoTrade ? 'Stop Auto' : 'Auto Trade'}
          </button>
          
          <div className={`px-4 py-2 rounded font-medium ${getRecommendationColor(data.evaluation.recommendation)}`}>
            {data.evaluation.recommendation.replace('_', ' ')}
          </div>
        </div>
      </div>

      {/* Current Trade Signal */}
      {data.currentSignal && (
        <div className="bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-blue-500/30 p-6 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Star className="text-yellow-400" size={24} />
              <div>
                <h4 className="text-xl font-semibold text-white">Sinal de Trading Ativo</h4>
                <p className="text-sm text-gray-300">
                  {data.currentSignal.direction} | Confiança: {data.currentSignal.confidence.toFixed(0)}% | 
                  Urgência: {data.currentSignal.urgency}
                </p>
              </div>
            </div>
            <div className={`px-3 py-2 rounded text-lg font-bold ${
              data.currentSignal.direction === 'BUY' ? 'bg-buy-primary text-white' : 'bg-sell-primary text-white'
            }`}>
              {data.currentSignal.direction}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-6">
            <div>
              <span className="text-gray-400 text-sm">Entrada</span>
              <div className="text-xl font-mono text-white">{data.currentSignal.entry.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Stop Loss</span>
              <div className="text-xl font-mono text-red-400">{data.currentSignal.stopLoss.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Alvo 1</span>
              <div className="text-xl font-mono text-green-400">{data.currentSignal.target1.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">R:R</span>
              <div className="text-xl font-mono text-blue-400">1:{data.currentSignal.riskReward.toFixed(1)}</div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-gray-800/50 rounded">
            <span className="text-sm text-gray-400">Reasoning: </span>
            <span className="text-white">{data.currentSignal.reasoning.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded border flex items-center gap-3 ${
                alert.severity === 'HIGH' ? 'bg-red-400/10 border-red-400/30' :
                alert.severity === 'MEDIUM' ? 'bg-yellow-400/10 border-yellow-400/30' :
                'bg-blue-400/10 border-blue-400/30'
              }`}
            >
              <AlertTriangle size={20} className={
                alert.severity === 'HIGH' ? 'text-red-400' :
                alert.severity === 'MEDIUM' ? 'text-yellow-400' :
                'text-blue-400'
              } />
              <span className="text-white font-medium">{alert.message}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Overall Score and Alignment */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded text-center">
          <div className={`text-3xl font-bold mb-2 ${
            data.evaluation.overallScore >= 85 ? 'text-green-400' :
            data.evaluation.overallScore >= 70 ? 'text-yellow-400' :
            data.evaluation.overallScore >= 50 ? 'text-orange-400' :
            'text-red-400'
          }`}>
            {data.evaluation.overallScore.toFixed(0)}%
          </div>
          <div className="text-sm text-gray-400">Score Geral</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full ${
                data.evaluation.overallScore >= 85 ? 'bg-green-400' :
                data.evaluation.overallScore >= 70 ? 'bg-yellow-400' :
                data.evaluation.overallScore >= 50 ? 'bg-orange-400' :
                'bg-red-400'
              }`}
              style={{ width: `${data.evaluation.overallScore}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded text-center">
          <div className={`text-3xl font-bold mb-2 ${
            data.evaluation.alignment.dominantDirection === 'BULLISH' ? 'text-buy-primary' :
            data.evaluation.alignment.dominantDirection === 'BEARISH' ? 'text-sell-primary' :
            'text-gray-400'
          }`}>
            {data.evaluation.alignment.alignmentStrength.toFixed(0)}%
          </div>
          <div className="text-sm text-gray-400">Força do Alinhamento</div>
          <div className={`text-xs mt-1 ${
            data.evaluation.alignment.dominantDirection === 'BULLISH' ? 'text-buy-primary' :
            data.evaluation.alignment.dominantDirection === 'BEARISH' ? 'text-sell-primary' :
            'text-gray-400'
          }`}>
            {data.evaluation.alignment.dominantDirection}
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded text-center">
          <div className={`text-3xl font-bold mb-2 ${
            data.evaluation.readyToTrade ? 'text-green-400' : 'text-red-400'
          }`}>
            {data.evaluation.readyToTrade ? '✅' : '❌'}
          </div>
          <div className="text-sm text-gray-400">Pronto para Operar</div>
          <div className="text-xs text-gray-300 mt-1">
            {data.evaluation.blockers.length} bloqueadores
          </div>
        </div>
      </div>

      {/* Category Scores */}
      <div className="bg-gray-800 p-6 rounded">
        <h4 className="text-white font-medium mb-4">Scores por Categoria</h4>
        <div className="space-y-3">
          {categories.map(category => (
            <div key={category} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{getCategoryIcon(category)}</span>
                <span className="text-white">{category.replace('_', ' ')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-32 bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      data.evaluation.categoryScores[category] >= 80 ? 'bg-green-400' :
                      data.evaluation.categoryScores[category] >= 60 ? 'bg-yellow-400' :
                      data.evaluation.categoryScores[category] >= 40 ? 'bg-orange-400' :
                      'bg-red-400'
                    }`}
                    style={{ width: `${data.evaluation.categoryScores[category]}%` }}
                  />
                </div>
                <span className="text-white font-mono w-12 text-right">
                  {data.evaluation.categoryScores[category].toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowOnlyFailed(!showOnlyFailed)}
            className={`px-3 py-2 rounded text-sm ${
              showOnlyFailed ? 'bg-red-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {showOnlyFailed ? 'Mostrar Todos' : 'Apenas Falhas'}
          </button>
          
          <div className="text-sm text-gray-400">
            {data.evaluation.greenLights.length} sinais verdes | {data.evaluation.blockers.length} bloqueadores
          </div>
        </div>

        <div className="text-sm text-gray-400">
          Última atualização: {new Date(data.lastUpdate).toLocaleTimeString()}
        </div>
      </div>

      {/* Detailed Checklist */}
      <div className="space-y-4">
        {categories.map(category => {
          const categoryItems = filteredChecklist.filter(item => item.category === category);
          if (categoryItems.length === 0) return null;

          return (
            <div key={category} className="bg-gray-800 rounded">
              <button
                className="w-full p-4 flex items-center justify-between hover:bg-gray-750 rounded"
                onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{getCategoryIcon(category)}</span>
                  <span className="text-white font-medium">{category.replace('_', ' ')}</span>
                  <span className="text-sm text-gray-400">
                    ({categoryItems.filter(item => item.status === 'PASS').length}/{categoryItems.length})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-white font-mono">
                    {data.evaluation.categoryScores[category].toFixed(0)}%
                  </div>
                  {expandedCategory === category ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                </div>
              </button>

              {expandedCategory === category && (
                <div className="p-4 border-t border-gray-700 space-y-3">
                  {categoryItems.map(item => (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between p-3 rounded ${
                        item.status === 'PASS' ? 'bg-green-400/10 border border-green-400/30' :
                        item.status === 'FAIL' ? 'bg-red-400/10 border border-red-400/30' :
                        item.status === 'PARTIAL' ? 'bg-yellow-400/10 border border-yellow-400/30' :
                        'bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(item.status)}
                        <div>
                          <div className="text-white font-medium">{item.name}</div>
                          <div className="text-sm text-gray-400">{item.description}</div>
                          {item.details && (
                            <div className="text-xs text-gray-500 mt-1">{item.details}</div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-white font-mono">{(item.confidence * 100).toFixed(0)}%</div>
                        <div className="text-xs text-gray-400">
                          Peso: {(item.weight * 100).toFixed(0)}%
                        </div>
                        <div className={`text-xs px-2 py-1 rounded mt-1 ${
                          item.criticalLevel === 'HIGH' ? 'bg-red-400/20 text-red-400' :
                          item.criticalLevel === 'MEDIUM' ? 'bg-yellow-400/20 text-yellow-400' :
                          'bg-green-400/20 text-green-400'
                        }`}>
                          {item.criticalLevel}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      {data.evaluation.readyToTrade && (
        <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/30 p-6 rounded-lg">
          <h4 className="text-xl font-semibold text-green-400 mb-4">🚀 Condições de Trading Atendidas!</h4>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h5 className="text-white font-medium mb-2">✅ Sinais Verdes</h5>
              <div className="space-y-1">
                {data.evaluation.greenLights.slice(0, 5).map((light, index) => (
                  <div key={index} className="text-sm text-green-400">• {light}</div>
                ))}
              </div>
            </div>
            {data.evaluation.blockers.length > 0 && (
              <div>
                <h5 className="text-white font-medium mb-2">⚠️ Bloqueadores</h5>
                <div className="space-y-1">
                  {data.evaluation.blockers.slice(0, 3).map((blocker, index) => (
                    <div key={index} className="text-sm text-red-400">• {blocker}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealtimeChecklistSystem;