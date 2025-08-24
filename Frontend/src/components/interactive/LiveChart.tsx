import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface DataPoint {
  timestamp: number;
  value: number;
  volume?: number;
}

interface LiveChartProps {
  title: string;
  data: DataPoint[];
  height?: number;
  color?: 'buy' | 'sell' | 'accent';
  showVolume?: boolean;
  animated?: boolean;
}

export const LiveChart: React.FC<LiveChartProps> = ({
  title,
  data,
  height = 120,
  color = 'buy',
  showVolume = false,
  animated = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);

  const colorMap = {
    buy: '#00ff88',
    sell: '#ff4444', 
    accent: '#ffd700'
  };

  const selectedColor = colorMap[color];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const chartHeight = showVolume ? height * 0.7 : height;
    const volumeHeight = showVolume ? height * 0.3 : 0;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (data.length < 2) return;

    // Calculate bounds
    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    const volumes = showVolume ? data.map(d => d.volume || 0) : [];
    const maxVolume = volumes.length > 0 ? Math.max(...volumes) : 1;

    // Draw grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const y = (chartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw volume bars (if enabled)
    if (showVolume && volumes.length > 0) {
      const barWidth = width / data.length;
      ctx.fillStyle = `${selectedColor}30`;
      
      data.forEach((point, index) => {
        const volume = point.volume || 0;
        const barHeight = (volume / maxVolume) * volumeHeight;
        const x = (index / (data.length - 1)) * (width - barWidth);
        const y = chartHeight + volumeHeight - barHeight;
        
        ctx.fillRect(x, y, barWidth * 0.8, barHeight);
      });
    }

    // Draw price line
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw gradient fill
    if (animated) {
      const gradient = ctx.createLinearGradient(0, 0, 0, chartHeight);
      gradient.addColorStop(0, `${selectedColor}40`);
      gradient.addColorStop(1, `${selectedColor}00`);
      
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Draw data points
    ctx.fillStyle = selectedColor;
    data.forEach((point, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw current value indicator
    if (data.length > 0) {
      const lastPoint = data[data.length - 1];
      const x = width - 20;
      const y = chartHeight - ((lastPoint.value - minValue) / valueRange) * chartHeight;
      
      ctx.fillStyle = selectedColor;
      ctx.beginPath();
      ctx.arc(width - 10, y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Pulse effect
      if (animated) {
        ctx.strokeStyle = `${selectedColor}60`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width - 10, y, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }, [data, height, selectedColor, showVolume, animated]);

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const dataIndex = Math.round((x / rect.width) * (data.length - 1));
    
    if (dataIndex >= 0 && dataIndex < data.length) {
      setHoveredPoint(data[dataIndex]);
    }
  };

  const getCurrentTrend = () => {
    if (data.length < 2) return 'neutral';
    const lastValue = data[data.length - 1].value;
    const previousValue = data[data.length - 2].value;
    return lastValue > previousValue ? 'up' : lastValue < previousValue ? 'down' : 'neutral';
  };

  const trend = getCurrentTrend();
  const currentValue = data.length > 0 ? data[data.length - 1].value : 0;
  const previousValue = data.length > 1 ? data[data.length - 2].value : currentValue;
  const change = currentValue - previousValue;
  const changePercent = previousValue !== 0 ? (change / previousValue) * 100 : 0;

  return (
    <div className="trading-card">
      <div className="flex items-center justify-between mb-4">
        <h4 className="font-medium text-text-secondary flex items-center gap-2">
          <Activity className="w-4 h-4" />
          {title}
        </h4>
        
        <div className="flex items-center gap-2">
          {trend === 'up' ? (
            <TrendingUp className="w-4 h-4 text-buy-primary" />
          ) : trend === 'down' ? (
            <TrendingDown className="w-4 h-4 text-sell-primary" />
          ) : (
            <Activity className="w-4 h-4 text-text-secondary" />
          )}
          
          <span className={`text-sm font-mono font-semibold ${
            trend === 'up' ? 'text-buy-primary' : 
            trend === 'down' ? 'text-sell-primary' : 
            'text-text-secondary'
          }`}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)} ({changePercent.toFixed(1)}%)
          </span>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          style={{ height: `${height}px` }}
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            setIsHovered(false);
            setHoveredPoint(null);
          }}
        />

        {/* Current Value Display */}
        <div className="absolute top-2 left-2 bg-bg-tertiary/90 backdrop-blur-sm rounded px-2 py-1">
          <span className={`text-lg font-mono font-bold ${
            color === 'buy' ? 'value-buy' : 
            color === 'sell' ? 'value-sell' : 
            'value-accent'
          }`}>
            {currentValue.toFixed(2)}
          </span>
        </div>

        {/* Hover Tooltip */}
        {isHovered && hoveredPoint && (
          <div className="absolute top-2 right-2 bg-bg-tertiary/90 backdrop-blur-sm rounded px-3 py-2 text-sm">
            <div className="text-text-primary font-mono">
              {hoveredPoint.value.toFixed(2)}
            </div>
            <div className="text-text-secondary text-xs">
              {new Date(hoveredPoint.timestamp).toLocaleTimeString('pt-BR')}
            </div>
            {hoveredPoint.volume && (
              <div className="text-text-accent text-xs">
                Vol: {hoveredPoint.volume.toLocaleString()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chart Statistics */}
      <div className="flex justify-between items-center mt-3 text-xs text-text-muted">
        <span>Min: {Math.min(...data.map(d => d.value)).toFixed(2)}</span>
        <span>Pontos: {data.length}</span>
        <span>Max: {Math.max(...data.map(d => d.value)).toFixed(2)}</span>
      </div>
    </div>
  );
};