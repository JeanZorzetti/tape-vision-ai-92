/**
 * Order Manager - High-Performance Order Execution and Management
 * Handles order lifecycle, execution, and real-time order management
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  Position,
  TradeEntry,
  RiskParameters,
  MarketData,
  TradingError
} from '@/types/trading';

export interface Order {
  id: string;
  clientOrderId: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop-limit';
  timeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  quantity: number;
  price?: number;
  stopPrice?: number;
  status: OrderStatus;
  filledQuantity: number;
  averageFillPrice: number;
  remainingQuantity: number;
  timestamp: number;
  lastUpdateTime: number;
  executionId?: string;
  commission?: number;
  slippage?: number;
  latency?: number;
  fills: OrderFill[];
  tags: string[];
  metadata?: Record<string, any>;
}

export interface OrderFill {
  id: string;
  orderId: string;
  executionId: string;
  price: number;
  quantity: number;
  timestamp: number;
  commission: number;
  liquidity: 'maker' | 'taker';
  counterParty?: string;
}

export type OrderStatus = 
  | 'pending'
  | 'submitted'
  | 'accepted'
  | 'partial'
  | 'filled'
  | 'canceled'
  | 'rejected'
  | 'expired'
  | 'suspended';

export interface OrderRequest {
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop-limit';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface OrderUpdate {
  orderId: string;
  status: OrderStatus;
  filledQuantity?: number;
  averageFillPrice?: number;
  timestamp: number;
  reason?: string;
  fill?: OrderFill;
}

export interface ExecutionReport {
  orderId: string;
  executionId: string;
  status: OrderStatus;
  side: 'buy' | 'sell';
  symbol: string;
  quantity: number;
  price: number;
  timestamp: number;
  commission: number;
  liquidity: 'maker' | 'taker';
}

export interface OrderManagerConfig {
  maxActiveOrders: number;
  defaultTimeInForce: 'GTC' | 'IOC' | 'FOK' | 'DAY';
  maxOrderValue: number;
  minOrderQuantity: number;
  maxSlippage: number;
  orderTimeout: number;
  enablePreTradeChecks: boolean;
  autoCancel: {
    enabled: boolean;
    afterSeconds: number;
  };
}

export class OrderManager extends EventEmitter {
  private logger: Logger;
  private config: OrderManagerConfig;
  private riskParameters: RiskParameters;
  
  // Order storage
  private activeOrders: Map<string, Order> = new Map();
  private orderHistory: Map<string, Order> = new Map();
  private pendingCancellations: Set<string> = new Set();
  
  // Performance tracking
  private metrics = {
    totalOrders: 0,
    filledOrders: 0,
    canceledOrders: 0,
    rejectedOrders: 0,
    averageExecutionTime: 0,
    totalSlippage: 0,
    totalCommissions: 0,
    startTime: Date.now()
  };
  
  // State management
  private isActive: boolean = false;
  private lastOrderId: number = 0;
  private orderTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    config: OrderManagerConfig,
    riskParameters: RiskParameters,
    logger: Logger
  ) {
    super();
    this.config = config;
    this.riskParameters = riskParameters;
    this.logger = logger.child({ component: 'OrderManager' });
    
    this.logger.info('OrderManager initialized', {
      maxActiveOrders: config.maxActiveOrders,
      defaultTimeInForce: config.defaultTimeInForce,
      enablePreTradeChecks: config.enablePreTradeChecks
    });
  }

  /**
   * Start the order manager
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting OrderManager');
      
      this.isActive = true;
      this.metrics.startTime = Date.now();
      
      // Start cleanup tasks
      this.startCleanupTasks();
      
      this.emit('manager-started');
      this.logger.info('OrderManager started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start OrderManager', error);
      throw error;
    }
  }

  /**
   * Stop the order manager
   */
  public async stop(): Promise<void> {
    try {
      this.logger.info('Stopping OrderManager');
      
      this.isActive = false;
      
      // Cancel all active orders
      await this.cancelAllOrders('SYSTEM_SHUTDOWN');
      
      // Clear timeouts
      this.orderTimeouts.forEach(timeout => clearTimeout(timeout));
      this.orderTimeouts.clear();
      
      this.emit('manager-stopped');
      this.logger.info('OrderManager stopped successfully');
      
    } catch (error) {
      this.logger.error('Error stopping OrderManager', error);
      throw error;
    }
  }

  /**
   * Submit a new order
   */
  public async submitOrder(request: OrderRequest): Promise<Order> {
    if (!this.isActive) {
      throw new TradingError('OrderManager is not active', 'MANAGER_INACTIVE');
    }
    
    try {
      // Validate order request
      this.validateOrderRequest(request);
      
      // Pre-trade checks
      if (this.config.enablePreTradeChecks) {
        await this.performPreTradeChecks(request);
      }
      
      // Create order
      const order = this.createOrder(request);
      
      // Store order
      this.activeOrders.set(order.id, order);
      
      // Set timeout if configured
      this.setOrderTimeout(order);
      
      // Submit to exchange (simulated)
      await this.submitToExchange(order);
      
      // Update metrics
      this.metrics.totalOrders++;
      
      this.logger.info('Order submitted', {
        orderId: order.id,
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        quantity: order.quantity,
        price: order.price
      });
      
      this.emit('order-submitted', order);
      return order;
      
    } catch (error) {
      this.logger.error('Error submitting order', error);
      this.metrics.rejectedOrders++;
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  public async cancelOrder(orderId: string, reason: string = 'USER_REQUEST'): Promise<boolean> {
    const order = this.activeOrders.get(orderId);
    if (!order) {
      throw new TradingError(`Order not found: ${orderId}`, 'ORDER_NOT_FOUND');
    }
    
    if (order.status === 'filled' || order.status === 'canceled') {
      throw new TradingError(`Cannot cancel order in status: ${order.status}`, 'INVALID_ORDER_STATUS');
    }
    
    try {
      // Mark as pending cancellation
      this.pendingCancellations.add(orderId);
      
      // Send cancellation to exchange
      await this.cancelAtExchange(order, reason);
      
      // Update order status
      order.status = 'canceled';
      order.lastUpdateTime = Date.now();
      
      // Move to history
      this.moveToHistory(order);
      
      // Clear timeout
      this.clearOrderTimeout(orderId);
      
      // Update metrics
      this.metrics.canceledOrders++;
      
      this.logger.info('Order canceled', { orderId, reason });
      this.emit('order-canceled', { order, reason });
      
      return true;
      
    } catch (error) {
      this.logger.error('Error canceling order', error);
      this.pendingCancellations.delete(orderId);
      throw error;
    }
  }

  /**
   * Cancel all active orders
   */
  public async cancelAllOrders(reason: string = 'CANCEL_ALL'): Promise<void> {
    const orderIds = Array.from(this.activeOrders.keys());
    
    this.logger.info('Canceling all orders', { count: orderIds.length, reason });
    
    const promises = orderIds.map(orderId => 
      this.cancelOrder(orderId, reason).catch(error => 
        this.logger.error('Error canceling order', { orderId, error })
      )
    );
    
    await Promise.all(promises);
  }

  /**
   * Modify an existing order
   */
  public async modifyOrder(
    orderId: string, 
    modifications: Partial<Pick<Order, 'quantity' | 'price' | 'stopPrice'>>
  ): Promise<Order> {
    const order = this.activeOrders.get(orderId);
    if (!order) {
      throw new TradingError(`Order not found: ${orderId}`, 'ORDER_NOT_FOUND');
    }
    
    if (order.status !== 'accepted' && order.status !== 'partial') {
      throw new TradingError(`Cannot modify order in status: ${order.status}`, 'INVALID_ORDER_STATUS');
    }
    
    try {
      // Validate modifications
      this.validateModifications(order, modifications);
      
      // Send modification to exchange
      await this.modifyAtExchange(order, modifications);
      
      // Update order
      Object.assign(order, modifications);
      order.lastUpdateTime = Date.now();
      
      this.logger.info('Order modified', { orderId, modifications });
      this.emit('order-modified', order);
      
      return order;
      
    } catch (error) {
      this.logger.error('Error modifying order', error);
      throw error;
    }
  }

  /**
   * Process execution report from exchange
   */
  public async processExecutionReport(report: ExecutionReport): Promise<void> {
    const order = this.activeOrders.get(report.orderId);
    if (!order) {
      this.logger.warn('Received execution report for unknown order', report);
      return;
    }
    
    try {
      // Calculate execution latency
      const latency = Date.now() - report.timestamp;
      
      // Create fill if partial or full execution
      if (report.status === 'partial' || report.status === 'filled') {
        const fill: OrderFill = {
          id: this.generateFillId(),
          orderId: report.orderId,
          executionId: report.executionId,
          price: report.price,
          quantity: report.quantity,
          timestamp: report.timestamp,
          commission: report.commission,
          liquidity: report.liquidity
        };
        
        order.fills.push(fill);
        order.filledQuantity += report.quantity;
        order.remainingQuantity = order.quantity - order.filledQuantity;
        
        // Calculate average fill price
        const totalValue = order.fills.reduce((sum, fill) => sum + (fill.price * fill.quantity), 0);
        order.averageFillPrice = totalValue / order.filledQuantity;
        
        // Calculate slippage for market orders
        if (order.type === 'market' && order.price) {
          const slippage = Math.abs(report.price - order.price) / order.price;
          order.slippage = slippage;
          this.metrics.totalSlippage += slippage;
        }
        
        // Update commission
        this.metrics.totalCommissions += report.commission;
      }
      
      // Update order status
      order.status = report.status;
      order.lastUpdateTime = Date.now();
      order.latency = latency;
      
      // Update metrics
      if (report.status === 'filled') {
        this.metrics.filledOrders++;
        this.metrics.averageExecutionTime = 
          (this.metrics.averageExecutionTime + latency) / 2;
        
        // Move to history
        this.moveToHistory(order);
        this.clearOrderTimeout(order.id);
      }
      
      this.logger.debug('Execution report processed', {
        orderId: report.orderId,
        status: report.status,
        quantity: report.quantity,
        price: report.price,
        latency
      });
      
      this.emit('execution-report', { order, report });
      
    } catch (error) {
      this.logger.error('Error processing execution report', error);
    }
  }

  private validateOrderRequest(request: OrderRequest): void {
    if (!request.symbol) {
      throw new TradingError('Symbol is required', 'VALIDATION_ERROR');
    }
    
    if (request.quantity <= 0 || request.quantity < this.config.minOrderQuantity) {
      throw new TradingError(
        `Invalid quantity: ${request.quantity}. Min: ${this.config.minOrderQuantity}`,
        'VALIDATION_ERROR'
      );
    }
    
    if (request.type === 'limit' && !request.price) {
      throw new TradingError('Price is required for limit orders', 'VALIDATION_ERROR');
    }
    
    if ((request.type === 'stop' || request.type === 'stop-limit') && !request.stopPrice) {
      throw new TradingError('Stop price is required for stop orders', 'VALIDATION_ERROR');
    }
    
    // Check maximum order value
    const orderValue = (request.price || 0) * request.quantity;
    if (orderValue > this.config.maxOrderValue) {
      throw new TradingError(
        `Order value exceeds maximum: ${orderValue} > ${this.config.maxOrderValue}`,
        'VALIDATION_ERROR'
      );
    }
    
    // Check maximum active orders
    if (this.activeOrders.size >= this.config.maxActiveOrders) {
      throw new TradingError(
        `Maximum active orders reached: ${this.config.maxActiveOrders}`,
        'MAX_ORDERS_REACHED'
      );
    }
  }

  private async performPreTradeChecks(request: OrderRequest): Promise<void> {
    // Check daily loss limit
    const currentPnL = this.calculateDailyPnL();
    if (currentPnL <= -this.riskParameters.maxDailyLoss) {
      throw new TradingError('Daily loss limit exceeded', 'RISK_LIMIT_EXCEEDED');
    }
    
    // Check position size limit
    const estimatedPositionSize = this.calculateEstimatedPosition(request);
    if (estimatedPositionSize > this.riskParameters.maxPositionSize) {
      throw new TradingError('Position size limit exceeded', 'RISK_LIMIT_EXCEEDED');
    }
    
    // Additional custom checks can be added here
  }

  private createOrder(request: OrderRequest): Order {
    const orderId = this.generateOrderId();
    
    return {
      id: orderId,
      clientOrderId: orderId,
      symbol: request.symbol,
      side: request.side,
      type: request.type,
      timeInForce: request.timeInForce || this.config.defaultTimeInForce,
      quantity: request.quantity,
      price: request.price,
      stopPrice: request.stopPrice,
      status: 'pending',
      filledQuantity: 0,
      averageFillPrice: 0,
      remainingQuantity: request.quantity,
      timestamp: Date.now(),
      lastUpdateTime: Date.now(),
      fills: [],
      tags: request.tags || [],
      metadata: request.metadata
    };
  }

  private async submitToExchange(order: Order): Promise<void> {
    // Simulate exchange submission
    // In real implementation, this would connect to actual exchange API
    
    order.status = 'submitted';
    order.lastUpdateTime = Date.now();
    
    // Simulate processing delay
    setTimeout(() => {
      if (order.status === 'submitted') {
        order.status = 'accepted';
        order.lastUpdateTime = Date.now();
        this.emit('order-accepted', order);
      }
    }, 100);
  }

  private async cancelAtExchange(order: Order, reason: string): Promise<void> {
    // Simulate exchange cancellation
    // In real implementation, this would send cancellation to exchange
    
    this.logger.debug('Sending cancellation to exchange', { orderId: order.id, reason });
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private async modifyAtExchange(
    order: Order, 
    modifications: Partial<Pick<Order, 'quantity' | 'price' | 'stopPrice'>>
  ): Promise<void> {
    // Simulate exchange modification
    // In real implementation, this would send modification to exchange
    
    this.logger.debug('Sending modification to exchange', { orderId: order.id, modifications });
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  private validateModifications(
    order: Order, 
    modifications: Partial<Pick<Order, 'quantity' | 'price' | 'stopPrice'>>
  ): void {
    if (modifications.quantity && modifications.quantity < order.filledQuantity) {
      throw new TradingError('Cannot reduce quantity below filled amount', 'VALIDATION_ERROR');
    }
    
    if (modifications.price && modifications.price <= 0) {
      throw new TradingError('Price must be positive', 'VALIDATION_ERROR');
    }
  }

  private setOrderTimeout(order: Order): void {
    if (this.config.autoCancel.enabled) {
      const timeout = setTimeout(() => {
        this.cancelOrder(order.id, 'TIMEOUT').catch(error => 
          this.logger.error('Error canceling timed out order', error)
        );
      }, this.config.autoCancel.afterSeconds * 1000);
      
      this.orderTimeouts.set(order.id, timeout);
    }
  }

  private clearOrderTimeout(orderId: string): void {
    const timeout = this.orderTimeouts.get(orderId);
    if (timeout) {
      clearTimeout(timeout);
      this.orderTimeouts.delete(orderId);
    }
  }

  private moveToHistory(order: Order): void {
    this.orderHistory.set(order.id, order);
    this.activeOrders.delete(order.id);
    this.pendingCancellations.delete(order.id);
  }

  private calculateDailyPnL(): number {
    // Calculate PnL from filled orders today
    // This is a simplified implementation
    return 0;
  }

  private calculateEstimatedPosition(request: OrderRequest): number {
    // Calculate what the position size would be after this order
    // This is a simplified implementation
    return request.quantity;
  }

  private startCleanupTasks(): void {
    // Cleanup old history entries every 5 minutes
    setInterval(() => {
      this.cleanupHistory();
    }, 300000);
  }

  private cleanupHistory(): void {
    const cutoffTime = Date.now() - (86400000); // 24 hours
    
    for (const [orderId, order] of this.orderHistory) {
      if (order.lastUpdateTime < cutoffTime) {
        this.orderHistory.delete(orderId);
      }
    }
  }

  private generateOrderId(): string {
    return `ORD_${Date.now()}_${++this.lastOrderId}`;
  }

  private generateFillId(): string {
    return `FILL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active orders
   */
  public getActiveOrders(): Order[] {
    return Array.from(this.activeOrders.values());
  }

  /**
   * Get order by ID
   */
  public getOrder(orderId: string): Order | undefined {
    return this.activeOrders.get(orderId) || this.orderHistory.get(orderId);
  }

  /**
   * Get orders by symbol
   */
  public getOrdersBySymbol(symbol: string): Order[] {
    return Array.from(this.activeOrders.values()).filter(order => order.symbol === symbol);
  }

  /**
   * Get order history
   */
  public getOrderHistory(limit: number = 100): Order[] {
    return Array.from(this.orderHistory.values())
      .sort((a, b) => b.lastUpdateTime - a.lastUpdateTime)
      .slice(0, limit);
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const fillRate = this.metrics.totalOrders > 0 ? 
      (this.metrics.filledOrders / this.metrics.totalOrders) * 100 : 0;
    
    return {
      ...this.metrics,
      uptime: Math.round(uptime / 1000),
      fillRate,
      activeOrders: this.activeOrders.size,
      averageSlippage: this.metrics.totalSlippage / Math.max(this.metrics.filledOrders, 1)
    };
  }

  /**
   * Check if manager is ready
   */
  public isReady(): boolean {
    return this.isActive;
  }

  /**
   * Emergency stop all trading
   */
  public emergencyStop(reason: string): void {
    this.logger.error('Emergency stop triggered', { reason });
    
    this.isActive = false;
    
    // Cancel all active orders
    this.cancelAllOrders(`EMERGENCY: ${reason}`).catch(error =>
      this.logger.error('Error during emergency stop', error)
    );
    
    this.emit('emergency-stop', { reason, timestamp: Date.now() });
  }
}