import { expect, test, type Locator } from "@playwright/test";

const activate = (control: Locator) => test.info().project.use.hasTouch ? control.tap() : control.click();

test("fixed chrome, anchored dialogs and click-through after dismissal", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const dock = page.getByRole("navigation", { name: "Основная навигация" });
  await expect(dock.locator("[data-tab]")).toHaveCount(7);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  await expect(page.locator("main")).toHaveCSS("transform", "none");
  await expect(page.locator("main")).toHaveCSS("filter", "none");
  await expect(page.locator(".rf-page-enter")).toHaveCSS("animation-name", "pageEnter");
  const wallpaper = page.locator(".wallpaper-scene");
  await expect(wallpaper).toHaveCSS("pointer-events", "none");
  await expect(wallpaper).toHaveCSS("position", "fixed");
  await expect(wallpaper).toHaveCSS("z-index", "-1");
  expect(await wallpaper.boundingBox()).toEqual({ x: 0, y: 0, ...page.viewportSize() });

  const profile = page.getByRole("button", { name: "Профиль", exact: true });
  const chat = dock.getByRole("button", { name: "ИИ-ассистент" });
  const profilePanel = page.locator("#rustflow-player-profile");
  const chatPanel = page.locator("#rustflow-assistant-dialog");
  await activate(profile);
  await activate(profilePanel.getByRole("radio", { name: "Регистрация" }));
  await expect(profilePanel.getByLabel("Подтверждение пароля")).toBeVisible();
  await activate(profilePanel.getByRole("button", { name: "Закрыть окно" }));
  await expect(profilePanel).toHaveCount(0);
  await expect(profile).toBeFocused();
  await activate(profile);
  await page.locator(".profile-backdrop").click({ position: { x: 3, y: 3 } });
  // Do not wait for the closing spring: its scrim must already be inert.
  await activate(chat);
  await expect(chatPanel).toBeVisible();
  await activate(chatPanel.getByRole("button", { name: "Свернуть RustFlow Assistant" }));
  await expect(chatPanel).toHaveCount(0);
  await activate(chat);
  await activate(dock.getByRole("link", { name: "Сборка", exact: true }));
  await expect(page).toHaveURL(/\/benchmark$/);
  await expect(chatPanel).toHaveCount(0);
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Конфигурация ПК" })).toBeVisible();
  await expect(page.getByText("Определить GPU", { exact: true })).toHaveCount(0);
  await expect(page.locator("#share")).toHaveCount(0);
  await activate(page.getByRole("button", { name: "Видеокарта (GPU)", exact: true }));
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await activate(dock.getByRole("link", { name: "Твикер", exact: true }));
  await activate(page.locator(".category-card").first());
  await activate(page.getByRole("button", { name: "Закрыть окно" }));
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
});

test("legacy journal: choose in a portaled listbox, save and reload", async ({ page }) => {
  await page.goto("/journal");
  await activate(page.getByRole("button", { name: "Добавить замер до/после", exact: true }));
  const dialog = page.getByRole("dialog", { name: "Новый замер до / после" });
  await activate(dialog.getByRole("combobox", { name: "Тип сервера" }));
  await activate(page.getByRole("option", { name: "Тест / Staging" }));
  await expect(dialog.getByRole("combobox", { name: "Тип сервера" })).toHaveText("Тест / Staging");
  await dialog.getByLabel("Что изменили").fill("Контрольный замер");
  await dialog.getByLabel("Avg FPS до").fill("80");
  await dialog.getByLabel("Avg FPS после").fill("85");
  await activate(dialog.getByRole("button", { name: "Авто-расчёт мс и 1% low" }));
  await activate(dialog.getByRole("button", { name: "Добавить в журнал" }));
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Редактировать «Контрольный замер»" })).toBeVisible();
});

test("reduced motion closes without leaving a backdrop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await expect(page.locator(".rf-page-enter")).toHaveCSS("animation-name", "none");
  await activate(page.getByRole("button", { name: "Профиль", exact: true }));
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
});

test("both manifest URLs serve the actual 192px and 512px PNGs", async ({ request }) => {
  const manifest = await (await request.get("/manifest.json")).json();
  expect(await (await request.get("/manifest.webmanifest")).json()).toEqual(manifest);
  for (const size of [192, 512]) {
    const src = `/icons/rustflow-${size}.png`;
    expect(manifest.icons).toContainEqual(expect.objectContaining({ src, sizes: `${size}x${size}`, type: "image/png" }));
    const png = await request.get(src);
    expect(png.ok()).toBe(true);
    const data = await png.body();
    expect(data.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect([data.readUInt32BE(16), data.readUInt32BE(20)]).toEqual([size, size]);
  }
});
