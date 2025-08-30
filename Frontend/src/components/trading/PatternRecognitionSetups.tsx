import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, TrendingDown, Eye, Zap, Shield, AlertTriangle, Clock, Star } from 'lucide-react';

interface PatternSetup {
  id: string;
  name: string;
  type: 'PULLBACK_DEFENSE' | 'BREAKOUT_AGGRESSION' | 'FAKE_ORDER_REMOVAL' | 'ABSORPTION_BOUNCE' | 'EXHAUSTION_REVERSAL';
  direction: 'BULLISH' | 'BEARISH';
  confidence: number;
  quality: number;
  timeframe: string;
  priceLevel: number;
  volume: number;
  criteria: {
    passed: number;
    total: number;
    details: {
      name: string;
      status: boolean;
      weight: number;
      description: string;
    }[];
  };
  signals: {
    entry: number;
    stopLoss: number;
    target1: number;
    target2?: number;
    riskReward: number;
  };
  context: {
    marketPhase: string;
    volatility: string;
    liquidity: string;
    institutionalFlow: string;
  };
  timestamp: number;
  isActive: boolean;
  completion: number;
}

interface PatternAlert {
  type: 'PATTERN_FORMING' | 'SETUP_READY' | 'ENTRY_TRIGGERED' | 'PATTERN_INVALIDATED';
  patternId: string;
  message: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  timestamp: number;
}

interface PatternStats {
  totalSetups: number;
  activeSetups: number;
  highQualitySetups: number;
  avgConfidence: number;
  successRate: number;
  bestPattern: string;
  recentWins: number;
  recentLosses: number;
}

interface PatternRecognitionData {
  patterns: PatternSetup[];
  alerts: PatternAlert[];
  stats: PatternStats;
  currentFocus: PatternSetup | null;
  marketConditions: {
    favorability: number;
    volatility: 'LOW' | 'MODERATE' | 'HIGH';
    trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
    phase: 'ACCUMULATION' | 'DISTRIBUTION' | 'TRENDING' | 'CONSOLIDATION';
  };
}

const PatternRecognitionSetups: React.FC = () => {
  const [data, setData] = useState<PatternRecognitionData | null>(null);
  const [selectedPattern, setSelectedPattern] = useState<PatternSetup | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'confidence' | 'quality' | 'timestamp'>('confidence');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generatePatternData = (): PatternRecognitionData => {
      const currentPrice = 4580.25;
      
      // Generate pattern setups
      const patternTypes = ['PULLBACK_DEFENSE', 'BREAKOUT_AGGRESSION', 'FAKE_ORDER_REMOVAL', 'ABSORPTION_BOUNCE', 'EXHAUSTION_REVERSAL'] as const;
      const patterns: PatternSetup[] = Array.from({ length: 5 + Math.floor(Math.random() * 8) }, (_, i) => {
        const type = patternTypes[Math.floor(Math.random() * patternTypes.length)];
        const direction = Math.random() > 0.5 ? 'BULLISH' : 'BEARISH';
        const confidence = 0.4 + Math.random() * 0.6;
        const quality = 0.3 + Math.random() * 0.7;
        const priceLevel = currentPrice + (Math.random() - 0.5) * 15;
        
        // Generate criteria based on pattern type
        const generateCriteria = (patternType: string) => {
          const baseCriteria = [
            { name: 'Volume Confirmation', weight: 0.2, description: 'Volume supports the pattern' },
            { name: 'Price Action', weight: 0.25, description: 'Clean price action structure' },
            { name: 'Market Context', weight: 0.15, description: 'Favorable market conditions' },
            { name: 'Risk/Reward', weight: 0.15, description: 'Acceptable risk/reward ratio' },
            { name: 'Timing', weight: 0.1, description: 'Good timing for entry' }
          ];

          const specificCriteria = {
            PULLBACK_DEFENSE: [
              { name: 'Defense Level', weight: 0.15, description: 'Strong defense at key level' }
            ],
            BREAKOUT_AGGRESSION: [
              { name: 'Breakout Volume', weight: 0.2, description: 'High volume on breakout' },
              { name: 'Follow Through', weight: 0.1, description: 'Price continues after break' }
            ],
            FAKE_ORDER_REMOVAL: [
              { name: 'Order Removal', weight: 0.18, description: 'Large orders removed suddenly' },
              { name: 'Price Reaction', weight: 0.12, description: 'Immediate price reaction' }
            ],
            ABSORPTION_BOUNCE: [
              { name: 'Absorption Evidence', weight: 0.17, description: 'Clear absorption at level' }
            ],
            EXHAUSTION_REVERSAL: [
              { name: 'Exhaustion Signs', weight: 0.16, description: 'Multiple exhaustion signals' },
              { name: 'Reversal Confirmation', weight: 0.14, description: 'Confirmed reversal signs' }
            ]
          };

          const allCriteria = [...baseCriteria, ...(specificCriteria[patternType as keyof typeof specificCriteria] || [])];
          
          return allCriteria.map(criterion => ({
            ...criterion,
            status: Math.random() > (1 - quality) // Higher quality = more criteria passed
          }));
        };

        const criteria = generateCriteria(type);
        const passedCriteria = criteria.filter(c => c.status).length;
        
        // Generate trading signals
        const entryDistance = (Math.random() * 2 + 0.5) * (direction === 'BULLISH' ? 1 : -1);
        const entry = priceLevel + entryDistance;
        const stopDistance = Math.random() * 3 + 1;
        const stopLoss = direction === 'BULLISH' ? entry - stopDistance : entry + stopDistance;
        const targetDistance = (Math.random() * 4 + 2) * Math.abs(entry - stopLoss);
        const target1 = direction === 'BULLISH' ? entry + targetDistance : entry - targetDistance;
        const target2 = Math.random() > 0.6 ? (direction === 'BULLISH' ? target1 + targetDistance * 0.5 : target1 - targetDistance * 0.5) : undefined;
        const riskReward = Math.abs(target1 - entry) / Math.abs(entry - stopLoss);

        return {
          id: `pattern_${i}`,
          name: `${type.replace('_', ' ')} #${i + 1}`,
          type,
          direction,
          confidence,
          quality,
          timeframe: ['1m', '5m', '15m', '1h'][Math.floor(Math.random() * 4)],
          priceLevel,
          volume: 10000 + Math.random() * 100000,
          criteria: {
            passed: passedCriteria,
            total: criteria.length,
            details: criteria
          },
          signals: {
            entry,
            stopLoss,
            target1,
            target2,
            riskReward
          },
          context: {
            marketPhase: ['ACCUMULATION', 'DISTRIBUTION', 'TRENDING', 'CONSOLIDATION'][Math.floor(Math.random() * 4)],
            volatility: ['LOW', 'MODERATE', 'HIGH'][Math.floor(Math.random() * 3)],
            liquidity: ['THIN', 'MODERATE', 'THICK'][Math.floor(Math.random() * 3)],
            institutionalFlow: ['BULLISH', 'BEARISH', 'NEUTRAL'][Math.floor(Math.random() * 3)]
          },
          timestamp: Date.now() - Math.random() * 3600000,
          isActive: Math.random() > 0.3,
          completion: Math.random()
        };
      });

      // Generate alerts
      const alerts: PatternAlert[] = [];
      patterns.forEach(pattern => {
        if (pattern.quality > 0.7 && pattern.confidence > 0.75) {
          alerts.push({
            type: Math.random() > 0.6 ? 'SETUP_READY' : 'PATTERN_FORMING',
            patternId: pattern.id,
            message: `${pattern.name} - ${pattern.type.replace('_', ' ')} ${pattern.direction.toLowerCase()}`,
            severity: pattern.quality > 0.8 ? 'HIGH' : 'MEDIUM',
            timestamp: Date.now()
          });
        }
        if (pattern.completion > 0.9) {
          alerts.push({
            type: 'ENTRY_TRIGGERED',
            patternId: pattern.id,
            message: `Entrada ativada: ${pattern.name}`,
            severity: 'HIGH',
            timestamp: Date.now()
          });
        }
      });

      // Calculate stats
      const activePatterns = patterns.filter(p => p.isActive);
      const highQualityPatterns = patterns.filter(p => p.quality > 0.7);
      const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
      const patternCounts = patterns.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const bestPattern = Object.entries(patternCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];

      const stats: PatternStats = {
        totalSetups: patterns.length,
        activeSetups: activePatterns.length,
        highQualitySetups: highQualityPatterns.length,
        avgConfidence: avgConfidence * 100,
        successRate: 65 + Math.random() * 25, // Simulated success rate
        bestPattern: bestPattern.replace('_', ' '),
        recentWins: Math.floor(Math.random() * 8) + 2,
        recentLosses: Math.floor(Math.random() * 5) + 1
      };

      const currentFocus = patterns.find(p => p.quality > 0.8 && p.confidence > 0.8) || null;

      const marketConditions = {
        favorability: Math.random() * 100,
        volatility: ['LOW', 'MODERATE', 'HIGH'][Math.floor(Math.random() * 3)] as const,
        trend: ['BULLISH', 'BEARISH', 'SIDEWAYS'][Math.floor(Math.random() * 3)] as const,
        phase: ['ACCUMULATION', 'DISTRIBUTION', 'TRENDING', 'CONSOLIDATION'][Math.floor(Math.random() * 4)] as const
      };

      return {
        patterns: patterns.sort((a, b) => b[sortBy] - a[sortBy]),
        alerts: alerts.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
        stats,
        currentFocus,
        marketConditions
      };
    };

    const updateData = () => {
      setData(generatePatternData());
      setIsLoading(false);
    };

    updateData();
    const interval = setInterval(updateData, 4000);

    return () => clearInterval(interval);
  }, [sortBy]);

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'PULLBACK_DEFENSE': return '🛡️';
      case 'BREAKOUT_AGGRESSION': return '💥';
      case 'FAKE_ORDER_REMOVAL': return '🎭';
      case 'ABSORPTION_BOUNCE': return '🏀';
      case 'EXHAUSTION_REVERSAL': return '🔄';
      default: return '📈';
    }
  };

  const getQualityColor = (quality: number) => {
    if (quality >= 0.8) return 'text-green-400 bg-green-400/20';
    if (quality >= 0.6) return 'text-yellow-400 bg-yellow-400/20';
    if (quality >= 0.4) return 'text-orange-400 bg-orange-400/20';
    return 'text-red-400 bg-red-400/20';
  };

  const getDirectionColor = (direction: string) => {
    return direction === 'BULLISH' ? 'text-buy-primary' : 'text-sell-primary';
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-48"></div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-40 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredPatterns = filterType === 'ALL' ? data.patterns : 
                           data.patterns.filter(p => p.type === filterType || p.direction === filterType);

  return (
    <div className="space-y-6">
      {/* Header with Market Conditions */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">🎯 Padrões Favoráveis</h3>
        <div className="flex items-center gap-4">
          <div className={`px-2 py-1 rounded text-xs ${
            data.marketConditions.favorability > 70 ? 'bg-green-400/20 text-green-400' :
            data.marketConditions.favorability > 40 ? 'bg-yellow-400/20 text-yellow-400' :
            'bg-red-400/20 text-red-400'
          }`}>
            Favorabilidade: {data.marketConditions.favorability.toFixed(0)}%
          </div>
          <div className="text-sm text-gray-300">
            {data.marketConditions.phase} | {data.marketConditions.trend}
          </div>
        </div>
      </div>

      {/* Current Focus */}
      {data.currentFocus && (
        <div className="bg-gradient-to-r from-yellow-400/10 to-orange-400/10 border border-yellow-400/30 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            <Star className="text-yellow-400" size={16} />
            <span className="text-yellow-400 font-medium">Setup em Foco</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{getPatternIcon(data.currentFocus.type)}</span>
              <div>
                <div className="text-white font-medium">{data.currentFocus.name}</div>
                <div className={`text-sm ${getDirectionColor(data.currentFocus.direction)}`}>
                  {data.currentFocus.direction} | {data.currentFocus.priceLevel.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-white font-mono">{(data.currentFocus.quality * 100).toFixed(0)}% qualidade</div>
              <div className="text-sm text-gray-300">{(data.currentFocus.confidence * 100).toFixed(0)}% confiança</div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Dashboard */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-gray-800 p-3 rounded text-center">
          <div className="text-xl font-mono text-white">{data.stats.totalSetups}</div>
          <div className="text-xs text-gray-400">Total Setups</div>
        </div>
        <div className="bg-gray-800 p-3 rounded text-center">
          <div className="text-xl font-mono text-green-400">{data.stats.activeSetups}</div>
          <div className="text-xs text-gray-400">Ativos</div>
        </div>
        <div className="bg-gray-800 p-3 rounded text-center">
          <div className="text-xl font-mono text-yellow-400">{data.stats.highQualitySetups}</div>
          <div className="text-xs text-gray-400">Alta Qualidade</div>
        </div>
        <div className="bg-gray-800 p-3 rounded text-center">
          <div className="text-xl font-mono text-blue-400">{data.stats.avgConfidence.toFixed(0)}%</div>
          <div className="text-xs text-gray-400">Confiança Média</div>
        </div>
        <div className="bg-gray-800 p-3 rounded text-center">
          <div className="text-xl font-mono text-white">{data.stats.successRate.toFixed(0)}%</div>
          <div className="text-xs text-gray-400">Taxa Sucesso</div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="space-y-2">
          {data.alerts.slice(0, 3).map((alert, index) => (
            <div
              key={index}
              className={`px-4 py-3 rounded border flex items-center gap-3 ${
                alert.severity === 'HIGH' ? 'bg-red-400/10 border-red-400/30 text-red-400' :
                alert.severity === 'MEDIUM' ? 'bg-yellow-400/10 border-yellow-400/30 text-yellow-400' :
                'bg-blue-400/10 border-blue-400/30 text-blue-400'
              }`}
            >
              <Zap size={16} />
              <span className="font-medium">
                {alert.type === 'SETUP_READY' ? '✅ Setup Pronto' :
                 alert.type === 'PATTERN_FORMING' ? '🔄 Padrão Formando' :
                 alert.type === 'ENTRY_TRIGGERED' ? '🎯 Entrada Ativa' :
                 '❌ Padrão Invalidado'}
              </span>
              <span>{alert.message}</span>
              <span className="text-xs opacity-75 ml-auto">
                {new Date(alert.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Filtro:</span>
          {['ALL', 'BULLISH', 'BEARISH', 'PULLBACK_DEFENSE', 'BREAKOUT_AGGRESSION', 'FAKE_ORDER_REMOVAL'].map((filter) => (
            <button
              key={filter}
              onClick={() => setFilterType(filter)}
              className={`px-2 py-1 rounded text-xs ${
                filterType === filter ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {filter === 'ALL' ? 'Todos' : 
               filter === 'BULLISH' ? '📈 Bull' :
               filter === 'BEARISH' ? '📉 Bear' :
               filter.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Ordenar:</span>
          {(['confidence', 'quality', 'timestamp'] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setSortBy(sort)}
              className={`px-2 py-1 rounded text-xs ${
                sortBy === sort ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {sort === 'confidence' ? 'Confiança' :
               sort === 'quality' ? 'Qualidade' :
               'Tempo'}
            </button>
          ))}
        </div>
      </div>

      {/* Patterns List */}
      <div className="space-y-3">
        {filteredPatterns.map((pattern, index) => (
          <div
            key={pattern.id}
            className={`bg-gray-800 p-4 rounded cursor-pointer hover:bg-gray-750 border transition-all ${
              pattern.quality > 0.8 ? 'border-green-400/30' :
              pattern.quality > 0.6 ? 'border-yellow-400/30' :
              'border-gray-700'
            } ${
              selectedPattern?.id === pattern.id ? 'ring-2 ring-blue-400' : ''
            } ${
              pattern.isActive ? '' : 'opacity-60'
            }`}
            onClick={() => setSelectedPattern(selectedPattern?.id === pattern.id ? null : pattern)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getPatternIcon(pattern.type)}</span>
                <div>
                  <div className="text-white font-medium">{pattern.name}</div>
                  <div className="text-sm text-gray-400">{pattern.type.replace('_', ' ')}</div>
                </div>
                {pattern.isActive && <div className="w-2 h-2 bg-green-400 rounded-full" />}
              </div>

              <div className="flex items-center gap-4">
                <div className={`px-2 py-1 rounded text-xs ${
                  pattern.direction === 'BULLISH' ? 'bg-buy-primary/20 text-buy-primary' : 'bg-sell-primary/20 text-sell-primary'
                }`}>
                  {pattern.direction === 'BULLISH' ? '📈 BULL' : '📉 BEAR'}
                </div>
                <div className={`px-2 py-1 rounded text-xs ${getQualityColor(pattern.quality)}`}>
                  {(pattern.quality * 100).toFixed(0)}% qualidade
                </div>
                <div className="text-right">
                  <div className="text-white font-mono">{pattern.priceLevel.toFixed(2)}</div>
                  <div className="text-xs text-gray-400">{pattern.timeframe}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-3">
              <div className="text-sm">
                <span className="text-gray-400">Confiança: </span>
                <span className="text-white font-mono">{(pattern.confidence * 100).toFixed(0)}%</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Critérios: </span>
                <span className="text-white font-mono">{pattern.criteria.passed}/{pattern.criteria.total}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">R:R: </span>
                <span className="text-white font-mono">1:{pattern.signals.riskReward.toFixed(1)}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Volume: </span>
                <span className="text-white font-mono">{formatVolume(pattern.volume)}</span>
              </div>
            </div>

            <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
              <div
                className="bg-blue-400 h-2 rounded-full transition-all"
                style={{ width: `${(pattern.criteria.passed / pattern.criteria.total) * 100}%` }}
              />
            </div>

            {selectedPattern?.id === pattern.id && (
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                {/* Criteria Details */}
                <div>
                  <h5 className="text-white font-medium mb-2">Critérios de Validação</h5>
                  <div className="grid grid-cols-2 gap-2">
                    {pattern.criteria.details.map((criterion, idx) => (
                      <div
                        key={idx}
                        className={`p-2 rounded text-sm border ${
                          criterion.status ? 'border-green-400/30 bg-green-400/10' : 'border-red-400/30 bg-red-400/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={`${criterion.status ? 'text-green-400' : 'text-red-400'}`}>
                            {criterion.status ? '✅' : '❌'} {criterion.name}
                          </span>
                          <span className="text-xs text-gray-400">{(criterion.weight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-xs text-gray-400">{criterion.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trading Signals */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h5 className="text-white font-medium mb-2">Sinais de Trading</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Entrada:</span>
                        <span className="text-white font-mono">{pattern.signals.entry.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Stop Loss:</span>
                        <span className="text-red-400 font-mono">{pattern.signals.stopLoss.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Alvo 1:</span>
                        <span className="text-green-400 font-mono">{pattern.signals.target1.toFixed(2)}</span>
                      </div>
                      {pattern.signals.target2 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Alvo 2:</span>
                          <span className="text-green-400 font-mono">{pattern.signals.target2.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h5 className="text-white font-medium mb-2">Contexto de Mercado</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Fase:</span>
                        <span className="text-white">{pattern.context.marketPhase}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Volatilidade:</span>
                        <span className="text-white">{pattern.context.volatility}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Liquidez:</span>
                        <span className="text-white">{pattern.context.liquidity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Fluxo Inst:</span>
                        <span className={`${
                          pattern.context.institutionalFlow === 'BULLISH' ? 'text-buy-primary' :
                          pattern.context.institutionalFlow === 'BEARISH' ? 'text-sell-primary' :
                          'text-gray-300'
                        }`}>
                          {pattern.context.institutionalFlow}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Completion Status */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white font-medium">Progresso do Setup</span>
                    <span className="text-white font-mono">{(pattern.completion * 100).toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-blue-400 to-green-400 h-2 rounded-full transition-all"
                      style={{ width: `${pattern.completion * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Performance Summary */}
      <div className="bg-gray-800 p-4 rounded">
        <h4 className="text-white font-medium mb-3">Resumo de Performance</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Melhor Padrão: </span>
            <span className="text-white">{data.stats.bestPattern}</span>
          </div>
          <div>
            <span className="text-gray-400">Vitórias Recentes: </span>
            <span className="text-green-400">{data.stats.recentWins}</span>
          </div>
          <div>
            <span className="text-gray-400">Perdas Recentes: </span>
            <span className="text-red-400">{data.stats.recentLosses}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatternRecognitionSetups;