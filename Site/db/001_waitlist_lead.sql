-- Single table this feature needs (data-model.md §1). Applied to the Neon production
-- branch as part of T045 (Vercel/Neon setup — manual, external to this migration file).
create extension if not exists pgcrypto;

create table if not exists waitlist_lead (
  id                uuid primary key default gen_random_uuid(),
  email             text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name              text not null check (char_length(name) between 2 and 120),
  source_page       text not null,
  referral_channel  text not null check (referral_channel in ('organic', 'ai', 'direct', 'other')),
  referrer          text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  consent_given     boolean not null check (consent_given = true),
  consent_at        timestamptz not null,
  consent_version   text not null,
  crm_sync_status   text not null default 'pending' check (crm_sync_status in ('pending', 'synced', 'failed')),
  crm_synced_at     timestamptz,
  crm_attempts      integer not null default 0,
  crm_last_error    text,
  ip_hash           text,
  user_agent        text,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

-- One active lead per address; a repeat submission is an idempotent success (contracts/waitlist-api.md).
create unique index if not exists waitlist_lead_email_active_idx
  on waitlist_lead (lower(email))
  where deleted_at is null;

-- Cron retry scan (contracts/roihub-crm.md retry policy).
create index if not exists waitlist_lead_crm_failed_idx
  on waitlist_lead (crm_sync_status)
  where crm_sync_status = 'failed';

-- Retention purge and conversion reporting (data-model.md §3, research R12).
create index if not exists waitlist_lead_created_at_idx
  on waitlist_lead (created_at);
