import React from 'react';
import { AIStatusPanel } from '../trading/AIStatusPanel';
import { DecisionPanel } from '../trading/DecisionPanel';
import { MarketContext } from '../trading/MarketContext';
import { TradingLog } from '../trading/TradingLog';
import { LiveChart } from '../interactive/LiveChart';
import { AIStatus, DecisionAnalysis, MarketData, TradeEntry, ChartDataPoint } from '@/types/trading';

interface MainDashboardGridProps {
  aiStatus: AIStatus;
  decisionAnalysis: DecisionAnalysis;
  marketData: MarketData;
  tradingLog: TradeEntry[];
  chartData: ChartDataPoint[];
  isConnected: boolean;
}

export const MainDashboardGrid: React.FC<MainDashboardGridProps> = ({
  aiStatus,
  decisionAnalysis,
  marketData,
  tradingLog,
  chartData,
  isConnected
}) => {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
      {/* AI Status Panel - 1 column */}
      <aside className="xl:col-span-1" aria-label="Status da IA">
        <AIStatusPanel aiStatus={aiStatus} />
      </aside>
      
      {/* Decision Analysis - 2 columns */}
      <section className="xl:col-span-2 space-y-6" aria-label="Análise e gráficos">
        <DecisionPanel analysis={decisionAnalysis} />
        
        {/* Live Chart */}
        {isConnected && (
          <LiveChart
            title="WDO Mini Dólar - Tempo Real"
            data={chartData}
            height={200}
            color="buy"
            showVolume={true}
            animated={true}
            aria-label="Gráfico em tempo real do WDO Mini Dólar"
          />
        )}
      </section>
      
      {/* Market Context - 1 column */}
      <aside className="xl:col-span-1" aria-label="Contexto de mercado">
        <MarketContext marketData={marketData} />
      </aside>
      
      {/* Trading Log - Full width */}
      <section className="xl:col-span-4" aria-label="Histórico de operações">
        <TradingLog entries={tradingLog} />
      </section>
    </div>
  );
};