import { useState, useEffect, useCallback } from 'react';
import { ConnectionStatus, NelogicaConfig } from '@/types/trading';

// Custom hook for system status management
export const useSystemStatus = () => {
  const [isSystemActive, setIsSystemActive] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('pt-BR'));
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  
  const [nelogicaConfig, setNelogicaConfig] = useState<NelogicaConfig | null>(null);
  const [nelogicaStatus, setNelogicaStatus] = useState<ConnectionStatus>({
    isConnected: false,
    status: 'disconnected',
    lastHeartbeat: 'Never'
  });

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('pt-BR'));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Connection status based on Nelogica
  useEffect(() => {
    setIsConnected(nelogicaStatus.isConnected);
  }, [nelogicaStatus.isConnected]);

  const handleEmergencyStop = useCallback(() => {
    setIsSystemActive(false);
  }, []);

  const reactivateSystem = useCallback(() => {
    setIsSystemActive(true);
  }, []);

  const toggleNotifications = useCallback(() => {
    setNotificationsEnabled(prev => !prev);
  }, []);

  const handleNelogicaConfigChange = useCallback((config: NelogicaConfig) => {
    setNelogicaConfig(config);
  }, []);

  const handleNelogicaStatusChange = useCallback((status: ConnectionStatus) => {
    setNelogicaStatus(status);
  }, []);

  return {
    isSystemActive,
    isConnected,
    currentTime,
    notificationsEnabled,
    nelogicaConfig,
    nelogicaStatus,
    handleEmergencyStop,
    reactivateSystem,
    toggleNotifications,
    handleNelogicaConfigChange,
    handleNelogicaStatusChange
  };
};