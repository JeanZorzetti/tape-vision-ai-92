import { describe, it, expect, vi, beforeEach } from 'vitest';

const sqlMock = vi.fn();
vi.mock('../../src/lib/db', () => ({
  default: (...args: unknown[]) => sqlMock(...args),
}));

const { isHoneypotFilled, isTooFast, checkBot } = await import('../../src/lib/bot');

describe('bot heuristics (contracts/waitlist-api.md test cases 3-5)', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('isHoneypotFilled / isTooFast are pure and cheap', () => {
    expect(isHoneypotFilled('')).toBe(false);
    expect(isHoneypotFilled('Acme')).toBe(true);
    expect(isTooFast(Date.now() - 10_000)).toBe(false);
    expect(isTooFast(Date.now())).toBe(true);
  });

  it('case 3: honeypot filled is silently flagged without touching the DB', async () => {
    const result = await checkBot({ empresa: 'Acme', renderedAt: Date.now() - 10_000, ipHash: 'h' });
    expect(result).toEqual({ isBot: true, reason: 'honeypot' });
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('case 4: submission under 2s is silently flagged without touching the DB', async () => {
    const result = await checkBot({ empresa: '', renderedAt: Date.now(), ipHash: 'h' });
    expect(result).toEqual({ isBot: true, reason: 'too_fast' });
    expect(sqlMock).not.toHaveBeenCalled();
  });

  it('case 5: 6th submission within an hour from the same IP hash is silently flagged', async () => {
    sqlMock.mockResolvedValueOnce([{ count: 5 }]);
    const result = await checkBot({ empresa: '', renderedAt: Date.now() - 10_000, ipHash: 'h' });
    expect(result).toEqual({ isBot: true, reason: 'rate_limited' });
  });

  it('accepts a legitimate, well-timed, under-limit submission', async () => {
    sqlMock.mockResolvedValueOnce([{ count: 0 }]);
    const result = await checkBot({ empresa: '', renderedAt: Date.now() - 10_000, ipHash: 'h' });
    expect(result).toEqual({ isBot: false });
  });
});
