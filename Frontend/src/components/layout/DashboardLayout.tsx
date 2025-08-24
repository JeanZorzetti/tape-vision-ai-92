import React from 'react';
import { DashboardHeader } from './DashboardHeader';
import { SystemOverlay } from './SystemOverlay';
import { NotificationSystem } from '../notifications/NotificationSystem';
import { EmergencyStop } from '../trading/EmergencyStop';
import { useNotifications } from '../notifications/NotificationSystem';

interface DashboardLayoutProps {
  children: React.ReactNode;
  isSystemActive: boolean;
  isConnected: boolean;
  currentTime: string;
  notificationsEnabled: boolean;
  nelogicaStatus: any;
  onEmergencyStop: () => void;
  onReactivateSystem: () => void;
  onToggleNotifications: () => void;
  onToggleSettings: () => void;
  showSettings: boolean;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  isSystemActive,
  isConnected,
  currentTime,
  notificationsEnabled,
  nelogicaStatus,
  onEmergencyStop,
  onReactivateSystem,
  onToggleNotifications,
  onToggleSettings,
  showSettings
}) => {
  const { notifications, dismissNotification } = useNotifications();

  return (
    <div className="min-h-screen bg-bg-primary relative">
      {/* Notifications */}
      {notificationsEnabled && (
        <NotificationSystem
          notifications={notifications}
          onDismiss={dismissNotification}
          position="top-right"
        />
      )}

      {/* Emergency Stop Button */}
      <EmergencyStop 
        onEmergencyStop={onEmergencyStop}
        isActive={isSystemActive}
      />

      {/* Header */}
      <DashboardHeader
        currentTime={currentTime}
        isConnected={isConnected}
        isSystemActive={isSystemActive}
        notificationsEnabled={notificationsEnabled}
        nelogicaStatus={nelogicaStatus}
        onToggleNotifications={onToggleNotifications}
        onToggleSettings={onToggleSettings}
        showSettings={showSettings}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      {/* System Overlay when stopped */}
      {!isSystemActive && (
        <SystemOverlay onReactivate={onReactivateSystem} />
      )}
    </div>
  );
};