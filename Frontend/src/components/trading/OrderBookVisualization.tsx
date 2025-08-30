import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Shield, Eye, Trash2 } from 'lucide-react';

interface OrderBookLevel {
  price: number;
  volume: number;
  orders: number;
  isLarge: boolean;
  isFake?: boolean;
  isDefense?: boolean;
  timestamp: number;
}

interface OrderBookData {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPercentage: number;
  totalBidVolume: number;
  totalAskVolume: number;
  imbalanceRatio: number;
  largeOrderThreshold: number;
  fakeOrdersDetected: number;
  defenseLevel: number;
}

interface OrderBookAnalysis {
  liquidityAnalysis: {
    totalLiquidity: number;
    bidLiquidity: number;
    askLiquidity: number;
    imbalance: 'BUY' | 'SELL' | 'NEUTRAL';
    imbalanceStrength: number;
  };
  largeOrders: {
    bigBids: OrderBookLevel[];
    bigAsks: OrderBookLevel[];
    totalBigVolume: number;
  };
  fakeOrders: {
    suspiciousBids: OrderBookLevel[];
    suspiciousAsks: OrderBookLevel[];
    fakeOrderScore: number;
  };
  defenseAnalysis: {
    bidDefense: number;
    askDefense: number;
    strongestDefenseLevel: number;
    defenseType: 'BID_DEFENSE' | 'ASK_DEFENSE' | 'NEUTRAL';
  };
}

const OrderBookVisualization: React.FC = () => {
  const [orderBookData, setOrderBookData] = useState<OrderBookData | null>(null);
  const [analysis, setAnalysis] = useState<OrderBookAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<OrderBookLevel | null>(null);

  // Simulate real-time order book data
  useEffect(() => {
    const generateOrderBookData = (): OrderBookData => {
      const currentPrice = 4580.25 + (Math.random() - 0.5) * 10;
      const spread = 0.25 + Math.random() * 0.75;
      
      const generateLevels = (isAsk: boolean, count: number = 10): OrderBookLevel[] => {
        return Array.from({ length: count }, (_, i) => {
          const price = isAsk 
            ? currentPrice + spread + (i * 0.25)
            : currentPrice - (i * 0.25);
          const baseVolume = Math.floor(Math.random() * 500) + 50;
          const volume = Math.random() > 0.8 ? baseVolume * (2 + Math.random() * 8) : baseVolume;
          const orders = Math.floor(volume / 50) + Math.floor(Math.random() * 10);
          
          return {
            price,
            volume,
            orders,
            isLarge: volume > 1000,
            isFake: Math.random() > 0.95,
            isDefense: Math.random() > 0.9 && volume > 800,
            timestamp: Date.now()
          };
        });
      };

      const bids = generateLevels(false).sort((a, b) => b.price - a.price);
      const asks = generateLevels(true).sort((a, b) => a.price - b.price);
      
      const totalBidVolume = bids.reduce((sum, level) => sum + level.volume, 0);
      const totalAskVolume = asks.reduce((sum, level) => sum + level.volume, 0);
      const imbalanceRatio = totalBidVolume / (totalBidVolume + totalAskVolume);

      return {
        bids,
        asks,
        spread,
        spreadPercentage: (spread / currentPrice) * 100,
        totalBidVolume,
        totalAskVolume,
        imbalanceRatio,
        largeOrderThreshold: 1000,
        fakeOrdersDetected: bids.concat(asks).filter(l => l.isFake).length,
        defenseLevel: Math.max(...bids.concat(asks).filter(l => l.isDefense).map(l => l.volume))
      };
    };

    const analyzeOrderBook = (data: OrderBookData): OrderBookAnalysis => {
      const totalLiquidity = data.totalBidVolume + data.totalAskVolume;
      const imbalanceStrength = Math.abs(data.imbalanceRatio - 0.5) * 2;
      
      let imbalance: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
      if (data.imbalanceRatio > 0.6) imbalance = 'BUY';
      else if (data.imbalanceRatio < 0.4) imbalance = 'SELL';

      const bigBids = data.bids.filter(l => l.isLarge);
      const bigAsks = data.asks.filter(l => l.isLarge);
      
      const suspiciousBids = data.bids.filter(l => l.isFake);
      const suspiciousAsks = data.asks.filter(l => l.isFake);
      
      const bidDefense = Math.max(...data.bids.filter(l => l.isDefense).map(l => l.volume), 0);
      const askDefense = Math.max(...data.asks.filter(l => l.isDefense).map(l => l.volume), 0);

      return {
        liquidityAnalysis: {
          totalLiquidity,
          bidLiquidity: data.totalBidVolume,
          askLiquidity: data.totalAskVolume,
          imbalance,
          imbalanceStrength
        },
        largeOrders: {
          bigBids,
          bigAsks,
          totalBigVolume: bigBids.concat(bigAsks).reduce((sum, l) => sum + l.volume, 0)
        },
        fakeOrders: {
          suspiciousBids,
          suspiciousAsks,
          fakeOrderScore: (suspiciousBids.length + suspiciousAsks.length) / (data.bids.length + data.asks.length)
        },
        defenseAnalysis: {
          bidDefense,
          askDefense,
          strongestDefenseLevel: Math.max(bidDefense, askDefense),
          defenseType: bidDefense > askDefense ? 'BID_DEFENSE' : askDefense > bidDefense ? 'ASK_DEFENSE' : 'NEUTRAL'
        }
      };
    };

    const updateData = () => {
      const data = generateOrderBookData();
      const analysisData = analyzeOrderBook(data);
      
      setOrderBookData(data);
      setAnalysis(analysisData);
      setIsLoading(false);
    };

    updateData();
    const interval = setInterval(updateData, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => price.toFixed(2);
  const formatVolume = (volume: number) => volume.toLocaleString();

  const getVolumeBarWidth = (volume: number, maxVolume: number) => {
    return Math.min((volume / maxVolume) * 100, 100);
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-gray-800 rounded w-48"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-800 rounded"></div>
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-800 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!orderBookData || !analysis) return null;

  const maxVolume = Math.max(
    ...orderBookData.bids.map(l => l.volume),
    ...orderBookData.asks.map(l => l.volume)
  );

  return (
    <div className="space-y-4">
      {/* Header with Analysis Summary */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">📊 Book de Ofertas</h3>
        <div className="flex items-center gap-4 text-sm">
          <div className={`px-2 py-1 rounded ${
            analysis.liquidityAnalysis.imbalance === 'BUY' ? 'bg-buy-primary/20 text-buy-primary' :
            analysis.liquidityAnalysis.imbalance === 'SELL' ? 'bg-sell-primary/20 text-sell-primary' :
            'bg-gray-700 text-gray-300'
          }`}>
            {analysis.liquidityAnalysis.imbalance === 'BUY' ? '📈 Pressão Compra' :
             analysis.liquidityAnalysis.imbalance === 'SELL' ? '📉 Pressão Venda' :
             '⚖️ Equilibrado'}
          </div>
          <div className="text-gray-300">
            Spread: {formatPrice(orderBookData.spread)} ({orderBookData.spreadPercentage.toFixed(3)}%)
          </div>
        </div>
      </div>

      {/* Order Book Metrics */}
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-gray-400">Liquidez Total</div>
          <div className="text-white font-mono">{formatVolume(analysis.liquidityAnalysis.totalLiquidity)}</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-gray-400">Ordens Grandes</div>
          <div className="text-white font-mono">{analysis.largeOrders.bigBids.length + analysis.largeOrders.bigAsks.length}</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-gray-400 flex items-center gap-1">
            <AlertTriangle size={12} />
            Ordens Falsas
          </div>
          <div className="text-orange-400 font-mono">{orderBookData.fakeOrdersDetected}</div>
        </div>
        <div className="bg-gray-800 p-3 rounded">
          <div className="text-gray-400 flex items-center gap-1">
            <Shield size={12} />
            Defesa Max
          </div>
          <div className="text-blue-400 font-mono">{formatVolume(analysis.defenseAnalysis.strongestDefenseLevel)}</div>
        </div>
      </div>

      {/* Order Book Display */}
      <div className="grid grid-cols-2 gap-4">
        {/* Asks (Sell Orders) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm text-gray-400 pb-2 border-b border-gray-700">
            <span>Preço</span>
            <span>Volume</span>
            <span>Ordens</span>
          </div>
          {orderBookData.asks.slice(0, 10).reverse().map((level, index) => (
            <div
              key={`ask-${index}`}
              className={`relative flex items-center justify-between p-2 rounded text-sm cursor-pointer hover:bg-gray-700/50 ${
                level.isLarge ? 'border-l-2 border-yellow-400' : ''
              } ${
                level.isFake ? 'border-r-2 border-orange-400' : ''
              } ${
                level.isDefense ? 'border-r-2 border-blue-400' : ''
              }`}
              onClick={() => setSelectedLevel(level)}
            >
              <div
                className="absolute inset-0 bg-sell-primary/10"
                style={{ width: `${getVolumeBarWidth(level.volume, maxVolume)}%` }}
              />
              <div className="relative flex items-center justify-between w-full">
                <span className="text-sell-primary font-mono">{formatPrice(level.price)}</span>
                <span className="text-white font-mono flex items-center gap-1">
                  {formatVolume(level.volume)}
                  {level.isLarge && <Eye size={12} className="text-yellow-400" />}
                  {level.isFake && <AlertTriangle size={12} className="text-orange-400" />}
                  {level.isDefense && <Shield size={12} className="text-blue-400" />}
                </span>
                <span className="text-gray-400 font-mono">{level.orders}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Bids (Buy Orders) */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm text-gray-400 pb-2 border-b border-gray-700">
            <span>Preço</span>
            <span>Volume</span>
            <span>Ordens</span>
          </div>
          {orderBookData.bids.slice(0, 10).map((level, index) => (
            <div
              key={`bid-${index}`}
              className={`relative flex items-center justify-between p-2 rounded text-sm cursor-pointer hover:bg-gray-700/50 ${
                level.isLarge ? 'border-l-2 border-yellow-400' : ''
              } ${
                level.isFake ? 'border-r-2 border-orange-400' : ''
              } ${
                level.isDefense ? 'border-r-2 border-blue-400' : ''
              }`}
              onClick={() => setSelectedLevel(level)}
            >
              <div
                className="absolute inset-0 bg-buy-primary/10"
                style={{ width: `${getVolumeBarWidth(level.volume, maxVolume)}%` }}
              />
              <div className="relative flex items-center justify-between w-full">
                <span className="text-buy-primary font-mono">{formatPrice(level.price)}</span>
                <span className="text-white font-mono flex items-center gap-1">
                  {formatVolume(level.volume)}
                  {level.isLarge && <Eye size={12} className="text-yellow-400" />}
                  {level.isFake && <AlertTriangle size={12} className="text-orange-400" />}
                  {level.isDefense && <Shield size={12} className="text-blue-400" />}
                </span>
                <span className="text-gray-400 font-mono">{level.orders}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-gray-400 border-t border-gray-700 pt-4">
        <div className="flex items-center gap-1">
          <Eye size={12} className="text-yellow-400" />
          <span>Grande (>{formatVolume(orderBookData.largeOrderThreshold)})</span>
        </div>
        <div className="flex items-center gap-1">
          <AlertTriangle size={12} className="text-orange-400" />
          <span>Suspeita</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield size={12} className="text-blue-400" />
          <span>Defesa</span>
        </div>
      </div>

      {/* Selected Level Details */}
      {selectedLevel && (
        <div className="bg-gray-800 p-4 rounded border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-medium">Detalhes do Nível</h4>
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
              <span className="text-white font-mono">{formatVolume(selectedLevel.volume)}</span>
            </div>
            <div>
              <span className="text-gray-400">Ordens: </span>
              <span className="text-white font-mono">{selectedLevel.orders}</span>
            </div>
            <div>
              <span className="text-gray-400">Volume Médio: </span>
              <span className="text-white font-mono">{formatVolume(Math.round(selectedLevel.volume / selectedLevel.orders))}</span>
            </div>
          </div>
          {(selectedLevel.isLarge || selectedLevel.isFake || selectedLevel.isDefense) && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <div className="flex flex-wrap gap-2">
                {selectedLevel.isLarge && (
                  <span className="px-2 py-1 bg-yellow-400/20 text-yellow-400 rounded text-xs">
                    Ordem Grande
                  </span>
                )}
                {selectedLevel.isFake && (
                  <span className="px-2 py-1 bg-orange-400/20 text-orange-400 rounded text-xs">
                    Possível Ordem Falsa
                  </span>
                )}
                {selectedLevel.isDefense && (
                  <span className="px-2 py-1 bg-blue-400/20 text-blue-400 rounded text-xs">
                    Nível de Defesa
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrderBookVisualization;