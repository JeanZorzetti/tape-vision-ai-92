/**
 * WebSocket Manager - Real-time Communication Hub
 * Handles all real-time data streaming to frontend clients
 */

import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import { Logger } from 'winston';
import EventEmitter from 'eventemitter3';
import {
  MarketData,
  AIStatus,
  DecisionAnalysis,
  TradeEntry,
  OrderBook,
  TapeEntry,
  SystemHealth,
  Notification,
  WSMessage,
  MarketDataMessage,
  OrderBookMessage,
  TapeMessage,
  SignalMessage,
  SystemMessage
} from '@/types/trading';

interface ClientInfo {
  id: string;
  connectedAt: number;
  lastActivity: number;
  subscriptions: Set<string>;
  authenticated: boolean;
  userAgent?: string;
  ipAddress?: string;
}

export class WebSocketManager extends EventEmitter {
  private io: SocketIOServer;
  private logger: Logger;
  private clients: Map<string, ClientInfo> = new Map();
  
  // Data streams
  private marketDataStream: MarketData | null = null;
  private aiStatusStream: AIStatus | null = null;
  private orderBookStream: OrderBook | null = null;
  
  // Rate limiting
  private messageQueue: Map<string, WSMessage[]> = new Map();
  private readonly MAX_MESSAGES_PER_SECOND = 100;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  
  // Performance metrics
  private messagesProcessed: number = 0;
  private totalClients: number = 0;
  private peakClients: number = 0;
  
  constructor(httpServer: HTTPServer, logger: Logger) {
    super();
    
    this.logger = logger.child({ component: 'WebSocketManager' });
    
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        methods: ["GET", "POST"],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000,
      transports: ['websocket', 'polling']
    });
    
    this.setupSocketHandlers();
    this.startHeartbeat();
    
    this.logger.info('WebSocket Manager initialized');
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      this.handleClientConnection(socket);
      
      socket.on('authenticate', (data) => this.handleAuthentication(socket, data));
      socket.on('subscribe', (data) => this.handleSubscription(socket, data));
      socket.on('unsubscribe', (data) => this.handleUnsubscription(socket, data));
      socket.on('heartbeat', () => this.handleHeartbeat(socket));
      socket.on('disconnect', () => this.handleClientDisconnection(socket));
      socket.on('error', (error) => this.handleSocketError(socket, error));
    });
  }

  private handleClientConnection(socket: any): void {
    const clientInfo: ClientInfo = {
      id: socket.id,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      subscriptions: new Set(),
      authenticated: false,
      userAgent: socket.handshake.headers['user-agent'],
      ipAddress: socket.handshake.address
    };
    
    this.clients.set(socket.id, clientInfo);
    this.totalClients++;
    
    if (this.clients.size > this.peakClients) {
      this.peakClients = this.clients.size;
    }
    
    this.logger.info('Client connected', {
      clientId: socket.id,
      totalClients: this.clients.size,
      ipAddress: clientInfo.ipAddress
    });
    
    // Send initial connection acknowledgment
    this.sendToClient(socket.id, {
      type: 'connection_ack',
      payload: {
        clientId: socket.id,
        serverTime: Date.now(),
        version: '1.0.0'
      },
      timestamp: Date.now()
    });
    
    this.emit('client-connected', { clientId: socket.id, clientInfo });
  }

  private handleAuthentication(socket: any, data: any): void {
    // Simple authentication - in production, implement proper JWT validation
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    try {
      // Validate authentication data
      if (data.token) {
        // TODO: Implement JWT validation
        client.authenticated = true;
        client.lastActivity = Date.now();
        
        socket.emit('auth_success', {
          authenticated: true,
          permissions: ['read', 'trade'] // Based on user role
        });
        
        this.logger.info('Client authenticated', { clientId: socket.id });
      } else {
        socket.emit('auth_error', { message: 'Invalid credentials' });
        this.logger.warn('Authentication failed', { clientId: socket.id });
      }
    } catch (error) {
      this.logger.error('Authentication error', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
    }
  }

  private handleSubscription(socket: any, data: { channels: string[] }): void {
    const client = this.clients.get(socket.id);
    if (!client || !client.authenticated) {
      socket.emit('subscription_error', { message: 'Not authenticated' });
      return;
    }
    
    try {
      for (const channel of data.channels) {
        if (this.isValidChannel(channel)) {
          client.subscriptions.add(channel);
          
          // Send current data for the subscribed channel
          this.sendCurrentDataForChannel(socket.id, channel);
        }
      }
      
      socket.emit('subscription_success', { 
        channels: Array.from(client.subscriptions) 
      });
      
      this.logger.debug('Client subscribed to channels', {
        clientId: socket.id,
        channels: data.channels
      });
      
    } catch (error) {
      this.logger.error('Subscription error', error);
      socket.emit('subscription_error', { message: 'Subscription failed' });
    }
  }

  private handleUnsubscription(socket: any, data: { channels: string[] }): void {
    const client = this.clients.get(socket.id);
    if (!client) return;
    
    for (const channel of data.channels) {
      client.subscriptions.delete(channel);
    }
    
    socket.emit('unsubscription_success', {
      channels: Array.from(client.subscriptions)
    });
  }

  private handleHeartbeat(socket: any): void {
    const client = this.clients.get(socket.id);
    if (client) {
      client.lastActivity = Date.now();
      socket.emit('heartbeat_ack', { timestamp: Date.now() });
    }
  }

  private handleClientDisconnection(socket: any): void {
    const client = this.clients.get(socket.id);
    if (client) {
      const duration = Date.now() - client.connectedAt;
      
      this.logger.info('Client disconnected', {
        clientId: socket.id,
        duration: Math.round(duration / 1000),
        subscriptions: client.subscriptions.size
      });
      
      this.clients.delete(socket.id);
      this.messageQueue.delete(socket.id);
      
      this.emit('client-disconnected', { clientId: socket.id, duration });
    }
  }

  private handleSocketError(socket: any, error: any): void {
    this.logger.error('Socket error', {
      clientId: socket.id,
      error: error.message
    });
  }

  private isValidChannel(channel: string): boolean {
    const validChannels = [
      'market_data',
      'order_book',
      'tape',
      'ai_status',
      'signals',
      'trades',
      'notifications',
      'system'
    ];
    
    return validChannels.includes(channel);
  }

  private sendCurrentDataForChannel(clientId: string, channel: string): void {
    switch (channel) {
      case 'market_data':
        if (this.marketDataStream) {
          this.sendToClient(clientId, {
            type: 'market_data',
            payload: this.marketDataStream,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'ai_status':
        if (this.aiStatusStream) {
          this.sendToClient(clientId, {
            type: 'ai_status',
            payload: this.aiStatusStream,
            timestamp: Date.now()
          });
        }
        break;
      
      case 'order_book':
        if (this.orderBookStream) {
          this.sendToClient(clientId, {
            type: 'order_book',
            payload: this.orderBookStream,
            timestamp: Date.now()
          });
        }
        break;
    }
  }

  private startHeartbeat(): void {
    setInterval(() => {
      const now = Date.now();
      const staleClients = [];
      
      for (const [clientId, client] of this.clients.entries()) {
        if (now - client.lastActivity > this.HEARTBEAT_INTERVAL * 3) {
          staleClients.push(clientId);
        }
      }
      
      // Disconnect stale clients
      for (const clientId of staleClients) {
        const socket = this.io.sockets.sockets.get(clientId);
        if (socket) {
          socket.disconnect(true);
        }
      }
      
      // Process message queues
      this.processMessageQueues();
      
    }, this.HEARTBEAT_INTERVAL);
  }

  private processMessageQueues(): void {
    for (const [clientId, messages] of this.messageQueue.entries()) {
      if (messages.length > 0) {
        const client = this.clients.get(clientId);
        if (client) {
          // Send batched messages
          const batch = messages.splice(0, this.MAX_MESSAGES_PER_SECOND);
          const socket = this.io.sockets.sockets.get(clientId);
          
          if (socket) {
            socket.emit('batch_data', { messages: batch });
          }
        } else {
          this.messageQueue.delete(clientId);
        }
      }
    }
  }

  // Public methods for broadcasting data

  public broadcastMarketData(data: MarketData): void {
    this.marketDataStream = data;
    
    const message: MarketDataMessage = {
      type: 'market_data',
      payload: data,
      timestamp: Date.now()
    };
    
    this.broadcastToSubscribers('market_data', message);
  }

  public broadcastAIStatus(status: AIStatus): void {
    this.aiStatusStream = status;
    
    const message: SystemMessage = {
      type: 'ai_status',
      payload: { status, health: this.getSystemHealth() },
      timestamp: Date.now()
    };
    
    this.broadcastToSubscribers('ai_status', message);
  }

  public broadcastOrderBook(orderBook: OrderBook): void {
    this.orderBookStream = orderBook;
    
    const message: OrderBookMessage = {
      type: 'order_book',
      payload: orderBook,
      timestamp: Date.now()
    };
    
    this.broadcastToSubscribers('order_book', message);
  }

  public broadcastTapeEntries(entries: TapeEntry[]): void {
    const message: TapeMessage = {
      type: 'tape',
      payload: entries,
      timestamp: Date.now()
    };
    
    this.broadcastToSubscribers('tape', message);
  }

  public broadcastSignal(signal: {
    signal: 'BUY' | 'SELL' | 'WAIT';
    confidence: number;
    analysis: DecisionAnalysis;
  }): void {
    const message: SignalMessage = {
      type: 'signal',
      payload: signal,
      timestamp: Date.now()
    };
    
    this.broadcastToSubscribers('signals', message);
  }

  public broadcastTrade(trade: TradeEntry): void {
    const message: WSMessage = {
      type: 'trade',
      payload: trade,
      timestamp: Date.now()
    };
    
    this.broadcastToSubscribers('trades', message);
  }

  public broadcastNotification(notification: Notification): void {
    const message: WSMessage = {
      type: 'notification',
      payload: notification,
      timestamp: Date.now()
    };
    
    this.broadcastToAll(message);
  }

  public broadcastSystemHealth(health: SystemHealth): void {
    const message: WSMessage = {
      type: 'system_health',
      payload: health,
      timestamp: Date.now()
    };
    
    this.broadcastToSubscribers('system', message);
  }

  private broadcastToSubscribers(channel: string, message: WSMessage): void {
    for (const [clientId, client] of this.clients.entries()) {
      if (client.subscriptions.has(channel)) {
        this.sendToClient(clientId, message);
      }
    }
  }

  private broadcastToAll(message: WSMessage): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  private sendToClient(clientId: string, message: WSMessage): void {
    const socket = this.io.sockets.sockets.get(clientId);
    
    if (socket) {
      // Rate limiting - queue messages if too many
      let queue = this.messageQueue.get(clientId);
      if (!queue) {
        queue = [];
        this.messageQueue.set(clientId, queue);
      }
      
      if (queue.length < this.MAX_MESSAGES_PER_SECOND) {
        socket.emit('data', message);
        this.messagesProcessed++;
      } else {
        // Add to queue for later processing
        queue.push(message);
      }
    }
  }

  private getSystemHealth(): SystemHealth {
    const memUsage = process.memoryUsage();
    
    return {
      cpu: process.cpuUsage().user / 1000000, // Convert to seconds
      memory: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      latency: this.calculateAverageLatency(),
      uptime: process.uptime(),
      errors: 0, // TODO: Track actual errors
      warnings: 0 // TODO: Track actual warnings
    };
  }

  private calculateAverageLatency(): number {
    // Simple latency calculation - in production, implement proper monitoring
    return Math.random() * 10 + 1; // 1-11ms simulated
  }

  // Management methods

  public getConnectedClients(): number {
    return this.clients.size;
  }

  public getClientInfo(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  public getAllClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  public disconnectClient(clientId: string, reason?: string): void {
    const socket = this.io.sockets.sockets.get(clientId);
    if (socket) {
      socket.disconnect(true);
      this.logger.info('Client forcibly disconnected', { clientId, reason });
    }
  }

  public getStatistics(): {
    totalClients: number;
    peakClients: number;
    messagesProcessed: number;
    activeClients: number;
  } {
    return {
      totalClients: this.totalClients,
      peakClients: this.peakClients,
      messagesProcessed: this.messagesProcessed,
      activeClients: this.clients.size
    };
  }

  public async shutdown(): Promise<void> {
    this.logger.info('Shutting down WebSocket Manager');
    
    // Notify all clients of shutdown
    this.broadcastToAll({
      type: 'system_shutdown',
      payload: { message: 'Server shutting down' },
      timestamp: Date.now()
    });
    
    // Wait a moment for messages to be sent
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Close all connections
    this.io.close();
    
    this.logger.info('WebSocket Manager shut down');
  }
}