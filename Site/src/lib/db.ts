// postgres client + queries for the single `waitlist_lead` table (data-model.md §1).
// Insert happens before any CRM call — persist-then-sync is what makes a CRM outage
// cost a sync, never a lead (research R5, Principle V).
import postgres from 'postgres';
import type { ReferralChannel } from './channel';

const sql = postgres(process.env.DATABASE_URL ?? '', { ssl: 'require' });

export default sql;

export interface NewLead {
  email: string;
  name: string;
  sourcePage: string;
  referralChannel: ReferralChannel;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  consentAt: Date;
  consentVersion: string;
  ipHash: string | null;
  userAgent: string | null;
}

export interface LeadRow {
  id: string;
  email: string;
  name: string;
  source_page: string;
  referral_channel: ReferralChannel;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  consent_given: boolean;
  consent_at: string;
  consent_version: string;
  crm_sync_status: 'pending' | 'synced' | 'failed';
  crm_synced_at: string | null;
  crm_attempts: number;
  crm_last_error: string | null;
  created_at: string;
}

/** Returns the inserted row, or null when the email already exists as an active lead. */
export async function insertLead(lead: NewLead): Promise<LeadRow | null> {
  const rows = await sql<LeadRow[]>`
    insert into waitlist_lead (
      email, name, source_page, referral_channel, referrer,
      utm_source, utm_medium, utm_campaign,
      consent_given, consent_at, consent_version, ip_hash, user_agent
    ) values (
      ${lead.email}, ${lead.name}, ${lead.sourcePage}, ${lead.referralChannel}, ${lead.referrer},
      ${lead.utmSource}, ${lead.utmMedium}, ${lead.utmCampaign},
      true, ${lead.consentAt}, ${lead.consentVersion}, ${lead.ipHash}, ${lead.userAgent}
    )
    on conflict (lower(email)) where deleted_at is null do nothing
    returning *
  `;
  return rows[0] ?? null;
}

export async function markCrmSynced(id: string): Promise<void> {
  await sql`
    update waitlist_lead
    set crm_sync_status = 'synced', crm_synced_at = now(), crm_attempts = crm_attempts + 1
    where id = ${id}
  `;
}

/**
 * `terminal: true` sets crm_attempts straight to 5 — used for non-retryable 4xx
 * responses (contracts/roihub-crm.md: "a client error will not fix itself"), so the
 * existing `crm_attempts < 5` retry filter excludes it without a dedicated column.
 */
export async function markCrmFailed(
  id: string,
  error: string,
  opts: { terminal?: boolean } = {},
): Promise<void> {
  const truncated = error.slice(0, 500);
  if (opts.terminal) {
    await sql`
      update waitlist_lead
      set crm_sync_status = 'failed', crm_attempts = 5, crm_last_error = ${truncated}
      where id = ${id}
    `;
  } else {
    await sql`
      update waitlist_lead
      set crm_sync_status = 'failed', crm_attempts = crm_attempts + 1, crm_last_error = ${truncated}
      where id = ${id}
    `;
  }
}

/** Rows eligible for the daily cron retry (contracts/roihub-crm.md retry policy). */
export async function findFailedLeadsToRetry(): Promise<LeadRow[]> {
  return sql<LeadRow[]>`
    select * from waitlist_lead
    where crm_sync_status = 'failed' and crm_attempts < 5 and deleted_at is null
  `;
}

/** Hard-deletes leads past the 24-month retention or soft-deleted >30 days ago (research R12). */
export async function purgeExpiredLeads(): Promise<{ retention: number; softDeleted: number }> {
  const retention = await sql`
    delete from waitlist_lead
    where deleted_at is null and created_at < now() - interval '24 months'
  `;
  const softDeleted = await sql`
    delete from waitlist_lead
    where deleted_at is not null and deleted_at < now() - interval '30 days'
  `;
  return { retention: retention.count, softDeleted: softDeleted.count };
}
