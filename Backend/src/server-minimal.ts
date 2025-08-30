/**
 * Minimal Trading Server - For Quick Start
 */

import express from 'express';
import cors from 'cors';
import { sign, verify } from 'jsonwebtoken';
import { config } from 'dotenv';

// Load environment variables
config();

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'tape-vision-dev-secret-2025';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory user store (use database in production)
const users = [
  {
    id: '1',
    email: 'demo@aitrading.com',
    password: 'demo2025', // In production, use bcrypt
    name: 'Demo User',
    role: 'TRADER',
    permissions: ['TRADING_ENABLED', 'ML_ACCESS']
  },
  {
    id: '2', 
    email: 'admin@aitrading.com',
    password: 'admin2025',
    name: 'Admin User',
    role: 'ADMIN',
    permissions: ['TRADING_ENABLED', 'ML_ACCESS', 'ADMIN_ACCESS']
  },
  {
    id: '3',
    email: 'ml.engine@aitrading.roilabs.com.br',
    password: 'MLEngine@2025!',
    name: 'ML Engine Service',
    role: 'SERVICE',
    permissions: ['ML_ENGINE_ACCESS', 'DATA_ACCESS']
  }
];

// Authentication routes
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Login attempt:', { email });
  
  // Find user
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    console.log('❌ Invalid credentials for:', email);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }
  
  // Generate JWT token
  const tokenPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    permissions: user.permissions
  };
  
  const accessToken = sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refreshToken = sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  
  console.log('✅ Login successful for:', user.email, 'Role:', user.role);
  
  res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions
    },
    tokens: {
      accessToken,
      refreshToken
    }
  });
});

app.post('/api/auth/logout', (req, res) => {
  console.log('👋 User logout');
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

app.post('/api/auth/register', (req, res) => {
  res.status(403).json({
    success: false,
    error: 'Registration is disabled. Contact administrator.',
    code: 'REGISTRATION_DISABLED'
  });
});

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const decoded = verify(refreshToken, JWT_SECRET) as any;
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
    
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions
    };
    
    const accessToken = sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    
    res.json({ accessToken, refreshToken });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

app.get('/api/auth/profile', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = verify(token, JWT_SECRET) as any;
    const user = users.find(u => u.id === decoded.id);
    
    if (!user) {
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// ML Engine endpoints
app.get('/api/trading/ml/predictions', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  // Mock ML predictions
  res.json([
    {
      signal: 'BUY',
      confidence: 0.85,
      reasoning: 'Strong upward momentum detected with volume confirmation',
      stopLoss: 4575.50,
      target: 4588.75,
      riskReward: 1.8,
      timestamp: new Date().toISOString(),
      patterns: [
        { name: 'Bullish Breakout', confidence: 0.87 },
        { name: 'Volume Surge', confidence: 0.82 }
      ],
      marketRegime: 'trending',
      modelVersion: '1.0',
      featuresCount: 42,
      responseTime: 145
    }
  ]);
});

// Basic routes
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Tape Vision AI Trading Backend is running!'
  });
});

app.get('/api/trading/status', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
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
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  res.json({
    success: true,
    message: 'Configuration updated successfully'
  });
});

app.get('/api/trading/config', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
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

// Trading session endpoints
app.post('/api/trading/session/start', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  console.log('🎯 Starting trading session');
  
  res.json({
    success: true,
    sessionId: `session_${Date.now()}`,
    startTime: new Date().toISOString(),
    message: 'Trading session started successfully'
  });
});

app.post('/api/trading/session/end', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  console.log('🏁 Ending trading session');
  
  res.json({
    success: true,
    endTime: new Date().toISOString(),
    message: 'Trading session ended successfully'
  });
});

app.get('/api/trading/session/status', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  res.json({
    active: true,
    sessionId: 'demo_session_123',
    startTime: new Date().toISOString(),
    duration: 3600000, // 1 hour
    trades: 0,
    pnl: 0
  });
});

// Trading operations
app.get('/api/trading/orders', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  res.json([]);
});

app.get('/api/trading/positions', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  res.json([]);
});

app.post('/api/trading/orders', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  console.log('💰 Order placement request:', req.body);
  
  res.json({
    success: true,
    orderId: `order_${Date.now()}`,
    status: 'PENDING',
    message: 'Order placed successfully'
  });
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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

export default app;