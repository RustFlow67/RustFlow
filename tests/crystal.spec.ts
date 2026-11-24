import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { DRIVER_FAMILIES, DRIVER_SERIES, driverChoice } from "@/lib/drivers";
import { DOCK_KEY } from "@/lib/dock-position";
import { expectReceded } from "./hud";
import { openHeader } from "./header-anchor";
import { sourceOutline } from "./source-outline";

const press = (node: Locator) => (test.info().project.use.hasTouch ? node.tap() : node.click());
const error = (a: number[], b: number[]) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const rect = (n: Locator) =>
  n.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  });
const calm = (n: Locator) => n.evaluate((e) => Promise.allSettled(e.getAnimations().map((a) => a.finished)));
// Capture at dispatch, after native scrolling/tap positioning, not when the
// test runner first asks to click. Then move the still-live source on purpose.
async function checkFlight(page: Page, from: Locator, action?: (dialog: Locator) => Promise<void>, header?: "left" | "right") {
  const dialog = page.getByRole("dialog");
  const content = await from.textContent();
  if (header) await openHeader(from, dialog, header);
  else {
    await from.evaluate(el => el.addEventListener("click", () => {
      const r = el.getBoundingClientRect();
      el.setAttribute("data-test-tap", JSON.stringify([r.x, r.y, r.width, r.height]));
    }, { once: true }));
    await press(from);
    await expect(dialog).toHaveCount(1);
    await calm(dialog);
    expect(error(await sourceOutline(dialog), JSON.parse((await from.getAttribute("data-test-tap"))!))).toBeLessThan(2);
    await expect(dialog).toHaveCSS("transition-timing-function", /cubic-bezier\(0\.32, 0\.72, 0, 1\)/);
  }
  expect(await from.textContent()).toBe(content);
  if (action) await action(dialog);
  await from.evaluate((el) => ((el as HTMLElement).style.translate = "0 15px"));
  const pose = await dialog.evaluateHandle((el) => ({
    p: new Promise<number[]>((resolve) =>
      new MutationObserver((_, o) => {
        if (el.hasAttribute("data-open")) return;
        o.disconnect();
        const pane = el as HTMLElement,
          s = getComputedStyle(el),
          shell = el.parentElement!.getBoundingClientRect();
        const matrix = new DOMMatrixReadOnly(s.getPropertyValue("--from-transform"));
        const raw = s
          .getPropertyValue("--from-clip")
          .match(/inset\((.*?) round/)![1]
          .trim()
          .split(/\s+/)
          .map(parseFloat);
        const [t, r, b, l] = raw;
        const right = el.classList.contains("profile-panel"),
          k = matrix.a;
        resolve([
          shell.x + matrix.e + (right ? pane.offsetWidth * (1 - k) : 0) + l * k,
          shell.y + matrix.f + t * k,
          (pane.offsetWidth - r - l) * k,
          (pane.offsetHeight - t - b) * k,
        ]);
      }).observe(el, { attributes: true, attributeFilter: ["data-open"] }),
    ),
  }));
  await page.keyboard.press("Escape");
  const landing = await pose.evaluate((x) => x.p);
  await pose.dispose();
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  await expect(from).toBeFocused();
  await calm(from);
  // The depth plane restores on the compositor timeline, which headless
  // frame bursts can hold past the 360ms unmount; only measure a settled page.
  await page.waitForFunction(
    () => {
      const plane = document.querySelector(".rf-depth-plane");
      // No plane, or a nested modal still owns the depth: nothing to settle.
      if (!plane || document.querySelector("[data-rf-modal]")) return true;
      return getComputedStyle(plane).transform === "none";
    },
    null,
    { timeout: 8000 },
  );
  expect(error(landing, await rect(from))).toBeLessThan(2.5);
  await from.evaluate((el) => (el as HTMLElement).style.removeProperty("translate"));
}

test("every model has exactly one compatible branch, including legacy devices", () => {
  for (const { id } of DRIVER_FAMILIES) {
    const names = DRIVER_SERIES[id].flatMap((s) => s.models);
    expect(new Set(names).size).toBe(names.length);
    for (const s of DRIVER_SERIES[id]) {
      expect(s.models.length).toBeGreaterThan(0);
      for (const name of s.models) expect(driverChoice(id, name)?.series).toBe(s.title);
    }
  }
  for (const [id, m] of [
    ["nvidia", "GeForce RTX 5060"],
    ["nvidia", "GeForce RTX 3090 Ti"],
    ["nvidia", "GeForce GTX 1650"],
    ["radeon", "Radeon RX 5500 XT"],
    ["arc", "Arc A580"],
  ] as const)
    expect(driverChoice(id, m)?.notes).toMatch(/^https:/);
  expect(driverChoice("nvidia", "GeForce GTX 1080 Ti")?.name).toContain("Security");
  expect(driverChoice("radeon", "Radeon RX 580")?.name).toContain("Polaris");
  expect(driverChoice("arc", "GeForce RTX 5090")).toBeNull();
});

test("five family buttons open real model selectors; utility and vendor links follow the device", async ({
  page,
}) => {
  await page.goto("/drivers");
  await expect(page.locator(".family-choice")).toHaveCount(5);
  for (const [id, series, model, url] of [
    ["nvidia", "GTX 10", "GeForce GTX 1080 Ti", "nvidia.com"],
    ["radeon", "RX 6000", "Radeon RX 6600", "amd.com"],
    ["arc", "Arc A", "Arc A580", "intel.com"],
    ["network-drivers", "Intel Ethernet", "Intel I226", "intel.com"],
    ["chipset", "Intel · LGA1700", "B760", "intel.com"],
  ] as const) {
    const from = page.locator(`.family-choice#${id}`);
    await checkFlight(page, from, async (dialog) => {
      if (id === "nvidia" || id === "radeon") {
        await expect(dialog.locator('.series-toggle[aria-expanded="true"]')).toHaveCount(0);
        const first = dialog.locator(".series-toggle").first();
        await press(first);
        await expect(first).toHaveAttribute("aria-expanded","true");
        await expect(dialog.locator(".accordion-body[data-expanded] .model-choice").first()).toBeVisible();
      }
      await press(dialog.getByRole("button", { name: series, exact: true }));
      await press(dialog.getByRole("button", { name: model, exact: true }));
      await expect(dialog.locator(".driver-result")).toHaveAttribute("data-driver-model", model);
      if (id === "nvidia" && !test.info().project.use.hasTouch) {
        const selected = dialog.getByRole("button", { name: model, exact: true });
        const other = dialog.locator('.accordion-body[data-expanded] .model-choice[aria-pressed="false"]').last();
        await other.hover();
        await expect(other).toHaveAttribute("data-lens-target", "");
        await expect(selected).toHaveAttribute("aria-pressed", "true");
        await page.mouse.move(1, 1);
        await expect(selected).toHaveAttribute("data-lens-target", "");
      }
      await expect(
        dialog.getByRole("link", { name: "Открыть официальный подбор для " + model + " ↗" }),
      ).toHaveAttribute("href", new RegExp(url.replaceAll(".", "\\.")));
      expect(await dialog.getByRole("link", { name: /NVCleanstall/ }).count()).toBe(id === "nvidia" ? 1 : 0);
      if (id === "nvidia") await expect(dialog.getByRole("link", {name:"Скачать чистый драйвер + NVCleanstall без телеметрии ↗",exact:true})).toHaveAttribute("href", /techpowerup\.com\/download\/techpowerup-nvcleanstall\//);
      expect(await dialog.getByRole("link", { name: /Скачать DDU/ }).count()).toBe(
        ["nvidia", "radeon", "arc"].includes(id) ? 1 : 0,
      );
      await dialog.locator(".dialog-scroll").evaluate((n) => (n.scrollTop = n.scrollHeight));
      expect(
        await dialog.evaluate((n) => ({
          top: n.scrollTop,
          border: getComputedStyle(n).borderTopWidth,
          rim: getComputedStyle(n, "::after").top,
        })),
      ).toEqual({ top: 0, border: "0px", rim: "0px" });
    });
  }
});

test("compact hardware sheet drives actual FPS, config download and one upgrade", async ({ page }) => {
  await page.goto("/benchmark");
  const columns = page.locator(".build-workspace");
  await expect(columns.getByRole("heading", { name: "Ваш компьютер" })).toBeVisible();
  await expect(columns.getByRole("heading", { name: "Результат и рекомендации" })).toBeVisible();
  await expect(columns.locator(".advanced-fields")).not.toHaveAttribute("open", "");
  await expect(columns.locator(".upgrade-verdict")).not.toBeVisible();
  const ram = columns.getByRole("radiogroup", { name: "Объём оперативной памяти" });
  await expect(ram.getByRole("radio")).toHaveText(["8 ГБ", "16 ГБ", "32 ГБ", "64 ГБ"]);
  const modes = columns.getByRole("radiogroup", { name: "Режим графики сборки" });
  await expect(modes.getByRole("radio")).toHaveText(["Комбат / PvP", "Баланс", "Качество"]);
  const fps = columns.locator('[data-server="MODDED 2X"] td').first(),
    initial = await fps.innerText();
  await press(modes.getByRole("radio", { name: "Качество" }));
  await expect(fps).not.toHaveText(initial);
  await press(ram.getByRole("radio", { name: "16 ГБ" }));
  await expect(columns.locator(".first-upgrade")).toHaveCount(1);
  await checkFlight(page, page.getByRole("button", { name: "Предпросмотр client.cfg" }), async (dialog) => {
    const cfg = await dialog.locator("[data-build-cfg]").innerText();
    expect(cfg).toContain('gc.buffer "2048"');
    expect(cfg).toContain('water.quality "2"');
    const request = page.waitForEvent("download");
    await press(dialog.getByRole("link", { name: "Скачать client.cfg" }));
    const download = await request;
    expect(download.suggestedFilename()).toBe("client.cfg");
    expect((await readFile((await download.path())!, "utf8")).trim()).toBe(cfg.trim());
  });
});

test("both report controls share the same material and source motion", async ({
  page,
}) => {
  await page.goto("/benchmark");
  const skin = async (n: Locator) => {
    // Both pages must have installed their Chromium displacement maps. A
    // navigation's load event alone can precede the client effect.
    await expect(page.locator("html")).toHaveAttribute("data-refraction", "");
    return n.evaluate((e) => {
      const s = getComputedStyle(e);
      return [s.color, s.boxShadow, s.borderColor, s.background, s.backdropFilter, s.padding, s.borderRadius];
    });
  };
  const summary = page.getByRole("button", { name: "Посмотреть сводку" });
  const buildSkin = await skin(summary);
  await checkFlight(page, summary);
  await page.goto("/tweaker");
  expect(await skin(summary)).toEqual(buildSkin);
  await checkFlight(page, summary);
});

for (const dock of ["bottom", "left"]) test(`brand opens below its scrolled capsule and lands on the live logo: ${dock}`, async ({ page }) => {
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [DOCK_KEY, dock]);
  await page.goto("/benchmark");
  await expect(page.locator("html")).toHaveAttribute("data-dock",dock);
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  await page.evaluate(() => scrollTo({top:180, behavior:"instant"}));
  await expect(page.locator("html")).toHaveAttribute("data-scroll-down", "");
  const brand = page.locator(".nav-brand");
  await checkFlight(page, brand, async dialog => {
    await expect(dialog).toHaveAccessibleName("Меню RustFlow");
    await expectReceded(page);
    await expect(page.locator(".rf-depth-plane")).toHaveCSS("transform", "matrix(0.93, 0, 0, 0.93, 0, 0)");
    expect(await dialog.evaluate(el => getComputedStyle(el.closest(".modal-backdrop")!, "::before").backdropFilter)).toBe("blur(12px)");
    const rows = dialog.locator(".brand-row"), lens = dialog.locator(".liquid-lens");
    await expect(rows).toHaveCount(5);
    if (test.info().project.use.hasTouch) await page.keyboard.press("End");
    for (const row of await rows.all()) {
      if (test.info().project.use.hasTouch) { await page.keyboard.press("ArrowDown"); await expect(row).toBeFocused(); }
      else await row.hover();
      await expect(row).toHaveAttribute("data-lens-target", "");
    }
    if (!test.info().project.use.hasTouch) {
      await page.mouse.move(1, 1);
      await expect(rows.first()).toHaveAttribute("data-lens-target", "");
    }
    await expect(lens).toHaveAttribute("data-positioned", "");
  }, "left");
  expect(await page.evaluate(() => scrollY)).toBe(180);
});

test("journal uses the pressed button, while the palette shortcut invents no source", async ({ page }) => {
  await page.goto("/journal");
  const add = page.getByRole("button", { name: "Добавить замер до/после", exact: true });
  await checkFlight(page, add);
  await add.focus();
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("dialog", { name: "Палитра команд" });
  await expect(palette).toBeVisible();
  expect(
    await palette.evaluate((el) => getComputedStyle(el).getPropertyValue("--from-transform").trim()),
  ).toBe("");
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(add).toBeFocused();
});
