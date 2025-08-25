# Tape Vision AI Trading System - API Documentation

## Overview

This is the comprehensive API layer for the Tape Vision AI trading system, providing REST endpoints and WebSocket connections for real-time trading operations, market data access, and system management.

## Architecture

### Core Components

1. **API Index (`index.ts`)** - Main API orchestrator and configuration
2. **Controllers** - Business logic handlers for each domain
3. **Routes** - HTTP endpoint definitions with middleware
4. **Middleware** - Authentication, validation, rate limiting, logging
5. **WebSocket Handlers** - Real-time communication management
6. **Types** - TypeScript definitions for API contracts

### Middleware Stack

- **Authentication** - JWT and API key authentication with RBAC
- **Validation** - Request/response validation using Joi schemas
- **Rate Limiting** - Advanced rate limiting with Redis support
- **Request Logging** - Comprehensive request/response logging
- **Response Formatting** - Consistent API response structure
- **Error Handling** - Centralized error handling and reporting

## API Endpoints

### Authentication (`/api/v1/auth`)

- `POST /login` - User authentication
- `POST /logout` - User logout
- `POST /refresh` - Token refresh
- `POST /register` - User registration (admin only)
- `GET /profile` - Get user profile
- `PUT /profile` - Update user profile
- `POST /change-password` - Change password
- `GET /sessions` - Get active sessions
- `DELETE /sessions/:id` - Revoke session

### Trading (`/api/v1/trading`)

- `GET /market-data` - Current market data
- `GET /ai-status` - AI system status
- `GET /decision-analysis` - Current decision analysis
- `POST /orders` - Place new order
- `GET /orders` - List orders
- `DELETE /orders/:id` - Cancel order
- `GET /positions` - Current positions
- `DELETE /positions/:symbol` - Close position
- `GET /config` - Trading configuration
- `PUT /config` - Update configuration
- `GET /log` - Trading log
- `GET /session` - Trading session info
- `POST /engine/start` - Start trading engine
- `POST /engine/stop` - Stop trading engine
- `POST /emergency-stop` - Emergency stop
- `GET /patterns` - Pattern matches
- `GET /performance` - Performance metrics
- `GET /chart` - Chart data
- `GET /stats` - Trading statistics

### Market Data (`/api/v1/market-data`)

- `GET /quote/:symbol` - Real-time quote
- `POST /quotes` - Multiple quotes
- `GET /historical/:symbol` - Historical data
- `GET /orderbook/:symbol` - Order book
- `GET /trades/:symbol` - Recent trades
- `POST /subscribe` - Subscribe to real-time data
- `DELETE /subscribe/:id` - Unsubscribe
- `GET /subscriptions` - Active subscriptions
- `GET /stats/:symbol` - Market statistics
- `GET /liquidity/:symbol` - Liquidity analysis
- `GET /volume-profile/:symbol` - Volume profile
- `GET /depth/:symbol` - Market depth
- `GET /order-flow/:symbol` - Order flow data
- `GET /session/:symbol` - Market session info
- `GET /search` - Symbol search

### Risk Management (`/api/v1/risk`)

- `GET /status` - Current risk status
- `GET /limits` - Risk limits
- `PUT /limits` - Update risk limits
- `GET /violations` - Risk violations
- `PATCH /violations/:id/acknowledge` - Acknowledge violation
- `GET /metrics` - Risk metrics
- `POST /validate-trade` - Validate trade against limits
- `GET /position-analysis/:symbol` - Position risk analysis
- `GET /portfolio` - Portfolio risk
- `GET /var` - Value at Risk calculations
- `POST /stress-test` - Run stress test
- `POST /alerts` - Create risk alert
- `GET /alerts` - List risk alerts
- `PUT /alerts/:id` - Update risk alert
- `DELETE /alerts/:id` - Delete risk alert
- `GET /report` - Risk report

### System Management (`/api/v1/system`)

- `GET /health` - System health check
- `GET /metrics` - System metrics
- `GET /stats` - System statistics
- `GET /logs` - System logs
- `GET /config` - System configuration
- `PUT /config` - Update configuration
- `POST /restart/:component` - Restart component
- `GET /alerts` - System alerts
- `DELETE /alerts` - Clear alerts
- `GET /export` - Export system data

### User Management (`/api/v1/users`)

- `GET /` - List users
- `POST /` - Create user
- `GET /:id` - Get user by ID
- `PUT /:id` - Update user
- `DELETE /:id` - Delete user
- `POST /:id/reset-password` - Reset password
- `GET /:id/permissions` - Get permissions
- `PUT /:id/permissions` - Update permissions
- `GET /:id/activity` - User activity log
- `GET /stats` - User statistics

### WebSocket (`/api/v1/ws`)

- `GET /info` - Connection information
- `GET /connections` - Connection statistics
- `GET /subscriptions` - User subscriptions

## WebSocket Channels

### Real-time Data Channels

- `market-data` - Real-time market data updates
- `order-book` - Order book changes
- `tape` - Trade tape (time & sales)
- `ai-status` - AI system status updates
- `signals` - Trading signals
- `trades` - Trade executions
- `notifications` - System notifications
- `system-status` - System health updates

### Commands

- `auth` - Authenticate connection
- `subscribe` - Subscribe to channel
- `unsubscribe` - Unsubscribe from channel
- `place-order` - Place trading order
- `cancel-order` - Cancel order
- `emergency-stop` - Emergency stop
- `get-status` - Request status update
- `ping` - Heartbeat

## Authentication & Authorization

### JWT Authentication
- Bearer token in Authorization header
- Token contains user ID, role, and permissions
- Configurable expiration times
- Refresh token support

### API Key Authentication
- X-API-Key header
- Rate limiting per key
- Permission-based access control

### Role-Based Access Control (RBAC)

#### Roles
- **Admin** - Full system access
- **Trader** - Trading and market data access
- **Analyst** - Read-only access with analytics
- **Viewer** - Basic read-only access

#### Permissions
- `system.admin` - Full system administration
- `system.read/write` - System monitoring and configuration
- `trading.read/write/execute` - Trading operations
- `market_data.read/subscribe` - Market data access
- `risk.read/write` - Risk management
- `users.read/write` - User management
- `analytics.read` - Advanced analytics

## Rate Limiting

### Endpoint-Specific Limits
- **Authentication**: 5 requests/15 minutes
- **Trading Orders**: 10 requests/minute
- **Market Data**: 100 requests/minute
- **General API**: 1000 requests/15 minutes

### Rate Limit Headers
- `X-RateLimit-Limit` - Request limit
- `X-RateLimit-Remaining` - Remaining requests
- `X-RateLimit-Reset` - Reset timestamp

## Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": 1234567890,
  "requestId": "uuid",
  "details": {}
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error
- `503` - Service Unavailable

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": 1234567890,
  "requestId": "uuid",
  "version": "1.0.0"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 100,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  },
  "timestamp": 1234567890,
  "requestId": "uuid"
}
```

## Validation

### Request Validation
- All endpoints use Joi schema validation
- Automatic sanitization and type conversion
- Detailed validation error messages
- Custom business rule validation

### Common Validation Rules
- Symbol format: Uppercase 2-10 alphanumeric characters
- Price: Positive number with 4 decimal precision
- Quantity: Positive integer
- Dates: ISO 8601 format
- Pagination: page >= 1, limit 1-1000

## Logging

### Request Logging
- Request/response details
- Performance metrics
- User identification
- Error tracking

### Security Logging
- Authentication attempts
- Permission violations
- Rate limit breaches
- Suspicious activities

## Caching

### Response Caching
- Market data: 5-30 seconds
- System metrics: 1-5 minutes
- Configuration: 5-10 minutes
- Static data: 1 hour

### Cache Headers
- `Cache-Control` - Caching directives
- `ETag` - Entity tag for conditional requests
- `If-None-Match` - Conditional request header

## WebSocket Protocol

### Connection Flow
1. Establish WebSocket connection
2. Send authentication message
3. Subscribe to desired channels
4. Receive real-time updates
5. Send commands as needed

### Message Format
```json
{
  "type": "message_type",
  "channel": "channel_name",
  "data": {},
  "timestamp": 1234567890,
  "sequence": 123
}
```

## Development

### Environment Setup
1. Install dependencies: `npm install`
2. Configure environment variables
3. Start development server: `npm run dev`
4. Run tests: `npm test`

### Testing
- Unit tests for controllers and middleware
- Integration tests for API endpoints
- WebSocket connection testing
- Performance and load testing

### Deployment
- Docker containerization
- Environment-specific configurations
- Health checks and monitoring
- Graceful shutdown handling

## Security Features

- **Input Validation** - Comprehensive request validation
- **Rate Limiting** - Prevent abuse and DoS attacks
- **CORS Protection** - Cross-origin request security
- **Helmet Security** - HTTP security headers
- **Authentication** - Multi-method authentication
- **Authorization** - Role-based access control
- **Audit Logging** - Complete audit trail
- **Error Sanitization** - No sensitive data in errors

## Performance Optimizations

- **Response Compression** - Gzip compression
- **Caching** - Multi-level caching strategy
- **Connection Pooling** - Database connection optimization
- **Async Operations** - Non-blocking I/O
- **Memory Management** - Efficient memory usage
- **Query Optimization** - Database query optimization