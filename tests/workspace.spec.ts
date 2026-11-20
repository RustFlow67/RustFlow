import { expect, test, type Locator } from "@playwright/test";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { projectPreset } from "@/lib/models/preset-projection";
import type { BuildResolution } from "@/lib/models/build-resolution";
import { getSystemBridge } from "@/lib/systemBridge";

const press = (el: Locator) => (test.info().project.use.hasTouch ? el.tap() : el.click());

test("the Windows fragment opens the actual second tab; keyboard, history and edits survive switching", async ({
  page,
}) => {
  await page.goto("/windows?mode=quality#measure");
  await expect(page).toHaveURL(
    (u) =>
      u.pathname === "/tweaker" &&
      u.searchParams.get("tab") === "windows" &&
      u.searchParams.get("mode") === "quality" &&
      u.hash === "#measure",
  );
  await expect(page.locator("#measure")).toBeInViewport();
  const tabs = page.getByRole("tablist", { name: "Раздел Твикера" });
  const game = tabs.getByRole("tab", { name: "Игровой конфиг" }),
    windows = tabs.getByRole("tab", { name: "Система Windows" });
  await expect(tabs.getByRole("tab")).toHaveCount(2);
  await expect(windows).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('.nav-item[aria-current="page"]')).toHaveAccessibleName("Твикер");
  if (!test.info().project.use.hasTouch) {
    await game.hover();
    await expect(game).toHaveAttribute("data-lens-target", "");
    await expect(windows).toHaveAttribute("aria-selected", "true");
    await page.mouse.move(1, 1);
    await expect(windows).toHaveAttribute("data-lens-target", "");
  }
  await press(game);
  await expect(page).toHaveURL(
    (u) => u.searchParams.get("mode") === "quality" && !u.searchParams.has("tab") && !u.hash,
  );
  const os = page.getByRole("combobox", { name: "Windows для пакета" });
  await press(os);
  await press(page.getByRole("option", { name: "Windows 11" }));
  await game.focus();
  await game.press("ArrowRight");
  await expect(windows).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAccessibleName("Система Windows");
  await expect(page.getByRole("heading", { name: "Параметры Windows 10 и 11" })).toBeVisible();
  await page.goBack();
  await expect(game).toHaveAttribute("aria-selected", "true");
  await expect(os).toContainText("Windows 11");
  await page.goForward();
  await page.reload();
  await expect(windows).toHaveAttribute("aria-selected", "true");
  await expect(tabs.locator(".liquid-lens[data-positioned]")).toBeVisible();
});

test("the assistant has a useful offline destination and never prints provider configuration details", async ({
  page,
}) => {
  const questions: string[] = [];
  await page.route("**/api/assistant", (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { configured: false, error: "Internal: RUSTFLOW_LLM_API_KEY in .env" } });
    questions.push(route.request().postDataJSON().question);
    return route.fulfill({ status: 503, json: { error: "Internal: RUSTFLOW_LLM_API_KEY in .env" } });
  });
  await page.goto("/");
  await press(page.getByRole("button", { name: "ИИ-ассистент" }));
  const dialog = page.getByRole("dialog");
  const link = dialog.getByRole("link", { name: /Перейти в Сборку/ });
  await expect(link).toHaveAttribute("href", "/benchmark#build-config");
  const text = "Rust завис на Done";
  await press(dialog.getByRole("button", { name: text, exact: true }));
  await expect.poll(() => questions).toEqual([text]);
  await expect(dialog.getByLabel("Вопрос помощнику")).toHaveValue(text);
  await expect(link).toBeVisible();
  await expect(dialog).not.toContainText(/RUSTFLOW_LLM|\.env|API[_ -]?KEY/i);
  await press(link);
  await expect(page).toHaveURL(/\/benchmark#build-config$/);
  await expect(dialog).toHaveCount(0);
});

test("one quick question replaces the draft and posts exactly once, without overwriting the next draft", async ({
  page,
}) => {
  const posted: string[] = [];
  let release!: () => void;
  const hold = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/assistant", async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: { configured: true } });
    posted.push(route.request().postDataJSON().question);
    await hold;
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: '{"type":"delta","text":"Сравните два прогона."}\n{"type":"done"}\n',
    });
  });
  await page.goto("/");
  await press(page.getByRole("button", { name: "ИИ-ассистент" }));
  const dialog = page.getByRole("dialog"),
    input = dialog.getByLabel("Вопрос помощнику");
  const text = "Как выбрать gc.buffer под мою память?";
  await input.fill("Предыдущий черновик");
  try {
    await press(dialog.getByRole("button", { name: text, exact: true }));
    await expect(input).toHaveValue(text);
    await expect.poll(() => posted).toEqual([text]);
    await input.fill("Следующий вопрос");
  } finally {
    release();
  }
  await expect(dialog.getByRole("log")).toContainText("Сравните два прогона.");
  await expect(input).toHaveValue("Следующий вопрос");
  expect(posted).toEqual([text]);
});

test("preset purposes and scene descriptions follow the displayed target and graphics, not the stock rig", async ({
  page,
}) => {
  const base = HARDWARE_PRESETS.find((p) => p.resolution === "1440p")!;
  for (const [target, label] of [
    [{ resolution: "1080p" }, "1080p"],
    [{ resolution: "1440p" }, "1440p"],
    [{ resolution: "4k" }, "4K"],
    [{ resolution: "1440x1080" }, "1440×1080 (4:3)"],
    [{ resolution: "custom", customResolution: { width: 1728, height: 1080 } }, "1728×1080"],
  ] as [BuildResolution, string][]) {
    const view = projectPreset(base, "quality", target);
    expect(view.resolutionLabel).toBe(label);
    expect(view.purpose).toBe(`Высокая детализация · ${label}`);
    expect(view.testScene).toContain(label);
    expect(projectPreset(base, "competitive", target).purpose).toContain("PvP и рейды");
  }
  await page.goto("/presets");
  const card = page.locator(`#preset-${base.slug}`);
  await expect(card).toContainText("PvP и рейды · 1080p");
  await press(page.getByRole("radio", { name: "4:3", exact: true }));
  await expect(card).toContainText("PvP и рейды · 1440×1080 (4:3)");
  await expect(card).not.toContainText(/Для 2K|для 1440p/i);
});

test("the web bridge is inert and an injected desktop host cannot turn a normal page into an installer", async ({
  page,
}) => {
  const bridge = getSystemBridge();
  for (const result of await Promise.all([
    bridge.findRustDirectory(),
    bridge.readHardware(),
    bridge.readOperatingSystem(),
    bridge.backupClientCfg(),
    bridge.applyTweaks({ kind: "cfg", cfg: "" }),
    bridge.rollbackChanges(),
    bridge.installCleanDriver({ family: "nvidia", model: "GeForce RTX 5060" }),
  ]))
    expect(result).toEqual({ status: "unavailable" });
  await page.addInitScript(() => {
    Object.defineProperty(window, "rustflowSystem", {
      get() {
        sessionStorage.setItem("test-host-access", "yes");
        throw Error("web host access");
      },
    });
  });
  await page.goto("/tweaker");
  await expect(page.getByRole("button", { name: /Скачать ZIP.*Доступно/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Скопировать client.cfg" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Применить в систему" })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem("test-host-access"))).toBeNull();
});
