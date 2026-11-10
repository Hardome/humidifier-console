import { expect, test as it } from '@playwright/test';

it('theme follows system settings and persists explicit preference', async ({ page, isMobile }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/');

  const sidebarSwitcher = page.getByRole('complementary').getByRole('group', { name: 'Тема оформления' });

  await expect(sidebarSwitcher).toBeVisible({ visible: !isMobile });

  if (isMobile) {
    await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  }

  const themeSwitcher = page.getByRole(isMobile ? 'main' : 'complementary').getByRole('group', {
    name: 'Тема оформления',
  });

  await expect(themeSwitcher).toBeVisible();
  await expect(themeSwitcher.getByRole('button')).toHaveText(['', '', '']);
  await expect(themeSwitcher.locator('svg')).toHaveCount(3);

  await expect(page.locator('html')).toHaveClass('dark');

  await page.emulateMedia({ colorScheme: 'light' });

  await expect(page.locator('html')).not.toHaveClass('dark');

  await themeSwitcher.getByRole('button', { name: 'Тёмная', exact: true }).click();

  await expect(page.locator('html')).toHaveClass('dark');

  await page.reload();

  await expect(page.locator('html')).toHaveClass('dark');

  for (const name of ['История', 'Автоматизации', 'События', 'Настройки', 'Обзор']) {
    await page.getByRole('link', { name, exact: true }).click();

    await expect(page.locator('h1')).toHaveText(name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  await page.screenshot({ path: it.info().outputPath('dark.png'), fullPage: true });

  if (isMobile) {
    await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  }

  await page.getByRole('button', { name: 'Светлая', exact: true }).click();

  await expect(page.locator('html')).not.toHaveClass('dark');

  await page.screenshot({ path: it.info().outputPath('light.png'), fullPage: true });
});

it('theme works when storage access is denied', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('Storage denied');
      },
    });
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Тёмная', exact: true }).click();

  await expect(page.locator('html')).toHaveClass('dark');

  await page.getByRole('button', { name: 'Светлая', exact: true }).click();

  await expect(page.locator('html')).not.toHaveClass('dark');
});

it('event filters persist in URL and settings keep unsaved changes', async ({ page }) => {
  await page.goto('/events');
  await page.getByLabel('Источник', { exact: true }).selectOption('panel');

  await expect(page).toHaveURL(/source=panel/);

  await page.reload();

  await expect(page.getByLabel('Источник', { exact: true })).toHaveValue('panel');

  await page.goto('/settings');

  const retention = page.getByLabel('Хранить историю, дней');

  await retention.fill('123');
  await page.waitForResponse(
    (response) => response.url().includes('/settings') && response.request().method() === 'GET',
  );

  await expect(retention).toHaveValue('123');
});
