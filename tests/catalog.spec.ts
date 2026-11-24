import { expect, test, type Locator, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { strFromU8, unzipSync } from "fflate";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { projectPreset } from "@/lib/models/preset-projection";
import { presetBuildInput } from "@/lib/addons/build-tools";
import { TWEAKS_LITE } from "@/lib/tweaks";
import { fitsVendor, packEligible } from "@/lib/tweaker";
import { matches, rankTweaks, tokens } from "@/lib/catalog/ranking";
import { guideGroups, windowsGroups, faqGroups } from "@/lib/catalog/reading";

const activate = (c: Locator) => (test.info().project.use.hasTouch ? c.tap() : c.click());
async function choose(page: Page, label: string, option: string) {
  await activate(page.getByRole("combobox", { name: label, exact: true }));
  await activate(page.getByRole("option", { name: option, exact: true }));
}

test("catalogue priorities use the right metric and popularity accepts only known entries", async ({
  request,
}) => {
  const inventory = TWEAKS_LITE.filter((t) => !t.slug.startsWith("preset-") && fitsVendor(t.slug, "nvidia"));
  expect(
    rankTweaks(inventory, "effective", [])
      .slice(0, 3)
      .map((t) => t.slug),
  ).toEqual(["nvidia-panel", "gc-buffer", "xmp-expo-timings"]);
  expect(
    rankTweaks(inventory, "fps", [])
      .slice(0, 3)
      .map((t) => t.slug),
  ).toEqual(["xmp-expo-timings", "game-mode-dvr", "steam-checklist"]);
  expect(rankTweaks(inventory, "safe", []).every((t) => t.riskLevel === "safe" && t.evidence !== "myth")).toBe(
    true,
  );
  expect(rankTweaks(inventory, "favorite", ["clean-temp-cache"])[0].slug).toBe("clean-temp-cache");
  expect(packEligible(inventory.find((t) => t.slug === "gc-buffer")!)).toBe(false);
  expect(matches(tokens("  ОБЪЁМ ram "), "RAM: объём ОЗУ")).toBe(true);
  for (const groups of [guideGroups, faqGroups]) {
    const keys = groups.flatMap((g) => g.entries.map((e) => e.key));
    expect(new Set(keys).size).toBe(keys.length);
  }
  const endpoint = "/api/catalog?section=guide",
    item = guideGroups[0].entries[0].key,
    headers = { "X-RustFlow-Open": "1" };
  expect((await request.post(`${endpoint}&item=not-in-catalog`, { headers })).status()).toBe(400);
  expect((await request.post(`${endpoint}&item=${item}`)).status()).toBe(403);
  const before = (await (await request.get(endpoint)).json()).counts[item] ?? 0;
  expect((await (await request.post(`${endpoint}&item=${item}`, { headers })).json()).opens).toBe(before + 1);
  expect((await (await request.get(endpoint)).json()).counts[item]).toBe(before + 1);
});

test("Tweaker live search, independent category filters, contextual GC and real favorites", async ({ page }) => {
  await page.goto("/tweaker");
  const items = page.locator(".discovery-item"),
    search = page.getByRole("searchbox", { name: "Поиск: Твикер" });
  await expect(items.locator(".rubric")).toHaveText(["ТОП выбор", "ТОП выбор", "ТОП выбор"]);
  await expect(items.nth(0)).toContainText("NVIDIA");
  await expect(items.nth(1)).toContainText("gc.buffer");
  await expect(items.nth(2)).toContainText("XMP");
  await search.fill("gc.buffer");
  // The old launch-options myth mentions gc.buffer in its verification text.
  // Both are legitimate global hits, but only one belongs to RAM/SSD.
  await expect(items).toHaveCount(2);
  await expect(items.first()).toContainText("Оптимизация gc.buffer");
  await expect(items.last()).toContainText("-maxMem");
  await activate(items.first());
  const panel = page.getByRole("dialog");
  await expect(panel.locator("article")).toHaveCount(1);
  await expect(panel.locator("article")).toContainText("В вашем client.cfg:");
  await expect(panel.getByRole("button", { name: /^(Добавить|Убрать):/ })).toHaveCount(0);
  await activate(panel.locator(".favorite-drop"));
  await panel.getByRole("searchbox").fill("нет-такой-команды");
  await expect(panel.locator("article")).toHaveCount(0);
  await expect(panel.getByText(/Подходящих твиков нет/)).toBeVisible();
  await panel.getByRole("searchbox").fill("");
  await choose(page, "Сортировка: RAM и SSD", "Сначала избранные");
  await expect(panel.locator("article").first()).toContainText("Оптимизация gc.buffer");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(search).toHaveValue("gc.buffer");
  await search.fill("");
  await choose(page, "Сортировка: Твикер", "По максимальному приросту FPS");
  await expect(items.first()).toContainText(/XMP/i);
  await choose(page, "Сортировка: Твикер", "Только безопасные для EAC");
  await expect(items.filter({ hasText: /Defender|BCDedit|HAGS/i })).toHaveCount(0);
  await choose(page, "Сортировка: Твикер", "Сначала избранные");
  await expect(items.first()).toContainText("gc.buffer");
  await activate(page.getByRole("radio", { name: "AMD", exact: true }));
  await expect(items.filter({ hasText: "AMD Software Adrenalin" })).toHaveCount(1);
  await expect(items.filter({ hasText: "Панель управления NVIDIA" })).toHaveCount(0);
});

test("preset popularity, hardware match, FPS and stars reorder the actual visible cards", async ({ page }) => {
  const popular = HARDWARE_PRESETS[2],
    near = HARDWARE_PRESETS[1],
    input = presetBuildInput(near);
  await page.addInitScript(
    (input) =>
      localStorage.setItem(
        "rustflow:store:v1",
        JSON.stringify({ builds: [{ id: "mine", input }], activeBuildId: "mine" }),
      ),
    input,
  );
  let posts = 0;
  await page.route("**/api/catalog?section=presets**", (r) => {
    if (r.request().method() === "POST") {
      posts++;
      return r.fulfill({ json: { opens: 16 } });
    }
    return r.fulfill({ json: { counts: { [popular.slug]: 15 }, period: "all" } });
  });
  await page.goto("/presets");
  const first = page.locator(".preset-card").first(),
    sort = "Сортировка пресетов";
  await expect(first).toHaveAttribute("id", `preset-${popular.slug}`);
  const details = first.getByRole("button", { name: "Детали", exact: true });
  for (let i = 0; i < 2; i++) {
    await activate(details);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
  }
  expect(posts).toBe(1);
  await choose(page, sort, "Лучше всего под мою сборку");
  await expect(first).toHaveAttribute("id", `preset-${near.slug}`);
  await activate(first.locator(".favorite-drop"));
  await choose(page, sort, "По максимальному FPS");
  const peaks = HARDWARE_PRESETS.map((p) => projectPreset(p, "competitive", { resolution: "1080p" })).sort(
    (a, b) => b.fpsModded[1] - a.fpsModded[1] || b.fpsModded[0] - a.fpsModded[0],
  );
  await expect(first).toHaveAttribute("id", `preset-${peaks[0].slug}`);
  await choose(page, sort, "Сначала избранные");
  await expect(first).toHaveAttribute("id", `preset-${near.slug}`);
  await page.locator("#preset-library").getByRole("searchbox").fill("несуществующая модель");
  await expect(page.locator(".preset-card")).toHaveCount(0);
});

for (const scope of ["guide", "faq"] as const)
  test(`${scope}: full-text search, global alphabetical and measured popular order`, async ({ page }) => {
    const groups = scope === "guide" ? windowsGroups : faqGroups,
      entries = groups.flatMap((g) => g.entries),
      pick = entries[4],
      label = scope === "guide" ? "Windows" : "Мифы и EAC";
    await page.route(`**/api/catalog?section=${scope}`, (r) =>
      r.fulfill({ json: { counts: { [pick.key]: 12 }, period: "all" } }),
    );
    await page.goto(scope==="guide"?"/windows":"/faq");
    const search = page.getByRole("searchbox"),
      cards = page.locator("[data-reading]");
    await search.fill("супернесуществующий");
    await expect(cards).toHaveCount(0);
    await activate(page.getByRole("button", { name: "Сбросить поиск" }));
    await search.fill(pick.title);
    await expect(page.locator(`[data-reading="${pick.key}"]`)).toBeVisible();
    await search.fill("");
    await choose(page, `Сортировка: ${label}`, "По алфавиту");
    const expected = [...entries]
      .sort((a, b) => a.title.localeCompare(b.title, "ru", { numeric: true }))
      .map((e) => e.key);
    expect(await cards.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("data-reading")))).toEqual(expected);
    await choose(page, `Сортировка: ${label}`, "Популярные");
    await expect(cards.first()).toHaveAttribute("data-reading", pick.key);
    if (scope === "faq") {
      await activate(page.getByRole("link", { name: "Список плацебо", exact: true }));
      await expect(page.locator("#myths")).toBeInViewport();
    }
  });

test("ZIP and copy show success only after the action, with one RAM-aware config", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async (text: string) => sessionStorage.setItem("test-cfg", text) },
    }),
  );
  await page.goto("/tweaker");
  await activate(page.getByRole("button", { name: "Скопировать client.cfg" }));
  await expect(page.getByRole("status").filter({ hasText: "Скопировано в буфер" })).toBeVisible();
  const zip = page.getByRole("button", { name: /Скачать ZIP с твиками и откатом/ });
  await activate(zip);
  const panel = page.getByRole("dialog");
  await activate(panel.getByRole("button", { name: /Продолжить через Google/ }));
  await expect(panel.locator(".cabinet-widgets")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  const download = page.waitForEvent("download");
  await activate(zip);
  const file = await download;
  const toast = page.getByRole("status").filter({ hasText: "Загрузка началась успешно!" });
  await expect(toast).toBeVisible();
  await expect.poll(async () => { const r = (await toast.boundingBox())!; return Math.abs(r.x + r.width - page.viewportSize()!.width); }).toBeLessThan(23);
  const entries = unzipSync(await readFile((await file.path())!));
  const cfg = strFromU8(entries["SHIFT-Pack/client.cfg"]);
  expect(cfg.match(/^gc\.buffer\s/gm)).toHaveLength(1);
  expect(Object.keys(entries).some((n) => /gc-buffer\.bat/.test(n))).toBe(false);
  expect(Object.keys(entries).some((n) => n.includes("Otkat"))).toBe(true);
});
