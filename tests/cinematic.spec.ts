import { expect, test } from '@playwright/test';

const setup = { version: 1, language: 'ru', goal: 'smooth', accepted: true };

test('four title scenes, consent and pouring logo', async ({ page }) => {
  test.setTimeout(120000);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 20000 });
  const core = page.locator('[data-scene="core"] canvas');
  await expect(core).toHaveAttribute('data-webgl', 'ready', { timeout: 30000 });
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await expect(core).toHaveAttribute('data-step', '1');
  await dialog.getByRole('button', { name: 'English' }).click();
  await expect(dialog.getByRole('heading', { name: 'Choose a language' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(dialog).toContainText('cannot be guaranteed');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByRole('button', { name: /Maximum FPS/ }).click();
  await expect(core).toHaveAttribute('data-goal', 'fps');
  await dialog.getByRole('button', { name: 'Enter SHIFT' }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
  const title = page.locator('.stage-word');
  await expect(title).toHaveAttribute('aria-label', 'SHIFT.');
  await expect(title.locator('.title-pour i')).toHaveCount(3);
  await expect.poll(() => title.locator('.title-pour').evaluate(el => el.getBoundingClientRect().width), { timeout: 15000 }).toBeGreaterThan(10);
  expect(errors).toEqual([]);
});

test('seven chapters, real scene transitions, direct links and functional controls', async ({ page }, info) => {
  test.setTimeout(180000);
  await page.addInitScript(value => localStorage.setItem('shift:setup:v1', JSON.stringify(value)), setup);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Навигация по главам' });
  await expect(nav.getByRole('link')).toHaveCount(7);
  await expect(page.locator('.shift-dock')).toHaveCount(0);
  const canvas = page.locator('[data-scene="cinematic"] canvas');
  await expect(canvas).toHaveAttribute('data-webgl', 'ready', { timeout: 30000 });
  const grab = page.locator('.cinema-grab');
  const box = (await grab.boundingBox())!;
  if (info.project.name === 'desktop') {
    await page.mouse.move(box.x + box.width * .5, box.y + box.height * .35); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .65, box.y + box.height * .4, { steps: 4 }); await page.mouse.up();
  } else {
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width * .5, y = box.y + box.height * .35;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 60, y: y + 15 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await expect(canvas).toHaveAttribute('data-rotation', /,/);
  await nav.getByRole('link', { name: /Телеметрия/ }).click();
  await expect(page.locator('#telemetry')).toBeInViewport({ timeout: 20000 });
  await expect(canvas).toHaveAttribute('data-chapter', '1', { timeout: 20000 });
  const steps = [ ['Сборка', '/benchmark', '2'], ['Пресеты', '/presets', '3'], ['Твикер', '/tweaker', '4'], ['Драйверы', '/drivers', '5'], ['База & FAQ', '/base', '6'] ];
  for (const [label, path, chapter] of steps) {
    await nav.getByRole('link', { name: new RegExp(label.replace('&', '&')) }).click();
    await expect(page).toHaveURL(new RegExp(path + '$'), { timeout: 20000 });
    await expect(canvas).toHaveAttribute('data-chapter', chapter, { timeout: 20000 });
    await expect(nav.getByRole('link', { name: new RegExp(label) })).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('link', { name: /Безопасность EAC и FAQ/ }).click();
  await expect(page).toHaveURL(/\/faq$/, { timeout: 20000 });
  await expect(nav.getByRole('link', { name: /База & FAQ/ })).toHaveAttribute('aria-current', 'page');
  await page.goto('/presets');
  const slider = page.locator('.config-sliders input').first();
  const profileBefore = await canvas.getAttribute('data-profile');
  await slider.fill('2000');
  await expect(page.locator('.config-visual')).toHaveAttribute('aria-label', /2000/);
  await expect.poll(() => canvas.getAttribute('data-profile')).not.toBe(profileBefore);
  await page.goto('/tweaker');
  const sw = page.locator('[data-manual-tweak]').first().getByRole('switch');
  await expect(sw).toHaveAttribute('aria-checked', 'false'); await sw.click(); await expect(sw).toHaveAttribute('aria-checked', 'true');
  await expect(canvas).toHaveAttribute('data-selected', '1');
  await page.goto('/benchmark');
  await page.getByRole('button', { name: 'Процессор (CPU)' }).click();
  await expect(page.getByRole('button', { name: 'Процессор (CPU)' })).toHaveAttribute('aria-expanded', 'true');
  expect(errors).toEqual([]);
});

test('edge wheel and keyboard navigate without hijacking form controls', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(value => localStorage.setItem('shift:setup:v1', JSON.stringify(value)), setup);
  await page.goto('/benchmark');
  await expect(page.locator('[data-scene="cinematic"] canvas')).toHaveAttribute('data-webgl', 'ready', { timeout: 30000 });
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/presets$/, { timeout: 20000 });
  const slider = page.locator('.config-sliders input').first(); await slider.focus();
  const before = await slider.inputValue(); await page.keyboard.press('ArrowRight');
  await expect(slider).not.toHaveValue(before);
  await expect(page).toHaveURL(/\/presets$/);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.mouse.move(10, 300); await page.mouse.wheel(0, 220);
  await expect(page).toHaveURL(/\/tweaker$/, { timeout: 20000 });
});


test('telemetry chapter can be reached from a direct route and WebGL has a fallback', async ({ page }) => {
  test.setTimeout(90000);
  await page.addInitScript(value => localStorage.setItem('shift:setup:v1', JSON.stringify(value)), setup);
  await page.goto('/drivers');
  const nav = page.getByRole('navigation', { name: 'Навигация по главам' });
  await nav.getByRole('link', { name: /Телеметрия/ }).click();
  await expect(page).toHaveURL(/\/#telemetry$/, { timeout: 20000 });
  await expect(page.locator('#telemetry')).toBeInViewport({ timeout: 20000 });
  await expect(page.getByRole('button', { name: /Вывести оверлей нагрузки в игру/ })).toBeVisible();
  const scene = page.locator('[data-scene="cinematic"]');
  const canvas = scene.locator('canvas');
  await expect(canvas).toHaveAttribute('data-webgl', 'ready', { timeout: 30000 });
  await canvas.evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(scene).toHaveAttribute('data-scene-state', 'fallback');
  await expect(nav.getByRole('link', { name: /Сборка/ })).toBeVisible();
});
