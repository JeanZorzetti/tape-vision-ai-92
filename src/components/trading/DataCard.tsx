import React from 'react';
import { LucideIcon } from 'lucide-react';

interface DataCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  type?: 'buy' | 'sell' | 'neutral' | 'accent';
  icon?: LucideIcon;
  subtitle?: string;
  lastUpdate?: string;
  loading?: boolean;
}

export const DataCard: React.FC<DataCardProps> = ({
  title,
  value,
  unit = '',
  trend = 'neutral',
  type = 'neutral',
  icon: Icon,
  subtitle,
  lastUpdate,
  loading = false
}) => {
  const getValueClass = () => {
    switch (type) {
      case 'buy': return 'value-buy';
      case 'sell': return 'value-sell';
      case 'accent': return 'value-accent';
      default: return 'value-neutral';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '→';
    }
  };

  const getTrendClass = () => {
    switch (trend) {
      case 'up': return 'text-buy-primary';
      case 'down': return 'text-sell-primary';
      default: return 'text-text-secondary';
    }
  };

  if (loading) {
    return (
      <div className="trading-card">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-bg-accent rounded w-3/4" />
          <div className="h-6 bg-bg-accent rounded w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="trading-card group">
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-text-secondary" />}
          <h4 className="font-medium text-text-secondary text-sm">{title}</h4>
        </div>
        {lastUpdate && (
          <span className="text-xs text-text-info font-mono">
            {lastUpdate}
          </span>
        )}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="flex items-baseline gap-1">
          <span className={`text-2xl font-bold ${getValueClass()}`}>
            {value}
          </span>
          {unit && (
            <span className="text-sm text-text-secondary font-mono">
              {unit}
            </span>
          )}
        </div>

        <div className={`flex items-center gap-1 ${getTrendClass()}`}>
          <span className="text-lg">{getTrendIcon()}</span>
        </div>
      </div>

      {subtitle && (
        <p className="text-xs text-text-muted mt-2 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};