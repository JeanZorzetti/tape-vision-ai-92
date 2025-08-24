# Tape Vision AI - Trading Backend

Advanced algorithmic trading backend with sophisticated tape reading and order flow analysis capabilities.

## Features

### Core Trading Engine
- **Advanced Tape Reading**: Real-time analysis of time and sales data
- **Order Flow Analysis**: Detection of aggressive orders, hidden liquidity, and absorption patterns
- **Pattern Recognition**: ML-powered pattern matching with historical validation
- **Risk Management**: Comprehensive risk controls with circuit breakers
- **Real-time Data**: Sub-10ms latency processing with WebSocket streaming

### Trading Capabilities
- **Mini Dollar Futures (WDO)**: Optimized for Brazilian futures market
- **Pure Tape Reading**: No traditional technical indicators
- **Confidence-Based Execution**: Only trades with 90%+ confidence
- **Adaptive Stop Losses**: Dynamic risk management based on volatility
- **Target**: 2 points per trade with 1-1.5 point stops

### Architecture
- **High Performance**: Built with TypeScript and async/await patterns
- **Scalable**: Microservices architecture with WebSocket communication
- **Reliable**: Comprehensive error handling and automatic recovery
- **Observable**: Detailed logging and performance monitoring

## Technology Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose
- **WebSocket**: Socket.IO for real-time communication
- **HTTP**: Express.js with comprehensive middleware
- **Logging**: Winston with daily rotation
- **Testing**: Jest with comprehensive coverage

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database setup**:
   ```bash
   # Ensure MongoDB is running
   npm run db:migrate
   ```

## Configuration

### Environment Variables

```bash
# Core Configuration
NODE_ENV=production
PORT=3001
MONGODB_URL=mongodb://localhost:27017/tape-vision-trading

# Nelogica API
NELOGICA_API_URL=https://api.nelogica.com.br
NELOGICA_USERNAME=your_username
NELOGICA_PASSWORD=your_password
NELOGICA_ENV=production

# Trading Parameters
TRADING_SYMBOL=WDO
MAX_DAILY_LOSS=500
MAX_POSITION_SIZE=5
MINIMUM_CONFIDENCE=90
```

### Trading Configuration

The system uses a comprehensive configuration system:

```typescript
{
  symbol: "WDO",
  timeframe: 60000,
  riskParameters: {
    maxDailyLoss: 500,
    maxPositionSize: 5,
    stopLossPoints: 15,
    takeProfitPoints: 30,
    minimumConfidence: 90
  },
  analysisSettings: {
    confidenceThreshold: 90,
    patternWeight: 0.3,
    volumeWeight: 0.3,
    priceActionWeight: 0.4
  }
}
```

## Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm run build
npm run start
```

### Testing
```bash
npm test
npm run test:coverage
```

### Monitoring
```bash
npm run logs
npm run monitor
```

## API Endpoints

### Trading Operations
- `GET /api/trading/market-data` - Current market data
- `GET /api/trading/ai-status` - AI system status
- `GET /api/trading/decision-analysis` - Latest decision analysis
- `GET /api/trading/log` - Trading log with pagination
- `GET /api/trading/positions` - Current positions

### Control Operations
- `POST /api/trading/start` - Start trading engine
- `POST /api/trading/stop` - Stop trading engine
- `POST /api/trading/emergency-stop` - Emergency stop
- `PUT /api/trading/config` - Update configuration

### WebSocket Events
- `market_data` - Real-time market data
- `ai_status` - AI system updates
- `signals` - Trading signals
- `trades` - Trade executions
- `notifications` - System alerts

## Architecture Components

### TradingEngine
Central orchestrator managing all trading operations:
- Market data processing
- Pattern detection
- Signal generation
- Risk validation
- Trade execution

### TapeReader
Advanced tape reading algorithms:
- Volume cluster analysis
- Order flow detection
- Absorption pattern recognition
- False order identification

### RiskManager
Comprehensive risk management:
- Daily loss limits
- Position size controls
- Drawdown monitoring
- Circuit breakers
- Volatility adjustments

### WebSocketManager
Real-time communication hub:
- Client connection management
- Data streaming
- Rate limiting
- Performance monitoring

## Performance Characteristics

- **Latency**: Sub-10ms market data processing
- **Throughput**: 1000+ messages per second
- **Memory**: Optimized for minimal footprint
- **CPU**: Efficient algorithms with O(log n) complexity
- **Storage**: Time-series optimized data structures

## Risk Management

The system implements multiple layers of risk protection:

1. **Pre-Trade Risk**: Position sizing and confidence validation
2. **In-Trade Risk**: Dynamic stop losses and position monitoring
3. **Post-Trade Risk**: Performance analysis and adjustment
4. **System Risk**: Circuit breakers and emergency stops

## Monitoring and Logging

Comprehensive observability:
- **Structured Logging**: JSON formatted logs with correlation IDs
- **Performance Metrics**: Latency, throughput, and resource usage
- **Health Checks**: System health monitoring endpoints
- **Alerting**: Real-time notifications for critical events

## Error Handling

Robust error handling strategy:
- **Graceful Degradation**: System continues operating with reduced functionality
- **Automatic Recovery**: Reconnection and state restoration
- **Error Classification**: Different handling for different error types
- **Circuit Breakers**: Protection against cascading failures

## Security

Security considerations:
- **API Authentication**: JWT-based authentication
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive input sanitization
- **Audit Logging**: All operations are logged for audit

## Development

### Project Structure
```
src/
├── core/           # Core trading logic
│   ├── trading/    # Trading engine and tape reader
│   ├── risk/       # Risk management
│   ├── analysis/   # Signal generation
│   └── patterns/   # Pattern recognition
├── services/       # External service integrations
├── database/       # Database models and operations
├── websocket/      # Real-time communication
├── routes/         # HTTP API routes
├── middleware/     # Express middleware
└── utils/          # Utility functions
```

### Code Style
- **TypeScript**: Strict typing with comprehensive interfaces
- **ESLint**: Code linting with trading-specific rules
- **Prettier**: Consistent code formatting
- **Comments**: Comprehensive JSDoc documentation

### Testing Strategy
- **Unit Tests**: Core algorithms and business logic
- **Integration Tests**: Service interactions
- **Performance Tests**: Latency and throughput validation
- **End-to-End Tests**: Full system workflow testing

## Deployment

### Docker Deployment
```bash
docker build -t tape-vision-backend .
docker run -d --name trading-backend -p 3001:3001 tape-vision-backend
```

### Production Deployment
```bash
# Using PM2
npm install -g pm2
pm2 start ecosystem.config.js

# Monitor
pm2 monit
pm2 logs
```

## Performance Tuning

### Database Optimization
- Indexed queries for time-series data
- Connection pooling
- Data retention policies
- Aggregation pipelines

### Memory Management
- Circular buffers for real-time data
- Garbage collection optimization
- Memory leak detection
- Resource monitoring

### Network Optimization
- WebSocket compression
- Message batching
- Connection pooling
- Timeout management

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Submit pull request

## License

Proprietary - All rights reserved

## Support

For technical support or questions:
- Email: support@tapevision.ai
- Documentation: https://docs.tapevision.ai
- Issues: https://github.com/tape-vision-ai/backend/issues