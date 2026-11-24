import { test, expect } from '@playwright/test';

test('setup consent, language, goal, persistence and restart', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const setup = page.getByRole('dialog', { name: 'Добро пожаловать в SHIFT' });
  await expect(setup).toBeVisible();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Choose a language' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /Maximum FPS/ }).click();
  await page.getByRole('button', { name: 'Enter SHIFT' }).click();
  await expect(page.getByRole('heading', { name: 'SHIFT.' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('shift:setup:v1')!))).toMatchObject({ language: 'en', goal: 'fps', accepted: true });
  await page.reload();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Повторить первоначальную настройку' }).click();
  await expect(page.getByRole('dialog', { name: 'Welcome to SHIFT' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('storage unavailable still permits using the application', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await page.getByRole('button', { name: 'Войти в SHIFT' }).click();
  await expect(page.getByRole('heading', { name: 'SHIFT.' })).toBeVisible();
});

test('backup interface and main sections are accessible offline', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Экспорт и импорт данных' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('JSON');
});

test('generates tweak download and ZIP without a server API', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'fps', accepted: true })));
  await page.route('**/api/**', route => route.abort());
  await page.goto('/files/restore-point');
  const filePromise = page.waitForEvent('download');
  await page.getByRole('link', { name: /Скачать BAT/ }).first().click();
  expect((await filePromise).suggestedFilename()).toMatch(/\.bat$/i);
  await page.goto('/tweaker');
  const zipPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать ZIP с твиками и откатом' }).click();
  expect((await zipPromise).suggestedFilename()).toMatch(/^SHIFT-Pack-.*\.zip$/);
});

test('chapter navigation, driver model and preset controls remain usable', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && /hydrat/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
  await page.goto('/drivers');
  await page.getByRole('button', { name: 'NVIDIA RTX/GTX' }).click();
  const modal = page.getByRole('dialog', { name: 'NVIDIA RTX/GTX' });
  await expect(modal).toBeVisible();
  const series = modal.getByRole('button', { name: /RTX 50/ });
  await series.click();
  await modal.getByRole('button', { name: 'GeForce RTX 5090', exact: true }).click();
  await expect(modal.locator('[data-driver-model]')).toHaveAttribute('data-driver-model', 'GeForce RTX 5090');
  await modal.getByRole('button', { name: /Чистая установка через DDU/ }).click();
  await expect(modal.getByRole('button', { name: /Чистая установка через DDU/ })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(modal).toBeHidden();
  await page.locator('.chapter-nav').getByRole('link', { name: /Пресеты/ }).click();
  await expect(page).toHaveURL(/presets/);
  const picker = page.getByRole('radiogroup', { name: 'Графика всех пресетов' });
  for (const name of ['Potato', 'Баланс', 'Качество', 'Комбат']) {
    const option = picker.getByRole('radio', { name: new RegExp(name) });
    await option.click(); await expect(option).toHaveAttribute('aria-checked', 'true');
  }
  const resolutions = page.getByRole('radiogroup', { name: 'Фильтр по разрешению' });
  await resolutions.getByRole('radio', { name: 'Своё' }).click();
  await page.getByLabel('Ширина, px').fill('1920');
  await page.getByLabel('Высота, px').fill('1080');
  await page.getByRole('button', { name: /Сравнение ·/ }).click();
  await expect(page.getByRole('dialog', { name: 'Сравнение конфигураций' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Сравнение конфигураций' })).toBeHidden();
  expect(errors).toEqual([]);
});

test('telemetry is explicitly demo and unsupported overlay is not enabled', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
  await page.goto('/');
  await expect(page.getByText(/DEMO \/ НЕ ДАННЫЕ ПК/)).toBeVisible();
  await page.getByRole('button', { name: /Вывести оверлей нагрузки в игру/ }).click();
  await expect(page.getByText(/Нативный модуль оверлея не подключён/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Вывести оверлей нагрузки в игру/ })).toHaveAttribute('aria-pressed', 'false');
  const download = page.waitForEvent('download');
  await page.locator('.shift-header').getByRole('button', { name: /Скачать/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^SHIFT-Pack-/);
});



test('config editor downloads protected lines and chosen graphics', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
  await page.goto('/presets');
  const workbench = page.locator('.config-workbench');
  await workbench.getByText('Добавить существующий client.cfg', { exact: false }).click();
  await workbench.getByLabel('Содержимое исходного client.cfg').fill('bind q forward;sprint\ngraphics.fov "90"\ninput.sensitivity "0.5"\ngraphics.drawdistance "2500"\n');
  await workbench.getByText('Предпросмотр client.cfg').click();
  await expect(workbench.locator('pre')).toContainText('graphics.fov "90"');
  await expect(workbench.locator('pre')).toContainText('input.sensitivity "0.5"');
  await expect(workbench.locator('pre')).toContainText('graphics.drawdistance "1200"');
  const download = page.waitForEvent('download');
  await workbench.getByRole('button', { name: /Скачать client.cfg/ }).click();
  expect((await download).suggestedFilename()).toBe('client.cfg');
});

test('chapter navigation fits a 320px viewport without horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  const box = await page.locator('.chapter-nav').boundingBox();
  expect(box && box.x >= 0 && box.x + box.width <= 320).toBeTruthy();
});
