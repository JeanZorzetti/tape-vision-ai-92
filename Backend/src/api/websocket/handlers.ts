/**
 * WebSocket Handlers - Tape Vision Trading System
 * Handles real-time WebSocket communications for trading and market data
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { 
  WSAuthMessage, 
  WSSubscribeMessage, 
  WSUnsubscribeMessage, 
  WSMessage, 
  MarketDataSubscription,
  AuthenticatedRequest
} from '../types/api';
import { APIContext } from '../index';
import { verifyJWT, verifyAPIKey } from '../middleware/auth';
import winston from 'winston';
import { 
  MarketData, 
  OrderBook, 
  TapeEntry, 
  AIStatus, 
  DecisionAnalysis, 
  TradeEntry,
  SystemHealth 
} from '../../types/trading';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
  permissions?: string[];
  isAuthenticated?: boolean;
  subscriptions?: Set<string>;
}

export class WebSocketHandlers {
  private context: APIContext;
  private io?: SocketServer;
  private authenticatedClients: Map<string, AuthenticatedSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // channel -> set of socket IDs

  constructor(context: APIContext) {
    this.context = context;
  }

  public initialize(): void {
    this.context.logger.info('Initializing WebSocket handlers');
  }

  public setSocketServer(io: SocketServer): void {
    this.io = io;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: AuthenticatedSocket) => {
      this.context.logger.info('WebSocket client connected', {
        socketId: socket.id,
        ip: socket.handshake.address
      });

      socket.subscriptions = new Set();

      // Set up socket event handlers
      this.setupSocketHandlers(socket);

      // Send welcome message
      socket.emit('connected', {
        type: 'system',
        message: 'Connected to Tape Vision Trading System',
        timestamp: Date.now(),
        socketId: socket.id
      });
    });
  }

  private setupSocketHandlers(socket: AuthenticatedSocket): void {
    // Authentication handler
    socket.on('auth', async (data: WSAuthMessage) => {
      await this.handleAuthentication(socket, data);
    });

    // Subscription handlers
    socket.on('subscribe', async (data: WSSubscribeMessage) => {
      await this.handleSubscription(socket, data);
    });

    socket.on('unsubscribe', async (data: WSUnsubscribeMessage) => {
      await this.handleUnsubscription(socket, data);
    });

    // Trading command handlers
    socket.on('place-order', async (data: any) => {
      await this.handlePlaceOrder(socket, data);
    });

    socket.on('cancel-order', async (data: any) => {
      await this.handleCancelOrder(socket, data);
    });

    socket.on('emergency-stop', async () => {
      await this.handleEmergencyStop(socket);
    });

    // System command handlers
    socket.on('get-status', async () => {
      await this.handleGetStatus(socket);
    });

    socket.on('ping', (callback: Function) => {
      if (typeof callback === 'function') {
        callback({ pong: Date.now() });
      }
    });

    // Disconnection handler
    socket.on('disconnect', (reason: string) => {
      this.handleDisconnection(socket, reason);
    });

    // Error handler
    socket.on('error', (error: Error) => {
      this.context.logger.error('WebSocket error', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });
    });
  }

  private async handleAuthentication(socket: AuthenticatedSocket, data: WSAuthMessage): Promise<void> {
    try {
      let userPayload: any;

      // Try JWT authentication
      if (data.token) {
        try {
          userPayload = verifyJWT(data.token);
          socket.userId = userPayload.id;
          socket.username = userPayload.username;
          socket.permissions = userPayload.permissions || [];
          socket.isAuthenticated = true;
        } catch (error) {
          // Try API key authentication as fallback
          try {
            const apiKeyPayload = verifyAPIKey(data.token);
            socket.userId = apiKeyPayload.id;
            socket.username = apiKeyPayload.name;
            socket.permissions = apiKeyPayload.permissions || [];
            socket.isAuthenticated = true;
          } catch (apiError) {
            throw new Error('Invalid authentication token');
          }
        }
      }

      if (!socket.isAuthenticated) {
        throw new Error('Authentication required');
      }

      // Store authenticated client
      this.authenticatedClients.set(socket.id, socket);

      this.context.logger.info('WebSocket client authenticated', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username
      });

      socket.emit('auth-success', {
        type: 'auth',
        message: 'Authentication successful',
        user: {
          id: socket.userId,
          username: socket.username,
          permissions: socket.permissions
        },
        timestamp: Date.now()
      });

      // Send initial system status
      await this.sendSystemStatus(socket);

    } catch (error) {
      this.context.logger.warn('WebSocket authentication failed', {
        socketId: socket.id,
        error: error.message
      });

      socket.emit('auth-error', {
        type: 'error',
        error: {
          code: 'AUTH_FAILED',
          message: error.message
        },
        timestamp: Date.now()
      });

      socket.disconnect();
    }
  }

  private async handleSubscription(socket: AuthenticatedSocket, data: WSSubscribeMessage): Promise<void> {
    if (!socket.isAuthenticated) {
      socket.emit('subscription-error', {
        type: 'error',
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'Authentication required for subscriptions'
        },
        timestamp: Date.now()
      });
      return;
    }

    try {
      const { channel, params } = data;

      // Validate permissions for subscription
      if (!this.hasSubscriptionPermission(socket, channel)) {
        socket.emit('subscription-error', {
          type: 'error',
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Insufficient permissions for channel: ${channel}`
          },
          timestamp: Date.now()
        });
        return;
      }

      // Add socket to channel subscription
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(socket.id);
      socket.subscriptions!.add(channel);

      this.context.logger.info('WebSocket subscription added', {
        socketId: socket.id,
        userId: socket.userId,
        channel,
        params
      });

      socket.emit('subscription-success', {
        type: 'subscription',
        channel,
        message: `Subscribed to ${channel}`,
        timestamp: Date.now()
      });

      // Send initial data for the channel
      await this.sendInitialChannelData(socket, channel, params);

    } catch (error) {
      this.context.logger.error('WebSocket subscription failed', {
        socketId: socket.id,
        userId: socket.userId,
        error: error.message
      });

      socket.emit('subscription-error', {
        type: 'error',
        error: {
          code: 'SUBSCRIPTION_FAILED',
          message: error.message
        },
        timestamp: Date.now()
      });
    }
  }

  private async handleUnsubscription(socket: AuthenticatedSocket, data: WSUnsubscribeMessage): Promise<void> {
    const { channel } = data;

    // Remove socket from channel subscription
    if (this.subscriptions.has(channel)) {
      this.subscriptions.get(channel)!.delete(socket.id);
      if (this.subscriptions.get(channel)!.size === 0) {
        this.subscriptions.delete(channel);
      }
    }

    socket.subscriptions!.delete(channel);

    this.context.logger.info('WebSocket unsubscription', {
      socketId: socket.id,
      userId: socket.userId,
      channel
    });

    socket.emit('unsubscription-success', {
      type: 'unsubscription',
      channel,
      message: `Unsubscribed from ${channel}`,
      timestamp: Date.now()
    });
  }

  private async handlePlaceOrder(socket: AuthenticatedSocket, data: any): Promise<void> => {
    if (!socket.isAuthenticated || !this.hasPermission(socket, 'trading.execute')) {
      socket.emit('order-error', {
        type: 'error',
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Trading execution permission required'
        },
        timestamp: Date.now()
      });
      return;
    }

    try {
      // Place order through trading engine
      const result = await this.context.nelogicaService.executeTrade({
        ...data,
        userId: socket.userId
      });

      socket.emit('order-result', {
        type: 'order',
        data: result,
        timestamp: Date.now()
      });

      this.context.logger.info('Order placed via WebSocket', {
        socketId: socket.id,
        userId: socket.userId,
        orderId: result.id
      });

    } catch (error) {
      socket.emit('order-error', {
        type: 'error',
        error: {
          code: 'ORDER_FAILED',
          message: error.message
        },
        timestamp: Date.now()
      });
    }
  }

  private async handleCancelOrder(socket: AuthenticatedSocket, data: any): Promise<void> => {
    if (!socket.isAuthenticated || !this.hasPermission(socket, 'trading.execute')) {
      socket.emit('cancel-error', {
        type: 'error',
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Trading execution permission required'
        },
        timestamp: Date.now()
      });
      return;
    }

    try {
      const result = await this.context.nelogicaService.cancelOrder(data.orderId);

      socket.emit('cancel-result', {
        type: 'cancel',
        data: result,
        timestamp: Date.now()
      });

    } catch (error) {
      socket.emit('cancel-error', {
        type: 'error',
        error: {
          code: 'CANCEL_FAILED',
          message: error.message
        },
        timestamp: Date.now()
      });
    }
  }

  private async handleEmergencyStop(socket: AuthenticatedSocket): Promise<void> => {
    if (!socket.isAuthenticated || !this.hasPermission(socket, 'trading.execute')) {
      socket.emit('emergency-error', {
        type: 'error',
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Trading execution permission required'
        },
        timestamp: Date.now()
      });
      return;
    }

    try {
      this.context.tradingEngine.emergencyStop(`Emergency stop via WebSocket by ${socket.username}`);

      socket.emit('emergency-result', {
        type: 'emergency',
        message: 'Emergency stop executed',
        timestamp: Date.now()
      });

      this.context.logger.warn('Emergency stop via WebSocket', {
        socketId: socket.id,
        userId: socket.userId,
        username: socket.username
      });

    } catch (error) {
      socket.emit('emergency-error', {
        type: 'error',
        error: {
          code: 'EMERGENCY_FAILED',
          message: error.message
        },
        timestamp: Date.now()
      });
    }
  }

  private async handleGetStatus(socket: AuthenticatedSocket): Promise<void> {
    if (!socket.isAuthenticated) return;

    try {
      await this.sendSystemStatus(socket);
    } catch (error) {
      this.context.logger.error('Failed to send system status', {
        socketId: socket.id,
        error: error.message
      });
    }
  }

  private handleDisconnection(socket: AuthenticatedSocket, reason: string): void {
    this.context.logger.info('WebSocket client disconnected', {
      socketId: socket.id,
      userId: socket.userId,
      reason
    });

    // Clean up subscriptions
    if (socket.subscriptions) {
      for (const channel of socket.subscriptions) {
        if (this.subscriptions.has(channel)) {
          this.subscriptions.get(channel)!.delete(socket.id);
          if (this.subscriptions.get(channel)!.size === 0) {
            this.subscriptions.delete(channel);
          }
        }
      }
    }

    // Remove from authenticated clients
    this.authenticatedClients.delete(socket.id);
  }

  // Broadcasting methods
  public broadcastMarketData(data: MarketData): void {
    this.broadcastToChannel('market-data', {
      type: 'market-data',
      data,
      timestamp: Date.now()
    });
  }

  public broadcastOrderBook(data: OrderBook): void {
    this.broadcastToChannel('order-book', {
      type: 'order-book',
      data,
      timestamp: Date.now()
    });
  }

  public broadcastTape(data: TapeEntry[]): void {
    this.broadcastToChannel('tape', {
      type: 'tape',
      data,
      timestamp: Date.now()
    });
  }

  public broadcastAIStatus(data: AIStatus): void {
    this.broadcastToChannel('ai-status', {
      type: 'ai-status',
      data,
      timestamp: Date.now()
    });
  }

  public broadcastSignal(data: any): void {
    this.broadcastToChannel('signals', {
      type: 'signal',
      data,
      timestamp: Date.now()
    });
  }

  public broadcastTrade(data: TradeEntry): void {
    this.broadcastToChannel('trades', {
      type: 'trade',
      data,
      timestamp: Date.now()
    });
  }

  public broadcastNotification(data: any): void {
    this.broadcastToChannel('notifications', {
      type: 'notification',
      data,
      timestamp: Date.now()
    });
  }

  private broadcastToChannel(channel: string, message: WSMessage): void {
    if (!this.io || !this.subscriptions.has(channel)) return;

    const socketIds = this.subscriptions.get(channel)!;
    for (const socketId of socketIds) {
      const socket = this.authenticatedClients.get(socketId);
      if (socket) {
        socket.emit('data', message);
      }
    }
  }

  // Helper methods
  private hasPermission(socket: AuthenticatedSocket, permission: string): boolean {
    return socket.permissions?.includes(permission) || 
           socket.permissions?.includes('system.admin') || false;
  }

  private hasSubscriptionPermission(socket: AuthenticatedSocket, channel: string): boolean {
    const channelPermissions: { [key: string]: string[] } = {
      'market-data': ['market_data.read'],
      'order-book': ['market_data.read'],
      'tape': ['market_data.read'],
      'ai-status': ['trading.read'],
      'signals': ['trading.read'],
      'trades': ['trading.read'],
      'notifications': ['trading.read'],
      'system-status': ['system.read']
    };

    const requiredPermissions = channelPermissions[channel] || [];
    return requiredPermissions.some(permission => this.hasPermission(socket, permission));
  }

  private async sendInitialChannelData(socket: AuthenticatedSocket, channel: string, params?: any): Promise<void> {
    try {
      switch (channel) {
        case 'market-data':
          const marketData = await this.context.nelogicaService.getCurrentMarketData();
          socket.emit('data', {
            type: 'market-data',
            data: marketData,
            timestamp: Date.now()
          });
          break;

        case 'ai-status':
          const aiStatus = this.context.tradingEngine.getAIStatus();
          socket.emit('data', {
            type: 'ai-status',
            data: aiStatus,
            timestamp: Date.now()
          });
          break;

        case 'system-status':
          await this.sendSystemStatus(socket);
          break;
      }
    } catch (error) {
      this.context.logger.error('Failed to send initial channel data', {
        channel,
        socketId: socket.id,
        error: error.message
      });
    }
  }

  private async sendSystemStatus(socket: AuthenticatedSocket): Promise<void> {
    const systemStatus = {
      trading: {
        isActive: this.context.tradingEngine.isEngineActive(),
        dailyPnL: this.context.tradingEngine.getDailyPnL(),
        tradesCount: this.context.tradingEngine.getTradesCount()
      },
      nelogica: {
        isConnected: (await this.context.nelogicaService.getConnectionStatus()).isConnected
      },
      webSocket: {
        activeConnections: this.authenticatedClients.size,
        totalSubscriptions: Array.from(this.subscriptions.values())
          .reduce((sum, set) => sum + set.size, 0)
      }
    };

    socket.emit('data', {
      type: 'system-status',
      data: systemStatus,
      timestamp: Date.now()
    });
  }

  public getActiveConnectionsCount(): number {
    return this.authenticatedClients.size;
  }

  public getTotalConnectionsCount(): number {
    return this.io?.engine.clientsCount || 0;
  }

  public getUserSubscriptions(userId: string): any[] {
    const userSockets = Array.from(this.authenticatedClients.values())
      .filter(socket => socket.userId === userId);
    
    const subscriptions: any[] = [];
    userSockets.forEach(socket => {
      if (socket.subscriptions) {
        socket.subscriptions.forEach(channel => {
          subscriptions.push({
            socketId: socket.id,
            channel,
            subscribedAt: Date.now() // This would be stored properly in production
          });
        });
      }
    });

    return subscriptions;
  }

  public async subscribeMarketData(userId: string, subscription: MarketDataSubscription): Promise<string> {
    // Implementation would create subscription ID and manage market data subscriptions
    const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store subscription details for user
    // In production, this would be persisted
    
    return subscriptionId;
  }

  public async unsubscribeMarketData(userId: string, subscriptionId: string): Promise<void> {
    // Implementation would remove subscription
  }
}