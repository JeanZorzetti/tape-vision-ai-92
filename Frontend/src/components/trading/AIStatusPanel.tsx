import React from 'react';
import { Brain, Activity, Clock, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { ConfidenceGauge } from './ConfidenceGauge';
import { DataCard } from './DataCard';
import { BackendStatus } from '../dashboard/BackendStatus';

export interface AIStatus {
  confidence: number;
  status: 'active' | 'paused' | 'error' | 'analyzing';
  lastAnalysis: string;
  patternsDetected: string[];
  marketContext: string;
  entrySignals: number;
  aggressionLevel: 'low' | 'medium' | 'high';
  hiddenLiquidity: boolean;
}

interface AIStatusPanelProps {
  aiStatus: AIStatus;
}

export const AIStatusPanel: React.FC<AIStatusPanelProps> = ({ aiStatus }) => {
  const getStatusConfig = (status: AIStatus['status']) => {
    switch (status) {
      case 'active':
        return {
          icon: CheckCircle,
          className: 'status-active',
          text: 'Sistema Ativo'
        };
      case 'analyzing':
        return {
          icon: Activity,
          className: 'status-warning',
          text: 'Analisando...'
        };
      case 'paused':
        return {
          icon: Clock,
          className: 'status-warning',
          text: 'Pausado'
        };
      case 'error':
        return {
          icon: AlertCircle,
          className: 'status-danger',
          text: 'Erro no Sistema'
        };
    }
  };

  const statusConfig = getStatusConfig(aiStatus.status);
  const StatusIcon = statusConfig.icon;

  const getAggressionColor = (level: string) => {
    switch (level) {
      case 'high': return 'sell';
      case 'medium': return 'accent';
      case 'low': return 'buy';
      default: return 'neutral';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Brain className="w-5 h-5 text-buy-primary" />
          Status da IA
        </h3>
        <div className={statusConfig.className}>
          <StatusIcon className="w-4 h-4" />
          <span>{statusConfig.text}</span>
        </div>
      </div>

      {/* Confidence Gauge */}
      <div className="trading-card">
        <ConfidenceGauge 
          confidence={aiStatus.confidence}
          threshold={90}
          size="lg"
        />
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <DataCard
          title="Sinais de Entrada"
          value={aiStatus.entrySignals}
          type={aiStatus.entrySignals > 0 ? 'buy' : 'neutral'}
          trend={aiStatus.entrySignals > 0 ? 'up' : 'neutral'}
          icon={TrendingUp}
        />
        
        <DataCard
          title="Nível de Agressão"
          value={aiStatus.aggressionLevel.toUpperCase()}
          type={getAggressionColor(aiStatus.aggressionLevel)}
          icon={Activity}
        />
      </div>

      {/* Market Context */}
      <div className="trading-card">
        <h4 className="font-medium text-text-secondary mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Contexto de Mercado
        </h4>
        <p className="text-sm text-text-primary leading-relaxed">
          {aiStatus.marketContext}
        </p>
      </div>

      {/* Patterns Detected */}
      <div className="trading-card">
        <h4 className="font-medium text-text-secondary mb-3">
          Padrões Detectados ({aiStatus.patternsDetected.length})
        </h4>
        <div className="space-y-2">
          {aiStatus.patternsDetected.map((pattern, index) => (
            <div 
              key={index}
              className="flex items-center gap-2 text-sm p-2 rounded bg-bg-tertiary"
            >
              <div className="w-2 h-2 rounded-full bg-buy-primary" />
              <span className="text-text-primary">{pattern}</span>
            </div>
          ))}
          {aiStatus.patternsDetected.length === 0 && (
            <p className="text-sm text-text-muted italic">
              Nenhum padrão detectado no momento
            </p>
          )}
        </div>
      </div>

      {/* Last Analysis */}
      <div className="trading-card">
        <div className="flex justify-between items-center">
          <span className="text-sm text-text-secondary">Última Análise:</span>
          <span className="text-sm font-mono text-text-info">
            {aiStatus.lastAnalysis}
          </span>
        </div>
        
        {aiStatus.hiddenLiquidity && (
          <div className="mt-2 flex items-center gap-2 text-sm text-text-accent">
            <div className="w-2 h-2 rounded-full bg-text-accent pulse-buy" />
            <span>Liquidez oculta identificada</span>
          </div>
        )}
      </div>

      {/* Backend Connection Status */}
      <BackendStatus />
    </div>
  );
};