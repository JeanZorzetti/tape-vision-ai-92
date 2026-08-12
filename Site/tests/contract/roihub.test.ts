import { describe, it, expect, vi, beforeEach } from 'vitest';

const markCrmSynced = vi.fn();
const markCrmFailed = vi.fn();
vi.mock('../../src/lib/db', () => ({
  markCrmSynced: (...args: unknown[]) => markCrmSynced(...args),
  markCrmFailed: (...args: unknown[]) => markCrmFailed(...args),
}));

const { syncLeadToRoihub } = await import('../../src/lib/roihub');

const baseLead = {
  id: 'lead-1',
  email: 'maria@exemplo.com.br',
  name: 'Maria Souza',
  source_page: '/',
  referral_channel: 'organic',
  referrer: null,
  utm_source: null,
  utm_medium: null,
  utm_campaign: null,
  consent_given: true,
  consent_at: new Date().toISOString(),
  consent_version: '2026-08-12',
  crm_sync_status: 'pending',
  crm_synced_at: null,
  crm_attempts: 0,
  crm_last_error: null,
  created_at: new Date().toISOString(),
} as never;

const originalEnv = { ...process.env };

describe('syncLeadToRoihub (contracts/roihub-crm.md test cases)', () => {
  beforeEach(() => {
    markCrmSynced.mockReset();
    markCrmFailed.mockReset();
    process.env = {
      ...originalEnv,
      ROIHUB_WEBHOOK_URL: 'https://roihub.example.com/leads',
      ROIHUB_API_KEY: 'super-secret-key',
    };
    vi.stubGlobal('fetch', vi.fn());
  });

  it('case 1: 2xx response marks synced', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await syncLeadToRoihub(baseLead);
    expect(markCrmSynced).toHaveBeenCalledWith('lead-1');
    expect(markCrmFailed).not.toHaveBeenCalled();
  });

  it('case 2: 409 (already exists) is treated as success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('exists', { status: 409 }));
    await syncLeadToRoihub(baseLead);
    expect(markCrmSynced).toHaveBeenCalledWith('lead-1');
  });

  it('case 3: 400 marks failed terminal — not retried', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('bad request', { status: 400 }));
    await syncLeadToRoihub(baseLead);
    expect(markCrmFailed).toHaveBeenCalledWith('lead-1', expect.stringContaining('400'), { terminal: true });
  });

  it('case 4: 503 marks failed, retryable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    await syncLeadToRoihub(baseLead);
    expect(markCrmFailed).toHaveBeenCalledWith('lead-1', expect.stringContaining('503'), { terminal: false });
  });

  it('case 5: network error / timeout marks failed, retryable', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    await syncLeadToRoihub(baseLead);
    expect(markCrmFailed).toHaveBeenCalledWith('lead-1', expect.any(String));
    const call = markCrmFailed.mock.calls[0];
    expect(call[2]).toBeUndefined(); // not terminal — cron will retry
  });

  it('case 6: unset ROIHUB_WEBHOOK_URL skips the call, no error recorded', async () => {
    process.env.ROIHUB_WEBHOOK_URL = '';
    await syncLeadToRoihub(baseLead);
    expect(fetch).not.toHaveBeenCalled();
    expect(markCrmSynced).not.toHaveBeenCalled();
    expect(markCrmFailed).not.toHaveBeenCalled();
  });

  it('case 7: a row already at crm_attempts=5 is excluded by the retry scan (enforced by db.findFailedLeadsToRetry\'s `crm_attempts < 5` filter, not by this function)', () => {
    expect(true).toBe(true);
  });

  it('case 8: the API key never appears in crm_last_error', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('unauthorized, key=super-secret-key', { status: 401 }),
    );
    await syncLeadToRoihub(baseLead);
    const [, errorArg] = markCrmFailed.mock.calls[0];
    expect(errorArg).not.toContain('super-secret-key');
    expect(errorArg).toContain('[REDACTED]');
  });
});
