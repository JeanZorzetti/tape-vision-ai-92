import { describe, it, expect, vi, beforeEach } from 'vitest';

const insertLead = vi.fn();
vi.mock('../../src/lib/db', () => ({
  insertLead: (...args: unknown[]) => insertLead(...args),
  markCrmSynced: vi.fn(),
  markCrmFailed: vi.fn(),
}));

const checkBot = vi.fn();
vi.mock('../../src/lib/bot', () => ({
  checkBot: (...args: unknown[]) => checkBot(...args),
  hashIp: () => 'hashed-ip',
}));

const syncLeadToRoihub = vi.fn();
vi.mock('../../src/lib/roihub', () => ({
  syncLeadToRoihub: (...args: unknown[]) => syncLeadToRoihub(...args),
}));

const { POST, GET } = await import('../../src/pages/api/waitlist');

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
}

function formRequest(fields: Record<string, string>) {
  return new Request('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(fields).toString(),
  });
}

const validBody = {
  name: 'Maria Souza',
  email: 'maria@exemplo.com.br',
  consent: true,
  empresa: '',
  renderedAt: Date.now() - 10_000,
  sourcePage: '/',
  referrer: 'https://www.google.com/',
};

describe('POST /api/waitlist (contracts/waitlist-api.md test cases)', () => {
  beforeEach(() => {
    insertLead.mockReset();
    checkBot.mockReset();
    syncLeadToRoihub.mockReset();
    checkBot.mockResolvedValue({ isBot: false });
    syncLeadToRoihub.mockResolvedValue(undefined);
  });

  it('case 1: valid body, new email → 200 ok:true, exactly one insert attempted', async () => {
    insertLead.mockResolvedValueOnce({ id: 'lead-1', email: validBody.email });
    const response = await POST({
      request: jsonRequest(validBody),
      clientAddress: '203.0.113.1',
    } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(insertLead).toHaveBeenCalledTimes(1);
  });

  it('case 2: valid body, existing active email → still 200 ok:true (idempotent, on-conflict-do-nothing)', async () => {
    insertLead.mockResolvedValueOnce(null);
    const response = await POST({
      request: jsonRequest(validBody),
      clientAddress: '203.0.113.1',
    } as never);
    expect(response.status).toBe(200);
    expect((await response.json()).ok).toBe(true);
  });

  it('case 9: form-encoded body, valid → 200 ok:true (no-JS path works)', async () => {
    insertLead.mockResolvedValueOnce({ id: 'lead-2', email: validBody.email });
    const response = await POST({
      request: formRequest({
        name: validBody.name,
        email: validBody.email,
        consent: 'true',
        empresa: '',
        renderedAt: String(validBody.renderedAt),
        sourcePage: '/',
      }),
      clientAddress: '203.0.113.1',
    } as never);
    expect(response.status).toBe(200);
  });

  it('case 10: roihub sync failing never affects the visitor response', async () => {
    insertLead.mockResolvedValueOnce({ id: 'lead-3', email: validBody.email });
    syncLeadToRoihub.mockRejectedValueOnce(new Error('roihub unreachable'));
    const response = await POST({
      request: jsonRequest(validBody),
      clientAddress: '203.0.113.1',
    } as never);
    expect(response.status).toBe(200);
  });

  it('case 11: DB unreachable → 500, no stack trace or connection string leaked', async () => {
    insertLead.mockRejectedValueOnce(new Error('connection to postgres://user:pass@host/db failed'));
    const response = await POST({
      request: jsonRequest(validBody),
      clientAddress: '203.0.113.1',
    } as never);
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('postgres://');
    expect(text).not.toContain('user:pass');
  });

  it('case 12: GET is not allowed', async () => {
    const response = await GET({} as never);
    expect(response.status).toBe(405);
  });
});
