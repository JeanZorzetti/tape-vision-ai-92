import React, { useState, useEffect } from 'react';
import { X, TrendingUp, TrendingDown, AlertTriangle, Info, Zap } from 'lucide-react';

export interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info' | 'trade';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationSystemProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  position?: 'top-right' | 'bottom-right' | 'top-left' | 'bottom-left';
}

export const NotificationSystem: React.FC<NotificationSystemProps> = ({
  notifications,
  onDismiss,
  position = 'top-right'
}) => {
  const [visibleNotifications, setVisibleNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setVisibleNotifications(notifications);

    // Auto-dismiss notifications
    notifications.forEach(notification => {
      if (notification.duration && notification.duration > 0) {
        setTimeout(() => {
          onDismiss(notification.id);
        }, notification.duration);
      }
    });
  }, [notifications, onDismiss]);

  const getNotificationConfig = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return {
          icon: TrendingUp,
          className: 'border-buy-primary bg-buy-primary/10',
          iconClass: 'text-buy-primary'
        };
      case 'error':
        return {
          icon: TrendingDown,
          className: 'border-sell-primary bg-sell-primary/10',
          iconClass: 'text-sell-primary'
        };
      case 'warning':
        return {
          icon: AlertTriangle,
          className: 'border-text-accent bg-text-accent/10',
          iconClass: 'text-text-accent'
        };
      case 'trade':
        return {
          icon: Zap,
          className: 'border-text-info bg-text-info/10',
          iconClass: 'text-text-info'
        };
      default:
        return {
          icon: Info,
          className: 'border-text-secondary bg-text-secondary/10',
          iconClass: 'text-text-secondary'
        };
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 right-4';
    }
  };

  if (visibleNotifications.length === 0) return null;

  return (
    <div className={`fixed ${getPositionClasses()} z-50 max-w-sm w-full space-y-2`}>
      {visibleNotifications.map((notification, index) => {
        const config = getNotificationConfig(notification.type);
        const Icon = config.icon;

        return (
          <div
            key={notification.id}
            className={`
              relative overflow-hidden rounded-lg border backdrop-blur-sm p-4
              transform transition-all duration-300 ease-out
              animate-in slide-in-from-right-5
              ${config.className}
            `}
            style={{
              animationDelay: `${index * 100}ms`
            }}
          >
            {/* Progress bar for timed notifications */}
            {notification.duration && (
              <div className="absolute top-0 left-0 h-1 bg-current opacity-30 animate-pulse w-full" />
            )}

            <div className="flex items-start gap-3">
              <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconClass}`} />
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-text-primary mb-1">
                  {notification.title}
                </h4>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {notification.message}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-text-muted font-mono">
                    {notification.timestamp.toLocaleTimeString('pt-BR')}
                  </span>
                  
                  {notification.action && (
                    <button
                      onClick={notification.action.onClick}
                      className="text-xs font-medium text-buy-primary hover:text-buy-secondary transition-colors"
                    >
                      {notification.action.label}
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={() => onDismiss(notification.id)}
                className="flex-shrink-0 p-1 rounded text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Hook for managing notifications
export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      duration: notification.duration ?? 5000
    };

    setNotifications(prev => [newNotification, ...prev.slice(0, 4)]); // Keep only 5 notifications
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  // Helper methods for different notification types
  const notifySuccess = (title: string, message: string, action?: Notification['action']) => {
    addNotification({ type: 'success', title, message, action });
  };

  const notifyError = (title: string, message: string, action?: Notification['action']) => {
    addNotification({ type: 'error', title, message, duration: 0, action }); // Don't auto-dismiss errors
  };

  const notifyWarning = (title: string, message: string, action?: Notification['action']) => {
    addNotification({ type: 'warning', title, message, action });
  };

  const notifyTrade = (title: string, message: string, action?: Notification['action']) => {
    addNotification({ type: 'trade', title, message, duration: 8000, action });
  };

  const notifyInfo = (title: string, message: string, action?: Notification['action']) => {
    addNotification({ type: 'info', title, message, action });
  };

  return {
    notifications,
    addNotification,
    dismissNotification,
    clearAll,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyTrade,
    notifyInfo
  };
};