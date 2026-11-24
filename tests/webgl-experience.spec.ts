import { expect, test } from '@playwright/test';

test('onboarding has a changing WebGL core and preserves the safety gate', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 20000 });
  await expect(page.locator('[data-scene="core"] canvas')).toHaveAttribute('data-webgl', 'ready', { timeout: 20000 });
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.locator('[data-scene=core] canvas')).toHaveAttribute('data-step', '1');
  await dialog.getByRole('button', { name: 'English' }).click();
  await expect(dialog.getByRole('heading', { name: 'Choose a language' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await expect(page.locator('[data-scene=core] canvas')).toHaveAttribute('data-step', '2');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await dialog.getByRole('button', { name: /Maximum FPS/ }).click();
  await expect(page.locator('[data-scene=core] canvas')).toHaveAttribute('data-goal', 'fps');
  await dialog.getByRole('button', { name: 'Enter SHIFT' }).click();
  await expect(dialog).toBeHidden({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: 'SHIFT.' })).toBeVisible();
});

test('hero and balance are real interactive WebGL and controls stay clickable', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  const hero = page.locator('[data-scene="cinematic"] canvas');
  const grab = page.locator('.cinema-grab');
  await expect(hero).toHaveAttribute('data-webgl', 'ready', { timeout: 20000 });
  await expect(hero).toHaveAttribute('data-chapter', '0');
  if (info.project.name === 'desktop') {
    const box = (await grab.boundingBox())!;
    await page.mouse.move(box.x + box.width * .45, box.y + box.height * .45);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .62, box.y + box.height * .51, { steps: 5 }); await page.mouse.up();
    await expect(hero).toHaveAttribute('data-rotation', /,/);
  } else {
    const box = (await grab.boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const x = box.x + box.width * .45, y = box.y + box.height * .45;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 70, y: y + 25 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(hero).toHaveAttribute('data-rotation', /,/);
  }
  await page.getByRole('navigation', { name: 'Навигация по главам' }).getByRole('link', { name: /Сборка/ }).click();
  const chart = page.locator('[data-scene="balance"] canvas');
  await expect(chart).toHaveAttribute('data-webgl', 'ready');
  await expect(page.locator('.balance-score')).toContainText('Вероятное узкое место');
  const initialValues = await chart.getAttribute('data-values');
  await page.getByRole('radiogroup', { name: 'Объём оперативной памяти' }).getByRole('radio', { name: '8 ГБ' }).click();
  await expect.poll(() => chart.getAttribute('data-values'), { timeout: 15000 }).not.toBe(initialValues);
  if (info.project.name === 'desktop') {
    await chart.scrollIntoViewIfNeeded();
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width * .45, box.y + box.height * .5); await page.mouse.down();
    await page.mouse.move(box.x + box.width * .7, box.y + box.height * .55, { steps: 4 }); await page.mouse.up();
    await expect(chart).toHaveAttribute('data-rotation', /,/);
  }
  await page.getByRole('button', { name: 'Процессор (CPU)' }).click();
  await expect(page.getByRole('button', { name: 'Процессор (CPU)' })).toHaveAttribute('aria-expanded', 'true');
  expect(errors).toEqual([]);
});


test('WebGL context loss keeps the balance readable as a static fallback', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
  await page.goto('/benchmark');
  const scene = page.locator('[data-scene="balance"]');
  const canvas = scene.locator('canvas');
  await expect(canvas).toHaveAttribute('data-webgl', 'ready', { timeout: 20000 });
  await canvas.evaluate(el => el.dispatchEvent(new Event('webglcontextlost', { cancelable: true })));
  await expect(scene).toHaveAttribute('data-scene-state', 'fallback');
  await expect(scene.locator('svg')).toBeVisible();
  await expect(page.locator('.balance-score dl dd')).toHaveCount(5);
});
