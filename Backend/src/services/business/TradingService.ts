import { Types } from 'mongoose';
import { 
  User, 
  TradingSession, 
  Order, 
  Position, 
  MLPrediction, 
  RiskManagement,
  ITradingSession,
  IOrder,
  IPosition,
  IMLPrediction,
  IRiskManagement
} from '../models';

interface CreateSessionData {
  userId: string;
  config?: {
    maxDailyLoss?: number;
    maxPositionSize?: number;
    targetPoints?: number;
    stopLossPoints?: number;
    enableMLTrading?: boolean;
  };
}

interface CreateOrderData {
  userId: string;
  sessionId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT';
  price?: number;
  stopPrice?: number;
  source: 'MANUAL' | 'ML_ENGINE' | 'ALGORITHM' | 'API';
  mlPredictionId?: string;
}

interface TradingStats {
  totalSessions: number;
  activeSessions: number;
  totalOrders: number;
  totalPositions: number;
  totalPnL: number;
  winRate: number;
}

export class TradingService {
  private static instance: TradingService;

  public static getInstance(): TradingService {
    if (!TradingService.instance) {
      TradingService.instance = new TradingService();
    }
    return TradingService.instance;
  }

  /**
   * Trading Session Management
   */
  public async createTradingSession(data: CreateSessionData): Promise<{
    success: boolean;
    session?: ITradingSession;
    error?: string;
  }> {
    try {
      // Verify user can trade
      const user = await User.findById(data.userId);
      if (!user || !user.canTrade()) {
        return {
          success: false,
          error: 'User is not authorized to trade'
        };
      }

      // Check if user already has an active session
      const existingSession = await TradingSession.findOne({
        userId: data.userId,
        status: 'ACTIVE'
      });

      if (existingSession) {
        return {
          success: false,
          error: 'User already has an active trading session'
        };
      }

      // Create new session
      const sessionId = `SESSION_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const session = new TradingSession({
        userId: data.userId,
        sessionId,
        status: 'ACTIVE',
        config: {
          maxDailyLoss: data.config?.maxDailyLoss || user.maxDailyLoss,
          maxPositionSize: data.config?.maxPositionSize || user.maxPositionSize,
          targetPoints: data.config?.targetPoints || 2,
          stopLossPoints: data.config?.stopLossPoints || 1.5,
          riskRewardRatio: (data.config?.targetPoints || 2) / (data.config?.stopLossPoints || 1.5),
          maxConsecutiveLosses: 3,
          enableMLTrading: data.config?.enableMLTrading !== false,
          emergencyStopEnabled: true
        },
        events: [{
          timestamp: new Date(),
          type: 'START',
          description: 'Trading session started'
        }]
      });

      await session.save();

      // Update user's risk management for this session
      await RiskManagement.findOneAndUpdate(
        { userId: data.userId },
        { sessionId: session._id },
        { upsert: true }
      );

      return {
        success: true,
        session
      };

    } catch (error) {
      console.error('Create trading session error:', error);
      return {
        success: false,
        error: 'Failed to create trading session'
      };
    }
  }

  public async endTradingSession(
    userId: string, 
    sessionId: string,
    reason: string = 'Manual stop'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const session = await TradingSession.findOne({
        _id: sessionId,
        userId,
        status: 'ACTIVE'
      });

      if (!session) {
        return {
          success: false,
          error: 'Active session not found'
        };
      }

      // Close any open positions
      await this.closeAllPositions(userId, sessionId, 'Session ended');

      // Update session
      session.status = 'STOPPED';
      session.endTime = new Date();
      session.addEvent('STOP', reason);

      // Calculate final statistics
      session.updateStats();

      await session.save();

      return { success: true };

    } catch (error) {
      console.error('End trading session error:', error);
      return {
        success: false,
        error: 'Failed to end trading session'
      };
    }
  }

  public async getActiveSession(userId: string): Promise<ITradingSession | null> {
    try {
      const session = await TradingSession.findOne({
        userId,
        status: 'ACTIVE'
      });

      return session;
    } catch (error) {
      console.error('Get active session error:', error);
      return null;
    }
  }

  /**
   * Order Management
   */
  public async createOrder(data: CreateOrderData): Promise<{
    success: boolean;
    order?: IOrder;
    error?: string;
  }> {
    try {
      // Validate session and user
      const session = await TradingSession.findOne({
        _id: data.sessionId,
        userId: data.userId,
        status: 'ACTIVE'
      });

      if (!session) {
        return {
          success: false,
          error: 'No active trading session found'
        };
      }

      // Check if user can trade
      if (!session.canTrade()) {
        return {
          success: false,
          error: 'Trading is blocked due to risk limits'
        };
      }

      // Risk validation
      const riskCheck = await this.validateOrderRisk(data, session);
      if (!riskCheck.allowed) {
        return {
          success: false,
          error: riskCheck.reason
        };
      }

      // Create order
      const orderId = `ORD_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const order = new Order({
        userId: data.userId,
        sessionId: data.sessionId,
        orderId,
        symbol: data.symbol,
        side: data.side,
        orderType: data.orderType,
        quantity: data.quantity,
        price: data.price,
        stopPrice: data.stopPrice,
        source: data.source,
        remainingQuantity: data.quantity,
        
        // Add ML prediction reference if provided
        ...(data.mlPredictionId && {
          mlPrediction: {
            predictionId: new Types.ObjectId(data.mlPredictionId)
          }
        }),
        
        validationChecks: riskCheck.validationChecks
      });

      await order.save();

      // Update session stats
      session.stats.totalOrders += 1;
      await session.save();

      // Simulate order execution (in production, this would integrate with broker)
      await this.simulateOrderExecution(order);

      return {
        success: true,
        order
      };

    } catch (error) {
      console.error('Create order error:', error);
      return {
        success: false,
        error: 'Failed to create order'
      };
    }
  }

  public async cancelOrder(
    userId: string,
    orderId: string,
    reason: string = 'User cancellation'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const order = await Order.findOne({
        orderId,
        userId,
        status: { $in: ['PENDING', 'SUBMITTED', 'PARTIAL_FILLED'] }
      });

      if (!order) {
        return {
          success: false,
          error: 'Order not found or cannot be cancelled'
        };
      }

      order.cancel(reason);
      await order.save();

      return { success: true };

    } catch (error) {
      console.error('Cancel order error:', error);
      return {
        success: false,
        error: 'Failed to cancel order'
      };
    }
  }

  public async getUserOrders(
    userId: string,
    sessionId?: string,
    status?: string
  ): Promise<IOrder[]> {
    try {
      const filter: any = { userId };
      
      if (sessionId) filter.sessionId = sessionId;
      if (status) filter.status = status;

      const orders = await Order.find(filter)
        .sort({ createdAt: -1 })
        .populate('mlPrediction.predictionId');

      return orders;
    } catch (error) {
      console.error('Get user orders error:', error);
      return [];
    }
  }

  /**
   * Position Management
   */
  public async getUserPositions(
    userId: string,
    sessionId?: string,
    status?: string
  ): Promise<IPosition[]> {
    try {
      const filter: any = { userId };
      
      if (sessionId) filter.sessionId = sessionId;
      if (status) filter.status = status;

      const positions = await Position.find(filter)
        .sort({ createdAt: -1 })
        .populate('entryOrders')
        .populate('exitOrders');

      return positions;
    } catch (error) {
      console.error('Get user positions error:', error);
      return [];
    }
  }

  public async closePosition(
    userId: string,
    positionId: string,
    exitPrice?: number,
    quantity?: number,
    reason: string = 'Manual close'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const position = await Position.findOne({
        _id: positionId,
        userId,
        status: { $in: ['OPEN', 'PARTIALLY_CLOSED'] }
      });

      if (!position) {
        return {
          success: false,
          error: 'Position not found or already closed'
        };
      }

      // Use current market price if not provided
      const closePrice = exitPrice || position.currentPrice || position.averagePrice;
      
      // Close position
      position.closePosition(closePrice, quantity);
      position.addEvent(
        quantity && quantity < position.quantity ? 'PARTIAL_EXIT' : 'FULL_EXIT',
        reason
      );

      await position.save();

      // Update session statistics
      const session = await TradingSession.findById(position.sessionId);
      if (session) {
        if (position.status === 'CLOSED') {
          session.stats.totalTrades += 1;
          
          if (position.totalPnL > 0) {
            session.stats.winningTrades += 1;
          } else {
            session.stats.losingTrades += 1;
          }
          
          session.stats.totalPnL += position.totalPnL;
          session.stats.realizedPnL += position.realizedPnL;
        }
        
        session.updateStats();
        await session.save();
      }

      return { success: true };

    } catch (error) {
      console.error('Close position error:', error);
      return {
        success: false,
        error: 'Failed to close position'
      };
    }
  }

  public async closeAllPositions(
    userId: string,
    sessionId: string,
    reason: string = 'Close all positions'
  ): Promise<{ success: boolean; closed: number; errors: string[] }> {
    const result = {
      success: true,
      closed: 0,
      errors: [] as string[]
    };

    try {
      const openPositions = await Position.find({
        userId,
        sessionId,
        status: { $in: ['OPEN', 'PARTIALLY_CLOSED'] }
      });

      for (const position of openPositions) {
        try {
          const closeResult = await this.closePosition(
            userId,
            position._id.toString(),
            undefined,
            undefined,
            reason
          );

          if (closeResult.success) {
            result.closed += 1;
          } else {
            result.errors.push(closeResult.error || 'Unknown error');
          }
        } catch (error) {
          result.errors.push(`Failed to close position ${position.positionId}`);
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

    } catch (error) {
      console.error('Close all positions error:', error);
      result.success = false;
      result.errors.push('Failed to retrieve positions');
    }

    return result;
  }

  /**
   * ML Trading Integration
   */
  public async executeMLPrediction(
    userId: string,
    predictionId: string
  ): Promise<{ success: boolean; order?: IOrder; error?: string }> {
    try {
      const prediction = await MLPrediction.findById(predictionId);
      
      if (!prediction || !prediction.shouldExecute()) {
        return {
          success: false,
          error: 'Prediction not valid for execution'
        };
      }

      const session = await this.getActiveSession(userId);
      if (!session) {
        return {
          success: false,
          error: 'No active trading session'
        };
      }

      // Create order based on ML prediction
      const orderData: CreateOrderData = {
        userId,
        sessionId: session._id.toString(),
        symbol: prediction.symbol,
        side: prediction.signal as 'BUY' | 'SELL',
        quantity: 1, // This should be calculated based on risk management
        orderType: 'MARKET',
        source: 'ML_ENGINE',
        mlPredictionId: predictionId
      };

      const result = await this.createOrder(orderData);

      if (result.success && result.order) {
        // Update prediction with execution details
        prediction.status = 'EXECUTED';
        prediction.execution = {
          orderId: result.order._id,
          positionId: new Types.ObjectId(), // Will be set when position is created
          executionTime: new Date(),
          executionPrice: result.order.price || 0,
          slippage: 0
        };
        await prediction.save();
      }

      return result;

    } catch (error) {
      console.error('Execute ML prediction error:', error);
      return {
        success: false,
        error: 'Failed to execute ML prediction'
      };
    }
  }

  /**
   * Trading Statistics
   */
  public async getTradingStats(userId?: string): Promise<TradingStats> {
    try {
      const filter = userId ? { userId } : {};

      const [
        totalSessions,
        activeSessions,
        totalOrders,
        totalPositions,
        positions
      ] = await Promise.all([
        TradingSession.countDocuments(filter),
        TradingSession.countDocuments({ ...filter, status: 'ACTIVE' }),
        Order.countDocuments(filter),
        Position.countDocuments(filter),
        Position.find({ ...filter, status: 'CLOSED' })
      ]);

      const totalPnL = positions.reduce((sum, pos) => sum + pos.totalPnL, 0);
      const winningTrades = positions.filter(pos => pos.totalPnL > 0).length;
      const winRate = positions.length > 0 ? (winningTrades / positions.length) * 100 : 0;

      return {
        totalSessions,
        activeSessions,
        totalOrders,
        totalPositions,
        totalPnL,
        winRate
      };

    } catch (error) {
      console.error('Get trading stats error:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        totalOrders: 0,
        totalPositions: 0,
        totalPnL: 0,
        winRate: 0
      };
    }
  }

  /**
   * Private Helper Methods
   */
  private async validateOrderRisk(
    data: CreateOrderData,
    session: ITradingSession
  ): Promise<{
    allowed: boolean;
    reason?: string;
    validationChecks: any;
  }> {
    const checks = {
      riskCheck: true,
      marginCheck: true,
      positionLimitCheck: true,
      dailyLossCheck: true
    };

    // Check position size limit
    if (data.quantity > session.config.maxPositionSize) {
      return {
        allowed: false,
        reason: `Order quantity exceeds maximum position size (${session.config.maxPositionSize})`,
        validationChecks: { ...checks, positionLimitCheck: false }
      };
    }

    // Check daily loss limit
    if (Math.abs(session.riskMetrics.dailyLoss) >= session.riskMetrics.dailyLossLimit) {
      return {
        allowed: false,
        reason: 'Daily loss limit reached',
        validationChecks: { ...checks, dailyLossCheck: false }
      };
    }

    // Check consecutive losses
    if (session.riskMetrics.consecutiveLosses >= session.config.maxConsecutiveLosses) {
      return {
        allowed: false,
        reason: 'Maximum consecutive losses reached',
        validationChecks: { ...checks, riskCheck: false }
      };
    }

    return {
      allowed: true,
      validationChecks: checks
    };
  }

  private async simulateOrderExecution(order: IOrder): Promise<void> {
    // In production, this would integrate with a real broker
    // For now, simulate execution with some delay
    
    setTimeout(async () => {
      try {
        order.updateStatus('SUBMITTED');
        
        // Simulate fill after 1-3 seconds
        setTimeout(async () => {
          const executionPrice = order.price || (4580 + (Math.random() - 0.5) * 2);
          
          order.addFill({
            fillId: `FILL_${Date.now()}`,
            quantity: order.quantity,
            price: executionPrice,
            timestamp: new Date()
          });
          
          // Create position if fully filled
          if (order.status === 'FILLED') {
            await this.createPositionFromOrder(order);
          }
          
          await order.save();
          
        }, Math.random() * 2000 + 1000);
        
        await order.save();
        
      } catch (error) {
        console.error('Order simulation error:', error);
      }
    }, 100);
  }

  private async createPositionFromOrder(order: IOrder): Promise<void> {
    try {
      const positionId = `POS_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      
      const position = new Position({
        userId: order.userId,
        sessionId: order.sessionId,
        positionId,
        symbol: order.symbol,
        side: order.side === 'BUY' ? 'LONG' : 'SHORT',
        quantity: order.executedQuantity,
        averagePrice: order.avgExecutionPrice || order.price || 0,
        entryOrders: [order._id],
        entryPrice: order.avgExecutionPrice || order.price || 0,
        entryQuantity: order.executedQuantity,
        source: order.source,
        
        // Copy ML prediction if available
        ...(order.mlPrediction && {
          mlPrediction: order.mlPrediction
        })
      });

      await position.save();

      // Update order with position reference
      await Order.findByIdAndUpdate(order._id, {
        'execution.positionId': position._id
      });

    } catch (error) {
      console.error('Create position from order error:', error);
    }
  }
}

// Export singleton instance
export const tradingService = TradingService.getInstance();
export default tradingService;