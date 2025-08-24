/**
 * API Service for Tape Vision AI Trading Backend
 * Handles all backend communication
 */

import { AIStatus, MarketData, TradingConfig, SystemHealth } from '@/types/trading';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_ENDPOINTS = {
  health: '/health',
  trading: {
    status: '/api/trading/status',
    config: '/api/trading/config'
  }
} as const;

// Types for API responses
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  message: string;
}

interface TradingStatusResponse {
  aiStatus: AIStatus;
  marketData: MarketData;
  systemHealth: SystemHealth;
}

interface ConfigResponse {
  analysisSettings: TradingConfig['analysisSettings'];
  riskParameters: TradingConfig['riskParameters'];
  general: TradingConfig['general'];
}

// Base API class
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      headers: { ...this.defaultHeaders, ...options.headers },
      ...options
    };

    try {
      console.log(`[API] ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`[API] Response:`, data);
      
      return data;
    } catch (error) {
      console.error(`[API] Error ${options.method || 'GET'} ${url}:`, error);
      throw error;
    }
  }

  // GET request
  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  // POST request
  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined
    });
  }

  // PUT request
  async put<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }
}

// Create API client instance
const apiClient = new ApiClient(API_BASE_URL);

// API Service functions
export const apiService = {
  // Health check
  async checkHealth(): Promise<HealthResponse> {
    return apiClient.get<HealthResponse>(API_ENDPOINTS.health);
  },

  // Get trading status (AI status, market data, system health)
  async getTradingStatus(): Promise<TradingStatusResponse> {
    return apiClient.get<TradingStatusResponse>(API_ENDPOINTS.trading.status);
  },

  // Get trading configuration
  async getTradingConfig(): Promise<ConfigResponse> {
    return apiClient.get<ConfigResponse>(API_ENDPOINTS.trading.config);
  },

  // Update trading configuration
  async updateTradingConfig(config: Partial<ConfigResponse>): Promise<{ success: boolean; message: string }> {
    return apiClient.post(API_ENDPOINTS.trading.config, config);
  },

  // Test connection to backend
  async testConnection(): Promise<{ connected: boolean; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      await this.checkHealth();
      const latency = Date.now() - startTime;
      
      return { connected: true, latency };
    } catch (error) {
      return { 
        connected: false, 
        error: error instanceof Error ? error.message : 'Connection failed'
      };
    }
  }
};

// WebSocket service for real-time data
export class TradingWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  constructor(url?: string) {
    this.url = url || `ws://localhost:3002`;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        
        this.ws.onopen = () => {
          console.log('[WebSocket] Connected to trading backend');
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Connection error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Connection closed');
          this.handleReconnect();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[WebSocket] Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    }
  }

  private handleMessage(data: any): void {
    // Emit custom events for different message types
    const event = new CustomEvent('tradingData', { detail: data });
    window.dispatchEvent(event);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }
}

// Export API configuration for environment setup
export const apiConfig = {
  baseUrl: API_BASE_URL,
  endpoints: API_ENDPOINTS,
  isLocal: API_BASE_URL.includes('localhost'),
  isDevelopment: import.meta.env.DEV
};

export default apiService;