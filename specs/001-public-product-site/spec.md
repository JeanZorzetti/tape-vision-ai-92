# Feature Specification: Public Product Site (SEO/GEO/AEO Acquisition)

**Feature Branch**: `001-public-product-site`

**Created**: 2026-08-12

**Status**: Draft

**Input**: User description: "Produtificar o projeto Tape Vision AI: criar um site público para o produto, que hoje não existe nenhuma presença pública. Os deliverables exatos ainda não estão definidos, mas o principal motor de aquisição de usuários/clientes será SEO, GEO (Generative Engine Optimization) e AEO (Answer Engine Optimization) — ou seja, o site precisa ser otimizado desde a concepção para ranquear em buscadores tradicionais e ser citado por engines generativas de IA (ChatGPT, Perplexity, Gemini, etc). Precisamos definir a proposta de valor pública do produto, a estrutura mínima de páginas/conteúdo necessária para sustentar essa estratégia de aquisição, e os critérios de sucesso para essa primeira versão do site."

## Clarifications

### Session 2026-08-12

- Q: Como o site deve lidar com privacidade dos dados coletados no formulário de waitlist/early-access (nome, e-mail)? → A: Completo — página de política de privacidade dedicada + checkbox de consentimento explícito no formulário + processo definido de retenção/exclusão de dados.
- Q: Onde os leads capturados no formulário de waitlist devem ser armazenados/roteados? → A: Ambos — persistidos no banco de dados próprio do produto (PostgreSQL) e sincronizados com o CRM interno da ROI Labs (roihub). (Credenciais de conexão não são parte da especificação — pertencem a configuração/segredo, não ao spec.)
- Q: Que tempo de carregamento a home page deve atingir para visitantes em conexão típica no Brasil? → A: Padrão de mercado — dentro da faixa "Good" do Google Core Web Vitals (LCP < 2.5s, CLS < 0.1, INP < 200ms).
- Q: Qual nível de acessibilidade o site precisa cumprir? → A: WCAG 2.1 nível AA.
- Q: O formulário público de waitlist deve ter proteção contra submissões automatizadas/spam (bots)? → A: Sim, básica — CAPTCHA invisível/honeypot + validação server-side.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Discover the product via search or an AI answer engine (Priority: P1)

A prospective trader is researching tape-reading / order-flow trading tools for the Brazilian mini-dollar (WDO) futures market, either through a traditional search engine or by asking a generative AI assistant (ChatGPT, Perplexity, Gemini). They find the product, land on its site, and understand within seconds what it does, who it is for, and why it's different from indicator-based trading tools.

**Why this priority**: This is the entire premise of the feature — without organic/AI discoverability and a clear value proposition on arrival, there is no acquisition funnel at all. Every other story depends on traffic reaching the site first.

**Independent Test**: Can be fully tested by publishing the homepage with SEO/AEO-optimized content and verifying it surfaces for target queries in traditional search results and is accurately summarized when an AI assistant is asked about order-flow/tape-reading trading tools.

**Acceptance Scenarios**:

1. **Given** a person searches a traditional search engine for a query related to tape reading / order-flow trading tools for B3, **When** the site is indexed, **Then** the site appears among the results and the result snippet accurately reflects the product's value proposition.
2. **Given** a person asks a generative AI assistant about tools for order-flow-based trading on B3/mini-dollar, **When** the assistant has access to publicly indexed content, **Then** the assistant can cite or reference the product with an accurate description of what it does.
3. **Given** a first-time visitor lands on the homepage from any referral source, **When** they read the above-the-fold content, **Then** they can state in their own words what the product does and who it's for without scrolling further.

---

### User Story 2 - Evaluate credibility and take the next step (Priority: P2)

A visitor who understood the value proposition wants to decide whether to trust and engage with the product before committing. They look for how it works, what makes it different (pure order-flow / no chart indicators), risk/regulatory context, and a clear next action.

**Why this priority**: Discovery without conversion produces traffic but no pipeline. This is the second link in the funnel and is what turns SEO/GEO/AEO traffic into leads or users.

**Independent Test**: Can be fully tested by publishing a "how it works" / credibility section and a single primary call-to-action, then verifying a visitor can reach and complete that call-to-action without confusion.

**Acceptance Scenarios**:

1. **Given** a visitor wants to understand how the product works, **When** they navigate from the homepage, **Then** they find a page explaining the order-flow/tape-reading approach in plain language.
2. **Given** a visitor is ready to act, **When** they look for a next step, **Then** exactly one primary call-to-action is presented and clearly labeled.
3. **Given** a visitor is evaluating a financial trading product, **When** they view any page describing capabilities or results, **Then** an appropriate risk/regulatory disclaimer is visible.

---

### User Story 3 - Land directly on relevant content via a long-tail query (Priority: P3)

A person searches or asks an AI assistant a specific, long-tail question (e.g., "what is order flow absorption in mini-dollar futures", "difference between tape reading and technical indicators") and lands directly on a content page answering that question — not just the homepage — which then guides them toward the product.

**Why this priority**: Long-tail content is what compounds SEO/GEO/AEO reach over time and is what AI answer engines most often cite verbatim; it's additive to P1/P2 rather than required for a minimal launch.

**Independent Test**: Can be fully tested by publishing at least one long-tail content page, verifying it ranks/gets cited for its target query, and verifying it links back to the core value proposition and call-to-action.

**Acceptance Scenarios**:

1. **Given** a long-tail content page exists for a specific order-flow/tape-reading concept, **When** it is indexed, **Then** it is discoverable via a search query matching that concept.
2. **Given** a visitor lands on a long-tail content page, **When** they finish reading, **Then** they can navigate to the homepage or primary call-to-action in one step.

---

### Edge Cases

- What happens when an AI answer engine cites outdated or superseded content (e.g., after a pricing or positioning change)? Content MUST have a visible last-updated indicator and an editorial process for keeping high-traffic pages current.
- How does the site handle a visitor who is not part of the target market (e.g., not a Brazilian B3 trader, or looking for chart/indicator-based tools)? Content should let them self-disqualify quickly rather than mislead them into converting.
- How does the system behave at launch, before any page has been indexed or cited yet (cold start)? This is expected and addressed by the time-bound success criteria below rather than being treated as a failure state.
- What happens when a page is only partially translated or region-specific terminology (WDO, B3, tape reading) is unfamiliar to a reader? Key domain terms must be briefly explained on first use.
- What happens when the waitlist form receives an automated/bot submission? It MUST be rejected silently (no error shown to the bot) without blocking legitimate visitors.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The site MUST publicly present the product's value proposition (order-flow / tape-reading based trading analysis for B3 mini-dollar futures) without requiring login or an account.
- **FR-002**: The site MUST provide, at minimum, a home/value-proposition page, a "how it works" page, and a pricing-or-access page, plus a small set of long-tail content pages (e.g., glossary/concept explainers) sized to support SEO/GEO/AEO discovery beyond the homepage.
- **FR-003**: Every public page MUST be crawlable and indexable by traditional search engines (valid `sitemap.xml`, `robots.txt`, semantic HTML headings, descriptive meta titles/descriptions).
- **FR-004**: The site MUST expose structured, machine-readable summaries of its content (e.g., structured data markup and an `llms.txt`-style summary) so generative AI answer engines can accurately extract and cite the product's value proposition.
- **FR-005**: Every page MUST present exactly one primary call-to-action: requesting early access (waitlist/interest form).
- **FR-006**: The site MUST display a visible risk/regulatory disclaimer appropriate for a financial trading product operating on B3-regulated instruments, consistent with the project's compliance principle.
- **FR-007**: The site MUST be usable and legible on both desktop and mobile viewports.
- **FR-008**: The site MUST record traffic source and call-to-action completion so the effectiveness of the SEO/GEO/AEO acquisition strategy can be measured per page.
- **FR-009**: Content pages MUST be publishable and editable independently of the trading system's backend release cycle.
- **FR-010**: The site's primary content MUST be authored in Brazilian Portuguese, targeting Brazilian retail and prop traders operating mini-dollar (WDO) futures on B3.
- **FR-011**: Each content/long-tail page MUST link back to the primary value proposition or call-to-action within one navigation step.
- **FR-012**: High-traffic or frequently-cited pages MUST display a visible last-updated indicator.
- **FR-013**: The site MUST provide a dedicated privacy policy page and require explicit consent (checkbox, not pre-checked) before a visitor submits the waitlist/early-access form, with a defined data retention and deletion process for submitted lead data (LGPD-aligned).
- **FR-014**: Submitted waitlist/early-access leads MUST be persisted in the product's own database AND synced to the ROI Labs CRM (roihub) for follow-up. Connection credentials and integration configuration are implementation detail and out of scope for this specification.
- **FR-015**: All public pages MUST conform to WCAG 2.1 level AA (color contrast, keyboard navigation, screen-reader-compatible markup).
- **FR-016**: The waitlist/early-access form MUST reject automated/bot submissions (invisible CAPTCHA/honeypot plus server-side validation) without adding friction for real visitors.

### Key Entities

- **Content Page**: A publicly published page (home, how-it-works, pricing/access, long-tail concept explainer). Attributes: URL slug, title, meta description, structured-data summary, last-updated date, target query/topic.
- **Call-to-Action / Lead**: A visitor-submitted expression of interest (early-access/waitlist request). Attributes: source page, referral channel (organic search, AI referral, direct, other), timestamp, consent-given flag, consent timestamp, CRM sync status.
- **Referral Channel**: The classification of how a visitor arrived (traditional search, AI answer engine, direct, other), used to attribute conversions back to the acquisition strategy.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Within 6 months of launch, the site ranks on the first page of traditional search results for at least 3 of the product's primary target queries (Portuguese, order-flow/tape-reading/B3-mini-dollar related).
- **SC-002**: Within 6 months of launch, when a general-purpose AI assistant is asked an open question about order-flow or tape-reading trading tools for B3, it references the product with an accurate description, verified via periodic manual prompting.
- **SC-003**: A first-time visitor can correctly describe what the product does and who it's for after viewing only the homepage, verified via lightweight user testing.
- **SC-004**: At least 2% of visitors arriving from organic search or an AI referral complete the primary call-to-action within the first 3 months post-launch.
- **SC-005**: Every published content page has a visible last-updated date and no primary content page goes more than 6 months without a review.
- **SC-006**: The home page and all primary content pages meet Google's "Good" Core Web Vitals thresholds (LCP < 2.5s, CLS < 0.1, INP < 200ms) for typical Brazilian connection speeds.

## Assumptions

- The public site is a new, separate deliverable from the existing trading application (Backend/Frontend); it does not require changes to the trading engine itself.
- Primary conversion goal for this first version is early-access/waitlist signup, not direct self-serve purchase or in-app account creation — the product is treated as pre-general-availability for the public.
- Primary audience and content language is Brazilian Portuguese, targeting traders in the Brazilian mini-dollar (WDO) futures market on B3, consistent with the project's existing broker integration (Nelogica) and regulatory context (CVM/B3).
- Minimum v1 content scope is a small, curated set of pages (home, how-it-works, pricing/access, a handful of long-tail concept pages) rather than a full content hub/blog; the content hub can grow incrementally after launch.
- No online payment collection is in scope for v1; monetization/checkout is a separate future feature.
- Accessibility and performance targets are as stated in FR-015 and SC-006; no additional numeric targets beyond those apply for v1.
- Analytics/attribution can use a standard, privacy-respecting web analytics approach; no specific vendor is mandated by this spec.
