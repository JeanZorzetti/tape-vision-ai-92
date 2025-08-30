/**
 * API Service for Tape Vision AI Trading Backend
 * Handles all backend communication with middleware authentication
 */

import { AIStatus, MarketData, TradingConfig, SystemHealth } from '@/types/trading';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_ENDPOINTS = {
  health: '/health',
  auth: {
    login: '/api/auth/login',
    logout: '/api/auth/logout', 
    register: '/api/auth/register',
    refresh: '/api/auth/refresh',
    profile: '/api/auth/profile'
  },
  trading: {
    status: '/api/trading/status',
    config: '/api/trading/config',
    session: {
      start: '/api/trading/session/start',
      end: '/api/trading/session/end',
      status: '/api/trading/session/status'
    },
    orders: '/api/trading/orders',
    positions: '/api/trading/positions',
    ml: {
      predictions: '/api/trading/ml/predictions'
    }
  }
} as const;

// Authentication interfaces
interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  apiKey?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
}

// API Response types
interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  message: string;
}

interface AuthResponse {
  success: boolean;
  user: User;
  tokens: AuthTokens;
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

// Enhanced API Client with Middleware Integration
class ApiClient {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;
  private authTokens: AuthTokens | null = null;
  private refreshPromise: Promise<void> | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Load stored tokens on initialization
    this.loadStoredTokens();
  }

  /**
   * Load authentication tokens from localStorage
   */
  private loadStoredTokens(): void {
    try {
      const stored = localStorage.getItem('tradingAuth');
      if (stored) {
        this.authTokens = JSON.parse(stored);
      }
    } catch (error) {
      console.warn('Failed to load stored auth tokens:', error);
      localStorage.removeItem('tradingAuth');
    }
  }

  /**
   * Store authentication tokens to localStorage
   */
  private storeTokens(tokens: AuthTokens): void {
    this.authTokens = tokens;
    localStorage.setItem('tradingAuth', JSON.stringify(tokens));
  }

  /**
   * Clear authentication tokens
   */
  private clearTokens(): void {
    this.authTokens = null;
    localStorage.removeItem('tradingAuth');
  }

  /**
   * Get authorization headers with JWT token
   */
  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = { ...this.defaultHeaders };
    
    if (this.authTokens?.accessToken) {
      headers['Authorization'] = `Bearer ${this.authTokens.accessToken}`;
    }
    
    if (this.authTokens?.apiKey) {
      headers['X-API-Key'] = this.authTokens.apiKey;
    }
    
    return headers;
  }

  /**
   * Refresh authentication tokens
   */
  private async refreshTokens(): Promise<void> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        if (!this.authTokens?.refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: this.defaultHeaders,
          body: JSON.stringify({ refreshToken: this.authTokens.refreshToken })
        });

        if (!response.ok) {
          throw new Error('Token refresh failed');
        }

        const data = await response.json();
        this.storeTokens({ 
          accessToken: data.accessToken, 
          refreshToken: data.refreshToken || this.authTokens.refreshToken,
          apiKey: this.authTokens.apiKey
        });
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.clearTokens();
        window.dispatchEvent(new CustomEvent('auth:logout'));
        throw error;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Make authenticated HTTP request with automatic token refresh
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = requireAuth ? this.getAuthHeaders() : { ...this.defaultHeaders, ...options.headers };
    
    const makeRequest = async (): Promise<Response> => {
      return fetch(url, {
        ...options,
        headers
      });
    };

    try {
      let response = await makeRequest();

      // Handle 401 Unauthorized - attempt token refresh
      if (response.status === 401 && requireAuth && this.authTokens) {
        try {
          await this.refreshTokens();
          // Retry with new token
          const newHeaders = this.getAuthHeaders();
          response = await fetch(url, {
            ...options,
            headers: { ...newHeaders, ...options.headers }
          });
        } catch (refreshError) {
          // Refresh failed, clear tokens and emit logout event
          this.clearTokens();
          window.dispatchEvent(new CustomEvent('auth:logout'));
          throw new Error('Authentication expired. Please login again.');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({
          error: `HTTP ${response.status}: ${response.statusText}`
        }));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Authentication methods
   */
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      API_ENDPOINTS.auth.login,
      {
        method: 'POST',
        body: JSON.stringify({ email, password })
      }
    );
    
    this.storeTokens(response.tokens);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: response.user }));
    return response;
  }

  async logout(): Promise<void> {
    try {
      if (this.authTokens?.accessToken) {
        await this.request(API_ENDPOINTS.auth.logout, {
          method: 'POST'
        }, true);
      }
    } catch (error) {
      console.warn('Logout request failed:', error);
    } finally {
      this.clearTokens();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  async register(userData: { email: string; password: string; name: string }): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>(
      API_ENDPOINTS.auth.register,
      {
        method: 'POST',
        body: JSON.stringify(userData)
      }
    );
    
    this.storeTokens(response.tokens);
    window.dispatchEvent(new CustomEvent('auth:login', { detail: response.user }));
    return response;
  }

  async getProfile(): Promise<User> {
    return this.request<User>(API_ENDPOINTS.auth.profile, {}, true);
  }

  /**
   * Public endpoints (no authentication required)
   */
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>(API_ENDPOINTS.health);
  }

  /**
   * Protected trading endpoints (require authentication)
   */
  async getTradingStatus(): Promise<TradingStatusResponse> {
    return this.request<TradingStatusResponse>(API_ENDPOINTS.trading.status, {}, true);
  }

  async getTradingConfig(): Promise<ConfigResponse> {
    return this.request<ConfigResponse>(API_ENDPOINTS.trading.config, {}, true);
  }

  async updateTradingConfig(config: Partial<TradingConfig>): Promise<ConfigResponse> {
    return this.request<ConfigResponse>(API_ENDPOINTS.trading.config, {
      method: 'POST',
      body: JSON.stringify(config)
    }, true);
  }

  async startTradingSession(): Promise<{ sessionId: string; success: boolean }> {
    return this.request(API_ENDPOINTS.trading.session.start, {
      method: 'POST'
    }, true);
  }

  async endTradingSession(): Promise<{ success: boolean }> {
    return this.request(API_ENDPOINTS.trading.session.end, {
      method: 'POST'
    }, true);
  }

  async getTradingSession(): Promise<any> {
    return this.request(API_ENDPOINTS.trading.session.status, {}, true);
  }

  async placeOrder(orderData: any): Promise<any> {
    return this.request(API_ENDPOINTS.trading.orders, {
      method: 'POST',
      body: JSON.stringify(orderData)
    }, true);
  }

  async getOrders(): Promise<any[]> {
    return this.request(API_ENDPOINTS.trading.orders, {}, true);
  }

  async getPositions(): Promise<any[]> {
    return this.request(API_ENDPOINTS.trading.positions, {}, true);
  }

  async getMLPredictions(): Promise<any[]> {
    return this.request(API_ENDPOINTS.trading.ml.predictions, {}, true);
  }

  /**
   * Utility methods
   */
  isAuthenticated(): boolean {
    return !!this.authTokens?.accessToken;
  }

  getCurrentUser(): User | null {
    if (!this.authTokens?.accessToken) return null;
    
    try {
      const payload = JSON.parse(atob(this.authTokens.accessToken.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  }

  getAuthToken(): string | null {
    return this.authTokens?.accessToken || null;
  }
}

// WebSocket connection for real-time updates with authentication
export class TradingWebSocket {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private messageQueue: string[] = [];
  private eventListeners: { [event: string]: Function[] } = {};
  private authToken: string | null = null;
  private isAuthenticated = false;

  constructor(url?: string, authToken?: string) {
    this.url = url || `ws://localhost:3002`;
    this.authToken = authToken || null;
  }

  /**
   * Set authentication token for WebSocket connection
   */
  setAuthToken(token: string): void {
    this.authToken = token;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.authenticate();
    }
  }

  /**
   * Authenticate WebSocket connection
   */
  private authenticate(): void {
    if (this.authToken && this.ws) {
      this.ws.send(JSON.stringify({
        type: 'auth',
        token: this.authToken
      }));
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.reconnectAttempts = 0;
          
          // Authenticate if token available
          if (this.authToken) {
            this.authenticate();
          }
          
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket connection error:', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket connection closed:', event.code, event.reason);
          this.isAuthenticated = false;
          this.handleReconnect();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // Handle authentication response
            if (data.type === 'auth_success') {
              this.isAuthenticated = true;
              console.log('✅ WebSocket authenticated');
              
              // Send any queued messages after authentication
              while (this.messageQueue.length > 0) {
                const message = this.messageQueue.shift();
                if (message && this.ws) {
                  this.ws.send(message);
                }
              }
              
              this.emit('authenticated', data);
            } else if (data.type === 'auth_error') {
              console.error('❌ WebSocket authentication failed:', data.message);
              this.isAuthenticated = false;
              this.emit('auth_error', data);
            } else {
              this.emit(data.type || 'message', data);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
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
      console.log(`🔄 WebSocket reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect().catch(console.error);
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ WebSocket max reconnection attempts reached');
    }
  }

  send(data: any): void {
    const message = JSON.stringify(data);
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isAuthenticated) {
      this.ws.send(message);
    } else {
      // Queue message for when connection is authenticated
      this.messageQueue.push(message);
      
      if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.isAuthenticated && this.authToken) {
        this.authenticate();
      }
    }
  }

  on(event: string, callback: Function): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  off(event: string, callback?: Function): void {
    if (!this.eventListeners[event]) return;
    
    if (callback) {
      this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
    } else {
      delete this.eventListeners[event];
    }
  }

  private emit(event: string, data: any): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event].forEach(callback => callback(data));
    }
    
    // Also emit to window for global listening
    window.dispatchEvent(new CustomEvent(`ws:${event}`, { detail: data }));
  }

  disconnect(): void {
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isAuthenticated = false;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated;
  }
}

// Create API client instance
const apiClient = new ApiClient(API_BASE_URL);

// Enhanced API Service with middleware integration
export const apiService = {
  // Authentication
  login: apiClient.login.bind(apiClient),
  logout: apiClient.logout.bind(apiClient),
  register: apiClient.register.bind(apiClient),
  getProfile: apiClient.getProfile.bind(apiClient),
  isAuthenticated: apiClient.isAuthenticated.bind(apiClient),
  getCurrentUser: apiClient.getCurrentUser.bind(apiClient),
  getAuthToken: apiClient.getAuthToken.bind(apiClient),

  // Public endpoints
  checkHealth: apiClient.checkHealth.bind(apiClient),

  // Protected trading endpoints
  getTradingStatus: apiClient.getTradingStatus.bind(apiClient),
  getTradingConfig: apiClient.getTradingConfig.bind(apiClient),
  updateTradingConfig: apiClient.updateTradingConfig.bind(apiClient),
  
  // Trading sessions
  startTradingSession: apiClient.startTradingSession.bind(apiClient),
  endTradingSession: apiClient.endTradingSession.bind(apiClient),
  getTradingSession: apiClient.getTradingSession.bind(apiClient),

  // Trading operations
  placeOrder: apiClient.placeOrder.bind(apiClient),
  getOrders: apiClient.getOrders.bind(apiClient),
  getPositions: apiClient.getPositions.bind(apiClient),
  getMLPredictions: apiClient.getMLPredictions.bind(apiClient),

  // Connection testing
  async testConnection(): Promise<{ connected: boolean; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      await apiClient.checkHealth();
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

// Export API configuration
export const apiConfig = {
  baseUrl: API_BASE_URL,
  endpoints: API_ENDPOINTS,
  isLocal: API_BASE_URL.includes('localhost'),
  isDevelopment: import.meta.env.DEV
};

export default apiService;