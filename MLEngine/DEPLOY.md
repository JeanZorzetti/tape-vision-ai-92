# 🚀 Deploy Guide - AI Trading API

## Deploy Options

### 1. 🌐 **Railway (Recomendado - Mais Fácil)**

1. **Instalar Railway CLI:**
```bash
npm install -g @railway/cli
railway login
```

2. **Deploy:**
```bash
cd MLEngine
railway init
railway up
```

3. **Configurar domínio:**
- No Railway dashboard: Settings → Domains
- Adicionar: `apptapevision.roilabs.com.br`

**URL final:** `https://apptapevision.roilabs.com.br/v1/docs`

### 2. 🐙 **Render**

1. **Conectar GitHub** ao Render
2. **Criar Web Service** apontando para este repo
3. **Configurar:**
   - Build Command: `docker build -f Dockerfile.prod -t ai-trading-api .`
   - Start Command: `python main-prod.py`
   - Environment: `ENVIRONMENT=production`

### 3. ✈️ **Fly.io** 

```bash
# Instalar Fly CLI
curl -L https://fly.io/install.sh | sh

# Deploy
cd MLEngine  
flyctl launch --dockerfile Dockerfile.prod
flyctl deploy
```

### 4. 🌊 **DigitalOcean App Platform**

1. **Criar App** no DigitalOcean
2. **Conectar repo GitHub**
3. **Configurar:**
   - Source: MLEngine folder
   - Dockerfile: Dockerfile.prod
   - Port: 8001

### 5. ☁️ **Google Cloud Run**

```bash
# Build e push para Container Registry
cd MLEngine
gcloud builds submit --tag gcr.io/PROJECT_ID/ai-trading-api .

# Deploy
gcloud run deploy ai-trading-api \
  --image gcr.io/PROJECT_ID/ai-trading-api \
  --platform managed \
  --region southamerica-east1 \
  --port 8001
```

### 6. 🐳 **Docker Compose (VPS)**

```bash
cd MLEngine
docker-compose -f docker-compose.prod.yml up -d
```

## 🔧 Configuração de Domínio

### Passo 1: DNS Records no Cloudflare/Registro.br

**Para Railway/Render/Fly.io:**
```
Type: CNAME
Name: aitradingapi
Value: [URL_FORNECIDA_PELA_PLATAFORMA]
TTL: Auto

Exemplo Railway: your-app-production-abc123.up.railway.app
Exemplo Render: ai-trading-api-prod.onrender.com  
Exemplo Fly.io: ai-trading-api.fly.dev
```

**Para VPS/Docker:**
```
Type: A
Name: aitradingapi
Value: [IP_DO_SEU_SERVIDOR]
TTL: Auto
```

### Passo 2: Configuração na Plataforma

**Railway:**
1. Dashboard → Settings → Domains
2. Add Custom Domain: `apptapevision.roilabs.com.br`
3. Railway fornecerá instruções DNS específicas

**Render:**
1. Settings → Custom Domains  
2. Add: `apptapevision.roilabs.com.br`
3. Seguir instruções DNS do Render

**Fly.io:**
```bash
flyctl certs add apptapevision.roilabs.com.br
flyctl certs show apptapevision.roilabs.com.br
```

### SSL Certificate:

**Opção 1 - Let's Encrypt (Gratuito):**
```bash
certbot --nginx -d apptapevision.roilabs.com.br
```

**Opção 2 - Cloudflare (Recomendado):**
- Ativar SSL/TLS no Cloudflare
- Configurar Full (strict)

## 🔒 Variáveis de Ambiente

```bash
HOST=0.0.0.0
PORT=8001
ENVIRONMENT=production
CONFIDENCE_THRESHOLD=0.90
ALLOWED_ORIGINS=https://apptapevision.roilabs.com.br,https://roilabs.com.br
```

## 📊 Monitoramento

### Health Check:
```bash
curl https://apptapevision.roilabs.com.br/health
```

### API Docs:
```bash
https://apptapevision.roilabs.com.br/v1/docs
```

### Endpoints Principais:
- `POST /v1/analyze` - Análise de mercado
- `POST /v1/patterns` - Detecção de padrões  
- `GET /v1/status` - Status do sistema
- `GET /v1/models` - Informações dos modelos

## 🎯 Teste de Produção

```bash
# Teste básico
curl -X POST "https://apptapevision.roilabs.com.br/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{"market_data":{"symbol":"WDO","price":4580.25,"volume":150}}'

# Esperado:
{
  "signal": "BUY",
  "confidence": 0.87,
  "reasoning": "High volume breakout with strong ML confidence",
  "stop_loss": 4578.75,
  "target": 4582.25,
  "risk_reward": 1.33
}
```

## 🚀 Deploy Rápido (Railway)

**Passos:**
1. `npm install -g @railway/cli`
2. `railway login`
3. `cd MLEngine && railway init`
4. `railway up`
5. Configurar domínio no dashboard

**Pronto! API disponível em:** `https://apptapevision.roilabs.com.br/v1/docs`