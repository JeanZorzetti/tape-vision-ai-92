/**
 * Authentication Server - JavaScript Version
 * Simple server with JWT authentication for immediate testing
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'tape-vision-dev-secret-2025';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';

// Middleware
app.use(cors());
app.use(express.json());

// In-memory user store
const users = [
  {
    id: '1',
    email: 'demo@aitrading.com',
    password: 'demo2025',
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

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
};

// Health check (public)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'Tape Vision AI Trading Backend is running!'
  });
});

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
  
  const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  const refreshToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '30d' });
  
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
    const decoded = jwt.verify(refreshToken, JWT_SECRET);
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
    
    const accessToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    
    res.json({ accessToken, refreshToken });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
});

app.get('/api/auth/profile', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  
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
});

// Protected trading endpoints
app.get('/api/trading/status', authenticateToken, (req, res) => {
  res.json({
    aiStatus: {
      confidence: Math.floor(Math.random() * 100),
      status: 'active',
      lastAnalysis: new Date().toISOString(),
      patternsDetected: ['Bullish Breakout', 'Volume Surge'],
      marketContext: 'Strong upward momentum with volume confirmation',
      entrySignals: Math.floor(Math.random() * 10),
      aggressionLevel: Math.random() > 0.5 ? 'high' : 'medium',
      hiddenLiquidity: Math.random() > 0.7,
      processingLatency: Math.floor(Math.random() * 200) + 50,
      memoryUsage: Math.floor(Math.random() * 512) + 256
    },
    marketData: {
      price: 4580.25 + (Math.random() - 0.5) * 20,
      priceChange: (Math.random() - 0.5) * 10,
      volume: Math.floor(Math.random() * 10000) + 5000,
      volatility: Math.random() * 5,
      spread: Math.random() * 2,
      sessionTime: new Date().toISOString(),
      marketPhase: 'regular',
      liquidityLevel: Math.random() > 0.5 ? 'high' : 'medium',
      orderBookImbalance: (Math.random() - 0.5) * 100,
      timestamp: Date.now(),
      bid: 4579.75,
      ask: 4580.25,
      last: 4580.00,
      high: 4585.50,
      low: 4575.25
    },
    systemHealth: {
      cpu: Math.floor(Math.random() * 100),
      memory: Math.floor(Math.random() * 100),
      disk: Math.floor(Math.random() * 100),
      network: Math.floor(Math.random() * 100),
      uptime: process.uptime(),
      timestamp: Date.now()
    }
  });
});

app.get('/api/trading/config', authenticateToken, (req, res) => {
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
        enabled: true,
        symbol: 'WDO',
        timeframe: '1m'
      }
    }
  });
});

app.post('/api/trading/config', authenticateToken, (req, res) => {
  console.log('⚙️ Config update:', req.body);
  res.json({
    success: true,
    message: 'Configuration updated successfully'
  });
});

// ML Engine endpoints
app.get('/api/trading/ml/predictions', authenticateToken, (req, res) => {
  res.json([
    {
      signal: Math.random() > 0.6 ? 'BUY' : Math.random() > 0.3 ? 'SELL' : 'HOLD',
      confidence: 0.75 + Math.random() * 0.25,
      reasoning: 'Strong upward momentum detected with volume confirmation and institutional buying interest',
      stopLoss: 4575.50,
      target: 4588.75,
      riskReward: 1.8,
      timestamp: new Date().toISOString(),
      patterns: [
        { name: 'Bullish Breakout', confidence: 0.87 },
        { name: 'Volume Surge', confidence: 0.82 },
        { name: 'Support Hold', confidence: 0.75 }
      ],
      marketRegime: 'trending',
      modelVersion: '1.0',
      featuresCount: 42,
      responseTime: Math.floor(Math.random() * 200) + 100
    }
  ]);
});

// Trading session endpoints
app.post('/api/trading/session/start', authenticateToken, (req, res) => {
  console.log('🎯 Starting trading session for:', req.user.email);
  
  res.json({
    success: true,
    sessionId: `session_${Date.now()}`,
    startTime: new Date().toISOString(),
    message: 'Trading session started successfully'
  });
});

app.post('/api/trading/session/end', authenticateToken, (req, res) => {
  console.log('🏁 Ending trading session for:', req.user.email);
  
  res.json({
    success: true,
    endTime: new Date().toISOString(),
    message: 'Trading session ended successfully'
  });
});

app.get('/api/trading/session/status', authenticateToken, (req, res) => {
  res.json({
    active: true,
    sessionId: 'demo_session_123',
    startTime: new Date().toISOString(),
    duration: 3600000,
    trades: Math.floor(Math.random() * 10),
    pnl: (Math.random() - 0.5) * 100
  });
});

// Trading operations
app.get('/api/trading/orders', authenticateToken, (req, res) => {
  res.json([
    {
      id: 'order_1',
      symbol: 'WDO',
      side: 'BUY',
      quantity: 1,
      price: 4580.25,
      status: 'FILLED',
      timestamp: new Date().toISOString()
    }
  ]);
});

app.get('/api/trading/positions', authenticateToken, (req, res) => {
  res.json([
    {
      id: 'pos_1',
      symbol: 'WDO',
      side: 'LONG',
      quantity: 1,
      entryPrice: 4575.50,
      currentPrice: 4580.25,
      pnl: 4.75,
      timestamp: new Date().toISOString()
    }
  ]);
});

app.post('/api/trading/orders', authenticateToken, (req, res) => {
  console.log('💰 Order placement request:', req.body, 'User:', req.user.email);
  
  res.json({
    success: true,
    orderId: `order_${Date.now()}`,
    status: 'PENDING',
    message: 'Order placed successfully'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  console.log('❌ Route not found:', req.method, req.path);
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Tape Vision AI Trading Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Login endpoint: http://localhost:${PORT}/api/auth/login`);
  console.log(`⚡ Trading status: http://localhost:${PORT}/api/trading/status`);
  console.log('');
  console.log('📝 Demo Credentials:');
  console.log('   📧 Email: demo@aitrading.com');
  console.log('   🔑 Password: demo2025');
  console.log('');
  console.log('🎯 Ready for trading operations with JWT authentication!');
});

module.exports = app;