import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, TrendingUp, TrendingDown, Target, Activity, Clock, BarChart3 } from 'lucide-react';

interface AbsorptionLevel {
  price: number;
  volume: number;
  absorptionStrength: number;
  testCount: number;
  lastTest: number;
  isActive: boolean;
  type: 'BID_ABSORPTION' | 'ASK_ABSORPTION';
  effectiveness: number;
  remainingCapacity: number;
  originalSize: number;
}

interface ExhaustionSignal {
  type: 'BUY_EXHAUSTION' | 'SELL_EXHAUSTION';
  level: number;
  strength: number;
  timestamp: number;
  volume: number;
  priceReaction: number;
  confirmationScore: number;
  isConfirmed: boolean;
  exhaustionSigns: {
    volumeDivergence: boolean;
    priceStagnation: boolean;
    failedBreakout: boolean;
    increasingRejects: boolean;
  };
}

interface LiquidityPool {
  id: string;
  price: number;
  size: number;
  type: 'VISIBLE' | 'HIDDEN' | 'ICEBERG';
  depth: number;
  refreshRate: number;
  hitCount: number;
  absorption: {
    consumed: number;
    remaining: number;
    efficiency: number;
  };
  behavior: {
    isDefending: boolean;
    isFeeding: boolean;
    isDrying: boolean;
  };
}

interface VolumeProfile {
  priceLevel: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  absorptionCapacity: number;
  exhaustionLevel: number;
  netLiquidity: number;
  activityLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
}

interface AbsorptionExhaustionData {
  absorptionLevels: AbsorptionLevel[];
  exhaustionSignals: ExhaustionSignal[];
  liquidityPools: LiquidityPool[];
  volumeProfile: VolumeProfile[];
  currentState: {
    marketPhase: 'ACCUMULATION' | 'DISTRIBUTION' | 'TRENDING' | 'EXHAUSTED';
    dominantForce: 'ABSORPTION' | 'EXHAUSTION' | 'NEUTRAL';
    liquidity: {
      total: number;
      bidSide: number;
      askSide: number;
      imbalance: number;
    };
    exhaustionLevel: number;
    absorptionEfficiency: number;
  };
  alerts: {
    type: 'ABSORPTION_BREACH' | 'EXHAUSTION_DETECTED' | 'LIQUIDITY_DRIED' | 'LEVEL_DEFENDED';
    message: string;
    level?: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: number;
  }[];
}

const AbsorptionExhaustionAnalysis: React.FC = () => {
  const [data, setData] = useState<AbsorptionExhaustionData | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<AbsorptionLevel | null>(null);
  const [viewMode, setViewMode] = useState<'ABSORPTION' | 'EXHAUSTION' | 'LIQUIDITY'>('ABSORPTION');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateAbsorptionExhaustionData = (): AbsorptionExhaustionData => {
      const currentPrice = 4580.25;
      
      // Generate absorption levels
      const absorptionLevels: AbsorptionLevel[] = Array.from({ length: 6 + Math.floor(Math.random() * 8) }, (_, i) => {
        const price = currentPrice + (Math.random() - 0.5) * 20;
        const originalSize = 5000 + Math.random() * 30000;
        const consumed = originalSize * Math.random() * 0.8;
        const testCount = 1 + Math.floor(Math.random() * 8);
        
        return {
          price,
          volume: originalSize - consumed,
          absorptionStrength: 0.3 + Math.random() * 0.7,
          testCount,
          lastTest: Date.now() - Math.random() * 3600000,
          isActive: Math.random() > 0.3,
          type: price > currentPrice ? 'ASK_ABSORPTION' : 'BID_ABSORPTION',
          effectiveness: 0.4 + Math.random() * 0.6,
          remainingCapacity: originalSize - consumed,
          originalSize
        };
      }).sort((a, b) => b.price - a.price);

      // Generate exhaustion signals
      const exhaustionSignals: ExhaustionSignal[] = Array.from({ length: 3 + Math.floor(Math.random() * 5) }, (_, i) => {
        const type = Math.random() > 0.5 ? 'BUY_EXHAUSTION' : 'SELL_EXHAUSTION';
        const strength = 0.5 + Math.random() * 0.5;
        const confirmationScore = Math.random() * 100;
        
        return {
          type,
          level: currentPrice + (Math.random() - 0.5) * 15,
          strength,
          timestamp: Date.now() - Math.random() * 1800000,
          volume: 10000 + Math.random() * 50000,
          priceReaction: (Math.random() - 0.5) * 3,
          confirmationScore,
          isConfirmed: confirmationScore > 70,
          exhaustionSigns: {
            volumeDivergence: Math.random() > 0.6,
            priceStagnation: Math.random() > 0.7,
            failedBreakout: Math.random() > 0.8,
            increasingRejects: Math.random() > 0.5
          }
        };
      });

      // Generate liquidity pools
      const liquidityPools: LiquidityPool[] = Array.from({ length: 4 + Math.floor(Math.random() * 6) }, (_, i) => {
        const size = 10000 + Math.random() * 100000;
        const consumed = size * Math.random() * 0.6;
        const types = ['VISIBLE', 'HIDDEN', 'ICEBERG'] as const;
        
        return {
          id: `pool_${i}`,
          price: currentPrice + (Math.random() - 0.5) * 25,
          size,
          type: types[Math.floor(Math.random() * types.length)],
          depth: 1 + Math.floor(Math.random() * 5),
          refreshRate: Math.random() * 10,
          hitCount: Math.floor(Math.random() * 20),
          absorption: {
            consumed,
            remaining: size - consumed,
            efficiency: 0.6 + Math.random() * 0.4
          },
          behavior: {
            isDefending: Math.random() > 0.7,
            isFeeding: Math.random() > 0.6,
            isDrying: Math.random() > 0.8
          }
        };
      });

      // Generate volume profile
      const volumeProfile: VolumeProfile[] = Array.from({ length: 20 }, (_, i) => {
        const priceLevel = currentPrice - 10 + i;
        const totalVolume = 5000 + Math.random() * 25000;
        const buyRatio = 0.3 + Math.random() * 0.4;
        const buyVolume = totalVolume * buyRatio;
        const sellVolume = totalVolume * (1 - buyRatio);
        
        return {
          priceLevel,
          volume: totalVolume,
          buyVolume,
          sellVolume,
          absorptionCapacity: totalVolume * (0.3 + Math.random() * 0.5),
          exhaustionLevel: Math.random() * 100,
          netLiquidity: buyVolume - sellVolume,
          activityLevel: totalVolume > 20000 ? 'EXTREME' : 
                        totalVolume > 15000 ? 'HIGH' :
                        totalVolume > 10000 ? 'MODERATE' : 'LOW'
        };
      });

      // Calculate current state
      const totalLiquidity = liquidityPools.reduce((sum, pool) => sum + pool.absorption.remaining, 0);
      const bidLiquidity = liquidityPools
        .filter(pool => pool.price < currentPrice)
        .reduce((sum, pool) => sum + pool.absorption.remaining, 0);
      const askLiquidity = liquidityPools
        .filter(pool => pool.price > currentPrice)
        .reduce((sum, pool) => sum + pool.absorption.remaining, 0);

      const exhaustionLevel = exhaustionSignals
        .filter(signal => signal.isConfirmed)
        .reduce((sum, signal) => sum + signal.strength, 0) / Math.max(exhaustionSignals.length, 1);

      const absorptionEfficiency = absorptionLevels
        .filter(level => level.isActive)
        .reduce((sum, level) => sum + level.effectiveness, 0) / Math.max(absorptionLevels.length, 1);

      const currentState = {
        marketPhase: exhaustionLevel > 0.7 ? 'EXHAUSTED' :
                    absorptionEfficiency > 0.7 ? 'ACCUMULATION' :
                    Math.random() > 0.5 ? 'TRENDING' : 'DISTRIBUTION' as const,
        dominantForce: exhaustionLevel > absorptionEfficiency ? 'EXHAUSTION' :
                      absorptionEfficiency > 0.6 ? 'ABSORPTION' : 'NEUTRAL' as const,
        liquidity: {
          total: totalLiquidity,
          bidSide: bidLiquidity,
          askSide: askLiquidity,
          imbalance: (bidLiquidity - askLiquidity) / Math.max(totalLiquidity, 1)
        },
        exhaustionLevel: exhaustionLevel * 100,
        absorptionEfficiency: absorptionEfficiency * 100
      };

      // Generate alerts
      const alerts = [];
      
      absorptionLevels.forEach(level => {
        if (level.remainingCapacity < level.originalSize * 0.2 && level.isActive) {
          alerts.push({
            type: 'ABSORPTION_BREACH' as const,
            message: `Nível ${level.price.toFixed(2)} próximo do limite de absorção`,
            level: level.price,
            severity: 'HIGH' as const,
            timestamp: Date.now()
          });
        }
      });

      exhaustionSignals.forEach(signal => {
        if (signal.isConfirmed && signal.confirmationScore > 80) {
          alerts.push({
            type: 'EXHAUSTION_DETECTED' as const,
            message: `${signal.type === 'BUY_EXHAUSTION' ? 'Exaustão de compra' : 'Exaustão de venda'} detectada em ${signal.level.toFixed(2)}`,
            level: signal.level,
            severity: 'HIGH' as const,
            timestamp: signal.timestamp
          });
        }
      });

      liquidityPools.forEach(pool => {
        if (pool.behavior.isDrying && pool.absorption.remaining < pool.size * 0.1) {
          alerts.push({
            type: 'LIQUIDITY_DRIED' as const,
            message: `Pool de liquidez em ${pool.price.toFixed(2)} secando`,
            level: pool.price,
            severity: 'MEDIUM' as const,
            timestamp: Date.now()
          });
        }
        if (pool.behavior.isDefending && pool.hitCount > 15) {
          alerts.push({
            type: 'LEVEL_DEFENDED' as const,
            message: `Nível ${pool.price.toFixed(2)} sendo defendido ativamente`,
            level: pool.price,
            severity: 'MEDIUM' as const,
            timestamp: Date.now()
          });
        }
      });

      return {
        absorptionLevels,
        exhaustionSignals: exhaustionSignals.sort((a, b) => b.timestamp - a.timestamp),
        liquidityPools,
        volumeProfile: volumeProfile.sort((a, b) => b.priceLevel - a.priceLevel),
        currentState,
        alerts: alerts.slice(0, 5)
      };
    };

    const updateData = () => {
      setData(generateAbsorptionExhaustionData());
      setIsLoading(false);
    };

    updateData();
    const interval = setInterval(updateData, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'ACCUMULATION': return 'text-buy-primary bg-buy-primary/20';
      case 'DISTRIBUTION': return 'text-sell-primary bg-sell-primary/20';
      case 'TRENDING': return 'text-blue-400 bg-blue-400/20';
      case 'EXHAUSTED': return 'text-red-400 bg-red-400/20';
      default: return 'text-gray-400 bg-gray-700';
    }
  };

  const getActivityColor = (level: string) => {
    switch (level) {
      case 'EXTREME': return 'bg-red-400';
      case 'HIGH': return 'bg-orange-400';
      case 'MODERATE': return 'bg-yellow-400';
      default: return 'bg-green-400';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-48"></div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header with Current State */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">🧱 Absorção & Exaustão</h3>
        <div className="flex items-center gap-4">
          <div className={`px-2 py-1 rounded text-xs ${getPhaseColor(data.currentState.marketPhase)}`}>
            {data.currentState.marketPhase === 'ACCUMULATION' ? '🔄 ACUMULAÇÃO' :
             data.currentState.marketPhase === 'DISTRIBUTION' ? '📤 DISTRIBUIÇÃO' :
             data.currentState.marketPhase === 'TRENDING' ? '📈 TENDÊNCIA' :
             '😵 EXAUSTÃO'}
          </div>
          <div className={`px-2 py-1 rounded text-xs ${
            data.currentState.dominantForce === 'ABSORPTION' ? 'bg-blue-400/20 text-blue-400' :
            data.currentState.dominantForce === 'EXHAUSTION' ? 'bg-red-400/20 text-red-400' :
            'bg-gray-700 text-gray-300'
          }`}>
            {data.currentState.dominantForce === 'ABSORPTION' ? '🛡️ ABSORÇÃO' :
             data.currentState.dominantForce === 'EXHAUSTION' ? '⚡ EXAUSTÃO' :
             '⚖️ NEUTRO'}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {data.alerts.map((alert, index) => (
            <div
              key={index}
              className={`px-3 py-2 rounded text-sm flex items-center gap-2 ${
                alert.severity === 'HIGH' ? 'bg-red-400/20 text-red-400 border border-red-400/30' :
                alert.severity === 'MEDIUM' ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30' :
                'bg-blue-400/20 text-blue-400 border border-blue-400/30'
              }`}
            >
              <AlertTriangle size={16} />
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded text-center">
          <div className="text-2xl font-mono text-white">{formatVolume(data.currentState.liquidity.total)}</div>
          <div className="text-sm text-gray-400">Liquidez Total</div>
          <div className="text-xs text-gray-400 mt-1">
            {(data.currentState.liquidity.imbalance * 100).toFixed(0)}% imbalance
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded text-center">
          <div className="text-2xl font-mono text-blue-400">{data.currentState.absorptionEfficiency.toFixed(0)}%</div>
          <div className="text-sm text-gray-400">Eficiência Absorção</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div
              className="bg-blue-400 h-2 rounded-full"
              style={{ width: `${data.currentState.absorptionEfficiency}%` }}
            />
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded text-center">
          <div className="text-2xl font-mono text-red-400">{data.currentState.exhaustionLevel.toFixed(0)}%</div>
          <div className="text-sm text-gray-400">Nível Exaustão</div>
          <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
            <div
              className="bg-red-400 h-2 rounded-full"
              style={{ width: `${data.currentState.exhaustionLevel}%` }}
            />
          </div>
        </div>
        <div className="bg-gray-800 p-4 rounded text-center">
          <div className="text-2xl font-mono text-white">{data.absorptionLevels.filter(l => l.isActive).length}</div>
          <div className="text-sm text-gray-400">Níveis Ativos</div>
          <div className="text-xs text-gray-400 mt-1">
            {data.exhaustionSignals.filter(s => s.isConfirmed).length} exaustões
          </div>
        </div>
      </div>

      {/* View Mode Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Visão:</span>
        {(['ABSORPTION', 'EXHAUSTION', 'LIQUIDITY'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === mode ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {mode === 'ABSORPTION' ? '🛡️ Absorção' :
             mode === 'EXHAUSTION' ? '⚡ Exaustão' :
             '💧 Liquidez'}
          </button>
        ))}
      </div>

      {/* Absorption Levels View */}
      {viewMode === 'ABSORPTION' && (
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-white font-medium flex items-center gap-2 mb-4">
            <Shield size={16} />
            Níveis de Absorção
          </h4>

          <div className="space-y-2">
            {data.absorptionLevels.map((level, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded cursor-pointer hover:bg-gray-700/50 ${
                  level.isActive ? 'border-l-2 border-blue-400' : 'opacity-60'
                } ${
                  selectedLevel?.price === level.price ? 'ring-2 ring-blue-400' : ''
                }`}
                onClick={() => setSelectedLevel(selectedLevel?.price === level.price ? null : level)}
              >
                <div className="flex items-center gap-3">
                  <div className={`px-2 py-1 rounded text-xs ${
                    level.type === 'BID_ABSORPTION' ? 'bg-buy-primary/20 text-buy-primary' : 'bg-sell-primary/20 text-sell-primary'
                  }`}>
                    {level.type === 'BID_ABSORPTION' ? '📈 BID' : '📉 ASK'}
                  </div>
                  <span className="text-white font-mono">{level.price.toFixed(2)}</span>
                  <span className="text-gray-300">{formatVolume(level.volume)}</span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-sm">
                    <div className="text-white">{(level.absorptionStrength * 100).toFixed(0)}% força</div>
                    <div className="w-16 bg-gray-700 rounded-full h-1">
                      <div
                        className="bg-blue-400 h-1 rounded-full"
                        style={{ width: `${level.absorptionStrength * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-gray-400 text-right">
                    <div>Testes: {level.testCount}</div>
                    <div>Restam: {(level.remainingCapacity / level.originalSize * 100).toFixed(0)}%</div>
                  </div>
                  {level.isActive && <div className="w-2 h-2 bg-green-400 rounded-full" />}
                </div>
              </div>
            ))}
          </div>

          {selectedLevel && (
            <div className="mt-4 p-4 bg-gray-700 rounded border border-gray-600">
              <h5 className="text-white font-medium mb-3">Detalhes do Nível {selectedLevel.price.toFixed(2)}</h5>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Capacidade Original: </span>
                  <span className="text-white font-mono">{formatVolume(selectedLevel.originalSize)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Capacidade Restante: </span>
                  <span className="text-white font-mono">{formatVolume(selectedLevel.remainingCapacity)}</span>
                </div>
                <div>
                  <span className="text-gray-400">Efetividade: </span>
                  <span className="text-white font-mono">{(selectedLevel.effectiveness * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-gray-400">Último Teste: </span>
                  <span className="text-white font-mono">
                    {new Date(selectedLevel.lastTest).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Testes Total: </span>
                  <span className="text-white font-mono">{selectedLevel.testCount}</span>
                </div>
                <div>
                  <span className="text-gray-400">Status: </span>
                  <span className={`font-mono ${selectedLevel.isActive ? 'text-green-400' : 'text-red-400'}`}>
                    {selectedLevel.isActive ? 'ATIVO' : 'INATIVO'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Exhaustion Signals View */}
      {viewMode === 'EXHAUSTION' && (
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-white font-medium flex items-center gap-2 mb-4">
            <Activity size={16} />
            Sinais de Exaustão
          </h4>

          <div className="space-y-3">
            {data.exhaustionSignals.map((signal, index) => (
              <div
                key={index}
                className={`p-4 rounded border ${
                  signal.isConfirmed ? 'border-red-400/30 bg-red-400/5' : 'border-gray-600 bg-gray-700/30'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs ${
                      signal.type === 'BUY_EXHAUSTION' ? 'bg-red-400/20 text-red-400' : 'bg-blue-400/20 text-blue-400'
                    }`}>
                      {signal.type === 'BUY_EXHAUSTION' ? '📈🔻 COMPRA' : '📉🔺 VENDA'}
                    </div>
                    <span className="text-white font-mono">{signal.level.toFixed(2)}</span>
                    {signal.isConfirmed && <div className="px-2 py-1 bg-green-400/20 text-green-400 rounded text-xs">CONFIRMADO</div>}
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    {new Date(signal.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-gray-400">Força: </span>
                    <span className="text-white font-mono">{(signal.strength * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Volume: </span>
                    <span className="text-white font-mono">{formatVolume(signal.volume)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Reação: </span>
                    <span className={`font-mono ${signal.priceReaction > 0 ? 'text-buy-primary' : 'text-sell-primary'}`}>
                      {signal.priceReaction > 0 ? '+' : ''}{signal.priceReaction.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Score: </span>
                    <span className="text-white font-mono">{signal.confirmationScore.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {signal.exhaustionSigns.volumeDivergence && (
                    <span className="px-2 py-1 bg-orange-400/20 text-orange-400 rounded text-xs">📊 Vol Divergente</span>
                  )}
                  {signal.exhaustionSigns.priceStagnation && (
                    <span className="px-2 py-1 bg-yellow-400/20 text-yellow-400 rounded text-xs">📈 Preço Estagnado</span>
                  )}
                  {signal.exhaustionSigns.failedBreakout && (
                    <span className="px-2 py-1 bg-red-400/20 text-red-400 rounded text-xs">💥 Breakout Falhado</span>
                  )}
                  {signal.exhaustionSigns.increasingRejects && (
                    <span className="px-2 py-1 bg-purple-400/20 text-purple-400 rounded text-xs">🚫 Rejeições Crescentes</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liquidity Pools View */}
      {viewMode === 'LIQUIDITY' && (
        <div className="space-y-4">
          <div className="bg-gray-800 p-4 rounded">
            <h4 className="text-white font-medium flex items-center gap-2 mb-4">
              <Target size={16} />
              Pools de Liquidez
            </h4>

            <div className="space-y-2">
              {data.liquidityPools.map((pool, index) => (
                <div
                  key={pool.id}
                  className={`flex items-center justify-between p-3 rounded ${
                    pool.behavior.isDefending ? 'border-l-2 border-blue-400' : ''
                  } ${
                    pool.behavior.isDrying ? 'border-r-2 border-red-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`px-2 py-1 rounded text-xs ${
                      pool.type === 'VISIBLE' ? 'bg-green-400/20 text-green-400' :
                      pool.type === 'HIDDEN' ? 'bg-blue-400/20 text-blue-400' :
                      'bg-purple-400/20 text-purple-400'
                    }`}>
                      {pool.type === 'VISIBLE' ? '👁️ VIS' :
                       pool.type === 'HIDDEN' ? '🔍 HID' :
                       '🧊 ICE'}
                    </div>
                    <span className="text-white font-mono">{pool.price.toFixed(2)}</span>
                    <span className="text-gray-300">{formatVolume(pool.size)}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-sm">
                      <div className="text-white">{formatVolume(pool.absorption.remaining)} restam</div>
                      <div className="w-20 bg-gray-700 rounded-full h-1">
                        <div
                          className="bg-blue-400 h-1 rounded-full"
                          style={{ width: `${(pool.absorption.remaining / pool.size) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 text-right">
                      <div>Hits: {pool.hitCount}</div>
                      <div>Eff: {(pool.absorption.efficiency * 100).toFixed(0)}%</div>
                    </div>
                    <div className="flex gap-1">
                      {pool.behavior.isDefending && <div className="w-2 h-2 bg-blue-400 rounded-full" />}
                      {pool.behavior.isFeeding && <div className="w-2 h-2 bg-green-400 rounded-full" />}
                      {pool.behavior.isDrying && <div className="w-2 h-2 bg-red-400 rounded-full" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Volume Profile */}
          <div className="bg-gray-800 p-4 rounded">
            <h4 className="text-white font-medium flex items-center gap-2 mb-4">
              <BarChart3 size={16} />
              Perfil de Volume
            </h4>

            <div className="space-y-1">
              {data.volumeProfile.slice(0, 15).map((level, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-gray-300 font-mono text-sm">{level.priceLevel.toFixed(2)}</span>
                    <div className="relative w-32 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-buy-primary/60 h-2 rounded-l-full absolute left-0"
                        style={{ width: `${(level.buyVolume / level.volume) * 100}%` }}
                      />
                      <div
                        className="bg-sell-primary/60 h-2 rounded-r-full absolute right-0"
                        style={{ width: `${(level.sellVolume / level.volume) * 100}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white font-mono">{formatVolume(level.volume)}</span>
                    <div className={`px-1 py-0.5 rounded text-xs ${
                      level.activityLevel === 'EXTREME' ? 'bg-red-400/20 text-red-400' :
                      level.activityLevel === 'HIGH' ? 'bg-orange-400/20 text-orange-400' :
                      level.activityLevel === 'MODERATE' ? 'bg-yellow-400/20 text-yellow-400' :
                      'bg-green-400/20 text-green-400'
                    }`}>
                      {level.activityLevel}
                    </div>
                    <div className="text-xs text-gray-400">
                      {(level.exhaustionLevel).toFixed(0)}% exaust
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AbsorptionExhaustionAnalysis;