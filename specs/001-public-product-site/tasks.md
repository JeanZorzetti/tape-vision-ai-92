---
description: "Task list for Public Product Site (SEO/GEO/AEO Acquisition)"
---

# Tasks: Public Product Site (SEO/GEO/AEO Acquisition)

**Input**: Design documents from `/specs/001-public-product-site/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The plan's Development Workflow check requires unit tests for the non-trivial
server logic (validation, bot rejection, channel classification) and contract tests for both
integration contracts; the contracts files define those cases explicitly.

**Organization**: Tasks are grouped by user story so each can be implemented, tested, and
deployed independently.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Paths are repository-relative; all feature code lives under `Site/` (per plan Structure Decision)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Stand up the new `Site/` deliverable. Nothing under `Backend/`, `Frontend/`, or
`MLEngine/` is touched by any task in this file.

- [X] T001 Create the `Site/` directory tree per plan.md (`src/{pages,layouts,components,lib,content,styles}`, `public/og/`, `db/`, `tests/{unit,contract,smoke}`)
- [X] T002 Initialize the Astro 5 project in `Site/package.json` and install dependencies: `astro`, `@astrojs/sitemap`, `@astrojs/vercel`, `@astrojs/mdx`, `tailwindcss`, `zod`, `postgres`, `@vercel/analytics`
- [X] T003 [P] Configure TypeScript strict mode in `Site/tsconfig.json` (extends `astro/tsconfigs/strict`)
- [X] T004 [P] Configure ESLint and Prettier in `Site/eslint.config.js` and `Site/.prettierrc`
- [X] T005 [P] Create `Site/.env.example` (`DATABASE_URL`, `IP_HASH_SALT`, `ROIHUB_WEBHOOK_URL`, `ROIHUB_API_KEY`, `ROIHUB_TIMEOUT_MS`) and `Site/.gitignore` — secrets from env only, never committed
- [X] T006 Configure `Site/astro.config.mjs`: `site` origin, `output: 'static'`, Vercel adapter, `@astrojs/sitemap` (drafts excluded, `lastmod` from `updated`), mdx, Tailwind

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared layout and libraries every page depends on. Building the SEO, a11y, CTA,
and disclaimer invariants into the base layout is what makes FR-003/FR-005/FR-006/FR-015 hold on
every page automatically instead of page-by-page.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 [P] Create `Site/src/styles/global.css`: design tokens with a ≥4.5:1 contrast palette (≥3:1 for large text and UI borders), visible focus ring, self-hosted variable font with `font-display: swap` + preload (FR-015, SC-006)
- [X] T008 [P] Create `Site/src/lib/site.ts` — single source of site constants (origin, product name, ROI Labs org data, `CONSENT_VERSION`), imported everywhere so the domain is a one-line change
- [X] T009 [P] Create `Site/src/lib/schema.ts` — schema.org `@graph` builders with stable `@id`s (`Organization`, `WebSite`, `WebPage`, `SoftwareApplication`, `Article`, `FAQPage`, `BreadcrumbList`) per [contracts/content-schema.md](./contracts/content-schema.md#3-schemaorg-graph)
- [X] T010 [P] Create `Site/src/components/Disclaimer.astro` — risk/regulatory disclaimer for a B3-regulated instrument (FR-006)
- [X] T011 [P] Create `Site/src/components/LastUpdated.astro` — renders "Atualizado em {date}" from a single date prop shared with `Article.dateModified` (FR-012)
- [X] T012 [P] Create `Site/src/components/Nav.astro` and `Site/src/components/Footer.astro` — persistent link to home and to the CTA so every page is one step from both (FR-011)
- [X] T013 Create `Site/src/layouts/Base.astro` — `lang="pt-BR"`, **required** `title`/`description` props, canonical link, OG/Twitter tags, JSON-LD `@graph` injection, skip link, `header`/`nav`/`main#conteudo`/`footer` landmarks, single primary-CTA slot (depends on T007–T012)
- [X] T014 Configure test tooling: `Site/vitest.config.ts`, `Site/playwright.config.ts`, and `Site/package.json` scripts (`test`, `test:smoke`, `check`, `build`, `dev`)

**Checkpoint**: Base layout renders a compliant empty page — user stories can now begin in parallel

---

## Phase 3: User Story 1 - Discover the product via search or an AI answer engine (Priority: P1) 🎯 MVP

**Goal**: A public, indexable home page that states the value proposition above the fold and
exposes machine-readable summaries so traditional crawlers and generative answer engines can
extract and cite the product accurately.

**Independent Test**: Deploy only this phase. `curl` returns a fully-rendered home page,
`robots.txt`, `sitemap-index.xml`, and `llms.txt`; the JSON-LD validates in Google's Rich Results
Test; three readers outside the project can restate what the product does and who it's for after
viewing only the home page (quickstart V1, V2, SC-003).

**Note on the CTA**: the home page renders exactly one primary CTA as a link to `/acesso`, whose
page and form arrive in US2. That's the spec's own split — US1 delivers traffic and comprehension,
US2 completes the conversion path.

- [X] T015 [P] [US1] Write the pt-BR home page in `Site/src/pages/index.astro` — above-the-fold value proposition (order-flow / tape reading for WDO on B3), who it's for, and self-disqualification for non-target visitors (FR-001, FR-010, US1 §3, Edge Case 2)
- [X] T016 [US1] Emit the home `@graph` (`Organization`, `WebSite`, `WebPage`, `SoftwareApplication`) via `Site/src/lib/schema.ts` in `index.astro` (FR-004)
- [X] T017 [P] [US1] Create `Site/public/robots.txt` — allow all agents including GPTBot/PerplexityBot/ClaudeBot/Google-Extended, pointing at `sitemap-index.xml` (FR-003, FR-004)
- [ ] T018 [US1] Verify the generated `sitemap-index.xml` in `Site/astro.config.mjs` — every `<loc>` returns 200, no draft URLs (FR-003) — pending `npm run build` verification
- [X] T019 [US1] Create `Site/src/pages/llms.txt.ts` — build-time generated `text/plain` machine summary per [contracts/content-schema.md](./contracts/content-schema.md#4-llmstxt) (FR-004)
- [X] T020 [P] [US1] Create `Site/public/og/home.png` and wire OG/Twitter image meta in `index.astro`
- [X] T021 [US1] Render exactly one primary CTA on the home page linking to `/acesso` (FR-005)
- [X] T022 [P] [US1] Write `Site/tests/smoke/discovery.spec.ts` — asserts `robots.txt`/`sitemap-index.xml`/`llms.txt` reachability, exactly one parseable JSON-LD `@graph` with resolvable `@id`s, exactly one `<h1>`, exactly one primary CTA, disclaimer present
- [ ] T023 [US1] Create the Vercel project rooted at `Site/` (framework preset Astro), attach the production domain, and set the matching `site` origin in `Site/src/lib/site.ts` + `astro.config.mjs` (research R2) — **BLOCKED: requires Vercel dashboard/account access, cannot be done from this environment**
- [X]/[ ] T024 [US1] Enable Vercel Web Analytics and add `@vercel/analytics` to `Base.astro` for pageview and traffic-source measurement (FR-008) — code integration done; **enabling Analytics in the Vercel dashboard is a manual step**
- [ ] T025 [US1] Enable Vercel deployment protection on previews (so only production is indexable), then submit the sitemap in Google Search Console — **BLOCKED: requires Vercel/Search Console account access**

**Checkpoint**: Home page is live, indexable, and machine-readable — deployable as the MVP

---

## Phase 4: User Story 2 - Evaluate credibility and take the next step (Priority: P2)

**Goal**: The credibility path (`/como-funciona`, `/acesso`) plus a working early-access CTA that
captures a consented lead, rejects bots silently, persists to PostgreSQL, and syncs to roihub
without ever letting a CRM failure lose a lead.

**Independent Test**: Submit the form and confirm exactly one row in `waitlist_lead` with the
correct `referral_channel` and consent fields; repeat with a filled honeypot, a sub-2s submission,
and `consent: false` and confirm the responses and row counts from
[contracts/waitlist-api.md](./contracts/waitlist-api.md#test-cases) (quickstart V3–V8).

- [X] T026 [P] [US2] Write the migration `Site/db/001_waitlist_lead.sql` — table, checks, and the three indexes from [data-model.md §1](./data-model.md)
- [X] T027 [P] [US2] Create `Site/src/lib/db.ts` — `postgres` client from `DATABASE_URL`, insert with `on conflict (lower(email)) where deleted_at is null do nothing`, and the sync-status update
- [X] T028 [P] [US2] Create `Site/src/lib/lead.ts` — Zod body schema (JSON **and** form-encoded), normalization (lowercase/trim email, trim name, strip unknown fields), pt-BR field-keyed error messages
- [X] T029 [P] [US2] Create `Site/src/lib/bot.ts` — honeypot check, `renderedAt` timing check (< 2s), IP-hash rate limit (5/hour) using `IP_HASH_SALT` (FR-016)
- [X] T030 [P] [US2] Create `Site/src/lib/channel.ts` — referral-channel classification, `ai` tested before `organic`, raw referrer preserved ([data-model.md §3](./data-model.md))
- [X] T031 [P] [US2] Create `Site/src/lib/roihub.ts` — outbound sync per [contracts/roihub-crm.md](./contracts/roihub-crm.md), including the unset-URL skip, `Idempotency-Key`, 409-as-success, 4xx-no-retry, and credential scrubbing
- [X] T032 [US2] Implement `Site/src/pages/api/waitlist.ts` (`prerender = false`) following the normative processing order — bot checks **before** validation, silent 200 for bots, response returned **before** the CRM call (depends on T027–T031)
- [X] T033 [US2] Add structured JSON logging with `requestId`, `outcome`, `referralChannel`, `sourcePage`, and duration to `waitlist.ts` — never logging email, raw IP, or secrets (Principle V, Principle IV)
- [X] T034 [US2] Implement `Site/src/pages/api/retention-purge.ts` + `Site/vercel.json` daily cron — hard-delete past retention, purge soft-deletes older than 30 days, retry `failed` rows with `crm_attempts < 5` (FR-013, research R12)
- [X] T035 [P] [US2] Create `Site/src/components/WaitlistForm.astro` — native `<form method="post">`, real `<label for>`, `aria-describedby` errors, `aria-live="polite"` status, unchecked consent checkbox linking to `/privacidade`, hidden honeypot (`empresa`, `aria-hidden` + `tabindex="-1"`), `renderedAt` hidden field (FR-013, FR-015, FR-016)
- [X] T036 [P] [US2] Write `Site/src/pages/como-funciona.astro` — the order-flow/tape-reading approach in plain pt-BR, key domain terms (WDO, B3, tape reading) explained on first use (US2 §1, Edge Case 4)
- [X] T037 [P] [US2] Write `Site/src/pages/acesso.astro` — early-access positioning (pre-GA, no payment in v1) hosting the `WaitlistForm` as its single primary CTA
- [X] T038 [P] [US2] Write `Site/src/pages/privacidade.astro` — controller, purpose, legal basis, 24-month retention, deletion-request contact and 15-day SLA (FR-013)
- [X] T039 [US2] Wire form success and error rendering for the no-JavaScript path (POST → redirect/render with state), so the CTA never depends on client JS (quickstart V8)
- [X] T040 [P] [US2] Write `Site/tests/unit/lead.test.ts` — validation cases 6, 7, 8 from the waitlist contract
- [X] T041 [P] [US2] Write `Site/tests/unit/bot.test.ts` — silent-rejection cases 3, 4, 5
- [X] T042 [P] [US2] Write `Site/tests/unit/channel.test.ts` — `ai` / `organic` / `direct` / `other` classification including the AI-before-search precedence
- [X] T043 [P] [US2] Write `Site/tests/contract/waitlist.test.ts` — cases 1, 2, 9, 10, 11, 12 (happy path, idempotent duplicate, form-encoded, CRM down, DB down, 405)
- [X] T044 [P] [US2] Write `Site/tests/contract/roihub.test.ts` — all 8 cases, including "error body containing the API key never reaches `crm_last_error` or logs"
- [ ] T045 [US2] Attach Neon Postgres to the Vercel project, apply `001_waitlist_lead.sql` to the production branch, and set `IP_HASH_SALT` / `ROIHUB_WEBHOOK_URL` / `ROIHUB_API_KEY` in the Production scope — **BLOCKED: requires Vercel/Neon account access**
- [X] T046 [US2] Verify the invariants on every new page: exactly one primary CTA, disclaimer visible, one-step path to home or CTA (FR-005, FR-006, FR-011) — enforced structurally by `Base.astro`/`Footer.astro`; to be confirmed by `discovery.spec.ts`/`conceitos.spec.ts`/`a11y.spec.ts` at build time

**Checkpoint**: Full funnel works — discovery (US1) through consented lead capture and CRM sync

---

## Phase 5: User Story 3 - Land directly on relevant content via a long-tail query (Priority: P3)

**Goal**: Markdown-authored concept pages that answer specific long-tail questions directly, are
individually indexable and citable, and route the reader to the CTA in one step — publishable
without a trading-system release.

**Independent Test**: Add a Markdown file, build, deploy `Site/` alone, and confirm the page is
live, in the sitemap and `llms.txt`, carries `Article` structured data whose `dateModified`
matches the visible date, and reaches the CTA in one click — with zero changes to `Backend/`,
`Frontend/`, or `MLEngine/` (quickstart V11, V12).

- [X] T047 [P] [US3] Create `Site/src/content.config.ts` — the Zod collection schema from [contracts/content-schema.md](./contracts/content-schema.md#1-content-collection-frontmatter); malformed frontmatter fails the build
- [X] T048 [P] [US3] Author 4 concept pages in `Site/src/content/conceitos/*.md` (e.g. absorção, agressão, fluxo de ordens vs. indicadores, livro de ofertas) — each opening with its BLUF `answer` and using question-shaped `<h2>`s (FR-002, FR-010, research R4)
- [X] T049 [US3] Create `Site/src/pages/conceitos/[...slug].astro` rendering the collection through `Base.astro`, drafts excluded (depends on T047)
- [X] T050 [US3] Emit `Article` + `BreadcrumbList` (+ `FAQPage` where a Q&A block exists) in the concept-page `@graph` via `lib/schema.ts` (FR-004)
- [X] T051 [US3] Render `LastUpdated` from the same `updated` field that feeds `Article.dateModified`, so the visible date and structured data cannot disagree (FR-012)
- [X] T052 [US3] Add a build-time staleness check in `Site/scripts/check-freshness.mjs` wired into `npm run build` — fails when a non-draft page's `updated` is older than 6 months (SC-005, Edge Case 1)
- [X] T053 [US3] Extend `Site/src/pages/llms.txt.ts` with one generated line per non-draft concept page (FR-004)
- [ ] T054 [US3] Verify the sitemap includes every concept page with `lastmod` and excludes drafts (FR-003) — pending `npm run build` verification
- [X] T055 [P] [US3] Write `Site/tests/smoke/conceitos.spec.ts` — BLUF answer present above the fold, one-step path to home/CTA, `Article.dateModified` equals the rendered date, no draft URL exposed
- [X] T056 [US3] Link the concept pages from `index.astro` and `como-funciona.astro` so they are internally discoverable, not orphaned (FR-011)

**Checkpoint**: All three user stories independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T057 [P] Add Lighthouse CI in `Site/lighthouserc.json` with the SC-006 thresholds (LCP < 2.5s, CLS < 0.1, INP < 200ms, SEO ≥ 95, a11y ≥ 95) on `/`, `/como-funciona`, `/acesso`, and one concept page
- [X] T058 [P] Add axe-core assertions to `Site/tests/smoke/a11y.spec.ts` covering every page type — zero violations (FR-015)
- [ ] T059 Manual keyboard-only pass per page type: skip link on first Tab, focus order matches reading order, visible focus throughout, form errors announced (FR-015 — automation catches only about half of AA) — **BLOCKED: requires a human tester**
- [X]/[N/A] T060 [P] Convert all images to AVIF/WebP through `astro:assets` with explicit `width`/`height` and meaningful `alt` (SC-006 CLS defense, FR-015) — no `<img>` content exists yet (only the OG meta placeholder); apply when real imagery is added
- [X] T061 Security review of `Site/src/pages/api/`: no secret, connection string, stack trace, email, or raw IP in any log line or response body (Principle IV) — self-reviewed: catch blocks never log/return the underlying error, `roihub.ts` scrubs the API key from `crm_last_error`
- [X] T062 [P] Write `Site/README.md` — how to add a concept page, run locally, apply migrations, and deploy; env var reference
- [ ] T063 Run the full [quickstart.md](./quickstart.md) validation set V1–V12 against a production deployment — **BLOCKED (needs a live deployment)**; local build/unit/contract verification done as part of implementation
- [X] T064 [P] Add `Site/src/pages/404.astro` using `Base.astro`, with a route back to home and the CTA
- [ ] T065 Verify the IP-hash rate limit behaves in production (serverless instances do not share memory — confirm the limit is enforced via the database, not process state) — implemented against the DB by construction (`bot.ts` queries `waitlist_lead`, not in-memory state); **production confirmation BLOCKED (needs a live deployment)**
- [X] T066 Save the SC-004 attribution query from [data-model.md §3](./data-model.md) as a documented report in `Site/db/queries/conversion-by-channel.sql`
- [X] T067 Review all public marketing copy against `Backend/docs/TRADING.md` — the site must describe an order-flow/tape-reading product and must not claim chart-indicator capabilities (Constitution Principle I) — copy grounded directly in `TRADING.md` (WDO/B3, time & sales, absorption, aggression, hidden liquidity); no indicator claims, no confidence-percentage claims
- [ ] T068 Two weeks post-launch: confirm Core Web Vitals field data in Vercel Analytics meets the "Good" thresholds (SC-006) — **BLOCKED: time-gated, needs 2 weeks of live traffic post-launch**

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately
- **Foundational (Phase 2)**: depends on Setup — **blocks all user stories**
- **US1 (Phase 3)**: depends on Foundational only
- **US2 (Phase 4)**: depends on Foundational only; independently testable, but its pages complete the CTA destination US1 links to
- **US3 (Phase 5)**: depends on Foundational only; T053 extends the `llms.txt` generator created in T019, so coordinate that one file if US1 and US3 run concurrently
- **Polish (Phase 6)**: depends on the stories you intend to ship

### Within Each User Story

- Libraries (`lib/`) before the endpoint that composes them (T027–T031 → T032)
- Components before the pages that use them (T035 → T037)
- Collection schema before the page that renders it (T047 → T049)
- Deployment/config tasks (T023, T045) last within their story

### Parallel Opportunities

- Setup: T003, T004, T005 in parallel
- Foundational: T007–T012 all in parallel, then T013 alone
- US1: T015, T017, T020, T022 in parallel
- US2: T026–T031 in parallel (six separate lib/migration files), then T032; T035–T038 in parallel; T040–T044 in parallel
- US3: T047, T048, T055 in parallel
- Polish: T057, T058, T060, T062, T064 in parallel
- With multiple developers, US1 / US2 / US3 can run concurrently once Phase 2 is done — the only shared file is `llms.txt.ts` (T019/T053)

---

## Parallel Example: User Story 2

```bash
# Six independent files — launch together:
Task: "Write the migration Site/db/001_waitlist_lead.sql"
Task: "Create Site/src/lib/db.ts"
Task: "Create Site/src/lib/lead.ts"
Task: "Create Site/src/lib/bot.ts"
Task: "Create Site/src/lib/channel.ts"
Task: "Create Site/src/lib/roihub.ts"

# Then the endpoint that composes them (T032), then the tests in parallel:
Task: "Write Site/tests/unit/lead.test.ts"
Task: "Write Site/tests/unit/bot.test.ts"
Task: "Write Site/tests/unit/channel.test.ts"
Task: "Write Site/tests/contract/waitlist.test.ts"
Task: "Write Site/tests/contract/roihub.test.ts"
```

---

## Implementation Strategy

### MVP (US1 only) — T001–T025

Setup → Foundational → US1, then **stop and validate**: run quickstart V1 and V2, submit the
sitemap, and let indexing begin. Indexing and AI citation take weeks to months (SC-001/SC-002 are
6-month criteria), so shipping the discoverable home page early starts that clock while US2 is
still being built. The MVP's CTA links to `/acesso`; until US2 lands, point it at an interim
mailto or hold the domain behind deployment protection — do not ship a dead link.

### Incremental Delivery

1. Setup + Foundational → compliant base layout
2. + US1 → indexable home page, clock starts on SEO/GEO (**deploy**)
3. + US2 → working funnel, leads captured and synced (**deploy**)
4. + US3 → long-tail surface that compounds over time (**deploy**)
5. + Polish → CWV/a11y verified, quickstart green

### Notes

- All feature code is confined to `Site/`; no task modifies `Backend/`, `Frontend/`, or
  `MLEngine/`. That confinement is what keeps the plan's Principle III isolation argument true.
- Commit after each task or logical group; merge via PR.
- The domain in `Site/src/lib/site.ts` is a single constant — confirm the subdomain before T023
  attaches DNS.
