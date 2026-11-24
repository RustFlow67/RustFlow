import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
});

test('routes hydrate cleanly and the continuous WebGL scene animates behind the page', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page.locator('.cinematic-backdrop')).toBeVisible();
  await expect(page.getByText(/DEMO \/ НЕ ДАННЫЕ ПК/)).toBeVisible();
  const canvas = page.locator('.cinematic-backdrop canvas');
  await expect(canvas).toHaveAttribute('data-webgl', 'ready', { timeout: 20000 });
  await page.waitForTimeout(300);
  const first = await canvas.screenshot();
  await page.waitForTimeout(400);
  const second = await canvas.screenshot();
  expect(first).not.toEqual(second);
  const rail = await page.locator('.chapter-nav').boundingBox();
  expect(rail && rail.x >= 0 && rail.x + rail.width <= page.viewportSize()!.width).toBeTruthy();
  await expect(page.locator('.cinema-brand')).toBeVisible();
  expect(await page.locator('nextjs-portal').evaluateAll(portals => portals.some(portal => portal.shadowRoot?.textContent?.includes('Runtime Error')))).toBe(false);
  for (const path of ['/benchmark', '/presets', '/tweaker', '/drivers', '/knowledge', '/faq']) {
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
