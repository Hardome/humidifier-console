import { expect, test as it } from '@playwright/test';

it('paginates history events and resets the page when the period changes', async ({ page }) => {
  await page.route('**/api/v1/events?**', async (route) => {
    const query = new URL(route.request().url()).searchParams;
    const offset = Number(query.get('offset') ?? 0);
    const limit = Number(query.get('limit') ?? 100);
    const items = Array.from({ length: 23 }, (_unused, index) => ({
      id: String(index),
      at: new Date().toISOString(),
      type: 'state',
      source: 'panel',
      message: `Событие ${index + 1}`,
      data: {},
    })).slice(offset, offset + limit);

    await route.fulfill({ json: { items, total: 23, limit, offset } });
  });
  await page.goto('/history');

  const pagination = page.getByRole('navigation', { name: 'Страницы событий за период' });
  const rows = page.locator('tbody tr');

  await expect(rows).toHaveCount(10);
  await expect(pagination.getByRole('button', { name: 'Назад' })).toBeDisabled();

  await pagination.getByRole('button', { name: 'Далее' }).click();

  await expect(page).toHaveURL(/eventOffset=10/);
  await expect(rows.first()).toContainText('Событие 11');

  await page.reload();

  await expect(rows.first()).toContainText('Событие 11');
  await pagination.getByRole('button', { name: 'Далее' }).click();

  await expect(rows).toHaveCount(3);
  await expect(pagination.getByRole('button', { name: 'Далее' })).toBeDisabled();

  await page.getByRole('button', { name: 'Неделя', exact: true }).click();

  await expect(rows).toHaveCount(10);
  await expect(rows.first()).toContainText('Событие 1');
  await expect(pagination.getByRole('button', { name: 'Назад' })).toBeDisabled();
});
