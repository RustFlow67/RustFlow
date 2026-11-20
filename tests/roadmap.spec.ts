import { test, expect, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { unzipSync, strFromU8 } from "fflate";
import { CPUS, getCpu } from "@/lib/hardware";
import { QUICK_SAMPLE_BUILDS } from "@/lib/models/build";
import { TWEAKS, isAscii } from "@/lib/tweaks";
import { packEntries } from "@/lib/pack-entries";
import { packHref, readTweakerPreferences, fitsVendor, fitsWindows, packEligible } from "@/lib/tweaker";
import { registryBackup } from "@/lib/tweaks/registry-backup";
import {
  driverGroups,
  fileGroups,
  faqGroups,
  presetGroups,
  windowsGroups,
  movedAnchors,
} from "@/lib/catalog/reading";
import { KNOWLEDGE_BASE, knowledgeHref } from "@/lib/knowledge-base";
const click = (el: Locator) => (test.info().project.use.hasTouch ? el.tap() : el.click());
const labels = [
  "Главная",
  "Сборка",
  "Пресеты",
  "Твикер",
  "Драйверы",
];

test("curated CPU list, canonical old articles and 55+ reversible pack choices are actual data", async ({
  request,
}) => {
  const models = [
    "Ryzen 5 5600",
    "Ryzen 5 5600X",
    "Ryzen 7 5700X3D",
    "Ryzen 7 5800X3D",
    "Ryzen 5 7500F",
    "Ryzen 5 7600",
    "Ryzen 5 7600X",
    "Ryzen 7 7700",
    "Ryzen 7 7800X3D",
    "Ryzen 7 9800X3D",
    "Core i5-12400F",
    "Core i5-13400F",
    "Core i5-13600KF",
    "Core i5-14600KF",
    "Core i7-14700KF",
  ];
  expect(CPUS.map((c) => c.name).sort()).toEqual(models.sort());
  expect(getCpu("ryzen-5-7600x3d")?.name).toContain("7600X3D");
  const groups = {
    "/drivers": driverGroups,
    "/tweaker?tab=windows": windowsGroups,
    "/presets": presetGroups,
    "/faq": faqGroups,
    "/tweaker": fileGroups,
  };
  const anchors = Object.entries(groups).flatMap(([path, gs]) =>
    gs.flatMap((g) => g.entries.filter((e) => e.anchor).map((e) => `${path}#${e.anchor}`)),
  );
  expect([...anchors].sort()).toEqual(KNOWLEDGE_BASE.map((e) => knowledgeHref(e.id)).sort());
  for (const e of KNOWLEDGE_BASE) expect(movedAnchors[`kb-${e.id}`]).toBe(knowledgeHref(e.id));
  expect(new Set(TWEAKS.map((t) => t.slug)).size).toBe(TWEAKS.length);
  expect(TWEAKS.filter(packEligible).length).toBeGreaterThanOrEqual(55);
  for (const t of TWEAKS.filter(packEligible)) {
    expect(t.revertSteps.length).toBeGreaterThan(0);
    expect(t.steps.length).toBeGreaterThan(0);
    if (t.file.kind !== "txt") expect(isAscii(t.file.content)).toBe(true);
    if (t.file.kind === "reg") expect(registryBackup(t)?.restore.content).toContain("Import-Clixml");
  }
  const base = { mode: "balanced", gpu: "nvidia", ram: 16, tuning: { windowsVersion: "10" } } as const;
  for (const slug of [
    "memory-integrity-off",
    "standby-purge",
    "defender-exclusions",
    "tdr-delay",
    "windows-11-graphics",
    "amd-game-profile",
  ])
    expect(packEntries({ ...base, slugs: [slug] })).toBeNull();
  for (const gpu of ["amd", "nvidia", "intel"] as const)
    for (const windowsVersion of ["10", "11", undefined] as const) {
      const slugs = TWEAKS.filter(
        (t) => packEligible(t) && fitsVendor(t.slug, gpu) && fitsWindows(t, windowsVersion),
      ).map((t) => t.slug);
      expect(readTweakerPreferences({ mode: "balanced", gpu, slugs })?.slugs).toEqual(slugs);
      expect(
        new URL(packHref(slugs, "balanced", gpu, 16), "https://example.invalid").searchParams.get("tweaks")!
          .length,
      ).toBeLessThanOrEqual(2400);
      const files = packEntries({ ...base, gpu, slugs, tuning: { windowsVersion } })!;
      expect(new Set(files.map((f) => f.name)).size).toBe(files.length);
      for (const t of TWEAKS.filter((t) => slugs.includes(t.slug)))
        expect(files.some((f) => f.name.endsWith("-" + t.file.name))).toBe(true);
    }
  const safe = await request.get("/api/download/memory-integrity-off");
  expect(safe.headers()["content-disposition"]).toContain(".txt");
  expect(await safe.text()).not.toContain("Windows Registry Editor");
  const reg = await request.get("/api/download/game-mode-dvr");
  expect(await reg.text()).toMatch(/^Windows Registry Editor Version 5\.00\r\n/);
});

test("five Dock destinations, progress survives navigation, reload and another tab", async ({ page, context }) => {
  await page.goto("/guide");
  expect(
    await page
      .locator(".tabbar-bottom [data-tab]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label"))),
  ).toEqual(labels);
  const tasks = page.getByRole("checkbox");
  await expect(tasks).toHaveCount(5);
  await click(tasks.nth(0));
  await click(tasks.nth(1));
  const other = await context.newPage();
  await other.goto("/guide");
  await expect(other.getByRole("progressbar")).toHaveAttribute("value", "2");
  await click(other.getByRole("checkbox").nth(2));
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "3");
  await other.close();
  await click(page.locator('.road-step a[href="/drivers"]'));
  const families=page.locator(".family-choice");await expect(families).toHaveCount(5);
  await click(families.first());const drivers=page.getByRole("dialog");
  await click(drivers.locator(".series-toggle").first()); await click(drivers.locator(".model-choice").first());
  await expect(drivers.getByRole("link",{name:/Открыть официальный подбор/})).toHaveAttribute("href", /^https:\/\/www\.nvidia\.com\//);
  await click(drivers.locator(".driver-oem>summary"));
  await expect(drivers.getByRole("link",{name:/Lenovo:/})).toHaveAttribute("href","https://pcsupport.lenovo.com/");await expect(drivers.getByRole("link",{name:/ASUS:/})).toHaveAttribute("href",/asus.com\/support/);
  await page.keyboard.press("Escape");await expect(drivers).toHaveCount(0);
  await page.goBack();
  await page.reload();
  await expect(tasks.nth(2)).toBeChecked();
  await expect(tasks.nth(3)).not.toBeChecked();
  await tasks.nth(3).press("Space");
  await tasks.nth(4).press("Space");
  await page.reload();
  await expect(page.getByText("Маршрут пройден: 5 из 5")).toBeVisible();
  await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(5);
  for (const [old, path] of [
    ["files", "/tweaker"],
    ["kb-nvidia-driver", "/drivers"],
    ["measure", "/tweaker?tab=windows"],
    ["kb-bind-textures", "/presets"],
    ["safety", "/faq"],
  ]) {
    await page.goto(`/guide#${old}`);
    await expect(page).toHaveURL(`${path}#${old}`);
    const target = page.locator(`#${old}`);
    // Check the actual resting position, not just a transient frame during entry.
    await target.evaluate(el => Promise.allSettled(el.closest(".rf-page-enter")!.getAnimations().map(a => a.finished)));
    await expect(target).toBeInViewport();
  }
});

test("320px side mode keeps driver links, complete roadmap and active controls inside the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 480 });
  await page.addInitScript(() => localStorage.setItem("rustflow:dock-position:v1", "left"));
  for (const path of ["/guide", "/drivers", "/benchmark", "/files/game-mode-dvr"]) {
    await page.goto(path);
    if (path === "/guide") await expect(page.locator(".tabbar-bottom [aria-current]")).toHaveCount(0);
    else await page.locator(".dock-lens[data-positioned]").waitFor();
    await page.evaluate(() => document.fonts.ready);
    const cols = page.locator(
      ".roadmap :is(a,label,h2),.driver-library :is(a,.family-choice,h2),.build-fields :is(input,button.field,[role=radio]):visible,.build-output :is(h2,button,table):visible,.file-detail :is(.btn,section,h2):visible",
    );
    if(path==="/drivers") await expect(cols).toHaveCount(6); // heading + all five real invokers
    else expect(await cols.count()).toBeGreaterThan(6);
    expect(
      await cols.evaluateAll((els) =>
        els.every((el) => {
          const r = el.getBoundingClientRect();
          return r.right <= innerWidth + 1 && r.left >= 0;
        }),
      ),
    ).toBe(true);
    await expect(page.locator(".tabbar-bottom")).toHaveCSS("width", "54px");
  }
});

test("editable pack summary, nested login and the downloaded CFG, REG, BAT and rollback agree", async ({
  page,
  context,
}) => {
  test.setTimeout(90000);
  const input = { ...QUICK_SAMPLE_BUILDS[0].input, ramGb: 16, windowsVersion: "11" };
  await page.addInitScript((input) => {
    if (!localStorage.getItem("rustflow:store:v1"))
      localStorage.setItem(
        "rustflow:store:v1",
        JSON.stringify({
          builds: [{ id: "mine", input }],
          activeBuildId: "mine",
          tweaker: { mode: "balanced", gpu: "nvidia", slugs: ["game-mode-dvr", "pagefile-auto"] },
        }),
      );
  }, input);
  await page.goto("/tweaker");
  const search = page.getByRole("searchbox", { name: "Поиск: Твикер" });
  await search.fill("MenuShowDelay");
  await click(page.locator(".discovery-item"));
  await click(page.getByRole("button", { name: /Добавить: MenuShowDelay/ }));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await click(
    page.getByRole("radiogroup", { name: "Графический профиль Rust" }).getByRole("radio", { name: /Качество/ }),
  );
  const trigger = page.getByRole("button", { name: "Посмотреть ИИ-сводку ✨" });
  await click(trigger);
  const box = page.getByRole("dialog", { name: "ИИ-сводка вашего пакета" });
  const steps = async () =>
    box
      .locator("[data-pack-step]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-pack-step")).sort());
  expect(await steps()).toEqual(["game-mode-dvr", "menu-delay", "pagefile-auto"]);
  await expect(box).toContainText("Windows 11");
  await expect(box).toContainText("Красота");
  await expect(box).toContainText("Перезагрузка ПК нужна после:");
  await expect(box).toContainText("EAC");
  const other = await context.newPage();
  await other.goto("/benchmark");
  await click(other.getByRole("combobox", { name: "Версия Windows" }));
  await click(other.getByRole("option", { name: "Windows 10" }));
  await click(other.getByRole("radio", { name: "32 ГБ", exact: true }));
  await other.close();
  await expect(box).toContainText("Windows 10");
  await expect(box).toContainText("gc.buffer 4096");
  const cfg = await box.locator("[data-pack-cfg]").textContent();
  const dl = box.getByRole("button", { name: "Скачать готовый ZIP с откатом" });
  await click(dl);
  const login = page.getByRole("dialog", { name: "Профиль игрока" });
  await click(login.getByRole("button", { name: /Продолжить через Google/ }));
  await expect(login.locator(".cabinet-widgets")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(login).toHaveCount(0);
  await expect(dl).toBeFocused();
  const download = page.waitForEvent("download");
  await click(dl);
  const file = await download;
  expect(file.suggestedFilename()).toBe("RustFlow-Pack-quality.zip");
  const z = unzipSync(await readFile((await file.path())!));
  expect(strFromU8(z["RustFlow-Pack/client.cfg"]).replace(/\r\n/g, "\n").trim()).toBe(cfg?.trim());
  const readme = strFromU8(z["RustFlow-Pack/README.txt"]);
  expect(readme).toContain("Windows 10");
  expect([...readme.matchAll(/^• [^\n]*\(([a-z\d-]+)\)\r?$/gm)].map((m) => m[1]).sort()).toEqual(await steps());
  const names = Object.keys(z);
  expect(names.some((n) => n.endsWith("game-mode-dvr.reg"))).toBe(true);
  for (const part of [
    "Do-REG/game-mode-dvr-snapshot.bat",
    "Otkat/game-mode-dvr-restore-snapshot.bat",
    "Otkat/menu-delay-REVERT.bat",
  ])
    expect(names).toContain("RustFlow-Pack/" + part);
  expect(strFromU8(z["RustFlow-Pack/Otkat/menu-delay-REVERT.bat"])).toMatch(/MenuShowDelay/);
  await expect(page.getByRole("status").filter({ hasText: "Загрузка началась успешно!" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("OS override with unknown Windows and a different GPU changes the sheet and only compatible ZIP files", async ({
  page,
}) => {
  await page.addInitScript(
    (input) =>
      localStorage.setItem(
        "rustflow:store:v1",
        JSON.stringify({ builds: [{ id: "mine", input }], activeBuildId: "mine" }),
      ),
    QUICK_SAMPLE_BUILDS[0].input,
  );
  await page.goto("/tweaker?auto=live");
  const trigger = page.getByRole("button", { name: "Посмотреть ИИ-сводку ✨" }),
    box = page.getByRole("dialog", { name: "ИИ-сводка вашего пакета" });
  await click(trigger);
  await expect(box).toContainText("Версия Windows не указана");
  await expect(box.locator('[data-pack-step^="windows-"]')).toHaveCount(0);
  await expect(box.locator("[data-pack-cfg]")).toContainText("graphicssettings.globaltexturemipmaplimit");
  await page.keyboard.press("Escape");
  await click(page.getByRole("combobox", { name: "Windows для пакета" }));
  await click(page.getByRole("option", { name: "Windows 10" }));
  await click(page.getByRole("radio", { name: "AMD", exact: true }));
  await expect(page.getByText("Персональный конфиг").locator("..")).toContainText("VRAM не указана");
  await click(trigger);
  await expect(box.locator('[data-pack-step="windows-10-graphics"]')).toHaveCount(1);
  await expect(box.locator('[data-pack-step="amd-adrenalin"]')).toHaveCount(1);
  await expect(box.locator('[data-pack-step="nvidia-panel"]')).toHaveCount(0);
  await expect(box).not.toContainText("GeForce RTX 5060");
  await expect(box.locator("[data-pack-cfg]")).not.toContainText("globaltexturemipmaplimit");
  const dl = box.getByRole("button", { name: "Скачать готовый ZIP с откатом" });
  await click(dl);
  const login = page.getByRole("dialog", { name: "Профиль игрока" });
  await click(login.getByRole("button", { name: /Продолжить через Google/ }));
  await expect(login.locator(".cabinet-widgets")).toBeVisible();
  await page.keyboard.press("Escape");
  const started = page.waitForEvent("download");
  await click(dl);
  const z = unzipSync(await readFile((await (await started).path())!));
  const text = strFromU8(z["RustFlow-Pack/README.txt"]);
  expect(text).toContain("Видеокарта: AMD");
  expect(text).toContain("Windows 10");
  expect(text).not.toContain("Windows 11");
  expect(strFromU8(z["RustFlow-Pack/client.cfg"]).replace(/\r\n/g, "\n").trim()).toBe(
    (await box.locator("[data-pack-cfg]").textContent())!.trim(),
  );
});

test("the 15 selectable CPUs and readable single files are reachable without losing old deep links", async ({
  page,
  request,
}) => {
  await page.goto("/benchmark");
  await click(page.getByRole("button", { name: "Процессор (CPU)", exact: true }));
  await expect(page.getByRole("option")).toHaveCount(15);
  await expect(page.getByRole("option", { name: "Ryzen 5 7600X3D", exact: true })).toHaveCount(0);
  await page.goto("/tweaks/memory-integrity-off");
  await expect(page).toHaveURL(/\/tweaker\?tweak=memory-integrity-off/);
  const box = page.getByRole("dialog");
  await click(box.locator("#steps-memory-integrity-off a"));
  await expect(page).toHaveURL(/\/files\/memory-integrity-off$/);
  await expect(page.getByRole("link", { name: "Скачать памятку (TXT)" })).toHaveAttribute(
    "href",
    "/api/download/memory-integrity-off",
  );
  await page.goto("/files/game-mode-dvr");
  for (const [text, v, cmd] of [
    ["Снимок до REG (BAT)", "snapshot", "Export-Clixml"],
    ["Откат из снимка (BAT)", "restore-snapshot", "Import-Clixml"],
  ]) {
    const href = await page.getByRole("link", { name: text, exact: true }).getAttribute("href");
    expect(href).toBe(`/api/download/game-mode-dvr?v=${v}`);
    const r = await request.get(href!);
    expect(r.status()).toBe(200);
    expect(await r.text()).toContain(cmd);
  }
});

test("roadmap keeps five action links without completion tracking", async ({ page }) => {
  await page.goto("/guide");
  const roadmap = page.locator("#roadmap");
  await expect(roadmap.getByRole("heading", { name: "Моя дорожная карта" })).toBeVisible();
  await expect(roadmap.locator(".road-step")).toHaveCount(5);
  await expect(roadmap.locator(".road-step a")).toHaveCount(5);
  await expect(roadmap.getByRole("checkbox")).toHaveCount(0);
  await expect(roadmap.getByRole("progressbar")).toHaveCount(0);
  await expect(roadmap).not.toContainText("Выполнено");
});
