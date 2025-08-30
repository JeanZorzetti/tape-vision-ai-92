/**
 * SERVIDOR MÍNIMO APENAS COM AUTENTICAÇÃO
 * Para resolver problemas de deployment no Easypanel
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

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    message: 'MINIMAL AUTH SERVER WORKING!',
    version: 'minimal-auth-1.0'
  });
});

// TODAS AS ROTAS DE AUTENTICAÇÃO
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('🔐 Login attempt:', { email });
  
  const user = users.find(u => u.email === email && u.password === password);
  
  if (!user) {
    console.log('❌ Invalid credentials for:', email);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }
  
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

// BÁSICAS PARA TRADING (minimais)
app.get('/api/trading/status', authenticateToken, (req, res) => {
  res.json({
    aiStatus: {
      confidence: 85,
      status: 'active',
      lastAnalysis: new Date().toISOString()
    },
    marketData: {
      price: 4580.25,
      timestamp: Date.now()
    }
  });
});

app.get('/api/trading/ml/predictions', authenticateToken, (req, res) => {
  res.json([{
    signal: 'BUY',
    confidence: 0.85,
    reasoning: 'Strong bullish momentum detected with high volume confirmation',
    stopLoss: 4575.50,
    target: 4585.75,
    riskReward: 2.1,
    timestamp: new Date().toISOString(),
    responseTime: 145,
    modelVersion: '1.2.1',
    featuresCount: 47,
    patterns: [
      { name: 'Breakout Pattern', confidence: 0.85 },
      { name: 'Volume Surge', confidence: 0.92 },
      { name: 'Support Hold', confidence: 0.78 }
    ],
    marketRegime: 'trending'
  }]);
});

// Catch all
app.use((req, res) => {
  res.status(404).json({
    error: 'Route not found',
    route: `${req.method} ${req.path}`,
    server: 'minimal-auth-server'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MINIMAL AUTH SERVER running on port ${PORT}`);
  console.log(`✅ Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Login: http://localhost:${PORT}/api/auth/login`);
  console.log('🎯 TODAS as rotas de autenticação disponíveis!');
});

module.exports = app;