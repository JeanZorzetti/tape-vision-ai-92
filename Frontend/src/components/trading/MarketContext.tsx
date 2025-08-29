import React from 'react';
import { TrendingUp, Volume2, Clock, DollarSign, Activity, AlertTriangle, Bot, Target } from 'lucide-react';
import { DataCard } from './DataCard';
import { DecisionAnalysis } from '@/types/trading';

export interface MarketData {
  price: number;
  priceChange: number;
  volume: number;
  volatility: number;
  spread: number;
  sessionTime: string;
  marketPhase: 'pre-market' | 'open' | 'close' | 'after-hours';
  liquidityLevel: 'low' | 'medium' | 'high';
  orderBookImbalance: number; // -100 to 100 (negative = sell pressure)
}

interface MarketContextProps {
  marketData: MarketData;
  decisionAnalysis?: DecisionAnalysis | null;
  mlEngineError?: string | null;
}

export const MarketContext: React.FC<MarketContextProps> = ({ 
  marketData, 
  decisionAnalysis, 
  mlEngineError 
}) => {
  const getPhaseConfig = (phase: MarketData['marketPhase']) => {
    switch (phase) {
      case 'pre-market':
        return { text: 'Pré-Abertura', className: 'status-warning' };
      case 'open':
        return { text: 'Mercado Aberto', className: 'status-active' };
      case 'close':
        return { text: 'Fechamento', className: 'status-warning' };
      case 'after-hours':
        return { text: 'Após Fechamento', className: 'status-danger' };
    }
  };

  const getLiquidityColor = (level: string) => {
    switch (level) {
      case 'high': return 'buy';
      case 'medium': return 'accent';
      case 'low': return 'sell';
      default: return 'neutral';
    }
  };

  const getImbalanceType = (imbalance: number) => {
    if (imbalance > 20) return { type: 'buy', text: 'Pressão Compradora' };
    if (imbalance < -20) return { type: 'sell', text: 'Pressão Vendedora' };
    return { type: 'neutral', text: 'Equilibrado' };
  };

  const formatPrice = (price: number) => price.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(0)}K`;
    return volume.toString();
  };

  const phaseConfig = getPhaseConfig(marketData.marketPhase);
  const imbalanceData = getImbalanceType(marketData.orderBookImbalance);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-text-info" />
          Contexto de Mercado
        </h3>
        <div className={phaseConfig.className}>
          <Clock className="w-4 h-4" />
          <span>{phaseConfig.text}</span>
        </div>
      </div>

      {/* Main Price Display */}
      <div className="trading-card">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">Mini Dólar (WDO)</span>
          <span className="text-xs font-mono text-text-info">{marketData.sessionTime}</span>
        </div>
        
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono text-text-primary">
            {formatPrice(marketData.price)}
          </span>
          <span className={`
            text-lg font-mono font-semibold
            ${marketData.priceChange >= 0 ? 'value-buy' : 'value-sell'}
          `}>
            {marketData.priceChange >= 0 ? '+' : ''}{formatPrice(marketData.priceChange)}
          </span>
        </div>
      </div>

      {/* Market Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataCard
          title="Volume"
          value={formatVolume(marketData.volume)}
          type="accent"
          trend={marketData.volume > 100000 ? 'up' : 'neutral'}
          icon={Volume2}
        />
        
        <DataCard
          title="Liquidez"
          value={marketData.liquidityLevel.toUpperCase()}
          type={getLiquidityColor(marketData.liquidityLevel)}
          icon={Activity}
        />
        
        <DataCard
          title="Volatilidade"
          value={marketData.volatility.toFixed(2)}
          unit="%"
          type={marketData.volatility > 2 ? 'sell' : 'buy'}
          trend={marketData.volatility > 2 ? 'up' : 'down'}
          icon={TrendingUp}
        />
        
        <DataCard
          title="Spread"
          value={marketData.spread.toFixed(0)}
          unit="pts"
          type={marketData.spread > 5 ? 'sell' : 'buy'}
          icon={DollarSign}
        />
      </div>

      {/* Order Book Imbalance */}
      <div className="trading-card">
        <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Desequilíbrio do Book
        </h4>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-secondary">{imbalanceData.text}</span>
            <span className={`
              font-mono font-semibold
              ${imbalanceData.type === 'buy' ? 'value-buy' : 
                imbalanceData.type === 'sell' ? 'value-sell' : 'value-neutral'}
            `}>
              {Math.abs(marketData.orderBookImbalance)}%
            </span>
          </div>
          
          <div className="relative">
            <div className="w-full bg-bg-tertiary rounded-full h-3">
              <div 
                className={`h-3 rounded-full transition-all duration-1000 ${
                  marketData.orderBookImbalance > 0 ? 'bg-buy-primary' : 'bg-sell-primary'
                }`}
                style={{ 
                  width: `${Math.abs(marketData.orderBookImbalance)}%`,
                  marginLeft: marketData.orderBookImbalance < 0 ? `${100 - Math.abs(marketData.orderBookImbalance)}%` : '0'
                }}
              />
            </div>
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-0.5 h-3 bg-text-secondary opacity-50" />
          </div>
          
          <div className="flex justify-between text-xs text-text-muted">
            <span>Venda</span>
            <span>Equilíbrio</span>
            <span>Compra</span>
          </div>
        </div>
      </div>

      {/* Market Alerts - Smart ML-Based */}
      <div className="trading-card">
        <h4 className="font-medium text-text-secondary mb-2">Alertas de Mercado</h4>
        <div className="space-y-2">
          {/* ML Engine Status Alert */}
          {mlEngineError ? (
            <div className="flex items-center gap-2 text-sm text-sell-primary">
              <AlertTriangle className="w-3 h-3" />
              <span>ML Engine desconectado - alertas limitados</span>
            </div>
          ) : decisionAnalysis ? (
            <div className="flex items-center gap-2 text-sm text-buy-primary">
              <Bot className="w-3 h-3" />
              <span>IA ativa - confiança {decisionAnalysis.finalCertainty}%</span>
            </div>
          ) : null}

          {/* High Confidence ML Signal */}
          {decisionAnalysis && decisionAnalysis.finalCertainty >= 80 && (
            <div className="flex items-center gap-2 text-sm text-buy-primary">
              <div className="w-2 h-2 rounded-full bg-buy-primary pulse-buy" />
              <span>
                Sinal forte: {decisionAnalysis.recommendation} 
                ({decisionAnalysis.finalCertainty}% confiança)
              </span>
            </div>
          )}

          {/* Strong Buy Aggression from ML */}
          {decisionAnalysis && decisionAnalysis.componentScores.buyAggression >= 80 && (
            <div className="flex items-center gap-2 text-sm text-buy-primary">
              <Target className="w-3 h-3" />
              <span>
                Alta agressão compradora detectada 
                ({decisionAnalysis.componentScores.buyAggression}%)
              </span>
            </div>
          )}

          {/* Strong Sell Aggression from ML */}
          {decisionAnalysis && decisionAnalysis.componentScores.sellAggression >= 80 && (
            <div className="flex items-center gap-2 text-sm text-sell-primary">
              <Target className="w-3 h-3" />
              <span>
                Alta agressão vendedora detectada 
                ({decisionAnalysis.componentScores.sellAggression}%)
              </span>
            </div>
          )}

          {/* False Orders Detection */}
          {decisionAnalysis && decisionAnalysis.componentScores.falseOrdersDetected >= 60 && (
            <div className="flex items-center gap-2 text-sm text-text-accent">
              <AlertTriangle className="w-3 h-3" />
              <span>
                Ordens falsas detectadas 
                ({decisionAnalysis.componentScores.falseOrdersDetected}%)
              </span>
            </div>
          )}

          {/* Market Data Based Alerts (Fallback) */}
          {marketData.volatility > 3 && (
            <div className="flex items-center gap-2 text-sm text-sell-primary">
              <div className="w-2 h-2 rounded-full bg-sell-primary pulse-sell" />
              <span>Alta volatilidade detectada ({marketData.volatility.toFixed(1)}%)</span>
            </div>
          )}
          
          {marketData.liquidityLevel === 'low' && (
            <div className="flex items-center gap-2 text-sm text-text-accent">
              <div className="w-2 h-2 rounded-full bg-text-accent" />
              <span>Baixa liquidez - cuidado com slippage</span>
            </div>
          )}
          
          {Math.abs(marketData.orderBookImbalance) > 50 && (
            <div className="flex items-center gap-2 text-sm text-buy-primary">
              <div className="w-2 h-2 rounded-full bg-buy-primary pulse-buy" />
              <span>Forte desequilíbrio no order book ({Math.abs(marketData.orderBookImbalance)}%)</span>
            </div>
          )}
          
          {marketData.spread > 10 && (
            <div className="flex items-center gap-2 text-sm text-sell-primary">
              <div className="w-2 h-2 rounded-full bg-sell-primary" />
              <span>Spread elevado - impacto nos custos ({marketData.spread} pts)</span>
            </div>
          )}

          {/* No Alerts State */}
          {!mlEngineError && 
           !decisionAnalysis && 
           marketData.volatility <= 3 && 
           marketData.liquidityLevel !== 'low' && 
           Math.abs(marketData.orderBookImbalance) <= 50 && 
           marketData.spread <= 10 && (
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <div className="w-2 h-2 rounded-full bg-text-secondary" />
              <span>Nenhum alerta no momento - mercado estável</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};