/resume# Tape Vision AI - Development Guide

## Overview

This guide provides comprehensive instructions for setting up a development environment, understanding the codebase structure, implementing new features, and contributing to the Tape Vision AI trading system.

## Getting Started

### Prerequisites

**Required Software:**
- **Node.js**: Version 18.0+ (LTS recommended)
- **npm**: Version 8.0+ (comes with Node.js)
- **TypeScript**: Version 5.0+
- **Git**: Latest version
- **Docker**: Version 20.10+ (for databases)
- **Docker Compose**: Version 2.0+

**Recommended Development Tools:**
- **VS Code**: With TypeScript and ESLint extensions
- **MongoDB Compass**: For database visualization
- **Redis Insight**: For Redis monitoring
- **Postman**: For API testing

### Environment Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/tape-vision-ai/backend.git
cd tape-vision-ai-backend
```

#### 2. Install Dependencies

```bash
# Install all dependencies
npm install

# Install global development tools
npm install -g typescript ts-node nodemon eslint prettier
```

#### 3. Setup Development Databases

```bash
# Start MongoDB and Redis containers
docker-compose up -d mongo redis

# Verify containers are running
docker-compose ps
```

#### 4. Environment Configuration

Create development environment file:

```bash
cp .env.example .env.development
```

Edit `.env.development`:

```env
NODE_ENV=development
PORT=3001
WS_PORT=3002
LOG_LEVEL=debug

# Database URLs
MONGODB_URI=mongodb://localhost:27017/tape-vision-ai-dev
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=trading123

# Disable trading in development
TRADING_ENABLED=false
NELOGICA_ENV=demo

# Development-specific settings
MAX_DAILY_LOSS=100
MAX_POSITION_SIZE=1
MINIMUM_CONFIDENCE=85.0
```

#### 5. Initialize Database

```bash
# Run database migrations
npm run db:migrate

# Seed development data
npm run db:seed
```

#### 6. Start Development Server

```bash
# Start with hot reload (minimal version)
npm run dev

# Start full system with all components
npm run dev-full

# Run tests
npm test
```

---

## Project Structure

### Directory Overview

```
Backend/
├── src/                          # Source code
│   ├── api/                      # API layer
│   ├── core/                     # Core trading logic
│   │   ├── analysis/             # Analysis components
│   │   ├── patterns/             # Pattern recognition
│   │   ├── risk/                 # Risk management
│   │   └── trading/              # Trading engine
│   ├── database/                 # Database layer
│   ├── middleware/               # Express middleware
│   ├── models/                   # Data models
│   ├── routes/                   # API routes
│   ├── services/                 # External services
│   ├── types/                    # TypeScript type definitions
│   ├── utils/                    # Utility functions
│   ├── websocket/                # WebSocket implementation
│   ├── server.ts                 # Main server file
│   └── server-minimal.ts         # Minimal server
├── config/                       # Configuration files
├── tests/                        # Test files
├── logs/                         # Log files
├── docs/                         # Documentation
├── scripts/                      # Utility scripts
├── docker-compose.yml            # Docker services
├── Dockerfile                    # Container definition
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
└── README.md                     # Basic readme
```

### Core Components Architecture

```
┌─────────────────────────────────────────────────────┐
│                 API Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Routes    │  │ Middleware  │  │ Controllers │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│               Trading Engine                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │ Tape Reader │  │Order Flow   │  │   Pattern   │ │
│  │             │  │ Analyzer    │  │ Recognizer  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Signal    │  │    Risk     │  │ Database    │ │
│  │ Generator   │  │  Manager    │  │  Manager    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│              Services Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Nelogica   │  │   Market    │  │ WebSocket   │ │
│  │  Service    │  │Data Service │  │  Manager    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Development Workflow

### Code Style and Standards

#### TypeScript Configuration

We use strict TypeScript configuration for type safety:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

#### ESLint Configuration

```json
{
  "extends": [
    "@typescript-eslint/recommended",
    "prettier/@typescript-eslint"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "error",
    "no-console": "warn",
    "prefer-const": "error"
  }
}
```

#### Code Formatting

Use Prettier for consistent code formatting:

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

### Git Workflow

#### Branch Strategy

- **main**: Production-ready code
- **develop**: Integration branch for features
- **feature/**: Feature development branches
- **bugfix/**: Bug fix branches
- **hotfix/**: Production hotfixes

#### Commit Messages

Follow conventional commit format:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(trading): add absorption pattern detection
fix(api): resolve market data streaming issue
docs(api): update endpoint documentation
```

#### Pre-commit Hooks

We use Husky for pre-commit hooks:

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged",
      "pre-push": "npm test"
    }
  },
  "lint-staged": {
    "*.{ts,js}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

---

## Core Development Concepts

### Event-Driven Architecture

The system uses EventEmitter for loose coupling:

```typescript
import { EventEmitter } from 'eventemitter3';

class TradingComponent extends EventEmitter {
  processData(data: MarketData): void {
    // Process data
    const result = this.analyzeData(data);
    
    // Emit event for other components
    this.emit('data-processed', {
      data,
      result,
      timestamp: Date.now()
    });
  }
}

// Usage
const component = new TradingComponent();
component.on('data-processed', (event) => {
  console.log('Data processed:', event);
});
```

### Async/Await Patterns

All I/O operations use async/await:

```typescript
class DatabaseManager {
  async saveTradeData(trade: TradeEntry): Promise<void> {
    try {
      const collection = this.db.collection('trades');
      await collection.insertOne(trade);
      
      // Emit success event
      this.emit('trade-saved', trade);
      
    } catch (error) {
      this.logger.error('Failed to save trade data', error);
      this.emit('save-error', { trade, error });
      throw error;
    }
  }
}
```

### Error Handling Patterns

Use custom error classes for better error handling:

```typescript
class TradingError extends Error {
  public readonly code: string;
  public readonly details?: any;
  
  constructor(message: string, code: string, details?: any) {
    super(message);
    this.name = 'TradingError';
    this.code = code;
    this.details = details;
  }
}

// Usage
try {
  await this.executeTradeAsync(trade);
} catch (error) {
  if (error instanceof TradingError) {
    this.handleTradingError(error);
  } else {
    this.handleUnknownError(error);
  }
}
```

### Configuration Management

Use the config module for environment-specific settings:

```typescript
import config from 'config';

interface TradingConfig {
  symbol: string;
  riskParameters: RiskParameters;
}

const tradingConfig: TradingConfig = config.get('trading');
const riskParams = tradingConfig.riskParameters;
```

---

## Adding New Features

### 1. Creating a New Trading Algorithm

#### Step 1: Define the Interface

```typescript
// src/types/analysis.ts
export interface AlgorithmResult {
  signal: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  reasons: string[];
  metadata: Record<string, any>;
}

export interface TradingAlgorithm {
  name: string;
  analyze(data: MarketData, context: TradingContext): Promise<AlgorithmResult>;
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
}
```

#### Step 2: Implement the Algorithm

```typescript
// src/core/analysis/MomentumAlgorithm.ts
import { TradingAlgorithm, AlgorithmResult } from '@/types/analysis';
import { MarketData, TradingContext } from '@/types/trading';
import { Logger } from 'winston';

export class MomentumAlgorithm implements TradingAlgorithm {
  public readonly name = 'MomentumAlgorithm';
  
  constructor(
    private config: MomentumConfig,
    private logger: Logger
  ) {}

  async initialize(): Promise<void> {
    this.logger.info('Initializing Momentum Algorithm');
    // Setup any required resources
  }

  async analyze(data: MarketData, context: TradingContext): Promise<AlgorithmResult> {
    const momentum = this.calculateMomentum(data);
    const volume = this.analyzeVolume(data);
    
    const confidence = this.calculateConfidence(momentum, volume);
    const signal = this.generateSignal(momentum, confidence);
    
    return {
      signal,
      confidence,
      reasons: this.generateReasons(momentum, volume),
      metadata: { momentum, volume }
    };
  }

  private calculateMomentum(data: MarketData): number {
    // Implement momentum calculation
    return (data.price - data.previousPrice) / data.previousPrice;
  }

  private analyzeVolume(data: MarketData): number {
    // Implement volume analysis
    return data.volume / data.averageVolume;
  }

  private calculateConfidence(momentum: number, volume: number): number {
    // Implement confidence calculation
    return Math.min(Math.abs(momentum) * volume * 100, 100);
  }

  private generateSignal(momentum: number, confidence: number): 'BUY' | 'SELL' | 'WAIT' {
    if (confidence < this.config.minimumConfidence) {
      return 'WAIT';
    }
    
    return momentum > 0 ? 'BUY' : 'SELL';
  }

  async cleanup(): Promise<void> {
    this.logger.info('Cleaning up Momentum Algorithm');
  }
}
```

#### Step 3: Register the Algorithm

```typescript
// src/core/analysis/AlgorithmRegistry.ts
export class AlgorithmRegistry {
  private algorithms: Map<string, TradingAlgorithm> = new Map();

  register(algorithm: TradingAlgorithm): void {
    this.algorithms.set(algorithm.name, algorithm);
  }

  async runAnalysis(data: MarketData, context: TradingContext): Promise<AlgorithmResult[]> {
    const results: AlgorithmResult[] = [];
    
    for (const [name, algorithm] of this.algorithms) {
      try {
        const result = await algorithm.analyze(data, context);
        results.push(result);
      } catch (error) {
        this.logger.error(`Algorithm ${name} failed`, error);
      }
    }
    
    return results;
  }
}
```

#### Step 4: Add Tests

```typescript
// tests/algorithms/MomentumAlgorithm.test.ts
import { MomentumAlgorithm } from '@/core/analysis/MomentumAlgorithm';
import { createMockMarketData, createMockLogger } from '../helpers';

describe('MomentumAlgorithm', () => {
  let algorithm: MomentumAlgorithm;
  
  beforeEach(() => {
    algorithm = new MomentumAlgorithm(
      { minimumConfidence: 70 },
      createMockLogger()
    );
  });

  it('should generate BUY signal for positive momentum', async () => {
    const data = createMockMarketData({
      price: 105,
      previousPrice: 100,
      volume: 2000,
      averageVolume: 1000
    });

    const result = await algorithm.analyze(data, {});
    
    expect(result.signal).toBe('BUY');
    expect(result.confidence).toBeGreaterThan(70);
  });

  it('should generate WAIT signal for low confidence', async () => {
    const data = createMockMarketData({
      price: 100.1,
      previousPrice: 100,
      volume: 500,
      averageVolume: 1000
    });

    const result = await algorithm.analyze(data, {});
    
    expect(result.signal).toBe('WAIT');
    expect(result.confidence).toBeLessThan(70);
  });
});
```

### 2. Adding a New API Endpoint

#### Step 1: Define Route Handler

```typescript
// src/routes/analyticsRoutes.ts
import { Router } from 'express';
import { AnalyticsController } from '@/controllers/AnalyticsController';

export function createAnalyticsRoutes(controller: AnalyticsController): Router {
  const router = Router();

  router.get('/performance-metrics', async (req, res) => {
    try {
      const metrics = await controller.getPerformanceMetrics();
      res.json({
        success: true,
        data: metrics,
        timestamp: Date.now()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
        timestamp: Date.now()
      });
    }
  });

  return router;
}
```

#### Step 2: Implement Controller

```typescript
// src/controllers/AnalyticsController.ts
export class AnalyticsController {
  constructor(
    private databaseManager: DatabaseManager,
    private logger: Logger
  ) {}

  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const trades = await this.databaseManager.getRecentTrades(100);
    
    return {
      winRate: this.calculateWinRate(trades),
      profitFactor: this.calculateProfitFactor(trades),
      sharpeRatio: this.calculateSharpeRatio(trades),
      maxDrawdown: this.calculateMaxDrawdown(trades)
    };
  }

  private calculateWinRate(trades: TradeEntry[]): number {
    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    return (winningTrades.length / trades.length) * 100;
  }
}
```

#### Step 3: Add API Tests

```typescript
// tests/api/analytics.test.ts
import request from 'supertest';
import { app } from '@/server';

describe('Analytics API', () => {
  describe('GET /api/analytics/performance-metrics', () => {
    it('should return performance metrics', async () => {
      const response = await request(app)
        .get('/api/analytics/performance-metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('winRate');
      expect(response.body.data).toHaveProperty('profitFactor');
    });
  });
});
```

---

## Testing

### Testing Strategy

1. **Unit Tests**: Test individual components in isolation
2. **Integration Tests**: Test component interactions
3. **End-to-End Tests**: Test complete workflows
4. **Performance Tests**: Test system under load

### Unit Testing

Use Jest for unit testing:

```typescript
// tests/core/risk/RiskManager.test.ts
import { RiskManager } from '@/core/risk/RiskManager';
import { createMockLogger } from '../helpers';

describe('RiskManager', () => {
  let riskManager: RiskManager;

  beforeEach(() => {
    const config = {
      maxDailyLoss: 500,
      maxPositionSize: 2,
      stopLossPoints: 1.5
    };
    riskManager = new RiskManager(config, createMockLogger());
  });

  describe('calculatePositionSize', () => {
    it('should calculate correct position size', async () => {
      const positionSize = await riskManager.calculatePositionSize(
        100, // entry price
        98.5 // stop loss
      );

      expect(positionSize).toBeLessThanOrEqual(2);
      expect(positionSize).toBeGreaterThan(0);
    });

    it('should respect maximum position size', async () => {
      const positionSize = await riskManager.calculatePositionSize(
        100,
        99.9 // Very tight stop loss
      );

      expect(positionSize).toBeLessThanOrEqual(2);
    });
  });
});
```

### Integration Testing

Test component interactions:

```typescript
// tests/integration/TradingEngine.test.ts
import { TradingEngine } from '@/core/trading/TradingEngine';
import { createTestDatabase } from '../helpers';

describe('TradingEngine Integration', () => {
  let engine: TradingEngine;
  let database: TestDatabase;

  beforeEach(async () => {
    database = await createTestDatabase();
    engine = new TradingEngine(testConfig, createMockLogger());
    await engine.start();
  });

  afterEach(async () => {
    await engine.stop();
    await database.cleanup();
  });

  it('should process market data and generate signals', async () => {
    const marketData = createMockMarketData();
    
    const signalPromise = new Promise((resolve) => {
      engine.once('signal-generated', resolve);
    });

    await engine.processMarketData(marketData);
    
    const signal = await signalPromise;
    expect(signal).toBeDefined();
  });
});
```

### Test Helpers

Create reusable test utilities:

```typescript
// tests/helpers/index.ts
import { Logger } from 'winston';
import { MarketData } from '@/types/trading';

export function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  } as any;
}

export function createMockMarketData(overrides = {}): MarketData {
  return {
    price: 100,
    priceChange: 0.5,
    volume: 1000,
    volatility: 1.2,
    spread: 0.5,
    sessionTime: '14:30:00',
    marketPhase: 'open',
    liquidityLevel: 'high',
    orderBookImbalance: 0,
    timestamp: Date.now(),
    bid: 99.5,
    ask: 100.5,
    last: 100,
    high: 101,
    low: 99,
    ...overrides
  };
}

export async function createTestDatabase(): Promise<TestDatabase> {
  // Setup test database connection
  // Return cleanup utilities
}
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- TradingEngine.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

---

## Debugging

### Development Tools

#### VS Code Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Backend",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/server.ts",
      "runtimeArgs": ["-r", "ts-node/register"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "restart": true,
      "protocol": "inspector"
    }
  ]
}
```

#### Logger Configuration

Use structured logging for debugging:

```typescript
this.logger.debug('Processing market data', {
  symbol: data.symbol,
  price: data.price,
  volume: data.volume,
  timestamp: data.timestamp,
  processingTime: Date.now() - startTime
});
```

### Performance Profiling

#### Memory Usage Monitoring

```typescript
class PerformanceMonitor {
  logMemoryUsage(): void {
    const usage = process.memoryUsage();
    this.logger.info('Memory usage', {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024) + ' MB',
      external: Math.round(usage.external / 1024 / 1024) + ' MB',
      rss: Math.round(usage.rss / 1024 / 1024) + ' MB'
    });
  }
}
```

#### Processing Time Measurement

```typescript
function withTiming<T>(operation: () => Promise<T>, name: string): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const start = process.hrtime.bigint();
    
    try {
      const result = await operation();
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      
      console.log(`${name} took ${duration.toFixed(2)}ms`);
      resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

// Usage
await withTiming(
  () => this.processMarketData(data),
  'Market Data Processing'
);
```

---

## Common Development Tasks

### Adding a New Risk Check

```typescript
// src/core/risk/checks/NewRiskCheck.ts
export class NewRiskCheck implements RiskCheck {
  name = 'new-risk-check';
  
  async evaluate(context: RiskContext): Promise<RiskResult> {
    // Implement risk logic
    const violation = this.checkCondition(context);
    
    return {
      passed: !violation,
      severity: violation ? 'high' : 'none',
      message: violation ? 'Risk condition violated' : 'Check passed'
    };
  }
}

// Register in RiskManager
riskManager.addCheck(new NewRiskCheck());
```

### Adding a New WebSocket Event

```typescript
// src/websocket/events/NewEvent.ts
export class NewEvent implements WebSocketEvent {
  type = 'new-event';
  
  async handle(socket: Socket, data: any): Promise<void> {
    // Process event data
    const result = await this.processData(data);
    
    // Send response
    socket.emit('new-event-response', {
      success: true,
      data: result
    });
  }
}
```

### Adding Configuration Validation

```typescript
// src/config/validation.ts
import Joi from 'joi';

export const tradingConfigSchema = Joi.object({
  symbol: Joi.string().required(),
  riskParameters: Joi.object({
    maxDailyLoss: Joi.number().min(0).required(),
    maxPositionSize: Joi.number().integer().min(1).required()
  }).required()
});

// Usage
export function validateConfig(config: any): void {
  const { error } = tradingConfigSchema.validate(config);
  if (error) {
    throw new ValidationError(`Invalid configuration: ${error.message}`);
  }
}
```

---

## Contributing Guidelines

### Code Review Process

1. **Fork the repository** and create a feature branch
2. **Write comprehensive tests** for new functionality
3. **Ensure code coverage** remains above 80%
4. **Update documentation** for any API changes
5. **Run linting and formatting** before committing
6. **Submit a pull request** with detailed description

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Documentation
- [ ] Code comments updated
- [ ] API documentation updated
- [ ] README updated (if needed)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Tests added/updated
- [ ] No merge conflicts
```

### Issue Templates

```markdown
## Bug Report
**Describe the bug**
A clear description of the bug

**Steps to reproduce**
1. Step 1
2. Step 2
3. Step 3

**Expected behavior**
What should happen

**Actual behavior**
What actually happens

**Environment**
- Node.js version:
- OS:
- Browser (if applicable):

**Additional context**
Any other relevant information
```

---

## Development Best Practices

### Performance Guidelines

1. **Use async/await** for all I/O operations
2. **Implement proper error handling** with try-catch blocks
3. **Use TypeScript strictly** with proper type definitions
4. **Profile and optimize** critical code paths
5. **Implement proper caching** for frequently accessed data

### Security Guidelines

1. **Validate all inputs** using proper validation libraries
2. **Use parameterized queries** to prevent SQL injection
3. **Implement rate limiting** on all API endpoints
4. **Log security events** for audit purposes
5. **Keep dependencies updated** regularly

### Code Quality Guidelines

1. **Write self-documenting code** with clear variable names
2. **Keep functions small and focused** (single responsibility)
3. **Use meaningful commit messages** following conventional commits
4. **Write comprehensive tests** with good coverage
5. **Document complex algorithms** with inline comments

---

This development guide provides comprehensive information for developers working on the Tape Vision AI trading system. Following these guidelines ensures code quality, maintainability, and system reliability.