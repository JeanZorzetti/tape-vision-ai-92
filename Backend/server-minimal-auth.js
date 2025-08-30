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

// TRADING STATUS com estrutura completa para o frontend
app.get('/api/trading/status', authenticateToken, (req, res) => {
  const marketHours = new Date().getHours();
  const isMarketOpen = marketHours >= 9 && marketHours <= 17;
  
  res.json({
    aiStatus: {
      confidence: Math.floor(Math.random() * 30) + 70,
      status: isMarketOpen ? 'active' : 'standby',
      lastAnalysis: new Date().toISOString(),
      patternsDetected: [
        'Institutional Flow Detected',
        'Volume Profile Support'
      ],
      marketContext: isMarketOpen ? 
        'Real-time analysis active' : 
        'Market closed - analyzing data',
      entrySignals: Math.floor(Math.random() * 8) + 2,
      aggressionLevel: Math.random() > 0.6 ? 'high' : 'medium',
      hiddenLiquidity: Math.random() > 0.7,
      processingLatency: Math.floor(Math.random() * 50) + 25,
      memoryUsage: Math.floor(Math.random() * 200) + 400
    },
    marketData: {
      price: 4580.25 + (Math.random() - 0.5) * 15,
      priceChange: (Math.random() - 0.5) * 8,
      volume: Math.floor(Math.random() * 50000) + 25000,
      volatility: Math.random() * 3 + 1,
      spread: Math.random() * 1.5 + 0.5,
      sessionTime: new Date().toISOString(),
      marketPhase: isMarketOpen ? 'regular' : 'closed',
      liquidityLevel: Math.random() > 0.4 ? 'high' : 'medium',
      orderBookImbalance: (Math.random() - 0.5) * 80,
      timestamp: Date.now(),
      bid: 4579.75,
      ask: 4580.25,
      last: 4580.00,
      high: 4590.50,
      low: 4570.25,
      symbol: 'WDO'
    },
    systemHealth: {
      cpu: Math.floor(Math.random() * 40) + 30,
      memory: Math.floor(Math.random() * 30) + 50,
      disk: Math.floor(Math.random() * 20) + 70,
      network: Math.floor(Math.random() * 10) + 85,
      uptime: process.uptime(),
      timestamp: Date.now()
    }
  });
});

app.get('/api/trading/ml/predictions', authenticateToken, (req, res) => {
  // Formato SUPER COMPLETO para garantir compatibilidade total
  const recommendation = Math.random() > 0.6 ? 'ENTRAR' : Math.random() > 0.3 ? 'AGUARDAR' : 'SAIR';
  const certainty = Math.floor(Math.random() * 30) + 70;
  const signalValue = recommendation === 'ENTRAR' ? 'BUY' : recommendation === 'SAIR' ? 'SELL' : 'HOLD';
  
  // Criar arrays com defaults seguros para evitar undefined
  const baseVariables = [
    {
      name: "Volume Profile",
      value: Math.floor(Math.random() * 100),
      impact: "high",
      className: "positive"
    },
    {
      name: "Order Flow", 
      value: Math.floor(Math.random() * 100),
      impact: "medium",
      className: "neutral"
    },
    {
      name: "Institutional Flow",
      value: Math.floor(Math.random() * 100),
      impact: "high", 
      className: "positive"
    },
    {
      name: "Market Microstructure",
      value: Math.floor(Math.random() * 100),
      impact: "low",
      className: "negative"
    }
  ];
  
  // Garantir que NUNCA tenhamos undefined
  const safeVariables = baseVariables.map(v => ({
    ...v,
    className: v.className || 'neutral',
    impact: v.impact || 'medium',
    name: v.name || 'Unknown',
    value: v.value || 0
  }));
  
  const response = {
    // Formato novo esperado
    recommendation: recommendation,
    finalCertainty: certainty,
    entryReason: "Análise ML ativa",
    nextAction: `${recommendation.toLowerCase()} recomendada. Target: R$ 4590.00, Stop: R$ 4575.00`,
    componentScores: {
      buyAggression: Math.floor(Math.random() * 100),
      sellAggression: Math.floor(Math.random() * 50),
      liquidityAbsorption: Math.floor(Math.random() * 100),
      falseOrdersDetected: Math.floor(Math.random() * 30),
      flowMomentum: Math.floor(Math.random() * 100),
      institutionalActivity: Math.floor(Math.random() * 100),
      supportResistance: Math.floor(Math.random() * 100)
    },
    variablesAnalyzed: safeVariables,
    
    // Formato antigo para compatibilidade  
    signal: signalValue,
    confidence: certainty / 100,
    reasoning: 'Strong momentum detected with volume confirmation',
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
    responseTime: Math.floor(Math.random() * 200) + 100
  };
  
  res.json(response);
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