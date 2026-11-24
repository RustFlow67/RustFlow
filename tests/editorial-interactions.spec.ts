import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
});

test('chapter rail indicates the active page', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Навигация по главам' });
  await expect(nav.getByRole('link', { name: /Обзор/ })).toHaveAttribute('aria-current', 'page');
  await nav.getByRole('link', { name: /Драйверы/ }).click();
  await expect(page).toHaveURL(/\/drivers$/, { timeout: 20000 });
  await expect(nav.getByRole('link', { name: /Драйверы/ })).toHaveAttribute('aria-current', 'page');
});

test('first click works for selectors, dialogs, slider and FAQ controls', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/benchmark');
  const cpu = page.getByRole('button', { name: 'Процессор (CPU)' });
  await cpu.click();
  await expect(cpu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(cpu).toHaveAttribute('aria-expanded', 'false');
  await page.goto('/drivers');
  await page.getByRole('button', { name: 'NVIDIA RTX/GTX' }).click();
  const modal = page.getByRole('dialog', { name: 'NVIDIA RTX/GTX' });
  await expect(modal).toBeVisible();
  expect(await modal.evaluate(el => ({ radius: parseFloat(getComputedStyle(el).borderRadius), overflow: getComputedStyle(el).overflow }))).toEqual({ radius: 2, overflow: 'hidden' });
  await modal.getByRole('button', { name: /RTX 50/ }).click();
  await modal.getByRole('button', { name: 'GeForce RTX 5090', exact: true }).click();
  await expect(modal.locator('[data-driver-model]')).toHaveAttribute('data-driver-model', 'GeForce RTX 5090');
  await page.keyboard.press('Escape');
  await page.goto('/presets');
  const draw = page.locator('.config-sliders input').first();
  await draw.fill('2000');
  await expect(page.locator('.config-visual')).toHaveAttribute('aria-label', /2000/);
  await page.goto('/tweaker');
  await page.getByRole('radiogroup', { name: /Графический профиль/ }).getByRole('radio').first().click();
  await page.goto('/base');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('База.');
  await page.goto('/faq');
  const answer = page.locator('.reading-answer button').first();
  await answer.click();
  await expect(answer).toHaveAttribute('aria-expanded', 'true');
  expect(errors).toEqual([]);
});

test('offscreen cards reveal on scrolling on each inner page', async ({ page }) => {
  for (const path of ['/benchmark', '/presets', '/tweaker', '/drivers', '/base', '/faq']) {
    await page.goto(path);
    await expect.poll(() => page.locator('main').evaluate(el => !!el.closest('[inert]')), { timeout: 20000 }).toBe(false);
    const candidate = page.locator('.build-fields > div, .preset-card, .config-workbench, .category-card, .family-choice, #knowledge article, .reading-card, .reading-answer');
    const index = await candidate.evaluateAll(elements => elements.findIndex(el => {
      const rect = el.getBoundingClientRect();
      return rect.top > innerHeight + 100 && rect.width > 0 && rect.height > 0 && !el.closest('[inert]');
    }));
    expect(index, `missing offscreen target at ${path}`).toBeGreaterThanOrEqual(0);
    const element = candidate.nth(index);
    await element.evaluate(el => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await expect.poll(() => element.evaluate(el => el.getAnimations().some(animation => animation.playState === 'running')), { timeout: 3000 }).toBe(true);
  }
});

test('reduced motion leaves content visible and usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/presets');
  await expect(page.locator('.config-workbench')).toBeVisible();
  await page.locator('.config-sliders input').first().fill('1800');
  await expect(page.locator('.config-visual')).toHaveAttribute('aria-label', /1800/);
});
