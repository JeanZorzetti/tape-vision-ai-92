import React from 'react';
import { Wifi, WifiOff, Settings, Bell, BellOff } from 'lucide-react';
import { ConnectionStatus } from '@/types/trading';

interface DashboardHeaderProps {
  currentTime: string;
  isConnected: boolean;
  isSystemActive: boolean;
  notificationsEnabled: boolean;
  nelogicaStatus: ConnectionStatus;
  onToggleNotifications: () => void;
  onToggleSettings: () => void;
  showSettings: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  currentTime,
  isConnected,
  isSystemActive,
  notificationsEnabled,
  nelogicaStatus,
  onToggleNotifications,
  onToggleSettings,
  showSettings
}) => {
  return (
    <header 
      className="border-b border-glass-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-30"
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-text-primary">
              AI Trading Bot - Interface Nelogica
            </h1>
            <time 
              className="text-sm text-text-secondary font-mono"
              dateTime={new Date().toISOString()}
              aria-label={`Horário atual: ${currentTime}`}
            >
              {currentTime}
            </time>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            <button
              onClick={onToggleNotifications}
              className={`p-2 rounded transition-colors ${
                notificationsEnabled 
                  ? 'text-buy-primary hover:bg-buy-primary/10' 
                  : 'text-text-muted hover:bg-bg-accent'
              }`}
              title={notificationsEnabled ? 'Desativar notificações' : 'Ativar notificações'}
              aria-label={notificationsEnabled ? 'Desativar notificações' : 'Ativar notificações'}
            >
              {notificationsEnabled ? 
                <Bell className="w-4 h-4" aria-hidden="true" /> : 
                <BellOff className="w-4 h-4" aria-hidden="true" />
              }
            </button>

            <button
              onClick={onToggleSettings}
              className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-accent transition-colors"
              title="Configurações"
              aria-label="Abrir configurações"
              aria-expanded={showSettings}
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
            </button>

            <div 
              className={`flex items-center gap-2 text-sm ${
                isConnected ? 'text-buy-primary' : 'text-sell-primary'
              }`}
              role="status"
              aria-live="polite"
            >
              {isConnected ? (
                <>
                  <Wifi className="w-4 h-4" aria-hidden="true" />
                  <span>Nelogica: Conectado</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4" aria-hidden="true" />
                  <span>Nelogica: Desconectado</span>
                </>
              )}
            </div>
            
            <div 
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                isSystemActive ? 'status-active' : 'status-danger'
              }`}
              role="status"
              aria-live="polite"
            >
              <div 
                className={`w-2 h-2 rounded-full ${
                  isSystemActive ? 'bg-buy-primary pulse-buy' : 'bg-sell-primary pulse-sell'
                }`} 
                aria-hidden="true"
              />
              <span>{isSystemActive ? 'Sistema Ativo' : 'Sistema Parado'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};