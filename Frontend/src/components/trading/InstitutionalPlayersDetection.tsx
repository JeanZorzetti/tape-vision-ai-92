import React, { useState, useEffect } from 'react';
import { Building2, Eye, TrendingUp, TrendingDown, Target, AlertTriangle, Shield, Clock } from 'lucide-react';

interface InstitutionalPlayer {
  id: string;
  name: string;
  type: 'BANK' | 'HEDGE_FUND' | 'PENSION_FUND' | 'INSURANCE' | 'PROPRIETARY' | 'UNKNOWN';
  confidence: number;
  totalVolume: number;
  averageOrderSize: number;
  trades: number;
  side: 'BUY' | 'SELL' | 'BOTH';
  consistency: number;
  timeActive: number;
  priceRange: {
    min: number;
    max: number;
    focus: number;
  };
  behavior: {
    isAccumulating: boolean;
    isDistributing: boolean;
    isHedging: boolean;
    isTesting: boolean;
  };
  impact: {
    priceMovement: number;
    volumeShare: number;
    marketPressure: number;
  };
}

interface BigOrderEvent {
  timestamp: number;
  price: number;
  volume: number;
  side: 'BUY' | 'SELL';
  playerId?: string;
  type: 'ICEBERG' | 'SWEEP' | 'BLOCK' | 'SPLIT';
  completion: number;
  remaining: number;
  impact: number;
  isActive: boolean;
}

interface FlowAnalysis {
  netInstitutionalFlow: number;
  buyPressure: number;
  sellPressure: number;
  flowDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  flowStrength: number;
  dominantPlayer: InstitutionalPlayer | null;
  marketManipulation: {
    suspected: boolean;
    confidence: number;
    type: 'PAINT_TAPE' | 'SPOOFING' | 'LAYERING' | 'NONE';
  };
}

interface InstitutionalData {
  players: InstitutionalPlayer[];
  bigOrders: BigOrderEvent[];
  flowAnalysis: FlowAnalysis;
  alerts: {
    type: 'BIG_PLAYER_ENTRY' | 'ACCUMULATION_DETECTED' | 'DISTRIBUTION_DETECTED' | 'MANIPULATION_SUSPECTED';
    message: string;
    playerId?: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: number;
  }[];
  summary: {
    totalInstitutionalVolume: number;
    totalRetailVolume: number;
    institutionalRatio: number;
    bigPlayersActive: number;
    averagePlayerConfidence: number;
  };
}

const InstitutionalPlayersDetection: React.FC = () => {
  const [data, setData] = useState<InstitutionalData | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<InstitutionalPlayer | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateInstitutionalData = (): InstitutionalData => {
      const currentPrice = 4580.25;
      
      // Generate institutional players
      const playerTypes = ['BANK', 'HEDGE_FUND', 'PENSION_FUND', 'INSURANCE', 'PROPRIETARY'] as const;
      const players: InstitutionalPlayer[] = Array.from({ length: 3 + Math.floor(Math.random() * 5) }, (_, i) => {
        const type = playerTypes[Math.floor(Math.random() * playerTypes.length)];
        const totalVolume = 50000 + Math.random() * 500000;
        const trades = 5 + Math.floor(Math.random() * 25);
        const averageOrderSize = totalVolume / trades;
        const side = Math.random() > 0.7 ? (Math.random() > 0.5 ? 'BUY' : 'SELL') : 'BOTH';
        const consistency = 0.6 + Math.random() * 0.4;
        const confidence = consistency * 0.8 + Math.random() * 0.2;
        
        const priceRange = {
          min: currentPrice - Math.random() * 10,
          max: currentPrice + Math.random() * 10,
          focus: currentPrice + (Math.random() - 0.5) * 5
        };

        const behavior = {
          isAccumulating: side !== 'SELL' && Math.random() > 0.6,
          isDistributing: side !== 'BUY' && Math.random() > 0.7,
          isHedging: Math.random() > 0.8,
          isTesting: Math.random() > 0.9
        };

        return {
          id: `player_${i}`,
          name: `${type.toLowerCase()}_${i + 1}`,
          type,
          confidence,
          totalVolume,
          averageOrderSize,
          trades,
          side,
          consistency,
          timeActive: Math.floor(Math.random() * 3600) + 300,
          priceRange,
          behavior,
          impact: {
            priceMovement: (Math.random() - 0.5) * 2,
            volumeShare: totalVolume / (1000000 + Math.random() * 5000000),
            marketPressure: Math.random() * 100
          }
        };
      });

      // Generate big orders
      const bigOrders: BigOrderEvent[] = Array.from({ length: 8 + Math.floor(Math.random() * 12) }, (_, i) => {
        const timestamp = Date.now() - (Math.random() * 3600000);
        const volume = 1000 + Math.random() * 10000;
        const completion = Math.random();
        const orderTypes = ['ICEBERG', 'SWEEP', 'BLOCK', 'SPLIT'] as const;
        
        return {
          timestamp,
          price: currentPrice + (Math.random() - 0.5) * 15,
          volume,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
          playerId: Math.random() > 0.3 ? players[Math.floor(Math.random() * players.length)]?.id : undefined,
          type: orderTypes[Math.floor(Math.random() * orderTypes.length)],
          completion,
          remaining: volume * (1 - completion),
          impact: Math.random() * 0.5,
          isActive: completion < 1 && Math.random() > 0.6
        };
      });

      // Flow analysis
      const buyVolume = players
        .filter(p => p.side === 'BUY' || p.side === 'BOTH')
        .reduce((sum, p) => sum + p.totalVolume * (p.side === 'BOTH' ? 0.5 : 1), 0);
      
      const sellVolume = players
        .filter(p => p.side === 'SELL' || p.side === 'BOTH')
        .reduce((sum, p) => sum + p.totalVolume * (p.side === 'BOTH' ? 0.5 : 1), 0);

      const netFlow = buyVolume - sellVolume;
      const totalFlow = buyVolume + sellVolume;
      const flowStrength = totalFlow > 0 ? Math.abs(netFlow) / totalFlow : 0;

      const flowAnalysis: FlowAnalysis = {
        netInstitutionalFlow: netFlow,
        buyPressure: totalFlow > 0 ? buyVolume / totalFlow : 0.5,
        sellPressure: totalFlow > 0 ? sellVolume / totalFlow : 0.5,
        flowDirection: flowStrength > 0.2 ? (netFlow > 0 ? 'BULLISH' : 'BEARISH') : 'NEUTRAL',
        flowStrength,
        dominantPlayer: players.reduce((max, p) => 
          p.totalVolume > (max?.totalVolume || 0) ? p : max, null as InstitutionalPlayer | null),
        marketManipulation: {
          suspected: Math.random() > 0.9,
          confidence: Math.random() * 100,
          type: Math.random() > 0.95 ? 
            (['PAINT_TAPE', 'SPOOFING', 'LAYERING'] as const)[Math.floor(Math.random() * 3)] : 'NONE'
        }
      };

      // Generate alerts
      const alerts = [];
      const biggestPlayer = players.reduce((max, p) => 
        p.totalVolume > max.totalVolume ? p : max, players[0]);
      
      if (biggestPlayer && biggestPlayer.totalVolume > 200000) {
        alerts.push({
          type: 'BIG_PLAYER_ENTRY' as const,
          message: `Grande player detectado: ${biggestPlayer.type} com ${(biggestPlayer.totalVolume / 1000).toFixed(0)}K volume`,
          playerId: biggestPlayer.id,
          severity: 'HIGH' as const,
          timestamp: Date.now()
        });
      }

      players.forEach(player => {
        if (player.behavior.isAccumulating && player.confidence > 0.8) {
          alerts.push({
            type: 'ACCUMULATION_DETECTED' as const,
            message: `Acumulação detectada: ${player.type}`,
            playerId: player.id,
            severity: 'MEDIUM' as const,
            timestamp: Date.now()
          });
        }
        if (player.behavior.isDistributing && player.confidence > 0.8) {
          alerts.push({
            type: 'DISTRIBUTION_DETECTED' as const,
            message: `Distribuição detectada: ${player.type}`,
            playerId: player.id,
            severity: 'MEDIUM' as const,
            timestamp: Date.now()
          });
        }
      });

      if (flowAnalysis.marketManipulation.suspected) {
        alerts.push({
          type: 'MANIPULATION_SUSPECTED' as const,
          message: `Possível manipulação: ${flowAnalysis.marketManipulation.type}`,
          severity: 'HIGH' as const,
          timestamp: Date.now()
        });
      }

      const totalInstitutionalVolume = players.reduce((sum, p) => sum + p.totalVolume, 0);
      const totalRetailVolume = Math.random() * 2000000;

      return {
        players,
        bigOrders: bigOrders.sort((a, b) => b.timestamp - a.timestamp),
        flowAnalysis,
        alerts,
        summary: {
          totalInstitutionalVolume,
          totalRetailVolume,
          institutionalRatio: totalInstitutionalVolume / (totalInstitutionalVolume + totalRetailVolume),
          bigPlayersActive: players.length,
          averagePlayerConfidence: players.reduce((sum, p) => sum + p.confidence, 0) / players.length
        }
      };
    };

    const updateData = () => {
      setData(generateInstitutionalData());
      setIsLoading(false);
    };

    updateData();
    const interval = setInterval(updateData, 3000);

    return () => clearInterval(interval);
  }, []);

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  const formatDuration = (seconds: number) => {
    if (seconds >= 3600) return `${Math.floor(seconds / 3600)}h${Math.floor((seconds % 3600) / 60)}m`;
    if (seconds >= 60) return `${Math.floor(seconds / 60)}m`;
    return `${seconds}s`;
  };

  const getPlayerTypeIcon = (type: string) => {
    switch (type) {
      case 'BANK': return '🏦';
      case 'HEDGE_FUND': return '📈';
      case 'PENSION_FUND': return '👴';
      case 'INSURANCE': return '🛡️';
      case 'PROPRIETARY': return '🏢';
      default: return '❓';
    }
  };

  const getPlayerTypeColor = (type: string) => {
    switch (type) {
      case 'BANK': return 'text-blue-400';
      case 'HEDGE_FUND': return 'text-red-400';
      case 'PENSION_FUND': return 'text-green-400';
      case 'INSURANCE': return 'text-purple-400';
      case 'PROPRIETARY': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-48"></div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredPlayers = filterType === 'ALL' ? data.players : 
                          data.players.filter(p => p.type === filterType);

  return (
    <div className="space-y-6">
      {/* Header with Summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">🏦 Players Relevantes</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-gray-300">
            Players Ativos: <span className="text-white font-mono">{data.summary.bigPlayersActive}</span>
          </div>
          <div className="text-gray-300">
            Confiança Média: <span className="text-white font-mono">{(data.summary.averagePlayerConfidence * 100).toFixed(0)}%</span>
          </div>
          <div className={`px-2 py-1 rounded text-xs ${
            data.flowAnalysis.flowDirection === 'BULLISH' ? 'bg-buy-primary/20 text-buy-primary' :
            data.flowAnalysis.flowDirection === 'BEARISH' ? 'bg-sell-primary/20 text-sell-primary' :
            'bg-gray-700 text-gray-300'
          }`}>
            {data.flowAnalysis.flowDirection === 'BULLISH' ? '📈 Fluxo Compra' :
             data.flowAnalysis.flowDirection === 'BEARISH' ? '📉 Fluxo Venda' :
             '⚖️ Fluxo Neutro'}
          </div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {data.alerts.slice(0, 3).map((alert, index) => (
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

      {/* Flow Analysis */}
      <div className="bg-gray-800 p-4 rounded">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-medium flex items-center gap-2">
            <TrendingUp size={16} />
            Análise de Fluxo Institucional
          </h4>
          {data.flowAnalysis.marketManipulation.suspected && (
            <div className="px-2 py-1 bg-red-400/20 text-red-400 rounded text-xs flex items-center gap-1">
              <Shield size={12} />
              Manipulação Suspeita
            </div>
          )}
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <div className={`text-xl font-mono ${
              data.flowAnalysis.netInstitutionalFlow > 0 ? 'text-buy-primary' : 'text-sell-primary'
            }`}>
              {data.flowAnalysis.netInstitutionalFlow > 0 ? '+' : ''}
              {formatVolume(Math.abs(data.flowAnalysis.netInstitutionalFlow))}
            </div>
            <div className="text-xs text-gray-400">Fluxo Líquido</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-mono text-buy-primary">
              {(data.flowAnalysis.buyPressure * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">Pressão Compra</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-mono text-sell-primary">
              {(data.flowAnalysis.sellPressure * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">Pressão Venda</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-mono text-white">
              {(data.flowAnalysis.flowStrength * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">Força do Fluxo</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="w-full bg-gray-700 rounded-full h-3 relative">
            <div
              className="bg-buy-primary h-3 rounded-l-full"
              style={{ width: `${data.flowAnalysis.buyPressure * 100}%` }}
            />
            <div
              className="bg-sell-primary h-3 rounded-r-full absolute top-0 right-0"
              style={{ width: `${data.flowAnalysis.sellPressure * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Compra Institucional</span>
            <span>Venda Institucional</span>
          </div>
        </div>
      </div>

      {/* Player Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-400">Filtro:</span>
        {['ALL', 'BANK', 'HEDGE_FUND', 'PENSION_FUND', 'INSURANCE', 'PROPRIETARY'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`px-2 py-1 rounded text-xs ${
              filterType === type ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {type === 'ALL' ? 'Todos' : type.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Players List */}
      <div className="grid grid-cols-1 gap-3">
        {filteredPlayers.map((player, index) => (
          <div
            key={player.id}
            className={`bg-gray-800 p-4 rounded cursor-pointer hover:bg-gray-750 border ${
              player.confidence > 0.8 ? 'border-yellow-400/30' : 'border-gray-700'
            } ${
              selectedPlayer?.id === player.id ? 'ring-2 ring-blue-400' : ''
            }`}
            onClick={() => setSelectedPlayer(selectedPlayer?.id === player.id ? null : player)}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getPlayerTypeIcon(player.type)}</span>
                <div>
                  <div className="text-white font-medium">{player.name.toUpperCase()}</div>
                  <div className={`text-sm ${getPlayerTypeColor(player.type)}`}>{player.type.replace('_', ' ')}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <div className={`px-2 py-1 rounded text-xs ${
                  player.side === 'BUY' ? 'bg-buy-primary/20 text-buy-primary' :
                  player.side === 'SELL' ? 'bg-sell-primary/20 text-sell-primary' :
                  'bg-gray-700 text-gray-300'
                }`}>
                  {player.side === 'BUY' ? '📈 COMPRA' : player.side === 'SELL' ? '📉 VENDA' : '⚖️ AMBOS'}
                </div>
                <div className="text-right">
                  <div className="text-white font-mono">{formatVolume(player.totalVolume)}</div>
                  <div className="text-xs text-gray-400">{(player.confidence * 100).toFixed(0)}% conf</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-400">Trades: </span>
                <span className="text-white font-mono">{player.trades}</span>
              </div>
              <div>
                <span className="text-gray-400">Tamanho Médio: </span>
                <span className="text-white font-mono">{formatVolume(player.averageOrderSize)}</span>
              </div>
              <div>
                <span className="text-gray-400">Consistência: </span>
                <span className="text-white font-mono">{(player.consistency * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-gray-400">Tempo Ativo: </span>
                <span className="text-white font-mono">{formatDuration(player.timeActive)}</span>
              </div>
            </div>

            {(player.behavior.isAccumulating || player.behavior.isDistributing || player.behavior.isHedging || player.behavior.isTesting) && (
              <div className="mt-3 flex gap-2">
                {player.behavior.isAccumulating && (
                  <span className="px-2 py-1 bg-buy-primary/20 text-buy-primary rounded text-xs">
                    🔄 Acumulando
                  </span>
                )}
                {player.behavior.isDistributing && (
                  <span className="px-2 py-1 bg-sell-primary/20 text-sell-primary rounded text-xs">
                    📤 Distribuindo
                  </span>
                )}
                {player.behavior.isHedging && (
                  <span className="px-2 py-1 bg-yellow-400/20 text-yellow-400 rounded text-xs">
                    🛡️ Hedging
                  </span>
                )}
                {player.behavior.isTesting && (
                  <span className="px-2 py-1 bg-blue-400/20 text-blue-400 rounded text-xs">
                    🔍 Testando
                  </span>
                )}
              </div>
            )}

            {selectedPlayer?.id === player.id && (
              <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <div className="text-gray-400">Faixa de Preços</div>
                    <div className="text-white font-mono">
                      {player.priceRange.min.toFixed(2)} - {player.priceRange.max.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-400">
                      Foco: {player.priceRange.focus.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Impacto no Preço</div>
                    <div className={`text-white font-mono ${
                      player.impact.priceMovement > 0 ? 'text-buy-primary' : 'text-sell-primary'
                    }`}>
                      {player.impact.priceMovement > 0 ? '+' : ''}{player.impact.priceMovement.toFixed(3)}
                    </div>
                    <div className="text-xs text-gray-400">
                      Share: {(player.impact.volumeShare * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-400">Pressão de Mercado</div>
                    <div className="text-white font-mono">{player.impact.marketPressure.toFixed(0)}%</div>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                      <div
                        className={`h-2 rounded-full ${
                          player.impact.marketPressure > 70 ? 'bg-red-400' :
                          player.impact.marketPressure > 40 ? 'bg-yellow-400' : 'bg-green-400'
                        }`}
                        style={{ width: `${player.impact.marketPressure}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Big Orders Section */}
      <div className="bg-gray-800 p-4 rounded">
        <h4 className="text-white font-medium flex items-center gap-2 mb-4">
          <Eye size={16} />
          Ordens Grandes em Andamento
        </h4>

        <div className="space-y-2">
          {data.bigOrders.filter(order => order.isActive).slice(0, 8).map((order, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-2 rounded ${
                order.side === 'BUY' ? 'bg-buy-primary/10' : 'bg-sell-primary/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs ${
                  order.type === 'ICEBERG' ? 'bg-blue-400/20 text-blue-400' :
                  order.type === 'SWEEP' ? 'bg-red-400/20 text-red-400' :
                  order.type === 'BLOCK' ? 'bg-yellow-400/20 text-yellow-400' :
                  'bg-purple-400/20 text-purple-400'
                }`}>
                  {order.type}
                </span>
                <span className={`font-mono ${
                  order.side === 'BUY' ? 'text-buy-primary' : 'text-sell-primary'
                }`}>
                  {order.price.toFixed(2)}
                </span>
                <span className="text-white font-mono">{formatVolume(order.volume)}</span>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <div className="text-white">{(order.completion * 100).toFixed(0)}% completo</div>
                  <div className="w-20 bg-gray-700 rounded-full h-1">
                    <div
                      className="bg-blue-400 h-1 rounded-full"
                      style={{ width: `${order.completion * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  Restam: {formatVolume(order.remaining)}
                </div>
                <div className="text-xs text-gray-400">
                  {new Date(order.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded text-center">
          <div className="text-2xl font-mono text-white">{formatVolume(data.summary.totalInstitutionalVolume)}</div>
          <div className="text-sm text-gray-400">Volume Institucional</div>
        </div>
        <div className="bg-gray-800 p-4 rounded text-center">
          <div className="text-2xl font-mono text-white">{(data.summary.institutionalRatio * 100).toFixed(0)}%</div>
          <div className="text-sm text-gray-400">Ratio Institucional</div>
        </div>
        <div className="bg-gray-800 p-4 rounded text-center">
          <div className="text-2xl font-mono text-white">{data.bigOrders.filter(o => o.isActive).length}</div>
          <div className="text-sm text-gray-400">Ordens Ativas</div>
        </div>
      </div>
    </div>
  );
};

export default InstitutionalPlayersDetection;