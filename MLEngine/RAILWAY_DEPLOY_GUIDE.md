# 🚄 Railway Deployment Guide - ML Engine API

## 🎯 Objetivo
Deploy da ML Engine para: **https://ml.aitradingapi.roilabs.com.br/v1/docs**

## 📋 Pré-requisitos
- [ ] Conta GitHub com repositório público/privado
- [ ] Acesso ao DNS do domínio `roilabs.com.br`
- [ ] Verificar se `ml.aitradingapi.roilabs.com.br` está disponível

## 🚀 Passo a Passo - Railway

### 1. **Login no Railway**
1. Acesse: https://railway.app
2. Click "Login" → "Login with GitHub"
3. Autorize a conexão Railway ↔ GitHub

### 2. **Criar Novo Projeto**
1. Dashboard Railway → **"New Project"**
2. **"Deploy from GitHub repo"**
3. Selecione seu repositório: `tape-vision-ai-92-main`
4. **IMPORTANTE**: Click "Configure" antes de deploy

### 3. **Configuração Específica**
```
Build Configuration:
✅ Root Directory: MLEngine
✅ Build Command: (auto-detect Dockerfile.prod)
✅ Start Command: python main.py

Environment Variables:
HOST=0.0.0.0
PORT=8001
ENVIRONMENT=production
CONFIDENCE_THRESHOLD=0.90
```

### 4. **Configurar Portas**
⚠️ **Railway usa PORT automática, mas nossa app usa 8001:**

**Solução A - Deixar Railway gerenciar:**
```python
# No main.py, alterar para:
PORT = int(os.getenv("PORT", 8001))  # Railway define PORT automaticamente
```

**Solução B - Forçar 8001:**
```
# Environment Variables no Railway:
PORT=8001
```

### 5. **Deploy Inicial**
1. Click **"Deploy"**
2. Aguarde build (~5-10 minutos)
3. Railway gerará URL temporária: `your-app-production-abc123.up.railway.app`

### 6. **Teste da URL Temporária**
```bash
curl https://your-app-production-abc123.up.railway.app/health

# Esperado:
{
  "status": "healthy",
  "service": "ai-trading-api",
  "version": "1.0.0"
}
```

### 7. **Configurar Domínio Customizado**

**No Railway Dashboard:**
1. Projeto → **Settings** → **Domains**
2. **"Custom Domain"** → `ml.aitradingapi.roilabs.com.br`
3. Railway mostrará:
   ```
   CNAME Record Required:
   Name: ml.aitradingapi
   Value: your-app-production-abc123.up.railway.app
   ```

### 8. **Configurar DNS**

**No Cloudflare/Registro.br:**
```dns
Type: CNAME
Name: ml.aitradingapi (ou apenas 'ml' dependendo do painel)
Value: your-app-production-abc123.up.railway.app
TTL: Auto (ou 300)
```

**Verificar DNS:**
```bash
nslookup ml.aitradingapi.roilabs.com.br
# Deve retornar o IP do Railway
```

### 9. **Aguardar Propagação**
- DNS: 5-60 minutos
- SSL: Automático via Railway (pode levar até 30 min)

## 🔍 **Verificação Final**

### Health Check:
```bash
curl https://ml.aitradingapi.roilabs.com.br/health
```

### API Documentation:
```
https://ml.aitradingapi.roilabs.com.br/v1/docs
```

### Teste Completo:
```bash
# Análise de mercado
curl -X POST "https://ml.aitradingapi.roilabs.com.br/v1/analyze" \
  -H "Content-Type: application/json" \
  -d '{
    "market_data": {
      "symbol": "WDO", 
      "price": 4580.25,
      "volume": 150
    }
  }'
```

## ⚠️ **Resolução de Conflitos**

### **Se `aitradingapi.roilabs.com.br` já existe no EasyPanel:**

**Estratégia 1: Subdomínios Separados**
```
EasyPanel Backend: aitradingapi.roilabs.com.br
Railway ML Engine: ml.aitradingapi.roilabs.com.br
```

**Estratégia 2: Path Routing no EasyPanel**
```nginx
# No EasyPanel, adicionar proxy reverso:
location /ml {
    proxy_pass https://your-railway-app.up.railway.app;
    proxy_set_header Host $host;
}

# Resultado:
# aitradingapi.roilabs.com.br/ml/v1/docs
```

**Estratégia 3: Integração Completa**
- Migrar backend EasyPanel para Railway
- Usar um único domínio para tudo

## 🐛 **Troubleshooting**

### Build Falha:
```bash
# Verificar logs no Railway Dashboard
# Problema comum: dependências Python
# Solução: usar requirements-simple.txt
```

### Port Issues:
```python
# Certificar que main.py usa:
PORT = int(os.getenv("PORT", 8001))
uvicorn.run("main:app", host=HOST, port=PORT)
```

### DNS não resolve:
```bash
# Verificar propagação:
dig ml.aitradingapi.roilabs.com.br

# Flush DNS local:
ipconfig /flushdns  # Windows
```

### SSL Certificate Issues:
- Railway gerencia SSL automaticamente
- Pode levar até 30 minutos para provisionar
- Verificar se CNAME está correto

## 📊 **Custos Railway**

**Hobby Plan (Gratuito):**
- $5 crédito mensal
- Suficiente para testes e desenvolvimento
- Sleep após inatividade

**Pro Plan ($20/mês):**
- Sem sleep
- Métricas avançadas
- Domínios ilimitados

## ✅ **Checklist Final**

- [ ] Railway projeto criado e conectado ao GitHub
- [ ] Build completou sem erros
- [ ] Health check responde na URL temporária
- [ ] Domínio customizado configurado
- [ ] DNS CNAME record criado
- [ ] SSL certificate ativo
- [ ] API docs acessível em `/v1/docs`
- [ ] Endpoints testados com sucesso

---

**🎉 Resultado Final:**
**https://ml.aitradingapi.roilabs.com.br/v1/docs**