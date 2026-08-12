# Phase 1 Data Model: Public Product Site

**Feature**: `001-public-product-site` | **Date**: 2026-08-12

Three entities from the spec: **Content Page**, **Call-to-Action / Lead**, **Referral Channel**.
Only the Lead is persisted; a Content Page is a build-time artifact and a Referral Channel is a
derived value stored on the Lead.

---

## 1. Lead (`waitlist_lead`)

The only database table in this feature. PostgreSQL (Neon), migration
`Site/db/001_waitlist_lead.sql`.

| Column | Type | Constraints | Source / notes |
|---|---|---|---|
| `id` | `uuid` | PK, `default gen_random_uuid()` | |
| `email` | `text` | `not null`, `check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')` | normalized lowercase + trimmed before insert |
| `name` | `text` | `not null`, `check (char_length(name) between 2 and 120)` | |
| `source_page` | `text` | `not null` | path of the page the form was submitted from (FR-008) |
| `referral_channel` | `text` | `not null`, `check (referral_channel in ('organic','ai','direct','other'))` | derived, see §3 |
| `referrer` | `text` | nullable | raw `document.referrer`, kept for reclassification |
| `utm_source` | `text` | nullable | |
| `utm_medium` | `text` | nullable | |
| `utm_campaign` | `text` | nullable | |
| `consent_given` | `boolean` | `not null`, `check (consent_given = true)` | FR-013 — a row cannot exist without consent |
| `consent_at` | `timestamptz` | `not null` | server time at accepted submission |
| `consent_version` | `text` | `not null` | identifier of the consent text shown, e.g. `2026-08-12` |
| `crm_sync_status` | `text` | `not null default 'pending'`, `check (... in ('pending','synced','failed'))` | FR-014 |
| `crm_synced_at` | `timestamptz` | nullable | |
| `crm_attempts` | `integer` | `not null default 0` | |
| `crm_last_error` | `text` | nullable | truncated to 500 chars; never contains credentials |
| `ip_hash` | `text` | nullable | SHA-256 of IP + a server-side salt — rate limiting without storing an IP |
| `user_agent` | `text` | nullable | truncated to 400 chars |
| `created_at` | `timestamptz` | `not null default now()` | immutable |
| `deleted_at` | `timestamptz` | nullable | LGPD soft delete; PII columns nulled at the same time |

**Indexes**
- `unique index on lower(email) where deleted_at is null` — one active lead per address; a
  repeat submission is an idempotent success, not an error (see contract).
- `index on (crm_sync_status) where crm_sync_status = 'failed'` — cron retry scan.
- `index on (created_at)` — retention purge and conversion reporting.

**Validation rules** (enforced server-side in `Site/src/lib/lead.ts` *and* by the constraints above)
- `email`: required, RFC-shaped, ≤ 254 chars, lowercased.
- `name`: required, 2–120 chars after trim.
- `consent`: must be literally `true`; any other value rejects with 422 (FR-013).
- `empresa` (honeypot): must be empty; non-empty ⇒ silent-accept path (FR-016).
- `rendered_at`: form render timestamp; `now - rendered_at < 2s` ⇒ silent-accept path.
- Unknown fields are stripped, not rejected.

**State transitions** — `crm_sync_status` is the only mutable state:

```text
pending ──sync ok──────────────► synced   (terminal)
   │
   └────sync error / timeout───► failed ──cron retry──► synced
                                   ▲                      │
                                   └──── retry fails ─────┘
```

`crm_attempts` increments on every attempt. After 5 failed attempts the row stops being retried
and is left `failed` for manual inspection — retrying forever would hide a broken contract.
A lead is *never* deleted or hidden because of sync state (Principle V).

**Lifecycle**
- Created only by `POST /api/waitlist` after validation and bot checks pass.
- Soft-deleted (PII nulled, `deleted_at` set) on an LGPD deletion request.
- Hard-deleted by the retention job at 24 months from `created_at`, or 30 days after
  `deleted_at`, whichever comes first (R12).

---

## 2. Content Page (build-time entity)

Not a database record. A concept page is a Markdown file in `Site/src/content/conceitos/`;
its frontmatter is the schema, validated by Zod at build time so a malformed page fails the build
rather than shipping broken SEO.

| Field | Type | Required | Maps to |
|---|---|---|---|
| `title` | string, ≤ 60 chars | yes | `<title>`, `og:title`, `Article.headline` |
| `description` | string, 80–155 chars | yes | `<meta name="description">`, `og:description`, `llms.txt` line |
| `targetQuery` | string | yes | the long-tail query the page is written to answer (US3); used in review |
| `answer` | string, ≤ 320 chars | yes | the BLUF/answer-first opening paragraph, also `FAQPage` answer text |
| `updated` | date (`YYYY-MM-DD`) | yes | visible "Atualizado em …" (FR-012) and `Article.dateModified` |
| `published` | date (`YYYY-MM-DD`) | yes | `Article.datePublished` |
| `draft` | boolean, default `false` | no | excluded from build, sitemap, and `llms.txt` |

**Derived, never authored**: URL slug (from filename), canonical URL, sitemap entry, `@graph`
JSON-LD, `llms.txt` entry, breadcrumb. Derivation is what guarantees FR-003/FR-004 hold on every
page instead of on the pages someone remembered.

**Invariants**
- Exactly one `<h1>` per page (from `title`), headings nested without skipping levels.
- Every page renders exactly one primary CTA (FR-005) and the risk disclaimer (FR-006), both
  from the base layout rather than per-page markup.
- Every concept page links to the home page or the CTA within one step (FR-011) — enforced by the
  layout's persistent nav and end-of-page CTA.
- Non-draft pages fail the build if `updated` is more than 6 months old (SC-005).

The fixed pages (`index`, `como-funciona`, `acesso`, `privacidade`) carry the same `title` /
`description` / `updated` props via the base layout, so they satisfy the same invariants without
living in the collection.

---

## 3. Referral Channel (derived value)

An enum computed at submit time from `document.referrer` and UTM parameters, then frozen onto the
lead row. Definition and host lists live in `Site/src/lib/channel.ts` (see research R8):

| Value | Rule |
|---|---|
| `ai` | referrer host, or `utm_source`, matches a known answer engine (chatgpt.com, openai.com, perplexity.ai, gemini.google.com, claude.ai, copilot.microsoft.com) |
| `organic` | referrer host is a search engine (google, bing, duckduckgo, yahoo, ecosia) |
| `direct` | no referrer and no UTM |
| `other` | anything else |

Order matters: `ai` is tested before `organic`, since some AI surfaces sit on search-engine
domains. The raw `referrer` is stored alongside so historical rows can be reclassified when a new
engine appears — the classifier is expected to go stale, and that's cheaper to fix than lost data.

**SC-004 becomes one query:**

```sql
select referral_channel,
       count(*) as leads
from waitlist_lead
where deleted_at is null
  and created_at >= now() - interval '3 months'
  and referral_channel in ('organic','ai')
group by referral_channel;
```

with the denominator (sessions by channel) coming from Vercel Web Analytics.
