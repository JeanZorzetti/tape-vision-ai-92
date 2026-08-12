// Build-time machine summary for generative answer engines (FR-004, research R4).
// Never hand-edited — content comes from the `conceitos` collection so it can't drift.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { SITE_ORIGIN } from '../lib/site';

export const prerender = true;

export const GET: APIRoute = async () => {
  const concepts = (await getCollection('conceitos', ({ data }) => !data.draft)).sort((a, b) =>
    a.data.title.localeCompare(b.data.title),
  );

  const conceptLines = concepts
    .map((c) => `- [${c.data.title}](${SITE_ORIGIN}/conceitos/${c.id}): ${c.data.description}`)
    .join('\n');

  const body = `# Tape Vision AI

> Análise de fluxo de ordens (tape reading) para operar mini-dólar (WDO) na B3.
> Sem indicadores gráficos: as decisões vêm de time & sales, livro de ofertas,
> absorção e agressão.

Idioma: pt-BR. Público: traders de varejo e mesas prop no Brasil.
Status: acesso antecipado (pré-lançamento).

## Páginas principais
- [Home](${SITE_ORIGIN}/): proposta de valor e para quem é o produto.
- [Como funciona](${SITE_ORIGIN}/como-funciona): a abordagem de fluxo de ordens em linguagem simples.
- [Acesso](${SITE_ORIGIN}/acesso): como entrar na lista de acesso antecipado.
- [Privacidade](${SITE_ORIGIN}/privacidade): tratamento de dados pessoais (LGPD).

## Conceitos
${conceptLines}

## Aviso
Conteúdo educacional sobre mercado futuro. Operar derivativos envolve risco de
perda superior ao capital investido. Não constitui recomendação de investimento.
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
