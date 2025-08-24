/**
 * Custom hook for managing backend connection
 */

import { useState, useEffect, useCallback } from 'react';
import { apiService, TradingWebSocket } from '@/lib/api';

export interface ConnectionStatus {
  isConnected: boolean;
  isConnecting: boolean;
  lastPing: number | null;
  error: string | null;
  backendUrl: string;
}

export const useBackendConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isConnecting: false,
    lastPing: null,
    error: null,
    backendUrl: import.meta.env.VITE_API_URL || 'http://localhost:3001'
  });

  const [websocket, setWebsocket] = useState<TradingWebSocket | null>(null);

  // Test backend connection
  const testConnection = useCallback(async () => {
    setConnectionStatus(prev => ({ 
      ...prev, 
      isConnecting: true, 
      error: null 
    }));

    try {
      const result = await apiService.testConnection();
      
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: result.connected,
        isConnecting: false,
        lastPing: result.latency || null,
        error: result.error || null
      }));

      return result.connected;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed';
      
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: false,
        isConnecting: false,
        error: errorMessage
      }));

      return false;
    }
  }, []);

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(async () => {
    if (websocket) {
      websocket.disconnect();
    }

    try {
      const ws = new TradingWebSocket();
      await ws.connect();
      setWebsocket(ws);
      
      console.log('[Hook] WebSocket connected successfully');
    } catch (error) {
      console.error('[Hook] Failed to connect WebSocket:', error);
    }
  }, [websocket]);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (websocket) {
      websocket.disconnect();
      setWebsocket(null);
    }
  }, [websocket]);

  // Auto-connect on mount
  useEffect(() => {
    testConnection();
  }, [testConnection]);

  // Periodic connection check (every 30 seconds)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!connectionStatus.isConnecting) {
        await testConnection();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [testConnection, connectionStatus.isConnecting]);

  return {
    connectionStatus,
    testConnection,
    connectWebSocket,
    disconnectWebSocket,
    websocket
  };
};