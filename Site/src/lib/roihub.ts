// Outbound roihub CRM sync (contracts/roihub-crm.md, FR-014). Fire-and-persist: the
// lead is already committed to PostgreSQL before this ever runs, so a CRM outage
// costs a sync, never a lead (research R6, Principle V).
import { markCrmSynced, markCrmFailed, type LeadRow } from './db';

function scrubSecret(text: string, secret: string): string {
  if (!secret) return text;
  return text.split(secret).join('[REDACTED]');
}

function buildPayload(lead: LeadRow) {
  return {
    source: 'tapevision-site',
    externalId: lead.id,
    name: lead.name,
    email: lead.email,
    product: 'tape-vision-ai',
    interest: 'early-access',
    sourcePage: lead.source_page,
    referralChannel: lead.referral_channel,
    utm: {
      source: lead.utm_source,
      medium: lead.utm_medium,
      campaign: lead.utm_campaign,
    },
    consentAt: lead.consent_at,
    consentVersion: lead.consent_version,
    createdAt: lead.created_at,
  };
}

/**
 * Never throws — every outcome (success, 4xx, 5xx, timeout, network error, unset URL)
 * resolves by updating `crm_sync_status` on the row. Called after the visitor already
 * received their 200 (contracts/waitlist-api.md processing order, step 8).
 */
export async function syncLeadToRoihub(lead: LeadRow): Promise<void> {
  const url = process.env.ROIHUB_WEBHOOK_URL;
  const apiKey = process.env.ROIHUB_API_KEY ?? '';

  // Unconfigured integration is not an error — status stays 'pending' (test case 6).
  if (!url) return;

  const timeoutMs = Number(process.env.ROIHUB_TIMEOUT_MS ?? 3000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'Idempotency-Key': lead.id,
      },
      body: JSON.stringify(buildPayload(lead)),
      signal: controller.signal,
    });

    // 409 (already exists) is treated as success — idempotent duplicate (test case 2).
    if (response.ok || response.status === 409) {
      await markCrmSynced(lead.id);
      return;
    }

    const bodyText = scrubSecret((await response.text()).slice(0, 500), apiKey);
    const isClientError = response.status >= 400 && response.status < 500;
    await markCrmFailed(lead.id, `HTTP ${response.status}: ${bodyText}`, {
      terminal: isClientError, // 4xx will not fix itself — not retried (test case 3)
    });
  } catch (error) {
    // Timeout (AbortError) or network error — retried by the cron job (test cases 4, 5).
    const message = error instanceof Error ? error.message : 'unknown error';
    await markCrmFailed(lead.id, scrubSecret(message, apiKey));
  } finally {
    clearTimeout(timeout);
  }
}
