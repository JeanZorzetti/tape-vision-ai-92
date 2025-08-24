import React, { useState } from 'react';
import { FileText, Filter, Download, Search, Calendar } from 'lucide-react';

export interface TradeEntry {
  id: string;
  timestamp: string;
  action: 'BUY' | 'SELL' | 'ANALYSIS' | 'ALERT' | 'ERROR';
  symbol: string;
  price?: number;
  quantity?: number;
  confidence?: number;
  reason: string;
  pnl?: number;
  status: 'success' | 'pending' | 'failed';
}

interface TradingLogProps {
  entries: TradeEntry[];
  maxEntries?: number;
}

export const TradingLog: React.FC<TradingLogProps> = ({ 
  entries, 
  maxEntries = 100 
}) => {
  const [filter, setFilter] = useState<TradeEntry['action'] | 'ALL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredEntries = entries
    .filter(entry => filter === 'ALL' || entry.action === filter)
    .filter(entry => 
      searchTerm === '' || 
      entry.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, maxEntries);

  const getActionConfig = (action: TradeEntry['action']) => {
    switch (action) {
      case 'BUY':
        return { className: 'bg-buy-primary/20 text-buy-primary border-buy-primary/30', text: 'COMPRA' };
      case 'SELL':
        return { className: 'bg-sell-primary/20 text-sell-primary border-sell-primary/30', text: 'VENDA' };
      case 'ANALYSIS':
        return { className: 'bg-text-info/20 text-text-info border-text-info/30', text: 'ANÁLISE' };
      case 'ALERT':
        return { className: 'bg-text-accent/20 text-text-accent border-text-accent/30', text: 'ALERTA' };
      case 'ERROR':
        return { className: 'bg-sell-primary/20 text-sell-primary border-sell-primary/30', text: 'ERRO' };
    }
  };

  const getStatusIcon = (status: TradeEntry['status']) => {
    switch (status) {
      case 'success': return '✓';
      case 'pending': return '⏳';
      case 'failed': return '✗';
    }
  };

  const formatPrice = (price?: number) => 
    price ? price.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-';

  const formatPnL = (pnl?: number) => {
    if (!pnl) return null;
    const formatted = pnl.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    return pnl >= 0 ? `+${formatted}` : formatted;
  };

  const exportLog = () => {
    const csvContent = [
      'Timestamp,Action,Symbol,Price,Quantity,Confidence,Reason,PnL,Status',
      ...filteredEntries.map(entry => 
        `${entry.timestamp},${entry.action},${entry.symbol},${entry.price || ''},${entry.quantity || ''},${entry.confidence || ''},${entry.reason.replace(/,/g, ';')},${entry.pnl || ''},${entry.status}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <FileText className="w-5 h-5 text-text-secondary" />
          Log de Operações
          <span className="text-sm text-text-muted">({filteredEntries.length})</span>
        </h3>
        
        <div className="flex items-center gap-2">
          <button
            onClick={exportLog}
            className="flex items-center gap-1 px-3 py-1 text-xs bg-bg-tertiary hover:bg-bg-accent rounded border border-glass-border text-text-secondary transition-colors"
          >
            <Download className="w-3 h-3" />
            Exportar
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="trading-card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Search className="w-4 h-4 text-text-secondary" />
            <input
              type="text"
              placeholder="Buscar por motivo ou símbolo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-bg-tertiary border border-glass-border rounded px-3 py-1 text-sm text-text-primary focus:outline-none focus:border-buy-primary/50"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as TradeEntry['action'] | 'ALL')}
              className="bg-bg-tertiary border border-glass-border rounded px-3 py-1 text-sm text-text-primary focus:outline-none focus:border-buy-primary/50"
            >
              <option value="ALL">Todos</option>
              <option value="BUY">Compras</option>
              <option value="SELL">Vendas</option>
              <option value="ANALYSIS">Análises</option>
              <option value="ALERT">Alertas</option>
              <option value="ERROR">Erros</option>
            </select>
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="trading-card max-h-96 overflow-y-auto">
        <div className="space-y-2">
          {filteredEntries.map((entry) => {
            const actionConfig = getActionConfig(entry.action);
            
            return (
              <div 
                key={entry.id}
                className="flex items-center gap-3 p-3 rounded bg-bg-tertiary hover:bg-bg-accent transition-colors border-l-2 border-transparent hover:border-buy-primary/30"
              >
                {/* Timestamp */}
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="w-3 h-3 text-text-secondary flex-shrink-0" />
                  <span className="text-xs font-mono text-text-info whitespace-nowrap">
                    {entry.timestamp}
                  </span>
                </div>

                {/* Action Badge */}
                <div className={`
                  px-2 py-1 rounded text-xs font-semibold border flex-shrink-0
                  ${actionConfig.className}
                `}>
                  {actionConfig.text}
                </div>

                {/* Symbol */}
                <span className="text-sm font-mono text-text-secondary min-w-0 flex-shrink-0">
                  {entry.symbol}
                </span>

                {/* Price & Quantity */}
                {(entry.price || entry.quantity) && (
                  <div className="text-sm font-mono text-text-primary min-w-0 flex-shrink-0">
                    {entry.price && formatPrice(entry.price)}
                    {entry.quantity && ` (${entry.quantity})`}
                  </div>
                )}

                {/* Confidence */}
                {entry.confidence && (
                  <div className="text-xs font-mono text-text-accent flex-shrink-0">
                    {entry.confidence}%
                  </div>
                )}

                {/* Reason */}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-text-primary truncate block">
                    {entry.reason}
                  </span>
                </div>

                {/* PnL */}
                {entry.pnl !== undefined && (
                  <div className={`
                    text-sm font-mono font-semibold flex-shrink-0
                    ${entry.pnl >= 0 ? 'value-buy' : 'value-sell'}
                  `}>
                    {formatPnL(entry.pnl)}
                  </div>
                )}

                {/* Status */}
                <div className="flex-shrink-0">
                  <span className={`
                    text-sm
                    ${entry.status === 'success' ? 'text-buy-primary' :
                      entry.status === 'pending' ? 'text-text-accent' :
                      'text-sell-primary'}
                  `}>
                    {getStatusIcon(entry.status)}
                  </span>
                </div>
              </div>
            );
          })}
          
          {filteredEntries.length === 0 && (
            <div className="text-center py-8 text-text-muted">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma entrada encontrada</p>
            </div>
          )}
        </div>
      </div>

      {entries.length > maxEntries && (
        <div className="text-center">
          <p className="text-xs text-text-muted">
            Mostrando {Math.min(filteredEntries.length, maxEntries)} de {entries.length} entradas
          </p>
        </div>
      )}
    </div>
  );
};