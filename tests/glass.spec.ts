import { optics as materialOptics } from "./material-optics";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { PRO_TEASER } from "@/lib/materials";

import { expectReceded } from "./hud";

const activate = (control: Locator) => test.info().project.use.hasTouch ? control.tap() : control.click();
const brand = (p: Page) => p.getByRole("button", { name: "Меню RustFlow", exact: true });
const menu = (p: Page) => p.getByRole("dialog", { name: "Меню RustFlow" });
const profile = (p: Page) => p.getByRole("dialog", { name: "Профиль игрока" });
const settings=(p:Page)=>p.getByRole("dialog",{name:"Настройки",exact:true});
async function collection(p: Page) { await activate(p.getByRole("button", {name:"Настройки",exact:true}));await activate(settings(p).getByRole("radio", {name:"Темы оформления"})); }
// Exercise device mode independently of the OAuth/DB configuration of the runner.
async function deviceMode(page: Page) {
  await page.route("**/api/auth/session", r => r.fulfill({ json: { user: null, admin: false, secureOrigin: true, passwordEnabled: false, googleEnabled: false } }));
}

test("brand modal lands before opening its FAQ or about; focus returns to the persistent logo", async ({ page }) => {
  await page.goto("/benchmark");
  await expect(page.getByRole("button", { name: /Переключить на .* тему/ })).toHaveCount(0);
  await activate(brand(page));
  await expect(menu(page).getByRole("heading", { name: "Меню RustFlow" })).toBeVisible();
  await expect(menu(page).getByRole("button", { name: "Закрыть окно" })).toBeVisible();
  const faq = menu(page).getByRole("button", { name: /FAQ/ });
  await activate(faq);
  const dialog = page.getByRole("dialog", { name: /FAQ/ });
  await expect(dialog).toHaveCSS("scrollbar-width", "none");
  await expect(page.locator("#rustflow-menu")).toHaveCount(0);
  await expect(dialog.locator("button[aria-controls]")).toHaveCount(5);
  await expectReceded(page);
  await activate(dialog.getByText("Как откатить изменения?"));
  await expect(dialog.locator(".accordion-body[data-expanded]")).toContainText("Otkat");
  await activate(dialog.getByText("Зачем нужен gc.buffer?"));
  await expect(dialog.locator(".accordion-body[data-expanded]")).toHaveCount(1);
  await expect(dialog.locator(".accordion-body[data-expanded]")).toContainText("2048");
  await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(brand(page)).toBeFocused();
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
  await activate(brand(page));
  await activate(menu(page).getByRole("button", { name: /О нас/ }));
  const about = page.getByRole("dialog", { name: "О нас" }); await expect(about).toContainText("независимый проект");
  // Test the close control at its painted destination, not while its touch target is still in flight.
  await expect(about).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await activate(about.getByRole("button", { name: "Закрыть окно" })); await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
  await expect(brand(page)).toBeFocused();
  await activate(brand(page));
  await activate(menu(page).getByRole("link", { name: /Вернуться на главную/ }));
  await expect(page).toHaveURL(/\/$/); await expect(page.locator("#rustflow-menu, [data-rf-modal]")).toHaveCount(0);
  await brand(page).focus(); await page.keyboard.press("ArrowDown"); await expect(menu(page).getByRole("link",{name:/Вернуться на главную/})).toBeFocused();
  await page.keyboard.press("End"); await page.keyboard.press("Enter");
  await expect(about).toBeVisible();
  await page.keyboard.press("Escape"); await expect(brand(page)).toBeFocused();
});

test("public materials, local login, all PRO controls, private restore and logout", async ({ page }) => {
  await deviceMode(page); await page.goto("/benchmark"); const html = page.locator("html");
  const inkByFinish = new Map<string, string>();
  const fills = new Set<string>();
  const checkFill = async () => {
    const { id, ink, gradient } = await page.evaluate(() => {
      // Compare the real result with the resolved theme, not a second copy
      // of the palette. Wait for all the rendered component scores below.
      const swatch = document.createElement("span");
      Object.assign(swatch.style, { color: "var(--theme-ink)", backgroundImage: "var(--tube-fill)" });
      document.body.append(swatch);
      const css = getComputedStyle(swatch);
      const colors = { id: document.documentElement.dataset.material!, ink: css.color, gradient: css.backgroundImage };
      swatch.remove();
      return colors;
    });
    await expect(page.locator(".balance-score > p strong")).toHaveCSS("color", ink);
    const parts = page.locator(".balance-score dd");
    await expect(parts).toHaveCount(5);
    for (const part of await parts.all()) await expect(part).toHaveCSS("color", ink);
    await expect(page.locator(".upgrade-measure .meter > i").first()).toHaveCSS("background-image", gradient);
    expect(gradient).toContain("linear-gradient");
    expect(inkByFinish.get(ink), `${id}: distinct score ink ${ink}`).toBeUndefined();
    expect(fills.has(gradient), `${id}: distinct upgrade gradient`).toBe(false);
    inkByFinish.set(ink, id);
    fills.add(gradient);
  };
  await collection(page);
  const themes = settings(page).getByRole("group", { name: "Темы оформления" });
  await expect(themes.getByRole("button")).toHaveCount(10);
  await expect(themes.getByRole("button", { name: /войти для разблокировки/ })).toHaveCount(4);
  await expect(settings(page).getByText(PRO_TEASER)).toBeVisible();
  for (const [name, id] of [["Янтарный закат", "amber"], ["Кибер-Рубин", "ruby"], ["Изумрудный Токсик", "emerald"], ["Оригинальные цвета Rust", "rust"], ["Полный Liquid", "liquid"], ["Светлый перламутр", "pearl"]]) {
    await activate(themes.getByRole("button", { name: new RegExp(name) })); await expect(html).toHaveAttribute("data-material", id); await checkFill();
  }
  await page.reload(); await expect(html).toHaveAttribute("data-theme", "light"); await expect(html).toHaveCSS("--ink", "#121316");
  const anchor = (await page.locator(".profile-trigger").boundingBox())!;await collection(page);
  await activate(themes.getByRole("button", { name: /Королевский аметист/ }));
  const panel = profile(page); await expect(panel.getByText(PRO_TEASER)).toBeVisible();
  await expect(panel.getByRole("slider")).toHaveCount(0);
  await expect.poll(async () => { const p = (await panel.boundingBox())!; return Math.max(Math.abs(p.x+p.width-anchor.x-anchor.width),Math.abs(p.y-anchor.y-anchor.height-10)); }).toBeLessThan(1.5);
  // A new local login has no cloud username/length restriction. A returning
  // login still requires its own password, and no plaintext goes to storage.
  await panel.getByLabel("Логин или email").fill("Я"); await panel.getByLabel("Пароль", { exact: true }).fill("X");
  await activate(panel.getByRole("button", { name: "Войти", exact: true }));
  await expect(panel.getByRole("heading", { name: "Статистика аккаунта" })).toBeVisible();
  await expect(panel.getByText("Кастомизация сайта (PRO)")).toHaveCount(0);
  await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0);
  const studio = settings(page).getByRole("radio", { name: "Стекло и обои" }); await activate(studio);
  const optics = settings(page);
  const blur = optics.getByRole("slider", { name: /Сила размытия/ }), shine = optics.getByRole("slider", { name: /Яркость/ });
  await blur.focus(); await page.keyboard.press("End"); await shine.focus(); await page.keyboard.press("Home");
  await expect(blur).toHaveValue("40"); await expect(shine).toHaveValue("20");
  await expect(blur).toHaveCSS("--fill", "100%"); await expect(shine).toHaveCSS("--fill", "0%");
  if (test.info().project.use.hasTouch) {
    const excess = await optics.locator(".dialog-scroll").evaluate(el => { el.scrollTop = el.scrollHeight; return el.scrollHeight - el.clientHeight - el.scrollTop; });
    expect(Math.abs(excess)).toBeLessThanOrEqual(1);
  }
  await expect(page.locator(".studio-slide")).toHaveCSS("backdrop-filter", materialOptics(40,"pane"));
  await expect(html).toHaveCSS("--rf-shine", "0.2");
  await activate(optics.getByRole("radio", { name: "Ультра-плавные пружины" })); await expect(html).toHaveAttribute("data-engine-motion", "spring");
  await activate(optics.getByRole("radio", { name: "Активное слияние капель" })); await expect(page.locator(".wallpaper-scene")).toHaveAttribute("data-playback", "fusion");
  await activate(optics.getByRole("radio", { name: "Киберспорт (мгновенный отклик)" }));
  await expect(html).toHaveAttribute("data-wallpaper", "fusion");
  await expect(page.locator(".wallpaper-scene")).toHaveAttribute("data-playback", "still");
  await activate(optics.getByRole("radio", {name:"Стандарт (120 Гц)"}));
  await expect(page.locator(".wallpaper-scene")).toHaveAttribute("data-playback", "fusion");
  await activate(optics.getByRole("radio", { name: "Статичный фон" })); await expect(page.locator(".wallpaper-scene")).toHaveAttribute("data-playback", "still");
  await activate(optics.getByRole("radio", { name: "Киберспорт (мгновенный отклик)" }));
  await expect(optics.getByText("Тема оформления", { exact: true })).toHaveCount(0);
  await activate(settings(page).getByRole("radio",{name:"Темы оформления"}));
  for (const [name,id] of [["Арктический лед", "ice"], ["Графитовый стелс", "obsidian"], ["Золотой слиток", "gold"], ["Королевский аметист", "amethyst"]]) {
    await activate(themes.getByRole("button", { name: new RegExp(name) })); await expect(html).toHaveAttribute("data-material", id); await checkFill();
  }
  await page.reload(); await expect(html).toHaveAttribute("data-material", "amethyst"); await expect(html).toHaveAttribute("data-engine-motion", "instant");
  await expect(html).toHaveCSS("--rf-blur", "40px"); await expect(html).toHaveAttribute("data-wallpaper", "still");
  await activate(page.getByRole("button", { name: /^Профиль:/ })); await activate(panel.getByRole("button", { name: "Выйти из аккаунта" }));
  await expect(html).toHaveAttribute("data-material", "pearl"); await expect(html).toHaveCSS("--rf-blur", "28px");
  await expect(panel.getByText(PRO_TEASER)).toBeVisible();
  await panel.getByLabel("Логин или email").fill("Я"); await panel.getByLabel("Пароль", { exact: true }).fill("not-the-password");
  await activate(panel.getByRole("button", { name: "Войти", exact: true })); await expect(panel.getByRole("alert")).toContainText("Неверный");
  await panel.getByLabel("Пароль", { exact: true }).fill("X"); await activate(panel.getByRole("button", { name: "Войти", exact: true }));
  await expect(html).toHaveAttribute("data-material", "amethyst"); await page.keyboard.press("Escape"); await expect(panel).toHaveCount(0); await collection(page); await activate(studio); await expect(shine).toHaveValue("20");
  await activate(optics.getByRole("button", { name: "Вернуть по умолчанию" })); await expect(blur).toHaveValue("28"); await expect(shine).toHaveValue("100");
  const hash = await page.evaluate(() => JSON.parse(localStorage.getItem("rf.local-accounts.v1")!).accounts[0].hash);
  expect(hash).toMatch(/^\$2b\$/);
});

test("one-click demo is persistent, separate from password registration, and grants no server session", async ({ page }) => {
  await deviceMode(page); await page.goto("/");
  await activate(page.getByRole("button", { name: "Профиль", exact: true })); const panel = profile(page);
  await activate(panel.getByRole("radio", { name: "Регистрация" }));
  await panel.getByLabel("Логин или email").fill("Локальная сборка"); await panel.getByLabel("Пароль", { exact: true }).fill("test");
  await panel.getByLabel("Подтверждение пароля").fill("test"); await activate(panel.getByRole("button", { name: "Создать аккаунт" }));
  await expect(panel.getByRole("heading", { name: "Статистика аккаунта" })).toBeVisible();
  await activate(panel.getByText("Редактировать профиль", { exact:true }));
  await panel.getByLabel("Никнейм").fill("Только парольный профиль"); await activate(panel.getByRole("button",{name:"Сохранить изменения"}));
  await expect(panel.locator(".profile-identity")).toContainText("Только парольный профиль");
  await activate(panel.getByRole("button", { name: "Выйти из аккаунта" }));
  await activate(panel.getByRole("button", { name: /Продолжить через Google.*Демо/ })); await expect(panel).toContainText("Профиль на этом устройстве");
  await expect(panel.locator(".profile-identity")).not.toContainText("Только парольный профиль");
  await activate(panel.getByText("Сохранение и копии",{exact:true}));
  const backup = panel.getByRole("button", { name: "Резервная копия браузера", exact:true }); await activate(backup);
  const nested = page.getByRole("dialog", { name: /Резервная копия профиля/ }); await expect(nested).toBeVisible(); await expectReceded(page);
  await page.keyboard.press("Escape"); await expect(nested).toHaveCount(0); await expectReceded(page); await expect(backup).toBeFocused();
  await page.reload(); await expect(page.getByRole("button", { name: "Профиль: Игрок RustFlow" })).toBeVisible();
  await expect(page.locator("html")).toHaveCSS("--rf-blur", "28px");
  expect((await page.context().cookies()).some(c => c.name.includes("rustflow-session"))).toBe(false);
  expect((await page.request.get("/api/pack")).status()).toBe(401);
  expect((await page.request.put("/api/auth/active-build", { headers: { Origin: new URL(page.url()).origin }, data: {} })).status()).toBe(401);
});

test("chrome stays centered with the compact dock, elevates on scroll and pulses on non-dock navigation", async ({ page }) => {
  await page.goto("/");
  const top = page.locator(".nav-capsules"), dock = page.locator(".tabbar-bottom");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const centers = async () => { const [a,b] = await Promise.all([top.boundingBox(),dock.boundingBox()]); return Math.abs((a!.x+a!.width/2)-(b!.x+b!.width/2)); };
  expect((await dock.boundingBox())!.width).toBeLessThanOrEqual(420);
  expect(await centers()).toBeLessThan(1); await expect(dock).toHaveCSS("bottom", "24px");
  const root = page.locator("html"), bands = page.locator(".chrome-veil");
  await expect(bands).toHaveCount(2);
  await expect(page.locator(".route-edge-blur")).toHaveCount(0);
  const atRest = "matrix(1, 0, 0, 1, 0, 0)";
  const calmShadow = await dock.evaluate(el => getComputedStyle(el).boxShadow);
  // Two programmatic jumps in one frame are coalesced into one scroll event.
  // Deliver each sample, just as two painted positions in a gesture would be.
  const jump = (y: number) => page.evaluate(top => new Promise<void>(done => {
    if (scrollY === top) return done();
    window.addEventListener("scroll", () => done(), { once: true });
    scrollTo({ top, behavior: "instant" });
  }), y);
  await jump(15);
  await expect(root).toHaveAttribute("data-scrolled", "");
  await expect(root).not.toHaveAttribute("data-scroll-down", "");
  for (const bar of [top, dock]) await expect(bar).toHaveCSS("transform", atRest);
  await jump(16);
  await expect(root).toHaveAttribute("data-scroll-down", "");
  await expect(top).toHaveCSS("transform", "matrix(1.035, 0, 0, 1.035, 0, -4)");
  await expect(dock).toHaveCSS("transform", "matrix(1.035, 0, 0, 1.035, 0, 3)");
  await expect(dock).toHaveCSS("backdrop-filter", materialOptics(28,"rail"));
  await expect.poll(centers).toBeLessThan(1);
  for (const band of await bands.all()) {
    await expect(band).toHaveCSS("backdrop-filter", "blur(16px)");
    await expect(band).toHaveCSS("mask-image", /linear-gradient/);
    await expect(band).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(band).toHaveCSS("pointer-events", "none");
  }
  await jump(300);
  // The first reverse delta, not crossing the threshold again, starts release.
  if (test.info().project.use.hasTouch) await jump(298);
  else await page.mouse.wheel(0, -2);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(298);
  await expect(root).not.toHaveAttribute("data-scroll-down", "");
  for (const bar of [top, dock]) {
    await expect(bar).toHaveCSS("transition-duration", /^0\.36s/);
    await expect(bar).toHaveCSS("transition-timing-function", /^cubic-bezier\(0\.22, 1, 0\.36, 1\)/);
    await expect(bar).toHaveCSS("transform", atRest);
  }
  await expect(dock).toHaveCSS("box-shadow", calmShadow);
  for (const band of await bands.all()) await expect(band).toHaveCSS("backdrop-filter", "blur(8px)");
  const capture = await page.evaluateHandle(() => ({ phases: new Promise<boolean[]>(resolve => window.addEventListener("rustflow:chrome-pulse", () => queueMicrotask(() => {
    resolve([...document.querySelectorAll("[data-chrome-panel]")].map(el => el.getAnimations().some(a => {
      if (!(a.effect instanceof KeyframeEffect) || a.effect.getTiming().duration !== 350) return false;
      return a.effect.getKeyframes().some(k => k.offset === .42 && (k.scale === "1.045" || Number(k.opacity) === 1));
    })));
  }), { once:true })) }));
  await activate(page.locator('.home-steps a').first());
  await expect(page).toHaveURL(/\/benchmark#build-config$/); expect(await capture.evaluate(v => v.phases)).toEqual([true,true,true,true,true]); await capture.dispose();
});

test("a filter lens previews without selecting; touch and keyboard still commit", async ({ page }, info) => {
  await page.goto("/presets"); const rail = page.getByRole("radiogroup", { name: "Фильтр по разрешению" });
  const all = rail.getByRole("radio", { name: /Все ·/ }), custom = rail.getByRole("radio", { name: "Своё" });
  if (!info.project.use.hasTouch) {
    await custom.hover(); await expect(custom).toHaveAttribute("data-lens-target", ""); await expect(all).toHaveAttribute("aria-checked", "true");
    const gap = (item: Locator) => item.evaluate(el => { const a = el.getBoundingClientRect(), b = el.parentElement!.querySelector(".liquid-lens")!.getBoundingClientRect(); return Math.abs(a.x+a.width/2-b.x-b.width/2); });
    await expect.poll(() => gap(custom)).toBeLessThan(1);
    await page.mouse.move(1,1); await expect.poll(() => gap(all)).toBeLessThan(1);
  }
  await activate(custom); await expect(rail.getByRole("radio", { checked:true })).toHaveText("Своё"); await custom.focus(); await page.keyboard.press("Home");
  await expect(all).toBeFocused(); await expect(all).toHaveAttribute("aria-checked", "true");
  const grid = page.getByRole("radiogroup", { name: "Графика всех пресетов" });
  const selected = grid.getByRole("radio", { checked: true });
  const other = grid.getByRole("radio", { checked: false }).last();
  if (!info.project.use.hasTouch) {
    await page.setViewportSize({ width: 480, height: 820 }); // Preview across rows, not just horizontally.
    await other.hover(); await expect(other).toHaveAttribute("data-lens-target", "");
    await expect(other).toHaveAttribute("aria-checked", "false");
    await page.mouse.move(1,1); await expect(selected).toHaveAttribute("data-lens-target", "");
  }
  const next = (await other.textContent())!;
  await activate(other); await expect(selected).toHaveText(next);
});


test("the public library is responsive before session lookup; hovering tiles never unlocks them", async ({ page }, info) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/auth/session", async r => {
    await held;
    await r.fulfill({ json: { user: null, admin: false, passwordEnabled: false, googleEnabled: false, secureOrigin: true } });
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await collection(page);
    const ruby = settings(page).getByRole("button", { name: /Кибер-Рубин/ });
    await activate(ruby); await expect(page.locator("html")).toHaveAttribute("data-material", "ruby");
    if (!info.project.use.hasTouch) {
      const ice = settings(page).getByRole("button", { name: /Арктический лед/ });
      await ice.hover(); await expect(ice).toHaveAttribute("data-lens-target", "");
      await expect(ruby).toHaveAttribute("aria-pressed", "true"); await expect(profile(page)).toHaveCount(0);
      await page.mouse.move(1,1); await expect(ruby).toHaveAttribute("data-lens-target", "");
    }
  } finally { release(); }
});
