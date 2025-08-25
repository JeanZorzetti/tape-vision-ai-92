# Tape Vision AI - Configuration Guide

## Overview

The Tape Vision AI trading system uses a hierarchical configuration system that allows for flexible deployment across different environments. This guide covers all configuration options, from basic setup to advanced trading parameters.

## Configuration Hierarchy

The system loads configuration in the following order (later values override earlier ones):

1. **Default Configuration** (`config/default.json`)
2. **Environment Configuration** (`config/{NODE_ENV}.json`)
3. **Local Configuration** (`config/local.json`) - Not tracked in git
4. **Environment Variables** (`.env` file and system variables)
5. **Command Line Arguments**

---

## Environment Variables

### Core Application Settings

```env
# Application Environment
NODE_ENV=production                    # development | production | test
PORT=3001                             # API server port
WS_PORT=3002                          # WebSocket server port
LOG_LEVEL=info                        # error | warn | info | debug

# Frontend Configuration
FRONTEND_URL=http://localhost:5173     # Frontend URL for CORS
CORS_ORIGIN=*                         # CORS allowed origins

# API Configuration
API_VERSION=v1                        # API version prefix
REQUEST_TIMEOUT=30000                 # Request timeout in milliseconds
RATE_LIMIT_WINDOW=900000              # Rate limit window (15 minutes)
RATE_LIMIT_MAX=100                    # Max requests per window
```

### Database Configuration

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/tape-vision-ai
MONGODB_USERNAME=admin
MONGODB_PASSWORD=secure-password
MONGODB_AUTH_DB=admin
MONGODB_REPLICA_SET=rs0
MONGODB_SSL=false
MONGODB_POOL_SIZE=10
MONGODB_TIMEOUT=30000

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secure-redis-password
REDIS_DB=0
REDIS_CLUSTER=false
REDIS_TIMEOUT=5000
REDIS_RETRY_ATTEMPTS=3
```

### Trading Configuration

```env
# Trading Symbol and Market
TRADING_SYMBOL=WDO                    # Primary trading symbol
TRADING_TIMEFRAME=60000               # Analysis timeframe (1 minute)
TRADING_ENABLED=false                 # Enable/disable live trading
AUTO_START_ENGINE=false               # Auto-start engine on startup

# Risk Management
MAX_DAILY_LOSS=500                    # Maximum daily loss in points
MAX_POSITION_SIZE=2                   # Maximum position size
MAX_DRAWDOWN=1000                     # Maximum drawdown limit
CONSECUTIVE_STOP_LIMIT=3              # Max consecutive stop losses
STOP_LOSS_POINTS=1.5                  # Default stop loss in points
TAKE_PROFIT_POINTS=2.0                # Default take profit in points
MINIMUM_CONFIDENCE=90.0               # Minimum confidence for entries

# Pattern Recognition
ABSORPTION_THRESHOLD=0.7              # Absorption pattern threshold
VOLUME_CLUSTER_DISTANCE=5             # Volume cluster grouping distance
AGGRESSION_THRESHOLD=0.6              # Order aggression threshold
```

### Nelogica Integration

```env
# Nelogica API Configuration
NELOGICA_API_URL=https://api.nelogica.com.br
NELOGICA_USERNAME=your_username
NELOGICA_PASSWORD=your_password
NELOGICA_ENV=demo                     # demo | production
NELOGICA_DLL_PATH=/path/to/nelogica.dll
NELOGICA_TIMEOUT=30000
NELOGICA_AUTO_RECONNECT=true
NELOGICA_HEARTBEAT_INTERVAL=30000
```

### Security Configuration

```env
# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
API_KEY=your-api-key-here

# SSL/TLS
SSL_ENABLED=false
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/private.key
SSL_CA_PATH=/path/to/ssl/ca.pem

# Security Headers
HELMET_ENABLED=true
CORS_CREDENTIALS=true
```

### Monitoring and Logging

```env
# Logging Configuration
LOG_FORMAT=json                       # json | simple | combined
LOG_FILE_ENABLED=true
LOG_FILE_PATH=logs/trading.log
LOG_FILE_MAX_SIZE=10MB
LOG_FILE_MAX_FILES=5
LOG_ERROR_FILE=logs/error.log

# Monitoring
METRICS_ENABLED=true
PROMETHEUS_PORT=9090
HEALTH_CHECK_INTERVAL=30000
PERFORMANCE_MONITORING=true
```

---

## Configuration Files

### Default Configuration (`config/default.json`)

```json
{
  "server": {
    "port": 3001,
    "wsPort": 3002,
    "timeout": 30000,
    "cors": {
      "origin": ["http://localhost:3000", "http://localhost:5173"],
      "credentials": true
    }
  },
  "database": {
    "mongodb": {
      "uri": "mongodb://localhost:27017/tape-vision-ai",
      "options": {
        "useNewUrlParser": true,
        "useUnifiedTopology": true,
        "maxPoolSize": 10,
        "serverSelectionTimeoutMS": 30000,
        "socketTimeoutMS": 45000,
        "family": 4
      }
    },
    "redis": {
      "host": "localhost",
      "port": 6379,
      "db": 0,
      "retryAttempts": 3,
      "retryDelayOnFailover": 100,
      "enableOfflineQueue": false,
      "maxRetriesPerRequest": 3,
      "lazyConnect": true
    }
  },
  "nelogica": {
    "apiUrl": "https://api.nelogica.com.br",
    "environment": "demo",
    "timeout": 30000,
    "autoReconnect": true,
    "heartbeatInterval": 30000,
    "maxReconnectAttempts": 10,
    "reconnectDelay": 5000
  },
  "trading": {
    "enabled": false,
    "autoStart": false,
    "symbol": "WDO",
    "timeframe": 60000,
    "riskParameters": {
      "maxDailyLoss": 500,
      "maxPositionSize": 2,
      "stopLossPoints": 1.5,
      "takeProfitPoints": 2.0,
      "maxDrawdown": 1000,
      "consecutiveStopLimit": 3,
      "minimumConfidence": 90.0,
      "riskPerTrade": 0.02,
      "maxTradingHours": 8
    },
    "patternSettings": {
      "absorptionThreshold": 0.7,
      "volumeClusterDistance": 5,
      "aggressionThreshold": 0.6,
      "falseOrderDetection": true,
      "liquidityAnalysis": true,
      "patternRecognition": true
    },
    "analysisSettings": {
      "confidenceThreshold": 90.0,
      "patternWeight": 0.3,
      "volumeWeight": 0.3,
      "priceActionWeight": 0.4,
      "minimumVolume": 500,
      "maxSpread": 2.0
    },
    "timeFilters": {
      "allowedHours": ["09:00-11:30", "14:00-17:30"],
      "noTradingZones": [
        {
          "start": "12:00",
          "end": "13:00",
          "reason": "Lunch break"
        },
        {
          "start": "17:30",
          "end": "18:00",
          "reason": "Close auction"
        }
      ]
    }
  },
  "logging": {
    "level": "info",
    "format": "json",
    "file": {
      "enabled": true,
      "filename": "logs/trading.log",
      "maxsize": 10485760,
      "maxFiles": 5
    },
    "console": {
      "enabled": true,
      "colorize": true
    },
    "error": {
      "filename": "logs/error.log",
      "level": "error"
    }
  },
  "security": {
    "jwt": {
      "expiresIn": "24h"
    },
    "rateLimit": {
      "windowMs": 900000,
      "max": 100
    },
    "helmet": {
      "contentSecurityPolicy": false,
      "crossOriginEmbedderPolicy": false
    }
  },
  "monitoring": {
    "enabled": true,
    "metricsInterval": 60000,
    "healthCheck": {
      "enabled": true,
      "interval": 30000
    },
    "performance": {
      "enabled": true,
      "thresholds": {
        "latency": 10,
        "memory": 512,
        "cpu": 80
      }
    }
  }
}
```

### Development Configuration (`config/development.json`)

```json
{
  "server": {
    "port": 3001,
    "wsPort": 3002
  },
  "database": {
    "mongodb": {
      "uri": "mongodb://localhost:27017/tape-vision-ai-dev"
    }
  },
  "trading": {
    "enabled": false,
    "riskParameters": {
      "maxDailyLoss": 100,
      "maxPositionSize": 1,
      "stopLossPoints": 1.0
    }
  },
  "logging": {
    "level": "debug",
    "console": {
      "enabled": true,
      "colorize": true
    }
  },
  "monitoring": {
    "enabled": true,
    "metricsInterval": 30000
  }
}
```

### Production Configuration (`config/production.json`)

```json
{
  "server": {
    "port": 3001,
    "wsPort": 3002,
    "ssl": {
      "enabled": true
    }
  },
  "database": {
    "mongodb": {
      "options": {
        "ssl": true,
        "replicaSet": "rs0"
      }
    },
    "redis": {
      "cluster": false,
      "tls": {}
    }
  },
  "nelogica": {
    "environment": "production"
  },
  "trading": {
    "enabled": true,
    "autoStart": false
  },
  "logging": {
    "level": "info",
    "console": {
      "enabled": false
    },
    "file": {
      "enabled": true,
      "maxsize": 52428800,
      "maxFiles": 10
    }
  },
  "security": {
    "rateLimit": {
      "windowMs": 900000,
      "max": 100
    }
  },
  "monitoring": {
    "enabled": true,
    "metricsInterval": 60000,
    "alerts": {
      "enabled": true,
      "email": true,
      "webhook": true
    }
  }
}
```

### Test Configuration (`config/test.json`)

```json
{
  "database": {
    "mongodb": {
      "uri": "mongodb://localhost:27017/tape-vision-ai-test"
    },
    "redis": {
      "db": 15
    }
  },
  "trading": {
    "enabled": false
  },
  "logging": {
    "level": "error",
    "console": {
      "enabled": false
    },
    "file": {
      "enabled": false
    }
  },
  "monitoring": {
    "enabled": false
  }
}
```

---

## Trading Parameters Configuration

### Risk Management Parameters

```json
{
  "riskParameters": {
    "maxDailyLoss": 500,              // Maximum daily loss in points
    "maxPositionSize": 2,             // Maximum position size (contracts)
    "stopLossPoints": 1.5,            // Default stop loss distance
    "takeProfitPoints": 2.0,          // Default take profit distance
    "maxDrawdown": 1000,              // Maximum account drawdown
    "consecutiveStopLimit": 3,         // Max consecutive stop losses
    "minimumConfidence": 90.0,        // Minimum AI confidence for entry
    "riskPerTrade": 0.02,             // Risk percentage per trade
    "maxTradingHours": 8,             // Maximum trading hours per day
    "cooldownPeriod": 300,            // Cooldown after stop loss (seconds)
    "emergencyStopLoss": 750,         // Emergency stop loss threshold
    "positionTimeout": 3600           // Maximum position holding time
  }
}
```

### Pattern Recognition Settings

```json
{
  "patternSettings": {
    "absorptionThreshold": 0.7,       // Threshold for absorption patterns
    "volumeClusterDistance": 5,       // Price distance for volume clustering
    "aggressionThreshold": 0.6,       // Threshold for aggression detection
    "falseOrderDetection": true,      // Enable false order detection
    "liquidityAnalysis": true,        // Enable liquidity analysis
    "patternRecognition": true,       // Enable pattern recognition
    "minimumVolumeForPattern": 1000,  // Minimum volume for pattern validation
    "patternTimeout": 300,            // Pattern validity timeout (seconds)
    "confluenceRequired": 2           // Minimum confluence factors
  }
}
```

### Analysis Settings

```json
{
  "analysisSettings": {
    "confidenceThreshold": 90.0,      // Overall confidence threshold
    "patternWeight": 0.3,             // Weight of pattern analysis
    "volumeWeight": 0.3,              // Weight of volume analysis
    "priceActionWeight": 0.4,         // Weight of price action analysis
    "minimumVolume": 500,             // Minimum volume for analysis
    "maxSpread": 2.0,                 // Maximum spread tolerance
    "volatilityRange": [0.5, 3.0],    // Acceptable volatility range
    "liquidityThreshold": 10000,      // Minimum liquidity requirement
    "timeframeWeights": {             // Timeframe analysis weights
      "1m": 0.4,
      "5m": 0.3,
      "15m": 0.3
    }
  }
}
```

### Time-Based Filters

```json
{
  "timeFilters": {
    "enabled": true,
    "timezone": "America/Sao_Paulo",
    "allowedHours": ["09:00-11:30", "14:00-17:30"],
    "noTradingZones": [
      {
        "start": "12:00",
        "end": "13:00",
        "reason": "Lunch break",
        "enabled": true
      },
      {
        "start": "17:30",
        "end": "18:00",
        "reason": "Close auction",
        "enabled": true
      }
    ],
    "weekendTradingEnabled": false,
    "holidayTradingEnabled": false,
    "maxSessionDuration": 28800       // 8 hours in seconds
  }
}
```

---

## Symbol Configuration

### Symbol Settings (`config/trading.json`)

```json
{
  "symbols": {
    "WDO": {
      "name": "Mini Dólar",
      "type": "futures",
      "exchange": "B3",
      "tickSize": 0.5,                // Minimum price movement
      "tickValue": 0.1,               // Value per tick
      "contractSize": 10,             // Contract multiplier
      "marginRequirement": 1000,      // Margin requirement
      "tradingHours": {
        "start": "09:00",
        "end": "18:00",
        "timezone": "America/Sao_Paulo"
      },
      "sessions": [
        {
          "name": "regular",
          "start": "09:00",
          "end": "18:00",
          "enabled": true
        },
        {
          "name": "after_hours",
          "start": "18:05",
          "end": "08:55",
          "enabled": false
        }
      ],
      "riskParameters": {
        "maxPositionSize": 2,
        "stopLossPoints": 1.5,
        "takeProfitPoints": 2.0
      }
    },
    "WIN": {
      "name": "Mini Ibovespa",
      "type": "futures",
      "exchange": "B3",
      "tickSize": 5,
      "tickValue": 0.2,
      "contractSize": 1,
      "marginRequirement": 5000,
      "tradingHours": {
        "start": "09:00",
        "end": "18:00",
        "timezone": "America/Sao_Paulo"
      }
    }
  }
}
```

---

## Database Configuration

### MongoDB Configuration

```json
{
  "database": {
    "mongodb": {
      "uri": "mongodb://localhost:27017/tape-vision-ai",
      "options": {
        "useNewUrlParser": true,
        "useUnifiedTopology": true,
        "maxPoolSize": 10,             // Connection pool size
        "serverSelectionTimeoutMS": 30000,
        "socketTimeoutMS": 45000,
        "connectTimeoutMS": 30000,
        "maxIdleTimeMS": 30000,
        "heartbeatFrequencyMS": 10000,
        "retryWrites": true,
        "w": "majority",
        "journal": true
      },
      "collections": {
        "trades": {
          "indexes": [
            { "timestamp": -1 },
            { "symbol": 1, "timestamp": -1 },
            { "sessionId": 1 }
          ]
        },
        "market_data": {
          "indexes": [
            { "timestamp": -1 },
            { "symbol": 1, "timestamp": -1 }
          ],
          "ttl": {
            "field": "timestamp",
            "expireAfterSeconds": 2592000  // 30 days
          }
        },
        "patterns": {
          "indexes": [
            { "timestamp": -1 },
            { "confidence": -1 },
            { "name": 1, "timestamp": -1 }
          ]
        }
      }
    }
  }
}
```

### Redis Configuration

```json
{
  "database": {
    "redis": {
      "host": "localhost",
      "port": 6379,
      "password": "secure-password",
      "db": 0,
      "family": 4,
      "keepAlive": true,
      "retryAttempts": 3,
      "retryDelayOnFailover": 100,
      "enableOfflineQueue": false,
      "maxRetriesPerRequest": 3,
      "lazyConnect": true,
      "keyPrefix": "tape-vision:",
      "cache": {
        "ttl": {
          "market_data": 60,          // 1 minute
          "session_data": 3600,       // 1 hour
          "user_session": 86400       // 24 hours
        }
      }
    }
  }
}
```

---

## Logging Configuration

### Winston Logger Settings

```json
{
  "logging": {
    "level": "info",
    "format": "json",
    "timestamp": true,
    "meta": true,
    "transports": {
      "console": {
        "enabled": true,
        "level": "debug",
        "colorize": true,
        "prettyPrint": true
      },
      "file": {
        "enabled": true,
        "level": "info",
        "filename": "logs/trading.log",
        "maxsize": 10485760,          // 10MB
        "maxFiles": 5,
        "tailable": true,
        "zippedArchive": true
      },
      "error": {
        "enabled": true,
        "level": "error",
        "filename": "logs/error.log",
        "maxsize": 5242880,           // 5MB
        "maxFiles": 3
      },
      "audit": {
        "enabled": true,
        "filename": "logs/audit.log",
        "maxsize": 10485760,
        "maxFiles": 10
      }
    },
    "exceptions": {
      "handle": true,
      "filename": "logs/exceptions.log"
    },
    "rejections": {
      "handle": true,
      "filename": "logs/rejections.log"
    }
  }
}
```

### Log Rotation Configuration

```json
{
  "logging": {
    "rotation": {
      "enabled": true,
      "frequency": "daily",
      "maxFiles": "30d",
      "auditFile": "logs/.audit.json",
      "extension": ".log",
      "createSymlink": true,
      "symlinkName": "current.log"
    }
  }
}
```

---

## Performance Configuration

### Memory Management

```json
{
  "performance": {
    "memory": {
      "heapSize": "2048m",           // Node.js heap size
      "bufferSize": 1024,            // Buffer size for market data
      "cacheSize": 512,              // Cache size in MB
      "gcInterval": 60000,           // Garbage collection interval
      "optimization": {
        "strings": true,
        "objects": true,
        "arrays": true
      }
    },
    "processing": {
      "batchSize": 100,              // Batch processing size
      "maxConcurrency": 10,          // Max concurrent operations
      "timeout": 5000,               // Processing timeout
      "retries": 3                   // Max retry attempts
    }
  }
}
```

### Caching Configuration

```json
{
  "cache": {
    "strategies": {
      "market_data": {
        "type": "redis",
        "ttl": 60,                   // 1 minute
        "maxSize": 1000
      },
      "patterns": {
        "type": "memory",
        "ttl": 300,                  // 5 minutes
        "maxSize": 500
      },
      "analysis": {
        "type": "redis",
        "ttl": 180,                  // 3 minutes
        "maxSize": 200
      }
    }
  }
}
```

---

## Alert Configuration

### Alert Rules

```json
{
  "alerts": {
    "enabled": true,
    "channels": ["webhook", "email", "console"],
    "rules": [
      {
        "name": "highConfidenceSignal",
        "condition": "confidence > 95",
        "enabled": true,
        "priority": "high",
        "cooldown": 60
      },
      {
        "name": "unusualVolume",
        "condition": "volume > 10000",
        "enabled": true,
        "priority": "medium",
        "cooldown": 300
      },
      {
        "name": "riskAlert",
        "condition": "daily_loss > max_daily_loss * 0.8",
        "enabled": true,
        "priority": "critical",
        "cooldown": 0
      },
      {
        "name": "systemError",
        "condition": "error_rate > 5",
        "enabled": true,
        "priority": "critical",
        "cooldown": 0
      }
    ],
    "webhooks": [
      {
        "name": "slack",
        "url": "https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK",
        "enabled": true,
        "events": ["error", "trade", "signal"]
      }
    ]
  }
}
```

---

## Advanced Configuration

### Machine Learning Settings

```json
{
  "ml": {
    "enabled": true,
    "models": {
      "pattern_recognition": {
        "type": "neural_network",
        "layers": [64, 32, 16, 8],
        "activation": "relu",
        "optimizer": "adam",
        "learningRate": 0.001
      },
      "confidence_scoring": {
        "type": "ensemble",
        "models": ["random_forest", "gradient_boost"],
        "weights": [0.6, 0.4]
      }
    },
    "training": {
      "batchSize": 32,
      "epochs": 100,
      "validationSplit": 0.2,
      "earlyStoppingPatience": 10
    }
  }
}
```

### WebSocket Configuration

```json
{
  "websocket": {
    "port": 3002,
    "path": "/ws",
    "options": {
      "pingTimeout": 60000,
      "pingInterval": 25000,
      "upgradeTimeout": 10000,
      "maxHttpBufferSize": 1000000,
      "allowEIO3": true,
      "cors": {
        "origin": "*",
        "methods": ["GET", "POST"]
      }
    },
    "rooms": {
      "market_data": {
        "maxClients": 100,
        "rateLimiting": {
          "enabled": true,
          "maxMessages": 10,
          "window": 1000
        }
      }
    }
  }
}
```

---

## Configuration Validation

### Schema Validation

The system validates configuration using JSON Schema:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "trading": {
      "type": "object",
      "properties": {
        "riskParameters": {
          "type": "object",
          "properties": {
            "maxDailyLoss": {
              "type": "number",
              "minimum": 0,
              "maximum": 10000
            },
            "minimumConfidence": {
              "type": "number",
              "minimum": 0,
              "maximum": 100
            }
          },
          "required": ["maxDailyLoss", "minimumConfidence"]
        }
      }
    }
  }
}
```

### Configuration Testing

Test configuration with:

```bash
# Validate configuration
npm run config:validate

# Test configuration loading
npm run config:test

# Show effective configuration
npm run config:show
```

---

## Environment-Specific Examples

### Local Development

```env
NODE_ENV=development
PORT=3001
WS_PORT=3002
LOG_LEVEL=debug

MONGODB_URI=mongodb://localhost:27017/tape-vision-ai-dev
REDIS_HOST=localhost
REDIS_PORT=6379

TRADING_ENABLED=false
NELOGICA_ENV=demo
MAX_DAILY_LOSS=50
MINIMUM_CONFIDENCE=85.0
```

### Staging Environment

```env
NODE_ENV=staging
PORT=3001
WS_PORT=3002
LOG_LEVEL=info

MONGODB_URI=mongodb://staging-mongo:27017/tape-vision-ai-staging
REDIS_HOST=staging-redis
REDIS_PASSWORD=staging-redis-password

TRADING_ENABLED=false
NELOGICA_ENV=demo
MAX_DAILY_LOSS=200
SSL_ENABLED=true
```

### Production Environment

```env
NODE_ENV=production
PORT=3001
WS_PORT=3002
LOG_LEVEL=warn

MONGODB_URI=mongodb://prod-mongo-1:27017,prod-mongo-2:27017,prod-mongo-3:27017/tape-vision-ai?replicaSet=rs0
REDIS_HOST=prod-redis-cluster
REDIS_PASSWORD=super-secure-redis-password

TRADING_ENABLED=true
NELOGICA_ENV=production
NELOGICA_USERNAME=production_username
NELOGICA_PASSWORD=secure_production_password

MAX_DAILY_LOSS=500
MINIMUM_CONFIDENCE=92.0
SSL_ENABLED=true
MONITORING_ENABLED=true
```

---

## Configuration Best Practices

### Security Guidelines

1. **Never commit sensitive data** to version control
2. **Use strong passwords** for database connections
3. **Enable SSL/TLS** in production
4. **Rotate secrets regularly**
5. **Use environment-specific configurations**

### Performance Optimization

1. **Adjust pool sizes** based on expected load
2. **Configure appropriate timeouts**
3. **Enable caching** for frequently accessed data
4. **Optimize log levels** for production
5. **Monitor resource usage** and adjust accordingly

### Monitoring and Alerting

1. **Enable comprehensive logging** in production
2. **Configure meaningful alerts**
3. **Set appropriate thresholds** for risk management
4. **Monitor system performance** regularly
5. **Test alert mechanisms** periodically

---

This configuration guide provides comprehensive coverage of all configuration options available in the Tape Vision AI trading system. Proper configuration is crucial for optimal performance, security, and reliability of the trading system.