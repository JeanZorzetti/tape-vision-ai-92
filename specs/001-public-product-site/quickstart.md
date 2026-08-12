# Quickstart & Validation Guide: Public Product Site

**Feature**: `001-public-product-site` | **Date**: 2026-08-12

How to run the site locally and prove it satisfies the spec. Field-level detail lives in
[data-model.md](./data-model.md) and [contracts/](./contracts/); this file is the runbook.

---

## Prerequisites

- Node.js 20 LTS + npm
- A PostgreSQL database reachable via `DATABASE_URL` (Neon branch, or local Postgres 16)
- `psql` (or any client) to apply the migration
- Optional: Vercel CLI (`npm i -g vercel`) to exercise cron routes locally

---

## Setup

```bash
cd Site
npm install
cp .env.example .env
```

`.env` (never committed — Principle IV):

```env
DATABASE_URL=postgres://user:pass@host/db?sslmode=require
IP_HASH_SALT=<random 32+ chars>
# Optional locally — unset means the CRM sync is skipped, not failed
ROIHUB_WEBHOOK_URL=
ROIHUB_API_KEY=
ROIHUB_TIMEOUT_MS=3000
```

Apply the schema:

```bash
psql "$DATABASE_URL" -f db/001_waitlist_lead.sql
```

Run:

```bash
npm run dev        # http://localhost:4321
npm run build      # static output + the /api function; fails on bad frontmatter or stale content
npm run preview    # serve the production build
```

---

## Test commands

```bash
npm test              # Vitest — lead validation, bot heuristics, referral-channel classification
npm run test:smoke    # Playwright + axe — a11y, one-CTA, @graph, robots/sitemap/llms.txt
npm run check         # astro check (TypeScript strict) + eslint
npx lhci autorun      # Lighthouse CI against the Core Web Vitals thresholds
```

---

## Validation scenarios

Each scenario maps to a user story or requirement. All must pass before the feature is complete.

### V1 — Discovery surface is machine-readable (US1, FR-003, FR-004)

```bash
npm run build && npm run preview
curl -s localhost:4321/robots.txt
curl -s localhost:4321/sitemap-index.xml
curl -s localhost:4321/llms.txt
curl -s localhost:4321/ | grep -o 'application/ld+json'
```

**Expected**: `robots.txt` allows all agents and points at the sitemap index; every `<loc>` in the
sitemap returns 200 and no draft URL appears; `llms.txt` is `text/plain` with one line per
non-draft concept page; the home page carries exactly one JSON-LD block that parses and contains a
single `@graph` with `Organization`, `WebSite`, `WebPage`, and `SoftwareApplication`.
Validate the JSON-LD in Google's Rich Results Test before launch.

### V2 — Value proposition lands above the fold (US1 §3, SC-003)

Open `/` at a 375px-wide viewport. **Expected**: without scrolling, a reader sees what the product
does (order-flow / tape reading for WDO on B3), who it's for, and one CTA. Verify with 3 people
outside the project who can then restate it in their own words — that restatement *is* SC-003.

### V3 — Credibility path and single CTA (US2, FR-005, FR-006, FR-011)

Navigate `/` → `/como-funciona` → `/acesso`, and any `/conceitos/*` page.
**Expected**: each page presents exactly one primary CTA; the risk/regulatory disclaimer is
visible on every page; every concept page reaches the home page or the CTA in one click.
`npm run test:smoke` asserts all three.

### V4 — Waitlist happy path (FR-014)

```bash
curl -s -X POST localhost:4321/api/waitlist \
  -H 'Content-Type: application/json' \
  -d '{"name":"Maria Souza","email":"maria@exemplo.com.br","consent":true,
       "empresa":"","renderedAt":'"$(( ($(date +%s) - 10) * 1000 ))"',
       "sourcePage":"/","referrer":"https://www.google.com/"}'
```

**Expected**: `200 {"ok":true,…}`. Then:

```sql
select email, referral_channel, consent_given, crm_sync_status from waitlist_lead;
```

One row, `referral_channel = 'organic'`, `consent_given = true`, and `crm_sync_status` =
`pending` (no CRM configured locally) or `synced`. Re-running the same curl leaves exactly one row.

### V5 — Bot rejection is silent (FR-016)

Repeat V4 three ways: (a) `"empresa":"Acme"`, (b) `renderedAt` = now, (c) a 6th call within an
hour from the same IP. **Expected**: all return the same `200 {"ok":true}` as V4, and
`select count(*) from waitlist_lead` is unchanged. The full matrix is in
[contracts/waitlist-api.md](./contracts/waitlist-api.md#test-cases).

### V6 — Consent is enforced (FR-013)

POST with `"consent": false`. **Expected**: `422` with a `consent` error and **zero** rows.
In the browser: the checkbox is unchecked on load, submit is blocked without it, and
`/privacidade` states controller, purpose, legal basis, 24-month retention, and the deletion
contact.

### V7 — CRM outage does not lose a lead (FR-014, Principle V)

Point `ROIHUB_WEBHOOK_URL` at an unreachable host and repeat V4.
**Expected**: the visitor still gets `200`; the row exists with `crm_sync_status='failed'` and
`crm_attempts=1`; no credential appears in `crm_last_error` or the logs. Running the retention/
retry route (`curl -s localhost:4321/api/retention-purge`) re-attempts it.

### V8 — No-JavaScript submission (FR-007, progressive enhancement)

Disable JavaScript and submit the form. **Expected**: the form-encoded POST succeeds and the row
is written — the CTA is not JS-dependent.

### V9 — Accessibility, WCAG 2.1 AA (FR-015)

```bash
npm run test:smoke     # axe-core, zero violations on every page type
```

Plus one manual keyboard-only pass per page type: skip link appears on first Tab, focus order
follows reading order, focus is always visible, form errors are announced via the `aria-live`
region, and no information depends on color alone.

### V10 — Core Web Vitals (SC-006)

```bash
npx lhci autorun
```

**Expected** on `/`, `/como-funciona`, `/acesso`, and one concept page: LCP < 2.5s, CLS < 0.1,
INP < 200ms (mobile, throttled), Lighthouse SEO ≥ 95 and Accessibility ≥ 95. Confirm against
field data in Vercel Analytics after two weeks of live traffic.

### V11 — Content freshness (FR-012, SC-005)

Set a non-draft concept page's `updated` to 7 months ago and run `npm run build`.
**Expected**: the build **fails** with a staleness error. Restore it and confirm the visible
"Atualizado em" date matches `Article.dateModified` in the page's JSON-LD.

### V12 — Content ships independently (FR-009)

Add a Markdown file to `src/content/conceitos/`, build, and deploy `Site/` only.
**Expected**: the page is live, in the sitemap, and in `llms.txt`, with no change to `Backend/`,
`Frontend/`, or `MLEngine/` and no trading-system deploy.

---

## Deployment checklist

1. New Vercel project rooted at `Site/`, framework preset **Astro**.
2. Neon Postgres attached (injects `DATABASE_URL`); migration applied to the production branch.
3. Env vars set for Production scope: `IP_HASH_SALT`, `ROIHUB_WEBHOOK_URL`, `ROIHUB_API_KEY`.
4. Domain attached (`tapevision.roilabs.com.br` — confirm the subdomain before the DNS record) and
   `site` in `astro.config.mjs` set to the same origin.
5. Vercel Web Analytics enabled; daily Cron configured for `/api/retention-purge`.
6. Deployment protection ON for previews so only production is indexable.
7. Post-deploy: submit the sitemap in Google Search Console, then re-run V1, V4, and V10 against
   the production URL.

---

## Success-criteria tracking (post-launch, not gated on the build)

| Criterion | How it's measured |
|---|---|
| SC-001 (first-page rank, 3+ queries, 6 mo) | Search Console position report against each page's `targetQuery` |
| SC-002 (AI assistant cites the product, 6 mo) | monthly manual prompting of ChatGPT / Perplexity / Gemini with the same open question set; log the answers |
| SC-004 (≥ 2% conversion from organic+AI, 3 mo) | the SQL in [data-model.md §3](./data-model.md) over Vercel Analytics sessions by channel |
| SC-005 (review cadence) | enforced by the build (V11) |
| SC-006 (Core Web Vitals) | Vercel Analytics field data + Lighthouse CI on every deploy |
