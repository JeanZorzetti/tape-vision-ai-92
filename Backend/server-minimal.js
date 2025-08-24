/**
 * Minimal Trading Server - JavaScript Version for Docker
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Basic routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Tape Vision AI Trading Backend is running!'
  });
});

app.get('/api/trading/status', (req, res) => {
  res.json({
    aiStatus: {
      confidence: 0,
      status: 'active',
      lastAnalysis: new Date().toISOString(),
      patternsDetected: [],
      marketContext: 'Waiting for market data',
      entrySignals: 0,
      aggressionLevel: 'low',
      hiddenLiquidity: false,
      processingLatency: 0,
      memoryUsage: 0
    },
    marketData: {
      price: 0,
      priceChange: 0,
      volume: 0,
      volatility: 0,
      spread: 0,
      sessionTime: new Date().toISOString(),
      marketPhase: 'close',
      liquidityLevel: 'low',
      orderBookImbalance: 0,
      timestamp: Date.now(),
      bid: 0,
      ask: 0,
      last: 0,
      high: 0,
      low: 0
    },
    systemHealth: {
      cpu: 0,
      memory: 0,
      disk: 0,
      network: 0,
      uptime: process.uptime(),
      timestamp: Date.now()
    }
  });
});

app.post('/api/trading/config', (req, res) => {
  res.json({
    success: true,
    message: 'Configuration updated successfully'
  });
});

app.get('/api/trading/config', (req, res) => {
  res.json({
    analysisSettings: {
      confidenceThreshold: 0.9,
      maxSignalsPerHour: 10,
      enablePatternRecognition: true
    },
    riskParameters: {
      maxDailyLoss: 500,
      maxPositionSize: 2,
      stopLossPoints: 1.5,
      targetPoints: 2
    },
    general: {
      trading: {
        enabled: false,
        symbol: 'DOL',
        timeframe: '1m'
      }
    }
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tape Vision AI Trading Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`⚡ Trading status: http://localhost:${PORT}/api/trading/status`);
  console.log('🎯 Ready for trading operations!');
});

module.exports = app;