import React, { useState, useEffect } from 'react';
import { Bot, Target, TrendingUp, TrendingDown, Shield, AlertTriangle, Clock, Award, Brain, Play, Pause, Settings } from 'lucide-react';

interface BotConfiguration {
  dailyGoal: number; // Points target per day
  maxStopLoss: number; // Maximum stop loss in points
  minConfirmationThreshold: number; // Minimum confirmation percentage
  isActive: boolean;
  currentScenario: 1 | 1.5 | 3;
  operatingHours: {
    start: string;
    end: string;
    postAuctionDelay: number; // Minutes after auction
  };
}

interface MarketScenario {
  scenario: 1 | 1.5 | 3;
  name: string;
  description: string;
  characteristics: string[];
  gainTarget: number;
  lossLimit: number;
  riskProfile: 'LOW' | 'MODERATE' | 'HIGH';
  detectionCriteria: {
    flowStrength: number;
    aggressionLevel: number;
    volatility: number;
    institutionalPresence: number;
  };
}

interface TradeEntry {
  id: string;
  timestamp: number;
  scenario: 1 | 1.5 | 3;
  entryPrice: number;
  entryType: 'ABSORPTION' | 'DEFENSE' | 'BREAKOUT';
  distanceFromPedra: number; // Distance from key level
  confirmationLevel: number;
  initialStop: number;
  targetPoints: number;
  context: {
    marketPhase: string;
    flowDirection: string;
    institutionalFlow: string;
    absorptionPresent: boolean;
    fakeOrdersRemoved: boolean;
  };
}

interface TradeResult {
  tradeId: string;
  entryPrice: number;
  exitPrice: number;
  points: number;
  duration: number; // in minutes
  scenario: 1 | 1.5 | 3;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN';
  exitReason: 'TARGET' | 'STOP' | 'MANUAL' | 'TIME' | 'GOAL_REACHED';
  lessons: string[];
  contextAnalysis: {
    wasAbsorptionValid: boolean;
    didFlowContinue: boolean;
    stopAdjustmentsMade: number;
    confirmationAccuracy: number;
  };
}

interface DailyPerformance {
  date: string;
  totalPoints: number;
  tradesCount: number;
  winRate: number;
  bestScenario: 1 | 1.5 | 3;
  goalReached: boolean;
  shutdownTime?: number;
  lessons: string[];
  adjustments: string[];
}

interface SelfLearningData {
  totalTrades: number;
  winRate: number;
  avgPointsPerTrade: number;
  bestPatterns: string[];
  worstPatterns: string[];
  scenarioPerformance: {
    [key in 1 | 1.5 | 3]: {
      trades: number;
      winRate: number;
      avgPoints: number;
    };
  };
  adaptations: {
    date: string;
    rule: string;
    reason: string;
    impact: number;
  }[];
}

interface AutonomousBotData {
  config: BotConfiguration;
  scenarios: MarketScenario[];
  currentMarketState: {
    scenario: 1 | 1.5 | 3;
    confidence: number;
    isPostAuction: boolean;
    marketConsolidated: boolean;
    timeUntilOperational: number;
  };
  dailyProgress: {
    pointsEarned: number;
    tradesExecuted: number;
    goalReached: boolean;
    remainingTarget: number;
    shutdownTriggered: boolean;
  };
  activeEntry: TradeEntry | null;
  recentTrades: TradeResult[];
  dailyPerformance: DailyPerformance;
  learningData: SelfLearningData;
  riskAssessment: {
    nearAbsorption: boolean;
    distanceFromPedra: number;
    flowConfirmation: number;
    overallConfirmation: number;
    entryAllowed: boolean;
    blockingReasons: string[];
  };
  alerts: {
    type: 'SCENARIO_CHANGE' | 'GOAL_REACHED' | 'HIGH_CONFIRMATION' | 'RISK_WARNING' | 'LEARNING_UPDATE';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: number;
  }[];
}

const AutonomousBotRules: React.FC = () => {
  const [botData, setBotData] = useState<AutonomousBotData | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [showLearning, setShowLearning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateBotData = (): AutonomousBotData => {
      const currentTime = new Date();
      const marketOpen = new Date();
      marketOpen.setHours(9, 0, 0, 0); // 9:00 AM
      const auctionEnd = new Date();
      auctionEnd.setHours(9, 5, 0, 0); // 9:05 AM (end of auction)
      const postAuctionDelay = 10; // 10 minutes after auction
      const operationalTime = new Date(auctionEnd.getTime() + postAuctionDelay * 60000);
      
      // Market scenarios definition
      const scenarios: MarketScenario[] = [
        {
          scenario: 1,
          name: 'Mercado Lateral/Fraco',
          description: 'Baixa volatilidade, fluxo fraco, movimentos pequenos',
          characteristics: [
            'Fluxo fraco e inconsistente',
            'Agressões pequenas e esparsas', 
            'Volatilidade baixa (ATR < 8)',
            'Poucos players institucionais',
            'Movimentos laterais predominantes'
          ],
          gainTarget: 1,
          lossLimit: 1,
          riskProfile: 'LOW',
          detectionCriteria: {
            flowStrength: 30, // < 30%
            aggressionLevel: 25, // < 25%
            volatility: 40, // < 40%
            institutionalPresence: 35 // < 35%
          }
        },
        {
          scenario: 1.5,
          name: 'Mercado Direcional Moderado',
          description: 'Direção definida mas sem explosões, fluxo consistente',
          characteristics: [
            'Fluxo consistente em uma direção',
            'Direção definida mas controlada',
            'Volatilidade moderada (ATR 8-15)',
            'Presença institucional moderada',
            'Movimentos direcionais sustentados'
          ],
          gainTarget: 1.5,
          lossLimit: 1,
          riskProfile: 'MODERATE',
          detectionCriteria: {
            flowStrength: 60, // 30-60%
            aggressionLevel: 50, // 25-50%
            volatility: 65, // 40-65%
            institutionalPresence: 60 // 35-60%
          }
        },
        {
          scenario: 3,
          name: 'Mercado Direcional Forte',
          description: 'Agressão intensa, players institucionais dominando',
          characteristics: [
            'Agressão contínua e intensa',
            'Players institucionais dominando',
            'Ordens falsas sendo removidas rapidamente',
            'Volatilidade alta (ATR > 15)',
            'Movimentos explosivos direcionais'
          ],
          gainTarget: 3,
          lossLimit: 1,
          riskProfile: 'HIGH',
          detectionCriteria: {
            flowStrength: 80, // > 60%
            aggressionLevel: 75, // > 50%
            volatility: 80, // > 65%
            institutionalPresence: 75 // > 60%
          }
        }
      ];

      // Determine current scenario based on market conditions
      const flowStrength = Math.random() * 100;
      const aggressionLevel = Math.random() * 100;
      const volatility = Math.random() * 100;
      const institutionalPresence = Math.random() * 100;

      let currentScenario: 1 | 1.5 | 3 = 1;
      if (flowStrength > 60 && aggressionLevel > 50 && volatility > 65 && institutionalPresence > 60) {
        currentScenario = 3;
      } else if (flowStrength > 30 && aggressionLevel > 25 && volatility > 40 && institutionalPresence > 35) {
        currentScenario = 1.5;
      }

      const config: BotConfiguration = {
        dailyGoal: 3,
        maxStopLoss: 1,
        minConfirmationThreshold: 90,
        isActive: true,
        currentScenario,
        operatingHours: {
          start: '09:15', // 15 minutes after market open
          end: '17:30',
          postAuctionDelay: 10
        }
      };

      // Check if market is post-auction and consolidated
      const isPostAuction = currentTime > auctionEnd;
      const marketConsolidated = currentTime > operationalTime;
      const timeUntilOperational = marketConsolidated ? 0 : Math.max(0, operationalTime.getTime() - currentTime.getTime());

      // Daily progress simulation
      const tradesExecuted = Math.floor(Math.random() * 5);
      const pointsEarned = tradesExecuted > 0 ? (Math.random() * 2.5) + (tradesExecuted * 0.3) : 0;
      const goalReached = pointsEarned >= config.dailyGoal;
      const shutdownTriggered = goalReached;

      // Risk assessment
      const nearAbsorption = Math.random() > 0.4;
      const distanceFromPedra = Math.random() * 5; // Points from key level
      const flowConfirmation = Math.random() * 100;
      const overallConfirmation = (flowStrength + aggressionLevel + volatility + institutionalPresence) / 4;
      const entryAllowed = overallConfirmation >= config.minConfirmationThreshold && 
                          nearAbsorption && 
                          distanceFromPedra < 2 &&
                          marketConsolidated &&
                          !shutdownTriggered;

      const blockingReasons = [];
      if (overallConfirmation < config.minConfirmationThreshold) {
        blockingReasons.push(`Confirmação insuficiente: ${overallConfirmation.toFixed(0)}% < ${config.minConfirmationThreshold}%`);
      }
      if (!nearAbsorption) {
        blockingReasons.push('Não há absorção próxima detectada');
      }
      if (distanceFromPedra >= 2) {
        blockingReasons.push(`Muito longe da "pedra": ${distanceFromPedra.toFixed(1)} pontos`);
      }
      if (!marketConsolidated) {
        blockingReasons.push('Aguardando consolidação pós-leilão');
      }
      if (shutdownTriggered) {
        blockingReasons.push('Meta diária atingida - operações encerradas');
      }

      // Generate recent trades
      const recentTrades: TradeResult[] = Array.from({ length: tradesExecuted }, (_, i) => {
        const scenario = scenarios[Math.floor(Math.random() * scenarios.length)].scenario;
        const points = (Math.random() - 0.3) * scenario;
        const result = points > 0 ? 'WIN' : points < 0 ? 'LOSS' : 'BREAKEVEN';
        
        return {
          tradeId: `trade_${Date.now()}_${i}`,
          entryPrice: 4580.25 + (Math.random() - 0.5) * 10,
          exitPrice: 4580.25 + (Math.random() - 0.5) * 10 + points,
          points,
          duration: Math.floor(Math.random() * 45) + 5,
          scenario,
          result,
          exitReason: result === 'WIN' ? 'TARGET' : 'STOP',
          lessons: [
            result === 'WIN' ? 'Entrada próxima à absorção foi efetiva' : 'Stop foi atingido por volatilidade imprevista',
            result === 'WIN' ? 'Cenário foi corretamente identificado' : 'Necessário melhor confirmação de fluxo'
          ],
          contextAnalysis: {
            wasAbsorptionValid: Math.random() > 0.3,
            didFlowContinue: result === 'WIN',
            stopAdjustmentsMade: Math.floor(Math.random() * 3),
            confirmationAccuracy: 70 + Math.random() * 30
          }
        };
      });

      // Learning data
      const learningData: SelfLearningData = {
        totalTrades: 150 + Math.floor(Math.random() * 100),
        winRate: 0.65 + Math.random() * 0.2,
        avgPointsPerTrade: 0.4 + Math.random() * 0.8,
        bestPatterns: [
          'Entrada em absorção próxima a VWAP',
          'Breakout com remoção de ordens falsas',
          'Defesa institucional em suporte'
        ],
        worstPatterns: [
          'Entrada no meio do fluxo sem absorção',
          'Ignorar sinais de exaustão',
          'Stop muito distante da entrada'
        ],
        scenarioPerformance: {
          1: { trades: 45, winRate: 0.72, avgPoints: 0.3 },
          1.5: { trades: 38, winRate: 0.68, avgPoints: 0.6 },
          3: { trades: 22, winRate: 0.59, avgPoints: 1.2 }
        },
        adaptations: [
          {
            date: new Date().toISOString().split('T')[0],
            rule: 'Aumentar threshold de confirmação para 92% em cenário 3',
            reason: 'Falsos positivos em alta volatilidade',
            impact: 15
          }
        ]
      };

      // Generate alerts
      const alerts = [];
      if (overallConfirmation >= 95) {
        alerts.push({
          type: 'HIGH_CONFIRMATION' as const,
          message: `Confirmação muito alta: ${overallConfirmation.toFixed(0)}% - Oportunidade detectada`,
          severity: 'HIGH' as const,
          timestamp: Date.now()
        });
      }
      if (goalReached) {
        alerts.push({
          type: 'GOAL_REACHED' as const,
          message: `Meta diária atingida: ${pointsEarned.toFixed(1)}/3 pontos - Encerrando operações`,
          severity: 'HIGH' as const,
          timestamp: Date.now()
        });
      }
      if (!marketConsolidated) {
        alerts.push({
          type: 'RISK_WARNING' as const,
          message: `Aguardando consolidação pós-leilão (${Math.ceil(timeUntilOperational/60000)} min)`,
          severity: 'MEDIUM' as const,
          timestamp: Date.now()
        });
      }

      return {
        config,
        scenarios,
        currentMarketState: {
          scenario: currentScenario,
          confidence: overallConfirmation,
          isPostAuction,
          marketConsolidated,
          timeUntilOperational
        },
        dailyProgress: {
          pointsEarned,
          tradesExecuted,
          goalReached,
          remainingTarget: Math.max(0, config.dailyGoal - pointsEarned),
          shutdownTriggered
        },
        activeEntry: null, // Would contain active trade if any
        recentTrades,
        dailyPerformance: {
          date: new Date().toISOString().split('T')[0],
          totalPoints: pointsEarned,
          tradesCount: tradesExecuted,
          winRate: tradesExecuted > 0 ? recentTrades.filter(t => t.result === 'WIN').length / tradesExecuted : 0,
          bestScenario: currentScenario,
          goalReached,
          shutdownTime: shutdownTriggered ? Date.now() : undefined,
          lessons: [
            'Entradas próximas à absorção têm maior taxa de sucesso',
            'Cenário 3 requer confirmação mais rigorosa'
          ],
          adjustments: [
            'Implementar delay adicional pós-leilão',
            'Ajustar threshold de confirmação por cenário'
          ]
        },
        learningData,
        riskAssessment: {
          nearAbsorption,
          distanceFromPedra,
          flowConfirmation,
          overallConfirmation,
          entryAllowed,
          blockingReasons
        },
        alerts: alerts.slice(0, 3)
      };
    };

    const updateBotData = () => {
      setBotData(generateBotData());
      setIsLoading(false);
    };

    updateBotData();
    const interval = setInterval(updateBotData, 3000);

    return () => clearInterval(interval);
  }, []);

  const getScenarioColor = (scenario: 1 | 1.5 | 3) => {
    switch (scenario) {
      case 1: return 'text-green-400 bg-green-400/20';
      case 1.5: return 'text-yellow-400 bg-yellow-400/20';
      case 3: return 'text-red-400 bg-red-400/20';
      default: return 'text-gray-400 bg-gray-700';
    }
  };

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-64"></div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!botData) return null;

  const currentScenarioData = botData.scenarios.find(s => s.scenario === botData.currentMarketState.scenario)!;

  return (
    <div className="space-y-6">
      {/* Header with Bot Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Bot className="text-blue-400" size={32} />
          <div>
            <h3 className="text-xl font-semibold text-white">🤖 BOT Autônomo</h3>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <div className={`w-3 h-3 rounded-full ${
                botData.config.isActive && botData.currentMarketState.marketConsolidated ? 'bg-green-400 animate-pulse' : 
                botData.config.isActive ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
              <span>
                {botData.config.isActive ? 
                  (botData.currentMarketState.marketConsolidated ? 'OPERACIONAL' : 'AGUARDANDO') : 
                  'PAUSADO'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-2 text-white"
          >
            <Settings size={16} />
            Config
          </button>
          <button
            onClick={() => setShowLearning(!showLearning)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 text-white"
          >
            <Brain size={16} />
            Learning
          </button>
          <div className={`px-4 py-2 rounded font-medium ${
            botData.dailyProgress.goalReached ? 'bg-green-500' :
            botData.riskAssessment.entryAllowed ? 'bg-blue-500' : 
            'bg-gray-600'
          } text-white`}>
            {botData.dailyProgress.goalReached ? '✅ META ATINGIDA' :
             botData.riskAssessment.entryAllowed ? '🎯 PRONTO' : 
             '⏳ AGUARDANDO'}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {botData.alerts.length > 0 && (
        <div className="space-y-2">
          {botData.alerts.map((alert, index) => (
            <div
              key={index}
              className={`p-4 rounded border flex items-center gap-3 ${
                alert.severity === 'HIGH' ? 'bg-red-400/10 border-red-400/30 text-red-400' :
                alert.severity === 'MEDIUM' ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400' :
                'bg-blue-400/10 border-blue-400/30 text-blue-400'
              }`}
            >
              <AlertTriangle size={20} />
              <span className="font-medium">{alert.message}</span>
              <span className="text-xs opacity-75 ml-auto">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Daily Progress & Current Scenario */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Target className="text-blue-400" size={20} />
            <span className="text-white font-medium">Meta Diária</span>
          </div>
          <div className="text-3xl font-bold mb-2">
            <span className={botData.dailyProgress.pointsEarned >= botData.config.dailyGoal ? 'text-green-400' : 'text-white'}>
              {botData.dailyProgress.pointsEarned.toFixed(1)}
            </span>
            <span className="text-gray-400 text-xl">/{botData.config.dailyGoal}</span>
          </div>
          <div className="text-sm text-gray-400">
            {botData.dailyProgress.goalReached ? 'Concluída!' : `Restam: ${botData.dailyProgress.remainingTarget.toFixed(1)} pts`}
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-3">
            <div
              className={`h-2 rounded-full ${botData.dailyProgress.goalReached ? 'bg-green-400' : 'bg-blue-400'}`}
              style={{ width: `${Math.min((botData.dailyProgress.pointsEarned / botData.config.dailyGoal) * 100, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded text-center">
          <div className="text-white font-medium mb-2">Cenário Atual</div>
          <div className={`text-2xl font-bold mb-2 px-3 py-1 rounded ${getScenarioColor(botData.currentMarketState.scenario)}`}>
            {botData.currentMarketState.scenario === 1 ? '1 PONTO' :
             botData.currentMarketState.scenario === 1.5 ? '1.5 PONTOS' :
             '3 PONTOS'}
          </div>
          <div className="text-sm text-gray-400">{currentScenarioData.name}</div>
          <div className="text-xs text-gray-500 mt-1">
            Confiança: {botData.currentMarketState.confidence.toFixed(0)}%
          </div>
        </div>

        <div className="bg-gray-800 p-6 rounded text-center">
          <div className="text-white font-medium mb-2">Status Operacional</div>
          {!botData.currentMarketState.marketConsolidated ? (
            <div>
              <Clock className="text-yellow-400 mx-auto mb-2" size={24} />
              <div className="text-yellow-400 font-mono">
                {formatTime(botData.currentMarketState.timeUntilOperational)}
              </div>
              <div className="text-xs text-gray-400">até consolidação</div>
            </div>
          ) : botData.dailyProgress.shutdownTriggered ? (
            <div>
              <Award className="text-green-400 mx-auto mb-2" size={24} />
              <div className="text-green-400 font-bold">ENCERRADO</div>
              <div className="text-xs text-gray-400">Meta atingida</div>
            </div>
          ) : botData.riskAssessment.entryAllowed ? (
            <div>
              <Play className="text-green-400 mx-auto mb-2" size={24} />
              <div className="text-green-400 font-bold">OPERACIONAL</div>
              <div className="text-xs text-gray-400">Pronto para entrar</div>
            </div>
          ) : (
            <div>
              <Pause className="text-red-400 mx-auto mb-2" size={24} />
              <div className="text-red-400 font-bold">AGUARDANDO</div>
              <div className="text-xs text-gray-400">Condições insuficientes</div>
            </div>
          )}
        </div>
      </div>

      {/* Scenario Details */}
      <div className="bg-gray-800 p-6 rounded">
        <h4 className="text-white font-medium flex items-center gap-2 mb-4">
          📊 Cenário {botData.currentMarketState.scenario} - {currentScenarioData.name}
        </h4>
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h5 className="text-white font-medium mb-2">Características</h5>
            <div className="space-y-1">
              {currentScenarioData.characteristics.map((char, index) => (
                <div key={index} className="text-sm text-gray-300 flex items-center gap-2">
                  <div className="w-1 h-1 bg-blue-400 rounded-full" />
                  {char}
                </div>
              ))}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-400 text-sm">Gain Target:</span>
              <div className="text-xl font-mono text-green-400">{currentScenarioData.gainTarget} pts</div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Loss Limit:</span>
              <div className="text-xl font-mono text-red-400">{currentScenarioData.lossLimit} pts</div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">Risk Profile:</span>
              <div className={`text-sm px-2 py-1 rounded ${
                currentScenarioData.riskProfile === 'LOW' ? 'bg-green-400/20 text-green-400' :
                currentScenarioData.riskProfile === 'MODERATE' ? 'bg-yellow-400/20 text-yellow-400' :
                'bg-red-400/20 text-red-400'
              }`}>
                {currentScenarioData.riskProfile}
              </div>
            </div>
            <div>
              <span className="text-gray-400 text-sm">R:R Ratio:</span>
              <div className="text-xl font-mono text-blue-400">
                1:{(currentScenarioData.gainTarget / currentScenarioData.lossLimit).toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Assessment */}
      <div className="bg-gray-800 p-6 rounded">
        <h4 className="text-white font-medium flex items-center gap-2 mb-4">
          <Shield size={20} />
          Avaliação de Risco - Regra dos 90%+
        </h4>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded bg-gray-700">
                <span className="text-gray-300">Confirmação Geral</span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono ${
                    botData.riskAssessment.overallConfirmation >= botData.config.minConfirmationThreshold ? 
                    'text-green-400' : 'text-red-400'
                  }`}>
                    {botData.riskAssessment.overallConfirmation.toFixed(0)}%
                  </span>
                  {botData.riskAssessment.overallConfirmation >= botData.config.minConfirmationThreshold ? 
                    <div className="w-3 h-3 bg-green-400 rounded-full" /> :
                    <div className="w-3 h-3 bg-red-400 rounded-full" />
                  }
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-gray-700">
                <span className="text-gray-300">Proximidade da "Pedra"</span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono ${
                    botData.riskAssessment.distanceFromPedra < 2 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {botData.riskAssessment.distanceFromPedra.toFixed(1)} pts
                  </span>
                  {botData.riskAssessment.distanceFromPedra < 2 ? 
                    <div className="w-3 h-3 bg-green-400 rounded-full" /> :
                    <div className="w-3 h-3 bg-red-400 rounded-full" />
                  }
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-gray-700">
                <span className="text-gray-300">Absorção Próxima</span>
                <div className="flex items-center gap-2">
                  <span className={`${botData.riskAssessment.nearAbsorption ? 'text-green-400' : 'text-red-400'}`}>
                    {botData.riskAssessment.nearAbsorption ? 'DETECTADA' : 'AUSENTE'}
                  </span>
                  {botData.riskAssessment.nearAbsorption ? 
                    <div className="w-3 h-3 bg-green-400 rounded-full" /> :
                    <div className="w-3 h-3 bg-red-400 rounded-full" />
                  }
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded bg-gray-700">
                <span className="text-gray-300">Entrada Permitida</span>
                <div className="flex items-center gap-2">
                  <span className={`font-bold ${botData.riskAssessment.entryAllowed ? 'text-green-400' : 'text-red-400'}`}>
                    {botData.riskAssessment.entryAllowed ? 'SIM' : 'NÃO'}
                  </span>
                  {botData.riskAssessment.entryAllowed ? 
                    <div className="w-3 h-3 bg-green-400 rounded-full" /> :
                    <div className="w-3 h-3 bg-red-400 rounded-full" />
                  }
                </div>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-white font-medium mb-3">
              {botData.riskAssessment.entryAllowed ? '✅ Sinais Verdes' : '🚫 Bloqueadores'}
            </h5>
            <div className="space-y-2">
              {botData.riskAssessment.entryAllowed ? (
                <div className="space-y-2">
                  <div className="p-3 bg-green-400/10 border border-green-400/30 rounded text-sm text-green-400">
                    • Todas as confirmações acima de {botData.config.minConfirmationThreshold}%
                  </div>
                  <div className="p-3 bg-green-400/10 border border-green-400/30 rounded text-sm text-green-400">
                    • Entrada próxima à absorção/defesa
                  </div>
                  <div className="p-3 bg-green-400/10 border border-green-400/30 rounded text-sm text-green-400">
                    • Mercado consolidado pós-leilão
                  </div>
                  <div className="p-3 bg-green-400/10 border border-green-400/30 rounded text-sm text-green-400">
                    • Meta diária não atingida
                  </div>
                </div>
              ) : (
                botData.riskAssessment.blockingReasons.map((reason, index) => (
                  <div key={index} className="p-3 bg-red-400/10 border border-red-400/30 rounded text-sm text-red-400">
                    • {reason}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Trades */}
      {botData.recentTrades.length > 0 && (
        <div className="bg-gray-800 p-6 rounded">
          <h4 className="text-white font-medium mb-4">📈 Operações de Hoje</h4>
          <div className="space-y-2">
            {botData.recentTrades.map((trade, index) => (
              <div
                key={trade.tradeId}
                className={`p-4 rounded border ${
                  trade.result === 'WIN' ? 'bg-green-400/10 border-green-400/30' :
                  trade.result === 'LOSS' ? 'bg-red-400/10 border-red-400/30' :
                  'bg-gray-700 border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs ${getScenarioColor(trade.scenario)}`}>
                      Cenário {trade.scenario}
                    </div>
                    <span className="text-white font-mono">{trade.entryPrice.toFixed(2)}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-white font-mono">{trade.exitPrice.toFixed(2)}</span>
                    <span className={`font-mono font-bold ${
                      trade.result === 'WIN' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {trade.points > 0 ? '+' : ''}{trade.points.toFixed(1)} pts
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span>{trade.duration}min</span>
                    <span>{trade.exitReason}</span>
                  </div>
                </div>
                
                <div className="text-sm text-gray-300">
                  <strong>Lição:</strong> {trade.lessons[0]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Data Modal */}
      {showLearning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-full max-w-4xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                <Brain size={24} />
                Sistema de Autoaprendizado
              </h3>
              <button
                onClick={() => setShowLearning(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* Performance Metrics */}
              <div>
                <h4 className="text-white font-medium mb-4">📊 Métricas Gerais</h4>
                <div className="space-y-3">
                  <div className="flex justify-between p-3 bg-gray-700 rounded">
                    <span className="text-gray-300">Total de Trades</span>
                    <span className="text-white font-mono">{botData.learningData.totalTrades}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-700 rounded">
                    <span className="text-gray-300">Win Rate</span>
                    <span className="text-green-400 font-mono">
                      {(botData.learningData.winRate * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between p-3 bg-gray-700 rounded">
                    <span className="text-gray-300">Média por Trade</span>
                    <span className="text-blue-400 font-mono">
                      {botData.learningData.avgPointsPerTrade.toFixed(2)} pts
                    </span>
                  </div>
                </div>

                <h4 className="text-white font-medium mb-4 mt-6">📈 Performance por Cenário</h4>
                <div className="space-y-3">
                  {Object.entries(botData.learningData.scenarioPerformance).map(([scenario, data]) => (
                    <div key={scenario} className="p-3 bg-gray-700 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <span className={`px-2 py-1 rounded text-xs ${getScenarioColor(Number(scenario) as 1 | 1.5 | 3)}`}>
                          Cenário {scenario}
                        </span>
                        <span className="text-green-400 font-mono">
                          {(data.winRate * 100).toFixed(0)}% WR
                        </span>
                      </div>
                      <div className="text-sm text-gray-300">
                        {data.trades} trades | {data.avgPoints.toFixed(1)} pts/trade
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning Insights */}
              <div>
                <h4 className="text-white font-medium mb-4">✅ Melhores Padrões</h4>
                <div className="space-y-2 mb-6">
                  {botData.learningData.bestPatterns.map((pattern, index) => (
                    <div key={index} className="p-3 bg-green-400/10 border border-green-400/30 rounded text-sm text-green-400">
                      • {pattern}
                    </div>
                  ))}
                </div>

                <h4 className="text-white font-medium mb-4">❌ Padrões a Evitar</h4>
                <div className="space-y-2 mb-6">
                  {botData.learningData.worstPatterns.map((pattern, index) => (
                    <div key={index} className="p-3 bg-red-400/10 border border-red-400/30 rounded text-sm text-red-400">
                      • {pattern}
                    </div>
                  ))}
                </div>

                <h4 className="text-white font-medium mb-4">🔄 Adaptações Recentes</h4>
                <div className="space-y-2">
                  {botData.learningData.adaptations.map((adaptation, index) => (
                    <div key={index} className="p-3 bg-blue-400/10 border border-blue-400/30 rounded">
                      <div className="text-blue-400 font-medium text-sm">{adaptation.rule}</div>
                      <div className="text-gray-300 text-xs mt-1">{adaptation.reason}</div>
                      <div className="text-yellow-400 text-xs">Impacto: +{adaptation.impact}% accuracy</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutonomousBotRules;