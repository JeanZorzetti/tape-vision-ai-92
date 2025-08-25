# 📁 Backend Configuration Files

Este diretório contém todos os arquivos de configuração do sistema de trading Tape Vision AI.

## 🗂️ Estrutura de Arquivos

### 📋 Configurações Principais

| Arquivo | Descrição | Uso |
|---------|-----------|-----|
| `default.json` | Configurações base do sistema | Carregado sempre |
| `development.json` | Sobrescreve configs para desenvolvimento | NODE_ENV=development |
| `production.json` | Sobrescreve configs para produção | NODE_ENV=production |

### 🎯 Configurações Especializadas

| Arquivo | Descrição | Conteúdo |
|---------|-----------|----------|
| `trading.json` | Parâmetros de trading e estratégias | Símbolos, risk management, estratégias |
| `database.json` | Configurações de banco de dados | MongoDB, Redis, backups |
| `logging.json` | Sistema de logs | Níveis, transports, auditoria |
| `secrets.json.example` | Template para credenciais | API keys, senhas, tokens |

## 🚀 Como Usar

### 1. **Desenvolvimento Local**
```bash
# Configurações carregadas automaticamente:
# 1. default.json
# 2. development.json (sobrescreve default)
NODE_ENV=development npm run dev
```

### 2. **Produção**
```bash
# Configurações carregadas:
# 1. default.json  
# 2. production.json (sobrescreve default)
NODE_ENV=production npm start
```

### 3. **Configurar Secrets**
```bash
# Copie o template
cp config/secrets.json.example config/secrets.json

# Edite com suas credenciais reais
nano config/secrets.json
```

## 🔐 Segurança

### ⚠️ **IMPORTANTE - Nunca commite secrets!**
- `secrets.json` está no `.gitignore`
- Use `secrets.json.example` como template
- Credenciais reais apenas em produção

### 🛡️ **Variáveis de Ambiente**
As configurações podem ser sobrescritas por variáveis de ambiente:
```bash
TRADING_ENABLED=true
MAX_DAILY_LOSS=1000
MONGODB_URI=mongodb://localhost:27017/my-db
```

## 📊 Principais Configurações

### 🎯 **Trading Parameters**
```json
{
  "trading": {
    "enabled": false,           // Ativar trading real
    "maxDailyLoss": 500,       // Perda máxima diária (R$)
    "maxPositionSize": 2,      // Contratos máximos
    "targetPoints": 2,         // Meta por trade
    "stopLossPoints": 1.5,     // Stop loss
    "confidenceThreshold": 0.9 // Confiança mínima
  }
}
```

### 🤖 **AI Settings**
```json
{
  "ai": {
    "analysisSettings": {
      "confidenceThreshold": 0.9,      // Confiança mínima
      "maxSignalsPerHour": 10,         // Sinais por hora
      "enablePatternRecognition": true, // Reconhecimento de padrões
      "processingTimeout": 5000        // Timeout análise (ms)
    }
  }
}
```

### 🎮 **WebSocket**
```json
{
  "websocket": {
    "port": 3002,
    "pingInterval": 25000,
    "maxHttpBufferSize": 1000000
  }
}
```

## 🔧 Carregamento de Configuração

O sistema usa a biblioteca `config` do Node.js com a seguinte ordem de precedência:

1. **Variáveis de ambiente**
2. **Arquivo específico do ambiente** (`development.json`, `production.json`)
3. **Arquivo padrão** (`default.json`)

### Exemplo de Uso no Código:
```javascript
const config = require('config');

// Acessar configuração
const tradingEnabled = config.get('trading.enabled');
const dbUri = config.get('database.mongodb.uri');
const maxLoss = config.get('trading.maxDailyLoss');
```

## 📈 Monitoramento

### 🚨 **Logs**
- **Error logs:** `./logs/error-YYYY-MM-DD.log`
- **Trading logs:** `./logs/trading-YYYY-MM-DD.log`
- **Combined logs:** `./logs/combined-YYYY-MM-DD.log`

### 📊 **Métricas**
- Latência máxima: 10ms
- Uso de memória: <80%
- Uso de CPU: <70%

## 🚀 Deploy

### **EasyPanel**
1. Configure as variáveis de ambiente no painel
2. O sistema carregará automaticamente `production.json`
3. Variáveis de ambiente sobrescrevem configs do arquivo

### **Docker**
```bash
# Build com configurações
docker build -t tape-vision-backend .

# Run com variáveis de ambiente
docker run -e NODE_ENV=production \
           -e TRADING_ENABLED=false \
           -e MONGODB_URI=mongodb://mongo:27017/tape-vision \
           tape-vision-backend
```

## ✅ Validação

Todas as configurações são validadas na inicialização do sistema. Erros de configuração impedem a inicialização com logs claros sobre o problema.