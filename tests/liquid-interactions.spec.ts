import { expect, test } from "@playwright/test";

test("a selected tweak announces the new pack count", async ({ page }) => {
  await page.goto("/tweaker");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  await page.locator(".category-card").first().click();
  const dialog = page.getByRole("dialog").last();
  const toggle = dialog.getByRole("button", { name: /^(Добавить|Убрать):/ }).first();
  await expect(toggle).toBeVisible();
  await toggle.click();
  // The HUD is intentionally inert while the sheet is open; the live text is
  // still updated and becomes visible again when the sheet is dismissed.
  await expect(page.locator(".dynamic-island")).toHaveAttribute("aria-label", /Статус: Выбрано твиков: \d+/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Статус: Выбрано твиков:/ })).toBeVisible();
});

test("reopening a closing profile cancels its exit", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const trigger = page.getByRole("button", { name: "Профиль и вид" });
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Профиль и вид" });
  await expect(panel).toHaveCSS("opacity", "1");
  await panel.evaluate(el => {
    (el.querySelector('[aria-label="Закрыть окно"]') as HTMLButtonElement).click();
    window.dispatchEvent(new CustomEvent("rustflow:open-profile", { detail: document.querySelector(".profile-trigger") }));
  });
  await expect(panel).toBeVisible();
  await expect(panel).toHaveAttribute("aria-modal", "true");
  await expect(panel.getByLabel("Логин или email")).toBeVisible();
});

test("pointer highlights update a single card without moving it", async ({ page }, info) => {
  test.skip(Boolean(info.project.use.hasTouch), "The highlight is for fine pointers only");
  await page.goto("/presets");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const card = page.locator(".preset-card:not([aria-busy])").first();
  await card.scrollIntoViewIfNeeded();
  await card.hover({ position: { x: 20, y: 20 } });
  await expect.poll(() => card.evaluate(el => el.style.getPropertyValue("--spec-x"))).not.toBe("");
  const first = await card.evaluate(el => el.style.getPropertyValue("--spec-x"));
  const width = (await card.boundingBox())!.width;
  await card.hover({ position: { x: width - 20, y: 20 } });
  await expect.poll(() => card.evaluate(el => el.style.getPropertyValue("--spec-x"))).not.toBe(first);
  await expect(card).toHaveCSS("translate", "none");
  await page.mouse.move(1, 1);
  await expect.poll(() => card.evaluate(el => el.style.getPropertyValue("--spec-x"))).toBe("");
});
