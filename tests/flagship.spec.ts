import { openHeader } from "./header-anchor";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { presetBuildInput } from "@/lib/addons/build-tools";
import { isValidBuildInput, QUICK_SAMPLE_BUILDS, type BuildInput } from "@/lib/models/build";
import { readSavedBuild } from "@/lib/models/saved-build";
import { profileBuild } from "@/lib/profile-build";
import { TWEAKS_LITE } from "@/lib/tweaks";
import { systemPlan, systemPlanHref, readPlanSeed } from "@/lib/catalog/system-plan";
import { packEntries } from "@/lib/pack-entries";
import { DOCK_KEY } from "@/lib/dock-position";

const index = { presets: HARDWARE_PRESETS, steps: TWEAKS_LITE };
const sample = QUICK_SAMPLE_BUILDS[0].input;
const click = (node: Locator) => (test.info().project.use.hasTouch ? node.tap() : node.click());
async function pick(page: Page, name: string, choice: string) {
  await click(page.getByRole("combobox", { name, exact: true }));
  await click(page.getByRole("option", { name: choice, exact: true }));
}
async function model(page: Page, label: string, name: string) {
  await click(page.getByRole("button", { name: label, exact: true }));
  const q = page.getByRole("combobox", { name: `${label}: поиск` });
  await q.fill(name);
  await q.press("Enter");
}
const summary = "Автоподбор по конфигурации",
  insight = "ИИ-сводка вашей сборки",
  openMatched = "Открыть подобранный пресет ↗",
  apply = "Подготовить пакет в Твикере ↗";

// Check both public HTTP input and strict cloud-bind allowlisting, rather than
// trusting min/max attributes or relying on browser coercion.
test("all catalog rigs remain legal; old records migrate but new invalid hardware is rejected", async ({
  request,
}) => {
  for (const p of HARDWARE_PRESETS) expect(isValidBuildInput(presetBuildInput(p)), p.slug).toBe(true);
  for (const [cpuId, speeds, invalid, cl] of [
    [sample.cpuId, [2133, 5333], [2132, 5334], 16],
    ["ryzen-7-9800x3d", [4800, 9600], [4799, 9601], 30],
  ] as const) {
    for (const ramMhz of speeds)
      expect(isValidBuildInput({ ...sample, cpuId, ramMhz, ramCl: cl })).toBe(true);
    for (const ramMhz of invalid) {
      const body = { ...sample, cpuId, ramMhz, ramCl: cl };
      expect(profileBuild(body)).toBeNull();
      expect((await request.post("/api/benchmark", { data: { ...body, ram: body.ramGb } })).status()).toBe(
        400,
      );
    }
  }
  const low = { ...sample, ramMhz: 1866 };
  expect(isValidBuildInput(low)).toBe(false);
  expect(readSavedBuild(low)?.ramMhz).toBe(2133);
  for (const invalid of [
    { ramMhz: -1 },
    { ramMhz: 1e8 },
    { ramGb: 8.5 },
    { windowsVersion: "XP" },
    { resolution: "custom", customResolution: { width: 800, height: 4321 } },
  ])
    expect(profileBuild({ ...sample, ...invalid })).toBeNull();
  const input: BuildInput = {
    ...sample,
    name: "not for the URL",
    windowsVersion: "10",
    storage: "hdd",
    ramGb: 16,
    gpuId: "radeon-rx-6600",
    resolution: "custom",
    customResolution: { width: 800, height: 600 },
  };
  expect(profileBuild(input)?.windowsVersion).toBe("10");
  const link = systemPlanHref(input, "quality", false);
  expect(decodeURIComponent(link)).not.toContain(input.name);
  const params = Object.fromEntries(new URL(link, "http://test").searchParams);
  const seed = readPlanSeed(params)!;
  expect(seed).toMatchObject({ ...input, name: "Предпросмотр сборки", graphicsProfile: "quality" });
  expect(readPlanSeed({ ...params, ramGb: "2e1" })).toBeNull();
  expect(readPlanSeed({ ...params, h: "4321" })).toBeNull();
  const plan = systemPlan(seed, "quality", index)!;
  expect(plan.gc).toBe(2048);
  expect(plan.slugs).toEqual(
    expect.arrayContaining(["rust-library-ssd", "pagefile-auto", "amd-adrenalin", "windows-10-graphics"]),
  );
  expect(plan.slugs).not.toContain("nvidia-panel");
  expect(plan.slugs).not.toContain("gc-buffer");
  expect(
    packEntries({
      slugs: ["windows-11-graphics"],
      mode: "quality",
      ram: 16,
      gpu: "amd",
      tuning: { windowsVersion: "10" },
    }),
  ).toBeNull();
});

test("two persisted Dock positions keep native hits, safe content and correct lens geometry", async ({
  page,
}, info) => {
  await page.goto("/benchmark");
  const root = page.locator("html"),
    nav = page.locator(".tabbar-bottom"),
    gear = page.getByRole("button", { name: "Настройки", exact: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (["warning", "error"].includes(m.type()) && !/Failed to load resource/.test(m.text()))
      errors.push(m.text());
  });
  const settings = page.getByRole("dialog", { name: "Настройки", exact: true });
  for (const [position, label] of [
    ["left", "Сбоку слева (компактный)"],
    ["bottom", "Снизу (стандарт)"],
  ]) {
    await click(gear);
    const picker = settings.getByRole("radiogroup", { name: "Расположение Dock-бара" });
    await expect(picker.getByRole("radio")).toHaveCount(2);
    await click(picker.getByRole("radio", { name: label, exact: true }));
    await expect(root).toHaveAttribute("data-dock", position);
    await page.keyboard.press("Escape");
    await expect(settings).toHaveCount(0);
    await expect(gear).toBeFocused();
    await page.reload();
    await expect(root).toHaveAttribute("data-dock", position);
    await expect(nav).toHaveAttribute("data-hud", position);
    expect(await page.evaluate((key) => localStorage.getItem(key), DOCK_KEY)).toBe(position);
    await expect(nav.getByRole("link")).toHaveCount(6);
    const r = (await nav.boundingBox())!,
      vp = page.viewportSize()!;
    const card = (await page.locator(".section-title").first().boundingBox())!;
    if (position === "left") {
      expect(r.x).toBeLessThan(20);
      expect(Math.abs(r.y + r.height / 2 - vp.height / 2)).toBeLessThan(2);
      expect(r.height).toBeGreaterThan(r.width * 4);
      expect(card.x).toBeGreaterThan(r.x + r.width);
      await expect(nav.locator(".dock-label").first()).toBeHidden();
    }
    if (position === "bottom") {
      expect(vp.height - r.y - r.height).toBeGreaterThan(10);
      await expect(nav.locator(".dock-label").first()).toBeVisible();
    }
    const tab = nav.locator('[href="/drivers"]'),
      selected = nav.locator('[aria-current="page"]');
    const distance = (item: Locator) =>
      item.evaluate((el) => {
        const a = el.getBoundingClientRect(),
          b = el.parentElement!.querySelector(".dock-lens")!.getBoundingClientRect();
        return Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2);
      });
    if (!info.project.use.hasTouch) {
      await tab.hover();
      await expect.poll(() => distance(tab)).toBeLessThan(1.5);
      if (position === "left") {
        await expect.poll(() => tab.evaluate((el) => getComputedStyle(el, "::after").opacity)).toBe("1");
        await expect
          .poll(() =>
            tab.evaluate(
              (el) => new DOMMatrix(getComputedStyle(el.querySelector(".dock-glyph-wrap")!).transform).e,
            ),
          )
          .toBeGreaterThan(5);
      }
      await page.mouse.move(vp.width - 2, vp.height - 2);
    }
    await expect.poll(() => distance(selected)).toBeLessThan(1.5);
    const chat = page.locator('[data-hud="top"]').getByRole("button", { name: "ИИ-ассистент" });
    await expect(nav.getByRole("button", { name:"ИИ-ассистент" })).toHaveCount(0);
    const panel = page.getByRole("dialog", { name: "ИИ-ассистент RustFlow" });
    await openHeader(chat, panel, "left");
    await expect
      .poll(async () => {
        const v = (await nav.boundingBox())!;
        return v.x + v.width < 1 || v.y + v.height < 1 || v.y >= vp.height;
      })
      .toBe(true);
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
    await expect(chat).toBeFocused();
    await click(tab);
    await expect(page).toHaveURL(/\/drivers$/);
    await click(nav.locator('[href="/benchmark"]'));
    await expect(page).toHaveURL(/\/benchmark$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("numeric fields clamp/explain, switch generation and never publish an invalid prefix", async ({
  page,
}) => {
  await page.goto("/benchmark");
  const form = page.locator("#build-config");
  const value = async () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("rustflow:store:v1")!).builds[0].input);
  await pick(page, "Частота RAM", "Кастомное");
  const speed = form.getByRole("spinbutton", { name: "Частота RAM вручную, МТ/с" });
  await speed.fill("99999");
  await expect(speed).toHaveValue("5333");
  await expect(form.getByText("Максимум для DDR4 — 5333 МТ/с")).toBeVisible();
  expect((await value()).ramMhz).toBe(5333);
  await speed.fill("3");
  expect((await value()).ramMhz).toBe(5333);
  await speed.press("Tab");
  await expect(speed).toHaveValue("2133");
  await expect(form.getByText("Минимум для DDR4 — 2133 МТ/с")).toBeVisible();
  await speed.fill("-2");
  await expect(speed).toHaveValue("2133");
  await speed.fill("1e5");
  await expect(speed).toHaveValue("2133");
  await model(page, "Процессор (CPU)", "Ryzen 7 9800X3D");
  await click(form.locator(".advanced-fields > summary"));
  await expect(form.getByRole("combobox", { name: "Первый тайминг (CAS)" })).toHaveText(/CL30/);
  await pick(page, "Частота RAM", "Кастомное");
  await speed.fill("1100");
  await expect(speed).toHaveValue("4800");
  await speed.fill("10000");
  await expect(speed).toHaveValue("9600");
  await expect(form.getByText("Максимум для DDR5 — 9600 МТ/с")).toBeVisible();
  await pick(page, "Целевое разрешение", "Кастомное");
  const width = form.getByRole("spinbutton", { name: /Ширина/ }),
    height = form.getByRole("spinbutton", { name: /Высота/ });
  await width.fill("");
  await width.pressSequentially("1920");
  await expect(width).toHaveValue("1920");
  await height.fill("");
  await height.pressSequentially("1080");
  await expect(height).toHaveValue("1080");
  await width.fill("0");
  await expect(width).toHaveValue("800");
  await height.fill("12345");
  await expect(height).toHaveValue("4320");
  expect((await value()).customResolution).toEqual({ width: 800, height: 4320 });
  const radar = page.getByRole("group", { name: /Радар оценок/ });
  await expect(radar).toHaveCSS("backdrop-filter", "none");
  await expect(radar).toHaveCSS("background-image", "none");
  await expect(radar.locator("..")).toHaveCSS("margin-top", "16px");
  const trigger = page.getByRole("button", { name: "Предпросмотр client.cfg", exact: true });
  await click(trigger);
  const panel = page.getByRole("dialog", { name: "Предпросмотр client.cfg" });
  await expect(panel.locator("[data-build-cfg]")).toContainText("gc.buffer");
  await expect(page.locator("main [data-build-cfg]")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.goto("/journal");
  await click(page.getByRole("button", { name: "Добавить замер до/после", exact: true }));
  const fps = page.getByRole("spinbutton", { name: "Avg FPS до", exact: true });
  await fps.fill("9999");
  await expect(fps).toHaveValue("1500");
  await fps.fill("abc");
  await expect(fps).toHaveValue("1500");
  await fps.fill("0");
  await expect(fps).toHaveValue("1");
});

test("calculator, actual preset, live two-tab recommendations and downloaded ZIP agree", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  await page.goto("/benchmark");
  const here = page.getByRole("dialog", { name: insight, exact: true }),
    trigger = page.getByRole("button", { name: "Посмотреть сводку" }),
    footer = page.getByRole("region", { name: summary, exact: true });
  await expect(page.locator("#build-recommendations,.system-plan")).toHaveCount(0);
  await pick(page, "Версия Windows", "Windows 11");
  await click(trigger);
  await expect(here).toContainText("Windows 11");
  const oldName = await here.locator("[data-insight-preset]").innerText();
  await page.keyboard.press("Escape");
  await expect(here).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await model(page, "Процессор (CPU)", "Ryzen 7 7800X3D");
  await model(page, "Видеокарта (GPU)", "Radeon RX 7900 XTX");
  await pick(page, "Интерфейс и поколение", "HDD (7200 RPM)");
  await click(page.getByRole("radio", { name: "16 ГБ", exact: true }));
  await pick(page, "Версия Windows", "Windows 10");
  const input: BuildInput = await page.evaluate(
    () => JSON.parse(localStorage.getItem("rustflow:store:v1")!).builds[0].input,
  );
  const before = systemPlan(input, "competitive", index)!;
  expect(before.best.title).not.toBe(oldName);
  await click(trigger);
  await expect(here).toContainText(before.best.title);
  await expect(here).toContainText("gc.buffer 2048");
  await expect(here).toContainText("В Windows 10 откройте");
  await expect(here).toContainText("Rust на HDD");
  await expect(here.locator("[data-plan-count]")).toHaveText(String(before.slugs.length));
  await click(here.getByRole("link", { name: openMatched }));
  await expect(page).toHaveURL(new RegExp(`open=${before.best.slug}`));
  const preset = page.getByRole("dialog");
  await expect(preset.getByRole("heading").first()).toContainText(before.best.title);
  await page.keyboard.press("Escape");
  await expect(preset).toHaveCount(0);
  await click(page.locator(".plan-strip").getByRole("link", { name: openMatched }));
  await expect(preset).toContainText(before.best.title);
  await page.keyboard.press("Escape");
  await expect(preset).toHaveCount(0);
  await page.goto("/benchmark");
  await click(trigger);
  await click(here.getByRole("link", { name: apply }));
  await expect(page).toHaveURL(/\/tweaker\?auto=live/);
  await expect(page.getByText("Персональный конфиг").locator("..")).toContainText("Windows 10");
  await expect(page.getByText(`Выбрано: ${before.slugs.length} из`, { exact: false })).toBeVisible();
  const other = await context.newPage();
  await other.goto("/benchmark");
  await pick(other, "Версия Windows", "Windows 11");
  await click(other.getByRole("radio", { name: "32 ГБ", exact: true }));
  await model(other, "Видеокарта (GPU)", "GeForce RTX 5060");
  const changed: BuildInput = await other.evaluate(
    () => JSON.parse(localStorage.getItem("rustflow:store:v1")!).builds[0].input,
  );
  const after = systemPlan(changed, "competitive", index)!;
  await other.close();
  await expect(page.getByText("Персональный конфиг").locator("..")).toContainText("Windows 11");
  await expect(footer).toContainText("gc.buffer 4096");
  await expect(footer).toContainText(after.best.title);
  await expect(page.getByText(`Выбрано: ${after.slugs.length} из`)).toBeVisible();
  const win = TWEAKS_LITE.find((t) => t.slug === "windows-11-graphics")!;
  const search = page.getByRole("searchbox", { name: "Поиск: Твикер" });
  await search.fill(win.title);
  const hit = page.locator(".discovery-item");
  await expect(hit).toContainText("Рекомендовано для вашей системы");
  await click(hit);
  const item = page.getByRole("dialog").locator("article");
  await expect(item.getByRole("button", { name: /Убрать:/ })).toHaveAttribute("aria-pressed", "true");
  await click(item.getByRole("button", { name: /Убрать:/ }));
  await page.keyboard.press("Escape");
  await click(footer.getByRole("link", { name: apply }));
  await expect(page.getByText(`Выбрано: ${after.slugs.length} из`)).toBeVisible();
  const zip = page.getByRole("button", { name: /Скачать ZIP с твиками и откатом/ });
  await click(zip);
  const account = page.getByRole("dialog", { name: "Профиль игрока" });
  await click(account.getByRole("button", { name: /Продолжить через Google/ }));
  await expect(account.locator(".cabinet-widgets")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(account).toHaveCount(0);
  const dl = page.waitForEvent("download");
  await click(zip);
  const archive = unzipSync(await readFile((await (await dl).path())!));
  const readme = strFromU8(archive["SHIFT-Pack/README.txt"]);
  expect(readme).toContain("Windows 11");
  for (const s of after.slugs) expect(readme).toContain(`(${s})`);
  expect(readme).not.toMatch(/windows-10-graphics|amd-adrenalin|pagefile-auto/);
  expect(Object.keys(archive).some((n) => n.includes("/Otkat/"))).toBe(true);
  const cfg = strFromU8(archive["SHIFT-Pack/client.cfg"]);
  expect(cfg.match(/^gc\.buffer\s/gm)).toHaveLength(1);
  expect(cfg).toContain('gc.buffer "4096"');
});

test("unmodified preview prepares its own package without replacing the saved rig", async ({ page }) => {
  const mine = { ...sample, windowsVersion: "10" },
    preset = HARDWARE_PRESETS.find((p) => p.gpuId.startsWith("radeon-") && p.ramGb !== 0)!;
  await page.addInitScript((mine) => {
    if (!localStorage.getItem("rustflow:store:v1"))
      localStorage.setItem(
        "rustflow:store:v1",
        JSON.stringify({ builds: [{ id: "mine", input: mine }], activeBuildId: "mine" }),
      );
  }, mine);
  await page.goto(`/benchmark?preset=${preset.slug}&mode=quality`);
  await click(page.getByRole("button", { name: "Посмотреть сводку" }));
  const box = page.getByRole("dialog", { name: insight, exact: true });
  await expect(box.getByRole("link", { name: apply })).toHaveAttribute("href", /auto=preview/);
  await click(box.getByRole("link", { name: apply }));
  await expect(
    page.getByRole("radiogroup", { name: "Производитель GPU" }).getByRole("radio", { checked: true }),
  ).toHaveText("AMD");
  await expect(page.getByText("Персональный конфиг").locator("..")).toContainText(`${preset.ramGb} ГБ ОЗУ`);
  const footer = page.getByRole("region", { name: summary, exact: true });
  await expect(footer).toContainText("Версия Windows не указана");
  await expect(footer).toContainText("AMD");
  await page.goto("/");
  const home = page.getByRole("region", { name: "Автоподбор по конфигурации" });
  await expect(home).toContainText("Windows 10");
  await expect(home).toContainText("NVIDIA");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("rustflow:store:v1")!).builds)).toEqual([
    { id: "mine", input: mine },
  ]);
});
