import AxeBuilder from '@axe-core/playwright';
import { expect, test as it } from '@playwright/test';

for (const theme of ['light', 'dark'] as const) {
  for (const route of ['/', '/history', '/automations', '/events', '/settings']) {
    it(`${route} is accessible in ${theme} theme`, async ({ page }) => {
      await page.addInitScript((preference) => localStorage.setItem('humidifier-theme', preference), theme);

      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();

      expect(results.violations).toEqual([]);
    });
  }
}

it('lets keyboard users skip navigation and reach the main content', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');

  await expect(page.getByRole('link', { name: 'Перейти к содержимому' })).toBeFocused();

  await page.keyboard.press('Enter');

  await expect(page.getByRole('main')).toBeFocused();
});
