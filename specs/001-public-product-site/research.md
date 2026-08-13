# Phase 0 Research: Public Product Site

**Feature**: `001-public-product-site` | **Date**: 2026-08-12

Every unknown from the plan's Technical Context is resolved below. No `NEEDS CLARIFICATION`
remains open.

---

## R1. Rendering strategy / framework

**Decision**: Astro 5, `output: 'static'` with the Vercel adapter, and only `/api/*` routes
opted into server rendering (`export const prerender = false`).

**Rationale**: The feature's premise is that crawlers and AI answer engines can read the content.
Static HTML in the initial response is the one non-negotiable requirement, and Astro ships pages
with zero client JS by default — which makes SC-006 (LCP < 2.5s, CLS < 0.1, INP < 200ms) an
outcome of the architecture rather than an optimization project. Markdown content collections
give FR-009 (publish content without a trading-system release) for free. The waitlist endpoint is
the only dynamic surface, so a single server route is the whole server-side footprint.

**Alternatives considered**:
- *Reuse the existing Vite + React SPA (`Frontend/`)*: rejected. It renders an empty shell to
  crawlers, would need a prerender plugin plus manual per-route meta/JSON-LD plumbing, and would
  tie content publishing to the trading frontend's release cycle (violates FR-009).
- *Next.js*: works, but pulls a React runtime onto pages that need no interactivity, and its
  content story (MDX + app router) is more machinery than Astro's collections for ~10 pages.
- *Hand-written HTML*: genuinely viable at this page count, but loses the sitemap integration,
  the typed frontmatter, and layout reuse — and stops scaling the moment the content hub grows,
  which the spec's assumptions explicitly anticipate.

---

## R2. Hosting, domain, and deployment

**Decision**: a **separate Vercel project** deploying `Site/`, on the domain
`tapevision.roilabs.com.br`. The existing trading app keeps `aitradingbot.roilabs.com.br`
and the API keeps `apptapevision.roilabs.com.br`.

**Rationale**: Vercel is already the org's front-end host (see `DEPLOYMENT.md`), so this adds no
new vendor. A separate project means a marketing deploy can never break the trading app, and its
env/secrets are isolated. A dedicated subdomain (rather than a `/site` path on the app domain)
keeps the public content's ranking signals independent from a login-walled app.

**Open item for the user**: the exact subdomain is a branding call, not a technical one. Anything
resolvable works; `tapevision.roilabs.com.br` is the assumption used throughout these artifacts
and appears in `astro.config.mjs` (`site`), `robots.txt`, the sitemap, and the `@graph` `@id`s.
Changing it later is a one-constant edit plus a DNS record.

**Alternatives considered**: subdirectory on the app domain (rejected: couples deploys and mixes
public/private ranking signals); a brand-new apex domain (rejected for v1: extra cost and DNS
setup for no v1 benefit, and it forfeits the `roilabs.com.br` entity association that helps
E-E-A-T).

---

## R3. Traditional SEO surface (FR-003)

**Decision**: `@astrojs/sitemap` generating `sitemap-index.xml`; a static `public/robots.txt`
that allows all crawlers and points at the sitemap index; one `<h1>` per page with a strictly
nested heading outline; per-page `<title>` (≤ 60 chars) and `<meta name="description">`
(≤ 155 chars) declared as required frontmatter/props; canonical `<link>` on every page;
Open Graph + Twitter card tags; `<html lang="pt-BR">`.

**Rationale**: This is the settled, boring baseline — no research needed beyond making it
mandatory rather than optional. Making title/description *required* props on the base layout is
what prevents the usual failure mode of pages shipping without them.

**Alternatives considered**: hand-maintained `sitemap.xml` (rejected: goes stale silently);
`noindex` staging protection via robots.txt (rejected: use Vercel's deployment protection for
previews so `robots.txt` in production is never accidentally restrictive).

---

## R4. GEO/AEO surface — being cited by generative engines (FR-004)

**Decision**: three complementary mechanisms.
1. **schema.org JSON-LD as a single `@graph`** per page, with stable `@id`s so entities are
   linked rather than duplicated: `Organization` (ROI Labs) + `WebSite` on every page,
   plus `SoftwareApplication` on home/access, `FAQPage` where Q&A blocks exist, and
   `Article` (with `dateModified`) on concept pages.
2. **`/llms.txt`**, generated at build time from the content collection — a plain-text index of
   the product's positioning plus every page's title, one-line summary, and URL.
3. **Answer-first (BLUF) content structure**: each concept page opens with a 2–3 sentence direct
   answer to its target question before elaborating, and uses question-shaped `<h2>`s.

**Rationale**: Answer engines extract short, self-contained, attributable passages. A single
`@graph` (rather than several disconnected JSON-LD blocks) is what makes the entity resolvable and
avoids the duplicate-entity problem. `llms.txt` is a low-cost, emerging convention — a generated
file, so it can never drift from the content.

**Alternatives considered**: separate JSON-LD `<script>` blocks per type (rejected: duplicated,
unlinked entities); microdata/RDFa (rejected: verbose, worse tooling); hand-written `llms.txt`
(rejected: drifts).

---

## R5. Lead persistence (FR-014)

**Decision**: Neon serverless PostgreSQL provisioned through the Vercel integration; a single
`waitlist_lead` table; the `postgres` npm driver over `DATABASE_URL`. Insert happens **before**
any CRM call.

**Rationale**: The spec mandates PostgreSQL. Neon's serverless driver is built for the
short-lived, connection-pooled reality of serverless functions, and the Vercel integration
injects `DATABASE_URL` without a hand-managed secret. One table is genuinely all the schema this
feature needs. Persist-then-sync is what makes Principle V's fail-safe requirement real: a CRM
outage costs a sync, never a lead.

**Alternatives considered**: reuse the trading MongoDB (rejected — see plan's Complexity
Tracking); Supabase (rejected: a second vendor and an auth/storage stack this feature never
uses); an ORM such as Prisma/Drizzle (rejected: a migration toolchain and a cold-start cost for
one table and two queries).

---

## R6. roihub CRM sync (FR-014)

**Decision**: fire-and-persist. The endpoint inserts the lead, returns success to the visitor,
then POSTs to `ROIHUB_WEBHOOK_URL` with a bearer `ROIHUB_API_KEY` and a 3s timeout, updating
`crm_sync_status` to `synced` or `failed`. Failed rows are retried by the same Vercel Cron job
that runs the retention purge. Credentials come from env only, per the spec and Principle IV.

**Rationale**: roihub's API surface isn't documented in this repo, so the contract is defined
from our side as a generic authenticated JSON webhook (see
[contracts/roihub-crm.md](./contracts/roihub-crm.md)) — an adapter shape that fits whatever
roihub exposes with one function's worth of change. Sync status is already a spec'd attribute of
the Lead entity, so retry state needs no extra structure.

**Alternatives considered**: synchronous sync blocking the response (rejected: a CRM outage would
show the visitor an error and lose a real lead); a queue/Bull worker (rejected: new
infrastructure for an operation measured in dozens per day — the cron retry is the lazy path that
holds); no retry at all (rejected: silently loses pipeline).

---

## R7. Bot protection (FR-016)

**Decision**: layered, all server-side, no third-party CAPTCHA:
1. A hidden honeypot field (`empresa`), CSS-hidden and `aria-hidden` + `tabindex="-1"`.
2. A form-render timestamp; submissions faster than 2 seconds are treated as automated.
3. Zod validation of every field server-side, including a real email shape check.
4. Rate limiting by IP hash — 5 submissions per hour.

Detected bots receive **HTTP 200 with the same success body** and nothing is written — the silent
rejection the spec's edge case requires.

**Rationale**: Meets "invisible CAPTCHA/honeypot + server-side validation" with zero added
friction, zero third-party JS on a CWV-sensitive page, and no vendor. Returning success to bots
denies scrapers the signal they'd use to adapt.

**Alternatives considered**: reCAPTCHA/Turnstile (rejected for v1: third-party JS on the critical
path, a consent/privacy surface, and an account to manage — revisit if spam gets through);
client-only validation (rejected: trivially bypassed, and violates Principle IV's
validate-at-the-boundary clause).

---

## R8. Analytics & attribution (FR-008, SC-004)

**Decision**: Vercel Web Analytics (cookieless, no consent banner required) for pageviews and
traffic source, **plus** attribution stored on the lead row itself: `source_page`,
`referral_channel`, and raw `referrer`/UTM values captured at submit time.

**Rationale**: SC-004 requires conversion rate *by acquisition channel*, which needs the channel
recorded on the conversion, not just in an analytics dashboard — storing it on the row makes the
metric a single SQL query and survives any analytics vendor change. Vercel Analytics is already
part of the hosting, is cookieless (LGPD-friendly), and adds a tiny script.

**Referral-channel classification** (`referral_channel`, from `document.referrer` + UTM):
- `ai` — referrer host matches a known answer engine (chatgpt.com, openai.com, perplexity.ai,
  gemini.google.com, claude.ai, copilot.microsoft.com), or `utm_source` names one.
- `organic` — referrer host is a search engine (google, bing, duckduckgo, yahoo, ecosia).
- `direct` — no referrer.
- `other` — everything else (kept as raw referrer for later reclassification).

**Alternatives considered**: Google Analytics 4 (rejected: consent-banner burden under LGPD, and
a banner is a CLS/INP risk on every page); Plausible (good, but a paid vendor for what Vercel
already bundles); analytics-only attribution (rejected: can't answer SC-004 reliably once
referrer data is stripped by AI clients).

---

## R9. Accessibility — WCAG 2.1 AA (FR-015)

**Decision**: semantic landmarks (`header`/`nav`/`main`/`footer`), a visible-on-focus skip link,
a ≥ 4.5:1 contrast palette verified at design time (≥ 3:1 for large text and UI borders),
keyboard-reachable interactive elements with visible focus rings, form inputs with real
`<label for>` plus `aria-describedby` error text and `aria-live="polite"` status messaging,
`lang="pt-BR"`, and no information conveyed by color alone. Verified with axe-core in the smoke
test plus one manual keyboard-only pass per page type.

**Rationale**: On a static content site, AA is almost entirely a markup-and-palette discipline —
cheap when the base layout enforces it, expensive to retrofit. Automated checks catch roughly
half of AA issues, so the manual keyboard pass is part of the definition of done, not optional.

**Alternatives considered**: an accessibility overlay widget (rejected: doesn't achieve
conformance and is widely considered harmful); AAA (rejected: not required by the spec).

---

## R10. Core Web Vitals (SC-006)

**Decision**: no client JS on content pages (the form uses a native `<form>` POST enhanced
progressively); self-hosted variable font, `font-display: swap`, preloaded; all images as
AVIF/WebP through `astro:assets` with explicit `width`/`height` (CLS defense); no third-party
embeds; CSS inlined below the ~4KB threshold, otherwise a single stylesheet. Verified with
Lighthouse CI on preview deploys against the "Good" thresholds.

**Rationale**: Every common CWV failure on marketing sites traces back to third-party scripts,
unsized media, or font swap — all three are designed out rather than measured after the fact.
INP is essentially free on pages with no JS.

**Alternatives considered**: client-side hydration for interactive components (rejected: not
needed at this scope); a hosted font CDN (rejected: an extra connection on the LCP path, plus a
third-party privacy surface).

---

## R11. Content authoring and freshness (FR-009, FR-012, SC-005)

**Decision**: concept pages are Markdown files in `src/content/conceitos/` with a Zod-validated
frontmatter schema (`title`, `description`, `targetQuery`, `updated`, `draft`). The `updated`
date renders as a visible "Atualizado em …" indicator and feeds `dateModified` in the `Article`
`@graph` node. A build-time check fails when any non-draft page has `updated` older than
6 months, turning SC-005's review cadence into a CI failure instead of a calendar reminder.

**Rationale**: FR-009 wants content publishable independent of the backend release cycle — a
Markdown file plus a site-only deploy is exactly that. Deriving the visible date and the
structured-data date from the same field means they can't disagree.

**Alternatives considered**: a headless CMS (rejected: a vendor, an auth surface, and a build
webhook for a handful of pages a quarter — revisit when non-technical authors need it);
git-commit-date-derived freshness (rejected: a typo fix would falsely reset the review clock).

---

## R12. LGPD retention and deletion (FR-013)

**Decision**: an unchecked-by-default consent checkbox that is required to submit, storing
`consent_given` + `consent_at` + the exact consent text version; a dedicated `/privacidade` page
naming the controller, purpose, legal basis, retention period, and a deletion-request email; a
**24-month** retention period for leads that never converted; deletion requests honored within
15 days via a soft-delete (`deleted_at`, PII columns nulled) followed by hard purge. A daily
Vercel Cron hits `/api/retention-purge`, which hard-deletes rows past retention or soft-deleted
more than 30 days ago, and retries `crm_sync_status = 'failed'` rows in the same pass.

**Rationale**: LGPD requires a stated purpose, a defined retention period, and a workable deletion
path — all three become concrete artifacts here rather than policy prose. One cron route covering
both purge and CRM retry keeps the scheduled-work surface at exactly one endpoint.

**Alternatives considered**: indefinite retention (rejected: no legal basis); hard delete with no
soft-delete window (rejected: an accidental deletion request is unrecoverable); `pg_cron` inside
Neon (viable and slightly lazier, but it splits operational logic across two places and can't do
the outbound CRM retry).

---

## Resolved unknowns summary

| Unknown | Resolution |
|---|---|
| Framework / rendering | Astro 5 static + one server route (R1) |
| Hosting / domain | Separate Vercel project, `tapevision.roilabs.com.br` (R2) |
| Lead datastore | Neon PostgreSQL, single table (R5) |
| CRM integration shape | Authenticated JSON webhook, persist-then-sync, cron retry (R6) |
| Bot protection | Honeypot + timing + Zod + IP rate limit, silent 200 (R7) |
| Analytics vendor | Vercel Web Analytics + attribution columns on the lead row (R8) |
| Testing approach | Vitest for server logic, Playwright + axe smoke, Lighthouse CI (R1, R9, R10) |
| Content workflow | Markdown content collections, `updated` frontmatter, CI staleness gate (R11) |
| Retention/deletion | 24 months, soft-delete + daily cron purge (R12) |
