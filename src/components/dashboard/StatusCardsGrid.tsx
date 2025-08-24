import React from 'react';
import { Brain, DollarSign, BarChart3, Zap } from 'lucide-react';
import { InteractiveStatusCard } from '../interactive/InteractiveStatusCard';
import { AIStatus, MarketData, ConnectionStatus } from '@/types/trading';

interface StatusCardsGridProps {
  aiStatus: AIStatus;
  marketData: MarketData;
  nelogicaStatus: ConnectionStatus;
  onApiStatusClick: () => void;
}

export const StatusCardsGrid: React.FC<StatusCardsGridProps> = ({
  aiStatus,
  marketData,
  nelogicaStatus,
  onApiStatusClick
}) => {
  return (
    <section 
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
      aria-label="Status geral do sistema"
    >
      <InteractiveStatusCard
        title="IA Confidence"
        value={`${aiStatus.confidence}%`}
        subtitle="Nível de certeza atual"
        icon={Brain}
        type={aiStatus.confidence >= 90 ? 'buy' : aiStatus.confidence >= 70 ? 'accent' : 'sell'}
        trend={aiStatus.confidence >= 85 ? 'up' : 'neutral'}
        pulse={aiStatus.confidence >= 90}
        expandable={true}
        expandedContent={
          <div className="text-sm space-y-2">
            <p className="text-text-secondary">Última análise: {aiStatus.lastAnalysis}</p>
            <p className="text-text-primary">{aiStatus.marketContext}</p>
          </div>
        }
        aria-label={`Confiança da IA: ${aiStatus.confidence}%`}
      />

      <InteractiveStatusCard
        title="Preço WDO"
        value={marketData.price.toFixed(2)}
        subtitle={`${marketData.priceChange >= 0 ? '+' : ''}${marketData.priceChange.toFixed(2)}`}
        icon={DollarSign}
        type={marketData.priceChange >= 0 ? 'buy' : 'sell'}
        trend={marketData.priceChange >= 0 ? 'up' : 'down'}
        pulse={Math.abs(marketData.priceChange) > 10}
        aria-label={`Preço atual: ${marketData.price.toFixed(2)}, variação: ${marketData.priceChange.toFixed(2)}`}
      />

      <InteractiveStatusCard
        title="Sinais Ativos"
        value={aiStatus.entrySignals}
        subtitle="Oportunidades detectadas"
        icon={BarChart3}
        type={aiStatus.entrySignals > 0 ? 'buy' : 'neutral'}
        trend={aiStatus.entrySignals > 2 ? 'up' : 'neutral'}
        pulse={aiStatus.entrySignals > 2}
        aria-label={`${aiStatus.entrySignals} sinais de trading ativos`}
      />

      <InteractiveStatusCard
        title="API Status"
        value={nelogicaStatus.isConnected ? 'ONLINE' : 'OFFLINE'}
        subtitle={nelogicaStatus.lastHeartbeat}
        icon={Zap}
        type={nelogicaStatus.isConnected ? 'buy' : 'sell'}
        onClick={onApiStatusClick}
        aria-label={`Status da API: ${nelogicaStatus.isConnected ? 'Online' : 'Offline'}`}
      />
    </section>
  );
};