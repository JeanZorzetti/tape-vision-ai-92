# Contract: Content, structured data, and machine-readable surfaces

**Feature**: `001-public-product-site`
**Satisfies**: FR-002, FR-003, FR-004, FR-009, FR-011, FR-012

The site's "public API" is what a crawler or an answer engine can read. This file fixes those
output formats so they're testable rather than aspirational.

---

## 1. Content collection frontmatter

`Site/src/content.config.ts` — long-tail concept pages in `Site/src/content/conceitos/*.md`.
Field semantics are in [data-model.md §2](../data-model.md); this is the enforced schema.

```ts
const conceitos = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/conceitos' }),
  schema: z.object({
    title:       z.string().max(60),
    description: z.string().min(80).max(155),
    targetQuery: z.string().min(3),
    answer:      z.string().max(320),   // BLUF opening — also the FAQPage answer
    updated:     z.coerce.date(),
    published:   z.coerce.date(),
    draft:       z.boolean().default(false),
  }),
});
```

A file violating this schema **fails the build**. Draft pages are excluded from the build, the
sitemap, and `llms.txt`.

---

## 2. Per-page HTML contract

Every published page MUST emit, from the base layout (not per-page markup):

```html
<html lang="pt-BR">
<head>
  <title>{title}</title>                                  <!-- ≤60 chars -->
  <meta name="description" content="{description}">        <!-- 80–155 chars -->
  <link rel="canonical" href="{site}{pathname}">
  <meta property="og:title" …> <meta property="og:description" …>
  <meta property="og:type" content="website|article">
  <meta property="og:image" …> <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{ "@context":"https://schema.org", "@graph":[…] }</script>
</head>
<body>
  <a class="skip-link" href="#conteudo">Pular para o conteúdo</a>
  <header><nav>…</nav></header>
  <main id="conteudo">
    <h1>{title}</h1>                                       <!-- exactly one -->
    …
    <p>Atualizado em {updated}</p>                          <!-- FR-012 -->
    <!-- exactly one primary CTA: waitlist form or link to it (FR-005) -->
  </main>
  <footer>
    <!-- risk/regulatory disclaimer (FR-006) + link to /privacidade -->
  </footer>
</body>
</html>
```

**Invariants** (asserted by the smoke test):
- exactly one `<h1>`; heading levels never skip;
- exactly one primary CTA per page;
- disclaimer present on every page;
- every concept page reaches home or the CTA in one step (FR-011);
- no `<img>` without `width`/`height` and `alt`.

---

## 3. schema.org `@graph`

One JSON-LD block per page containing a single `@graph` array with stable `@id`s, so entities are
linked rather than duplicated across pages (see research R4).

| Node | `@id` | On which pages |
|---|---|---|
| `Organization` (ROI Labs) | `{site}/#organization` | all |
| `WebSite` | `{site}/#website` | all |
| `WebPage` | `{url}#webpage` | all |
| `SoftwareApplication` (Tape Vision AI) | `{site}/#product` | home, `/como-funciona`, `/acesso` |
| `Article` | `{url}#article` | concept pages |
| `FAQPage` | `{url}#faq` | any page with a Q&A block |
| `BreadcrumbList` | `{url}#breadcrumb` | concept pages |

Required properties:
- `Organization`: `name`, `url`, `logo`, `sameAs[]`.
- `WebSite`: `name`, `url`, `publisher` → `{site}/#organization`, `inLanguage: "pt-BR"`.
- `SoftwareApplication`: `name`, `applicationCategory: "FinanceApplication"`, `description`,
  `operatingSystem`, `offers` (or `"availability": "PreOrder"` while pre-GA), `inLanguage`.
- `Article`: `headline`, `description`, `datePublished`, `dateModified` (from `updated` —
  same source as the visible indicator, so the two cannot disagree), `author`/`publisher` →
  `{site}/#organization`, `mainEntityOfPage` → `{url}#webpage`, `inLanguage`.
- `FAQPage`: `mainEntity[]` of `Question` → `acceptedAnswer` (`Answer.text`).

**Contract test**: every built page's JSON-LD parses, contains exactly one `@graph`, every
internal `@id` reference resolves to a node present on that page or to a stable site-level `@id`,
and `Article.dateModified` equals the rendered "Atualizado em" date.

---

## 4. `/llms.txt`

Generated at build time by `Site/src/pages/llms.txt.ts`; served as `text/plain`. Never
hand-edited.

```text
# Tape Vision AI

> Análise de fluxo de ordens (tape reading) para operar mini-dólar (WDO) na B3.
> Sem indicadores gráficos: as decisões vêm de time & sales, livro de ofertas,
> absorção e agressão.

Idioma: pt-BR. Público: traders de varejo e mesas prop no Brasil.
Status: acesso antecipado (pré-lançamento).

## Páginas principais
- [Home](https://…/): proposta de valor e para quem é o produto.
- [Como funciona](https://…/como-funciona): a abordagem de fluxo de ordens em linguagem simples.
- [Acesso](https://…/acesso): como entrar na lista de acesso antecipado.
- [Privacidade](https://…/privacidade): tratamento de dados pessoais (LGPD).

## Conceitos
- [{title}](https://…/conceitos/{slug}): {description}
  … one line per non-draft page, generated from the collection

## Aviso
Conteúdo educacional sobre mercado futuro. Operar derivativos envolve risco de
perda superior ao capital investido. Não constitui recomendação de investimento.
```

**Contract test**: `/llms.txt` returns 200 as `text/plain`, contains one line per non-draft
concept page, contains zero draft pages, and every URL in it returns 200.

---

## 5. `robots.txt` and sitemap

`Site/public/robots.txt` — static, production-permissive:

```text
User-agent: *
Allow: /

Sitemap: https://{site}/sitemap-index.xml
```

No crawler is disallowed, including AI crawlers (GPTBot, PerplexityBot, ClaudeBot,
Google-Extended) — being read by them is the entire point of the feature. Preview deploys are
kept out of the index with Vercel deployment protection, not with `robots.txt`, so production's
file can never be accidentally restrictive.

`sitemap-index.xml` + `sitemap-0.xml` are generated by `@astrojs/sitemap`, exclude drafts, and
carry `lastmod` from `updated`.

**Contract test**: `/robots.txt` and `/sitemap-index.xml` both return 200; every `<loc>` in the
sitemap returns 200; no draft URL appears.
