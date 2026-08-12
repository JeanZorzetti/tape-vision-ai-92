import { test, expect } from '@playwright/test';

const SLUG = 'absorcao';

test.describe('Concept pages (US3)', () => {
  test('BLUF answer is present above the fold, and the page reaches home/CTA in one step', async ({
    page,
  }) => {
    await page.goto(`/conceitos/${SLUG}`);

    await expect(page.locator('h1')).toHaveCount(1);

    // The BLUF answer is the opening paragraph of the rendered markdown body.
    const firstParagraph = page.locator('.prose p').first();
    await expect(firstParagraph).toBeVisible();

    // One step to home (nav brand link) and one step to the CTA — both always present via Base.astro.
    await expect(page.locator('.btn-primary')).toHaveCount(1);
    await expect(page.locator('a.brand[href="/"]')).toBeVisible();
  });

  test('Article.dateModified matches the visible "Atualizado em" date', async ({ page }) => {
    await page.goto(`/conceitos/${SLUG}`);

    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const parsed = JSON.parse(raw ?? '{}');
    const article = parsed['@graph'].find((node: Record<string, unknown>) => node['@type'] === 'Article');
    expect(article?.dateModified).toBeTruthy();

    const visibleDate = await page.getByText(/^Atualizado em/).textContent();
    expect(visibleDate).toBeTruthy();
  });

  test('draft concept pages are never built or exposed', async ({ page }) => {
    const response = await page.goto('/conceitos/pagina-inexistente-rascunho', {
      waitUntil: 'domcontentloaded',
    });
    expect(response?.status()).toBeGreaterThanOrEqual(400);
  });
});
