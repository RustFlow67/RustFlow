import { expect, test } from "@playwright/test";

test("compact chrome keeps appearance and assistant accessible inside profile", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-material", "liquid");
  await expect(page.locator(".wallpaper-scene")).toHaveAttribute("data-playback", "still");
  const header = page.locator('[data-hud="top"]');
  const profile = header.getByRole("button", { name: "Профиль и вид" });
  const island = header.getByRole("button", { name: /Статус:/ });
  await expect(header.getByRole("button", { name: "Меню RustFlow" })).toBeVisible();
  await expect(island).toBeVisible();
  await expect(profile).toBeVisible();
  const boxes = await Promise.all([header.getByRole("button", { name: "Меню RustFlow" }).boundingBox(), island.boundingBox(), profile.boundingBox()]);
  expect(boxes.every(Boolean)).toBe(true);
  expect(boxes[0]!.x + boxes[0]!.width).toBeLessThanOrEqual(boxes[1]!.x);
  expect(boxes[1]!.x + boxes[1]!.width).toBeLessThanOrEqual(boxes[2]!.x);
  await profile.click();
  const panel = page.getByRole("dialog", { name: "Профиль и вид" });
  await panel.getByRole("button", { name: "Внешний вид и Dock" }).click();
  const settings = page.getByRole("dialog", { name: "Настройки" });
  await expect(settings.getByRole("radio", { name: "Темы оформления" })).toBeVisible();
  await settings.getByRole("button", { name: /Арктический лед.*войти/ }).click();
  await expect(settings).toHaveCount(0);
  await expect(panel.getByLabel("Логин или email")).toBeVisible();
  await panel.getByRole("button", { name: "Внешний вид и Dock" }).click();
  await expect(settings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
  await expect(panel.getByRole("button", { name: "Внешний вид и Dock" })).toBeFocused();
  await panel.getByRole("button", { name: "ИИ-ассистент" }).click();
  await expect(page.getByRole("dialog", { name: "ИИ-ассистент RustFlow" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel.getByRole("button", { name: "ИИ-ассистент" })).toBeFocused();
});

test("status island updates from preset selection and respects reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/presets");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const picker = page.getByRole("radiogroup", { name: "Графика всех пресетов" });
  await picker.getByRole("radio", { name: /Баланс/ }).click();
  const island = page.getByRole("button", { name: /Статус: Графика:/ });
  await expect(island).toHaveAttribute("aria-expanded", "true");
  expect(parseFloat(await island.locator(".dynamic-island-text").evaluate(el => getComputedStyle(el).transitionDuration))).toBeLessThan(0.001);
  await island.click();
  await expect(island).toHaveAttribute("aria-expanded", "false");
});

test("existing public finish preference is preserved", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rustflow:theme", "pearl"));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-material", "pearl");
});
