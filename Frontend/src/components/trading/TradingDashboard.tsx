import React, { useState, useEffect } from 'react';
import { useNotifications } from '../notifications/NotificationSystem';
import { NelogicaConnection, NelogicaConfig } from '../api/NelogicaConnection';
import { DashboardLayout } from '../layout/DashboardLayout';
import { StatusCardsGrid } from '../dashboard/StatusCardsGrid';
import { MainDashboardGrid } from '../dashboard/MainDashboardGrid';
import { useTradingData } from '@/hooks/useTradingData';
import { useSystemStatus } from '@/hooks/useSystemStatus';

export const TradingDashboard: React.FC = () => {
  const [showSettings, setShowSettings] = useState(false);

  // Custom hooks for better separation of concerns
  const {
    isSystemActive,
    isConnected,
    currentTime,
    notificationsEnabled,
    nelogicaConfig,
    nelogicaStatus,
    handleEmergencyStop,
    reactivateSystem,
    toggleNotifications,
    handleNelogicaConfigChange,
    handleNelogicaStatusChange
  } = useSystemStatus();

  const {
    aiStatus,
    decisionAnalysis,
    marketData,
    tradingLog,
    chartData,
    addTradeEntry,
    updateChartData,
    setChartData,
    mlEngineError,
    isLoading,
    refreshMLData
  } = useTradingData();

  // Notifications system
  const {
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyTrade,
    notifyInfo
  } = useNotifications();



  // Simulate real-time chart updates
  useEffect(() => {
    if (nelogicaStatus.isConnected) {
      const interval = setInterval(() => {
        const newPoint = {
          timestamp: Date.now(),
          value: chartData[chartData.length - 1]?.value + (Math.random() - 0.5) * 2 || 5980,
          volume: Math.floor(Math.random() * 1000) + 500
        };
        updateChartData(newPoint);
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [nelogicaStatus.isConnected, chartData, updateChartData]);

  // Sample notifications
  useEffect(() => {
    if (notificationsEnabled) {
      // Initial welcome notification
      setTimeout(() => {
        notifySuccess(
          'Sistema Inicializado',
          'IA Trading Bot está pronto para operar!',
          {
            label: 'Ver Detalhes',
            onClick: () => console.log('Opening details...')
          }
        );
      }, 1000);

      // Simulate periodic notifications
      const notificationInterval = setInterval(() => {
        if (Math.random() > 0.7) {
          const notifications = [
            () => notifyTrade('Nova Oportunidade', 'Padrão de entrada detectado em WDO'),
            () => notifyInfo('Análise Concluída', 'Score de confiança atualizado: 89.2%'),
            () => notifyWarning('Atenção', 'Volatilidade aumentou significativamente')
          ];
          
          const randomNotification = notifications[Math.floor(Math.random() * notifications.length)];
          randomNotification();
        }
      }, 15000);

      return () => clearInterval(notificationInterval);
    }
  }, [notificationsEnabled, notifySuccess, notifyTrade, notifyInfo, notifyWarning]);

  const handleEmergencyStopWithNotification = () => {
    handleEmergencyStop();
    notifyError(
      'PARADA DE EMERGÊNCIA',
      'Todas as operações foram interrompidas por segurança.',
      {
        label: 'Reativar',
        onClick: () => {
          const confirm = window.confirm('Deseja reativar o sistema?');
          if (confirm) {
            reactivateSystem();
            notifySuccess('Sistema Reativado', 'Operações normalizadas.');
          }
        }
      }
    );
  };

  const handleNelogicaConfigChangeLocal = (config: NelogicaConfig) => {
    handleNelogicaConfigChange(config as any);
  };

  const handleNelogicaStatusChangeWithNotification = (status: any) => {
    const wasConnected = nelogicaStatus.isConnected;
    handleNelogicaStatusChange(status);

    // Notify connection changes
    if (status.isConnected && !wasConnected) {
      notifySuccess('Conectado à Nelogica', 'API conectada com sucesso!');
      
      // Add connection log entry
      addTradeEntry({
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        action: 'ANALYSIS',
        symbol: 'SYSTEM',
        reason: 'Conexão estabelecida com API Nelogica',
        status: 'success'
      });
    } else if (!status.isConnected && wasConnected) {
      notifyError('Conexão Perdida', 'Conexão com API Nelogica foi perdida');
    }
  };

  return (
    <DashboardLayout
      isSystemActive={isSystemActive}
      isConnected={isConnected}
      currentTime={currentTime}
      notificationsEnabled={notificationsEnabled}
      nelogicaStatus={nelogicaStatus}
      onEmergencyStop={handleEmergencyStopWithNotification}
      onReactivateSystem={() => {
        reactivateSystem();
        notifySuccess('Sistema Reativado', 'Operações normalizadas.');
      }}
      onToggleNotifications={toggleNotifications}
      onToggleSettings={() => setShowSettings(!showSettings)}
      showSettings={showSettings}
    >
      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-20 right-4 z-40 w-96">
          <NelogicaConnection
            onConfigChange={handleNelogicaConfigChangeLocal}
            onConnectionStatusChange={handleNelogicaStatusChangeWithNotification}
          />
        </div>
      )}

      {/* Status Cards Grid */}
      <StatusCardsGrid
        aiStatus={aiStatus}
        marketData={marketData}
        nelogicaStatus={nelogicaStatus}
        onApiStatusClick={() => setShowSettings(true)}
      />

      {/* Main Dashboard Grid */}
      <MainDashboardGrid
        aiStatus={aiStatus}
        decisionAnalysis={decisionAnalysis}
        marketData={marketData}
        tradingLog={tradingLog}
        chartData={chartData}
        isConnected={isConnected}
        mlEngineError={mlEngineError}
        mlEngineLoading={isLoading}
        onRefreshMLData={refreshMLData}
      />
    </DashboardLayout>
  );
};