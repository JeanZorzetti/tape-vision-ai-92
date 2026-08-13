# Production Deployment Guide

## Environment Variables Configuration

### 1. Vercel Frontend (apptapevision.roilabs.com.br)

**Environment Variables to set in Vercel Dashboard:**

```env
VITE_API_URL=https://apitapevision.roilabs.com.br
VITE_WS_URL=wss://apitapevision.roilabs.com.br
VITE_ENV=production
VITE_NODE_ENV=production
VITE_DEBUG=false
GENERATE_SOURCEMAP=false
```

**Setup Steps:**
1. Go to Vercel Dashboard → Your Frontend Project
2. Navigate to Settings → Environment Variables
3. Add each variable with Production scope
4. Redeploy the project

### 2. Vercel ML Engine (ml.aitrading.roilabs.com.br)

**Environment Variables to set in Vercel Dashboard:**

```env
BACKEND_URL=https://apitapevision.roilabs.com.br
BACKEND_API_KEY=ml-engine-api-key-2025
ML_ENGINE_EMAIL=ml.engine@aitrading.roilabs.com.br
ML_ENGINE_PASSWORD=MLEngine@2025!
NODE_ENV=production
PYTHONPATH=/var/task
FLASK_ENV=production
FLASK_DEBUG=False
VERCEL_ENV=production
VERCEL_URL=ml.aitrading.roilabs.com.br
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=3600
LOG_LEVEL=info
LOG_FORMAT=json
```

**Setup Steps:**
1. Go to Vercel Dashboard → Your ML Engine Project
2. Navigate to Settings → Environment Variables
3. Add each variable with Production scope
4. Redeploy the project

### 3. Backend (apitapevision.roilabs.com.br)

`server-production.js` is a stateless Express app — no WebSocket, no background
timers — so it runs as a Vercel serverless function (`api/index.js` exports it,
`vercel.json` rewrites every path to it) or as a normal long-running process on
Easypanel (`npm start`). Vercel is the shorter path: the DNS record already
points there, and the certificate is issued as soon as the domain is attached to
a project.

**Environment Variables to set in Easypanel:**

```env
NODE_ENV=production
PORT=3001
# Users live in Postgres (table app_user). Same instance as the Site waitlist.
DATABASE_URL=postgres://tape_db:<senha>@<host>:5456/tape_db?sslmode=disable
JWT_SECRET=tape-vision-prod-secret-2025-roilabs-br
JWT_EXPIRES=24h
JWT_REFRESH_EXPIRES=30d
FRONTEND_URL=https://apptapevision.roilabs.com.br
ML_ENGINE_URL=https://ml.aitrading.roilabs.com.br
ALLOWED_ORIGINS=https://apptapevision.roilabs.com.br,https://ml.aitrading.roilabs.com.br
RATE_LIMIT_REQUESTS=1000
RATE_LIMIT_WINDOW=3600
ENABLE_RATE_LIMITING=true
ML_ENGINE_API_KEY=ml-engine-api-key-2025
ADMIN_API_KEY=admin-api-key-2025
TRADING_ENABLED=true
MAX_DAILY_LOSS=500
MAX_POSITION_SIZE=2
TARGET_POINTS=2
STOP_LOSS_POINTS=1.5
WS_PORT=3002
LOG_LEVEL=info
```

**Setup Steps (Vercel):**
1. New Vercel project with `Backend/` as the root directory
2. Attach the domain `apitapevision.roilabs.com.br` — the DNS record already
   points at Vercel, so the certificate is issued once a project claims it
3. Add the environment variables above (Production scope)
4. Deploy

**Setup Steps (Easypanel, alternative):**
1. Point `apitapevision.roilabs.com.br` at the Easypanel host with an A record
2. Add the environment variables, deploy `src/server-production.js` as entry point

**Seed the user table once** (from a machine that reaches Postgres):
`ADMIN_EMAIL=... ADMIN_PASSWORD=... ML_ENGINE_PASSWORD=... npm run db:init`

Verify the store with `node scripts/check-auth.js` — it creates a throwaway
account, exercises every auth branch, and deletes it.

## File Structure for Production

```
Backend/
├── src/
│   ├── server-production.js    ← Deploy this file
│   ├── server-auth.js          ← Backup/development
│   └── server-minimal.ts       ← Backup/development
├── .env.production             ← Production environment template
└── package.json

Frontend/
├── .env.production             ← Production environment variables
├── .env.local                  ← Local development
└── .env                        ← Base production

ML Engine/
├── .env.production             ← Production environment variables
└── [ML Engine files]
```

## Production User Accounts

The production server includes these accounts:

1. **Demo User**
   - Email: `demo@aitrading.com`
   - Password: `demo2025`
   - Role: `TRADER`

2. **Admin User**
   - Email: `admin@aitrading.com`
   - Password: `admin2025`
   - Role: `ADMIN`

3. **ML Engine Service**
   - Email: `ml.engine@aitrading.roilabs.com.br`
   - Password: `MLEngine@2025!`
   - Role: `SERVICE`

## Testing Production Environment

After deployment, test these endpoints:

1. **Backend Health Check:**
   ```
   GET https://apitapevision.roilabs.com.br/health
   ```

2. **Authentication:**
   ```
   POST https://apitapevision.roilabs.com.br/api/auth/login
   {
     "email": "demo@aitrading.com",
     "password": "demo2025"
   }
   ```

3. **ML Engine Integration:**
   ```
   GET https://apitapevision.roilabs.com.br/api/trading/ml/predictions
   Authorization: Bearer [token]
   ```

4. **Frontend Access:**
   ```
   https://apptapevision.roilabs.com.br
   ```

5. **ML Engine Access:**
   ```
   https://ml.aitrading.roilabs.com.br
   ```

## Deployment Commands

### Backend (Easypanel)

**IMPORTANTE: Configure o servidor para usar as rotas de autenticação!**

O problema atual é que o Easypanel está executando `server-minimal.js` que NÃO tem as rotas de autenticação (`/api/auth/login`, etc.).

**Configuração no Easypanel:**

1. **Comando de Start:** Use `npm start` (já configurado para `server-production.js`)
2. **Ou usar diretamente:** `node src/server-production.js`
3. **Port:** 3001 (configurado no .env.production)

**Verificação das rotas disponíveis:**
- ❌ `server-minimal.js` → Não tem rotas `/api/auth/*`  
- ✅ `server-production.js` → Tem todas as rotas de autenticação
- ✅ `server-auth.js` → Alternativa com autenticação

**Configuração recomendada no Easypanel:**
```bash
# Start Command
npm start

# Ou alternativo
node src/server-production.js
```

### Frontend (Vercel)
```bash
# Build with production environment
npm run build
```

### ML Engine (Vercel)
```bash
# Deploy with Python runtime
vercel deploy --prod
```

## Security Notes

- All secrets are properly configured via environment variables
- CORS is restricted to specific origins
- JWT tokens use strong secrets
- Rate limiting is enabled
- Request logging is active for monitoring
- Helmet security middleware is enabled

## Monitoring

Monitor these aspects after deployment:

1. **Backend Logs** (Easypanel Dashboard)
2. **Frontend Build Logs** (Vercel Dashboard)
3. **ML Engine Function Logs** (Vercel Dashboard)
4. **Authentication Flow** (Login/Logout)
5. **API Response Times**
6. **Error Rates**

## Troubleshooting

**Common Issues:**

1. **404 on authentication endpoints** → Verify Backend is running server-production.js
2. **CORS errors** → Check ALLOWED_ORIGINS environment variable
3. **JWT errors** → Verify JWT_SECRET is consistent across services
4. **ML Engine auth failures** → Check ML_ENGINE_EMAIL/PASSWORD credentials
