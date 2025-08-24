import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, Settings, Bell, BellOff, Brain, DollarSign, BarChart3, Zap } from 'lucide-react';
import { SplashScreen } from '../loading/SplashScreen';
import { NotificationSystem, useNotifications } from '../notifications/NotificationSystem';
import { NelogicaConnection, NelogicaConfig, ConnectionStatus } from '../api/NelogicaConnection';
import { EmergencyStop } from './EmergencyStop';
import { AIStatusPanel, AIStatus } from './AIStatusPanel';
import { DecisionPanel, DecisionAnalysis } from './DecisionPanel';
import { MarketContext, MarketData } from './MarketContext';
import { TradingLog, TradeEntry } from './TradingLog';
import { InteractiveStatusCard } from '../interactive/InteractiveStatusCard';
import { LiveChart } from '../interactive/LiveChart';

export const TradingDashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isSystemActive, setIsSystemActive] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [showSettings, setShowSettings] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  // Nelogica connection states
  const [nelogicaConfig, setNelogicaConfig] = useState<NelogicaConfig | null>(null);
  const [nelogicaStatus, setNelogicaStatus] = useState<ConnectionStatus>({
    isConnected: false,
    status: 'disconnected',
    lastHeartbeat: 'Never'
  });

  // Notifications system
  const {
    notifications,
    dismissNotification,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyTrade,
    notifyInfo
  } = useNotifications();

  // Sample chart data
  const [chartData, setChartData] = useState(() => {
    const now = Date.now();
    return Array.from({ length: 50 }, (_, i) => ({
      timestamp: now - (50 - i) * 60000,
      value: 5980 + Math.sin(i * 0.1) * 10 + Math.random() * 5,
      volume: Math.floor(Math.random() * 1000) + 500
    }));
  });

  // Mock data - In real app, this would come from WebSocket/API
  const [aiStatus] = useState<AIStatus>({
    confidence: 87.5,
    status: 'active',
    lastAnalysis: '14:32:15',
    patternsDetected: [
      'Absorção de liquidez em 5.980',
      'Rejeição em resistência histórica',
      'Aumento de volume anômalo'
    ],
    marketContext: 'Mercado em tendência de alta com pressão compradora crescente. Identificado cluster de ordens em 5.975-5.980.',
    entrySignals: 3,
    aggressionLevel: 'high',
    hiddenLiquidity: true
  });

  const [decisionAnalysis] = useState<DecisionAnalysis>({
    entryReason: 'Confluência de fatores técnicos: absorção de liquidez em suporte, rejeição de ordens falsas e aumento de agressão compradora.',
    variablesAnalyzed: [
      { name: 'Volume Profile', weight: 25, score: 92 },
      { name: 'Order Flow Imbalance', weight: 20, score: 88 },
      { name: 'Price Action Context', weight: 15, score: 85 },
      { name: 'Historical Pattern Match', weight: 15, score: 78 },
      { name: 'Market Microstructure', weight: 25, score: 95 }
    ],
    componentScores: {
      buyAggression: 92,
      sellAggression: 23,
      liquidityAbsorption: 88,
      falseOrdersDetected: 67,
      flowMomentum: 85,
      historicalPattern: 78
    },
    finalCertainty: 87.5,
    nextAction: 'Aguardar confirmação acima de 5.985 para entrada long com stop em 5.970.',
    recommendation: 'ENTRAR'
  });

  const [marketData] = useState<MarketData>({
    price: 5982.50,
    priceChange: 15.75,
    volume: 125000,
    volatility: 1.8,
    spread: 2,
    sessionTime: '14:32:15',
    marketPhase: 'open',
    liquidityLevel: 'high',
    orderBookImbalance: 35
  });

  const [tradingLog, setTradingLog] = useState<TradeEntry[]>([
    {
      id: '1',
      timestamp: '14:32:15',
      action: 'ANALYSIS',
      symbol: 'WDO',
      confidence: 87.5,
      reason: 'Confluência técnica detectada - preparando entrada',
      status: 'success'
    },
    {
      id: '2',
      timestamp: '14:31:42',
      action: 'ALERT',
      symbol: 'WDO',
      reason: 'Absorção de liquidez em 5.980 - monitorar',
      status: 'success'
    },
    {
      id: '3',
      timestamp: '14:30:18',
      action: 'BUY',
      symbol: 'WDO',
      price: 5975.25,
      quantity: 5,
      confidence: 91.2,
      reason: 'Entrada confirmada após rejeição',
      pnl: 36.25,
      status: 'success'
    }
  ]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Simulate real-time chart updates
  useEffect(() => {
    if (!isLoading && nelogicaStatus.isConnected) {
      const interval = setInterval(() => {
        setChartData(prev => {
          const newPoint = {
            timestamp: Date.now(),
            value: prev[prev.length - 1].value + (Math.random() - 0.5) * 2,
            volume: Math.floor(Math.random() * 1000) + 500
          };
          return [...prev.slice(1), newPoint];
        });
      }, 2000);

      return () => clearInterval(interval);
    }
  }, [isLoading, nelogicaStatus.isConnected]);

  // Connection status based on Nelogica
  useEffect(() => {
    setIsConnected(nelogicaStatus.isConnected);
  }, [nelogicaStatus.isConnected]);

  // Sample notifications
  useEffect(() => {
    if (!isLoading && notificationsEnabled) {
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
  }, [isLoading, notificationsEnabled, notifySuccess, notifyTrade, notifyInfo, notifyWarning]);

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  const handleEmergencyStop = () => {
    setIsSystemActive(false);
    notifyError(
      'PARADA DE EMERGÊNCIA',
      'Todas as operações foram interrompidas por segurança.',
      {
        label: 'Reativar',
        onClick: () => {
          const confirm = window.confirm('Deseja reativar o sistema?');
          if (confirm) {
            setIsSystemActive(true);
            notifySuccess('Sistema Reativado', 'Operações normalizadas.');
          }
        }
      }
    );
  };

  const handleNelogicaConfigChange = (config: NelogicaConfig) => {
    setNelogicaConfig(config);
  };

  const handleNelogicaStatusChange = (status: ConnectionStatus) => {
    const wasConnected = nelogicaStatus.isConnected;
    setNelogicaStatus(status);

    // Notify connection changes
    if (status.isConnected && !wasConnected) {
      notifySuccess('Conectado à Nelogica', 'API conectada com sucesso!');
      
      // Add connection log entry
      setTradingLog(prev => [{
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString('pt-BR'),
        action: 'ANALYSIS',
        symbol: 'SYSTEM',
        reason: 'Conexão estabelecida com API Nelogica',
        status: 'success'
      }, ...prev]);
    } else if (!status.isConnected && wasConnected) {
      notifyError('Conexão Perdida', 'Conexão com API Nelogica foi perdida');
    }
  };

  if (isLoading) {
    return <SplashScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <div className="min-h-screen bg-bg-primary relative">
      {/* Notifications */}
      {notificationsEnabled && (
        <NotificationSystem
          notifications={notifications}
          onDismiss={dismissNotification}
          position="top-right"
        />
      )}

      {/* Emergency Stop Button */}
      <EmergencyStop 
        onEmergencyStop={handleEmergencyStop}
        isActive={isSystemActive}
      />

      {/* Header */}
      <header className="border-b border-glass-border bg-bg-secondary/50 backdrop-blur-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-text-primary">
                AI Trading Bot - Interface Nelogica
              </h1>
              <div className="text-sm text-text-secondary font-mono">
                {currentTime}
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                className={`p-2 rounded transition-colors ${
                  notificationsEnabled 
                    ? 'text-buy-primary hover:bg-buy-primary/10' 
                    : 'text-text-muted hover:bg-bg-accent'
                }`}
                title={notificationsEnabled ? 'Desativar notificações' : 'Ativar notificações'}
              >
                {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded text-text-secondary hover:text-text-primary hover:bg-bg-accent transition-colors"
                title="Configurações"
              >
                <Settings className="w-4 h-4" />
              </button>

              <div className={`
                flex items-center gap-2 text-sm
                ${isConnected ? 'text-buy-primary' : 'text-sell-primary'}
              `}>
                {isConnected ? (
                  <>
                    <Wifi className="w-4 h-4" />
                    <span>Nelogica: Conectado</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="w-4 h-4" />
                    <span>Nelogica: Desconectado</span>
                  </>
                )}
              </div>
              
              <div className={`
                flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium
                ${isSystemActive ? 'status-active' : 'status-danger'}
              `}>
                <div className={`w-2 h-2 rounded-full ${
                  isSystemActive ? 'bg-buy-primary pulse-buy' : 'bg-sell-primary pulse-sell'
                }`} />
                <span>{isSystemActive ? 'Sistema Ativo' : 'Sistema Parado'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-20 right-4 z-40 w-96">
          <NelogicaConnection
            onConfigChange={handleNelogicaConfigChange}
            onConnectionStatusChange={handleNelogicaStatusChange}
          />
        </div>
      )}

      {/* Main Dashboard */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Interactive Status Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
          />

          <InteractiveStatusCard
            title="Preço WDO"
            value={marketData.price.toFixed(2)}
            subtitle={`${marketData.priceChange >= 0 ? '+' : ''}${marketData.priceChange.toFixed(2)}`}
            icon={DollarSign}
            type={marketData.priceChange >= 0 ? 'buy' : 'sell'}
            trend={marketData.priceChange >= 0 ? 'up' : 'down'}
            pulse={Math.abs(marketData.priceChange) > 10}
          />

          <InteractiveStatusCard
            title="Sinais Ativos"
            value={aiStatus.entrySignals}
            subtitle="Oportunidades detectadas"
            icon={BarChart3}
            type={aiStatus.entrySignals > 0 ? 'buy' : 'neutral'}
            trend={aiStatus.entrySignals > 2 ? 'up' : 'neutral'}
            pulse={aiStatus.entrySignals > 2}
          />

          <InteractiveStatusCard
            title="API Status"
            value={nelogicaStatus.isConnected ? 'ONLINE' : 'OFFLINE'}
            subtitle={nelogicaStatus.lastHeartbeat}
            icon={Zap}
            type={nelogicaStatus.isConnected ? 'buy' : 'sell'}
            onClick={() => setShowSettings(true)}
          />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* AI Status Panel - 1 column */}
          <div className="lg:col-span-1">
            <AIStatusPanel aiStatus={aiStatus} />
          </div>
          
          {/* Decision Analysis - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
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
              />
            )}
          </div>
          
          {/* Market Context - 1 column */}
          <div className="lg:col-span-1">
            <MarketContext marketData={marketData} />
          </div>
          
          {/* Trading Log - Full width */}
          <div className="lg:col-span-4">
            <TradingLog entries={tradingLog} />
          </div>
        </div>
      </main>

      {/* System Overlay when stopped */}
      {!isSystemActive && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center">
          <div className="trading-card max-w-md mx-4 text-center">
            <div className="text-6xl text-sell-primary mb-4">⏹</div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              Sistema Parado
            </h2>
            <p className="text-text-secondary mb-4">
              Todas as operações foram interrompidas por segurança.
            </p>
            <button
              onClick={() => {
                const confirm = window.confirm('Deseja reativar o sistema?');
                if (confirm) {
                  setIsSystemActive(true);
                  notifySuccess('Sistema Reativado', 'Operações normalizadas.');
                }
              }}
              className="px-6 py-2 bg-buy-primary text-bg-primary rounded font-semibold hover:bg-buy-secondary transition-colors"
            >
              Reativar Sistema
            </button>
          </div>
        </div>
      )}
    </div>
  );
};