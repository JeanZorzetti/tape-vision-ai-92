import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

interface TradingHours {
  start: string; // HH:MM format
  end: string;   // HH:MM format
  timezone: string;
}

interface TradingSession {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  isActive: boolean;
  maxPositions: number;
  maxDailyLoss: number;
  currentPositions: number;
  dailyPnL: number;
  tradesCount: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  restrictions: {
    allowedSymbols: string[];
    maxOrderSize: number;
    cooldownPeriod: number; // seconds between trades
    lastTradeTime?: number;
  };
}

interface MarketStatus {
  isOpen: boolean;
  nextOpen?: number;
  nextClose?: number;
  session: 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';
  auctionPhase: 'NONE' | 'OPENING' | 'CLOSING' | 'CONSOLIDATED';
}

class TradingSessionMiddleware {
  private activeSessions: Map<string, TradingSession> = new Map();
  private readonly REGULAR_HOURS: TradingHours = {
    start: '09:00',
    end: '17:30',
    timezone: 'America/Sao_Paulo'
  };
  
  private readonly PRE_MARKET_HOURS: TradingHours = {
    start: '08:00', 
    end: '09:00',
    timezone: 'America/Sao_Paulo'
  };

  private readonly AFTER_HOURS: TradingHours = {
    start: '17:30',
    end: '18:00', 
    timezone: 'America/Sao_Paulo'
  };

  /**
   * Validate trading session and market hours
   */
  validateSession = (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'User authentication required for trading',
        code: 'AUTH_REQUIRED'
      });
      return;
    }

    // Check if user has active trading session
    const session = this.getActiveSession(req.user.id);
    if (!session) {
      res.status(403).json({
        success: false,
        error: 'No active trading session. Please start a trading session first.',
        code: 'NO_TRADING_SESSION'
      });
      return;
    }

    // Check market hours
    const marketStatus = this.getMarketStatus();
    if (!this.isMarketOpen(marketStatus) && !this.isAuthorizedForExtendedHours(req.user)) {
      res.status(409).json({
        success: false,
        error: 'Market is currently closed',
        code: 'MARKET_CLOSED',
        details: {
          currentSession: marketStatus.session,
          nextOpen: marketStatus.nextOpen,
          nextClose: marketStatus.nextClose
        }
      });
      return;
    }

    // Check if in auction phase (post-leilão requirement from autonomous bot)
    if (marketStatus.auctionPhase === 'OPENING') {
      res.status(409).json({
        success: false,
        error: 'Trading not allowed during opening auction. Wait for market consolidation.',
        code: 'AUCTION_PHASE',
        details: {
          auctionPhase: marketStatus.auctionPhase,
          estimatedConsolidationTime: this.getEstimatedConsolidationTime()
        }
      });
      return;
    }

    // Attach session to request
    (req as any).tradingSession = session;

    next();
  };

  /**
   * Check trading limits and restrictions
   */
  checkTradingLimits = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const session = (req as any).tradingSession as TradingSession;
    if (!session) {
      res.status(403).json({
        success: false,
        error: 'No trading session found',
        code: 'NO_TRADING_SESSION'
      });
      return;
    }

    // Check daily loss limit
    if (session.dailyPnL <= -session.maxDailyLoss) {
      res.status(409).json({
        success: false,
        error: `Daily loss limit exceeded: ${session.maxDailyLoss} points`,
        code: 'DAILY_LOSS_LIMIT_EXCEEDED',
        details: {
          currentPnL: session.dailyPnL,
          maxDailyLoss: session.maxDailyLoss
        }
      });
      return;
    }

    // Check maximum positions
    if (session.currentPositions >= session.maxPositions) {
      res.status(409).json({
        success: false,
        error: `Maximum positions limit reached: ${session.maxPositions}`,
        code: 'MAX_POSITIONS_EXCEEDED',
        details: {
          currentPositions: session.currentPositions,
          maxPositions: session.maxPositions
        }
      });
      return;
    }

    // Check cooldown period
    if (session.restrictions.lastTradeTime) {
      const timeSinceLastTrade = Date.now() - session.restrictions.lastTradeTime;
      const cooldownRemaining = session.restrictions.cooldownPeriod * 1000 - timeSinceLastTrade;
      
      if (cooldownRemaining > 0) {
        res.status(409).json({
          success: false,
          error: `Cooldown period active. Please wait ${Math.ceil(cooldownRemaining / 1000)} seconds.`,
          code: 'COOLDOWN_ACTIVE',
          details: {
            remainingSeconds: Math.ceil(cooldownRemaining / 1000)
          }
        });
        return;
      }
    }

    // Check symbol restrictions
    const symbol = req.body?.symbol || req.params?.symbol;
    if (symbol && !session.restrictions.allowedSymbols.includes(symbol)) {
      res.status(403).json({
        success: false,
        error: `Symbol ${symbol} not allowed for this session`,
        code: 'SYMBOL_NOT_ALLOWED',
        details: {
          allowedSymbols: session.restrictions.allowedSymbols
        }
      });
      return;
    }

    // Check order size limits
    const quantity = req.body?.quantity;
    if (quantity && quantity > session.restrictions.maxOrderSize) {
      res.status(400).json({
        success: false,
        error: `Order size ${quantity} exceeds maximum allowed: ${session.restrictions.maxOrderSize}`,
        code: 'ORDER_SIZE_EXCEEDED',
        details: {
          maxOrderSize: session.restrictions.maxOrderSize
        }
      });
      return;
    }

    next();
  };

  /**
   * Autonomous bot daily goal validation
   */
  checkDailyGoal = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const session = (req as any).tradingSession as TradingSession;
    if (!session) return next();

    const DAILY_GOAL = 3; // 3 points as per autonomous bot rules

    // Check if daily goal (3 points) already reached
    if (session.dailyPnL >= DAILY_GOAL) {
      res.status(409).json({
        success: false,
        error: 'Daily goal of 3 points reached. Trading session ended for today.',
        code: 'DAILY_GOAL_REACHED',
        details: {
          dailyPnL: session.dailyPnL,
          dailyGoal: DAILY_GOAL,
          shutdownTime: new Date().toISOString()
        }
      });
      
      // Automatically end session when daily goal reached
      this.endSession(session.userId, 'DAILY_GOAL_REACHED');
      return;
    }

    next();
  };

  /**
   * Post-auction consolidation check (autonomous bot requirement)
   */
  checkPostAuctionConsolidation = (req: AuthRequest, res: Response, next: NextFunction): void => {
    const marketStatus = this.getMarketStatus();
    const currentTime = new Date();
    const marketOpen = new Date();
    marketOpen.setHours(9, 0, 0, 0); // 9:00 AM
    
    const auctionEnd = new Date();
    auctionEnd.setHours(9, 5, 0, 0); // 9:05 AM (auction typically ends)
    
    const consolidationTime = new Date();
    consolidationTime.setHours(9, 15, 0, 0); // 9:15 AM (10 min post-auction)

    // If it's between auction end and consolidation time, block trading
    if (currentTime > auctionEnd && currentTime < consolidationTime) {
      const waitTime = Math.ceil((consolidationTime.getTime() - currentTime.getTime()) / 60000);
      
      res.status(409).json({
        success: false,
        error: 'Awaiting post-auction market consolidation. Trading resumes after 10 minutes.',
        code: 'POST_AUCTION_CONSOLIDATION',
        details: {
          waitTimeMinutes: waitTime,
          consolidationTime: consolidationTime.toISOString(),
          currentTime: currentTime.toISOString()
        }
      });
      return;
    }

    next();
  };

  /**
   * Start new trading session
   */
  startSession(userId: string, config?: Partial<TradingSession>): TradingSession {
    // End any existing session
    this.endSession(userId);

    const session: TradingSession = {
      id: `session_${Date.now()}_${userId}`,
      userId,
      startTime: Date.now(),
      isActive: true,
      maxPositions: config?.maxPositions || 5,
      maxDailyLoss: config?.maxDailyLoss || 3, // 3 points max loss per autonomous bot rules
      currentPositions: 0,
      dailyPnL: 0,
      tradesCount: 0,
      riskLevel: config?.riskLevel || 'MEDIUM',
      restrictions: {
        allowedSymbols: config?.restrictions?.allowedSymbols || ['WDO', 'DOL'], // Mini dollar futures
        maxOrderSize: config?.restrictions?.maxOrderSize || 10,
        cooldownPeriod: config?.restrictions?.cooldownPeriod || 5 // 5 seconds cooldown
      }
    };

    this.activeSessions.set(userId, session);
    
    console.log(`🎯 Trading session started for user ${userId}:`, {
      sessionId: session.id,
      maxPositions: session.maxPositions,
      maxDailyLoss: session.maxDailyLoss,
      allowedSymbols: session.restrictions.allowedSymbols
    });

    return session;
  }

  /**
   * End trading session
   */
  endSession(userId: string, reason?: string): boolean {
    const session = this.activeSessions.get(userId);
    if (!session) return false;

    session.isActive = false;
    session.endTime = Date.now();
    
    console.log(`🏁 Trading session ended for user ${userId}:`, {
      sessionId: session.id,
      duration: session.endTime - session.startTime,
      finalPnL: session.dailyPnL,
      tradesCount: session.tradesCount,
      reason: reason || 'MANUAL'
    });

    this.activeSessions.delete(userId);
    return true;
  }

  /**
   * Get active session for user
   */
  getActiveSession(userId: string): TradingSession | null {
    const session = this.activeSessions.get(userId);
    if (!session || !session.isActive) return null;
    
    // Check if session is still valid (max 8 hours)
    const sessionDuration = Date.now() - session.startTime;
    const maxSessionTime = 8 * 60 * 60 * 1000; // 8 hours
    
    if (sessionDuration > maxSessionTime) {
      this.endSession(userId, 'SESSION_TIMEOUT');
      return null;
    }

    return session;
  }

  /**
   * Update session after trade
   */
  updateSessionAfterTrade(userId: string, pnl: number, positionChange: number): void {
    const session = this.activeSessions.get(userId);
    if (!session) return;

    session.dailyPnL += pnl;
    session.currentPositions += positionChange;
    session.tradesCount += 1;
    session.restrictions.lastTradeTime = Date.now();

    // Auto-end session if daily goal reached (3 points)
    if (session.dailyPnL >= 3) {
      this.endSession(userId, 'DAILY_GOAL_REACHED');
    }
    
    // Auto-end session if daily loss limit hit
    if (session.dailyPnL <= -session.maxDailyLoss) {
      this.endSession(userId, 'DAILY_LOSS_LIMIT');
    }
  }

  /**
   * Get current market status
   */
  private getMarketStatus(): MarketStatus {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('pt-BR', { 
      hour12: false, 
      timeZone: 'America/Sao_Paulo' 
    });
    
    const [hours, minutes] = timeStr.split(':').map(Number);
    const currentTime = hours * 60 + minutes;
    
    // Market hours in minutes
    const preMarketStart = 8 * 60; // 08:00
    const regularStart = 9 * 60; // 09:00
    const auctionEnd = 9 * 60 + 5; // 09:05
    const consolidationEnd = 9 * 60 + 15; // 09:15
    const regularEnd = 17 * 60 + 30; // 17:30
    const afterHoursEnd = 18 * 60; // 18:00

    let session: MarketStatus['session'] = 'CLOSED';
    let auctionPhase: MarketStatus['auctionPhase'] = 'NONE';
    let isOpen = false;

    if (currentTime >= preMarketStart && currentTime < regularStart) {
      session = 'PRE_MARKET';
      isOpen = true;
    } else if (currentTime >= regularStart && currentTime < regularEnd) {
      session = 'REGULAR';
      isOpen = true;
      
      // Check auction phases
      if (currentTime >= regularStart && currentTime < auctionEnd) {
        auctionPhase = 'OPENING';
      } else if (currentTime >= auctionEnd && currentTime < consolidationEnd) {
        auctionPhase = 'CONSOLIDATED';
      }
    } else if (currentTime >= regularEnd && currentTime < afterHoursEnd) {
      session = 'AFTER_HOURS';
      isOpen = true;
    }

    return {
      isOpen,
      session,
      auctionPhase,
      nextOpen: this.calculateNextOpen(now),
      nextClose: this.calculateNextClose(now)
    };
  }

  /**
   * Check if market is open for trading
   */
  private isMarketOpen(marketStatus: MarketStatus): boolean {
    return marketStatus.isOpen && marketStatus.session === 'REGULAR';
  }

  /**
   * Check if user is authorized for extended hours trading
   */
  private isAuthorizedForExtendedHours(user: any): boolean {
    return user.role === 'ADMIN' || user.permissions?.includes('EXTENDED_HOURS_TRADING');
  }

  /**
   * Get estimated consolidation time
   */
  private getEstimatedConsolidationTime(): number {
    const consolidation = new Date();
    consolidation.setHours(9, 15, 0, 0); // 9:15 AM
    return consolidation.getTime();
  }

  /**
   * Calculate next market open time
   */
  private calculateNextOpen(now: Date): number {
    const nextOpen = new Date(now);
    nextOpen.setHours(9, 0, 0, 0);
    
    // If already past today's open, set to tomorrow
    if (now.getHours() >= 9) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }
    
    return nextOpen.getTime();
  }

  /**
   * Calculate next market close time
   */
  private calculateNextClose(now: Date): number {
    const nextClose = new Date(now);
    nextClose.setHours(17, 30, 0, 0);
    
    // If already past today's close, set to tomorrow
    if (now.getHours() >= 17 && now.getMinutes() >= 30) {
      nextClose.setDate(nextClose.getDate() + 1);
    }
    
    return nextClose.getTime();
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    activeSessions: number;
    totalSessions: number;
    averageSessionDuration: number;
    marketStatus: MarketStatus;
  } {
    const activeCount = this.activeSessions.size;
    const marketStatus = this.getMarketStatus();

    return {
      activeSessions: activeCount,
      totalSessions: activeCount, // Simplified for current implementation
      averageSessionDuration: 0, // Would calculate from historical data
      marketStatus
    };
  }

  /**
   * Get all active sessions (admin function)
   */
  getAllActiveSessions(): TradingSession[] {
    return Array.from(this.activeSessions.values());
  }
}

const tradingSession = new TradingSessionMiddleware();

export { 
  tradingSession,
  TradingSession,
  MarketStatus,
  TradingHours
};