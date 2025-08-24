/**
 * Backend Connection Status Component
 */

import React from 'react';
import { 
  Server, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { useBackendConnection } from '@/hooks/useBackendConnection';

export const BackendStatus: React.FC = () => {
  const { connectionStatus, testConnection } = useBackendConnection();

  const getStatusIcon = () => {
    if (connectionStatus.isConnecting) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    
    if (connectionStatus.isConnected) {
      return <CheckCircle2 className="w-4 h-4 text-buy-primary" />;
    }
    
    if (connectionStatus.error) {
      return <AlertCircle className="w-4 h-4 text-sell-primary" />;
    }
    
    return <WifiOff className="w-4 h-4 text-text-tertiary" />;
  };

  const getStatusText = () => {
    if (connectionStatus.isConnecting) {
      return 'Conectando...';
    }
    
    if (connectionStatus.isConnected) {
      return 'Conectado';
    }
    
    if (connectionStatus.error) {
      return 'Erro';
    }
    
    return 'Desconectado';
  };

  const getStatusColor = () => {
    if (connectionStatus.isConnecting) {
      return 'text-text-accent';
    }
    
    if (connectionStatus.isConnected) {
      return 'text-buy-primary';
    }
    
    if (connectionStatus.error) {
      return 'text-sell-primary';
    }
    
    return 'text-text-tertiary';
  };

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-secondary flex items-center gap-2">
          <Server className="w-4 h-4" />
          Backend Status
        </h3>
        
        <button
          onClick={testConnection}
          disabled={connectionStatus.isConnecting}
          className="p-1 rounded hover:bg-bg-accent transition-colors disabled:opacity-50"
          title="Testar conexão"
        >
          <RefreshCw className={`w-3 h-3 ${connectionStatus.isConnecting ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-2">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <div className={`flex items-center gap-2 ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>
          
          {connectionStatus.lastPing && (
            <div className="flex items-center gap-1 text-xs text-text-tertiary">
              <Clock className="w-3 h-3" />
              <span>{connectionStatus.lastPing}ms</span>
            </div>
          )}
        </div>

        {/* Backend URL */}
        <div className="text-xs text-text-tertiary">
          <span className="font-mono">{connectionStatus.backendUrl}</span>
        </div>

        {/* Error Message */}
        {connectionStatus.error && (
          <div className="p-2 bg-sell-primary/10 border border-sell-primary/30 rounded">
            <p className="text-xs text-sell-primary">{connectionStatus.error}</p>
          </div>
        )}

        {/* Success Info */}
        {connectionStatus.isConnected && !connectionStatus.error && (
          <div className="p-2 bg-buy-primary/10 border border-buy-primary/30 rounded">
            <p className="text-xs text-buy-primary">
              Conectado ao backend de trading
              {connectionStatus.lastPing && ` - Latência: ${connectionStatus.lastPing}ms`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};