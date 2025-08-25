# Tape Vision AI - API Documentation

## Overview

The Tape Vision AI Trading Backend provides a comprehensive RESTful API for algorithmic trading operations with real-time WebSocket capabilities. The API supports market data streaming, trading operations, configuration management, and system monitoring.

## Base URL

```
Production: https://api.tapevision.ai
Development: http://localhost:3001
```

## Authentication

Currently, the API uses basic authentication. Future versions will implement JWT-based authentication.

**Headers:**
```http
Content-Type: application/json
X-Request-ID: your-request-id (optional)
```

## Response Format

All API responses follow this standard format:

```json
{
  "success": boolean,
  "data": object | array | null,
  "error": string | null,
  "timestamp": number,
  "requestId": string
}
```

## Rate Limiting

- **Development:** 1000 requests per 15 minutes per IP
- **Production:** 100 requests per 15 minutes per IP

Rate limit headers are included in all responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

---

## REST API Endpoints

### Health Check

#### GET /health

Returns system health status and basic metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "uptime": 3600.5,
    "memory": {
      "rss": 50331648,
      "heapTotal": 30408704,
      "heapUsed": 20971520,
      "external": 1024000
    },
    "engine": {
      "active": true,
      "dailyPnL": 150.5,
      "tradesCount": 5
    }
  },
  "error": null,
  "timestamp": 1642248600000,
  "requestId": "health_check_12345"
}
```

---

### Market Data

#### GET /api/trading/market-data

Get current real-time market data.

**Response:**
```json
{
  "success": true,
  "data": {
    "price": 5.125,
    "priceChange": 0.025,
    "volume": 15000,
    "volatility": 1.2,
    "spread": 0.5,
    "sessionTime": "14:30:15",
    "marketPhase": "open",
    "liquidityLevel": "high",
    "orderBookImbalance": 15.5,
    "timestamp": 1642248600000,
    "bid": 5.120,
    "ask": 5.125,
    "last": 5.123,
    "high": 5.150,
    "low": 5.100
  }
}
```

**Market Phase Values:**
- `pre-market`: Before market opens
- `open`: Regular trading session
- `close`: Market closing phase
- `after-hours`: After market closes

**Liquidity Level Values:**
- `low`: Limited liquidity
- `medium`: Normal liquidity
- `high`: High liquidity

---

### AI Status

#### GET /api/trading/ai-status

Get current AI system status and analysis metrics.

**Response:**
```json
{
  "success": true,
  "data": {
    "confidence": 85.5,
    "status": "active",
    "lastAnalysis": "14:30:15",
    "patternsDetected": [
      "Absorption Pattern (89.2%)",
      "Hidden Liquidity (92.1%)"
    ],
    "marketContext": "Mercado em alta (+0.025), volume elevado, volatilidade moderada, liquidez high.",
    "entrySignals": 3,
    "aggressionLevel": "medium",
    "hiddenLiquidity": true,
    "processingLatency": 2.5,
    "memoryUsage": 45
  }
}
```

**Status Values:**
- `active`: AI is running and analyzing
- `paused`: AI is paused
- `analyzing`: AI is processing data
- `error`: AI encountered an error

**Aggression Level Values:**
- `low`: Normal market activity
- `medium`: Moderate aggressive orders
- `high`: High aggressive order flow

---

### Decision Analysis

#### GET /api/trading/decision-analysis

Get the latest trading decision analysis from the AI engine.

**Response:**
```json
{
  "success": true,
  "data": {
    "entryReason": "Strong absorption pattern detected with high confidence buy aggression",
    "variablesAnalyzed": [
      {
        "name": "buyAggression",
        "weight": 0.3,
        "score": 89.2,
        "confidence": 95.1,
        "lastUpdate": 1642248590000
      },
      {
        "name": "liquidityAbsorption",
        "weight": 0.4,
        "score": 92.3,
        "confidence": 88.7,
        "lastUpdate": 1642248590000
      }
    ],
    "componentScores": {
      "buyAggression": 89.2,
      "sellAggression": 15.3,
      "liquidityAbsorption": 92.3,
      "falseOrdersDetected": 5.1,
      "flowMomentum": 78.9,
      "historicalPattern": 85.6
    },
    "finalCertainty": 87.8,
    "nextAction": "Monitor for entry confirmation",
    "recommendation": "ENTRAR",
    "riskLevel": 2.1,
    "expectedTarget": 2.0,
    "stopLoss": 1.5,
    "timeframe": 300
  }
}
```

**Recommendation Values:**
- `ENTRAR`: Enter position
- `AGUARDAR`: Wait for better opportunity
- `EVITAR`: Avoid trading

---

### Trading Log

#### GET /api/trading/log

Get paginated trading log entries.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 50, max: 100)
- `action` (optional): Filter by action type

**Example Request:**
```
GET /api/trading/log?page=1&limit=25&action=BUY
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "trade_1642248600_abc123",
        "timestamp": "14:30:00",
        "action": "BUY",
        "symbol": "WDO",
        "price": 5.125,
        "quantity": 2,
        "confidence": 89.2,
        "reason": "Strong absorption pattern detected",
        "pnl": 25.5,
        "status": "success",
        "orderId": "ORD_789456",
        "executionTime": 1642248605000,
        "slippage": 0.5
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 25,
    "totalPages": 6
  }
}
```

**Action Types:**
- `BUY`: Buy order executed
- `SELL`: Sell order executed
- `ANALYSIS`: Analysis performed
- `ALERT`: Alert generated
- `ERROR`: Error occurred

---

### Positions

#### GET /api/trading/positions

Get current open positions.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "pos_1642248600_def456",
      "symbol": "WDO",
      "side": "long",
      "size": 2,
      "entryPrice": 5.125,
      "currentPrice": 5.150,
      "pnl": 50.0,
      "unrealizedPnl": 50.0,
      "stopLoss": 5.110,
      "takeProfit": 5.145,
      "entryTime": 1642248600000,
      "duration": 300000
    }
  ]
}
```

**Side Values:**
- `long`: Long position
- `short`: Short position

---

### Configuration

#### GET /api/trading/config

Get current trading configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "symbol": "WDO",
    "timeframe": 60000,
    "riskParameters": {
      "maxDailyLoss": 500,
      "maxPositionSize": 2,
      "stopLossPoints": 1.5,
      "takeProfitPoints": 2.0,
      "maxDrawdown": 1000,
      "consecutiveStopLimit": 3,
      "minimumConfidence": 90.0
    },
    "patternSettings": {
      "absorptionThreshold": 0.7,
      "volumeClusterDistance": 5,
      "aggressionThreshold": 0.6
    },
    "analysisSettings": {
      "confidenceThreshold": 90.0,
      "patternWeight": 0.3,
      "volumeWeight": 0.3,
      "priceActionWeight": 0.4
    }
  }
}
```

#### PUT /api/trading/config

Update trading configuration.

**Request Body:**
```json
{
  "riskParameters": {
    "maxDailyLoss": 400,
    "stopLossPoints": 1.2
  },
  "analysisSettings": {
    "confidenceThreshold": 92.0
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    // Updated configuration object
  }
}
```

---

### Trading Operations

#### POST /api/trading/execute

Execute a manual trade.

**Request Body:**
```json
{
  "action": "BUY",
  "symbol": "WDO",
  "quantity": 1,
  "price": 5.125,
  "reason": "Manual override - strong setup detected"
}
```

**Validation Rules:**
- `action`: Must be "BUY" or "SELL"
- `symbol`: 2-10 characters
- `quantity`: Positive integer
- `price`: Optional positive number
- `reason`: 5-200 characters

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "trade_manual_123",
    "timestamp": "14:35:00",
    "action": "BUY",
    "symbol": "WDO",
    "price": 5.125,
    "quantity": 1,
    "reason": "Manual override - strong setup detected",
    "status": "success",
    "orderId": "ORD_MANUAL_456",
    "executionTime": 1642248900000,
    "slippage": 0.2
  }
}
```

#### POST /api/trading/close-position/:positionId

Close a specific position.

**Path Parameters:**
- `positionId`: Position identifier

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "close_pos_123",
    "timestamp": "14:40:00",
    "action": "SELL",
    "symbol": "WDO",
    "price": 5.140,
    "quantity": 2,
    "reason": "Position closed manually",
    "pnl": 30.0,
    "status": "success"
  }
}
```

---

### Engine Control

#### POST /api/trading/start

Start the trading engine.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Trading engine started successfully"
  }
}
```

#### POST /api/trading/stop

Stop the trading engine.

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Trading engine stopped successfully"
  }
}
```

#### POST /api/trading/emergency-stop

Trigger emergency stop (closes all positions and stops trading).

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Emergency stop executed successfully"
  }
}
```

---

### Session Statistics

#### GET /api/trading/session

Get current trading session statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session_20240115",
    "startTime": 1642244400000,
    "endTime": null,
    "totalTrades": 8,
    "winningTrades": 5,
    "losingTrades": 3,
    "totalPnL": 125.5,
    "maxDrawdown": -45.0,
    "sharpeRatio": 1.85,
    "winRate": 62.5,
    "avgWin": 35.2,
    "avgLoss": -18.7,
    "profitFactor": 1.88
  }
}
```

---

### Chart Data

#### GET /api/trading/chart-data

Get historical chart data for visualization.

**Query Parameters:**
- `timeframe` (optional): Timeframe in milliseconds (default: 60000)
- `limit` (optional): Number of data points (default: 100, max: 1000)

**Example Request:**
```
GET /api/trading/chart-data?timeframe=60000&limit=200
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "timestamp": 1642244400000,
      "value": 5.120,
      "volume": 1500,
      "buyVolume": 800,
      "sellVolume": 700,
      "orderFlow": 15.3
    }
  ]
}
```

---

## WebSocket API

Connect to real-time data streams via WebSocket at `ws://localhost:3002` (or `wss://api.tapevision.ai/ws` in production).

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onopen = function(event) {
    console.log('Connected to Tape Vision AI WebSocket');
    
    // Subscribe to channels
    ws.send(JSON.stringify({
        type: 'subscribe',
        channels: ['market_data', 'ai_status', 'signals', 'trades']
    }));
};
```

### Message Format

All WebSocket messages follow this format:

```json
{
  "type": "message_type",
  "payload": {
    // Message-specific data
  },
  "timestamp": 1642248600000,
  "sequence": 12345
}
```

### Channel Types

#### market_data
Real-time market data updates.

```json
{
  "type": "market_data",
  "payload": {
    "price": 5.125,
    "priceChange": 0.025,
    "volume": 15000,
    "volatility": 1.2,
    "spread": 0.5,
    "timestamp": 1642248600000
  },
  "timestamp": 1642248600000,
  "sequence": 12345
}
```

#### order_book
Order book updates (Level 2 data).

```json
{
  "type": "order_book",
  "payload": {
    "bids": [
      {"price": 5.120, "volume": 1000, "orders": 5},
      {"price": 5.115, "volume": 1500, "orders": 8}
    ],
    "asks": [
      {"price": 5.125, "volume": 800, "orders": 4},
      {"price": 5.130, "volume": 1200, "orders": 6}
    ],
    "timestamp": 1642248600000,
    "spread": 0.5,
    "depth": 10
  },
  "timestamp": 1642248600000,
  "sequence": 12346
}
```

#### tape
Time and sales data (tape reading).

```json
{
  "type": "tape",
  "payload": [
    {
      "timestamp": 1642248600000,
      "price": 5.125,
      "volume": 100,
      "aggressor": "buyer",
      "orderType": "market",
      "isLarge": false,
      "isDominant": true,
      "absorption": false
    }
  ],
  "timestamp": 1642248600000,
  "sequence": 12347
}
```

#### signal
Trading signals generated by the AI.

```json
{
  "type": "signal",
  "payload": {
    "signal": "BUY",
    "confidence": 89.2,
    "analysis": {
      "entryReason": "Strong absorption pattern detected",
      "recommendation": "ENTRAR",
      "expectedTarget": 2.0,
      "stopLoss": 1.5,
      "finalCertainty": 89.2
    }
  },
  "timestamp": 1642248600000,
  "sequence": 12348
}
```

#### ai_status
AI system status updates.

```json
{
  "type": "ai_status",
  "payload": {
    "status": {
      "confidence": 89.2,
      "status": "active",
      "patternsDetected": ["Absorption Pattern (89.2%)"],
      "aggressionLevel": "medium"
    },
    "health": {
      "cpu": 45.2,
      "memory": 512,
      "latency": 2.5,
      "uptime": 3600,
      "errors": 0,
      "warnings": 1
    }
  },
  "timestamp": 1642248600000,
  "sequence": 12349
}
```

#### trades
Trade execution notifications.

```json
{
  "type": "trade",
  "payload": {
    "id": "trade_123",
    "action": "BUY",
    "symbol": "WDO",
    "price": 5.125,
    "quantity": 2,
    "status": "success",
    "pnl": 0,
    "timestamp": "14:30:00"
  },
  "timestamp": 1642248600000,
  "sequence": 12350
}
```

#### notifications
System notifications and alerts.

```json
{
  "type": "notification",
  "payload": {
    "id": "notif_123",
    "type": "warning",
    "title": "Risk Alert",
    "message": "Daily loss approaching limit",
    "priority": "high",
    "action": {
      "label": "Review Settings",
      "action": "open_config"
    }
  },
  "timestamp": 1642248600000,
  "sequence": 12351
}
```

### Subscription Management

#### Subscribe to Channels
```json
{
  "type": "subscribe",
  "channels": ["market_data", "ai_status", "signals"]
}
```

#### Unsubscribe from Channels
```json
{
  "type": "unsubscribe",
  "channels": ["tape"]
}
```

#### Heartbeat
The server sends periodic heartbeat messages:
```json
{
  "type": "heartbeat",
  "timestamp": 1642248600000
}
```

Respond with:
```json
{
  "type": "pong",
  "timestamp": 1642248600000
}
```

---

## Error Codes

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request (validation error)
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error
- `503` - Service Unavailable

### Custom Error Codes
- `VALIDATION_ERROR` - Request validation failed
- `TRADING_ERROR` - Trading operation failed
- `NELOGICA_ERROR` - Nelogica API error
- `RISK_ERROR` - Risk management violation
- `ENGINE_ERROR` - Trading engine error
- `DATABASE_ERROR` - Database operation failed

### Error Response Format
```json
{
  "success": false,
  "error": "Detailed error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "validation details"
  },
  "timestamp": 1642248600000,
  "requestId": "req_12345"
}
```

---

## SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');
const WebSocket = require('ws');

class TapeVisionAPI {
  constructor(baseURL = 'http://localhost:3001') {
    this.baseURL = baseURL;
    this.ws = null;
  }

  async getMarketData() {
    const response = await axios.get(`${this.baseURL}/api/trading/market-data`);
    return response.data;
  }

  async executeTradeAsyncExecuteTrade(tradeData) {
    const response = await axios.post(`${this.baseURL}/api/trading/execute`, tradeData);
    return response.data;
  }

  connectWebSocket() {
    this.ws = new WebSocket(`ws://localhost:3002`);
    
    this.ws.on('open', () => {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        channels: ['market_data', 'signals']
      }));
    });

    this.ws.on('message', (data) => {
      const message = JSON.parse(data);
      this.handleMessage(message);
    });
  }

  handleMessage(message) {
    switch (message.type) {
      case 'market_data':
        console.log('Market data:', message.payload);
        break;
      case 'signal':
        console.log('Trading signal:', message.payload);
        break;
    }
  }
}

// Usage
const api = new TapeVisionAPI();
api.connectWebSocket();
```

### Python
```python
import requests
import websocket
import json

class TapeVisionAPI:
    def __init__(self, base_url='http://localhost:3001'):
        self.base_url = base_url
        
    def get_market_data(self):
        response = requests.get(f'{self.base_url}/api/trading/market-data')
        return response.json()
    
    def execute_trade(self, trade_data):
        response = requests.post(f'{self.base_url}/api/trading/execute', json=trade_data)
        return response.json()
    
    def on_message(self, ws, message):
        data = json.loads(message)
        print(f'Received: {data["type"]} - {data["payload"]}')
    
    def connect_websocket(self):
        ws = websocket.WebSocketApp('ws://localhost:3002',
                                  on_message=self.on_message)
        ws.run_forever()

# Usage
api = TapeVisionAPI()
market_data = api.get_market_data()
print(market_data)
```

---

## Testing

### Health Check Test
```bash
curl -X GET http://localhost:3001/health
```

### Authentication Test
```bash
curl -X GET http://localhost:3001/api/trading/market-data \
  -H "Content-Type: application/json"
```

### WebSocket Test
```javascript
// Use wscat for command line testing
npm install -g wscat
wscat -c ws://localhost:3002
```

---

This API documentation covers all available endpoints and WebSocket channels for the Tape Vision AI Trading Backend. For additional support or questions, please refer to the other documentation files or contact the development team.