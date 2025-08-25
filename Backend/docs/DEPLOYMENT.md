# Tape Vision AI - Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Tape Vision AI trading system in various environments, from development to production. The system is containerized using Docker for consistent deployment across different platforms.

## Prerequisites

### System Requirements

**Minimum Requirements:**
- **CPU**: 4 cores (8 recommended for production)
- **RAM**: 8GB (16GB recommended for production)
- **Storage**: 50GB SSD (100GB+ for production)
- **Network**: Stable internet connection with low latency

**Recommended Production Specs:**
- **CPU**: 8+ cores with high clock speed
- **RAM**: 32GB
- **Storage**: 500GB NVMe SSD
- **Network**: Dedicated connection with <5ms latency to broker

### Software Requirements

- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+
- **Node.js**: Version 18+ (for development)
- **Git**: Latest version

### Operating System Support
- **Linux**: Ubuntu 20.04+, CentOS 8+, RHEL 8+ (Recommended)
- **macOS**: 12.0+ (Development only)
- **Windows**: Windows 11 with WSL2 (Development only)

---

## Quick Start Deployment

### 1. Clone Repository

```bash
git clone https://github.com/tape-vision-ai/backend.git
cd tape-vision-ai-backend
```

### 2. Environment Setup

Copy the environment template:

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
# Application Settings
NODE_ENV=production
PORT=3001
WS_PORT=3002
LOG_LEVEL=info

# Database Configuration
MONGODB_URI=mongodb://mongo:27017/tape-vision-ai
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=trading123

# Nelogica Configuration
NELOGICA_API_URL=https://api.nelogica.com.br
NELOGICA_USERNAME=your_username
NELOGICA_PASSWORD=your_password
NELOGICA_ENV=demo
NELOGICA_DLL_PATH=/path/to/nelogica.dll

# Trading Configuration
TRADING_SYMBOL=WDO
TRADING_ENABLED=false
AUTO_START_ENGINE=false
MAX_DAILY_LOSS=500
MAX_POSITION_SIZE=2
TARGET_POINTS=2
STOP_LOSS_POINTS=1.5
MINIMUM_CONFIDENCE=90

# Security
JWT_SECRET=your-super-secret-jwt-key-here
API_KEY=your-api-key-here

# Frontend Configuration
FRONTEND_URL=http://localhost:5173
CORS_ORIGIN=http://localhost:5173
```

### 3. Deploy with Docker Compose

```bash
# Start all services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f tape-vision-backend
```

### 4. Verify Deployment

```bash
# Health check
curl http://localhost:3001/health

# API test
curl http://localhost:3001/api/trading/ai-status
```

---

## Development Deployment

### Local Development Setup

#### 1. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install TypeScript globally
npm install -g typescript ts-node nodemon
```

#### 2. Database Setup

```bash
# Start only databases
docker-compose up -d mongo redis

# Initialize database
npm run db:migrate
npm run db:seed
```

#### 3. Configuration

Create `config/development.json`:

```json
{
  "server": {
    "port": 3001,
    "wsPort": 3002
  },
  "database": {
    "mongodb": {
      "uri": "mongodb://localhost:27017/tape-vision-ai-dev",
      "options": {
        "useNewUrlParser": true,
        "useUnifiedTopology": true
      }
    },
    "redis": {
      "host": "localhost",
      "port": 6379,
      "password": "trading123"
    }
  },
  "nelogica": {
    "apiUrl": "https://demo.nelogica.com.br",
    "environment": "demo"
  },
  "trading": {
    "enabled": false,
    "autoStart": false,
    "symbol": "WDO",
    "maxDailyLoss": 100,
    "maxPositionSize": 1
  },
  "logging": {
    "level": "debug",
    "file": {
      "enabled": true,
      "filename": "logs/development.log"
    }
  }
}
```

#### 4. Start Development Server

```bash
# Start with hot reload
npm run dev

# Start full system
npm run dev-full

# Run tests
npm test
```

---

## Production Deployment

### 1. Production Server Setup

#### System Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.12.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create trading user
sudo useradd -m -s /bin/bash trading
sudo usermod -aG docker trading
```

#### Security Hardening

```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 3001/tcp  # API port
sudo ufw allow 3002/tcp  # WebSocket port

# Disable root SSH
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# Install fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### 2. Production Environment Configuration

Create `production.env`:

```env
NODE_ENV=production
PORT=3001
WS_PORT=3002
LOG_LEVEL=info

# Use strong passwords in production
MONGODB_ROOT_PASSWORD=super-secure-mongo-password
REDIS_PASSWORD=super-secure-redis-password

# SSL/TLS Configuration
SSL_ENABLED=true
SSL_CERT_PATH=/path/to/ssl/cert.pem
SSL_KEY_PATH=/path/to/ssl/private.key

# Monitoring
PROMETHEUS_ENABLED=true
GRAFANA_ENABLED=true

# Backup Configuration
BACKUP_ENABLED=true
BACKUP_SCHEDULE=0 2 * * *  # Daily at 2 AM
BACKUP_RETENTION_DAYS=30
```

### 3. Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  tape-vision-backend:
    build:
      context: .
      dockerfile: Dockerfile.prod
    container_name: tape-vision-backend-prod
    restart: always
    ports:
      - "3001:3001"
      - "3002:3002"
    environment:
      - NODE_ENV=production
    env_file:
      - production.env
    volumes:
      - ./logs:/app/logs:rw
      - ./data:/app/data:rw
    depends_on:
      - mongo
      - redis
    networks:
      - tape-vision-network
    deploy:
      resources:
        limits:
          memory: 4G
          cpus: '2.0'
        reservations:
          memory: 2G
          cpus: '1.0'

  mongo:
    image: mongo:6-jammy
    container_name: tape-vision-mongo-prod
    restart: always
    ports:
      - "127.0.0.1:27017:27017"
    environment:
      - MONGO_INITDB_ROOT_USERNAME=admin
    env_file:
      - production.env
    volumes:
      - mongo_prod_data:/data/db
      - ./backup:/backup:rw
    networks:
      - tape-vision-network
    command: [
      "--auth",
      "--bind_ip_all",
      "--replSet", "rs0"
    ]

  redis:
    image: redis:7-alpine
    container_name: tape-vision-redis-prod
    restart: always
    ports:
      - "127.0.0.1:6379:6379"
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_prod_data:/data
    networks:
      - tape-vision-network
    deploy:
      resources:
        limits:
          memory: 1G

  # Reverse proxy with SSL termination
  nginx:
    image: nginx:alpine
    container_name: tape-vision-nginx
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - tape-vision-backend
    networks:
      - tape-vision-network

  # Monitoring
  prometheus:
    image: prom/prometheus:latest
    container_name: tape-vision-prometheus
    restart: always
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    networks:
      - tape-vision-network

  grafana:
    image: grafana/grafana:latest
    container_name: tape-vision-grafana
    restart: always
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=secure-grafana-password
    volumes:
      - grafana_data:/var/lib/grafana
    networks:
      - tape-vision-network

volumes:
  mongo_prod_data:
  redis_prod_data:
  prometheus_data:
  grafana_data:

networks:
  tape-vision-network:
    driver: bridge
```

### 4. Deploy to Production

```bash
# Switch to trading user
sudo su - trading

# Clone repository
git clone https://github.com/tape-vision-ai/backend.git
cd tape-vision-ai-backend

# Set up environment
cp production.env.example production.env
# Edit production.env with secure values

# Build and deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Verify deployment
docker-compose ps
curl http://localhost:3001/health
```

---

## Cloud Deployment

### AWS Deployment

#### 1. EC2 Instance Setup

```bash
# Launch EC2 instance (recommended: c5.2xlarge)
# Configure security groups:
# - SSH (22) from your IP
# - HTTP (80) from anywhere
# - HTTPS (443) from anywhere
# - Custom TCP (3001, 3002) from anywhere

# Connect to instance
ssh -i your-key.pem ubuntu@your-instance-ip
```

#### 2. ECS Deployment (Advanced)

Create `ecs-task-definition.json`:

```json
{
  "family": "tape-vision-ai",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "2048",
  "memory": "4096",
  "executionRoleArn": "arn:aws:iam::account:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "tape-vision-backend",
      "image": "your-account.dkr.ecr.region.amazonaws.com/tape-vision-ai:latest",
      "portMappings": [
        {
          "containerPort": 3001,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/tape-vision-ai",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
```

#### 3. RDS and ElastiCache Setup

```bash
# Create RDS MongoDB instance
aws rds create-db-instance \
    --db-instance-identifier tape-vision-mongo \
    --db-instance-class db.t3.medium \
    --engine mongodb \
    --allocated-storage 100

# Create ElastiCache Redis cluster
aws elasticache create-cache-cluster \
    --cache-cluster-id tape-vision-redis \
    --cache-node-type cache.t3.medium \
    --engine redis \
    --num-cache-nodes 1
```

### Google Cloud Platform

#### 1. GKE Deployment

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tape-vision-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tape-vision-backend
  template:
    metadata:
      labels:
        app: tape-vision-backend
    spec:
      containers:
      - name: tape-vision-backend
        image: gcr.io/your-project/tape-vision-ai:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: MONGODB_URI
          valueFrom:
            secretKeyRef:
              name: tape-vision-secrets
              key: mongodb-uri
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
---
apiVersion: v1
kind: Service
metadata:
  name: tape-vision-service
spec:
  selector:
    app: tape-vision-backend
  ports:
  - port: 80
    targetPort: 3001
  type: LoadBalancer
```

Deploy to GKE:

```bash
# Create GKE cluster
gcloud container clusters create tape-vision-cluster \
    --num-nodes=3 \
    --machine-type=n2-standard-4

# Deploy application
kubectl apply -f k8s-deployment.yaml
```

---

## Database Deployment

### MongoDB Setup

#### Replica Set Configuration

```javascript
// Connect to MongoDB and configure replica set
rs.initiate({
  _id: "rs0",
  members: [
    {
      _id: 0,
      host: "mongo1:27017",
      priority: 2
    },
    {
      _id: 1,
      host: "mongo2:27017",
      priority: 1
    },
    {
      _id: 2,
      host: "mongo3:27017",
      priority: 1,
      arbiterOnly: true
    }
  ]
});
```

#### Database Initialization

```javascript
// Initialize collections and indexes
use tape-vision-ai

// Create indexes for optimal performance
db.trades.createIndex({ "timestamp": -1 });
db.trades.createIndex({ "symbol": 1, "timestamp": -1 });
db.market_data.createIndex({ "timestamp": -1 });
db.patterns.createIndex({ "timestamp": -1, "confidence": -1 });

// Create users
db.createUser({
  user: "trading",
  pwd: "secure-password",
  roles: [
    { role: "readWrite", db: "tape-vision-ai" }
  ]
});
```

### Redis Configuration

Create `redis.conf`:

```
# Network
bind 127.0.0.1
port 6379
tcp-backlog 511

# Security
requirepass your-secure-password
rename-command FLUSHDB ""
rename-command FLUSHALL ""

# Memory
maxmemory 2gb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000
rdbcompression yes

# AOF
appendonly yes
appendfsync everysec
no-appendfsync-on-rewrite no
```

---

## SSL/TLS Configuration

### Nginx SSL Proxy

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server tape-vision-backend:3001;
    }

    upstream websocket {
        server tape-vision-backend:3002;
    }

    server {
        listen 80;
        server_name your-domain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name your-domain.com;

        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/private.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # API endpoints
        location /api/ {
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://backend;
        }

        # WebSocket
        location /ws {
            proxy_pass http://websocket;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

### Let's Encrypt SSL

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

---

## Backup and Recovery

### Automated Backup Script

Create `scripts/backup.sh`:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/backup"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# MongoDB backup
docker exec tape-vision-mongo-prod mongodump \
    --out /backup/mongo_$DATE \
    --gzip \
    --archive=/backup/mongo_backup_$DATE.gz

# Redis backup
docker exec tape-vision-redis-prod redis-cli \
    --rdb /backup/redis_backup_$DATE.rdb

# Configuration backup
tar -czf $BACKUP_DIR/config_backup_$DATE.tar.gz \
    config/ .env production.env

# Clean old backups
find $BACKUP_DIR -name "*backup*" -mtime +$RETENTION_DAYS -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/ s3://your-backup-bucket/ --recursive
```

### Recovery Procedures

```bash
# MongoDB recovery
docker exec -i tape-vision-mongo-prod mongorestore \
    --gzip \
    --archive=/backup/mongo_backup_YYYYMMDD.gz

# Redis recovery
docker exec -i tape-vision-redis-prod redis-cli \
    --rdb /backup/redis_backup_YYYYMMDD.rdb

# Configuration recovery
tar -xzf config_backup_YYYYMMDD.tar.gz
```

---

## Monitoring Setup

### Prometheus Configuration

Create `monitoring/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'tape-vision-backend'
    static_configs:
      - targets: ['tape-vision-backend:3001']
    metrics_path: '/metrics'
    scrape_interval: 5s

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

rule_files:
  - "alert_rules.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets:
          - alertmanager:9093
```

### Grafana Dashboards

Import dashboard configuration for:
- System metrics (CPU, memory, disk)
- Trading metrics (PnL, win rate, trades)
- Performance metrics (latency, throughput)
- Error monitoring

---

## Troubleshooting

### Common Issues

#### Container Won't Start

```bash
# Check logs
docker-compose logs tape-vision-backend

# Check container status
docker ps -a

# Rebuild container
docker-compose build --no-cache tape-vision-backend
```

#### Database Connection Issues

```bash
# Test MongoDB connection
docker exec -it tape-vision-mongo-prod mongo

# Test Redis connection
docker exec -it tape-vision-redis-prod redis-cli ping
```

#### Performance Issues

```bash
# Monitor resource usage
docker stats

# Check system resources
htop
iotop
```

#### Network Issues

```bash
# Test connectivity
curl -I http://localhost:3001/health

# Check port bindings
netstat -tulpn | grep :3001
```

### Log Analysis

```bash
# View real-time logs
docker-compose logs -f tape-vision-backend

# Search for errors
grep -i "error" logs/trading.log

# Analyze performance
grep "processing time" logs/trading.log | tail -100
```

---

## Scaling and Load Balancing

### Horizontal Scaling

For high-traffic environments, deploy multiple backend instances:

```yaml
# docker-compose.scale.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx-lb.conf:/etc/nginx/nginx.conf

  tape-vision-backend:
    build: .
    deploy:
      replicas: 3
    environment:
      - NODE_ENV=production
      - INSTANCE_ID=${HOSTNAME}
```

### Load Balancer Configuration

```nginx
upstream backend_pool {
    least_conn;
    server tape-vision-backend-1:3001 max_fails=3 fail_timeout=30s;
    server tape-vision-backend-2:3001 max_fails=3 fail_timeout=30s;
    server tape-vision-backend-3:3001 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://backend_pool;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

This deployment guide provides comprehensive instructions for deploying the Tape Vision AI trading system across various environments. Choose the deployment method that best fits your infrastructure requirements and security needs.