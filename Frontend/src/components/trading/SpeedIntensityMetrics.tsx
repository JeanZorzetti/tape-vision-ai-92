import React, { useState, useEffect } from 'react';
import { Zap, Activity, Users, Building2, Clock, TrendingUp, TrendingDown } from 'lucide-react';

interface SpeedMetrics {
  tradesPerSecond: number;
  averageTradesPerSecond: number;
  peakTradesPerSecond: number;
  speedTrend: 'ACCELERATING' | 'DECELERATING' | 'STABLE';
  timeframes: {
    last1min: number;
    last5min: number;
    last15min: number;
    last1hour: number;
  };
}

interface IntensityMetrics {
  volumeVelocity: number;
  priceImpact: number;
  aggressionIndex: number;
  intensityLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  volumeProfile: {
    retail: number;
    institutional: number;
    hft: number;
  };
}

interface PlayerAnalysis {
  retailVolume: number;
  institutionalVolume: number;
  retailTrades: number;
  institutionalTrades: number;
  averageRetailSize: number;
  averageInstitutionalSize: number;
  dominantPlayer: 'RETAIL' | 'INSTITUTIONAL' | 'BALANCED';
  volumeRatio: number;
}

interface TimeAndSales {
  timestamp: number;
  price: number;
  volume: number;
  side: 'BUY' | 'SELL';
  aggressor: 'RETAIL' | 'INSTITUTIONAL' | 'HFT';
  orderType: 'MARKET' | 'LIMIT' | 'STOP';
  isLarge: boolean;
}

interface SpeedIntensityData {
  speed: SpeedMetrics;
  intensity: IntensityMetrics;
  players: PlayerAnalysis;
  recentTrades: TimeAndSales[];
  alerts: {
    type: 'SPEED_SPIKE' | 'VOLUME_SURGE' | 'INSTITUTIONAL_FLOW' | 'RETAIL_PANIC';
    message: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    timestamp: number;
  }[];
}

const SpeedIntensityMetrics: React.FC = () => {
  const [data, setData] = useState<SpeedIntensityData | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1min' | '5min' | '15min' | '1hour'>('5min');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateSpeedIntensityData = (): SpeedIntensityData => {
      // Speed metrics
      const currentTPS = 5 + Math.random() * 25;
      const avgTPS = 8 + Math.random() * 15;
      const peakTPS = currentTPS + Math.random() * 20;
      
      const speed: SpeedMetrics = {
        tradesPerSecond: currentTPS,
        averageTradesPerSecond: avgTPS,
        peakTradesPerSecond: peakTPS,
        speedTrend: currentTPS > avgTPS * 1.2 ? 'ACCELERATING' :
                   currentTPS < avgTPS * 0.8 ? 'DECELERATING' : 'STABLE',
        timeframes: {
          last1min: currentTPS + (Math.random() - 0.5) * 5,
          last5min: avgTPS + (Math.random() - 0.5) * 3,
          last15min: avgTPS + (Math.random() - 0.5) * 2,
          last1hour: avgTPS + (Math.random() - 0.5) * 1
        }
      };

      // Intensity metrics
      const volumeVelocity = 50000 + Math.random() * 200000;
      const priceImpact = Math.random() * 0.5;
      const aggressionIndex = Math.random() * 100;
      
      const intensity: IntensityMetrics = {
        volumeVelocity,
        priceImpact,
        aggressionIndex,
        intensityLevel: aggressionIndex > 80 ? 'EXTREME' :
                       aggressionIndex > 60 ? 'HIGH' :
                       aggressionIndex > 30 ? 'MODERATE' : 'LOW',
        volumeProfile: {
          retail: 0.4 + Math.random() * 0.3,
          institutional: 0.3 + Math.random() * 0.4,
          hft: 0.1 + Math.random() * 0.3
        }
      };

      // Player analysis
      const totalVolume = 1000000 + Math.random() * 5000000;
      const retailRatio = 0.6 + Math.random() * 0.3;
      const retailVolume = totalVolume * retailRatio;
      const institutionalVolume = totalVolume * (1 - retailRatio);
      
      const players: PlayerAnalysis = {
        retailVolume,
        institutionalVolume,
        retailTrades: 800 + Math.floor(Math.random() * 1200),
        institutionalTrades: 50 + Math.floor(Math.random() * 150),
        averageRetailSize: retailVolume / (800 + Math.random() * 1200),
        averageInstitutionalSize: institutionalVolume / (50 + Math.random() * 150),
        dominantPlayer: retailRatio > 0.7 ? 'RETAIL' :
                       retailRatio < 0.4 ? 'INSTITUTIONAL' : 'BALANCED',
        volumeRatio: retailVolume / institutionalVolume
      };

      // Recent trades
      const recentTrades: TimeAndSales[] = Array.from({ length: 20 }, (_, i) => {
        const timestamp = Date.now() - (i * 1000);
        const volume = Math.floor(Math.random() * 500) + 10;
        const isLarge = volume > 200;
        const aggressor = isLarge && Math.random() > 0.6 ? 'INSTITUTIONAL' :
                         Math.random() > 0.9 ? 'HFT' : 'RETAIL';
        
        return {
          timestamp,
          price: 4580.25 + (Math.random() - 0.5) * 2,
          volume,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
          aggressor,
          orderType: Math.random() > 0.8 ? 'MARKET' : 'LIMIT',
          isLarge
        };
      });

      // Alerts
      const alerts = [];
      if (currentTPS > avgTPS * 1.5) {
        alerts.push({
          type: 'SPEED_SPIKE' as const,
          message: `Pico de velocidade: ${currentTPS.toFixed(1)} trades/seg`,
          severity: 'HIGH' as const,
          timestamp: Date.now()
        });
      }
      if (aggressionIndex > 75) {
        alerts.push({
          type: 'VOLUME_SURGE' as const,
          message: `Alta agressão detectada: ${aggressionIndex.toFixed(0)}%`,
          severity: 'HIGH' as const,
          timestamp: Date.now()
        });
      }
      if (players.dominantPlayer === 'INSTITUTIONAL' && Math.random() > 0.7) {
        alerts.push({
          type: 'INSTITUTIONAL_FLOW' as const,
          message: 'Fluxo institucional dominante detectado',
          severity: 'MEDIUM' as const,
          timestamp: Date.now()
        });
      }

      return {
        speed,
        intensity,
        players,
        recentTrades,
        alerts
      };
    };

    const updateData = () => {
      setData(generateSpeedIntensityData());
      setIsLoading(false);
    };

    updateData();
    const interval = setInterval(updateData, 1000);

    return () => clearInterval(interval);
  }, []);

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toFixed(0);
  };

  const getIntensityColor = (level: string) => {
    switch (level) {
      case 'EXTREME': return 'text-red-400 bg-red-400/20';
      case 'HIGH': return 'text-orange-400 bg-orange-400/20';
      case 'MODERATE': return 'text-yellow-400 bg-yellow-400/20';
      default: return 'text-green-400 bg-green-400/20';
    }
  };

  const getSpeedTrendIcon = (trend: string) => {
    switch (trend) {
      case 'ACCELERATING': return <TrendingUp className="text-buy-primary" size={16} />;
      case 'DECELERATING': return <TrendingDown className="text-sell-primary" size={16} />;
      default: return <Activity className="text-gray-400" size={16} />;
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

  return (
    <div className="space-y-6">
      {/* Header with Alerts */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">⚡ Velocidade & Intensidade</h3>
        <div className="flex gap-2">
          {data.alerts.map((alert, index) => (
            <div
              key={index}
              className={`px-2 py-1 rounded text-xs flex items-center gap-1 ${
                alert.severity === 'HIGH' ? 'bg-red-400/20 text-red-400' :
                alert.severity === 'MEDIUM' ? 'bg-yellow-400/20 text-yellow-400' :
                'bg-blue-400/20 text-blue-400'
              }`}
            >
              <Zap size={12} />
              {alert.message}
            </div>
          ))}
        </div>
      </div>

      {/* Speed Metrics */}
      <div className="bg-gray-800 p-4 rounded">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Clock size={16} />
            Velocidade de Negociação
          </h4>
          <div className="flex items-center gap-2">
            {getSpeedTrendIcon(data.speed.speedTrend)}
            <span className="text-sm text-gray-300">{data.speed.speedTrend}</span>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-mono text-white">{data.speed.tradesPerSecond.toFixed(1)}</div>
            <div className="text-xs text-gray-400">Atual (t/s)</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-mono text-gray-300">{data.speed.averageTradesPerSecond.toFixed(1)}</div>
            <div className="text-xs text-gray-400">Média (t/s)</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-mono text-yellow-400">{data.speed.peakTradesPerSecond.toFixed(1)}</div>
            <div className="text-xs text-gray-400">Pico (t/s)</div>
          </div>
          <div className="text-center">
            <div className={`text-xl font-mono ${
              data.speed.tradesPerSecond > data.speed.averageTradesPerSecond ? 'text-buy-primary' : 'text-sell-primary'
            }`}>
              {((data.speed.tradesPerSecond / data.speed.averageTradesPerSecond - 1) * 100).toFixed(0)}%
            </div>
            <div className="text-xs text-gray-400">vs Média</div>
          </div>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-400">Histórico:</span>
          {(['1min', '5min', '15min', '1hour'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setSelectedTimeframe(tf)}
              className={`px-2 py-1 rounded text-xs ${
                selectedTimeframe === tf ? 'bg-blue-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>

        <div className="text-sm">
          <span className="text-gray-400">Média {selectedTimeframe}: </span>
          <span className="text-white font-mono">
            {data.speed.timeframes[`last${selectedTimeframe}` as keyof typeof data.speed.timeframes].toFixed(1)} t/s
          </span>
        </div>
      </div>

      {/* Intensity & Volume Profile */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-white font-medium flex items-center gap-2 mb-4">
            <Activity size={16} />
            Intensidade
          </h4>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Nível de Intensidade</span>
                <span className={`px-2 py-1 rounded text-xs ${getIntensityColor(data.intensity.intensityLevel)}`}>
                  {data.intensity.intensityLevel}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Índice Agressão</span>
                <span className="text-white font-mono">{data.intensity.aggressionIndex.toFixed(0)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                <div
                  className={`h-2 rounded-full ${
                    data.intensity.aggressionIndex > 75 ? 'bg-red-400' :
                    data.intensity.aggressionIndex > 50 ? 'bg-orange-400' :
                    data.intensity.aggressionIndex > 25 ? 'bg-yellow-400' : 'bg-green-400'
                  }`}
                  style={{ width: `${data.intensity.aggressionIndex}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Velocidade Vol</span>
                <span className="text-white font-mono">{formatVolume(data.intensity.volumeVelocity)}/s</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Impacto Preço</span>
                <span className="text-white font-mono">{(data.intensity.priceImpact * 100).toFixed(2)}%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-white font-medium flex items-center gap-2 mb-4">
            <Users size={16} />
            Perfil de Volume
          </h4>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Varejo</span>
                <span className="text-white font-mono">{(data.intensity.volumeProfile.retail * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-400 h-2 rounded-full"
                  style={{ width: `${data.intensity.volumeProfile.retail * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">Institucional</span>
                <span className="text-white font-mono">{(data.intensity.volumeProfile.institutional * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full"
                  style={{ width: `${data.intensity.volumeProfile.institutional * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-400">HFT/Algo</span>
                <span className="text-white font-mono">{(data.intensity.volumeProfile.hft * 100).toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-red-400 h-2 rounded-full"
                  style={{ width: `${data.intensity.volumeProfile.hft * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Player Analysis */}
      <div className="bg-gray-800 p-4 rounded">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-white font-medium flex items-center gap-2">
            <Building2 size={16} />
            Análise de Players
          </h4>
          <div className={`px-2 py-1 rounded text-xs ${
            data.players.dominantPlayer === 'INSTITUTIONAL' ? 'bg-yellow-400/20 text-yellow-400' :
            data.players.dominantPlayer === 'RETAIL' ? 'bg-blue-400/20 text-blue-400' :
            'bg-gray-700 text-gray-300'
          }`}>
            {data.players.dominantPlayer === 'INSTITUTIONAL' ? '🏦 Institucional' :
             data.players.dominantPlayer === 'RETAIL' ? '👥 Varejo' :
             '⚖️ Equilibrado'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <h5 className="text-blue-400 font-medium mb-2">👥 Varejo</h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Volume</span>
                <span className="text-white font-mono">{formatVolume(data.players.retailVolume)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trades</span>
                <span className="text-white font-mono">{data.players.retailTrades.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tamanho Médio</span>
                <span className="text-white font-mono">{formatVolume(data.players.averageRetailSize)}</span>
              </div>
            </div>
          </div>

          <div>
            <h5 className="text-yellow-400 font-medium mb-2">🏦 Institucional</h5>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Volume</span>
                <span className="text-white font-mono">{formatVolume(data.players.institutionalVolume)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trades</span>
                <span className="text-white font-mono">{data.players.institutionalTrades.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Tamanho Médio</span>
                <span className="text-white font-mono">{formatVolume(data.players.averageInstitutionalSize)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Ratio Volume (Varejo:Institucional)</span>
            <span className="text-white font-mono">{data.players.volumeRatio.toFixed(2)}:1</span>
          </div>
        </div>
      </div>

      {/* Recent Trades Stream */}
      <div className="bg-gray-800 p-4 rounded">
        <h4 className="text-white font-medium flex items-center gap-2 mb-3">
          <Activity size={16} />
          Stream de Negócios (Últimos 20)
        </h4>

        <div className="space-y-1 max-h-60 overflow-y-auto">
          {data.recentTrades.map((trade, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-2 rounded text-xs ${
                trade.side === 'BUY' ? 'bg-buy-primary/10' : 'bg-sell-primary/10'
              } ${
                trade.isLarge ? 'border-l-2 border-yellow-400' : ''
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-mono">
                  {new Date(trade.timestamp).toLocaleTimeString()}
                </span>
                <span className={`font-mono ${
                  trade.side === 'BUY' ? 'text-buy-primary' : 'text-sell-primary'
                }`}>
                  {trade.price.toFixed(2)}
                </span>
                <span className="text-white font-mono">{formatVolume(trade.volume)}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-1 py-0.5 rounded text-xs ${
                  trade.aggressor === 'INSTITUTIONAL' ? 'bg-yellow-400/20 text-yellow-400' :
                  trade.aggressor === 'HFT' ? 'bg-red-400/20 text-red-400' :
                  'bg-blue-400/20 text-blue-400'
                }`}>
                  {trade.aggressor === 'INSTITUTIONAL' ? '🏦' :
                   trade.aggressor === 'HFT' ? '🤖' : '👥'}
                </span>
                <span className={`text-xs ${
                  trade.side === 'BUY' ? 'text-buy-primary' : 'text-sell-primary'
                }`}>
                  {trade.side}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SpeedIntensityMetrics;