/**
 * Nelogica API Integration Service
 * Handles connection and data streaming from Nelogica/Profit Pro platform
 */

import EventEmitter from 'eventemitter3';
import WebSocket from 'ws';
import axios, { AxiosInstance } from 'axios';
import { Logger } from 'winston';
import {
  NelogicaConfig,
  ConnectionStatus,
  MarketData,
  OrderBook,
  TapeEntry,
  TradeEntry,
  Position,
  NelogicaError
} from '@/types/trading';

interface NelogicaCredentials {
  token?: string;
  sessionId?: string;
  userId?: string;
  expiresAt?: number;
}

interface NelogicaSubscription {
  symbol: string;
  type: 'market_data' | 'order_book' | 'tape' | 'positions';
  active: boolean;
}

export class NelogicaService extends EventEmitter {
  private config: NelogicaConfig;
  private logger: Logger;
  
  // Connection management
  private httpClient: AxiosInstance;
  private websocket: WebSocket | null = null;
  private connectionStatus: ConnectionStatus;
  private credentials: NelogicaCredentials = {};
  
  // Subscriptions
  private subscriptions: Map<string, NelogicaSubscription> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  
  // Data caching
  private currentMarketData: MarketData | null = null;
  private currentOrderBook: OrderBook | null = null;
  private currentPositions: Position[] = [];
  
  // Performance metrics
  private messagesReceived: number = 0;
  private lastMessageTime: number = 0;
  private averageLatency: number = 0;

  constructor(config: NelogicaConfig, logger: Logger) {
    super();
    
    this.config = config;
    this.logger = logger.child({ component: 'NelogicaService' });
    
    this.connectionStatus = {
      isConnected: false,
      status: 'disconnected',
      lastHeartbeat: 'Never'
    };
    
    // Initialize HTTP client
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'TapeVision-Trading-Bot/1.0'
      }
    });
    
    this.setupHttpInterceptors();
    
    this.logger.info('Nelogica Service initialized', {
      apiUrl: config.apiUrl,
      environment: config.environment,
      autoReconnect: config.autoReconnect
    });
  }

  private setupHttpInterceptors(): void {
    // Request interceptor
    this.httpClient.interceptors.request.use(
      (config) => {
        if (this.credentials.token) {
          config.headers.Authorization = `Bearer ${this.credentials.token}`;
        }
        return config;
      },
      (error) => {
        this.logger.error('HTTP request error', error);
        return Promise.reject(error);
      }
    );
    
    // Response interceptor
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.logger.warn('Authentication expired, attempting refresh');
          this.refreshAuthentication().catch((refreshError) => {
            this.logger.error('Failed to refresh authentication', refreshError);
          });
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Authenticate with Nelogica API
   */
  public async authenticate(): Promise<void> {
    try {
      this.logger.info('Authenticating with Nelogica API');
      
      const authData = {
        username: this.config.username,
        password: this.config.password,
        environment: this.config.environment
      };
      
      const response = await this.httpClient.post('/auth/login', authData);
      
      if (response.data.success) {
        this.credentials = {
          token: response.data.token,
          sessionId: response.data.sessionId,
          userId: response.data.userId,
          expiresAt: Date.now() + (response.data.expiresIn * 1000)
        };
        
        this.logger.info('Authentication successful', {
          userId: this.credentials.userId,
          sessionId: this.credentials.sessionId
        });
        
        this.emit('authenticated', this.credentials);
      } else {
        throw new NelogicaError('Authentication failed', response.data);
      }
      
    } catch (error) {
      this.logger.error('Authentication failed', error);
      throw new NelogicaError('Failed to authenticate with Nelogica API', error);
    }
  }

  /**
   * Refresh authentication token
   */
  private async refreshAuthentication(): Promise<void> {
    try {
      if (!this.credentials.sessionId) {
        throw new Error('No session ID available for refresh');
      }
      
      const response = await this.httpClient.post('/auth/refresh', {
        sessionId: this.credentials.sessionId
      });
      
      if (response.data.success) {
        this.credentials.token = response.data.token;
        this.credentials.expiresAt = Date.now() + (response.data.expiresIn * 1000);
        
        this.logger.info('Authentication refreshed');
      } else {
        // Re-authenticate if refresh fails
        await this.authenticate();
      }
      
    } catch (error) {
      this.logger.error('Failed to refresh authentication', error);
      await this.authenticate();
    }
  }

  /**
   * Connect to Nelogica WebSocket
   */
  public async connect(): Promise<void> {
    try {
      if (this.connectionStatus.isConnected) {
        this.logger.warn('Already connected to Nelogica');
        return;
      }
      
      // Authenticate first if not already done
      if (!this.credentials.token) {
        await this.authenticate();
      }
      
      this.logger.info('Connecting to Nelogica WebSocket');
      
      const wsUrl = `${this.config.apiUrl.replace('http', 'ws')}/ws`;
      
      this.websocket = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.credentials.token}`,
          'X-Session-Id': this.credentials.sessionId
        }
      });
      
      this.setupWebSocketHandlers();
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new NelogicaError('WebSocket connection timeout'));
        }, this.config.timeout);
        
        this.websocket!.once('open', () => {
          clearTimeout(timeout);
          resolve(void 0);
        });
        
        this.websocket!.once('error', (error) => {
          clearTimeout(timeout);
          reject(new NelogicaError('WebSocket connection failed', error));
        });
      });
      
      this.updateConnectionStatus('connected');
      this.startHeartbeat();
      
      this.logger.info('Connected to Nelogica WebSocket successfully');
      
    } catch (error) {
      this.logger.error('Failed to connect to Nelogica', error);
      this.updateConnectionStatus('error', error.message);
      throw error;
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.websocket) return;
    
    this.websocket.on('open', () => {
      this.logger.info('WebSocket connection opened');
      this.reconnectAttempts = 0;
      this.updateConnectionStatus('connected');
      this.emit('connected');
    });
    
    this.websocket.on('message', (data: WebSocket.Data) => {
      this.handleWebSocketMessage(data);
    });
    
    this.websocket.on('close', (code: number, reason: string) => {
      this.logger.warn('WebSocket connection closed', { code, reason });
      this.updateConnectionStatus('disconnected');
      this.stopHeartbeat();
      
      if (this.config.autoReconnect && this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
        this.scheduleReconnect();
      }
      
      this.emit('disconnected', { code, reason });
    });
    
    this.websocket.on('error', (error: Error) => {
      this.logger.error('WebSocket error', error);
      this.updateConnectionStatus('error', error.message);
      this.emit('error', error);
    });
    
    this.websocket.on('pong', () => {
      this.updateConnectionStatus('connected');
      this.connectionStatus.lastHeartbeat = new Date().toLocaleTimeString('pt-BR');
    });
  }

  private handleWebSocketMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());
      this.messagesReceived++;
      this.lastMessageTime = Date.now();
      
      // Calculate latency if timestamp is provided
      if (message.timestamp) {
        const latency = Date.now() - message.timestamp;
        this.averageLatency = (this.averageLatency + latency) / 2;
      }
      
      switch (message.type) {
        case 'market_data':
          this.handleMarketData(message.data);
          break;
          
        case 'order_book':
          this.handleOrderBook(message.data);
          break;
          
        case 'tape':
          this.handleTape(message.data);
          break;
          
        case 'positions':
          this.handlePositions(message.data);
          break;
          
        case 'trade_update':
          this.handleTradeUpdate(message.data);
          break;
          
        case 'error':
          this.handleError(message.data);
          break;
          
        case 'heartbeat':
          this.handleHeartbeat(message.data);
          break;
          
        default:
          this.logger.debug('Unknown message type', message.type);
      }
      
    } catch (error) {
      this.logger.error('Error parsing WebSocket message', error);
    }
  }

  private handleMarketData(data: any): void {
    try {
      const marketData: MarketData = {
        price: data.price,
        priceChange: data.priceChange || 0,
        volume: data.volume,
        volatility: data.volatility || 1.0,
        spread: data.spread || Math.abs(data.ask - data.bid),
        sessionTime: new Date().toLocaleTimeString('pt-BR'),
        marketPhase: data.marketPhase || 'open',
        liquidityLevel: data.liquidityLevel || 'medium',
        orderBookImbalance: data.orderBookImbalance || 0,
        timestamp: data.timestamp || Date.now(),
        bid: data.bid,
        ask: data.ask,
        last: data.last || data.price,
        high: data.high || data.price,
        low: data.low || data.price
      };
      
      this.currentMarketData = marketData;
      this.emit('market-data', marketData);
      
    } catch (error) {
      this.logger.error('Error processing market data', error);
    }
  }

  private handleOrderBook(data: any): void {
    try {
      const orderBook: OrderBook = {
        bids: data.bids.map((bid: any) => ({
          price: bid.price,
          volume: bid.volume,
          orders: bid.orders || 1,
          timestamp: Date.now()
        })),
        asks: data.asks.map((ask: any) => ({
          price: ask.price,
          volume: ask.volume,
          orders: ask.orders || 1,
          timestamp: Date.now()
        })),
        timestamp: data.timestamp || Date.now(),
        spread: data.spread || (data.asks[0]?.price - data.bids[0]?.price) || 0,
        depth: Math.min(data.bids.length, data.asks.length)
      };
      
      this.currentOrderBook = orderBook;
      this.emit('order-book', orderBook);
      
    } catch (error) {
      this.logger.error('Error processing order book', error);
    }
  }

  private handleTape(data: any): void {
    try {
      const tapeEntries: TapeEntry[] = data.entries.map((entry: any) => ({
        timestamp: entry.timestamp,
        price: entry.price,
        volume: entry.volume,
        aggressor: entry.aggressor || 'unknown',
        orderType: entry.orderType || 'market',
        isLarge: entry.volume >= 50, // Configure threshold
        isDominant: entry.volume >= 100, // Configure threshold
        absorption: entry.absorption || false
      }));
      
      this.emit('tape', tapeEntries);
      
    } catch (error) {
      this.logger.error('Error processing tape data', error);
    }
  }

  private handlePositions(data: any): void {
    try {
      this.currentPositions = data.positions.map((pos: any) => ({
        id: pos.id,
        symbol: pos.symbol,
        side: pos.side,
        size: pos.size,
        entryPrice: pos.entryPrice,
        currentPrice: pos.currentPrice,
        pnl: pos.pnl,
        unrealizedPnl: pos.unrealizedPnl,
        stopLoss: pos.stopLoss,
        takeProfit: pos.takeProfit,
        entryTime: pos.entryTime,
        duration: Date.now() - pos.entryTime
      }));
      
      this.emit('positions-updated', this.currentPositions);
      
    } catch (error) {
      this.logger.error('Error processing positions', error);
    }
  }

  private handleTradeUpdate(data: any): void {
    this.emit('trade-update', data);
  }

  private handleError(data: any): void {
    this.logger.error('Nelogica API error', data);
    this.emit('api-error', data);
  }

  private handleHeartbeat(data: any): void {
    this.connectionStatus.lastHeartbeat = new Date().toLocaleTimeString('pt-BR');
    this.emit('heartbeat', data);
  }

  private updateConnectionStatus(status: ConnectionStatus['status'], errorMessage?: string): void {
    this.connectionStatus = {
      isConnected: status === 'connected',
      status,
      lastHeartbeat: status === 'connected' ? new Date().toLocaleTimeString('pt-BR') : this.connectionStatus.lastHeartbeat,
      connectionTime: status === 'connected' ? new Date().toLocaleTimeString('pt-BR') : this.connectionStatus.connectionTime,
      errorMessage
    };
    
    this.emit('connection-status', this.connectionStatus);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.websocket?.readyState === WebSocket.OPEN) {
        this.websocket.ping();
      }
    }, 30000); // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000); // Exponential backoff, max 30s
    
    this.logger.info(`Scheduling reconnection in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch((error) => {
        this.logger.error('Reconnection failed', error);
      });
    }, delay);
  }

  /**
   * Subscribe to market data
   */
  public async subscribe(symbol: string, dataTypes: string[]): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      throw new NelogicaError('WebSocket not connected');
    }
    
    for (const dataType of dataTypes) {
      const subscription: NelogicaSubscription = {
        symbol,
        type: dataType as any,
        active: true
      };
      
      const subscriptionKey = `${symbol}:${dataType}`;
      this.subscriptions.set(subscriptionKey, subscription);
      
      const message = {
        type: 'subscribe',
        symbol,
        dataType,
        timestamp: Date.now()
      };
      
      this.websocket.send(JSON.stringify(message));
      
      this.logger.info('Subscribed to data', { symbol, dataType });
    }
  }

  /**
   * Execute a trade
   */
  public async executeTrade(trade: Partial<TradeEntry>): Promise<TradeEntry> {
    try {
      if (!this.credentials.token) {
        throw new NelogicaError('Not authenticated');
      }
      
      const orderData = {
        symbol: trade.symbol,
        action: trade.action,
        quantity: trade.quantity,
        price: trade.price,
        orderType: 'market', // or 'limit'
        timeInForce: 'IOC' // Immediate or Cancel
      };
      
      const response = await this.httpClient.post('/orders', orderData);
      
      if (response.data.success) {
        const executedTrade: TradeEntry = {
          id: response.data.orderId,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          action: trade.action!,
          symbol: trade.symbol!,
          price: response.data.executionPrice,
          quantity: trade.quantity,
          reason: trade.reason!,
          status: 'success',
          orderId: response.data.orderId,
          executionTime: Date.now()
        };
        
        this.logger.info('Trade executed successfully', executedTrade);
        return executedTrade;
      } else {
        throw new NelogicaError('Trade execution failed', response.data);
      }
      
    } catch (error) {
      this.logger.error('Error executing trade', error);
      throw new NelogicaError('Failed to execute trade', error);
    }
  }

  /**
   * Close a position
   */
  public async closePosition(positionId: string): Promise<TradeEntry> {
    try {
      const response = await this.httpClient.post(`/positions/${positionId}/close`);
      
      if (response.data.success) {
        const closeTrade: TradeEntry = {
          id: response.data.orderId,
          timestamp: new Date().toLocaleTimeString('pt-BR'),
          action: response.data.action,
          symbol: response.data.symbol,
          price: response.data.executionPrice,
          quantity: response.data.quantity,
          reason: 'Position closed',
          status: 'success',
          orderId: response.data.orderId,
          pnl: response.data.pnl
        };
        
        this.logger.info('Position closed successfully', closeTrade);
        return closeTrade;
      } else {
        throw new NelogicaError('Failed to close position', response.data);
      }
      
    } catch (error) {
      this.logger.error('Error closing position', error);
      throw new NelogicaError('Failed to close position', error);
    }
  }

  /**
   * Disconnect from Nelogica
   */
  public async disconnect(): Promise<void> {
    this.logger.info('Disconnecting from Nelogica');
    
    // Stop heartbeat
    this.stopHeartbeat();
    
    // Clear reconnection timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    // Close WebSocket
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    // Clear credentials
    this.credentials = {};
    
    // Update status
    this.updateConnectionStatus('disconnected');
    
    this.logger.info('Disconnected from Nelogica');
  }

  // Getters
  public getCurrentMarketData(): MarketData {
    if (!this.currentMarketData) {
      // Return mock data if no real data available
      return {
        price: 5980 + Math.random() * 20 - 10,
        priceChange: Math.random() * 4 - 2,
        volume: Math.floor(Math.random() * 2000) + 1000,
        volatility: 1.0 + Math.random(),
        spread: 0.25,
        sessionTime: new Date().toLocaleTimeString('pt-BR'),
        marketPhase: 'open',
        liquidityLevel: 'medium',
        orderBookImbalance: Math.random() * 20 - 10,
        timestamp: Date.now(),
        bid: 5979.75,
        ask: 5980.00,
        last: 5979.90,
        high: 5985.50,
        low: 5975.25
      };
    }
    
    return this.currentMarketData;
  }

  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  public getSubscriptions(): NelogicaSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  public getStatistics() {
    return {
      messagesReceived: this.messagesReceived,
      lastMessageTime: this.lastMessageTime,
      averageLatency: this.averageLatency,
      reconnectAttempts: this.reconnectAttempts,
      isConnected: this.connectionStatus.isConnected
    };
  }
}