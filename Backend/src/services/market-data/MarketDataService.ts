import { MarketData, IMarketData } from '../models';
import axios from 'axios';
import { EventEmitter } from 'events';

interface MarketDataFeed {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: Date;
}

interface TechnicalIndicators {
  sma20: number;
  ema9: number;
  rsi: number;
  macd: number;
  vwap: number;
}

export class MarketDataService extends EventEmitter {
  private static instance: MarketDataService;
  private wsConnections: Map<string, WebSocket> = new Map();
  private dataCache: Map<string, IMarketData> = new Map();

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  public async processMarketData(feed: MarketDataFeed): Promise<IMarketData> {
    try {
      let marketData = await MarketData.findOne({ symbol: feed.symbol })
        .sort({ timestamp: -1 });

      if (!marketData) {
        marketData = new MarketData({
          symbol: feed.symbol,
          exchange: 'B3',
          price: feed.price,
          bid: feed.bid,
          ask: feed.ask,
          open: feed.price,
          high: feed.price,
          low: feed.price,
          volume: feed.volume,
          spread: feed.ask - feed.bid,
          spreadPercentage: ((feed.ask - feed.bid) / feed.price) * 100,
          marketTime: feed.timestamp
        });
      } else {
        // Update existing data
        marketData.price = feed.price;
        marketData.bid = feed.bid;
        marketData.ask = feed.ask;
        marketData.volume = feed.volume;
        marketData.high = Math.max(marketData.high, feed.price);
        marketData.low = Math.min(marketData.low, feed.price);
        marketData.spread = feed.ask - feed.bid;
        marketData.spreadPercentage = ((feed.ask - feed.bid) / feed.price) * 100;
      }

      // Add tick
      marketData.addTick({
        timestamp: feed.timestamp,
        price: feed.price,
        size: Math.floor(Math.random() * 100) + 1,
        side: feed.price > marketData.price ? 'BUY' : 'SELL',
        aggressor: Math.random() > 0.5
      });

      // Calculate technical indicators
      marketData.calculateTechnicalIndicators();
      
      await marketData.save();
      
      // Cache and emit
      this.dataCache.set(feed.symbol, marketData);
      this.emit('marketData', marketData);

      return marketData;
    } catch (error) {
      console.error('Process market data error:', error);
      throw error;
    }
  }

  public async getLatestData(symbol: string): Promise<IMarketData | null> {
    try {
      // Check cache first
      if (this.dataCache.has(symbol)) {
        return this.dataCache.get(symbol)!;
      }

      const data = await MarketData.findOne({ symbol })
        .sort({ timestamp: -1 });

      if (data) {
        this.dataCache.set(symbol, data);
      }

      return data;
    } catch (error) {
      console.error('Get latest data error:', error);
      return null;
    }
  }

  public async calculateTechnicalIndicators(symbol: string): Promise<TechnicalIndicators> {
    // Simplified implementation
    const data = await this.getLatestData(symbol);
    
    return {
      sma20: data?.price || 4580,
      ema9: data?.price || 4580,
      rsi: 50,
      macd: 0,
      vwap: data?.price || 4580
    };
  }
}

export const marketDataService = MarketDataService.getInstance();
export default marketDataService;