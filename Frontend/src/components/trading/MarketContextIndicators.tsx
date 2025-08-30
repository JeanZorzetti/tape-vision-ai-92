import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Target, BarChart3, Activity, AlertCircle } from 'lucide-react';

interface PriceLevel {
  price: number;
  volume: number;
  strength: number;
  type: 'SUPPORT' | 'RESISTANCE';
  touches: number;
  lastTest: number;
}

interface VWAPData {
  value: number;
  deviation: number;
  bands: {
    upper1: number;
    upper2: number;
    lower1: number;
    lower2: number;
  };
  position: 'ABOVE' | 'BELOW' | 'ON';
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

interface TrendAnalysis {
  shortTerm: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  mediumTerm: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  longTerm: 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
  strength: number;
  momentum: number;
  divergence: boolean;
}

interface VolatilityData {
  atr: number;
  impliedVolatility: number;
  historicalVolatility: number;
  volatilityRank: number;
  regime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXTREME';
}

interface MarketContextData {
  currentPrice: number;
  vwap: VWAPData;
  supportResistance: PriceLevel[];
  trend: TrendAnalysis;
  volatility: VolatilityData;
  keyLevels: {
    todayHigh: number;
    todayLow: number;
    yesterdayClose: number;
    weekHigh: number;
    weekLow: number;
    monthHigh: number;
    monthLow: number;
  };
  marketStructure: {
    higherHighs: boolean;
    higherLows: boolean;
    lowerHighs: boolean;
    lowerLows: boolean;
    structureBreak: boolean;
    structureType: 'UPTREND' | 'DOWNTREND' | 'RANGE';
  };
}

const MarketContextIndicators: React.FC = () => {
  const [marketContext, setMarketContext] = useState<MarketContextData | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<PriceLevel | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const generateMarketContext = (): MarketContextData => {
      const basePrice = 4580.25;
      const currentPrice = basePrice + (Math.random() - 0.5) * 20;
      
      // VWAP calculation
      const vwapValue = basePrice + (Math.random() - 0.5) * 5;
      const deviation = Math.abs(currentPrice - vwapValue);
      const standardDev = 2.5 + Math.random() * 2;
      
      const vwap: VWAPData = {
        value: vwapValue,
        deviation: deviation / vwapValue * 100,
        bands: {
          upper1: vwapValue + standardDev,
          upper2: vwapValue + (standardDev * 2),
          lower1: vwapValue - standardDev,
          lower2: vwapValue - (standardDev * 2)
        },
        position: currentPrice > vwapValue + 1 ? 'ABOVE' : 
                  currentPrice < vwapValue - 1 ? 'BELOW' : 'ON',
        trend: currentPrice > vwapValue && deviation > 0.1 ? 'BULLISH' :
               currentPrice < vwapValue && deviation > 0.1 ? 'BEARISH' : 'NEUTRAL'
      };

      // Support/Resistance levels
      const supportResistance: PriceLevel[] = [
        {
          price: currentPrice + 15,
          volume: 15000 + Math.random() * 10000,
          strength: 0.8 + Math.random() * 0.2,
          type: 'RESISTANCE',
          touches: 3 + Math.floor(Math.random() * 5),
          lastTest: Date.now() - (Math.random() * 3600000)
        },
        {
          price: currentPrice + 8,
          volume: 12000 + Math.random() * 8000,
          strength: 0.6 + Math.random() * 0.3,
          type: 'RESISTANCE',
          touches: 2 + Math.floor(Math.random() * 4),
          lastTest: Date.now() - (Math.random() * 1800000)
        },
        {
          price: currentPrice - 8,
          volume: 18000 + Math.random() * 12000,
          strength: 0.7 + Math.random() * 0.3,
          type: 'SUPPORT',
          touches: 4 + Math.floor(Math.random() * 6),
          lastTest: Date.now() - (Math.random() * 2400000)
        },
        {
          price: currentPrice - 15,
          volume: 20000 + Math.random() * 15000,
          strength: 0.9 + Math.random() * 0.1,
          type: 'SUPPORT',
          touches: 5 + Math.floor(Math.random() * 7),
          lastTest: Date.now() - (Math.random() * 4200000)
        }
      ].sort((a, b) => b.price - a.price);

      // Trend analysis
      const momentum = (Math.random() - 0.5) * 100;
      const trend: TrendAnalysis = {
        shortTerm: momentum > 20 ? 'BULLISH' : momentum < -20 ? 'BEARISH' : 'SIDEWAYS',
        mediumTerm: momentum > 10 ? 'BULLISH' : momentum < -10 ? 'BEARISH' : 'SIDEWAYS',
        longTerm: momentum > 5 ? 'BULLISH' : momentum < -5 ? 'BEARISH' : 'SIDEWAYS',
        strength: Math.abs(momentum) / 100,
        momentum,
        divergence: Math.random() > 0.8
      };

      // Volatility data
      const atr = 5 + Math.random() * 10;
      const volatility: VolatilityData = {
        atr,
        impliedVolatility: 0.15 + Math.random() * 0.25,
        historicalVolatility: 0.12 + Math.random() * 0.3,
        volatilityRank: Math.random() * 100,
        regime: atr < 8 ? 'LOW' : atr < 12 ? 'NORMAL' : atr < 18 ? 'HIGH' : 'EXTREME'
      };

      // Key levels
      const keyLevels = {
        todayHigh: currentPrice + 5 + Math.random() * 15,
        todayLow: currentPrice - 5 - Math.random() * 15,
        yesterdayClose: currentPrice + (Math.random() - 0.5) * 10,
        weekHigh: currentPrice + 20 + Math.random() * 30,
        weekLow: currentPrice - 20 - Math.random() * 30,
        monthHigh: currentPrice + 40 + Math.random() * 60,
        monthLow: currentPrice - 40 - Math.random() * 60
      };

      // Market structure
      const marketStructure = {
        higherHighs: trend.shortTerm === 'BULLISH' && Math.random() > 0.3,
        higherLows: trend.shortTerm === 'BULLISH' && Math.random() > 0.4,
        lowerHighs: trend.shortTerm === 'BEARISH' && Math.random() > 0.3,
        lowerLows: trend.shortTerm === 'BEARISH' && Math.random() > 0.4,
        structureBreak: Math.random() > 0.85,
        structureType: trend.shortTerm === 'BULLISH' ? 'UPTREND' :
                       trend.shortTerm === 'BEARISH' ? 'DOWNTREND' : 'RANGE' as const
      };

      return {
        currentPrice,
        vwap,
        supportResistance,
        trend,
        volatility,
        keyLevels,
        marketStructure
      };
    };

    const updateContext = () => {
      setMarketContext(generateMarketContext());
      setIsLoading(false);
    };

    updateContext();
    const interval = setInterval(updateContext, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => price.toFixed(2);
  const formatPercentage = (value: number) => `${(value * 100).toFixed(2)}%`;

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-48"></div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!marketContext) return null;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'BULLISH': return <TrendingUp className="text-buy-primary" size={16} />;
      case 'BEARISH': return <TrendingDown className="text-sell-primary" size={16} />;
      default: return <Activity className="text-gray-400" size={16} />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'BULLISH': return 'text-buy-primary';
      case 'BEARISH': return 'text-sell-primary';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">🧩 Contexto de Mercado</h3>
        <div className="text-sm text-gray-300">
          Preço Atual: <span className="font-mono text-white">{formatPrice(marketContext.currentPrice)}</span>
        </div>
      </div>

      {/* VWAP Section */}
      <div className="bg-gray-800 p-4 rounded">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-white font-medium flex items-center gap-2">
            <BarChart3 size={16} />
            VWAP & Bandas
          </h4>
          <div className={`px-2 py-1 rounded text-xs ${
            marketContext.vwap.trend === 'BULLISH' ? 'bg-buy-primary/20 text-buy-primary' :
            marketContext.vwap.trend === 'BEARISH' ? 'bg-sell-primary/20 text-sell-primary' :
            'bg-gray-700 text-gray-300'
          }`}>
            {marketContext.vwap.position} VWAP ({marketContext.vwap.trend})
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400">VWAP</div>
            <div className="text-white font-mono">{formatPrice(marketContext.vwap.value)}</div>
          </div>
          <div>
            <div className="text-gray-400">Desvio</div>
            <div className="text-white font-mono">{marketContext.vwap.deviation.toFixed(3)}%</div>
          </div>
        </div>

        <div className="mt-3 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-sell-primary">Banda Superior 2σ</span>
            <span className="font-mono">{formatPrice(marketContext.vwap.bands.upper2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-400">Banda Superior 1σ</span>
            <span className="font-mono">{formatPrice(marketContext.vwap.bands.upper1)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span className="text-blue-400">VWAP</span>
            <span className="font-mono">{formatPrice(marketContext.vwap.value)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-orange-400">Banda Inferior 1σ</span>
            <span className="font-mono">{formatPrice(marketContext.vwap.bands.lower1)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-buy-primary">Banda Inferior 2σ</span>
            <span className="font-mono">{formatPrice(marketContext.vwap.bands.lower2)}</span>
          </div>
        </div>
      </div>

      {/* Support/Resistance Levels */}
      <div className="bg-gray-800 p-4 rounded">
        <h4 className="text-white font-medium flex items-center gap-2 mb-3">
          <Target size={16} />
          Suporte & Resistência
        </h4>
        
        <div className="space-y-2">
          {marketContext.supportResistance.map((level, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-2 rounded cursor-pointer hover:bg-gray-700/50 ${
                level.strength > 0.8 ? 'border-l-2 border-yellow-400' : ''
              }`}
              onClick={() => setSelectedLevel(level)}
            >
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${
                  level.type === 'RESISTANCE' ? 'bg-sell-primary/20 text-sell-primary' : 'bg-buy-primary/20 text-buy-primary'
                }`}>
                  {level.type === 'RESISTANCE' ? 'RES' : 'SUP'}
                </span>
                <span className="font-mono text-white">{formatPrice(level.price)}</span>
              </div>
              
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-400">Vol: {(level.volume / 1000).toFixed(0)}k</span>
                <div className="flex items-center gap-1">
                  <div className={`h-2 w-8 rounded ${
                    level.strength > 0.8 ? 'bg-red-500' :
                    level.strength > 0.6 ? 'bg-yellow-500' : 'bg-green-500'
                  }`} style={{ width: `${level.strength * 32}px` }} />
                  <span className="text-xs text-gray-400">{(level.strength * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trend Analysis */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            {getTrendIcon(marketContext.trend.shortTerm)}
            <span className="text-white font-medium">Curto Prazo</span>
          </div>
          <div className={`text-sm ${getTrendColor(marketContext.trend.shortTerm)}`}>
            {marketContext.trend.shortTerm}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Força: {(marketContext.trend.strength * 100).toFixed(0)}%
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            {getTrendIcon(marketContext.trend.mediumTerm)}
            <span className="text-white font-medium">Médio Prazo</span>
          </div>
          <div className={`text-sm ${getTrendColor(marketContext.trend.mediumTerm)}`}>
            {marketContext.trend.mediumTerm}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Momentum: {marketContext.trend.momentum.toFixed(1)}
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            {getTrendIcon(marketContext.trend.longTerm)}
            <span className="text-white font-medium">Longo Prazo</span>
          </div>
          <div className={`text-sm ${getTrendColor(marketContext.trend.longTerm)}`}>
            {marketContext.trend.longTerm}
          </div>
          <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
            {marketContext.trend.divergence && (
              <>
                <AlertCircle size={12} className="text-orange-400" />
                Divergência
              </>
            )}
          </div>
        </div>
      </div>

      {/* Volatility & Key Levels */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-white font-medium mb-3">Volatilidade</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">ATR</span>
              <span className="font-mono text-white">{marketContext.volatility.atr.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Regime</span>
              <span className={`font-mono ${
                marketContext.volatility.regime === 'LOW' ? 'text-green-400' :
                marketContext.volatility.regime === 'NORMAL' ? 'text-blue-400' :
                marketContext.volatility.regime === 'HIGH' ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {marketContext.volatility.regime}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Rank Vol</span>
              <span className="font-mono text-white">{marketContext.volatility.volatilityRank.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <h4 className="text-white font-medium mb-3">Níveis Chave</h4>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-400">Máx. Hoje</span>
              <span className="font-mono text-sell-primary">{formatPrice(marketContext.keyLevels.todayHigh)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mín. Hoje</span>
              <span className="font-mono text-buy-primary">{formatPrice(marketContext.keyLevels.todayLow)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fecha Ontem</span>
              <span className="font-mono text-white">{formatPrice(marketContext.keyLevels.yesterdayClose)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Máx. Semana</span>
              <span className="font-mono text-gray-300">{formatPrice(marketContext.keyLevels.weekHigh)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Mín. Semana</span>
              <span className="font-mono text-gray-300">{formatPrice(marketContext.keyLevels.weekLow)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Market Structure */}
      <div className="bg-gray-800 p-4 rounded">
        <h4 className="text-white font-medium flex items-center gap-2 mb-3">
          <Activity size={16} />
          Estrutura de Mercado - {marketContext.marketStructure.structureType}
        </h4>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Topos Crescentes</span>
              <span className={`${marketContext.marketStructure.higherHighs ? 'text-buy-primary' : 'text-gray-500'}`}>
                {marketContext.marketStructure.higherHighs ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Fundos Crescentes</span>
              <span className={`${marketContext.marketStructure.higherLows ? 'text-buy-primary' : 'text-gray-500'}`}>
                {marketContext.marketStructure.higherLows ? '✓' : '✗'}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Topos Decrescentes</span>
              <span className={`${marketContext.marketStructure.lowerHighs ? 'text-sell-primary' : 'text-gray-500'}`}>
                {marketContext.marketStructure.lowerHighs ? '✓' : '✗'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Fundos Decrescentes</span>
              <span className={`${marketContext.marketStructure.lowerLows ? 'text-sell-primary' : 'text-gray-500'}`}>
                {marketContext.marketStructure.lowerLows ? '✓' : '✗'}
              </span>
            </div>
          </div>
        </div>

        {marketContext.marketStructure.structureBreak && (
          <div className="mt-3 p-2 bg-orange-400/10 border border-orange-400/30 rounded">
            <div className="flex items-center gap-2 text-orange-400 text-sm">
              <AlertCircle size={16} />
              Quebra de Estrutura Detectada
            </div>
          </div>
        )}
      </div>

      {/* Selected Level Details */}
      {selectedLevel && (
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium">
              Detalhes - {selectedLevel.type === 'RESISTANCE' ? 'Resistência' : 'Suporte'}
            </h4>
            <button
              onClick={() => setSelectedLevel(null)}
              className="text-gray-400 hover:text-white"
            >
              ×
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-400">Preço: </span>
              <span className="text-white font-mono">{formatPrice(selectedLevel.price)}</span>
            </div>
            <div>
              <span className="text-gray-400">Volume: </span>
              <span className="text-white font-mono">{selectedLevel.volume.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-400">Força: </span>
              <span className="text-white font-mono">{(selectedLevel.strength * 100).toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-400">Toques: </span>
              <span className="text-white font-mono">{selectedLevel.touches}</span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-400">Último Teste: </span>
              <span className="text-white font-mono">
                {new Date(selectedLevel.lastTest).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketContextIndicators;