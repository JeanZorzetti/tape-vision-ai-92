import React from 'react';
import { Target, TrendingUp, Shield, AlertTriangle, Zap, BarChart3, RefreshCw, WifiOff } from 'lucide-react';

export interface DecisionAnalysis {
  entryReason: string;
  variablesAnalyzed: Array<{
    name: string;
    weight: number;
    score: number;
  }>;
  componentScores: {
    buyAggression: number;
    sellAggression: number;
    liquidityAbsorption: number;
    falseOrdersDetected: number;
    flowMomentum: number;
    historicalPattern: number;
  };
  finalCertainty: number;
  nextAction: string;
  recommendation: 'ENTRAR' | 'AGUARDAR' | 'EVITAR';
}

interface DecisionPanelProps {
  analysis: DecisionAnalysis | null;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

export const DecisionPanel: React.FC<DecisionPanelProps> = ({ 
  analysis, 
  isLoading = false, 
  error = null, 
  onRefresh 
}) => {
  const getRecommendationClass = (rec: string) => {
    switch (rec) {
      case 'ENTRAR': return 'value-buy';
      case 'AGUARDAR': return 'value-accent';
      case 'EVITAR': return 'value-sell';
      default: return 'value-neutral';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-buy-primary';
    if (score >= 60) return 'text-text-accent';
    if (score >= 40) return 'text-text-secondary';
    return 'text-sell-primary';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return TrendingUp;
    if (score >= 60) return BarChart3;
    if (score >= 40) return Shield;
    return AlertTriangle;
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Target className="w-5 h-5 text-text-accent" />
            Análise de Decisão
          </h3>
          <div className="flex items-center gap-2 text-text-accent">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        </div>
        <div className="trading-card">
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-bg-tertiary rounded w-3/4"></div>
            <div className="h-4 bg-bg-tertiary rounded w-1/2"></div>
            <div className="h-4 bg-bg-tertiary rounded w-2/3"></div>
          </div>
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
            <Target className="w-5 h-5 text-text-accent" />
            Análise de Decisão
          </h3>
          <button 
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-sell-primary/20 text-sell-primary border border-sell-primary/30 hover:bg-sell-primary/30 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Tentar Novamente
          </button>
        </div>
        <div className="trading-card">
          <div className="flex items-center gap-3 text-sell-primary">
            <WifiOff className="w-5 h-5" />
            <div>
              <p className="font-medium">ML Engine Indisponível</p>
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
            <Target className="w-5 h-5 text-text-accent" />
            Análise de Decisão
          </h3>
          <button 
            onClick={onRefresh}
            className="flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-text-accent/20 text-text-accent border border-text-accent/30 hover:bg-text-accent/30 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Atualizar
          </button>
        </div>
        <div className="trading-card">
          <div className="flex items-center gap-3 text-text-secondary">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <p className="font-medium">Nenhum Dado Disponível</p>
              <p className="text-sm">Aguardando análise da ML Engine...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Target className="w-5 h-5 text-text-accent" />
          Análise de Decisão
        </h3>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button 
              onClick={onRefresh}
              className="p-1 rounded-full hover:bg-bg-tertiary transition-colors"
              title="Atualizar análise"
            >
              <RefreshCw className="w-3 h-3 text-text-secondary" />
            </button>
          )}
          <div className={`
            px-3 py-1 rounded-full text-sm font-bold
            ${analysis.recommendation === 'ENTRAR' ? 'bg-buy-primary/20 text-buy-primary border border-buy-primary/30' :
              analysis.recommendation === 'AGUARDAR' ? 'bg-text-accent/20 text-text-accent border border-text-accent/30' :
              'bg-sell-primary/20 text-sell-primary border border-sell-primary/30'}
          `}>
            {analysis.recommendation}
          </div>
        </div>
      </div>

      {/* Entry Reason */}
      <div className="trading-card">
        <h4 className="font-medium text-text-secondary mb-2">Motivo da Decisão</h4>
        <p className="text-text-primary leading-relaxed">
          {analysis.entryReason}
        </p>
      </div>

      {/* Component Scores */}
      <div className="trading-card">
        <h4 className="font-medium text-text-secondary mb-4">Scores por Componente</h4>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(analysis.componentScores).map(([key, score]) => {
            const labels: Record<string, string> = {
              buyAggression: 'Agressão Compradora',
              sellAggression: 'Agressão Vendedora',
              liquidityAbsorption: 'Absorção de Liquidez',
              falseOrdersDetected: 'Ordens Falsas',
              flowMomentum: 'Momentum de Fluxo',
              historicalPattern: 'Padrão Histórico'
            };
            
            const ScoreIcon = getScoreIcon(score);
            
            return (
              <div key={key} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-secondary">{labels[key]}</span>
                  <div className="flex items-center gap-1">
                    <ScoreIcon className={`w-3 h-3 ${getScoreColor(score)}`} />
                    <span className={`font-mono text-sm font-semibold ${getScoreColor(score)}`}>
                      {score}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-bg-tertiary rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all duration-1000 ${
                      score >= 80 ? 'bg-buy-primary' :
                      score >= 60 ? 'bg-text-accent' :
                      score >= 40 ? 'bg-text-secondary' : 'bg-sell-primary'
                    }`}
                    style={{ width: `${Math.min(score, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Variables Analyzed */}
      <div className="trading-card">
        <h4 className="font-medium text-text-secondary mb-3">
          Variáveis Analisadas ({analysis.variablesAnalyzed.length})
        </h4>
        <div className="space-y-3">
          {analysis.variablesAnalyzed.map((variable, index) => (
            <div key={index} className="flex justify-between items-center">
              <div className="flex-1">
                <span className="text-sm text-text-primary">{variable.name}</span>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-text-muted">Peso: {variable.weight}%</span>
                  <span className={`text-xs font-mono font-semibold ${getScoreColor(variable.score)}`}>
                    Score: {variable.score}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Final Certainty & Next Action */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="trading-card">
          <h4 className="font-medium text-text-secondary mb-2 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Nível de Certeza
          </h4>
          <div className={`text-2xl font-bold font-mono ${getScoreColor(analysis.finalCertainty)}`}>
            {analysis.finalCertainty}%
          </div>
          <div className="w-full bg-bg-tertiary rounded-full h-2 mt-2">
            <div 
              className={`h-2 rounded-full transition-all duration-1000 ${
                analysis.finalCertainty >= 80 ? 'bg-buy-primary glow-buy' :
                analysis.finalCertainty >= 60 ? 'bg-text-accent' :
                'bg-sell-primary'
              }`}
              style={{ width: `${Math.min(analysis.finalCertainty, 100)}%` }}
            />
          </div>
        </div>

        <div className="trading-card">
          <h4 className="font-medium text-text-secondary mb-2">Próxima Ação</h4>
          <p className="text-sm text-text-primary leading-relaxed">
            {analysis.nextAction}
          </p>
        </div>
      </div>
    </div>
  );
};