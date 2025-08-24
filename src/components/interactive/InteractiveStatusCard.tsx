import React, { useState } from 'react';
import { LucideIcon, ChevronDown, ChevronUp } from 'lucide-react';

interface InteractiveStatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  type?: 'buy' | 'sell' | 'neutral' | 'accent';
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
  expandable?: boolean;
  expandedContent?: React.ReactNode;
  isLoading?: boolean;
  pulse?: boolean;
  children?: React.ReactNode;
}

export const InteractiveStatusCard: React.FC<InteractiveStatusCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  type = 'neutral',
  trend = 'neutral',
  onClick,
  expandable = false,
  expandedContent,
  isLoading = false,
  pulse = false,
  children
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const getTypeClasses = () => {
    switch (type) {
      case 'buy':
        return {
          card: 'border-buy-primary/30 bg-buy-primary/5 hover:border-buy-primary/50',
          icon: 'text-buy-primary',
          value: 'value-buy',
          glow: pulse ? 'glow-buy' : ''
        };
      case 'sell':
        return {
          card: 'border-sell-primary/30 bg-sell-primary/5 hover:border-sell-primary/50',
          icon: 'text-sell-primary',
          value: 'value-sell',
          glow: pulse ? 'glow-sell' : ''
        };
      case 'accent':
        return {
          card: 'border-text-accent/30 bg-text-accent/5 hover:border-text-accent/50',
          icon: 'text-text-accent',
          value: 'value-accent',
          glow: ''
        };
      default:
        return {
          card: 'border-glass-border bg-bg-secondary/50 hover:border-glass-border',
          icon: 'text-text-secondary',
          value: 'value-neutral',
          glow: ''
        };
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      default: return '';
    }
  };

  const getTrendClass = () => {
    switch (trend) {
      case 'up': return 'text-buy-primary';
      case 'down': return 'text-sell-primary';
      default: return 'text-text-secondary';
    }
  };

  const classes = getTypeClasses();

  const handleClick = () => {
    if (expandable) {
      setIsExpanded(!isExpanded);
    }
    onClick?.();
  };

  return (
    <div
      className={`
        relative overflow-hidden rounded-lg border transition-all duration-300 cursor-pointer
        transform hover:scale-[1.02] active:scale-[0.98]
        ${classes.card} ${classes.glow}
        ${onClick || expandable ? 'cursor-pointer' : 'cursor-default'}
        ${pulse ? 'animate-pulse-buy' : ''}
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Loading Bar */}
      {isLoading && (
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-buy-primary to-transparent animate-pulse" />
      )}

      {/* Hover Effect */}
      {isHovered && (
        <div className="absolute inset-0 bg-gradient-to-br from-buy-primary/5 to-transparent pointer-events-none" />
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`
              p-2 rounded-lg transition-all duration-300
              ${isHovered ? 'bg-current/10 scale-110' : 'bg-current/5'}
            `}>
              <Icon className={`w-5 h-5 ${classes.icon}`} />
            </div>
            <div>
              <h3 className="font-medium text-text-primary text-sm">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-text-muted">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {trend !== 'neutral' && (
              <span className={`text-lg ${getTrendClass()}`}>
                {getTrendIcon()}
              </span>
            )}
            {expandable && (
              <div className="text-text-secondary">
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-baseline justify-between">
          <span className={`text-2xl font-bold font-mono ${classes.value}`}>
            {isLoading ? '...' : value}
          </span>
        </div>

        {children && (
          <div className="mt-3">
            {children}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {expandable && isExpanded && expandedContent && (
        <div className="border-t border-current/10 p-4 bg-current/5 animate-in slide-in-from-top-2">
          {expandedContent}
        </div>
      )}

      {/* Pulse Animation Overlay */}
      {pulse && (
        <div className="absolute inset-0 border border-current rounded-lg animate-ping opacity-20 pointer-events-none" />
      )}
    </div>
  );
};