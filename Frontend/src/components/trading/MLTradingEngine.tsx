import React, { useState, useEffect, useRef } from 'react';
import { Activity, Database, Wifi, Brain, Zap, TrendingUp, AlertTriangle, Server } from 'lucide-react';

// WebSocket Data Interfaces
interface TickData {
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  side: 'BUY' | 'SELL';
  aggressor: boolean;
  tradeId: string;
  sequence: number;
}

interface Level2Data {
  symbol: string;
  timestamp: number;
  bids: Array<{
    price: number;
    volume: number;
    orders: number;
    mpid?: string; // Market participant ID
  }>;
  asks: Array<{
    price: number;
    volume: number;
    orders: number;
    mpid?: string;
  }>;
  sequence: number;
}

interface RealtimeIndicators {
  vwap: {
    value: number;
    deviation: number;
    volume: number;
  };
  volatility: {
    realized: number;
    implied: number;
    atr: number;
  };
  orderFlow: {
    buyFlow: number;
    sellFlow: number;
    netFlow: number;
    aggression: number;
  };
  momentum: {
    short: number;
    medium: number;
    acceleration: number;
  };
}

// ML Prediction Interfaces
interface MLPrediction {
  timestamp: number;
  symbol: string;
  direction: 'UP' | 'DOWN' | 'NEUTRAL';
  confidence: number;
  targetPrice: number;
  timeHorizon: number; // seconds
  features: {
    tapeReading: number;
    volumeProfile: number;
    orderFlowImbalance: number;
    institutionalActivity: number;
    technicalSignals: number;
  };
  riskScore: number;
}

interface ScalpingOpportunity {
  id: string;
  timestamp: number;
  type: 'TAPE_AGGRESSION' | 'HIDDEN_LIQUIDITY' | 'FAKE_ORDER_REMOVAL' | 'MOMENTUM_BREAKOUT';
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  targetPoints: number; // 0.5 to 2 points for mini dollar
  stopPoints: number;
  confidence: number;
  speed: 'INSTANT' | 'FAST' | 'MEDIUM'; // Execution speed required
  reasoning: string[];
}

// Database Integration Interface
interface MongoTickStorage {
  connected: boolean;
  ticksStored: number;
  latestTick: TickData | null;
  storageRate: number; // ticks per second
  queryLatency: number; // ms
  indexHealth: 'GOOD' | 'DEGRADED' | 'POOR';
}

interface MLTradingEngineData {
  websocketStatus: {
    tradingView: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
    investing: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
    latency: number;
    messagesPerSecond: number;
  };
  realtimeData: {
    latestTick: TickData | null;
    level2: Level2Data | null;
    indicators: RealtimeIndicators;
    dataQuality: number;
  };
  database: MongoTickStorage;
  mlEngine: {
    isActive: boolean;
    modelsLoaded: number;
    predictionsPerSecond: number;
    accuracy: {
      shortTerm: number; // 1-5 seconds
      microTrend: number; // 5-30 seconds
      overall: number;
    };
    lastPrediction: MLPrediction | null;
  };
  scalpingEngine: {
    isActive: boolean;
    opportunitiesDetected: number;
    avgExecutionTime: number; // ms
    successRate: number;
    activeOpportunities: ScalpingOpportunity[];
  };
  quantAnalysis: {
    backtestingActive: boolean;
    modelsRunning: string[];
    featureImportance: {
      [feature: string]: number;
    };
    performanceMetrics: {
      sharpeRatio: number;
      maxDrawdown: number;
      winRate: number;
      avgGainPerTrade: number;
    };
  };
  systemHealth: {
    cpuUsage: number;
    memoryUsage: number;
    networkLatency: number;
    overallStatus: 'OPTIMAL' | 'WARNING' | 'CRITICAL';
  };
}

const MLTradingEngine: React.FC = () => {
  const [engineData, setEngineData] = useState<MLTradingEngineData | null>(null);
  const [selectedTab, setSelectedTab] = useState<'REALTIME' | 'ML' | 'SCALPING' | 'DATABASE'>('REALTIME');
  const [isLoading, setIsLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Simulate WebSocket connection
    const connectWebSocket = () => {
      // In production, this would connect to TradingView or Investing.com WebSocket
      const simulateWebSocket = () => {
        const generateTickData = (): TickData => ({
          symbol: 'WDO',
          timestamp: Date.now(),
          price: 4580.25 + (Math.random() - 0.5) * 2,
          volume: Math.floor(Math.random() * 500) + 10,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
          aggressor: Math.random() > 0.4,
          tradeId: `T${Date.now()}${Math.floor(Math.random() * 1000)}`,
          sequence: Date.now()
        });

        const generateLevel2Data = (): Level2Data => ({
          symbol: 'WDO',
          timestamp: Date.now(),
          bids: Array.from({ length: 10 }, (_, i) => ({
            price: 4580.25 - (i * 0.25),
            volume: Math.floor(Math.random() * 1000) + 50,
            orders: Math.floor(Math.random() * 20) + 1,
            mpid: Math.random() > 0.7 ? `MM${Math.floor(Math.random() * 10)}` : undefined
          })),
          asks: Array.from({ length: 10 }, (_, i) => ({
            price: 4580.50 + (i * 0.25),
            volume: Math.floor(Math.random() * 1000) + 50,
            orders: Math.floor(Math.random() * 20) + 1,
            mpid: Math.random() > 0.7 ? `MM${Math.floor(Math.random() * 10)}` : undefined
          })),
          sequence: Date.now()
        });

        return {
          tick: generateTickData(),
          level2: generateLevel2Data()
        };
      };

      return simulateWebSocket;
    };

    const generateEngineData = (): MLTradingEngineData => {
      const wsData = connectWebSocket()();
      const currentPrice = wsData.tick.price;
      
      // Real-time indicators calculation
      const vwapValue = currentPrice + (Math.random() - 0.5) * 1;
      const buyFlow = Math.random() * 100000;
      const sellFlow = Math.random() * 100000;
      
      const indicators: RealtimeIndicators = {
        vwap: {
          value: vwapValue,
          deviation: Math.abs(currentPrice - vwapValue) / vwapValue * 100,
          volume: buyFlow + sellFlow
        },
        volatility: {
          realized: 0.15 + Math.random() * 0.25,
          implied: 0.18 + Math.random() * 0.3,
          atr: 5 + Math.random() * 10
        },
        orderFlow: {
          buyFlow,
          sellFlow,
          netFlow: buyFlow - sellFlow,
          aggression: Math.random() * 100
        },
        momentum: {
          short: (Math.random() - 0.5) * 100,
          medium: (Math.random() - 0.5) * 50,
          acceleration: (Math.random() - 0.5) * 20
        }
      };

      // ML Prediction generation
      const mlPrediction: MLPrediction = {
        timestamp: Date.now(),
        symbol: 'WDO',
        direction: Math.random() > 0.6 ? 'UP' : Math.random() > 0.3 ? 'DOWN' : 'NEUTRAL',
        confidence: 0.75 + Math.random() * 0.25,
        targetPrice: currentPrice + (Math.random() - 0.5) * 3,
        timeHorizon: 15 + Math.random() * 45, // 15-60 seconds
        features: {
          tapeReading: Math.random() * 100,
          volumeProfile: Math.random() * 100,
          orderFlowImbalance: Math.random() * 100,
          institutionalActivity: Math.random() * 100,
          technicalSignals: Math.random() * 100
        },
        riskScore: Math.random() * 50
      };

      // Scalping opportunities
      const scalpingTypes = ['TAPE_AGGRESSION', 'HIDDEN_LIQUIDITY', 'FAKE_ORDER_REMOVAL', 'MOMENTUM_BREAKOUT'] as const;
      const activeOpportunities: ScalpingOpportunity[] = Array.from({ length: 2 + Math.floor(Math.random() * 4) }, (_, i) => ({
        id: `scalp_${Date.now()}_${i}`,
        timestamp: Date.now() - Math.random() * 30000,
        type: scalpingTypes[Math.floor(Math.random() * scalpingTypes.length)],
        direction: Math.random() > 0.5 ? 'LONG' : 'SHORT',
        entryPrice: currentPrice + (Math.random() - 0.5) * 1,
        targetPoints: 0.5 + Math.random() * 1.5, // 0.5 to 2 points
        stopPoints: 0.3 + Math.random() * 0.7,
        confidence: 0.7 + Math.random() * 0.3,
        speed: Math.random() > 0.7 ? 'INSTANT' : Math.random() > 0.4 ? 'FAST' : 'MEDIUM',
        reasoning: [
          'Agressão detectada no tape',
          'Volume institucional confirmando',
          'Remoção de ordens falsas'
        ]
      }));

      return {
        websocketStatus: {
          tradingView: Math.random() > 0.1 ? 'CONNECTED' : 'DISCONNECTED',
          investing: Math.random() > 0.1 ? 'CONNECTED' : 'DISCONNECTED',
          latency: 5 + Math.random() * 15, // 5-20ms
          messagesPerSecond: 50 + Math.random() * 150
        },
        realtimeData: {
          latestTick: wsData.tick,
          level2: wsData.level2,
          indicators,
          dataQuality: 85 + Math.random() * 15
        },
        database: {
          connected: Math.random() > 0.05,
          ticksStored: 15000000 + Math.floor(Math.random() * 5000000),
          latestTick: wsData.tick,
          storageRate: 180 + Math.random() * 70, // ticks per second
          queryLatency: 1 + Math.random() * 5,
          indexHealth: Math.random() > 0.8 ? 'GOOD' : Math.random() > 0.4 ? 'DEGRADED' : 'POOR'
        },
        mlEngine: {
          isActive: Math.random() > 0.1,
          modelsLoaded: 7,
          predictionsPerSecond: 2 + Math.random() * 8,
          accuracy: {
            shortTerm: 0.72 + Math.random() * 0.18,
            microTrend: 0.68 + Math.random() * 0.22,
            overall: 0.65 + Math.random() * 0.25
          },
          lastPrediction: mlPrediction
        },
        scalpingEngine: {
          isActive: Math.random() > 0.05,
          opportunitiesDetected: Math.floor(Math.random() * 20) + 5,
          avgExecutionTime: 12 + Math.random() * 25, // ms
          successRate: 0.68 + Math.random() * 0.22,
          activeOpportunities
        },
        quantAnalysis: {
          backtestingActive: Math.random() > 0.3,
          modelsRunning: ['LSTM_Momentum', 'RandomForest_TapeReading', 'XGBoost_OrderFlow', 'CNN_Level2'],
          featureImportance: {
            'Order Flow Imbalance': 0.24,
            'Tape Aggression': 0.19,
            'VWAP Deviation': 0.15,
            'Volume Profile': 0.13,
            'Institutional Activity': 0.12,
            'Technical Indicators': 0.10,
            'Time of Day': 0.07
          },
          performanceMetrics: {
            sharpeRatio: 1.8 + Math.random() * 1.2,
            maxDrawdown: -(0.05 + Math.random() * 0.1),
            winRate: 0.65 + Math.random() * 0.2,
            avgGainPerTrade: 0.4 + Math.random() * 0.6
          }
        },
        systemHealth: {
          cpuUsage: 25 + Math.random() * 40,
          memoryUsage: 35 + Math.random() * 30,
          networkLatency: 8 + Math.random() * 12,
          overallStatus: Math.random() > 0.8 ? 'OPTIMAL' : Math.random() > 0.3 ? 'WARNING' : 'CRITICAL'
        }
      };
    };

    const updateEngine = () => {
      setEngineData(generateEngineData());
      setIsLoading(false);
    };

    updateEngine();
    const interval = setInterval(updateEngine, 1000); // Update every second for real-time feel

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'CONNECTED':
      case 'OPTIMAL':
      case 'GOOD': return 'text-green-400';
      case 'WARNING':
      case 'DEGRADED': return 'text-yellow-400';
      case 'CRITICAL':
      case 'DISCONNECTED':
      case 'POOR': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    return num.toLocaleString('pt-BR', { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}K`;
    return volume.toString();
  };

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-800 rounded w-64"></div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-800 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!engineData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Brain className="text-purple-400" size={32} />
          <div>
            <h3 className="text-xl font-semibold text-white">🧠 ML Trading Engine</h3>
            <div className="text-sm text-gray-300">Machine Learning • Real-time • Scalping</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-2 rounded flex items-center gap-2 ${
            engineData.systemHealth.overallStatus === 'OPTIMAL' ? 'bg-green-500/20 text-green-400' :
            engineData.systemHealth.overallStatus === 'WARNING' ? 'bg-yellow-500/20 text-yellow-400' :
            'bg-red-500/20 text-red-400'
          }`}>
            <Activity size={16} />
            {engineData.systemHealth.overallStatus}
          </div>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            <Wifi size={16} className={getStatusColor(engineData.websocketStatus.tradingView)} />
            <span className="text-white font-medium">WebSocket</span>
          </div>
          <div className="text-2xl font-mono text-white">{engineData.websocketStatus.latency.toFixed(0)}ms</div>
          <div className="text-sm text-gray-400">
            {engineData.websocketStatus.messagesPerSecond.toFixed(0)} msg/s
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            <Database size={16} className={getStatusColor(engineData.database.connected ? 'CONNECTED' : 'DISCONNECTED')} />
            <span className="text-white font-medium">MongoDB</span>
          </div>
          <div className="text-2xl font-mono text-white">{formatVolume(engineData.database.ticksStored)}</div>
          <div className="text-sm text-gray-400">
            {engineData.database.storageRate.toFixed(0)} ticks/s
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            <Brain size={16} className="text-purple-400" />
            <span className="text-white font-medium">ML Engine</span>
          </div>
          <div className="text-2xl font-mono text-white">{(engineData.mlEngine.accuracy.overall * 100).toFixed(0)}%</div>
          <div className="text-sm text-gray-400">
            {engineData.mlEngine.predictionsPerSecond.toFixed(1)} pred/s
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-yellow-400" />
            <span className="text-white font-medium">Scalping</span>
          </div>
          <div className="text-2xl font-mono text-white">{engineData.scalpingEngine.activeOpportunities.length}</div>
          <div className="text-sm text-gray-400">
            {(engineData.scalpingEngine.successRate * 100).toFixed(0)}% success
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-2 border-b border-gray-700">
        {(['REALTIME', 'ML', 'SCALPING', 'DATABASE'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg ${
              selectedTab === tab
                ? 'bg-blue-500 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {tab === 'REALTIME' ? '📊 Tempo Real' :
             tab === 'ML' ? '🧠 Machine Learning' :
             tab === 'SCALPING' ? '⚡ Scalping' :
             '🗄️ Banco de Dados'}
          </button>
        ))}
      </div>

      {/* Real-time Data Tab */}
      {selectedTab === 'REALTIME' && (
        <div className="space-y-6">
          {/* WebSocket Connections */}
          <div className="bg-gray-800 p-6 rounded">
            <h4 className="text-white font-medium flex items-center gap-2 mb-4">
              <Wifi size={20} />
              Conexões WebSocket
            </h4>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">TradingView</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      engineData.websocketStatus.tradingView === 'CONNECTED' ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <span className={getStatusColor(engineData.websocketStatus.tradingView)}>
                      {engineData.websocketStatus.tradingView}
                    </span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Investing.com</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      engineData.websocketStatus.investing === 'CONNECTED' ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <span className={getStatusColor(engineData.websocketStatus.investing)}>
                      {engineData.websocketStatus.investing}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Latência</span>
                  <span className="text-white font-mono">{engineData.websocketStatus.latency.toFixed(1)}ms</span>
                </div>
                
                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Msgs/seg</span>
                  <span className="text-white font-mono">{engineData.websocketStatus.messagesPerSecond.toFixed(0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Level 2 & Times & Sales */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-gray-800 p-6 rounded">
              <h4 className="text-white font-medium mb-4">📊 Level 2 Data</h4>
              {engineData.realtimeData.level2 && (
                <div className="space-y-2">
                  <div className="text-sm text-gray-400 mb-2">ASK (Vendas)</div>
                  {engineData.realtimeData.level2.asks.slice(0, 5).reverse().map((ask, i) => (
                    <div key={i} className="flex justify-between p-2 bg-red-400/10 rounded text-sm">
                      <span className="text-red-400 font-mono">{ask.price.toFixed(2)}</span>
                      <span className="text-white font-mono">{formatVolume(ask.volume)}</span>
                      <span className="text-gray-400">{ask.orders}</span>
                      {ask.mpid && <span className="text-yellow-400 text-xs">{ask.mpid}</span>}
                    </div>
                  ))}
                  
                  <div className="text-sm text-gray-400 mt-4 mb-2">BID (Compras)</div>
                  {engineData.realtimeData.level2.bids.slice(0, 5).map((bid, i) => (
                    <div key={i} className="flex justify-between p-2 bg-green-400/10 rounded text-sm">
                      <span className="text-green-400 font-mono">{bid.price.toFixed(2)}</span>
                      <span className="text-white font-mono">{formatVolume(bid.volume)}</span>
                      <span className="text-gray-400">{bid.orders}</span>
                      {bid.mpid && <span className="text-yellow-400 text-xs">{bid.mpid}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-gray-800 p-6 rounded">
              <h4 className="text-white font-medium mb-4">⚡ Indicadores em Tempo Real</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400 text-sm">VWAP</span>
                    <span className="text-white font-mono">{engineData.realtimeData.indicators.vwap.value.toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    Desvio: {engineData.realtimeData.indicators.vwap.deviation.toFixed(3)}%
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400 text-sm">ATR</span>
                    <span className="text-white font-mono">{engineData.realtimeData.indicators.volatility.atr.toFixed(2)}</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400 text-sm">Fluxo Líquido</span>
                    <span className={`font-mono ${
                      engineData.realtimeData.indicators.orderFlow.netFlow > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {engineData.realtimeData.indicators.orderFlow.netFlow > 0 ? '+' : ''}
                      {formatVolume(Math.abs(engineData.realtimeData.indicators.orderFlow.netFlow))}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400 text-sm">Agressão</span>
                    <span className="text-white font-mono">{engineData.realtimeData.indicators.orderFlow.aggression.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${engineData.realtimeData.indicators.orderFlow.aggression}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-gray-400 text-sm">Momentum</span>
                    <span className={`font-mono ${
                      engineData.realtimeData.indicators.momentum.short > 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {engineData.realtimeData.indicators.momentum.short.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ML Engine Tab */}
      {selectedTab === 'ML' && (
        <div className="space-y-6">
          {/* ML Status */}
          <div className="bg-gray-800 p-6 rounded">
            <h4 className="text-white font-medium flex items-center gap-2 mb-4">
              <Brain size={20} />
              Status do Motor ML
            </h4>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-mono text-purple-400">{engineData.mlEngine.modelsLoaded}</div>
                <div className="text-sm text-gray-400">Modelos Carregados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-mono text-blue-400">{engineData.mlEngine.predictionsPerSecond.toFixed(1)}</div>
                <div className="text-sm text-gray-400">Predições/seg</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-mono text-green-400">
                  {(engineData.mlEngine.accuracy.overall * 100).toFixed(0)}%
                </div>
                <div className="text-sm text-gray-400">Acurácia Geral</div>
              </div>
            </div>
          </div>

          {/* Latest Prediction */}
          {engineData.mlEngine.lastPrediction && (
            <div className="bg-gray-800 p-6 rounded">
              <h4 className="text-white font-medium mb-4">🎯 Última Predição ML</h4>
              
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                    <span className="text-gray-300">Direção</span>
                    <div className={`px-3 py-1 rounded font-bold ${
                      engineData.mlEngine.lastPrediction.direction === 'UP' ? 'bg-green-500 text-white' :
                      engineData.mlEngine.lastPrediction.direction === 'DOWN' ? 'bg-red-500 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {engineData.mlEngine.lastPrediction.direction === 'UP' ? '📈 ALTA' :
                       engineData.mlEngine.lastPrediction.direction === 'DOWN' ? '📉 BAIXA' :
                       '⚖️ NEUTRO'}
                    </div>
                  </div>

                  <div className="flex justify-between p-3 bg-gray-700 rounded">
                    <span className="text-gray-300">Confiança</span>
                    <span className="text-white font-mono">
                      {(engineData.mlEngine.lastPrediction.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  <div className="flex justify-between p-3 bg-gray-700 rounded">
                    <span className="text-gray-300">Preço Alvo</span>
                    <span className="text-white font-mono">
                      {engineData.mlEngine.lastPrediction.targetPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between p-3 bg-gray-700 rounded">
                    <span className="text-gray-300">Horizonte</span>
                    <span className="text-white font-mono">
                      {engineData.mlEngine.lastPrediction.timeHorizon}s
                    </span>
                  </div>
                </div>

                <div>
                  <h5 className="text-white font-medium mb-3">Features Importantes</h5>
                  <div className="space-y-2">
                    {Object.entries(engineData.mlEngine.lastPrediction.features).map(([feature, value]) => (
                      <div key={feature} className="flex justify-between items-center">
                        <span className="text-gray-300 text-sm">
                          {feature.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-700 rounded-full h-2">
                            <div
                              className="bg-purple-400 h-2 rounded-full"
                              style={{ width: `${value}%` }}
                            />
                          </div>
                          <span className="text-white font-mono text-sm w-10">
                            {value.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Feature Importance */}
          <div className="bg-gray-800 p-6 rounded">
            <h4 className="text-white font-medium mb-4">📊 Importância das Features</h4>
            <div className="space-y-3">
              {Object.entries(engineData.quantAnalysis.featureImportance)
                .sort(([,a], [,b]) => b - a)
                .map(([feature, importance]) => (
                <div key={feature} className="flex items-center justify-between">
                  <span className="text-gray-300">{feature}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-32 bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-400 h-2 rounded-full"
                        style={{ width: `${importance * 100}%` }}
                      />
                    </div>
                    <span className="text-white font-mono w-12">
                      {(importance * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Scalping Engine Tab */}
      {selectedTab === 'SCALPING' && (
        <div className="space-y-6">
          {/* Scalping Performance */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 p-4 rounded text-center">
              <div className="text-2xl font-mono text-yellow-400">
                {engineData.scalpingEngine.opportunitiesDetected}
              </div>
              <div className="text-sm text-gray-400">Oportunidades</div>
            </div>
            <div className="bg-gray-800 p-4 rounded text-center">
              <div className="text-2xl font-mono text-green-400">
                {engineData.scalpingEngine.avgExecutionTime.toFixed(0)}ms
              </div>
              <div className="text-sm text-gray-400">Exec. Média</div>
            </div>
            <div className="bg-gray-800 p-4 rounded text-center">
              <div className="text-2xl font-mono text-blue-400">
                {(engineData.scalpingEngine.successRate * 100).toFixed(0)}%
              </div>
              <div className="text-sm text-gray-400">Taxa Sucesso</div>
            </div>
            <div className="bg-gray-800 p-4 rounded text-center">
              <div className="text-2xl font-mono text-white">
                {engineData.scalpingEngine.activeOpportunities.length}
              </div>
              <div className="text-sm text-gray-400">Ativas Agora</div>
            </div>
          </div>

          {/* Active Opportunities */}
          <div className="bg-gray-800 p-6 rounded">
            <h4 className="text-white font-medium mb-4">⚡ Oportunidades de Scalping Ativas</h4>
            <div className="space-y-3">
              {engineData.scalpingEngine.activeOpportunities.map((opportunity) => (
                <div
                  key={opportunity.id}
                  className={`p-4 rounded border ${
                    opportunity.confidence > 0.8 ? 'border-green-400/30 bg-green-400/5' :
                    opportunity.confidence > 0.6 ? 'border-yellow-400/30 bg-yellow-400/5' :
                    'border-gray-600 bg-gray-700/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`px-2 py-1 rounded text-xs ${
                        opportunity.type === 'TAPE_AGGRESSION' ? 'bg-red-400/20 text-red-400' :
                        opportunity.type === 'HIDDEN_LIQUIDITY' ? 'bg-blue-400/20 text-blue-400' :
                        opportunity.type === 'FAKE_ORDER_REMOVAL' ? 'bg-purple-400/20 text-purple-400' :
                        'bg-green-400/20 text-green-400'
                      }`}>
                        {opportunity.type.replace('_', ' ')}
                      </div>
                      
                      <div className={`px-2 py-1 rounded text-xs font-bold ${
                        opportunity.direction === 'LONG' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {opportunity.direction}
                      </div>

                      <div className={`px-2 py-1 rounded text-xs ${
                        opportunity.speed === 'INSTANT' ? 'bg-red-400/20 text-red-400' :
                        opportunity.speed === 'FAST' ? 'bg-yellow-400/20 text-yellow-400' :
                        'bg-blue-400/20 text-blue-400'
                      }`}>
                        {opportunity.speed}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-white font-mono">{opportunity.entryPrice.toFixed(2)}</div>
                      <div className="text-xs text-gray-400">
                        {(opportunity.confidence * 100).toFixed(0)}% conf
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3">
                    <div>
                      <span className="text-gray-400 text-sm">Target:</span>
                      <div className="text-green-400 font-mono">+{opportunity.targetPoints.toFixed(1)} pts</div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">Stop:</span>
                      <div className="text-red-400 font-mono">-{opportunity.stopPoints.toFixed(1)} pts</div>
                    </div>
                    <div>
                      <span className="text-gray-400 text-sm">R:R:</span>
                      <div className="text-blue-400 font-mono">
                        1:{(opportunity.targetPoints / opportunity.stopPoints).toFixed(1)}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-300">
                    <strong>Reasoning:</strong> {opportunity.reasoning.join(' • ')}
                  </div>
                  
                  <div className="text-xs text-gray-500 mt-2">
                    Detectado: {new Date(opportunity.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Database Tab */}
      {selectedTab === 'DATABASE' && (
        <div className="space-y-6">
          {/* MongoDB Status */}
          <div className="bg-gray-800 p-6 rounded">
            <h4 className="text-white font-medium flex items-center gap-2 mb-4">
              <Database size={20} />
              MongoDB Tick Data Storage
            </h4>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      engineData.database.connected ? 'bg-green-400' : 'bg-red-400'
                    }`} />
                    <span className={getStatusColor(engineData.database.connected ? 'CONNECTED' : 'DISCONNECTED')}>
                      {engineData.database.connected ? 'CONECTADO' : 'DESCONECTADO'}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Ticks Armazenados</span>
                  <span className="text-white font-mono">{formatVolume(engineData.database.ticksStored)}</span>
                </div>

                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Taxa Armazenamento</span>
                  <span className="text-white font-mono">{engineData.database.storageRate.toFixed(0)}/s</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Latência Consulta</span>
                  <span className="text-white font-mono">{engineData.database.queryLatency.toFixed(1)}ms</span>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Saúde dos Índices</span>
                  <span className={getStatusColor(engineData.database.indexHealth)}>
                    {engineData.database.indexHealth}
                  </span>
                </div>

                <div className="p-3 bg-gray-700 rounded">
                  <span className="text-gray-300">Último Tick</span>
                  {engineData.database.latestTick && (
                    <div className="mt-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Preço:</span>
                        <span className="text-white font-mono">{engineData.database.latestTick.price.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Volume:</span>
                        <span className="text-white font-mono">{engineData.database.latestTick.volume}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Lado:</span>
                        <span className={`font-mono ${
                          engineData.database.latestTick.side === 'BUY' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {engineData.database.latestTick.side}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Backtesting & Models */}
          <div className="bg-gray-800 p-6 rounded">
            <h4 className="text-white font-medium mb-4">🔄 Backtesting & Modelos Quantitativos</h4>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h5 className="text-white font-medium mb-3">Modelos em Execução</h5>
                <div className="space-y-2">
                  {engineData.quantAnalysis.modelsRunning.map((model, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                      <span className="text-gray-300">{model}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                        <span className="text-green-400 text-sm">Rodando</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-300">Backtesting</span>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        engineData.quantAnalysis.backtestingActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'
                      }`} />
                      <span className={engineData.quantAnalysis.backtestingActive ? 'text-green-400' : 'text-gray-400'}>
                        {engineData.quantAnalysis.backtestingActive ? 'ATIVO' : 'PAUSADO'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-white font-medium mb-3">Métricas de Performance</h5>
                <div className="space-y-3">
                  <div className="flex justify-between p-2 bg-gray-700 rounded">
                    <span className="text-gray-300">Sharpe Ratio</span>
                    <span className="text-white font-mono">
                      {engineData.quantAnalysis.performanceMetrics.sharpeRatio.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex justify-between p-2 bg-gray-700 rounded">
                    <span className="text-gray-300">Max Drawdown</span>
                    <span className="text-red-400 font-mono">
                      {(engineData.quantAnalysis.performanceMetrics.maxDrawdown * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex justify-between p-2 bg-gray-700 rounded">
                    <span className="text-gray-300">Win Rate</span>
                    <span className="text-green-400 font-mono">
                      {(engineData.quantAnalysis.performanceMetrics.winRate * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex justify-between p-2 bg-gray-700 rounded">
                    <span className="text-gray-300">Ganho/Trade</span>
                    <span className="text-blue-400 font-mono">
                      {engineData.quantAnalysis.performanceMetrics.avgGainPerTrade.toFixed(2)} pts
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Health Footer */}
      <div className="bg-gray-800 p-4 rounded">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <Server size={16} />
              <span className="text-gray-300">CPU: </span>
              <span className="text-white font-mono">{engineData.systemHealth.cpuUsage.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-300">RAM: </span>
              <span className="text-white font-mono">{engineData.systemHealth.memoryUsage.toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-300">Latência: </span>
              <span className="text-white font-mono">{engineData.systemHealth.networkLatency.toFixed(0)}ms</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-300">Qualidade dos Dados: </span>
            <span className="text-white font-mono">{engineData.realtimeData.dataQuality.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MLTradingEngine;