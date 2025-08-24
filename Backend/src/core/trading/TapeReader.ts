/**
 * Advanced Tape Reader - Core Algorithm for Order Flow Analysis
 * Implements sophisticated pattern detection and tape reading strategies
 */

import EventEmitter from 'eventemitter3';
import { Logger } from 'winston';
import { 
  MarketData, 
  TapeEntry, 
  PatternMatch,
  TradingConfig,
  OrderBook
} from '@/types/trading';

interface VolumeCluster {
  price: number;
  volume: number;
  startTime: number;
  endTime: number;
  buyVolume: number;
  sellVolume: number;
  absorption: boolean;
}

interface PriceLevel {
  price: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  touches: number;
  rejections: number;
  absorption: boolean;
  lastActivity: number;
}

export class TapeReader extends EventEmitter {
  private logger: Logger;
  private config: TradingConfig;
  
  // Tape data storage
  private recentTicks: MarketData[] = [];
  private tapeEntries: TapeEntry[] = [];
  private volumeClusters: VolumeCluster[] = [];
  private priceLevels: Map<number, PriceLevel> = new Map();
  
  // Analysis parameters
  private readonly LARGE_ORDER_THRESHOLD = 50; // contracts
  private readonly DOMINANT_ORDER_THRESHOLD = 100; // contracts
  private readonly ABSORPTION_RATIO = 0.7; // 70% absorption
  private readonly CLUSTER_DISTANCE = 5; // points
  private readonly MAX_ENTRIES = 1000;
  private readonly PRICE_PRECISION = 0.25; // tick size
  
  // Pattern detection state
  private currentTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  private aggressionLevel: number = 0;
  private liquidityLevel: number = 0;
  private lastSignal: number = 0;

  constructor(config: TradingConfig, logger: Logger) {
    super();
    this.config = config;
    this.logger = logger.child({ component: 'TapeReader' });
    
    this.logger.info('TapeReader initialized with parameters', {
      largeOrderThreshold: this.LARGE_ORDER_THRESHOLD,
      dominantOrderThreshold: this.DOMINANT_ORDER_THRESHOLD,
      absorptionRatio: this.ABSORPTION_RATIO
    });
  }

  public async initialize(): Promise<void> {
    this.logger.info('Initializing TapeReader');
    
    // Clear existing data
    this.recentTicks = [];
    this.tapeEntries = [];
    this.volumeClusters = [];
    this.priceLevels.clear();
    
    // Reset state
    this.currentTrend = 'neutral';
    this.aggressionLevel = 0;
    this.liquidityLevel = 0;
    this.lastSignal = Date.now();
  }

  /**
   * Process a new market tick
   */
  public async processTick(data: MarketData): Promise<void> {
    try {
      // Store recent tick
      this.recentTicks.push(data);
      if (this.recentTicks.length > 100) {
        this.recentTicks = this.recentTicks.slice(-100);
      }
      
      // Update price levels
      this.updatePriceLevel(data);
      
      // Detect volume clusters
      this.detectVolumeClusters(data);
      
      // Analyze market structure
      this.analyzeMarketStructure();
      
      // Check for patterns
      await this.detectPatterns();
      
    } catch (error) {
      this.logger.error('Error processing tick', error);
    }
  }

  /**
   * Process individual tape entry
   */
  public async processTapeEntry(entry: TapeEntry): Promise<void> {
    try {
      // Add to tape entries
      this.tapeEntries.push(entry);
      if (this.tapeEntries.length > this.MAX_ENTRIES) {
        this.tapeEntries = this.tapeEntries.slice(-this.MAX_ENTRIES);
      }
      
      // Classify the order
      this.classifyOrder(entry);
      
      // Update aggression metrics
      this.updateAggressionMetrics(entry);
      
      // Check for absorption patterns
      this.checkAbsorptionPattern(entry);
      
      // Detect false orders
      this.detectFalseOrders(entry);
      
    } catch (error) {
      this.logger.error('Error processing tape entry', error);
    }
  }

  private updatePriceLevel(data: MarketData): void {
    const roundedPrice = Math.round(data.price / this.PRICE_PRECISION) * this.PRICE_PRECISION;
    
    let level = this.priceLevels.get(roundedPrice);
    if (!level) {
      level = {
        price: roundedPrice,
        totalVolume: 0,
        buyVolume: 0,
        sellVolume: 0,
        touches: 0,
        rejections: 0,
        absorption: false,
        lastActivity: Date.now()
      };
      this.priceLevels.set(roundedPrice, level);
    }
    
    // Update volume based on price change
    const volumeToAdd = data.volume / 10; // Estimate volume at this level
    level.totalVolume += volumeToAdd;
    level.touches++;
    level.lastActivity = Date.now();
    
    // Estimate buy/sell volume based on price movement
    if (data.priceChange > 0) {
      level.buyVolume += volumeToAdd * 0.7;
      level.sellVolume += volumeToAdd * 0.3;
    } else if (data.priceChange < 0) {
      level.sellVolume += volumeToAdd * 0.7;
      level.buyVolume += volumeToAdd * 0.3;
    } else {
      level.buyVolume += volumeToAdd * 0.5;
      level.sellVolume += volumeToAdd * 0.5;
    }
    
    // Clean old levels
    this.cleanOldPriceLevels();
  }

  private cleanOldPriceLevels(): void {
    const cutoffTime = Date.now() - (60000 * 30); // 30 minutes
    
    for (const [price, level] of this.priceLevels.entries()) {
      if (level.lastActivity < cutoffTime) {
        this.priceLevels.delete(price);
      }
    }
  }

  private detectVolumeClusters(data: MarketData): void {
    const currentPrice = data.price;
    
    // Find existing cluster within range
    let cluster = this.volumeClusters.find(c => 
      Math.abs(c.price - currentPrice) <= this.CLUSTER_DISTANCE &&
      Date.now() - c.endTime < 60000 // Within last minute
    );
    
    if (!cluster) {
      // Create new cluster
      cluster = {
        price: currentPrice,
        volume: 0,
        startTime: Date.now(),
        endTime: Date.now(),
        buyVolume: 0,
        sellVolume: 0,
        absorption: false
      };
      this.volumeClusters.push(cluster);
      
      // Keep only recent clusters
      if (this.volumeClusters.length > 50) {
        this.volumeClusters = this.volumeClusters.slice(-50);
      }
    }
    
    // Update cluster
    cluster.volume += data.volume;
    cluster.endTime = Date.now();
    
    // Update buy/sell volume based on price movement
    if (data.priceChange > 0) {
      cluster.buyVolume += data.volume * 0.6;
      cluster.sellVolume += data.volume * 0.4;
    } else if (data.priceChange < 0) {
      cluster.sellVolume += data.volume * 0.6;
      cluster.buyVolume += data.volume * 0.4;
    } else {
      cluster.buyVolume += data.volume * 0.5;
      cluster.sellVolume += data.volume * 0.5;
    }
    
    // Check for absorption
    this.checkClusterAbsorption(cluster);
  }

  private checkClusterAbsorption(cluster: VolumeCluster): void {
    const ratio = cluster.buyVolume > cluster.sellVolume ? 
      cluster.buyVolume / (cluster.buyVolume + cluster.sellVolume) :
      cluster.sellVolume / (cluster.buyVolume + cluster.sellVolume);
    
    if (ratio >= this.ABSORPTION_RATIO && cluster.volume > 200) {
      cluster.absorption = true;
      
      this.logger.debug('Volume absorption detected', {
        price: cluster.price,
        volume: cluster.volume,
        ratio: ratio.toFixed(2),
        dominant: cluster.buyVolume > cluster.sellVolume ? 'buy' : 'sell'
      });
      
      this.emit('absorption-detected', {
        cluster,
        type: cluster.buyVolume > cluster.sellVolume ? 'buy' : 'sell'
      });
    }
  }

  private classifyOrder(entry: TapeEntry): void {
    // Classify as large order
    if (entry.volume >= this.LARGE_ORDER_THRESHOLD) {
      entry.isLarge = true;
    }
    
    // Classify as dominant order
    if (entry.volume >= this.DOMINANT_ORDER_THRESHOLD) {
      entry.isDominant = true;
    }
    
    // Determine aggressor side
    const recentEntries = this.tapeEntries.slice(-5);
    if (recentEntries.length > 0) {
      const avgPrice = recentEntries.reduce((sum, e) => sum + e.price, 0) / recentEntries.length;
      
      if (entry.price > avgPrice) {
        entry.aggressor = 'buyer';
      } else if (entry.price < avgPrice) {
        entry.aggressor = 'seller';
      }
    }
  }

  private updateAggressionMetrics(entry: TapeEntry): void {
    const recentEntries = this.tapeEntries.slice(-20);
    
    // Calculate buy/sell aggression
    const buyAggression = recentEntries
      .filter(e => e.aggressor === 'buyer')
      .reduce((sum, e) => sum + e.volume, 0);
    
    const sellAggression = recentEntries
      .filter(e => e.aggressor === 'seller')
      .reduce((sum, e) => sum + e.volume, 0);
    
    const totalVolume = buyAggression + sellAggression;
    
    if (totalVolume > 0) {
      this.aggressionLevel = (buyAggression - sellAggression) / totalVolume;
    }
    
    // Update liquidity level
    const largeOrders = recentEntries.filter(e => e.isLarge).length;
    this.liquidityLevel = largeOrders / recentEntries.length;
  }

  private checkAbsorptionPattern(entry: TapeEntry): void {
    const priceLevel = this.priceLevels.get(
      Math.round(entry.price / this.PRICE_PRECISION) * this.PRICE_PRECISION
    );
    
    if (priceLevel && priceLevel.totalVolume > 500) {
      const ratio = Math.max(priceLevel.buyVolume, priceLevel.sellVolume) / 
                   priceLevel.totalVolume;
      
      if (ratio >= this.ABSORPTION_RATIO) {
        entry.absorption = true;
        priceLevel.absorption = true;
        
        this.emit('price-absorption', {
          price: entry.price,
          volume: priceLevel.totalVolume,
          dominant: priceLevel.buyVolume > priceLevel.sellVolume ? 'buy' : 'sell'
        });
      }
    }
  }

  private detectFalseOrders(entry: TapeEntry): void {
    // Look for rapid order cancellations or small fills of large orders
    const samePrice = this.tapeEntries
      .slice(-10)
      .filter(e => Math.abs(e.price - entry.price) < this.PRICE_PRECISION);
    
    if (samePrice.length > 3) {
      const avgVolume = samePrice.reduce((sum, e) => sum + e.volume, 0) / samePrice.length;
      const volumeStd = Math.sqrt(
        samePrice.reduce((sum, e) => sum + Math.pow(e.volume - avgVolume, 2), 0) / samePrice.length
      );
      
      // High variance in volume might indicate false orders
      if (volumeStd > avgVolume * 0.5) {
        this.emit('false-orders-detected', {
          price: entry.price,
          entries: samePrice.length,
          variance: volumeStd
        });
      }
    }
  }

  private analyzeMarketStructure(): void {
    if (this.recentTicks.length < 10) return;
    
    const recent = this.recentTicks.slice(-10);
    const priceChanges = recent.map(tick => tick.priceChange);
    
    // Determine trend
    const positiveMoves = priceChanges.filter(change => change > 0).length;
    const negativeMoves = priceChanges.filter(change => change < 0).length;
    
    if (positiveMoves > negativeMoves * 1.5) {
      this.currentTrend = 'bullish';
    } else if (negativeMoves > positiveMoves * 1.5) {
      this.currentTrend = 'bearish';
    } else {
      this.currentTrend = 'neutral';
    }
  }

  private async detectPatterns(): Promise<void> {
    // Pattern 1: Absorption at Support/Resistance
    await this.detectAbsorptionPattern();
    
    // Pattern 2: Hidden Liquidity
    await this.detectHiddenLiquidity();
    
    // Pattern 3: Aggressive Order Flow
    await this.detectAggressiveFlow();
    
    // Pattern 4: Volume Cluster Breakout
    await this.detectVolumeBreakout();
  }

  private async detectAbsorptionPattern(): Promise<void> {
    const significantLevels = Array.from(this.priceLevels.values())
      .filter(level => level.absorption && level.totalVolume > 300)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 3);
    
    for (const level of significantLevels) {
      const confidence = Math.min(90, (level.totalVolume / 1000) * 100);
      
      const pattern: PatternMatch = {
        id: `absorption_${level.price}_${Date.now()}`,
        name: 'Absorção de Liquidez',
        confidence,
        probability: confidence / 100,
        historicalSuccess: 0.75, // Historical success rate
        timeframe: 300000, // 5 minutes
        parameters: {
          price: level.price,
          volume: level.totalVolume,
          ratio: Math.max(level.buyVolume, level.sellVolume) / level.totalVolume,
          direction: level.buyVolume > level.sellVolume ? 'bullish' : 'bearish'
        }
      };
      
      this.emit('pattern-detected', pattern);
    }
  }

  private async detectHiddenLiquidity(): Promise<void> {
    const recentClusters = this.volumeClusters
      .filter(cluster => Date.now() - cluster.endTime < 300000) // Last 5 minutes
      .sort((a, b) => b.volume - a.volume);
    
    if (recentClusters.length > 0) {
      const largestCluster = recentClusters[0];
      
      if (largestCluster.volume > 500 && !largestCluster.absorption) {
        const confidence = Math.min(85, (largestCluster.volume / 1000) * 100);
        
        const pattern: PatternMatch = {
          id: `hidden_liquidity_${largestCluster.price}_${Date.now()}`,
          name: 'Liquidez Oculta Detectada',
          confidence,
          probability: confidence / 100,
          historicalSuccess: 0.68,
          timeframe: 600000, // 10 minutes
          parameters: {
            price: largestCluster.price,
            volume: largestCluster.volume,
            duration: largestCluster.endTime - largestCluster.startTime,
            buyPressure: largestCluster.buyVolume / largestCluster.volume
          }
        };
        
        this.emit('pattern-detected', pattern);
      }
    }
  }

  private async detectAggressiveFlow(): Promise<void> {
    if (Math.abs(this.aggressionLevel) > 0.6) {
      const confidence = Math.min(95, Math.abs(this.aggressionLevel) * 100);
      
      const pattern: PatternMatch = {
        id: `aggressive_flow_${Date.now()}`,
        name: 'Fluxo Agressivo Detectado',
        confidence,
        probability: confidence / 100,
        historicalSuccess: 0.72,
        timeframe: 180000, // 3 minutes
        parameters: {
          aggressionLevel: this.aggressionLevel,
          direction: this.aggressionLevel > 0 ? 'bullish' : 'bearish',
          liquidityLevel: this.liquidityLevel,
          trend: this.currentTrend
        }
      };
      
      this.emit('pattern-detected', pattern);
    }
  }

  private async detectVolumeBreakout(): Promise<void> {
    const recentTicks = this.recentTicks.slice(-5);
    if (recentTicks.length < 5) return;
    
    const avgVolume = this.recentTicks.slice(-20, -5)
      .reduce((sum, tick) => sum + tick.volume, 0) / 15;
    
    const currentVolume = recentTicks.reduce((sum, tick) => sum + tick.volume, 0) / 5;
    
    if (currentVolume > avgVolume * 2.5) { // 250% increase
      const priceMovement = recentTicks[recentTicks.length - 1].price - recentTicks[0].price;
      const confidence = Math.min(90, (currentVolume / avgVolume) * 30);
      
      const pattern: PatternMatch = {
        id: `volume_breakout_${Date.now()}`,
        name: 'Breakout de Volume',
        confidence,
        probability: confidence / 100,
        historicalSuccess: 0.78,
        timeframe: 240000, // 4 minutes
        parameters: {
          volumeIncrease: currentVolume / avgVolume,
          priceMovement,
          direction: priceMovement > 0 ? 'bullish' : 'bearish',
          avgVolume,
          currentVolume
        }
      };
      
      this.emit('pattern-detected', pattern);
    }
  }

  // Public getters for current state
  public getCurrentTrend(): 'bullish' | 'bearish' | 'neutral' {
    return this.currentTrend;
  }

  public getAggressionLevel(): number {
    return this.aggressionLevel;
  }

  public getLiquidityLevel(): number {
    return this.liquidityLevel;
  }

  public getSignificantPriceLevels(): PriceLevel[] {
    return Array.from(this.priceLevels.values())
      .filter(level => level.totalVolume > 200)
      .sort((a, b) => b.totalVolume - a.totalVolume)
      .slice(0, 10);
  }

  public getVolumeProfile(): VolumeCluster[] {
    return this.volumeClusters
      .filter(cluster => Date.now() - cluster.endTime < 3600000) // Last hour
      .sort((a, b) => b.volume - a.volume);
  }

  public getRecentTapeEntries(count: number = 50): TapeEntry[] {
    return this.tapeEntries.slice(-count);
  }
}