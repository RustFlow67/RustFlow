import { expect, test, type Locator } from "@playwright/test";
import { QUICK_SAMPLE_BUILDS } from "@/lib/models/build";
import type { SystemBridge, TweakPlan } from "@/lib/systemBridge";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true })));
});

const press = (el: Locator) => (test.info().project.use.hasTouch ? el.tap() : el.click());
const apply = "Применить в систему",
  undo = "Откатить изменения";

test("a desktop build without a host never reports an installation, backup or rollback", async ({ page }) => {
  await page.addInitScript(
    (input) =>
      localStorage.setItem(
        "rustflow:store:v1",
        JSON.stringify({
          builds: [{ id: "rig", input }],
          activeBuildId: "rig",
        }),
      ),
    { ...QUICK_SAMPLE_BUILDS[0].input, windowsVersion: undefined },
  );
  await page.goto("/");
  await expect(page.locator(".system-plan [data-plan-count]")).toBeVisible();
  await expect(page.locator(".system-plan")).not.toContainText("Версия Windows не указана");
  await page.goto("/tweaker?auto=live");
  await expect(page.locator(".plan-strip [data-plan-count]")).toBeVisible();
  await expect(page.locator(".plan-strip")).not.toContainText("Версия Windows не указана");
  await expect(page.getByRole("button", { name: /Скачать ZIP|Скопировать client.cfg/ })).toHaveCount(0);
  const actions = page.locator("#pack-settings .native-actions");
  for (const name of [apply, undo]) {
    await press(actions.getByRole("button", { name }));
    await expect(actions.getByRole("status")).toHaveText(/модуль пока не подключён/);
  }
  await page.goto("/drivers");
  await press(page.locator("#nvidia"));
  const dialog = page.getByRole("dialog");
  await press(dialog.getByRole("button", { name: "GTX 10", exact: true }));
  await press(dialog.getByRole("button", { name: "GeForce GTX 1080 Ti", exact: true }));
  await expect(dialog.getByRole("link", { name: /Скачать DDU|Скачать чистый драйвер/ })).toHaveCount(0);
  await press(dialog.getByRole("button", { name: "Скачать DDU (удаление старого драйвера) ↗" }));
  await expect(dialog.locator(".driver-downloads [role=status]")).toContainText("недоступно");
});

test("the narrow host contract receives the actual preview/selection only on explicit action", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const stub = async () => ({ status: "unavailable" }) as const;
    const host: SystemBridge = {
      findRustDirectory: stub,
      backupClientCfg: stub,
      readHardware: stub,
      readOperatingSystem: async () => ({ status: "ok", value: { name: "Windows", windowsVersion: "10" } }),
      applyTweaks: async (plan) => {
        sessionStorage.setItem("test-plan", JSON.stringify(plan));
        return { status: "cancelled" };
      },
      rollbackChanges: async () => {
        throw new Error("host disconnected");
      },
      installCleanDriver: stub,
      openOfficialSupport: async (kind) => {
        sessionStorage.setItem("test-driver-page", kind);
        return { status: "ok", value: undefined };
      },
    };
    window.rustflowSystem = host;
  });
  await page.goto("/tweaker?mode=quality&gpu=amd");
  await press(page.getByRole("switch", { name: "Добавить графический client.cfg в пакет" }));
  await press(page.getByRole("button", { name: "Выбрать рекомендуемые" }));
  const os = page.getByRole("combobox", { name: "Windows для пакета" });
  await press(os);
  await expect(page.getByRole("option", { name: "Авто: Windows 10" })).toBeVisible();
  await press(page.getByRole("option", { name: "Windows 11" }));
  await press(page.getByRole("button", { name: "Посмотреть сводку" }));
  const dialog = page.getByRole("dialog");
  const cfg = await dialog.locator("[data-pack-cfg]").textContent();
  const slugs = await dialog
    .locator("[data-pack-step]")
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-pack-step")));
  expect(await page.evaluate(() => sessionStorage.getItem("test-plan"))).toBeNull();
  await press(dialog.getByRole("button", { name: apply }));
  await expect(dialog.getByRole("status")).toContainText("Операция отменена");
  const plan = await page.evaluate(() => JSON.parse(sessionStorage.getItem("test-plan")!) as TweakPlan);
  expect(plan).toMatchObject({
    kind: "pack",
    cfg,
    mode: "quality",
    gpu: "amd",
    slugs,
    tuning: { windowsVersion: "11" },
  });
  await press(dialog.getByRole("button", { name: undo }));
  await expect(dialog.getByRole("status")).toContainText("Не удалось получить подтверждение");
  await page.goto("/drivers");
  await press(page.locator("#radeon"));
  await press(dialog.getByRole("button", { name: /RX 500 · Polaris/ }));
  await press(dialog.getByRole("button", { name: "Radeon RX 580", exact: true }));
  await press(dialog.getByRole("button", { name: "Открыть официальный подбор драйвера ↗" }));
  await expect(dialog.locator(".driver-downloads [role=status]")).toContainText("Открыта официальная страница");
  expect(await page.evaluate(() => sessionStorage.getItem("test-driver-page"))).toBe("radeon");
});

test("cfg previews and preset cards use the same desktop action, not a browser download", async ({
  page,
}) => {
  await page.goto("/benchmark");
  await press(page.getByRole("button", { name: "Предпросмотр client.cfg" }));
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-build-cfg]")).not.toBeEmpty();
  await expect(dialog.getByRole("link", { name: "Скачать client.cfg" })).toHaveCount(0);
  await press(dialog.getByRole("button", { name: apply }));
  await expect(dialog.getByRole("status")).toContainText("не подключён");
  await page.goto("/presets");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const card = page.locator(".preset-card").first();
  await expect(card.getByRole("button", { name: apply })).toBeVisible();
  await press(card.getByRole("button", { name: "Детали" }));
  await expect(dialog.getByRole("button", { name: undo })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Копировать", exact: true })).toHaveCount(0);
  await expect(page.locator('a[download="client.cfg"]')).toHaveCount(0);
});

test("Tauri exports a package of instructions and rollback files without running it", async ({ page }) => {
  await page.addInitScript(() => {
    const win = window as unknown as { isTauri: boolean; __TAURI_INTERNALS__: { invoke: (cmd: string, args?: { files?: { name: string; data: number[] }[] }) => Promise<unknown> } };
    win.isTauri = true;
    window.confirm = () => true;
    win.__TAURI_INTERNALS__ = { invoke: async (cmd, args) => {
      if (cmd === "read_windows_info") throw new Error("not available");
      if (cmd === "save_tweak_pack") {
        sessionStorage.setItem("pack-files", JSON.stringify(args?.files?.map(file => file.name)));
        return { opened: true };
      }
      throw new Error(`Unexpected command: ${cmd}`);
    } };
  });
  await page.goto("/tweaker?mode=quality&gpu=amd");
  const actions = page.locator("#pack-settings .native-actions");
  await press(page.getByRole("switch", { name: "Добавить графический client.cfg в пакет" }));
  await press(actions.getByRole("button", { name: "Подготовить и открыть пакет твиков" }));
  await expect(actions.getByRole("status")).toContainText("Твики не запускались");
  await expect(actions.getByRole("button", { name: "Откатить изменения" })).toHaveCount(0);
  const names = await page.evaluate(() => JSON.parse(sessionStorage.getItem("pack-files") || "[]") as string[]);
  expect(names).toContain("SHIFT-Pack/README.txt");
  expect(names.some(name => name.startsWith("SHIFT-Pack/Otkat/"))).toBe(true);
});


test("native confirmation sends exactly the selected steps and optional config", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('shift:setup:v1', JSON.stringify({ version: 1, language: 'ru', goal: 'smooth', accepted: true }));
    const win = window as unknown as { isTauri: boolean; __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<unknown> } };
    win.isTauri = true;
    window.confirm = () => sessionStorage.getItem('allow') === 'yes';
    win.__TAURI_INTERNALS__ = { invoke: async (cmd, args) => {
      if (cmd === 'execute_tweak_plan') { sessionStorage.setItem('executed-plan', JSON.stringify(args)); return { message: 'ok' }; }
      throw new Error('unavailable');
    } };
  });
  await page.goto('/tweaker');
  const first = page.locator('[data-manual-tweak]').first();
  const slug = await first.getAttribute('data-manual-tweak');
  await press(first.getByRole('switch'));
  const run = page.locator('#pack-settings .native-actions').getByRole('button', { name: 'Применить в систему (с бэкапом)' });
  await press(run);
  await expect(page.locator('#pack-settings .native-actions [role=status]')).toContainText('отменена');
  expect(await page.evaluate(() => sessionStorage.getItem('executed-plan'))).toBeNull();
  await page.evaluate(() => sessionStorage.setItem('allow', 'yes'));
  await press(run);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('executed-plan'))).not.toBeNull();
  let result = await page.evaluate(() => JSON.parse(sessionStorage.getItem('executed-plan')!));
  expect(result.plan).toMatchObject({ slugs: [slug], cfg: '' });
  const cfgSwitch = page.getByRole('switch', { name: 'Добавить графический client.cfg в пакет' });
  await press(cfgSwitch);
  await expect(cfgSwitch).toHaveAttribute('aria-checked', 'true');
  await page.evaluate(() => sessionStorage.removeItem('executed-plan'));
  await press(run);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('executed-plan'))).not.toBeNull();
  result = await page.evaluate(() => JSON.parse(sessionStorage.getItem('executed-plan')!));
  expect(result.plan.slugs).toEqual([slug]);
  expect(result.plan.cfg.length).toBeGreaterThan(0);
});
