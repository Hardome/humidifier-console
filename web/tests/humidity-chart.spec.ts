import { expect, test as it } from '@playwright/test';

import { HumidifierStatus, targetHumidity } from '@entities/humidifier';

import { historySchema } from '@api/zod/historySchema';

it('hides reference boundaries on overview and keeps them available in history', async ({ page }) => {
  await page.route('**/api/v1/history?**', async (route) => {
    const response = await route.fetch();
    const history = historySchema.parse(await response.json());

    await route.fulfill({
      json: {
        ...history,
        total: 1,
        items: [
          {
            at: new Date().toISOString(),
            count: 1,
            humidity: 45,
            temperature: 23,
            humidity_min: 45,
            humidity_max: 45,
            temperature_min: 23,
            temperature_max: 23,
            target_humidity: targetHumidity.default,
            speed: 0,
            power_seconds: 0,
            status: HumidifierStatus.Off,
          },
        ],
      },
    });
  });
  await page.goto('/');

  await expect(page.getByRole('img', { name: 'Влажность, %', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Рекомендуемые границы', exact: true })).toHaveCount(0);
  await expect(page.getByText('Сухо <30%', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Ориентир 30–50%', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Очень влажно >60%', { exact: true })).toHaveCount(0);

  await page.goto('/history');

  await expect(page.getByRole('img', { name: 'Влажность, %', exact: true })).toBeVisible();
  await expect(page.getByText('Сухо <30%', { exact: true })).toBeVisible();
  await expect(page.getByText('Ориентир 30–50%', { exact: true })).toBeVisible();
  await expect(page.getByText('Очень влажно >60%', { exact: true })).toBeVisible();

  await page.screenshot({ path: it.info().outputPath('humidity-guide.png'), fullPage: true });

  const toggle = page.getByRole('button', { name: 'Рекомендуемые границы', exact: true });
  const chart = page.getByRole('img', { name: 'Влажность, %', exact: true });
  const bounds = await chart.boundingBox();

  expect(bounds?.height).toBeGreaterThanOrEqual(300);
  expect(bounds?.width).toBeGreaterThan(250);
  const toggleBounds = await toggle.boundingBox();

  expect(toggleBounds?.y).toBeGreaterThanOrEqual((bounds?.y ?? 0) + (bounds?.height ?? 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => window.innerWidth),
  );
  const withGuide = await chart.evaluate((element: HTMLCanvasElement) => element.toDataURL());

  await toggle.click();

  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Ориентир 30–50%', { exact: true })).toBeHidden();
  await expect.poll(() => chart.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(withGuide);

  await toggle.click();

  await expect(toggle).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Ориентир 30–50%', { exact: true })).toBeVisible();
  await expect.poll(() => chart.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(withGuide);
});
