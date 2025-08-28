# 🚀 Production Deployment Checklist - aitradingapi.roilabs.com.br

## ✅ Pre-Deployment Checklist

### 1. 🧪 Local Testing
- [ ] Run `python test_api.py` locally
- [ ] All endpoints return 200 status
- [ ] Health check responds correctly
- [ ] API docs accessible at `/v1/docs`

### 2. 📁 Files Ready
- [ ] `main.py` - Production FastAPI application
- [ ] `Dockerfile.prod` - Optimized Docker image
- [ ] `requirements-simple.txt` - Python dependencies
- [ ] `railway.json` - Railway configuration
- [ ] `render.yaml` - Render configuration
- [ ] `fly.toml` - Fly.io configuration
- [ ] `docker-compose.prod.yml` - Docker Compose setup

### 3. 🔧 Configuration
- [ ] Environment variables configured
- [ ] CORS origins set for production
- [ ] Port 8001 configured
- [ ] Health check path `/health` set

## 🚀 Deployment Steps

### Option A: Railway (Recommended)
1. [ ] Go to https://railway.app
2. [ ] Login with GitHub
3. [ ] "New Project" → "Deploy from GitHub repo"
4. [ ] Select your repository
5. [ ] Set Root Directory: `MLEngine`
6. [ ] Railway auto-detects `Dockerfile.prod`
7. [ ] Wait for build to complete
8. [ ] Go to Settings → Domains
9. [ ] Add Custom Domain: `aitradingapi.roilabs.com.br`
10. [ ] Update DNS records as instructed

### Option B: Render
1. [ ] Go to https://render.com
2. [ ] "New" → "Web Service"
3. [ ] Connect GitHub repository
4. [ ] Root Directory: `MLEngine`
5. [ ] Environment: Docker
6. [ ] Auto-deploy enabled
7. [ ] Add custom domain in settings

### Option C: Fly.io
1. [ ] Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. [ ] `flyctl auth login`
3. [ ] `cd MLEngine`
4. [ ] `flyctl launch --dockerfile Dockerfile.prod`
5. [ ] `flyctl certs add aitradingapi.roilabs.com.br`

## 🌐 DNS Configuration

### For Railway/Render/Fly.io:
- [ ] Create CNAME record:
  - Name: `aitradingapi`
  - Value: [Platform-provided URL]
  
### For VPS/Docker:
- [ ] Create A record:
  - Name: `aitradingapi` 
  - Value: [Server IP]

## 🔒 Security Checklist
- [ ] SSL certificate configured (automatic on platforms)
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting enabled
- [ ] Health checks configured
- [ ] Logs monitoring set up

## 🧪 Post-Deployment Testing

### 1. Basic Tests
- [ ] `curl https://aitradingapi.roilabs.com.br/health`
  - Expected: `{"status": "healthy"}`
  
- [ ] `curl https://aitradingapi.roilabs.com.br/`
  - Expected: API information JSON

### 2. API Documentation
- [ ] Visit: https://aitradingapi.roilabs.com.br/v1/docs
- [ ] Swagger UI loads correctly
- [ ] All endpoints visible

### 3. Comprehensive Test
```bash
# Update test_api.py BASE_URL to production URL
BASE_URL = "https://aitradingapi.roilabs.com.br"
python test_api.py
```

### 4. Production Analysis Test
```bash
curl -X POST "https://aitradingapi.roilabs.com.br/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "market_data": {
      "symbol": "WDO",
      "price": 4580.25,
      "volume": 150,
      "bid": 4580.00,
      "ask": 4580.50
    }
  }'
```

Expected response:
```json
{
  "signal": "BUY",
  "confidence": 0.87,
  "reasoning": "📊 Tight spread with good volume - bullish setup",
  "stop_loss": 4578.75,
  "target": 4582.25,
  "risk_reward": 1.33
}
```

## 📊 Monitoring & Maintenance

### Daily Checks
- [ ] Health endpoint responding
- [ ] API response times < 100ms
- [ ] Error rate < 1%

### Weekly Tasks  
- [ ] Check logs for errors
- [ ] Monitor resource usage
- [ ] Update dependencies if needed

## 🎯 Success Criteria

✅ **Deployment Successful When:**
- Health check returns 200
- API docs accessible at `/v1/docs`
- All endpoints respond correctly
- Custom domain resolves with SSL
- Response times < 100ms
- Confidence scoring working
- Pattern detection active

## 📞 Troubleshooting

### Common Issues:
1. **Domain not resolving**: Check DNS propagation (24-48h)
2. **SSL errors**: Platform handles automatically, check configuration
3. **API errors**: Check logs in platform dashboard
4. **Slow responses**: Check resource limits/upgrade plan

### Support Resources:
- Railway: https://railway.app/help
- Render: https://render.com/docs
- Fly.io: https://fly.io/docs

---

**🎉 Once complete, your AI Trading API will be live at:**
**https://aitradingapi.roilabs.com.br/v1/docs**