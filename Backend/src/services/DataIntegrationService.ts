import WebSocket from 'ws';
import { MongoClient, Collection, Db } from 'mongodb';
import axios from 'axios';

// Interfaces for Real-time Data
interface TradingViewTickData {
  symbol: string;
  timestamp: number;
  price: number;
  volume: number;
  side: 'BUY' | 'SELL';
  aggressor: boolean;
  sequence: number;
}

interface InvestingNewsData {
  timestamp: number;
  title: string;
  content: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  currency: string;
  category: string;
}

interface Level2OrderBook {
  symbol: string;
  timestamp: number;
  bids: Array<{
    price: number;
    volume: number;
    orders: number;
    mpid?: string;
  }>;
  asks: Array<{
    price: number;
    volume: number;
    orders: number;
    mpid?: string;
  }>;
  sequence: number;
}

interface RealtimeVWAP {
  symbol: string;
  timestamp: number;
  vwap: number;
  volume: number;
  deviation: number;
  bands: {
    upper1: number;
    upper2: number;
    lower1: number;
    lower2: number;
  };
}

class DataIntegrationService {
  private mongoClient: MongoClient | null = null;
  private db: Db | null = null;
  private tickCollection: Collection | null = null;
  private level2Collection: Collection | null = null;
  private newsCollection: Collection | null = null;
  
  private tradingViewWs: WebSocket | null = null;
  private investingWs: WebSocket | null = null;
  
  private vwapCalculator: Map<string, {
    priceSum: number;
    volumeSum: number;
    startTimestamp: number;
  }> = new Map();

  private isConnected = false;
  private ticksReceived = 0;
  private ticksStored = 0;
  private lastPing = 0;

  constructor(
    private mongoUri: string = 'mongodb://localhost:27017',
    private dbName: string = 'tradingdata'
  ) {}

  /**
   * Initialize MongoDB Connection
   */
  async initializeDatabase(): Promise<boolean> {
    try {
      console.log('🔗 Connecting to MongoDB...');
      this.mongoClient = new MongoClient(this.mongoUri, {
        maxPoolSize: 100,
        minPoolSize: 5,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000,
      });

      await this.mongoClient.connect();
      this.db = this.mongoClient.db(this.dbName);
      
      // Create collections with indexes for optimal performance
      this.tickCollection = this.db.collection('ticks');
      this.level2Collection = this.db.collection('level2');
      this.newsCollection = this.db.collection('news');

      // Create indexes for fast queries
      await this.createIndexes();
      
      console.log('✅ MongoDB connected successfully');
      return true;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      return false;
    }
  }

  /**
   * Create optimized indexes for tick data queries
   */
  private async createIndexes(): Promise<void> {
    if (!this.tickCollection || !this.level2Collection || !this.newsCollection) return;

    try {
      // Tick data indexes
      await this.tickCollection.createIndex({ symbol: 1, timestamp: 1 });
      await this.tickCollection.createIndex({ timestamp: 1 });
      await this.tickCollection.createIndex({ symbol: 1, timestamp: -1 });
      
      // Level 2 data indexes
      await this.level2Collection.createIndex({ symbol: 1, timestamp: 1 });
      await this.level2Collection.createIndex({ timestamp: -1 });
      
      // News data indexes
      await this.newsCollection.createIndex({ timestamp: 1, impact: 1 });
      await this.newsCollection.createIndex({ currency: 1, timestamp: -1 });

      console.log('📊 Database indexes created successfully');
    } catch (error) {
      console.error('❌ Failed to create indexes:', error);
    }
  }

  /**
   * Connect to TradingView WebSocket for real-time tick data
   */
  async connectTradingView(): Promise<boolean> {
    try {
      console.log('📡 Connecting to TradingView WebSocket...');
      
      // In production, use actual TradingView WebSocket endpoint
      // For demo, we'll simulate the connection
      const TRADINGVIEW_WS = 'wss://data.tradingview.com/socket.io/websocket';
      
      this.tradingViewWs = new WebSocket(TRADINGVIEW_WS);
      
      this.tradingViewWs.onopen = () => {
        console.log('✅ TradingView WebSocket connected');
        this.isConnected = true;
        
        // Subscribe to mini dollar futures
        this.subscribeToSymbol('WDO');
      };
      
      this.tradingViewWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          this.processTradingViewMessage(data);
        } catch (error) {
          console.error('❌ Error processing TradingView message:', error);
        }
      };
      
      this.tradingViewWs.onerror = (error) => {
        console.error('❌ TradingView WebSocket error:', error);
      };
      
      this.tradingViewWs.onclose = () => {
        console.log('⚠️ TradingView WebSocket disconnected. Attempting reconnection...');
        this.isConnected = false;
        setTimeout(() => this.connectTradingView(), 5000);
      };
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to TradingView:', error);
      return false;
    }
  }

  /**
   * Connect to Investing.com WebSocket for news and economic data
   */
  async connectInvesting(): Promise<boolean> {
    try {
      console.log('📰 Connecting to Investing.com WebSocket...');
      
      // In production, use actual Investing.com WebSocket
      const INVESTING_WS = 'wss://stream.investing.com/';
      
      this.investingWs = new WebSocket(INVESTING_WS);
      
      this.investingWs.onopen = () => {
        console.log('✅ Investing.com WebSocket connected');
        
        // Subscribe to BRL/USD news and economic indicators
        this.subscribeToNews(['BRL', 'USD']);
      };
      
      this.investingWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString());
          this.processInvestingMessage(data);
        } catch (error) {
          console.error('❌ Error processing Investing message:', error);
        }
      };
      
      this.investingWs.onerror = (error) => {
        console.error('❌ Investing.com WebSocket error:', error);
      };
      
      this.investingWs.onclose = () => {
        console.log('⚠️ Investing.com WebSocket disconnected. Attempting reconnection...');
        setTimeout(() => this.connectInvesting(), 5000);
      };
      
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Investing.com:', error);
      return false;
    }
  }

  /**
   * Subscribe to symbol tick data
   */
  private subscribeToSymbol(symbol: string): void {
    if (!this.tradingViewWs || this.tradingViewWs.readyState !== WebSocket.OPEN) return;
    
    const subscribeMessage = JSON.stringify({
      m: 'quote_add_symbols',
      p: [symbol]
    });
    
    this.tradingViewWs.send(subscribeMessage);
    console.log(`📊 Subscribed to ${symbol} tick data`);
  }

  /**
   * Subscribe to news for specific currencies
   */
  private subscribeToNews(currencies: string[]): void {
    if (!this.investingWs || this.investingWs.readyState !== WebSocket.OPEN) return;
    
    const subscribeMessage = JSON.stringify({
      action: 'subscribe',
      data: {
        type: 'news',
        currencies: currencies
      }
    });
    
    this.investingWs.send(subscribeMessage);
    console.log(`📰 Subscribed to news for ${currencies.join(', ')}`);
  }

  /**
   * Process incoming TradingView tick data
   */
  private async processTradingViewMessage(data: any): Promise<void> {
    try {
      if (data.m === 'qsd' && data.p) { // Quote symbol data
        const tickData: TradingViewTickData = {
          symbol: data.p[0]?.n || 'WDO',
          timestamp: Date.now(),
          price: parseFloat(data.p[0]?.v?.lp) || 0, // Last price
          volume: parseInt(data.p[0]?.v?.volume) || 0,
          side: data.p[0]?.v?.ch > 0 ? 'BUY' : 'SELL', // Change direction
          aggressor: true,
          sequence: this.ticksReceived++
        };

        // Store in MongoDB
        await this.storeTick(tickData);
        
        // Calculate real-time VWAP
        await this.updateVWAP(tickData);
        
        // Process Level 2 data if available
        if (data.p[0]?.v?.bid && data.p[0]?.v?.ask) {
          await this.processLevel2Data(data.p[0]);
        }
        
        // Emit to connected clients (would use Socket.io in production)
        this.emitTickData(tickData);
      }
    } catch (error) {
      console.error('❌ Error processing tick data:', error);
    }
  }

  /**
   * Process incoming Investing.com news data
   */
  private async processInvestingMessage(data: any): Promise<void> {
    try {
      if (data.type === 'news') {
        const newsData: InvestingNewsData = {
          timestamp: data.timestamp || Date.now(),
          title: data.title,
          content: data.content,
          impact: data.impact || 'LOW',
          currency: data.currency,
          category: data.category
        };

        await this.storeNews(newsData);
        this.emitNewsData(newsData);
      }
    } catch (error) {
      console.error('❌ Error processing news data:', error);
    }
  }

  /**
   * Store tick data in MongoDB
   */
  private async storeTick(tickData: TradingViewTickData): Promise<void> {
    if (!this.tickCollection) return;
    
    try {
      await this.tickCollection.insertOne({
        ...tickData,
        storedAt: new Date()
      });
      this.ticksStored++;
    } catch (error) {
      console.error('❌ Error storing tick data:', error);
    }
  }

  /**
   * Process and store Level 2 order book data
   */
  private async processLevel2Data(data: any): Promise<void> {
    if (!this.level2Collection) return;
    
    try {
      const level2Data: Level2OrderBook = {
        symbol: 'WDO',
        timestamp: Date.now(),
        bids: this.parseOrderBookSide(data.v.bid_sizes, data.v.bid_prices),
        asks: this.parseOrderBookSide(data.v.ask_sizes, data.v.ask_prices),
        sequence: this.ticksReceived
      };

      await this.level2Collection.insertOne(level2Data);
    } catch (error) {
      console.error('❌ Error processing Level 2 data:', error);
    }
  }

  /**
   * Parse order book side data
   */
  private parseOrderBookSide(sizes: any[], prices: any[]): Array<{price: number, volume: number, orders: number}> {
    if (!sizes || !prices) return [];
    
    return prices.map((price: number, index: number) => ({
      price: parseFloat(price.toString()),
      volume: parseInt(sizes[index]?.toString()) || 0,
      orders: Math.floor(Math.random() * 20) + 1 // Simulated order count
    })).slice(0, 10); // Keep top 10 levels
  }

  /**
   * Update real-time VWAP calculation
   */
  private async updateVWAP(tickData: TradingViewTickData): Promise<void> {
    const symbol = tickData.symbol;
    const currentTime = tickData.timestamp;
    const sessionStart = new Date(currentTime);
    sessionStart.setHours(9, 0, 0, 0); // Market open at 9 AM
    
    if (!this.vwapCalculator.has(symbol)) {
      this.vwapCalculator.set(symbol, {
        priceSum: 0,
        volumeSum: 0,
        startTimestamp: sessionStart.getTime()
      });
    }
    
    const vwapData = this.vwapCalculator.get(symbol)!;
    
    // Reset at market open
    if (currentTime - vwapData.startTimestamp > 24 * 60 * 60 * 1000) {
      vwapData.priceSum = 0;
      vwapData.volumeSum = 0;
      vwapData.startTimestamp = sessionStart.getTime();
    }
    
    // Update VWAP calculation
    vwapData.priceSum += tickData.price * tickData.volume;
    vwapData.volumeSum += tickData.volume;
    
    const vwap = vwapData.volumeSum > 0 ? vwapData.priceSum / vwapData.volumeSum : tickData.price;
    const deviation = Math.abs(tickData.price - vwap);
    const standardDev = deviation * 0.5; // Simplified standard deviation
    
    const realtimeVWAP: RealtimeVWAP = {
      symbol,
      timestamp: currentTime,
      vwap,
      volume: vwapData.volumeSum,
      deviation: (deviation / vwap) * 100,
      bands: {
        upper1: vwap + standardDev,
        upper2: vwap + (standardDev * 2),
        lower1: vwap - standardDev,
        lower2: vwap - (standardDev * 2)
      }
    };
    
    // Emit VWAP data
    this.emitVWAPData(realtimeVWAP);
  }

  /**
   * Store news data in MongoDB
   */
  private async storeNews(newsData: InvestingNewsData): Promise<void> {
    if (!this.newsCollection) return;
    
    try {
      await this.newsCollection.insertOne({
        ...newsData,
        storedAt: new Date()
      });
    } catch (error) {
      console.error('❌ Error storing news data:', error);
    }
  }

  /**
   * Get historical tick data for backtesting
   */
  async getHistoricalTicks(
    symbol: string,
    startTime: number,
    endTime: number,
    limit: number = 10000
  ): Promise<TradingViewTickData[]> {
    if (!this.tickCollection) return [];
    
    try {
      const cursor = this.tickCollection
        .find({
          symbol,
          timestamp: { $gte: startTime, $lte: endTime }
        })
        .sort({ timestamp: 1 })
        .limit(limit);
      
      const ticks = await cursor.toArray();
      return ticks.map(tick => ({
        symbol: tick.symbol,
        timestamp: tick.timestamp,
        price: tick.price,
        volume: tick.volume,
        side: tick.side,
        aggressor: tick.aggressor,
        sequence: tick.sequence
      }));
    } catch (error) {
      console.error('❌ Error fetching historical ticks:', error);
      return [];
    }
  }

  /**
   * Get order flow analysis for specific time range
   */
  async getOrderFlowAnalysis(
    symbol: string,
    timeRange: number = 60000 // 1 minute
  ): Promise<{
    buyVolume: number;
    sellVolume: number;
    netFlow: number;
    aggression: number;
    tickCount: number;
  }> {
    if (!this.tickCollection) {
      return { buyVolume: 0, sellVolume: 0, netFlow: 0, aggression: 0, tickCount: 0 };
    }
    
    try {
      const endTime = Date.now();
      const startTime = endTime - timeRange;
      
      const pipeline = [
        {
          $match: {
            symbol,
            timestamp: { $gte: startTime, $lte: endTime }
          }
        },
        {
          $group: {
            _id: null,
            buyVolume: {
              $sum: {
                $cond: [{ $eq: ['$side', 'BUY'] }, '$volume', 0]
              }
            },
            sellVolume: {
              $sum: {
                $cond: [{ $eq: ['$side', 'SELL'] }, '$volume', 0]
              }
            },
            aggressorCount: {
              $sum: {
                $cond: ['$aggressor', 1, 0]
              }
            },
            totalTicks: { $sum: 1 }
          }
        }
      ];
      
      const result = await this.tickCollection.aggregate(pipeline).toArray();
      
      if (result.length === 0) {
        return { buyVolume: 0, sellVolume: 0, netFlow: 0, aggression: 0, tickCount: 0 };
      }
      
      const data = result[0];
      const netFlow = data.buyVolume - data.sellVolume;
      const aggression = data.totalTicks > 0 ? (data.aggressorCount / data.totalTicks) * 100 : 0;
      
      return {
        buyVolume: data.buyVolume,
        sellVolume: data.sellVolume,
        netFlow,
        aggression,
        tickCount: data.totalTicks
      };
    } catch (error) {
      console.error('❌ Error calculating order flow analysis:', error);
      return { buyVolume: 0, sellVolume: 0, netFlow: 0, aggression: 0, tickCount: 0 };
    }
  }

  /**
   * Get market impact news for trading context
   */
  async getRecentNews(
    currencies: string[] = ['BRL', 'USD'],
    timeRange: number = 3600000, // 1 hour
    impact: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM'
  ): Promise<InvestingNewsData[]> {
    if (!this.newsCollection) return [];
    
    try {
      const endTime = Date.now();
      const startTime = endTime - timeRange;
      
      const cursor = this.newsCollection
        .find({
          currency: { $in: currencies },
          timestamp: { $gte: startTime, $lte: endTime },
          impact: { $gte: impact }
        })
        .sort({ timestamp: -1 })
        .limit(50);
      
      const news = await cursor.toArray();
      return news.map(item => ({
        timestamp: item.timestamp,
        title: item.title,
        content: item.content,
        impact: item.impact,
        currency: item.currency,
        category: item.category
      }));
    } catch (error) {
      console.error('❌ Error fetching news data:', error);
      return [];
    }
  }

  /**
   * Emit tick data to connected clients (placeholder for Socket.io integration)
   */
  private emitTickData(tickData: TradingViewTickData): void {
    // In production, this would emit to Socket.io clients
    // io.emit('tick_data', tickData);
    console.log(`📊 Tick: ${tickData.symbol} ${tickData.price} ${tickData.volume}`);
  }

  /**
   * Emit VWAP data to connected clients
   */
  private emitVWAPData(vwapData: RealtimeVWAP): void {
    // In production, this would emit to Socket.io clients
    // io.emit('vwap_data', vwapData);
  }

  /**
   * Emit news data to connected clients
   */
  private emitNewsData(newsData: InvestingNewsData): void {
    // In production, this would emit to Socket.io clients
    // io.emit('news_data', newsData);
  }

  /**
   * Get connection status and performance metrics
   */
  getStatus(): {
    connected: boolean;
    ticksReceived: number;
    ticksStored: number;
    storageRate: number;
    latency: number;
    dbConnected: boolean;
  } {
    const now = Date.now();
    const timeDiff = now - this.lastPing;
    this.lastPing = now;
    
    return {
      connected: this.isConnected,
      ticksReceived: this.ticksReceived,
      ticksStored: this.ticksStored,
      storageRate: timeDiff > 0 ? this.ticksStored / (timeDiff / 1000) : 0,
      latency: Math.random() * 20 + 5, // Simulated latency
      dbConnected: this.mongoClient !== null
    };
  }

  /**
   * Gracefully shutdown all connections
   */
  async shutdown(): Promise<void> {
    console.log('🔄 Shutting down data integration service...');
    
    if (this.tradingViewWs) {
      this.tradingViewWs.close();
    }
    
    if (this.investingWs) {
      this.investingWs.close();
    }
    
    if (this.mongoClient) {
      await this.mongoClient.close();
    }
    
    console.log('✅ Data integration service shutdown complete');
  }
}

export { DataIntegrationService, TradingViewTickData, InvestingNewsData, Level2OrderBook, RealtimeVWAP };