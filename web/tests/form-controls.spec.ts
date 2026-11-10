import { expect, test as it } from '@playwright/test';

it('uses a pointer for interactive controls and keeps disabled controls distinct', async ({ page }) => {
  await page.route('**/api/v1/capabilities', (route) => route.fulfill({ json: { items: [] } }));
  await page.goto('/');

  await expect(page.getByRole('link', { name: 'Настройки', exact: true })).toHaveCSS('cursor', 'pointer');
  const power = page.getByRole('group', { name: 'Питание', exact: true }).getByRole('button').first();

  await expect(power).toBeDisabled();
  await expect(power).not.toHaveCSS('cursor', 'pointer');
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить настройки', exact: true })).toHaveCSS('cursor', 'pointer');
});

it('edits settings with segments without saving before submission', async ({ page }) => {
  const updates: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/settings') && request.method() !== 'GET') {
      updates.push(request.method());
    }
  });
  await page.goto('/settings');

  const notifications = page.getByRole('group', { name: 'Отправлять уведомления в Telegram', exact: true });
  await notifications.getByRole('button', { name: 'Включено', exact: true }).click();

  await expect(notifications.getByRole('button', { name: 'Включено', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('group', { name: 'Код 0', exact: true }).getByRole('button')).toHaveCount(3);
  expect(updates).toEqual([]);
});

it('uses segmented device values in the scene editor', async ({ page }) => {
  await page.goto('/automations');
  await page.getByRole('button', { name: 'Добавить', exact: true }).first().click();
  await page.getByRole('button', { name: 'Добавить действие', exact: true }).click();

  const value = page.getByRole('group', { name: 'Значение 1', exact: true });
  const property = page.getByLabel('Настройка 1', { exact: true });

  await expect(property).toHaveCSS('cursor', 'pointer');
  await expect(property).toHaveCSS('appearance', 'none');
  await expect(property).toHaveCSS('padding-right', '40px');
  const icon = property.locator('..').locator('[data-slot="select-icon"]');

  await expect(icon).toHaveCSS('right', '12px');
  await expect(icon).toHaveCSS('pointer-events', 'none');
  await expect(value.getByRole('button')).toHaveCount(2);
  await property.selectOption('brightness');

  await expect(value.getByRole('button')).toHaveCount(3);
  await value.getByRole('button', { name: 'Обычный', exact: true }).click();

  await expect(value.getByRole('button', { name: 'Обычный', exact: true })).toHaveAttribute('aria-pressed', 'true');

  await property.selectOption('level');

  await expect(value.getByRole('button')).toHaveCount(6);
  await value.getByRole('button', { name: '5', exact: true }).click();

  await expect(value.getByRole('button', { name: '5', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeVisible();
});
