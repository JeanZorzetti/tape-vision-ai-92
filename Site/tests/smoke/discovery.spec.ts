import { test, expect } from '@playwright/test';

test.describe('Discovery surface (US1)', () => {
  test('robots.txt, sitemap-index.xml, llms.txt are reachable', async ({ request }) => {
    const robots = await request.get('/robots.txt');
    expect(robots.status()).toBe(200);
    expect(await robots.text()).toContain('sitemap-index.xml');

    const sitemap = await request.get('/sitemap-index.xml');
    expect(sitemap.status()).toBe(200);

    const llms = await request.get('/llms.txt');
    expect(llms.status()).toBe(200);
    expect(llms.headers()['content-type']).toContain('text/plain');
  });

  test('home page carries exactly one resolvable JSON-LD @graph', async ({ page }) => {
    await page.goto('/');

    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts).toHaveCount(1);

    const raw = await scripts.first().textContent();
    const parsed = JSON.parse(raw ?? '{}');
    expect(Array.isArray(parsed['@graph'])).toBe(true);

    const ids = new Set(
      parsed['@graph'].map((node: Record<string, unknown>) => node['@id']).filter(Boolean),
    );

    function collectRefs(value: unknown, refs: string[]) {
      if (Array.isArray(value)) {
        value.forEach((v) => collectRefs(v, refs));
      } else if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        if (typeof obj['@id'] === 'string' && Object.keys(obj).length === 1) {
          refs.push(obj['@id'] as string);
        }
        Object.values(obj).forEach((v) => collectRefs(v, refs));
      }
    }

    const refs: string[] = [];
    collectRefs(parsed['@graph'], refs);
    for (const ref of refs) {
      expect(ids.has(ref), `unresolved @id reference: ${ref}`).toBe(true);
    }
  });

  test('home page has exactly one h1, one primary CTA, and the disclaimer', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toHaveCount(1);
    // .btn-primary is the primary CTA specifically — plain nav/footer links to
    // /acesso also contain "acesso antecipado" text but aren't the CTA (FR-011 wants
    // them too; FR-005 only bounds the styled call-to-action element).
    await expect(page.locator('.btn-primary')).toHaveCount(1);
    await expect(page.getByText(/aviso de risco/i)).toBeVisible();
  });
});
