# ⚡ Vercel Deployment Guide - ML Engine API

## 🎯 **Objetivo Final**
Deploy da ML Engine para: **https://ml.aitradingapi.roilabs.com.br/v1/docs**

## 🚀 **Vantagens do Vercel para FastAPI:**
- ✅ **Serverless** - Paga apenas pelo uso
- ✅ **Deploy automático** via GitHub
- ✅ **Global CDN** - Baixa latência mundial  
- ✅ **SSL grátis** - Certificados automáticos
- ✅ **Domínios customizados** - Suporte completo
- ✅ **Zero configuração** de servidor

## 📋 **Pré-requisitos**
- [ ] Conta GitHub 
- [ ] Repositório com código MLEngine
- [ ] Acesso ao DNS `roilabs.com.br`

---

## 🔥 **Deploy Passo a Passo**

### **1. Preparar Vercel Account**
1. Acesse: https://vercel.com
2. **"Sign up with GitHub"**
3. Autorize conexão GitHub ↔ Vercel

### **2. Importar Projeto**
1. Dashboard Vercel → **"Add New..." → "Project"**
2. **"Import Git Repository"**
3. Selecione: `tape-vision-ai-92-main`
4. **⚠️ IMPORTANTE: Configure Root Directory**

### **3. Configuração Específica**
```
Framework Preset: Other
Root Directory: MLEngine  ← CRUCIAL!
Build Command: (leave empty)
Output Directory: (leave empty)
Install Command: pip install -r requirements-simple.txt
```

### **4. Environment Variables (Durante Import)**
```
ENVIRONMENT = production
CONFIDENCE_THRESHOLD = 0.90
```

### **5. Deploy Inicial**
1. Click **"Deploy"**
2. Aguarde build (~3-5 minutos)
3. Vercel gerará URL automática: `ml-engine-abc123.vercel.app`

### **6. Teste URL Temporária**
```bash
# Health check
curl https://ml-engine-abc123.vercel.app/health

# API Docs  
https://ml-engine-abc123.vercel.app/v1/docs
```

### **7. Configurar Domínio Customizado**

**No Vercel Dashboard:**
1. Projeto → **Settings** → **Domains**
2. **"Add Domain"** → `ml.aitradingapi.roilabs.com.br`
3. Vercel mostrará DNS Configuration:

```dns
Type: CNAME
Name: ml.aitradingapi (ou apenas 'ml')
Value: cname.vercel-dns.com
```

### **8. Configurar DNS**
**No Cloudflare/Registro.br:**
```dns
Type: CNAME
Name: ml.aitradingapi 
Value: cname.vercel-dns.com
TTL: Auto
```

### **9. Aguardar Propagação**
- **DNS**: 5-60 minutos
- **SSL**: Automático (1-5 minutos)

---

## ✅ **Verificação Final**

### **Health Check:**
```bash
curl https://ml.aitradingapi.roilabs.com.br/health
```

### **API Documentation:**
```
https://ml.aitradingapi.roilabs.com.br/v1/docs
```

### **Teste Completo de Análise:**
```bash
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

---

## 🔧 **Configurações Específicas Vercel**

### **Arquivo Estrutura:**
```
MLEngine/
├── main.py                 # FastAPI app principal
├── api/
│   └── index.py           # Entry point para Vercel
├── vercel.json            # Configuração Vercel
├── requirements-simple.txt # Dependencies
└── ...
```

### **vercel.json Otimizado:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.py",
      "use": "@vercel/python",
      "config": {
        "maxLambdaSize": "50mb"
      }
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "api/index.py"
    }
  ],
  "functions": {
    "api/index.py": {
      "maxDuration": 30
    }
  }
}
```

---

## 🎛️ **Configurações Avançadas**

### **Auto-Deploy Setup:**
1. Vercel Dashboard → **Settings** → **Git**  
2. **Production Branch**: `main`
3. ✅ **Automatically deploy all pushes**

### **Preview Deployments:**
- Cada PR gera URL preview automática
- Teste mudanças antes do merge
- URL: `ml-engine-git-feature-branch.vercel.app`

### **Analytics & Monitoring:**
1. **Settings** → **Analytics** → Enable
2. Monitor requests, performance, errors
3. Real-time metrics dashboard

---

## 💰 **Custos Vercel**

### **Hobby Plan (Gratuito):**
- 100GB bandwidth/mês
- Serverless functions ilimitadas
- Domínios customizados ✅
- **Suficiente para maioria das APIs**

### **Pro Plan ($20/mês):**
- 1TB bandwidth
- Analytics avançado
- Faster builds
- Team collaboration

---

## 🐛 **Troubleshooting**

### **Build Falha - Dependências:**
```
# Error comum: NumPy/SciPy compilation
# Solução: usar requirements-simple.txt (sem TA-Lib)
```

### **Import Errors:**
```python
# api/index.py deve importar corretamente:
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app
```

### **Timeout Issues:**
```json
// vercel.json - aumentar timeout:
"functions": {
  "api/index.py": {
    "maxDuration": 60  // máximo para Hobby plan
  }
}
```

### **CORS Issues:**
```python
# main.py - verificar CORS middleware:
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://ml.aitradingapi.roilabs.com.br"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)
```

---

## 📊 **Monitoramento Produção**

### **Vercel Functions Dashboard:**
- Real-time logs
- Execution time metrics
- Error rates
- Invocation counts

### **Custom Monitoring:**
```python
# Adicionar ao main.py:
import time

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    logger.info(f"Path: {request.url.path} - Duration: {process_time:.4f}s")
    return response
```

---

## 🎉 **Resultado Final**

### **URLs Funcionais:**
- **API Docs**: `https://ml.aitradingapi.roilabs.com.br/v1/docs`
- **Health**: `https://ml.aitradingapi.roilabs.com.br/health`
- **Analysis**: `https://ml.aitradingapi.roilabs.com.br/v1/analyze`
- **Patterns**: `https://ml.aitradingapi.roilabs.com.br/v1/patterns`

### **Architecture Final:**
```
Frontend ← → Backend EasyPanel (apitapevision.roilabs.com.br)
              ↓
         ML Engine Vercel (ml.aitradingapi.roilabs.com.br)
```

**🚀 API ML pronta para produção com Vercel serverless!**