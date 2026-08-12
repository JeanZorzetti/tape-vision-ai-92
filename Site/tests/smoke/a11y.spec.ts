import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PAGES = ['/', '/como-funciona', '/acesso', '/privacidade', '/conceitos/absorcao', '/404'];

test.describe('Accessibility — WCAG 2.1 AA (FR-015)', () => {
  for (const path of PAGES) {
    test(`${path} has zero axe violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
    });
  }

  test('skip link is the first focusable element and targets #conteudo', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toHaveAttribute('href', '#conteudo');
    await expect(page.locator('main#conteudo')).toHaveCount(1);
  });
});
