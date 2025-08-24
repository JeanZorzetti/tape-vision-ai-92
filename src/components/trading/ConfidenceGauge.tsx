import React from 'react';

interface ConfidenceGaugeProps {
  confidence: number;
  threshold?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({
  confidence,
  threshold = 90,
  label = "Confiança da IA",
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'h-2',
    md: 'h-4', 
    lg: 'h-6'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  const getGaugeColor = (value: number) => {
    if (value >= threshold) return 'bg-buy-primary';
    if (value >= 70) return 'bg-text-accent';
    return 'bg-sell-primary';
  };

  const isHighConfidence = confidence >= threshold;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className={`font-medium text-text-secondary ${textSizes[size]}`}>
          {label}
        </span>
        <span className={`
          font-mono font-bold ${textSizes[size]}
          ${isHighConfidence ? 'value-buy' : confidence >= 70 ? 'value-accent' : 'value-sell'}
        `}>
          {confidence.toFixed(1)}%
        </span>
      </div>

      <div className="relative">
        <div className={`confidence-gauge ${sizeClasses[size]}`}>
          <div 
            className={`
              gauge-fill ${getGaugeColor(confidence)}
              ${isHighConfidence ? 'glow-buy' : ''}
            `}
            style={{ width: `${Math.min(confidence, 100)}%` }}
          />
        </div>
        
        {/* Threshold marker */}
        <div 
          className="absolute top-0 w-0.5 h-full bg-text-accent opacity-60"
          style={{ left: `${threshold}%` }}
          title={`Threshold: ${threshold}%`}
        />
      </div>

      <div className="flex justify-between text-xs text-text-muted font-mono">
        <span>0%</span>
        <span className="text-text-accent">{threshold}%</span>
        <span>100%</span>
      </div>

      {isHighConfidence && (
        <div className="flex items-center gap-2 text-xs text-buy-primary">
          <div className="w-2 h-2 rounded-full bg-buy-primary pulse-buy" />
          <span className="font-medium">Nível de entrada atingido</span>
        </div>
      )}
    </div>
  );
};