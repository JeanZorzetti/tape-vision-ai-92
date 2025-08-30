import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Zap, 
  Target,
  Shield,
  AlertTriangle,
  Clock,
  BarChart3,
  Users,
  Eye
} from 'lucide-react';

// 🔎 Fluxo de Ordens (Times & Trades)
interface OrderFlowData {
  // Agressão
  buyAggression: number;      // 0-100: Força das compras
  sellAggression: number;     // 0-100: Força das vendas
  aggressionTrend: 'increasing' | 'decreasing' | 'stable';
  
  // Sequência
  aggressionSequence: 'constant' | 'fragmented';
  
  // Volume das agressões
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  lastAggressions: Array<{
    side: 'buy' | 'sell';
    volume: number;
    price: number;
    timestamp: number;
  }>;
}

// 📊 Book de Ofertas
interface OrderBookData {
  largeLots: Array<{
    price: number;
    size: number;
    side: 'bid' | 'ask';
    isDefending: boolean;
    persistence: number; // 0-100: quanto tempo ficou no book
  }>;
  fakeOrdersDetected: number; // 0-100: % de ordens falsas
  defenseBreakouts: Array<{
    price: number;
    wasDefended: boolean;
    breakSpeed: 'fast' | 'slow';
  }>;
}

// 🧩 Contexto de Mercado  
interface MarketContextData {
  currentPrice: number;
  vwap: number;
  support: number;
  resistance: number;
  trend: 'bullish' | 'bearish' | 'sideways';
  volatility: 'high' | 'medium' | 'low';
  position: 'above_vwap' | 'below_vwap' | 'at_vwap';
}

// ⚡ Velocidade e Intensidade
interface SpeedData {
  tradesPerSecond: number;
  trendingTPS: 'accelerating' | 'decelerating' | 'stable';
  institutionalVolume: number; // % do volume total
  retailVolume: number; // % do volume total
}

// 🏦 Players Relevantes
interface InstitutionalData {
  bigPlayersActive: boolean;
  consistentPlayer: boolean;
  institutionalBias: 'buying' | 'selling' | 'neutral';
  largeOrderFlow: Array<{
    volume: number;
    side: 'buy' | 'sell';
    consistency: number; // 0-100: consistência do player
  }>;
}

// 🧱 Absorção e Exaustão
interface AbsorptionData {
  hasAbsorption: boolean;
  absorptionLevel: number; // 0-100: força da absorção
  hasExhaustion: boolean;
  exhaustionLevel: number; // 0-100: nível de exaustão
  absorptionPrice: number;
}

// 🎯 Padrões Favoráveis
interface PatternData {
  pullbackWithDefense: boolean;
  breakoutWithAggression: boolean;
  fakeOrderRemoval: boolean;
  patternStrength: number; // 0-100: força do padrão
  favorableSetup: 'buy' | 'sell' | 'none';
}

interface OrderFlowAnalysis {
  orderFlow: OrderFlowData;
  orderBook: OrderBookData;
  marketContext: MarketContextData;
  speed: SpeedData;
  institutional: InstitutionalData;
  absorption: AbsorptionData;
  patterns: PatternData;
  overallScore: number; // 0-100: score geral do setup
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;
  lastUpdate: string;
}

interface OrderFlowPanelProps {
  analysis: OrderFlowAnalysis | null;
  isLoading?: boolean;
  error?: string | null;
}

export const OrderFlowPanel: React.FC<OrderFlowPanelProps> = ({ 
  analysis, 
  isLoading = false, 
  error = null 
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-text-accent" />
            Order Flow Analysis
          </h3>
          <div className="animate-pulse">
            <div className="w-16 h-6 bg-bg-tertiary rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="trading-card animate-pulse">
              <div className="h-4 bg-bg-tertiary rounded w-3/4 mb-3"></div>
              <div className="space-y-2">
                <div className="h-3 bg-bg-tertiary rounded w-full"></div>
                <div className="h-3 bg-bg-tertiary rounded w-2/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-text-accent" />
            Order Flow Analysis
          </h3>
        </div>
        <div className="trading-card">
          <div className="flex items-center gap-3 text-sell-primary">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <p className="font-medium">Order Flow Indisponível</p>
              <p className="text-sm text-text-secondary mt-1">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No data state
  if (!analysis) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Activity className="w-5 h-5 text-text-accent" />
            Order Flow Analysis
          </h3>
        </div>
        <div className="trading-card">
          <div className="flex items-center gap-3 text-text-secondary">
            <Eye className="w-5 h-5" />
            <div>
              <p className="font-medium">Aguardando Dados de Fluxo</p>
              <p className="text-sm">Conecte-se à API para análise em tempo real</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-buy-primary';
    if (score >= 60) return 'text-text-accent';
    if (score >= 40) return 'text-text-secondary';
    return 'text-sell-primary';
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'STRONG_BUY': return 'bg-buy-primary/20 text-buy-primary border-buy-primary/30';
      case 'BUY': return 'bg-buy-primary/10 text-buy-primary border-buy-primary/20';
      case 'HOLD': return 'bg-text-accent/20 text-text-accent border-text-accent/30';
      case 'SELL': return 'bg-sell-primary/10 text-sell-primary border-sell-primary/20';
      case 'STRONG_SELL': return 'bg-sell-primary/20 text-sell-primary border-sell-primary/30';
      default: return 'bg-text-secondary/20 text-text-secondary border-text-secondary/30';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Activity className="w-5 h-5 text-text-accent" />
          Order Flow Analysis
        </h3>
        <div className="flex items-center gap-3">
          <div className={`text-2xl font-bold font-mono ${getScoreColor(analysis.overallScore)}`}>
            {analysis.overallScore}
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold border ${getRecommendationColor(analysis.recommendation)}`}>
            {analysis.recommendation}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 🔎 Fluxo de Ordens */}
        <div className="trading-card">
          <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            🔎 Fluxo de Ordens
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Agressão Compradora</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-bg-tertiary rounded-full h-2">
                  <div 
                    className="h-2 bg-buy-primary rounded-full"
                    style={{ width: `${analysis.orderFlow.buyAggression}%` }}
                  />
                </div>
                <span className={`text-sm font-mono font-semibold ${getScoreColor(analysis.orderFlow.buyAggression)}`}>
                  {analysis.orderFlow.buyAggression}%
                </span>
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm">Agressão Vendedora</span>
              <div className="flex items-center gap-2">
                <div className="w-20 bg-bg-tertiary rounded-full h-2">
                  <div 
                    className="h-2 bg-sell-primary rounded-full"
                    style={{ width: `${analysis.orderFlow.sellAggression}%` }}
                  />
                </div>
                <span className={`text-sm font-mono font-semibold ${getScoreColor(analysis.orderFlow.sellAggression)}`}>
                  {analysis.orderFlow.sellAggression}%
                </span>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span>Sequência:</span>
              <span className={analysis.orderFlow.aggressionSequence === 'constant' ? 'text-buy-primary' : 'text-text-accent'}>
                {analysis.orderFlow.aggressionSequence === 'constant' ? '📈 Constante' : '📊 Fragmentada'}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Volume:</span>
              <span className={
                analysis.orderFlow.volumeTrend === 'increasing' ? 'text-buy-primary' : 
                analysis.orderFlow.volumeTrend === 'decreasing' ? 'text-sell-primary' : 'text-text-secondary'
              }>
                {analysis.orderFlow.volumeTrend === 'increasing' ? '⬆️ Aumentando' : 
                 analysis.orderFlow.volumeTrend === 'decreasing' ? '⬇️ Diminuindo' : '➡️ Estável'}
              </span>
            </div>
          </div>
        </div>

        {/* 📊 Book de Ofertas */}
        <div className="trading-card">
          <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            📊 Book de Ofertas
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Lotes Grandes</span>
              <span className="text-sm font-mono">
                {analysis.orderBook.largeLots.length} detectados
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm">Ordens Falsas</span>
              <span className={`text-sm font-mono font-semibold ${getScoreColor(100 - analysis.orderBook.fakeOrdersDetected)}`}>
                {analysis.orderBook.fakeOrdersDetected}%
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Defesas:</span>
              <span className="text-text-accent">
                {analysis.orderBook.defenseBreakouts.filter(d => d.wasDefended).length} ativas
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Rompimentos:</span>
              <span className="text-buy-primary">
                {analysis.orderBook.defenseBreakouts.filter(d => !d.wasDefended).length} confirmados
              </span>
            </div>
          </div>
        </div>

        {/* 🧩 Contexto de Mercado */}
        <div className="trading-card">
          <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
            <Target className="w-4 h-4" />
            🧩 Contexto de Mercado
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">vs VWAP</span>
              <span className={`text-sm font-semibold ${
                analysis.marketContext.position === 'above_vwap' ? 'text-buy-primary' :
                analysis.marketContext.position === 'below_vwap' ? 'text-sell-primary' : 'text-text-accent'
              }`}>
                {analysis.marketContext.position === 'above_vwap' ? '⬆️ Acima' :
                 analysis.marketContext.position === 'below_vwap' ? '⬇️ Abaixo' : '➡️ No VWAP'}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Tendência:</span>
              <span className={
                analysis.marketContext.trend === 'bullish' ? 'text-buy-primary' :
                analysis.marketContext.trend === 'bearish' ? 'text-sell-primary' : 'text-text-accent'
              }>
                {analysis.marketContext.trend === 'bullish' ? '📈 Alta' :
                 analysis.marketContext.trend === 'bearish' ? '📉 Baixa' : '↔️ Lateral'}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Volatilidade:</span>
              <span className={
                analysis.marketContext.volatility === 'high' ? 'text-sell-primary' :
                analysis.marketContext.volatility === 'medium' ? 'text-text-accent' : 'text-buy-primary'
              }>
                {analysis.marketContext.volatility === 'high' ? '🔥 Alta' :
                 analysis.marketContext.volatility === 'medium' ? '⚡ Média' : '🟢 Baixa'}
              </span>
            </div>
          </div>
        </div>

        {/* ⚡ Velocidade e Intensidade */}
        <div className="trading-card">
          <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            ⚡ Velocidade e Intensidade
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Trades/Segundo</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono font-semibold">
                  {analysis.speed.tradesPerSecond.toFixed(1)}
                </span>
                <span className={`text-xs ${
                  analysis.speed.trendingTPS === 'accelerating' ? 'text-buy-primary' :
                  analysis.speed.trendingTPS === 'decelerating' ? 'text-sell-primary' : 'text-text-accent'
                }`}>
                  {analysis.speed.trendingTPS === 'accelerating' ? '⬆️' :
                   analysis.speed.trendingTPS === 'decelerating' ? '⬇️' : '➡️'}
                </span>
              </div>
            </div>

            <div className="flex justify-between text-sm">
              <span>Volume Institucional:</span>
              <span className={`font-mono font-semibold ${getScoreColor(analysis.speed.institutionalVolume)}`}>
                {analysis.speed.institutionalVolume}%
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Volume Varejo:</span>
              <span className="text-text-secondary font-mono">
                {analysis.speed.retailVolume}%
              </span>
            </div>
          </div>
        </div>

        {/* 🏦 Players Relevantes */}
        <div className="trading-card">
          <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            🏦 Players Relevantes
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Big Players</span>
              <span className={`text-sm ${analysis.institutional.bigPlayersActive ? 'text-buy-primary' : 'text-text-secondary'}`}>
                {analysis.institutional.bigPlayersActive ? '✅ Ativos' : '❌ Inativos'}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Consistência:</span>
              <span className={analysis.institutional.consistentPlayer ? 'text-buy-primary' : 'text-text-accent'}>
                {analysis.institutional.consistentPlayer ? '🎯 Alta' : '🔄 Baixa'}
              </span>
            </div>

            <div className="flex justify-between text-sm">
              <span>Bias Institucional:</span>
              <span className={
                analysis.institutional.institutionalBias === 'buying' ? 'text-buy-primary' :
                analysis.institutional.institutionalBias === 'selling' ? 'text-sell-primary' : 'text-text-accent'
              }>
                {analysis.institutional.institutionalBias === 'buying' ? '🟢 Compra' :
                 analysis.institutional.institutionalBias === 'selling' ? '🔴 Venda' : '⚪ Neutro'}
              </span>
            </div>
          </div>
        </div>

        {/* 🧱 Absorção e Exaustão */}
        <div className="trading-card">
          <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            🧱 Absorção e Exaustão
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm">Absorção</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${analysis.absorption.hasAbsorption ? 'text-buy-primary' : 'text-text-secondary'}`}>
                  {analysis.absorption.hasAbsorption ? '🛡️ Detectada' : '❌ Não'}
                </span>
                {analysis.absorption.hasAbsorption && (
                  <span className={`text-xs font-mono font-semibold ${getScoreColor(analysis.absorption.absorptionLevel)}`}>
                    {analysis.absorption.absorptionLevel}%
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm">Exaustão</span>
              <div className="flex items-center gap-2">
                <span className={`text-sm ${analysis.absorption.hasExhaustion ? 'text-sell-primary' : 'text-text-secondary'}`}>
                  {analysis.absorption.hasExhaustion ? '🔥 Detectada' : '❌ Não'}
                </span>
                {analysis.absorption.hasExhaustion && (
                  <span className={`text-xs font-mono font-semibold ${getScoreColor(100 - analysis.absorption.exhaustionLevel)}`}>
                    {analysis.absorption.exhaustionLevel}%
                  </span>
                )}
              </div>
            </div>

            {analysis.absorption.hasAbsorption && (
              <div className="text-xs text-text-secondary">
                📍 Nível: {analysis.absorption.absorptionPrice.toFixed(0)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🎯 Padrões Favoráveis */}
      <div className="trading-card">
        <h4 className="font-medium text-text-secondary mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          🎯 Padrões Favoráveis
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
              analysis.patterns.pullbackWithDefense ? 'bg-buy-primary/20 text-buy-primary' : 'bg-bg-tertiary text-text-secondary'
            }`}>
              <TrendingDown className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <div className="font-medium">Pullback com Defesa</div>
              <div className={analysis.patterns.pullbackWithDefense ? 'text-buy-primary' : 'text-text-secondary'}>
                {analysis.patterns.pullbackWithDefense ? '✅ Ativo' : '❌ Inativo'}
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
              analysis.patterns.breakoutWithAggression ? 'bg-buy-primary/20 text-buy-primary' : 'bg-bg-tertiary text-text-secondary'
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <div className="font-medium">Rompimento com Agressão</div>
              <div className={analysis.patterns.breakoutWithAggression ? 'text-buy-primary' : 'text-text-secondary'}>
                {analysis.patterns.breakoutWithAggression ? '✅ Ativo' : '❌ Inativo'}
              </div>
            </div>
          </div>

          <div className="text-center">
            <div className={`w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center ${
              analysis.patterns.fakeOrderRemoval ? 'bg-sell-primary/20 text-sell-primary' : 'bg-bg-tertiary text-text-secondary'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-xs">
              <div className="font-medium">Ordem Falsa Removida</div>
              <div className={analysis.patterns.fakeOrderRemoval ? 'text-sell-primary' : 'text-text-secondary'}>
                {analysis.patterns.fakeOrderRemoval ? '⚠️ Detectado' : '❌ Normal'}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-between items-center">
          <span className="text-sm text-text-secondary">Setup Favorável:</span>
          <div className="flex items-center gap-2">
            <span className={`font-semibold ${
              analysis.patterns.favorableSetup === 'buy' ? 'text-buy-primary' :
              analysis.patterns.favorableSetup === 'sell' ? 'text-sell-primary' : 'text-text-secondary'
            }`}>
              {analysis.patterns.favorableSetup === 'buy' ? '🟢 COMPRA' :
               analysis.patterns.favorableSetup === 'sell' ? '🔴 VENDA' : '⚪ NEUTRO'}
            </span>
            <span className={`text-sm font-mono font-semibold ${getScoreColor(analysis.patterns.patternStrength)}`}>
              ({analysis.patterns.patternStrength}%)
            </span>
          </div>
        </div>
      </div>

      {/* Overall Confidence */}
      <div className="trading-card">
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm text-text-secondary">Confiança Geral</div>
            <div className="text-xs text-text-muted">Última atualização: {analysis.lastUpdate}</div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-bold font-mono ${getScoreColor(analysis.confidence)}`}>
              {analysis.confidence}%
            </div>
            <div className="w-32 bg-bg-tertiary rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full transition-all duration-1000 ${
                  analysis.confidence >= 80 ? 'bg-buy-primary glow-buy' :
                  analysis.confidence >= 60 ? 'bg-text-accent' : 'bg-sell-primary'
                }`}
                style={{ width: `${analysis.confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};