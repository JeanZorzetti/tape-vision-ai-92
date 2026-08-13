/**
 * check-feed-gate.js
 *
 * Garante que os endpoints de trading NUNCA sirvam dado fabricado por acidente.
 * O projeto ainda não tem feed de mercado real (a fonte planejada é o agente local
 * Windows / ProfitDLL), então tudo em /api/trading/* que produzia preço, P&L ou
 * confirmação de ordem está atrás de `requireFeed` em src/server-production.js.
 *
 * Sobe o servidor em porta descartável e checa os dois lados do contrato:
 *   sem TAPE_MOCK_DATA  -> 503 NO_MARKET_FEED
 *   com TAPE_MOCK_DATA  -> 200 (fixtures liberadas para trabalho de UI)
 *
 * Uso: node scripts/check-feed-gate.js
 */
const { spawn } = require('child_process');
const path = require('path');
const jwt = require('jsonwebtoken');

const SERVER = path.join(__dirname, '..', 'src', 'server-production.js');
const JWT_SECRET = 'check-feed-gate-throwaway-secret';

const GATED = [
  ['GET', '/api/trading/status'],
  ['GET', '/api/trading/ml/predictions'],
  ['GET', '/api/trading/session/status'],
  ['POST', '/api/trading/session/start'],
  ['POST', '/api/trading/session/end'],
  ['GET', '/api/trading/orders'],
  ['POST', '/api/trading/orders'],
  ['GET', '/api/trading/positions'],
];

const token = jwt.sign({ id: 'check', email: 'check@local', permissions: [] }, JWT_SECRET, { expiresIn: '5m' });

function start(port, mock) {
  return spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      JWT_SECRET,
      NODE_ENV: 'development',
      // O servidor exige DATABASE_URL no require; auth aqui é só JWT, não toca o banco.
      DATABASE_URL: process.env.DATABASE_URL || 'postgres://x:x@127.0.0.1:5999/x',
      TAPE_MOCK_DATA: mock ? 'true' : '',
    },
    stdio: 'ignore',
  });
}

const hit = (port, method, p) =>
  fetch(`http://127.0.0.1:${port}${p}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: method === 'POST' ? '{}' : undefined,
  });

async function waitUp(port) {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://127.0.0.1:${port}/health`); return true; } catch { /* ainda subindo */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`servidor não subiu na porta ${port}`);
}

(async () => {
  let failures = 0;
  const check = (ok, label) => {
    if (!ok) failures++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  };

  // --- gate ativo (padrão de produção) ---
  const closed = start(3997, false);
  try {
    await waitUp(3997);
    for (const [method, p] of GATED) {
      const res = await hit(3997, method, p);
      const body = await res.json().catch(() => ({}));
      check(res.status === 503 && body.error === 'NO_MARKET_FEED', `${method} ${p} -> ${res.status} ${body.error || ''}`);
    }
    const noAuth = await fetch('http://127.0.0.1:3997/api/trading/status');
    check(noAuth.status === 401, `sem token -> ${noAuth.status} (esperado 401)`);
  } finally {
    closed.kill();
  }

  // --- fixtures liberadas para UI ---
  const open = start(3996, true);
  try {
    await waitUp(3996);
    const res = await hit(3996, 'GET', '/api/trading/status');
    check(res.status === 200, `TAPE_MOCK_DATA=true: /api/trading/status -> ${res.status} (esperado 200)`);
  } finally {
    open.kill();
  }

  console.log(failures === 0 ? '\nOK: nenhum dado fabricado escapa sem a flag.' : `\n${failures} check(s) falharam.`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(err => {
  console.error('ERRO:', err.message);
  process.exit(1);
});
