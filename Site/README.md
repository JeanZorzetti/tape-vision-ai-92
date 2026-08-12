# Tape Vision AI — Public Site

Standalone Astro site for SEO/GEO/AEO acquisition. Independent from `Backend/`, `Frontend/`, and
`MLEngine/` — its own `package.json`, its own Vercel project, its own database.
See [../specs/001-public-product-site/](../specs/001-public-product-site/) for the full spec,
plan, and contracts.

## Run locally

```bash
cd Site
npm install
cp .env.example .env   # fill in DATABASE_URL and IP_HASH_SALT at minimum
psql "$DATABASE_URL" -f db/001_waitlist_lead.sql

npm run dev             # http://localhost:4321
npm run build           # static output + the /api function; fails on bad frontmatter or stale content
npm run preview          # serve the production build
```

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL (Neon) connection string |
| `IP_HASH_SALT` | yes | random 32+ chars — salts the IP hash used for rate limiting |
| `ROIHUB_WEBHOOK_URL` | no | unset = CRM sync is skipped (not failed) |
| `ROIHUB_API_KEY` | no | sent as `Authorization: Bearer` to roihub |
| `ROIHUB_TIMEOUT_MS` | no | default `3000` |
| `CRON_SECRET` | no | if set, `/api/retention-purge` requires `Authorization: Bearer <secret>` |

## Add a concept (long-tail) page

1. Add a Markdown file to `src/content/conceitos/your-slug.md` with frontmatter matching
   [`src/content.config.ts`](./src/content.config.ts): `title` (≤60 chars), `description`
   (80–155 chars), `targetQuery`, `answer` (≤320 chars, the BLUF opening), `updated`,
   `published`, optional `draft`.
2. Open with the same `answer` text as the first paragraph, then question-shaped `## ` headings.
3. Link it from `index.astro` / `como-funciona.astro` happens automatically — both pages list every
   non-draft entry in the collection.
4. `npm run build` — fails if frontmatter is invalid or `updated` is more than 6 months old.

## Tests

```bash
npm test              # Vitest — lead validation, bot heuristics, referral-channel classification
npm run test:smoke    # Playwright + axe — a11y, one-CTA, @graph, robots/sitemap/llms.txt
npm run check          # astro check (TypeScript strict) + eslint
npx lhci autorun       # Lighthouse CI against the Core Web Vitals thresholds
```

## Deploy

See [quickstart.md's deployment checklist](../specs/001-public-product-site/quickstart.md#deployment-checklist):
new Vercel project rooted at `Site/`, Neon Postgres attached, env vars set in Production scope,
domain attached, Web Analytics enabled, daily Cron for `/api/retention-purge`, deployment
protection on for previews.
