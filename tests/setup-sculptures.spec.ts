import { test, expect } from '@playwright/test';

test('four real setup forms respond to consent, profile and navigation', async ({ page }, info) => {
  test.setTimeout(120000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  const canvas = page.locator('[data-scene="core"] canvas');
  await expect(canvas).toHaveAttribute('data-webgl', 'ready', { timeout: 30000 });
  const next = () => dialog.getByRole('button', { name: 'Продолжить' });
  const back = () => dialog.getByRole('button', { name: 'Назад' });
  await expect(canvas).toHaveAttribute('data-setup-form', 'orbit-sphere');
  await next().click();
  await expect(canvas).toHaveAttribute('data-setup-form', 'titanium-torus-knot');
  await next().click();
  await expect(canvas).toHaveAttribute('data-setup-form', 'crystal-shield');
  await expect.poll(async () => Number(await canvas.getAttribute('data-facet-gap'))).toBeGreaterThan(1.18);
  await expect(next()).toBeDisabled();
  await dialog.getByRole('checkbox').check();
  await expect.poll(async () => Number(await canvas.getAttribute('data-facet-gap'))).toBeLessThan(1.03);
  await next().click();
  await expect(canvas).toHaveAttribute('data-setup-form', 'kinetic-blades');
  await expect.poll(async () => Number(await canvas.getAttribute('data-blade-speed'))).toBeLessThan(.25);
  const fps = dialog.getByRole('button', { name: /Максимальный FPS/ });
  await fps.click();
  await expect.poll(async () => Number(await canvas.getAttribute('data-blade-speed'))).toBeGreaterThan(.8);
  await expect.poll(async () => Number(await canvas.getAttribute('data-blade-pitch'))).toBeGreaterThan(.6);
  const rotation = Number(await canvas.getAttribute('data-blade-rotation'));
  await expect.poll(async () => Math.abs(Number(await canvas.getAttribute('data-blade-rotation')) - rotation)).toBeGreaterThan(.1);
  if (info.project.name === 'desktop') {
    await dialog.getByRole('button', { name: /Баланс качества/ }).hover();
    await expect(canvas).toHaveAttribute('data-goal', 'fps');
  }
  await dialog.getByRole('button', { name: /Баланс качества/ }).click();
  await expect.poll(async () => Number(await canvas.getAttribute('data-blade-speed'))).toBeLessThan(.5);
  await expect.poll(async () => Number(await canvas.getAttribute('data-blade-pitch'))).toBeLessThan(.4);
  await back().click(); await expect(canvas).toHaveAttribute('data-setup-form', 'crystal-shield');
  await back().click(); await expect(canvas).toHaveAttribute('data-setup-form', 'titanium-torus-knot');
  await back().click(); await expect(canvas).toHaveAttribute('data-setup-form', 'orbit-sphere');
  await next().click(); await next().click(); await next().click();
  await dialog.getByRole('button', { name: 'Войти в SHIFT' }).click();
  await expect(dialog).toBeHidden({timeout:20000}); await expect(page.locator('.title-echo')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('reduced motion resolves forms and non-home entry provides echoes', async ({ page }) => {
  test.setTimeout(120000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/faq');
  const dialog = page.getByRole('dialog'); const canvas = page.locator('[data-scene="core"] canvas');
  await expect(canvas).toHaveAttribute('data-setup-form', 'orbit-sphere', { timeout: 30000 });
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await expect(canvas).toHaveAttribute('data-setup-form', 'titanium-torus-knot');
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await dialog.getByRole('checkbox').check(); await expect(canvas).toHaveAttribute('data-facet-gap', '1.000');
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await dialog.getByRole('button', { name: /Максимальный FPS/ }).click();
  await expect(canvas).toHaveAttribute('data-blade-speed', '0.900');
  await expect(canvas).toHaveAttribute('data-blade-pitch', '0.680');
  await dialog.getByRole('button', { name: 'Войти в SHIFT' }).click();
  await expect(dialog).toBeHidden();
});

test('non-home onboarding finale shows four outline echoes', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/faq'); const d = page.getByRole('dialog');
  await d.getByRole('button', { name: 'Продолжить' }).click();
  await d.getByRole('button', { name: 'Продолжить' }).click();
  await d.getByRole('checkbox').check(); await d.getByRole('button', { name: 'Продолжить' }).click();
  await d.getByRole('button', { name: 'Войти в SHIFT' }).click();
  await expect(d).toBeHidden(); await expect(page.locator('.setup-exit-echo .title-echo')).toHaveCount(4);
  await expect(page.locator('.setup-exit-echo .title-echo').first()).toHaveCSS('color', 'rgba(0, 0, 0, 0)');
});
