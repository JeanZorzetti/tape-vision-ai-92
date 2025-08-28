/**
 * Nelogica Profit Pro WebSocket Connector
 * 
 * This critical component provides robust WebSocket connectivity to the Nelogica Profit Pro
 * trading platform API. It handles real-time market data streaming, order execution, and
 * position management with enterprise-grade reliability and performance.
 * 
 * Key Features:
 * - High-performance WebSocket connection with automatic reconnection
 * - Real-time market data streaming (Level I/II, tape, order book)
 * - Order execution and position management
 * - Comprehensive error handling and recovery
 * - Rate limiting and connection throttling
 * - Message queuing and buffering for reliability
 * - Authentication and session management
 * - Performance monitoring and metrics collection
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import {
  MarketData,
  TapeEntry,
  Order,
  Position,
  Trade,
  TradingError
} from '../../types/trading';
import { Logger } from '../../utils/Logger';
import { MetricsCollector } from '../monitoring/MetricsCollector';

export interface ProfitProConfig {
  apiUrl: string;
  apiKey: string;
  secretKey: string;
  symbols: string[];
  subscriptions: {
    marketData: boolean;
    levelII: boolean;
    tape: boolean;
    orders: boolean;
    positions: boolean;
  };
  connection: {
    timeout: number;
    reconnectDelay: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
    bufferSize: number;
  };
  rateLimiting: {
    messagesPerSecond: number;
    ordersPerSecond: number;
    requestsPerMinute: number;
  };
}

export interface WebSocketMessage {
  id: string;
  type: string;
  data: any;
  timestamp: number;
  symbol?: string;
}

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error' | 'reconnecting';
  connectedAt?: Date;
  lastHeartbeat?: Date;
  reconnectAttempts: number;
  totalReconnects: number;
  messagesReceived: number;
  messagesSent: number;
  lastError?: string;
}

export interface SubscriptionStatus {
  symbol: string;
  marketData: boolean;
  levelII: boolean;
  tape: boolean;
  subscribed: boolean;
  lastUpdate?: Date;
}

export interface RateLimiter {
  messageTokens: number;
  orderTokens: number;
  requestTokens: number;
  lastMessageRefill: number;
  lastOrderRefill: number;
  lastRequestRefill: number;
}

export class ProfitProConnector extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: ProfitProConfig;
  private connectionState: ConnectionState;
  private subscriptions: Map<string, SubscriptionStatus> = new Map();
  private messageBuffer: WebSocketMessage[] = [];
  private outgoingQueue: any[] = [];
  private rateLimiter: RateLimiter;
  
  // Authentication
  private authToken: string | null = null;
  private sessionId: string | null = null;
  private isAuthenticated: boolean = false;
  
  // Timers and intervals
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private rateLimitTimer: NodeJS.Timeout | null = null;
  private queueProcessor: NodeJS.Timeout | null = null;
  
  // Performance tracking
  private performanceMetrics = {
    latency: [] as number[],
    throughput: 0,
    errors: 0,
    reconnections: 0
  };

  constructor(
    private logger: Logger,
    private metricsCollector: MetricsCollector,
    config: Partial<ProfitProConfig>
  ) {
    super();

    this.config = {
      apiUrl: 'wss://api.profitpro.com.br/ws',
      apiKey: '',
      secretKey: '',
      symbols: ['WINV24', 'DOLV24'],
      subscriptions: {
        marketData: true,
        levelII: true,
        tape: true,
        orders: true,
        positions: true
      },
      connection: {
        timeout: 30000,
        reconnectDelay: 5000,
        maxReconnectAttempts: 10,
        heartbeatInterval: 30000,
        bufferSize: 10000
      },
      rateLimiting: {
        messagesPerSecond: 50,
        ordersPerSecond: 10,
        requestsPerMinute: 1000
      },
      ...config
    };

    this.connectionState = {
      status: 'disconnected',
      reconnectAttempts: 0,
      totalReconnects: 0,
      messagesReceived: 0,
      messagesSent: 0
    };

    this.rateLimiter = {
      messageTokens: this.config.rateLimiting.messagesPerSecond,
      orderTokens: this.config.rateLimiting.ordersPerSecond,
      requestTokens: this.config.rateLimiting.requestsPerMinute,
      lastMessageRefill: Date.now(),
      lastOrderRefill: Date.now(),
      lastRequestRefill: Date.now()
    };

    this.initializeConnector();
  }

  /**
   * Initialize the WebSocket connector
   */
  private initializeConnector(): void {
    this.logger.info('Initializing Profit Pro connector', {
      symbols: this.config.symbols,
      subscriptions: this.config.subscriptions
    });

    // Start rate limit token refill
    this.startRateLimitRefill();
    
    // Start message queue processor
    this.startQueueProcessor();

    this.emit('connector_initialized');
  }

  /**
   * Connect to Profit Pro WebSocket API
   */
  public async connect(): Promise<void> {
    if (this.connectionState.status === 'connected' || 
        this.connectionState.status === 'connecting') {
      this.logger.warn('Already connected or connecting');
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        this.logger.info('Connecting to Profit Pro WebSocket', {
          url: this.config.apiUrl
        });

        this.connectionState.status = 'connecting';
        
        this.ws = new WebSocket(this.config.apiUrl, {
          handshakeTimeout: this.config.connection.timeout,
          headers: {
            'User-Agent': 'TapeVision-AI/1.0',
            'X-API-Key': this.config.apiKey
          }
        });

        this.setupWebSocketEvents(resolve, reject);

      } catch (error) {
        this.logger.error('Failed to create WebSocket connection', error);
        this.connectionState.status = 'error';
        this.connectionState.lastError = error.message;
        reject(new TradingError('WebSocket connection failed', 'WS_CONNECTION_ERROR', error));
      }
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWebSocketEvents(resolve: Function, reject: Function): void {
    if (!this.ws) return;

    this.ws.on('open', () => {
      this.logger.info('WebSocket connection established');
      this.connectionState.status = 'connected';
      this.connectionState.connectedAt = new Date();
      this.connectionState.reconnectAttempts = 0;
      
      this.startHeartbeat();
      this.authenticate().then(() => resolve()).catch(reject);
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      this.handleIncomingMessage(data);
    });

    this.ws.on('close', (code: number, reason: string) => {
      this.logger.warn('WebSocket connection closed', { code, reason });
      this.handleDisconnection(code, reason);
    });

    this.ws.on('error', (error: Error) => {
      this.logger.error('WebSocket error', error);
      this.connectionState.status = 'error';
      this.connectionState.lastError = error.message;
      this.performanceMetrics.errors++;
      
      this.emit('connection_error', error);
      
      if (this.connectionState.status === 'connecting') {
        reject(new TradingError('WebSocket connection failed', 'WS_CONNECTION_ERROR', error));
      }
    });

    this.ws.on('ping', () => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.pong();
      }
    });

    this.ws.on('pong', () => {
      this.connectionState.lastHeartbeat = new Date();
    });
  }

  /**
   * Authenticate with Profit Pro API
   */
  private async authenticate(): Promise<void> {
    try {
      const authMessage = {
        id: this.generateMessageId(),
        type: 'authenticate',
        data: {
          apiKey: this.config.apiKey,
          secretKey: this.config.secretKey,
          timestamp: Date.now()
        }
      };

      await this.sendMessage(authMessage);
      
      // Wait for authentication response
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new TradingError('Authentication timeout', 'AUTH_TIMEOUT'));
        }, 10000);

        this.once('authenticated', (data) => {
          clearTimeout(timeout);
          this.authToken = data.token;
          this.sessionId = data.sessionId;
          this.isAuthenticated = true;
          
          this.logger.info('Authentication successful', {
            sessionId: this.sessionId
          });

          // Subscribe to configured data streams
          this.subscribeToDataStreams().then(() => {
            resolve(data);
          }).catch(reject);
        });

        this.once('authentication_failed', (error) => {
          clearTimeout(timeout);
          reject(new TradingError('Authentication failed', 'AUTH_FAILED', error));
        });
      });

    } catch (error) {
      throw new TradingError('Authentication request failed', 'AUTH_REQUEST_ERROR', error);
    }
  }

  /**
   * Subscribe to configured data streams
   */
  private async subscribeToDataStreams(): Promise<void> {
    const subscriptionPromises: Promise<void>[] = [];

    for (const symbol of this.config.symbols) {
      // Initialize subscription status
      this.subscriptions.set(symbol, {
        symbol,
        marketData: false,
        levelII: false,
        tape: false,
        subscribed: false
      });

      // Subscribe to market data
      if (this.config.subscriptions.marketData) {
        subscriptionPromises.push(this.subscribeToMarketData(symbol));
      }

      // Subscribe to Level II data
      if (this.config.subscriptions.levelII) {
        subscriptionPromises.push(this.subscribeToLevelII(symbol));
      }

      // Subscribe to tape data
      if (this.config.subscriptions.tape) {
        subscriptionPromises.push(this.subscribeToTape(symbol));
      }
    }

    // Subscribe to orders and positions
    if (this.config.subscriptions.orders) {
      subscriptionPromises.push(this.subscribeToOrders());
    }

    if (this.config.subscriptions.positions) {
      subscriptionPromises.push(this.subscribeToPositions());
    }

    try {
      await Promise.all(subscriptionPromises);
      this.logger.info('All subscriptions completed successfully');
    } catch (error) {
      this.logger.error('Some subscriptions failed', error);
      throw error;
    }
  }

  /**
   * Subscribe to market data for a symbol
   */
  private async subscribeToMarketData(symbol: string): Promise<void> {
    const message = {
      id: this.generateMessageId(),
      type: 'subscribe',
      data: {
        stream: 'marketdata',
        symbol,
        fields: ['last', 'bid', 'ask', 'volume', 'high', 'low', 'open', 'change']
      }
    };

    await this.sendMessage(message);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TradingError(`Market data subscription timeout for ${symbol}`, 'SUBSCRIPTION_TIMEOUT'));
      }, 5000);

      this.once(`subscription_confirmed_marketdata_${symbol}`, () => {
        clearTimeout(timeout);
        const subscription = this.subscriptions.get(symbol);
        if (subscription) {
          subscription.marketData = true;
          subscription.lastUpdate = new Date();
        }
        this.logger.info(`Market data subscription confirmed for ${symbol}`);
        resolve();
      });
    });
  }

  /**
   * Subscribe to Level II data for a symbol
   */
  private async subscribeToLevelII(symbol: string): Promise<void> {
    const message = {
      id: this.generateMessageId(),
      type: 'subscribe',
      data: {
        stream: 'levelii',
        symbol,
        depth: 20
      }
    };

    await this.sendMessage(message);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TradingError(`Level II subscription timeout for ${symbol}`, 'SUBSCRIPTION_TIMEOUT'));
      }, 5000);

      this.once(`subscription_confirmed_levelii_${symbol}`, () => {
        clearTimeout(timeout);
        const subscription = this.subscriptions.get(symbol);
        if (subscription) {
          subscription.levelII = true;
          subscription.lastUpdate = new Date();
        }
        this.logger.info(`Level II subscription confirmed for ${symbol}`);
        resolve();
      });
    });
  }

  /**
   * Subscribe to tape data for a symbol
   */
  private async subscribeToTape(symbol: string): Promise<void> {
    const message = {
      id: this.generateMessageId(),
      type: 'subscribe',
      data: {
        stream: 'tape',
        symbol,
        includeConditions: true
      }
    };

    await this.sendMessage(message);
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TradingError(`Tape subscription timeout for ${symbol}`, 'SUBSCRIPTION_TIMEOUT'));
      }, 5000);

      this.once(`subscription_confirmed_tape_${symbol}`, () => {
        clearTimeout(timeout);
        const subscription = this.subscriptions.get(symbol);
        if (subscription) {
          subscription.tape = true;
          subscription.lastUpdate = new Date();
        }
        this.logger.info(`Tape subscription confirmed for ${symbol}`);
        resolve();
      });
    });
  }

  /**
   * Subscribe to orders stream
   */
  private async subscribeToOrders(): Promise<void> {
    const message = {
      id: this.generateMessageId(),
      type: 'subscribe',
      data: {
        stream: 'orders',
        account: 'all'
      }
    };

    await this.sendMessage(message);
  }

  /**
   * Subscribe to positions stream
   */
  private async subscribeToPositions(): Promise<void> {
    const message = {
      id: this.generateMessageId(),
      type: 'subscribe',
      data: {
        stream: 'positions',
        account: 'all'
      }
    };

    await this.sendMessage(message);
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleIncomingMessage(data: WebSocket.Data): void {
    const startTime = performance.now();
    
    try {
      const messageStr = data.toString();
      const message = JSON.parse(messageStr) as WebSocketMessage;
      
      this.connectionState.messagesReceived++;
      this.performanceMetrics.throughput++;

      // Buffer message for reliability
      this.bufferMessage(message);

      // Route message based on type
      this.routeMessage(message);

      // Calculate latency if timestamp is provided
      if (message.timestamp) {
        const latency = Date.now() - message.timestamp;
        this.performanceMetrics.latency.push(latency);
        
        // Keep only last 1000 latency measurements
        if (this.performanceMetrics.latency.length > 1000) {
          this.performanceMetrics.latency.shift();
        }
      }

      const processingTime = performance.now() - startTime;
      this.metricsCollector.recordMetric('message_processing_time', processingTime);

    } catch (error) {
      this.logger.error('Failed to process incoming message', error);
      this.performanceMetrics.errors++;
    }
  }

  /**
   * Buffer incoming message for reliability
   */
  private bufferMessage(message: WebSocketMessage): void {
    this.messageBuffer.push(message);
    
    // Limit buffer size
    if (this.messageBuffer.length > this.config.connection.bufferSize) {
      this.messageBuffer.shift();
    }
  }

  /**
   * Route message to appropriate handler
   */
  private routeMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'authentication_response':
        this.handleAuthenticationResponse(message);
        break;
        
      case 'subscription_response':
        this.handleSubscriptionResponse(message);
        break;
        
      case 'marketdata':
        this.handleMarketData(message);
        break;
        
      case 'levelii':
        this.handleLevelII(message);
        break;
        
      case 'tape':
        this.handleTape(message);
        break;
        
      case 'order_update':
        this.handleOrderUpdate(message);
        break;
        
      case 'position_update':
        this.handlePositionUpdate(message);
        break;
        
      case 'trade_execution':
        this.handleTradeExecution(message);
        break;
        
      case 'error':
        this.handleError(message);
        break;
        
      case 'heartbeat':
        this.handleHeartbeat(message);
        break;
        
      default:
        this.logger.debug('Unknown message type received', { type: message.type });
    }
  }

  /**
   * Handle authentication response
   */
  private handleAuthenticationResponse(message: WebSocketMessage): void {
    if (message.data.success) {
      this.emit('authenticated', message.data);
    } else {
      this.emit('authentication_failed', message.data);
    }
  }

  /**
   * Handle subscription response
   */
  private handleSubscriptionResponse(message: WebSocketMessage): void {
    const { stream, symbol, success } = message.data;
    
    if (success) {
      this.emit(`subscription_confirmed_${stream}_${symbol}`);
    } else {
      this.logger.error('Subscription failed', message.data);
    }
  }

  /**
   * Handle market data update
   */
  private handleMarketData(message: WebSocketMessage): void {
    try {
      const marketData: MarketData = {
        symbol: message.data.symbol,
        price: message.data.last,
        bid: message.data.bid,
        ask: message.data.ask,
        spread: message.data.ask - message.data.bid,
        volume: message.data.volume,
        high: message.data.high,
        low: message.data.low,
        open: message.data.open,
        change: message.data.change,
        changePercent: message.data.changePercent,
        timestamp: message.data.timestamp || Date.now(),
        marketPhase: this.determineMarketPhase(message.data.timestamp),
        liquidityLevel: this.determineLiquidityLevel(message.data),
        volatility: message.data.volatility || 0,
        orderBookImbalance: message.data.orderBookImbalance || 0
      };

      this.emit('market_data', marketData);
      
      // Update subscription status
      const subscription = this.subscriptions.get(message.data.symbol);
      if (subscription) {
        subscription.lastUpdate = new Date();
      }

    } catch (error) {
      this.logger.error('Failed to process market data', error);
    }
  }

  /**
   * Handle Level II data update
   */
  private handleLevelII(message: WebSocketMessage): void {
    try {
      const levelIIData = {
        symbol: message.data.symbol,
        bids: message.data.bids || [],
        asks: message.data.asks || [],
        timestamp: message.data.timestamp || Date.now()
      };

      this.emit('level_ii', levelIIData);

    } catch (error) {
      this.logger.error('Failed to process Level II data', error);
    }
  }

  /**
   * Handle tape data update
   */
  private handleTape(message: WebSocketMessage): void {
    try {
      const tapeEntry: TapeEntry = {
        id: message.data.id || `${message.data.symbol}_${Date.now()}`,
        symbol: message.data.symbol,
        price: message.data.price,
        volume: message.data.volume,
        timestamp: message.data.timestamp || Date.now(),
        aggressor: message.data.side === 'buy' ? 'buyer' : 'seller',
        isLarge: message.data.volume > 100, // Configurable threshold
        isDominant: message.data.isDominant || false,
        absorption: message.data.absorption || false,
        conditions: message.data.conditions || []
      };

      this.emit('tape_entry', tapeEntry);

    } catch (error) {
      this.logger.error('Failed to process tape data', error);
    }
  }

  /**
   * Handle order update
   */
  private handleOrderUpdate(message: WebSocketMessage): void {
    try {
      const order: Order = {
        id: message.data.orderId,
        clientId: message.data.clientId,
        symbol: message.data.symbol,
        side: message.data.side,
        type: message.data.type,
        quantity: message.data.quantity,
        price: message.data.price,
        status: message.data.status,
        timeInForce: message.data.timeInForce,
        createdAt: message.data.createdAt,
        updatedAt: message.data.updatedAt,
        filledQuantity: message.data.filledQuantity || 0,
        avgFillPrice: message.data.avgFillPrice || 0,
        commission: message.data.commission || 0,
        strategy: message.data.strategy,
        pattern: message.data.pattern
      };

      this.emit('order_update', order);

    } catch (error) {
      this.logger.error('Failed to process order update', error);
    }
  }

  /**
   * Handle position update
   */
  private handlePositionUpdate(message: WebSocketMessage): void {
    try {
      const position: Position = {
        symbol: message.data.symbol,
        quantity: message.data.quantity,
        averagePrice: message.data.averagePrice,
        currentPrice: message.data.currentPrice,
        unrealizedPnL: message.data.unrealizedPnL,
        realizedPnL: message.data.realizedPnL,
        totalPnL: message.data.totalPnL,
        openTime: message.data.openTime,
        lastUpdate: message.data.lastUpdate || Date.now()
      };

      this.emit('position_update', position);

    } catch (error) {
      this.logger.error('Failed to process position update', error);
    }
  }

  /**
   * Handle trade execution
   */
  private handleTradeExecution(message: WebSocketMessage): void {
    try {
      const trade: Trade = {
        id: message.data.tradeId,
        orderId: message.data.orderId,
        symbol: message.data.symbol,
        side: message.data.side,
        quantity: message.data.quantity,
        price: message.data.price,
        commission: message.data.commission || 0,
        openTime: message.data.timestamp,
        closeTime: message.data.closeTime,
        realizedPnL: message.data.realizedPnL,
        returnPercent: message.data.returnPercent,
        strategy: message.data.strategy,
        pattern: message.data.pattern,
        entryVolatility: message.data.entryVolatility,
        marketCondition: message.data.marketCondition
      };

      this.emit('trade_execution', trade);

    } catch (error) {
      this.logger.error('Failed to process trade execution', error);
    }
  }

  /**
   * Handle error message
   */
  private handleError(message: WebSocketMessage): void {
    this.logger.error('API Error received', message.data);
    this.emit('api_error', message.data);
  }

  /**
   * Handle heartbeat message
   */
  private handleHeartbeat(message: WebSocketMessage): void {
    this.connectionState.lastHeartbeat = new Date();
    
    // Respond to heartbeat if required
    if (message.data.requireResponse) {
      this.sendHeartbeatResponse();
    }
  }

  /**
   * Send message with rate limiting
   */
  private async sendMessage(message: any): Promise<void> {
    if (!this.canSendMessage()) {
      this.outgoingQueue.push(message);
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new TradingError('WebSocket not connected', 'WS_NOT_CONNECTED'));
        return;
      }

      try {
        const messageStr = JSON.stringify(message);
        this.ws.send(messageStr);
        
        this.connectionState.messagesSent++;
        this.consumeMessageToken();
        
        this.logger.debug('Message sent', { type: message.type, id: message.id });
        resolve();

      } catch (error) {
        this.logger.error('Failed to send message', error);
        reject(new TradingError('Failed to send message', 'MESSAGE_SEND_ERROR', error));
      }
    });
  }

  /**
   * Place an order through the API
   */
  public async placeOrder(order: Partial<Order>): Promise<string> {
    if (!this.isAuthenticated) {
      throw new TradingError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    if (!this.canSendOrder()) {
      throw new TradingError('Order rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    const orderMessage = {
      id: this.generateMessageId(),
      type: 'place_order',
      data: {
        symbol: order.symbol,
        side: order.side,
        type: order.type || 'market',
        quantity: order.quantity,
        price: order.price,
        timeInForce: order.timeInForce || 'IOC',
        clientId: order.clientId || this.generateOrderId(),
        strategy: order.strategy,
        pattern: order.pattern
      }
    };

    await this.sendMessage(orderMessage);
    this.consumeOrderToken();

    return orderMessage.data.clientId;
  }

  /**
   * Cancel an order
   */
  public async cancelOrder(orderId: string): Promise<void> {
    if (!this.isAuthenticated) {
      throw new TradingError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const cancelMessage = {
      id: this.generateMessageId(),
      type: 'cancel_order',
      data: {
        orderId
      }
    };

    await this.sendMessage(cancelMessage);
  }

  /**
   * Get current positions
   */
  public async getPositions(): Promise<Position[]> {
    if (!this.isAuthenticated) {
      throw new TradingError('Not authenticated', 'NOT_AUTHENTICATED');
    }

    const requestMessage = {
      id: this.generateMessageId(),
      type: 'get_positions',
      data: {}
    };

    await this.sendMessage(requestMessage);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TradingError('Position request timeout', 'REQUEST_TIMEOUT'));
      }, 10000);

      this.once('positions_response', (positions) => {
        clearTimeout(timeout);
        resolve(positions);
      });
    });
  }

  /**
   * Handle disconnection and implement reconnection logic
   */
  private handleDisconnection(code: number, reason: string): void {
    this.connectionState.status = 'disconnected';
    this.isAuthenticated = false;
    this.authToken = null;
    this.sessionId = null;

    this.stopHeartbeat();
    
    this.emit('disconnected', { code, reason });

    // Attempt reconnection if configured
    if (this.connectionState.reconnectAttempts < this.config.connection.maxReconnectAttempts) {
      this.scheduleReconnection();
    } else {
      this.logger.error('Max reconnection attempts reached');
      this.emit('max_reconnect_attempts_reached');
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnection(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.config.connection.reconnectDelay * 
                  Math.pow(2, Math.min(this.connectionState.reconnectAttempts, 5)); // Exponential backoff

    this.logger.info(`Scheduling reconnection in ${delay}ms`, {
      attempt: this.connectionState.reconnectAttempts + 1
    });

    this.connectionState.status = 'reconnecting';
    this.connectionState.reconnectAttempts++;
    this.performanceMetrics.reconnections++;

    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
        this.connectionState.totalReconnects++;
        this.logger.info('Reconnection successful');
        this.emit('reconnected');
      } catch (error) {
        this.logger.error('Reconnection failed', error);
        this.handleDisconnection(1006, 'Reconnection failed');
      }
    }, delay);
  }

  /**
   * Start heartbeat mechanism
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.connection.heartbeatInterval);
  }

  /**
   * Stop heartbeat mechanism
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Send heartbeat message
   */
  private async sendHeartbeat(): void {
    try {
      const heartbeatMessage = {
        id: this.generateMessageId(),
        type: 'heartbeat',
        data: {
          timestamp: Date.now()
        }
      };

      await this.sendMessage(heartbeatMessage);
    } catch (error) {
      this.logger.error('Failed to send heartbeat', error);
    }
  }

  /**
   * Send heartbeat response
   */
  private async sendHeartbeatResponse(): void {
    try {
      const responseMessage = {
        id: this.generateMessageId(),
        type: 'heartbeat_response',
        data: {
          timestamp: Date.now()
        }
      };

      await this.sendMessage(responseMessage);
    } catch (error) {
      this.logger.error('Failed to send heartbeat response', error);
    }
  }

  /**
   * Start rate limit token refill
   */
  private startRateLimitRefill(): void {
    this.rateLimitTimer = setInterval(() => {
      const now = Date.now();

      // Refill message tokens
      const messageTimeDiff = now - this.rateLimiter.lastMessageRefill;
      if (messageTimeDiff >= 1000) {
        this.rateLimiter.messageTokens = this.config.rateLimiting.messagesPerSecond;
        this.rateLimiter.lastMessageRefill = now;
      }

      // Refill order tokens
      const orderTimeDiff = now - this.rateLimiter.lastOrderRefill;
      if (orderTimeDiff >= 1000) {
        this.rateLimiter.orderTokens = this.config.rateLimiting.ordersPerSecond;
        this.rateLimiter.lastOrderRefill = now;
      }

      // Refill request tokens
      const requestTimeDiff = now - this.rateLimiter.lastRequestRefill;
      if (requestTimeDiff >= 60000) {
        this.rateLimiter.requestTokens = this.config.rateLimiting.requestsPerMinute;
        this.rateLimiter.lastRequestRefill = now;
      }

    }, 100); // Check every 100ms
  }

  /**
   * Start outgoing message queue processor
   */
  private startQueueProcessor(): void {
    this.queueProcessor = setInterval(() => {
      while (this.outgoingQueue.length > 0 && this.canSendMessage()) {
        const message = this.outgoingQueue.shift();
        this.sendMessage(message).catch(error => {
          this.logger.error('Failed to send queued message', error);
        });
      }
    }, 10); // Process every 10ms
  }

  // Rate limiting helpers
  private canSendMessage(): boolean {
    return this.rateLimiter.messageTokens > 0;
  }

  private canSendOrder(): boolean {
    return this.rateLimiter.orderTokens > 0 && this.rateLimiter.messageTokens > 0;
  }

  private consumeMessageToken(): void {
    this.rateLimiter.messageTokens = Math.max(0, this.rateLimiter.messageTokens - 1);
  }

  private consumeOrderToken(): void {
    this.rateLimiter.orderTokens = Math.max(0, this.rateLimiter.orderTokens - 1);
  }

  // Utility methods
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateOrderId(): string {
    return `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private determineMarketPhase(timestamp?: number): string {
    const now = new Date(timestamp || Date.now());
    const hour = now.getHours();
    const minute = now.getMinutes();
    const timeInMinutes = hour * 60 + minute;

    // Brazilian market hours (BM&F Bovespa)
    if (timeInMinutes >= 540 && timeInMinutes <= 570) { // 9:00-9:30
      return 'pre-market';
    } else if (timeInMinutes > 570 && timeInMinutes < 1020) { // 9:30-17:00
      return 'open';
    } else if (timeInMinutes >= 1020 && timeInMinutes <= 1080) { // 17:00-18:00
      return 'close';
    } else {
      return 'after-hours';
    }
  }

  private determineLiquidityLevel(data: any): 'high' | 'medium' | 'low' {
    const volume = data.volume || 0;
    const spread = (data.ask - data.bid) / data.last;

    if (volume > 1000 && spread < 0.001) {
      return 'high';
    } else if (volume > 500 && spread < 0.002) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get subscription status
   */
  public getSubscriptionStatus(): SubscriptionStatus[] {
    return Array.from(this.subscriptions.values());
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): any {
    const avgLatency = this.performanceMetrics.latency.length > 0 ?
      this.performanceMetrics.latency.reduce((sum, lat) => sum + lat, 0) / this.performanceMetrics.latency.length : 0;

    return {
      ...this.performanceMetrics,
      averageLatency: avgLatency,
      connectionUptime: this.connectionState.connectedAt ? 
        Date.now() - this.connectionState.connectedAt.getTime() : 0,
      messagesReceived: this.connectionState.messagesReceived,
      messagesSent: this.connectionState.messagesSent,
      queueSize: this.outgoingQueue.length,
      bufferSize: this.messageBuffer.length
    };
  }

  /**
   * Disconnect from WebSocket
   */
  public disconnect(): void {
    this.logger.info('Disconnecting from Profit Pro WebSocket');

    // Stop all timers
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.rateLimitTimer) {
      clearInterval(this.rateLimitTimer);
      this.rateLimitTimer = null;
    }

    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
      this.queueProcessor = null;
    }

    // Close WebSocket connection
    if (this.ws) {
      this.ws.close(1000, 'Normal closure');
      this.ws = null;
    }

    this.connectionState.status = 'disconnected';
    this.isAuthenticated = false;
    this.authToken = null;
    this.sessionId = null;

    this.emit('disconnected', { code: 1000, reason: 'Normal closure' });
  }

  /**
   * Cleanup resources
   */
  public dispose(): void {
    this.disconnect();
    
    this.messageBuffer = [];
    this.outgoingQueue = [];
    this.subscriptions.clear();
    
    this.removeAllListeners();
    this.logger.info('ProfitProConnector disposed successfully');
  }
}

export default ProfitProConnector;