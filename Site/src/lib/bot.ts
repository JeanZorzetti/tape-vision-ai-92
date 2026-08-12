// Layered bot rejection, all server-side (FR-016, research R7). Rate limiting is
// enforced via the database, not process memory — serverless instances don't share
// memory (T065), so an in-process counter would never actually limit anything.
import { createHash } from 'node:crypto';
import sql from './db';

const TOO_FAST_MS = 2000;
const RATE_LIMIT_PER_HOUR = 5;

export function isHoneypotFilled(empresa: string): boolean {
  return empresa.trim().length > 0;
}

export function isTooFast(renderedAt: number, now: number = Date.now()): boolean {
  return now - renderedAt < TOO_FAST_MS;
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? '';
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}

export async function isRateLimited(ipHash: string): Promise<boolean> {
  const rows = await sql<{ count: number }[]>`
    select count(*)::int as count
    from waitlist_lead
    where ip_hash = ${ipHash}
      and created_at > now() - interval '1 hour'
      and deleted_at is null
  `;
  return (rows[0]?.count ?? 0) >= RATE_LIMIT_PER_HOUR;
}

export interface BotCheckInput {
  empresa: string;
  renderedAt: number;
  ipHash: string;
}

export type BotReason = 'honeypot' | 'too_fast' | 'rate_limited';

export interface BotCheckResult {
  isBot: boolean;
  reason?: BotReason;
}

/** Honeypot and timing are checked before the DB round-trip — cheapest checks first. */
export async function checkBot(input: BotCheckInput): Promise<BotCheckResult> {
  if (isHoneypotFilled(input.empresa)) return { isBot: true, reason: 'honeypot' };
  if (isTooFast(input.renderedAt)) return { isBot: true, reason: 'too_fast' };
  if (await isRateLimited(input.ipHash)) return { isBot: true, reason: 'rate_limited' };
  return { isBot: false };
}
