import { optics as materialOptics } from "./material-optics";
import { test, expect, type Locator } from "@playwright/test";
const activate = (el: Locator) => (test.info().project.use.hasTouch ? el.tap() : el.click());

import { openHeader } from "./header-anchor";
import {sourceOutline} from "./source-outline";

test("glass gear opens a working anchored studio, sign-in flows from the clicked lock", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("rustflow:theme", "liquid"));
  await page.goto("/tweaker");
  const gear = page.locator(".studio-trigger"),
    brand = page.locator(".nav-brand"),
    pill = page.locator(".profile-trigger");
  const a = (await brand.boundingBox())!,
    b = (await gear.boundingBox())!;
  expect(b.x - a.x - a.width).toBeGreaterThan(0);
  expect(b.x - a.x - a.width).toBeLessThan(14);
  const studio = page.getByRole("dialog", { name: "Настройки" });
  await openHeader(gear, studio, "left");
  await activate(studio.getByRole("radio",{name:"Стекло и обои"}));
  const range = studio.getByRole("slider", { name: /Сила размытия/ });
  await range.focus();
  await range.press("End");
  for (const selector of [
    ".rf-dialog-surface",
    ".studio-slide",
    ".catalog-bar",
    ".field",
    ".category-card .island-skin",
    ".nav-brand .island-skin",
  ])
    await expect(page.locator(selector).first()).toHaveCSS("backdrop-filter", materialOptics(40, selector === ".field" || selector.startsWith(".nav-brand") ? "pill" : "pane"));
  await studio.getByRole("slider", { name: /Яркость/ }).focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".category-card .island-skin").first()).toHaveCSS(
    "box-shadow",
    /rgba\(255, 255, 255, 0\.0(?:6|59)\) 0px 1px 1px/,
  );
  await page.keyboard.press("Escape");
  await expect(studio).toHaveCount(0);
  await expect(gear).toBeFocused();
  const lock = page.getByRole("button", { name: /Скачать ZIP.*Доступно/ });
  await lock.scrollIntoViewIfNeeded();
  await pill.evaluate((el) =>
    Promise.allSettled(
      el
        .closest("[data-hud]")!
        .getAnimations()
        .map((x) => x.finished),
    ),
  );
  // Capture the pill at the invocation, not before mobile/browser scrolling.
  await page.evaluate(() =>
    document.addEventListener(
      "click",
      (e) => {
        const r = (e.target as Element).closest("button")!.getBoundingClientRect();
        sessionStorage.setItem("test-pill", JSON.stringify([r.x, r.y, r.width, r.height]));
      },
      { capture: true, once: true },
    ),
  );
  await activate(lock);
  const profile = page.getByRole("dialog", { name: "Профиль игрока" });
  await expect(profile).toBeVisible();
  const actual = await sourceOutline(profile),
    captured = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test-pill")!) as number[]);
  expect(Math.max(...captured.map((v, i) => Math.abs(v - actual[i])))).toBeLessThan(3);
  await page.keyboard.press("Escape");
  await expect(profile).toHaveCount(0);
  await expect(lock).toBeFocused();
  await page.reload();
  await expect(page.locator("html")).toHaveCSS("--rf-blur", "28px");
});

test("fine pointer magnet is bounded with a spring release; lite/touch keep native interaction", async ({
  page,
}, info) => {
  await page.goto("/tweaker");
  const tile = page.locator(".discovery-item").first();
  await tile.scrollIntoViewIfNeeded();
  if (!info.project.use.hasTouch) {
    const r = (await tile.boundingBox())!;
    await page.mouse.move(r.x + r.width * 0.94, r.y + r.height * 0.5);
    await expect(tile).toHaveAttribute("data-magnet", "");
    await expect.poll(()=>tile.evaluate(el=>parseFloat(getComputedStyle(el).translate))).toBeGreaterThan(3.5);
    expect(await tile.evaluate(el=>parseFloat(getComputedStyle(el).translate))).toBeLessThanOrEqual(5);
    expect(await tile.evaluate(el=>getComputedStyle(el).rotate)).not.toBe("none");
    await page.mouse.move(1, 1);
    await expect(tile).not.toHaveAttribute("data-magnet", "");
    await expect(tile).toHaveCSS("translate", "none");
  } else {
    await activate(tile);
    await expect(page.locator("[data-magnet]")).toHaveCount(0);
    await page.keyboard.press("Escape");
  }
  await page.addInitScript(() => localStorage.setItem("rustflow:lite", "1"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-lite", "");
  for (const sel of [".catalog-bar", ".field", ".discovery-item", ".tabbar-bottom"])
    await expect(page.locator(sel).first()).toHaveCSS("backdrop-filter", "none");
  await activate(tile);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((el) => el.getAnimations().filter((a) => a instanceof CSSTransition).length)).toBe(
    0,
  );
  await expect(page.locator("[data-velocity],[data-magnet]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("repeat active Dock click smoothly returns to top without a new history entry", async ({ page }) => {
  await page.goto("/drivers");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const before = await page.evaluate(() => {
    scrollTo({ top: 920, behavior: "instant" });
    const original = window.scrollTo.bind(window);
    window.scrollTo = ((options: ScrollToOptions) => {
      sessionStorage.setItem("test-scroll", String(options.behavior));
      original(options);
    }) as typeof window.scrollTo;
    return history.length;
  });
  await activate(page.locator('.tabbar-bottom [aria-current="page"]'));
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  expect(await page.evaluate(() => [sessionStorage.getItem("test-scroll"), history.length])).toEqual([
    "smooth",
    before,
  ]);
});
