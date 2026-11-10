import { expect, test as it } from '@playwright/test';

it('keeps the desktop sidebar within the viewport on a long page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const sidebar = page.getByRole('complementary');

  await expect(sidebar).toHaveCSS('height', '720px');
  // Не доходим один пиксель до конца: округление прокрутки сдвигает границу sticky на долю пикселя.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight - window.innerHeight - 1));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect.poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().top)).toBeCloseTo(0, 0);
  await expect(sidebar).toHaveCSS('height', '720px');
});

it('aligns page content to the top on tall screens', async ({ page, isMobile }) => {
  await page.setViewportSize({ width: isMobile ? 390 : 1280, height: 1600 });

  for (const route of ['/events', '/history', '/automations', '/settings']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const sidebarBottom = await page
      .getByRole('complementary')
      .evaluate((element) => element.getBoundingClientRect().bottom);
    const contentTop = await page.getByRole('main').evaluate((element) => element.getBoundingClientRect().top);

    expect(contentTop).toBeCloseTo(isMobile ? sidebarBottom : 0, 0);
  }
});
