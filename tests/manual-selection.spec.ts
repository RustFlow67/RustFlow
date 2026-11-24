import { test, expect } from '@playwright/test';
import { unzipSync, strFromU8 } from 'fflate';
import { readFile } from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
});

test('manual selection persists and ZIP contains only the selected steps and optional config', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/tweaker');
  const cards = page.locator('[data-manual-tweak]');
  await expect(cards.first()).toBeVisible();
  const first = cards.first(), second = cards.nth(1);
  const slug = await first.getAttribute('data-manual-tweak');
  const other = await second.getAttribute('data-manual-tweak');
  const toggle = first.getByRole('switch');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await second.getByRole('switch').click();
  await expect(second.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await second.getByRole('switch').click();
  await expect(second.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.reload();
  await expect(first.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await expect(second.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  async function zip() {
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Скачать ZIP с твиками и откатом' }).click();
    return unzipSync(await readFile(await (await download).path()));
  }
  const files = await zip();
  expect(Object.keys(files)).not.toContain('SHIFT-Pack/client.cfg');
  const readme = strFromU8(files['SHIFT-Pack/README.txt']);
  expect(readme).toContain(`(${slug})`);
  expect(readme).not.toContain(`(${other})`);
  await page.getByRole('switch', { name: 'Добавить графический client.cfg в пакет' }).click();
  expect(Object.keys(await zip())).toContain('SHIFT-Pack/client.cfg');
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Добавить графический client.cfg в пакет' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: 'Снять выбор' }).click();
  await expect(first.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Выбрать рекомендуемые' }).click();
  expect(await cards.getByRole('switch', { checked: true }).count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('balance model exposes scores and the likely bottleneck without a bar chart', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/benchmark');
  const model = page.locator('.balance-model');
  await expect(model).toBeVisible();
  await expect(model).toHaveAttribute('aria-label', /Модель баланса/);
  await expect(page.locator('.balance-score dl dd')).toHaveCount(5);
  await expect(page.locator('.balance-bottleneck')).toContainText('Вероятное узкое место');
  await expect(page.locator('.balance-score')).toContainText('Общая оценка');
  await expect(page.locator('.balance-3d')).toHaveCount(0);
});
