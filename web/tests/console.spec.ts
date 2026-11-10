import { expect, test as it } from '@playwright/test';

import { stateSchema } from '@api/zod/stateSchema';

it('readings, confirmed command, history, rules and settings', async ({ page }, testInfo) => {
  const ruleName = `Тест влажности ${testInfo.project.name}`;

  await page.goto('/');

  await expect(page.getByText('45', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('23.5', { exact: false })).toBeVisible();

  await page.getByRole('group', { name: 'Питание', exact: true }).getByRole('button', { pressed: false }).click();

  await expect(page.getByText('Прибор подтвердил изменение')).toBeVisible();

  await page.getByRole('link', { name: 'История', exact: true }).click();

  await expect(page.getByText('История климата', { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Автоматизации', exact: true }).click();

  await expect(page.getByText('Ночь', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Добавить', exact: true }).last().click();
  await page.getByLabel('Название', { exact: true }).fill(ruleName);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();

  await expect(page.getByText(ruleName, { exact: true })).toBeVisible();

  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  await page.getByLabel('Хранить историю, дней').fill('180');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();

  await expect(page.getByText('Настройки сохранены')).toBeVisible();

  await page.getByRole('link', { name: 'События', exact: true }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'События', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Событие', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

it('explicitly displays stale and database errors', async ({ page }) => {
  await page.route('**/api/v1/state', async (route) => {
    const response = await route.fetch();
    const state = stateSchema.parse(await response.json());

    await route.fulfill({ json: { ...state, online: false, stale: true, database_ok: false, error: 'lan_or_token' } });
  });
  await page.goto('/');

  await expect(page.getByText('Показания устарели', { exact: true })).toBeVisible();
  await expect(page.getByText('История временно недоступна', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('group', { name: 'Питание', exact: true }).getByRole('button', { name: 'Включено', exact: true }),
  ).toBeDisabled();
});

it('rejects fractional humidity and timer values before sending', async ({ page }) => {
  const commands: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/commands') && request.method() === 'POST') {
      commands.push(request.postData() ?? '');
    }
  });

  await page.goto('/');

  const initialTarget = await page.getByLabel('Целевая влажность', { exact: false }).inputValue();

  await page.getByLabel('Целевая влажность', { exact: false }).fill('50.5');

  await page.getByLabel('Целевая влажность', { exact: false }).press('Tab');

  await expect(page.getByLabel('Целевая влажность', { exact: false })).toHaveAttribute('aria-invalid', 'true');
  expect(commands).toEqual([]);

  await page.getByLabel('Целевая влажность', { exact: false }).fill(initialTarget === '51' ? '52' : '51');

  await page.getByLabel('Целевая влажность', { exact: false }).press('Enter');

  await expect(page.getByText('Прибор подтвердил изменение')).toBeVisible();
  expect(commands).toHaveLength(1);

  await page.goto('/automations');
  await page.getByLabel('Таймер выключения, минут').fill('60.5');

  await expect(page.getByRole('button', { name: 'Установить', exact: true })).toBeDisabled();

  await page.getByLabel('Таймер выключения, минут').fill('60');

  await expect(page.getByRole('button', { name: 'Установить', exact: true })).toBeEnabled();
});

it('does not request history for a reversed URL range', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/history')) {
      requests.push(request.url());
    }
  });

  await page.goto('/history?period=custom&start=2026-11-09T00:00:00Z&end=2026-11-08T00:00:00Z');

  await expect(page.getByRole('alert')).toContainText('Начало должно быть раньше конца');
  expect(requests).toEqual([]);
});

it('keeps keyboard focus when changing a scene action', async ({ page }) => {
  await page.goto('/automations');
  await page.getByRole('button', { name: 'Добавить', exact: true }).first().click();
  await page.getByRole('button', { name: 'Добавить действие', exact: true }).click();
  const property = page.getByLabel('Настройка 1', { exact: true });

  await property.focus();
  await property.selectOption('brightness');

  await expect(property).toBeFocused();
  await expect(
    page.getByRole('group', { name: 'Значение 1', exact: true }).getByRole('button', { name: 'Выключен', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
});
