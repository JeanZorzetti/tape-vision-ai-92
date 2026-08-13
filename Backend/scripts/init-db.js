#!/usr/bin/env node
/**
 * Creates the user table and seeds the accounts the app needs, then exits.
 * Idempotent — safe to re-run on every deploy.
 *
 * Usage: DATABASE_URL=... ADMIN_PASSWORD=... npm run db:init
 *
 * ponytail: plain DDL + upsert instead of a migration framework. Swap in one
 * (node-pg-migrate, Prisma) when there is a second migration to order.
 */
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql } = require('../src/db');

// The login screen publishes the demo password, so it is not a secret. The admin
// and service accounts are, and must come from the environment.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo2025';
const ML_ENGINE_PASSWORD = process.env.ML_ENGINE_PASSWORD;

if (!ADMIN_PASSWORD || !ML_ENGINE_PASSWORD) {
  console.error('ADMIN_PASSWORD and ML_ENGINE_PASSWORD are required.');
  process.exit(1);
}

const SEED_USERS = [
  {
    email: process.env.ADMIN_EMAIL || 'admin@aitrading.com',
    password: ADMIN_PASSWORD,
    name: 'Admin User',
    role: 'ADMIN',
    permissions: ['TRADING_ENABLED', 'ML_ACCESS', 'ADMIN_ACCESS'],
  },
  {
    email: 'demo@aitrading.com',
    password: DEMO_PASSWORD,
    name: 'Demo User',
    role: 'TRADER',
    permissions: ['TRADING_ENABLED', 'ML_ACCESS'],
  },
  {
    email: process.env.ML_ENGINE_EMAIL || 'ml.engine@aitrading.roilabs.com.br',
    password: ML_ENGINE_PASSWORD,
    name: 'ML Engine Service',
    role: 'SERVICE',
    permissions: ['ML_ENGINE_ACCESS', 'DATA_ACCESS', 'TRADING_ENABLED', 'ML_ACCESS'],
  },
];

async function main() {
  await sql`
    create table if not exists app_user (
      id            text primary key default gen_random_uuid()::text,
      email         text not null unique,
      password_hash text not null,
      name          text not null,
      role          text not null,
      permissions   text[] not null default '{}',
      created_at    timestamptz not null default now()
    )
  `;

  for (const user of SEED_USERS) {
    const hash = await bcrypt.hash(user.password, 10);
    await sql`
      insert into app_user (email, password_hash, name, role, permissions)
      values (${user.email.toLowerCase()}, ${hash}, ${user.name}, ${user.role}, ${user.permissions})
      on conflict (email) do update
        set password_hash = excluded.password_hash,
            name          = excluded.name,
            role          = excluded.role,
            permissions   = excluded.permissions
    `;
    console.log(`seeded ${user.email} (${user.role})`);
  }

  const [{ count }] = await sql`select count(*)::int as count from app_user`;
  console.log(`app_user ready — ${count} users`);
  await sql.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
