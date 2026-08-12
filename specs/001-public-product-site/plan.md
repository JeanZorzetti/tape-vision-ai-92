# Implementation Plan: Public Product Site (SEO/GEO/AEO Acquisition)

**Branch**: `001-public-product-site` | **Date**: 2026-08-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-public-product-site/spec.md`

## Summary

Publish a standalone, statically-generated public marketing site (pt-BR) for Tape Vision AI whose
entire structure is built for organic discovery: crawlable HTML, schema.org `@graph` structured
data, an `llms.txt` machine summary, and a small curated content set (home, how-it-works,
pricing/access, privacy, and long-tail concept explainers). One primary CTA per page — an
early-access waitlist form — posts to a single serverless endpoint that validates input, rejects
bots (honeypot + timing + server-side validation), persists the lead to PostgreSQL, and then
best-effort syncs it to the roihub CRM without ever letting a CRM failure lose a lead.

Technical approach: **Astro** static output on **Vercel**, one server-rendered API route, content
authored as Markdown content collections so pages ship independently of the trading system's
release cycle. Zero client JS on content pages keeps Core Web Vitals in the "Good" band by
construction rather than by optimization. Nothing in this feature touches the trading engine,
its MongoDB/Redis storage, or the sub-10ms market-data path.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), Node.js 20 LTS runtime for the API route

**Primary Dependencies**: Astro 5 (`@astrojs/sitemap`, `@astrojs/vercel`, `@astrojs/mdx`),
Tailwind CSS 4, Zod (content-collection + request-body validation), `postgres` (lightweight
PG driver). Vercel Web Analytics for traffic-source/CTA measurement.

**Storage**: PostgreSQL (Neon serverless, via Vercel integration) — single `waitlist_lead` table.
No MongoDB/Redis; the site shares no datastore with the trading backend.

**Testing**: Vitest for lead validation / bot rejection / referral-channel classification;
one Playwright smoke test asserting a11y-critical markup, one primary CTA per page, structured
data presence, and sitemap/robots/llms.txt reachability. `astro check` in CI.

**Target Platform**: Vercel edge/CDN-served static HTML + one Node serverless function.
Browsers: last 2 versions of Chrome/Safari/Firefox/Edge, mobile-first (pt-BR, Brazil).

**Project Type**: Static content web site with a single server endpoint (new top-level `Site/`
deliverable, sibling to existing `Backend/`, `Frontend/`, `MLEngine/`).

**Performance Goals**: Core Web Vitals "Good" on 4G Brazil — LCP < 2.5s, CLS < 0.1, INP < 200ms
(SC-006). Lighthouse SEO ≥ 95, Accessibility ≥ 95 on every published page.

**Constraints**: WCAG 2.1 AA (FR-015). All content pt-BR (FR-010). Exactly one primary CTA per
page (FR-005). Risk/regulatory disclaimer on every page describing capabilities (FR-006).
LGPD: explicit unchecked consent checkbox, dedicated privacy page, defined retention/deletion
(FR-013). Lead capture must succeed even when roihub is down (FR-014 + Principle V).

**Scale/Scope**: v1 ≈ 8–12 pages (home, como-funciona, acesso, privacidade, 4–8 concept pages).
Traffic assumption: < 50k pageviews/month at launch; lead volume in the hundreds/month. Static
delivery makes the read path effectively unbounded; only the waitlist endpoint has a scale floor.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applies? | Gate outcome |
|-----------|----------|--------------|
| **I. Pure Tape Reading** | Content only | **PASS** — no signal logic added. Gate: public copy MUST describe the product as order-flow/tape-reading based and MUST NOT claim or imply chart-indicator features that don't exist. Marketing claims are reviewed against `Backend/docs/TRADING.md`. |
| **II. Risk-First, Confidence-Gated Execution** | No | **N/A** — no order path, no position sizing, no execution surface. The site cannot place or influence a trade. |
| **III. Real-Time Performance Budget (Sub-10ms)** | No | **PASS by isolation** — separate deployable, separate datastore, no synchronous work added to the market-data → analysis → signal path. The site never calls the trading backend. |
| **IV. Security & Auditability by Default** | Partially | **PASS** — public pages intentionally require no auth (FR-001) and carry no trading state, so the JWT/RBAC clause has no surface here. The clauses that *do* apply are enforced: input validated at the boundary (Zod, server-side, FR-016), all secrets (`DATABASE_URL`, `ROIHUB_*`) from environment only, and every lead write carries an immutable `created_at` + consent timestamp. Personal data handling follows LGPD per FR-013. |
| **V. Observable, Fail-Safe Operation** | Yes | **PASS** — the waitlist endpoint emits structured logs with a request id; CRM sync failure degrades safely (lead is already persisted, `crm_sync_status = 'failed'` with retry) instead of failing the visitor's submission or silently dropping the lead. |

**Technology & Integration Constraints check**: two documented deviations (PostgreSQL instead of
MongoDB; Astro as a new framework dependency) — both justified in [Complexity Tracking](#complexity-tracking).
No new dependency is added to `Backend/` or `Frontend/`.

**Development Workflow check**: TypeScript strict + ESLint/Prettier enforced in `Site/`. Unit
tests cover the non-trivial server logic (validation, bot rejection, channel classification).
No latency check required — Principle III does not apply (see above). Merges via PR.

**Post-Phase 1 re-evaluation**: re-checked after design artifacts were written — no new
violations. The design adds no auth surface, no trading-state mutation, and no coupling to the
trading engine; the two deviations above are unchanged and remain the only ones.

## Project Structure

### Documentation (this feature)

```text
specs/001-public-product-site/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── waitlist-api.md      # POST /api/waitlist (inbound, public)
│   ├── roihub-crm.md        # Outbound lead sync contract
│   └── content-schema.md    # Content frontmatter, structured data, llms.txt
├── checklists/
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
Site/                                # NEW top-level deliverable
├── astro.config.mjs                 # sitemap + vercel adapter, site URL
├── package.json
├── tsconfig.json
├── public/
│   ├── robots.txt                   # references sitemap-index.xml
│   └── og/                          # static social images
├── db/
│   └── 001_waitlist_lead.sql        # single-table schema + retention index
├── src/
│   ├── content.config.ts            # Zod schema for the `conceitos` collection
│   ├── content/
│   │   └── conceitos/*.md           # long-tail concept pages (FR-002, FR-009)
│   ├── layouts/
│   │   └── Base.astro               # <head> SEO, @graph injection, skip-link, footer disclaimer
│   ├── components/
│   │   ├── WaitlistForm.astro       # the single primary CTA (FR-005)
│   │   ├── Disclaimer.astro         # FR-006
│   │   └── LastUpdated.astro        # FR-012
│   ├── lib/
│   │   ├── schema.ts                # schema.org @graph builders
│   │   ├── lead.ts                  # Zod body schema + bot heuristics (FR-016)
│   │   ├── channel.ts               # referral-channel classification (FR-008)
│   │   ├── db.ts                    # postgres client + insert
│   │   └── roihub.ts                # outbound CRM sync (FR-014)
│   └── pages/
│       ├── index.astro              # home / value proposition (US1)
│       ├── como-funciona.astro      # how it works (US2)
│       ├── acesso.astro             # pricing / early access (US2)
│       ├── privacidade.astro        # privacy policy (FR-013)
│       ├── conceitos/[...slug].astro# long-tail content pages (US3)
│       ├── llms.txt.ts              # generated machine summary (FR-004)
│       └── api/
│           ├── waitlist.ts          # lead capture endpoint
│           └── retention-purge.ts   # Vercel Cron → LGPD purge (FR-013)
└── tests/
    ├── unit/                        # lead validation, bot rejection, channel
    └── smoke/                       # one-CTA / structured-data / robots-sitemap checks
```

**Structure Decision**: a new top-level `Site/` directory, matching the repository's existing
capitalized top-level deliverable convention (`Backend/`, `Frontend/`, `MLEngine/`, `Print/`).
It is a fully independent deployable with its own `package.json`, its own Vercel project, and its
own database — nothing under `Backend/` or `Frontend/` is modified by this feature, which is what
keeps the Principle III isolation argument true rather than aspirational.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| PostgreSQL, where the constitution names MongoDB as the system's store | The spec's clarification (2026-08-12) explicitly mandates PostgreSQL for lead persistence, and leads are marketing data with no relationship to trading/audit collections | Reusing the trading MongoDB would couple a public, internet-facing write path to the trading system's datastore and credentials — a security and blast-radius regression for zero benefit, since no query ever joins leads to trading data |
| Astro as a new framework, where the stack already has React/Vite | SEO/GEO/AEO is the feature's entire premise and requires real HTML in the initial response; Astro emits static HTML with zero client JS, giving CWV compliance (SC-006) by construction, plus Markdown content collections satisfying FR-009 | The existing Vite SPA renders an empty shell to crawlers; making it indexable needs a prerender plugin plus per-route meta plumbing — more moving parts than Astro, and it would couple public content releases to the trading frontend's release cycle, directly violating FR-009 |
