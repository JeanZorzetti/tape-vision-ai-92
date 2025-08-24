import React, { useState, useEffect } from 'react';
import { 
  Plug, 
  Settings, 
  Shield, 
  AlertCircle, 
  CheckCircle,
  Wifi,
  WifiOff,
  Key,
  Server,
  Eye,
  EyeOff
} from 'lucide-react';

export interface NelogicaConfig {
  apiUrl: string;
  username: string;
  password: string;
  dllPath: string;
  environment: 'demo' | 'production';
  autoReconnect: boolean;
  timeout: number;
}

export interface ConnectionStatus {
  isConnected: boolean;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  lastHeartbeat: string;
  errorMessage?: string;
  connectionTime?: string;
}

interface NelogicaConnectionProps {
  onConfigChange: (config: NelogicaConfig) => void;
  onConnectionStatusChange: (status: ConnectionStatus) => void;
}

export const NelogicaConnection: React.FC<NelogicaConnectionProps> = ({
  onConfigChange,
  onConnectionStatusChange
}) => {
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  
  const [config, setConfig] = useState<NelogicaConfig>({
    apiUrl: 'https://api.nelogica.com.br',
    username: '',
    password: '',
    dllPath: 'C:\\Program Files\\Nelogica\\PROFIT\\AutomationAPI.dll',
    environment: 'demo',
    autoReconnect: true,
    timeout: 30000
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    status: 'disconnected',
    lastHeartbeat: 'Never'
  });

  useEffect(() => {
    onConfigChange(config);
  }, [config, onConfigChange]);

  useEffect(() => {
    onConnectionStatusChange(connectionStatus);
  }, [connectionStatus, onConnectionStatusChange]);

  // Simulate connection status updates
  useEffect(() => {
    if (connectionStatus.isConnected) {
      const heartbeatInterval = setInterval(() => {
        setConnectionStatus(prev => ({
          ...prev,
          lastHeartbeat: new Date().toLocaleTimeString('pt-BR')
        }));
      }, 5000);

      return () => clearInterval(heartbeatInterval);
    }
  }, [connectionStatus.isConnected]);

  const handleConnect = async () => {
    if (!config.username || !config.password) {
      setConnectionStatus({
        isConnected: false,
        status: 'error',
        lastHeartbeat: 'Never',
        errorMessage: 'Usuário e senha são obrigatórios'
      });
      return;
    }

    setIsTesting(true);
    setConnectionStatus({
      isConnected: false,
      status: 'connecting',
      lastHeartbeat: 'Conectando...'
    });

    // Simulate connection process
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate success (in real app, this would be actual API call)
      setConnectionStatus({
        isConnected: true,
        status: 'connected',
        lastHeartbeat: new Date().toLocaleTimeString('pt-BR'),
        connectionTime: new Date().toLocaleTimeString('pt-BR')
      });
    } catch (error) {
      setConnectionStatus({
        isConnected: false,
        status: 'error',
        lastHeartbeat: 'Erro na conexão',
        errorMessage: 'Falha ao conectar com a API Nelogica'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = () => {
    setConnectionStatus({
      isConnected: false,
      status: 'disconnected',
      lastHeartbeat: 'Desconectado'
    });
  };

  const getStatusConfig = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return {
          icon: CheckCircle,
          className: 'status-active',
          text: 'Conectado'
        };
      case 'connecting':
        return {
          icon: Wifi,
          className: 'status-warning animate-pulse',
          text: 'Conectando...'
        };
      case 'error':
        return {
          icon: AlertCircle,
          className: 'status-danger',
          text: 'Erro'
        };
      default:
        return {
          icon: WifiOff,
          className: 'status-warning',
          text: 'Desconectado'
        };
    }
  };

  const statusConfig = getStatusConfig();
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
          <Plug className="w-5 h-5 text-text-info" />
          Conexão Nelogica
        </h3>
        
        <button
          onClick={() => setIsConfigOpen(!isConfigOpen)}
          className="p-2 rounded bg-bg-tertiary hover:bg-bg-accent transition-colors"
          title="Configurações"
        >
          <Settings className="w-4 h-4 text-text-secondary" />
        </button>
      </div>

      {/* Connection Status */}
      <div className="trading-card">
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center gap-2 ${statusConfig.className}`}>
            <StatusIcon className="w-5 h-5" />
            <span className="font-medium">{statusConfig.text}</span>
          </div>
          
          <div className="flex gap-2">
            {!connectionStatus.isConnected ? (
              <button
                onClick={handleConnect}
                disabled={isTesting}
                className="px-4 py-2 bg-buy-primary text-bg-primary rounded font-medium hover:bg-buy-secondary transition-colors disabled:opacity-50"
              >
                {isTesting ? 'Conectando...' : 'Conectar'}
              </button>
            ) : (
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 bg-sell-primary text-bg-primary rounded font-medium hover:bg-sell-secondary transition-colors"
              >
                Desconectar
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="data-row">
            <span className="data-label">Ambiente:</span>
            <span className={`data-value ${config.environment === 'production' ? 'value-sell' : 'value-accent'}`}>
              {config.environment === 'production' ? 'PRODUÇÃO' : 'DEMO'}
            </span>
          </div>
          
          <div className="data-row">
            <span className="data-label">Último Heartbeat:</span>
            <span className="data-value font-mono text-text-info">
              {connectionStatus.lastHeartbeat}
            </span>
          </div>
          
          {connectionStatus.connectionTime && (
            <div className="data-row">
              <span className="data-label">Conectado em:</span>
              <span className="data-value font-mono text-buy-primary">
                {connectionStatus.connectionTime}
              </span>
            </div>
          )}
          
          <div className="data-row">
            <span className="data-label">Auto-Reconexão:</span>
            <span className={`data-value ${config.autoReconnect ? 'value-buy' : 'value-sell'}`}>
              {config.autoReconnect ? 'Ativa' : 'Inativa'}
            </span>
          </div>
        </div>

        {connectionStatus.errorMessage && (
          <div className="mt-4 p-3 bg-sell-primary/10 border border-sell-primary/30 rounded flex items-center gap-2 text-sell-primary">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="text-sm">{connectionStatus.errorMessage}</span>
          </div>
        )}
      </div>

      {/* Configuration Panel */}
      {isConfigOpen && (
        <div className="trading-card space-y-4">
          <h4 className="font-medium text-text-secondary flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Configurações da API
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* API URL */}
            <div className="space-y-2">
              <label className="text-sm text-text-secondary flex items-center gap-2">
                <Server className="w-3 h-3" />
                URL da API
              </label>
              <input
                type="url"
                value={config.apiUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, apiUrl: e.target.value }))}
                className="w-full bg-bg-tertiary border border-glass-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-buy-primary/50"
                placeholder="https://api.nelogica.com.br"
              />
            </div>

            {/* Environment */}
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Ambiente</label>
              <select
                value={config.environment}
                onChange={(e) => setConfig(prev => ({ ...prev, environment: e.target.value as 'demo' | 'production' }))}
                className="w-full bg-bg-tertiary border border-glass-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-buy-primary/50"
              >
                <option value="demo">Demo/Simulação</option>
                <option value="production">Produção</option>
              </select>
            </div>

            {/* Username */}
            <div className="space-y-2">
              <label className="text-sm text-text-secondary flex items-center gap-2">
                <Key className="w-3 h-3" />
                Usuário
              </label>
              <input
                type="text"
                value={config.username}
                onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
                className="w-full bg-bg-tertiary border border-glass-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-buy-primary/50"
                placeholder="Seu usuário Nelogica"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Senha</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={config.password}
                  onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full bg-bg-tertiary border border-glass-border rounded px-3 py-2 pr-10 text-sm text-text-primary focus:outline-none focus:border-buy-primary/50"
                  placeholder="Sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* DLL Path */}
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-text-secondary">Caminho da DLL</label>
              <input
                type="text"
                value={config.dllPath}
                onChange={(e) => setConfig(prev => ({ ...prev, dllPath: e.target.value }))}
                className="w-full bg-bg-tertiary border border-glass-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-buy-primary/50"
                placeholder="C:\Program Files\Nelogica\PROFIT\AutomationAPI.dll"
              />
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Timeout (ms)</label>
              <input
                type="number"
                value={config.timeout}
                onChange={(e) => setConfig(prev => ({ ...prev, timeout: parseInt(e.target.value) || 30000 }))}
                className="w-full bg-bg-tertiary border border-glass-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-buy-primary/50"
                min="5000"
                max="120000"
                step="1000"
              />
            </div>

            {/* Auto Reconnect */}
            <div className="space-y-2">
              <label className="text-sm text-text-secondary">Auto-Reconexão</label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.autoReconnect}
                  onChange={(e) => setConfig(prev => ({ ...prev, autoReconnect: e.target.checked }))}
                  className="w-4 h-4 text-buy-primary bg-bg-tertiary border-glass-border rounded focus:ring-buy-primary/50"
                />
                <span className="text-sm text-text-primary">
                  Reconectar automaticamente
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-glass-border">
            <button
              onClick={() => setIsConfigOpen(false)}
              className="px-4 py-2 bg-bg-tertiary hover:bg-bg-accent text-text-secondary rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConnect}
              disabled={isTesting || !config.username || !config.password}
              className="px-4 py-2 bg-buy-primary text-bg-primary rounded font-medium hover:bg-buy-secondary transition-colors disabled:opacity-50"
            >
              Testar Conexão
            </button>
          </div>
        </div>
      )}
    </div>
  );
};