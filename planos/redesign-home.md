# Redesign da home — Tape Vision AI

## Contexto

`https://tapevision.roilabs.com.br/` está visualmente cru. Diagnóstico do código (não é
"falta de gosto", é uma causa concreta):

- `Site/src/styles/global.css` importa `tailwindcss` (preflight) mas o site **não usa
  utilitários Tailwind** — usa CSS com escopo por componente. O preflight zera
  `h1..h6`, `ul`, margens. Resultado: o `<h1>` da home renderiza do mesmo tamanho de um
  parágrafo, listas ficam sem marcador, não existe hierarquia tipográfica.
- Os tokens são genéricos (`--color-accent: #3b82f6`, azul Tailwind padrão) e não têm
  relação com a marca — o verde `#00ff88` só existe dentro do SVG do logo.
- A home é um bloco de texto de 70ch centrado: sem hero, sem elemento visual, sem
  seções, sem prova do que o produto faz. Metade da tela fica vazia em desktop.

Objetivo: home que pareça um produto de mesa de operação, mantendo intactos SEO/AEO,
acessibilidade e os orçamentos de performance já validados.

Decisões confirmadas com o usuário: escopo = home + base compartilhada (tokens, Nav,
Footer); direção = "terminal de fita"; copy pode ser reescrito preservando termos-chave;
fonte própria self-hosted liberada.

## Restrições que o redesign não pode quebrar

Contratos já testados — ler antes de mexer:

- `tests/smoke/discovery.spec.ts`: home com **exatamente 1 `h1`**, **exatamente 1
  `.btn-primary`**, texto "aviso de risco" visível, **1 único** `script[type=ld+json]`
  com `@graph` resolvível.
- `tests/smoke/a11y.spec.ts`: **zero violações axe** (wcag2a + wcag2aa) em `/`,
  `/como-funciona`, `/acesso`, `/privacidade`, `/conceitos/absorcao`, `/404`; skip link é
  o primeiro elemento focável.
- `tests/smoke/conceitos.spec.ts`: páginas de conceito precisam de `.prose p` e de
  `a.brand[href="/"]` no nav.
- `lighthouserc.json`: SEO ≥0.95, a11y ≥0.95, LCP ≤2.5s, CLS ≤0.1.

Consequências diretas de design:
- O **único `.btn-primary` da home fica no hero**. A faixa de CTA final (slot `cta` do
  `Base.astro`) usa `.btn-secondary` (outline) com o mesmo destino `/acesso`.
- O painel ilustrativo do hero é CSS puro (sem JS, sem imagem) e com altura reservada —
  zero CLS.
- Nada de dado de mercado inventado passando por real: o painel leva rótulo **visível**
  "Ilustração de leitura de fita — não é cotação em tempo real".

## Sistema de design (tokens em `Site/src/styles/global.css`)

**Cor** — grafite-azulado profundo com sistema de sinal de duas pontas (o vocabulário da
mesa: agressão compradora × vendedora), não um acento solitário:

| token | valor | uso |
|---|---|---|
| `--bg` | `#080d16` | fundo |
| `--surface` | `#0f1726` | cards, painel |
| `--surface-2` | `#16203040` | linhas alternadas da fita |
| `--hairline` | `#1e2a3d` | divisórias |
| `--border` | `#2c3a4f` | bordas de UI |
| `--text` | `#e9eef6` | corpo |
| `--muted` | `#9fb0c6` | secundário (validar ≥4.5:1 em `--bg` e `--surface`) |
| `--buy` | `#00ff88` | agressão compradora + acento da marca (vem do logo) |
| `--sell` | `#ff5468` | agressão vendedora |
| `--focus` | `#fbbf24` | mantido |

Botão primário = fundo `--buy` com texto `#04140b` (≈14:1, resolve de vez o problema de
contraste que o comentário atual do CSS documenta com `--color-accent-button`).
Links de texto: `--buy` sobre fundo escuro. Manter os nomes de token antigos como alias
ou atualizar as referências nos componentes existentes — não deixar token órfão.

**Tipografia** — self-hosted, 3 arquivos woff2 (subset latino) em `Site/public/fonts/`:
IBM Plex Sans 400 e 600 (display + corpo), IBM Plex Mono 500 (dados, eyebrows, rótulos,
números da fita). Obter via `npm i -D @fontsource/ibm-plex-sans @fontsource/ibm-plex-mono`
e copiar os `.woff2` latinos para `public/fonts/` (sem dependência em runtime);
`@font-face` declarado à mão com `font-display: swap`, `preload` dos dois pesos do Sans
no `<head>`. Se a rede bloquear o download, cair para o stack de sistema atual e seguir —
o resto do redesign não depende disso.

Escala (restaura o que o preflight apagou): `h1` `clamp(2.25rem, 5vw, 3.75rem)` /
`line-height: 1.05` / `letter-spacing: -0.02em`; `h2` `clamp(1.5rem, 3vw, 2.125rem)`;
`h3` `1.25rem`; corpo `1.0625rem`/1.65; `.eyebrow` mono, `0.75rem`, `letter-spacing:
0.14em`, uppercase; listas com marcador de volta.

**Layout**: `.container` 1120px + gutter 20px; ritmo de seção
`padding-block: clamp(3rem, 7vw, 5.5rem)`; raio 10px; hairlines em vez de sombras.

**Assinatura**: o painel de fita do hero (abaixo).

## Estrutura da home (`Site/src/pages/index.astro`, reescrita)

1. **Hero** — grid 2 colunas (≥900px; empilha no mobile).
   - Esquerda: eyebrow mono `WDO · B3 · FLUXO DE ORDENS`; `h1` curto e afirmativo
     ("Leia a fita, não o gráfico." ou equivalente); subtítulo carregando os termos de
     busca (leitura de fita, fluxo de ordens, time & sales, livro de ofertas, absorção,
     agressão, mini-dólar WDO, B3); `.btn-primary` → `/acesso` + link secundário
     "Como funciona"; linha mono de reforço ("Sem sinal automático. Sem promessa de
     lucro.").
   - Direita: **`TapePanel.astro`** (novo) — o elemento de assinatura. Coluna de
     Time & Sales (hora · preço · qtd · agressor, mono, linhas verdes/vermelhas) rolando
     por `@keyframes` sobre uma lista duplicada, ao lado de um mini book/ladder com
     barras de volume proporcionais; um nível marcado com badge "ABSORÇÃO" pulsando.
     `aria-hidden="true"` no gráfico, altura fixa (sem CLS), `prefers-reduced-motion:
     reduce` → congela. Legenda visível de ilustração logo abaixo.
2. **O que o sistema lê** — 4 cards (Time & sales, Livro de ofertas, Absorção, Agressão),
   texto condensado do que já existe em `como-funciona.astro`, cada um linkando para o
   conceito correspondente.
3. **Para quem é / Para quem não é** — duas colunas contrastantes; o parágrafo
   `.disqualifier` atual vira conteúdo com peso próprio (é o que qualifica o lead), com
   marcadores usando `--buy` / `--sell`.
4. **Conceitos** — grid de cards em vez da lista de links azuis: título + o campo
   `answer` do frontmatter (BLUF já existente, ≤320 chars) truncado. Reusa
   `getCollection('conceitos')` como hoje.
5. **CTA final** (slot `cta`) — faixa com hairline, título curto e `.btn-secondary`
   → `/acesso`.

Todo o conteúdo SEO/AEO atual continua na página (reescrito, não removido): as
definições de WDO/B3, o público-alvo e a desqualificação.

## Arquivos

| arquivo | mudança |
|---|---|
| `Site/src/styles/global.css` | tokens novos, `@font-face`, escala tipográfica (desfaz o preflight), `.container`, `.eyebrow`, `.card`, `.btn-primary`, `.btn-secondary` |
| `Site/public/fonts/*.woff2` | novo — 3 subsets latinos |
| `Site/src/layouts/Base.astro` | `preload` das fontes, header sticky, restyle do `.cta-region` |
| `Site/src/components/Nav.astro` | header sticky com hairline + blur, link de CTA ghost, ajuste mobile |
| `Site/src/components/Footer.astro` | 3 colunas (marca / navegação / legal), disclaimer mantido visível |
| `Site/src/components/TapePanel.astro` | novo — painel de fita CSS puro |
| `Site/src/pages/index.astro` | reescrita completa |
| `Site/src/pages/como-funciona.astro`, `acesso.astro`, `conceitos/[...slug].astro` | apenas o mínimo para não destoar dos tokens novos (nomes de classe/variáveis) — sem reestruturar conteúdo |

Sem dependências novas em runtime. Sem JS novo na home.

## Verificação

1. `cd Site && npm run check` — astro check + eslint limpos.
2. `npm run test` — unit/contract (não devem ser afetados; se algum quebrar, é regressão).
3. `npm run build` — inclui `scripts/check-freshness.mjs`.
4. `npm run preview:static` + `npm run test:smoke` — **os 3 specs precisam passar**,
   especialmente axe zero violações e a contagem de 1 `h1` / 1 `.btn-primary` na home.
5. Playwright MCP: screenshot da home em 1440×900 e 390×844 (mobile) para inspeção
   visual, mais navegação por teclado conferindo o anel de foco.
6. Se `lhci` estiver disponível: `npx lhci autorun` contra `dist/` e conferir LCP ≤2.5s
   e CLS ≤0.1 (o painel tem altura reservada; a fonte usa `swap` + preload).
7. Commit + push para `main` ao final (padrão do usuário).

Nota: o repo tem `.specify/` e `specs/001-public-product-site`. Esta mudança é visual e
não altera nenhum requisito funcional (FR-005/006/015 continuam valendo e testados), por
isso segue como implementação direta. Se quiser rastrear como feature nova no Spec Kit,
dá para gerar a spec antes de executar — é só pedir.
