// MongoDB Initialization Script for Tape Vision AI Trading System

// Switch to the tape-vision-ai database
db = db.getSiblingDB('tape-vision-ai');

// Create collections with proper indexes
db.createCollection('trades');
db.createCollection('sessions');
db.createCollection('market_data');
db.createCollection('risk_alerts');
db.createCollection('trading_logs');

// Create indexes for better performance
db.trades.createIndex({ "timestamp": 1 });
db.trades.createIndex({ "sessionId": 1 });
db.trades.createIndex({ "symbol": 1, "timestamp": 1 });

db.sessions.createIndex({ "startTime": 1 });
db.sessions.createIndex({ "date": 1 });

db.market_data.createIndex({ "timestamp": 1 });
db.market_data.createIndex({ "symbol": 1, "timestamp": 1 });

db.risk_alerts.createIndex({ "timestamp": 1 });
db.risk_alerts.createIndex({ "severity": 1 });

db.trading_logs.createIndex({ "timestamp": 1 });
db.trading_logs.createIndex({ "action": 1 });

// Create a user for the application
db.createUser({
  user: "trading_app",
  pwd: "trading_secure_2024",
  roles: [
    {
      role: "readWrite",
      db: "tape-vision-ai"
    }
  ]
});

print('Database initialized successfully for Tape Vision AI Trading System');