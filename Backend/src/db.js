/**
 * Postgres-backed user store.
 *
 * Replaces the hardcoded in-memory `users` array the production server shipped
 * with, which kept passwords in plaintext and lost every change on restart.
 */
const postgres = require('postgres');
const bcrypt = require('bcrypt');

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required — the user store lives in Postgres');
}

// TLS mode comes from `sslmode` in the connection string. Hardcoding `ssl` here
// overrides it and breaks the self-hosted Postgres (same trap as Site/src/lib/db.ts).
const sql = postgres(process.env.DATABASE_URL);

// A wrong email and a wrong password must cost the same time, otherwise the
// response time tells an attacker which accounts exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

const PUBLIC_FIELDS = ['id', 'email', 'name', 'role', 'permissions'];

function toPublicUser(row) {
  return Object.fromEntries(PUBLIC_FIELDS.map((f) => [f, row[f]]));
}

/** Returns the public user shape when the password matches, otherwise null. */
async function authenticate(email, password) {
  const [row] = await sql`
    select id, email, name, role, permissions, password_hash
    from app_user
    where email = lower(${email})
  `;
  const matches = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  return matches && row ? toPublicUser(row) : null;
}

async function findUserById(id) {
  const [row] = await sql`
    select id, email, name, role, permissions from app_user where id = ${id}
  `;
  return row ? toPublicUser(row) : null;
}

module.exports = { sql, authenticate, findUserById };
