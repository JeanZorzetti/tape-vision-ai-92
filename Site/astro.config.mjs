import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';
import vercel from '@astrojs/vercel';
import tailwindcss from '@tailwindcss/vite';

// Reads the `updated` frontmatter directly (no Vite/content-collection context is
// available inside the sitemap integration's serialize hook) so concept-page
// sitemap entries carry the same lastmod the visible "Atualizado em" date shows.
function conceptUpdatedDate(slug) {
  try {
    const filePath = fileURLToPath(
      new URL(`./src/content/conceitos/${slug}.md`, import.meta.url),
    );
    const raw = readFileSync(filePath, 'utf8');
    const match = raw.match(/^updated:\s*(\S+)/m);
    return match ? new Date(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

// Single source of truth for the production origin — also read by src/lib/site.ts.
// Changing the subdomain is a one-constant edit here plus a DNS record (research R2).
const SITE_ORIGIN = 'https://tapevision.roilabs.com.br';

export default defineConfig({
  site: SITE_ORIGIN,
  output: 'static',
  adapter: vercel(),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/api/'),
      serialize(item) {
        const match = item.url.match(/\/conceitos\/([^/]+)\/?$/);
        if (match) {
          const updated = conceptUpdatedDate(match[1]);
          if (updated) item.lastmod = updated.toISOString();
        }
        return item;
      },
    }),
    mdx(),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
