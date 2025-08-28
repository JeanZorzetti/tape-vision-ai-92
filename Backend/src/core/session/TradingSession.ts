/**
 * Trading Session - Advanced Session Management and Lifecycle Control
 * Manages trading sessions, market hours, and system state transitions
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import {
  TradingSession as TradingSessionData,
  TradingConfig,
  Position,
  TradeEntry,
  SystemHealth,
  TradingError
} from '@/types/trading';

export interface SessionSchedule {
  name: string;
  startTime: string; // HH:MM format
  endTime: string;   // HH:MM format
  timezone: string;
  daysOfWeek: number[]; // 0=Sunday, 1=Monday, etc.
  enabled: boolean;
}

export interface SessionState {
  id: string;
  status: SessionStatus;
  phase: SessionPhase;
  startTime: number;
  endTime?: number;
  plannedEndTime: number;
  currentTime: number;
  timeRemaining: number;
  marketHours: MarketHours;
  statistics: SessionStatistics;
  riskLimits: SessionRiskLimits;
}

export type SessionStatus = 
  | 'scheduled'
  | 'starting'
  | 'active'
  | 'pausing'
  | 'paused'
  | 'resuming'
  | 'stopping'
  | 'stopped'
  | 'completed'
  | 'emergency'
  | 'error';

export type SessionPhase = 
  | 'pre_market'
  | 'market_open'
  | 'regular_session'
  | 'lunch_break'
  | 'afternoon_session'
  | 'pre_close'
  | 'market_close'
  | 'after_hours'
  | 'maintenance';

export interface MarketHours {
  isOpen: boolean;
  phase: SessionPhase;
  nextPhaseTime: number;
  nextPhase: SessionPhase;
  timeToNextPhase: number;
  tradingAllowed: boolean;
}

export interface SessionStatistics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  totalVolume: number;
  totalPnL: number;
  realizedPnL: number;
  unrealizedPnL: number;
  maxDrawdown: number;
  maxProfit: number;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  tradingDuration: number;
  activeTradingTime: number;
}

export interface SessionRiskLimits {
  maxDailyLoss: number;
  maxDrawdown: number;
  maxPositions: number;
  maxOrderValue: number;
  maxTradingHours: number;
  stopTradingAfterLosses: number;
  currentDailyLoss: number;
  currentDrawdown: number;
  currentPositions: number;
  consecutiveLosses: number;
  limitsBreached: string[];
}

export interface SessionEvent {
  id: string;
  type: SessionEventType;
  timestamp: number;
  message: string;
  data?: any;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export type SessionEventType =
  | 'session_scheduled'
  | 'session_started'
  | 'session_paused'
  | 'session_resumed'
  | 'session_stopped'
  | 'session_completed'
  | 'phase_changed'
  | 'risk_limit_breached'
  | 'emergency_stop'
  | 'trade_executed'
  | 'position_opened'
  | 'position_closed'
  | 'system_error';

export interface TradingSessionConfig {
  sessionId: string;
  name: string;
  symbol: string;
  schedule: SessionSchedule;
  autoStart: boolean;
  autoStop: boolean;
  maxDuration: number; // milliseconds
  riskLimits: {
    maxDailyLoss: number;
    maxDrawdown: number;
    maxPositions: number;
    maxTradingHours: number;
    stopAfterConsecutiveLosses: number;
  };
  phases: {
    [key in SessionPhase]?: {
      tradingAllowed: boolean;
      riskMultiplier: number;
      maxPositions: number;
    };
  };
  emergencySettings: {
    enableEmergencyStop: boolean;
    maxSystemErrors: number;
    maxApiErrors: number;
    emergencyExitTime: number;
  };
}

export class TradingSession extends EventEmitter {
  private logger: Logger;
  private config: TradingSessionConfig;
  
  // Session state
  private currentState: SessionState;
  private isActive: boolean = false;
  private isPaused: boolean = false;
  private startTime: number = 0;
  private endTime?: number;
  
  // Trading data
  private trades: TradeEntry[] = [];
  private positions: Map<string, Position> = new Map();
  private sessionEvents: SessionEvent[] = [];
  
  // Timers and monitoring
  private sessionTimer?: NodeJS.Timeout;
  private phaseTimer?: NodeJS.Timeout;
  private monitoringTimer?: NodeJS.Timeout;
  
  // Performance tracking
  private sessionPeak: number = 0;
  private sessionLow: number = 0;
  private initialBalance: number = 0;
  private currentBalance: number = 0;
  
  // Risk management
  private consecutiveLosses: number = 0;
  private emergencyStopTriggered: boolean = false;
  private errorCount: number = 0;

  constructor(config: TradingSessionConfig, logger: Logger, initialBalance: number = 0) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'TradingSession', sessionId: config.sessionId });
    
    this.initialBalance = initialBalance;
    this.currentBalance = initialBalance;
    this.sessionPeak = initialBalance;
    this.sessionLow = initialBalance;
    
    this.currentState = this.initializeState();
    
    this.logger.info('TradingSession initialized', {
      sessionId: config.sessionId,
      name: config.name,
      symbol: config.symbol,
      initialBalance
    });
  }

  /**
   * Start the trading session
   */
  public async start(): Promise<void> {
    if (this.isActive) {
      throw new TradingError('Session is already active', 'SESSION_ALREADY_ACTIVE');
    }
    
    try {
      this.logger.info('Starting trading session');
      
      // Validate session can start
      this.validateSessionStart();
      
      // Initialize session
      this.isActive = true;
      this.isPaused = false;
      this.startTime = Date.now();
      this.emergencyStopTriggered = false;
      this.errorCount = 0;
      
      // Update state
      this.currentState.status = 'starting';
      this.currentState.startTime = this.startTime;
      this.currentState.plannedEndTime = this.calculatePlannedEndTime();
      
      // Start monitoring
      this.startMonitoring();
      
      // Determine initial market phase
      this.updateMarketPhase();
      
      // Set session active
      this.currentState.status = 'active';
      
      // Log session start event
      this.logSessionEvent('session_started', 'Trading session started', { 
        startTime: this.startTime,
        plannedEndTime: this.currentState.plannedEndTime
      });
      
      this.emit('session-started', this.currentState);
      this.logger.info('Trading session started successfully');
      
    } catch (error) {
      this.logger.error('Failed to start trading session', error);
      this.currentState.status = 'error';
      throw error;
    }
  }

  /**
   * Stop the trading session
   */
  public async stop(reason: string = 'Manual stop'): Promise<void> {
    if (!this.isActive) {
      throw new TradingError('Session is not active', 'SESSION_NOT_ACTIVE');
    }
    
    try {
      this.logger.info('Stopping trading session', { reason });
      
      this.currentState.status = 'stopping';
      
      // Close all positions if required
      if (this.positions.size > 0) {
        await this.closeAllPositions(`Session stop: ${reason}`);
      }
      
      // Stop monitoring
      this.stopMonitoring();
      
      // Finalize session
      this.endTime = Date.now();
      this.isActive = false;
      this.currentState.status = 'stopped';
      this.currentState.endTime = this.endTime;
      
      // Calculate final statistics
      this.calculateFinalStatistics();
      
      // Log session end event
      this.logSessionEvent('session_stopped', `Trading session stopped: ${reason}`, {
        endTime: this.endTime,
        duration: this.endTime - this.startTime,
        finalPnL: this.currentState.statistics.totalPnL
      });
      
      this.emit('session-stopped', { state: this.currentState, reason });
      this.logger.info('Trading session stopped successfully', {
        duration: this.endTime - this.startTime,
        totalTrades: this.trades.length,
        finalPnL: this.currentState.statistics.totalPnL
      });
      
    } catch (error) {
      this.logger.error('Error stopping trading session', error);
      this.currentState.status = 'error';
      throw error;
    }
  }

  /**
   * Pause the trading session
   */
  public async pause(reason: string = 'Manual pause'): Promise<void> {
    if (!this.isActive || this.isPaused) {
      throw new TradingError('Cannot pause session in current state', 'INVALID_SESSION_STATE');
    }
    
    try {
      this.logger.info('Pausing trading session', { reason });
      
      this.currentState.status = 'pausing';
      this.isPaused = true;
      
      // Pause all active operations
      // In a real implementation, this would pause strategy execution, order submission, etc.
      
      this.currentState.status = 'paused';
      
      this.logSessionEvent('session_paused', `Trading session paused: ${reason}`, { reason });
      
      this.emit('session-paused', { state: this.currentState, reason });
      this.logger.info('Trading session paused successfully');
      
    } catch (error) {
      this.logger.error('Error pausing trading session', error);
      throw error;
    }
  }

  /**
   * Resume the trading session
   */
  public async resume(reason: string = 'Manual resume'): Promise<void> {
    if (!this.isActive || !this.isPaused) {
      throw new TradingError('Cannot resume session in current state', 'INVALID_SESSION_STATE');
    }
    
    try {
      this.logger.info('Resuming trading session', { reason });
      
      this.currentState.status = 'resuming';
      this.isPaused = false;
      
      // Resume all operations
      // Update market phase in case it changed during pause
      this.updateMarketPhase();
      
      this.currentState.status = 'active';
      
      this.logSessionEvent('session_resumed', `Trading session resumed: ${reason}`, { reason });
      
      this.emit('session-resumed', { state: this.currentState, reason });
      this.logger.info('Trading session resumed successfully');
      
    } catch (error) {
      this.logger.error('Error resuming trading session', error);
      throw error;
    }
  }

  /**
   * Record a trade in the session
   */
  public recordTrade(trade: TradeEntry): void {
    try {
      this.trades.push(trade);
      
      // Update session statistics
      this.updateSessionStatistics(trade);
      
      // Check risk limits
      this.checkRiskLimits();
      
      this.logSessionEvent('trade_executed', `Trade executed: ${trade.action} ${trade.quantity} @ ${trade.price}`, {
        tradeId: trade.id,
        action: trade.action,
        quantity: trade.quantity,
        price: trade.price,
        pnl: trade.pnl
      });
      
      this.emit('trade-recorded', trade);
      
    } catch (error) {
      this.logger.error('Error recording trade', error);
      this.recordError('trade_recording');
    }
  }

  /**
   * Update position in the session
   */
  public updatePosition(position: Position): void {
    try {
      this.positions.set(position.id, position);
      
      // Update unrealized P&L statistics
      this.updateUnrealizedPnL();
      
      // Check risk limits
      this.checkRiskLimits();
      
      this.emit('position-updated', position);
      
    } catch (error) {
      this.logger.error('Error updating position', error);
      this.recordError('position_update');
    }
  }

  /**
   * Close a position
   */
  public closePosition(positionId: string, reason: string): void {
    try {
      const position = this.positions.get(positionId);
      if (position) {
        this.positions.delete(positionId);
        
        this.logSessionEvent('position_closed', `Position closed: ${positionId}`, {
          positionId,
          reason,
          pnl: position.pnl
        });
        
        this.emit('position-closed', { position, reason });
      }
      
    } catch (error) {
      this.logger.error('Error closing position', error);
      this.recordError('position_close');
    }
  }

  private initializeState(): SessionState {
    return {
      id: this.config.sessionId,
      status: 'scheduled',
      phase: 'pre_market',
      startTime: 0,
      plannedEndTime: 0,
      currentTime: Date.now(),
      timeRemaining: 0,
      marketHours: {
        isOpen: false,
        phase: 'pre_market',
        nextPhaseTime: 0,
        nextPhase: 'market_open',
        timeToNextPhase: 0,
        tradingAllowed: false
      },
      statistics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        totalVolume: 0,
        totalPnL: 0,
        realizedPnL: 0,
        unrealizedPnL: 0,
        maxDrawdown: 0,
        maxProfit: 0,
        winRate: 0,
        profitFactor: 0,
        sharpeRatio: 0,
        averageWin: 0,
        averageLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        tradingDuration: 0,
        activeTradingTime: 0
      },
      riskLimits: {
        maxDailyLoss: this.config.riskLimits.maxDailyLoss,
        maxDrawdown: this.config.riskLimits.maxDrawdown,
        maxPositions: this.config.riskLimits.maxPositions,
        maxOrderValue: 0,
        maxTradingHours: this.config.riskLimits.maxTradingHours,
        stopTradingAfterLosses: this.config.riskLimits.stopAfterConsecutiveLosses,
        currentDailyLoss: 0,
        currentDrawdown: 0,
        currentPositions: 0,
        consecutiveLosses: 0,
        limitsBreached: []
      }
    };
  }

  private validateSessionStart(): void {
    // Check if session is scheduled for current time
    if (!this.isSessionScheduled()) {
      throw new TradingError('Session is not scheduled for current time', 'SESSION_NOT_SCHEDULED');
    }
    
    // Check system health
    // In a real implementation, this would check various system components
    
    // Check risk limits
    if (this.currentBalance <= 0) {
      throw new TradingError('Insufficient balance to start session', 'INSUFFICIENT_BALANCE');
    }
  }

  private isSessionScheduled(): boolean {
    const now = new Date();
    const schedule = this.config.schedule;
    
    // Check if current day is enabled
    if (!schedule.daysOfWeek.includes(now.getDay())) {
      return false;
    }
    
    // Check time range
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    return currentTime >= schedule.startTime && currentTime <= schedule.endTime;
  }

  private calculatePlannedEndTime(): number {
    const schedule = this.config.schedule;
    const today = new Date();
    const [endHour, endMinute] = schedule.endTime.split(':').map(Number);
    
    const plannedEnd = new Date(today);
    plannedEnd.setHours(endHour, endMinute, 0, 0);
    
    return plannedEnd.getTime();
  }

  private startMonitoring(): void {
    // Update session state every second
    this.monitoringTimer = setInterval(() => {
      this.updateSessionState();
    }, 1000);
    
    // Check market phases
    this.phaseTimer = setInterval(() => {
      this.updateMarketPhase();
    }, 30000); // Check every 30 seconds
  }

  private stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
    }
    if (this.phaseTimer) {
      clearInterval(this.phaseTimer);
    }
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
    }
  }

  private updateSessionState(): void {
    if (!this.isActive) return;
    
    const now = Date.now();
    this.currentState.currentTime = now;
    this.currentState.timeRemaining = Math.max(0, this.currentState.plannedEndTime - now);
    
    // Update trading duration
    if (this.startTime > 0) {
      this.currentState.statistics.tradingDuration = now - this.startTime;
    }
    
    // Update risk limits current values
    this.updateCurrentRiskValues();
    
    // Check if session should auto-stop
    if (this.config.autoStop && this.currentState.timeRemaining === 0) {
      this.stop('Session time limit reached').catch(error => 
        this.logger.error('Error auto-stopping session', error)
      );
    }
    
    this.emit('session-updated', this.currentState);
  }

  private updateMarketPhase(): void {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;
    
    // Define phase transitions (these would be configurable)
    const phases = [
      { phase: 'pre_market' as SessionPhase, start: 0, end: 540 }, // 00:00 - 09:00
      { phase: 'market_open' as SessionPhase, start: 540, end: 570 }, // 09:00 - 09:30
      { phase: 'regular_session' as SessionPhase, start: 570, end: 720 }, // 09:30 - 12:00
      { phase: 'lunch_break' as SessionPhase, start: 720, end: 780 }, // 12:00 - 13:00
      { phase: 'afternoon_session' as SessionPhase, start: 780, end: 1050 }, // 13:00 - 17:30
      { phase: 'pre_close' as SessionPhase, start: 1050, end: 1080 }, // 17:30 - 18:00
      { phase: 'market_close' as SessionPhase, start: 1080, end: 1110 }, // 18:00 - 18:30
      { phase: 'after_hours' as SessionPhase, start: 1110, end: 1440 }, // 18:30 - 24:00
    ];
    
    const currentPhaseInfo = phases.find(p => currentTime >= p.start && currentTime < p.end);
    const newPhase = currentPhaseInfo?.phase || 'pre_market';
    
    if (newPhase !== this.currentState.phase) {
      const oldPhase = this.currentState.phase;
      this.currentState.phase = newPhase;
      this.currentState.marketHours.phase = newPhase;
      
      // Update trading allowed status
      this.updateTradingAllowed(newPhase);
      
      this.logSessionEvent('phase_changed', `Market phase changed from ${oldPhase} to ${newPhase}`, {
        oldPhase,
        newPhase,
        timestamp: Date.now()
      });
      
      this.emit('phase-changed', { oldPhase, newPhase, marketHours: this.currentState.marketHours });
    }
    
    // Calculate next phase
    const nextPhaseIndex = phases.findIndex(p => p.start > currentTime);
    if (nextPhaseIndex >= 0) {
      const nextPhase = phases[nextPhaseIndex];
      this.currentState.marketHours.nextPhase = nextPhase.phase;
      this.currentState.marketHours.nextPhaseTime = nextPhase.start * 60 * 1000; // Convert to milliseconds
      this.currentState.marketHours.timeToNextPhase = nextPhase.start - currentTime;
    }
  }

  private updateTradingAllowed(phase: SessionPhase): void {
    const phaseConfig = this.config.phases[phase];
    const tradingAllowed = phaseConfig?.tradingAllowed ?? this.getDefaultTradingAllowed(phase);
    
    this.currentState.marketHours.tradingAllowed = tradingAllowed;
    this.currentState.marketHours.isOpen = tradingAllowed;
  }

  private getDefaultTradingAllowed(phase: SessionPhase): boolean {
    switch (phase) {
      case 'regular_session':
      case 'afternoon_session':
        return true;
      case 'market_open':
      case 'pre_close':
        return true; // Usually allowed with restrictions
      default:
        return false;
    }
  }

  private updateSessionStatistics(trade: TradeEntry): void {
    const stats = this.currentState.statistics;
    
    stats.totalTrades++;
    stats.totalVolume += trade.quantity || 0;
    
    if (trade.pnl !== undefined) {
      stats.totalPnL += trade.pnl;
      stats.realizedPnL += trade.pnl;
      
      if (trade.pnl > 0) {
        stats.winningTrades++;
        stats.largestWin = Math.max(stats.largestWin, trade.pnl);
      } else if (trade.pnl < 0) {
        stats.losingTrades++;
        stats.largestLoss = Math.min(stats.largestLoss, trade.pnl);
        this.consecutiveLosses++;
      } else {
        this.consecutiveLosses = 0;
      }
      
      // Update balance and drawdown
      this.currentBalance += trade.pnl;
      this.sessionPeak = Math.max(this.sessionPeak, this.currentBalance);
      this.sessionLow = Math.min(this.sessionLow, this.currentBalance);
      
      const drawdown = (this.sessionPeak - this.currentBalance) / this.sessionPeak;
      stats.maxDrawdown = Math.max(stats.maxDrawdown, drawdown * 100);
      
      const profit = (this.currentBalance - this.initialBalance) / this.initialBalance;
      stats.maxProfit = Math.max(stats.maxProfit, profit * 100);
    }
    
    // Calculate derived statistics
    this.calculateDerivedStatistics();
  }

  private calculateDerivedStatistics(): void {
    const stats = this.currentState.statistics;
    
    // Win rate
    if (stats.totalTrades > 0) {
      stats.winRate = (stats.winningTrades / stats.totalTrades) * 100;
    }
    
    // Average win/loss
    if (stats.winningTrades > 0) {
      const totalWins = this.trades
        .filter(t => t.pnl && t.pnl > 0)
        .reduce((sum, t) => sum + (t.pnl || 0), 0);
      stats.averageWin = totalWins / stats.winningTrades;
    }
    
    if (stats.losingTrades > 0) {
      const totalLosses = Math.abs(this.trades
        .filter(t => t.pnl && t.pnl < 0)
        .reduce((sum, t) => sum + (t.pnl || 0), 0));
      stats.averageLoss = totalLosses / stats.losingTrades;
    }
    
    // Profit factor
    if (stats.averageLoss > 0) {
      stats.profitFactor = stats.averageWin / stats.averageLoss;
    }
  }

  private updateUnrealizedPnL(): void {
    let totalUnrealizedPnL = 0;
    for (const position of this.positions.values()) {
      totalUnrealizedPnL += position.unrealizedPnL;
    }
    
    this.currentState.statistics.unrealizedPnL = totalUnrealizedPnL;
    this.currentState.riskLimits.currentPositions = this.positions.size;
  }

  private updateCurrentRiskValues(): void {
    const limits = this.currentState.riskLimits;
    
    // Current daily loss
    limits.currentDailyLoss = Math.max(0, this.initialBalance - this.currentBalance);
    
    // Current drawdown
    if (this.sessionPeak > this.initialBalance) {
      limits.currentDrawdown = ((this.sessionPeak - this.currentBalance) / this.sessionPeak) * 100;
    }
    
    limits.consecutiveLosses = this.consecutiveLosses;
  }

  private checkRiskLimits(): void {
    const limits = this.currentState.riskLimits;
    const breached: string[] = [];
    
    // Check daily loss limit
    if (limits.currentDailyLoss >= limits.maxDailyLoss) {
      breached.push('max_daily_loss');
    }
    
    // Check drawdown limit
    if (limits.currentDrawdown >= limits.maxDrawdown) {
      breached.push('max_drawdown');
    }
    
    // Check position limit
    if (limits.currentPositions >= limits.maxPositions) {
      breached.push('max_positions');
    }
    
    // Check consecutive losses
    if (limits.consecutiveLosses >= limits.stopTradingAfterLosses) {
      breached.push('consecutive_losses');
    }
    
    // Update breached limits
    limits.limitsBreached = breached;
    
    // Trigger emergency stop if critical limits breached
    if (breached.length > 0) {
      for (const limit of breached) {
        this.logSessionEvent('risk_limit_breached', `Risk limit breached: ${limit}`, {
          limit,
          currentValue: this.getCurrentLimitValue(limit),
          maxValue: this.getMaxLimitValue(limit)
        });
      }
      
      this.emit('risk-limits-breached', { limits: breached, state: this.currentState });
      
      // Auto-stop on critical breaches
      if (breached.includes('max_daily_loss') || breached.includes('max_drawdown')) {
        this.emergencyStop(`Risk limit breached: ${breached.join(', ')}`);
      }
    }
  }

  private getCurrentLimitValue(limit: string): number {
    const limits = this.currentState.riskLimits;
    switch (limit) {
      case 'max_daily_loss': return limits.currentDailyLoss;
      case 'max_drawdown': return limits.currentDrawdown;
      case 'max_positions': return limits.currentPositions;
      case 'consecutive_losses': return limits.consecutiveLosses;
      default: return 0;
    }
  }

  private getMaxLimitValue(limit: string): number {
    const limits = this.currentState.riskLimits;
    switch (limit) {
      case 'max_daily_loss': return limits.maxDailyLoss;
      case 'max_drawdown': return limits.maxDrawdown;
      case 'max_positions': return limits.maxPositions;
      case 'consecutive_losses': return limits.stopTradingAfterLosses;
      default: return 0;
    }
  }

  private async closeAllPositions(reason: string): Promise<void> {
    const positionIds = Array.from(this.positions.keys());
    
    for (const positionId of positionIds) {
      try {
        this.closePosition(positionId, reason);
      } catch (error) {
        this.logger.error('Error closing position during session stop', { positionId, error });
      }
    }
  }

  private calculateFinalStatistics(): void {
    // This would calculate final performance metrics
    // Sharpe ratio, Calmar ratio, etc.
    
    if (this.endTime && this.startTime) {
      const durationHours = (this.endTime - this.startTime) / (1000 * 60 * 60);
      this.currentState.statistics.activeTradingTime = durationHours;
    }
  }

  private logSessionEvent(type: SessionEventType, message: string, data?: any): void {
    const event: SessionEvent = {
      id: this.generateEventId(),
      type,
      timestamp: Date.now(),
      message,
      data,
      severity: this.getEventSeverity(type)
    };
    
    this.sessionEvents.push(event);
    
    // Keep only recent events
    if (this.sessionEvents.length > 1000) {
      this.sessionEvents = this.sessionEvents.slice(-1000);
    }
    
    this.emit('session-event', event);
  }

  private getEventSeverity(type: SessionEventType): 'info' | 'warning' | 'error' | 'critical' {
    switch (type) {
      case 'emergency_stop':
      case 'system_error':
        return 'critical';
      case 'risk_limit_breached':
        return 'error';
      case 'session_paused':
      case 'phase_changed':
        return 'warning';
      default:
        return 'info';
    }
  }

  private recordError(context: string): void {
    this.errorCount++;
    
    if (this.config.emergencySettings.enableEmergencyStop && 
        this.errorCount >= this.config.emergencySettings.maxSystemErrors) {
      this.emergencyStop(`Too many system errors: ${this.errorCount}`);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Emergency stop the session
   */
  public emergencyStop(reason: string): void {
    if (this.emergencyStopTriggered) return;
    
    this.emergencyStopTriggered = true;
    this.logger.error('Emergency stop triggered', { reason });
    
    this.currentState.status = 'emergency';
    
    // Stop all operations immediately
    this.stopMonitoring();
    
    // Close all positions
    this.closeAllPositions(`EMERGENCY: ${reason}`).catch(error =>
      this.logger.error('Error closing positions during emergency stop', error)
    );
    
    this.logSessionEvent('emergency_stop', `Emergency stop: ${reason}`, { reason });
    
    this.emit('emergency-stop', { reason, state: this.currentState });
    
    // Force stop session
    this.stop(`EMERGENCY: ${reason}`).catch(error =>
      this.logger.error('Error stopping session during emergency', error)
    );
  }

  /**
   * Get current session state
   */
  public getState(): SessionState {
    return { ...this.currentState };
  }

  /**
   * Get session statistics
   */
  public getStatistics(): SessionStatistics {
    return { ...this.currentState.statistics };
  }

  /**
   * Get session events
   */
  public getEvents(limit: number = 100): SessionEvent[] {
    return this.sessionEvents.slice(-limit);
  }

  /**
   * Get active positions
   */
  public getPositions(): Position[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get session trades
   */
  public getTrades(): TradeEntry[] {
    return [...this.trades];
  }

  /**
   * Check if session is active
   */
  public isSessionActive(): boolean {
    return this.isActive && !this.isPaused;
  }

  /**
   * Check if trading is allowed
   */
  public isTradingAllowed(): boolean {
    return this.isActive && 
           !this.isPaused && 
           this.currentState.marketHours.tradingAllowed &&
           this.currentState.riskLimits.limitsBreached.length === 0;
  }

  /**
   * Get time remaining in session
   */
  public getTimeRemaining(): number {
    return this.currentState.timeRemaining;
  }
}