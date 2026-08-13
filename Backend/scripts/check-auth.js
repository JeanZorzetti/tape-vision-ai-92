#!/usr/bin/env node
/**
 * Self-check for the Postgres user store. Creates a throwaway account, exercises
 * every branch of authenticate()/findUserById(), then removes it.
 *
 * Usage: DATABASE_URL=... node scripts/check-auth.js
 */
require('dotenv').config();
const assert = require('assert');
const bcrypt = require('bcryptjs');
const { sql, authenticate, findUserById } = require('../src/db');

const EMAIL = 'selfcheck@tapevision.local';
const PASSWORD = 'correct-horse-battery-staple';

async function main() {
  await sql`delete from app_user where email = ${EMAIL}`;
  const hash = await bcrypt.hash(PASSWORD, 10);
  const [created] = await sql`
    insert into app_user (email, password_hash, name, role, permissions)
    values (${EMAIL}, ${hash}, 'Self Check', 'TRADER', ${['TRADING_ENABLED']})
    returning id
  `;

  try {
    const ok = await authenticate(EMAIL, PASSWORD);
    assert.ok(ok, 'correct password must authenticate');
    assert.strictEqual(ok.email, EMAIL);
    assert.deepStrictEqual(ok.permissions, ['TRADING_ENABLED'], 'permissions round-trip as an array');
    assert.strictEqual(ok.password_hash, undefined, 'hash must never reach the caller');

    assert.strictEqual(await authenticate(EMAIL, 'wrong'), null, 'wrong password rejected');
    assert.strictEqual(await authenticate('nobody@nowhere.local', PASSWORD), null, 'unknown email rejected');
    assert.ok(await authenticate(EMAIL.toUpperCase(), PASSWORD), 'email match is case-insensitive');

    const byId = await findUserById(created.id);
    assert.strictEqual(byId.email, EMAIL, 'findUserById round-trips');
    assert.strictEqual(await findUserById('no-such-id'), null, 'unknown id returns null');

    console.log('check-auth: all assertions passed');
  } finally {
    await sql`delete from app_user where email = ${EMAIL}`;
    await sql.end();
  }
}

main().catch((err) => {
  console.error('check-auth FAILED:', err.message);
  process.exit(1);
});
