import { optics as materialOptics } from "./material-optics";
import { expect, test, type Locator } from "@playwright/test";

import { openHeader } from "./header-anchor";
import { expectReceded } from "./hud";

const activate = (control: Locator) => test.info().project.use.hasTouch ? control.tap() : control.click();

test("synchronized chrome, anchored profile and click-through after dismissal", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  const dock = page.getByRole("navigation", { name: "Основная навигация" });
  await expect(dock.locator("[data-tab]")).toHaveCount(6);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "full");
  await expect(page.locator("main")).toHaveCSS("transform", "none");
  await expect(page.locator("main")).toHaveCSS("filter", "none");
  await expect(page.locator(".rf-page-enter")).toHaveCSS("animation-name", "pageArrival");
  await expect(page.locator(".rf-page-enter")).toHaveCSS("animation-duration", "0.38s");
  const wallpaper = page.locator(".wallpaper-scene");
  await expect(wallpaper).toHaveAttribute("data-renderer", /^(webgl|contour)$/);
  await expect(wallpaper).toHaveAttribute("data-playback", "drift");
  await expect(dock.locator("[data-assistant-trigger]")).toHaveCount(0);
  await expect(wallpaper).toHaveCSS("pointer-events", "none");
  await expect(wallpaper).toHaveCSS("position", "fixed");
  await expect(wallpaper).toHaveCSS("z-index", "0");
  expect(await wallpaper.boundingBox()).toEqual({ x: 0, y: 0, ...page.viewportSize() });

  const profile = page.getByRole("button", { name: "Профиль", exact: true });
  const chat = page.locator('[data-hud="top"]').getByRole("button", { name: "ИИ-ассистент" });
  const profilePanel = page.locator("#rustflow-player-profile");
  const chatPanel = page.locator("#rustflow-assistant-dialog");
  await openHeader(profile, profilePanel, "right");
  await expect(page.locator(".profile-backdrop")).toHaveCSS("z-index", "9999");
  await expectReceded(page);
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
  await expectReceded(page);
  await expect(chatPanel).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".assistant-scrim")).toHaveCSS("pointer-events", "auto");
  await expect(chatPanel).toHaveCSS("overflow-x", "hidden");
  await expect(chatPanel).toHaveCSS("scrollbar-width", "none");
  await expect(page.locator(".assistant-scrim")).toHaveCSS("backdrop-filter", "blur(12px)");
  await activate(chatPanel.getByRole("button", { name: "Свернуть RustFlow Assistant" }));
  await expect(chatPanel).toHaveCount(0);
  await expect(page.locator(".assistant-scrim")).toHaveCount(0);
  await activate(chat);
  await page.locator(".assistant-scrim").click({ position: { x: 4, y: 4 } });
  await expect(chat).toBeFocused();
  await activate(dock.getByRole("link", { name: "Сборка", exact: true }));
  await expect(page).toHaveURL(/\/benchmark$/);
  await expect(chatPanel).toHaveCount(0);
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Ваш компьютер" })).toBeVisible();
  await expect(page.getByText("Определить GPU", { exact: true })).toHaveCount(0);
  await expect(page.locator("#share")).toHaveCount(0);
  await activate(page.getByRole("button", { name: "Видеокарта (GPU)", exact: true }));
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await activate(dock.getByRole("link", { name: "Твикер", exact: true }));
  const category = page.locator(".category-card").first();
  await activate(category);
  await expect(page.getByRole("dialog")).toHaveCSS("transition-duration", "0.38s, 0.38s, 0.38s");
  await expectReceded(page);
  await activate(page.getByRole("button", { name: "Закрыть окно" }));
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
  await expect(category).toBeFocused();
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
  await expect(page.locator(".wallpaper-scene")).toHaveAttribute("data-playback", "still");
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

test("dock lens tracks within a tab, then settles on the selected tab", async ({ page }, info) => {
  await page.goto("/");
  const lens = page.locator(".dock-lens[data-positioned]");
  const center = (node: Locator) => node.evaluate(el => {
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  const tab = page.locator('.nav-item[href="/drivers"]');
  await expect(lens).toHaveCSS("pointer-events", "none");
  await expect(lens).toHaveCSS("transition-property", "all");
  await expect(lens).toHaveCSS("transition-duration", "0.48s");
  await expect(lens).toHaveCSS("transition-timing-function", "cubic-bezier(0.22, 1, 0.36, 1)");
  if (!info.project.use.hasTouch) {
    const { x, y } = await center(tab);
    await page.mouse.move(x - 26, y);
    await expect.poll(async () => (await center(lens)).x).toBeLessThan(x - 3);
    await page.mouse.move(x + 26, y);
    await expect.poll(async () => (await center(lens)).x).toBeGreaterThan(x + 3);
    await expect(tab).toHaveAttribute("data-lens-target", "");
    await page.mouse.move(1, 1);
    const home = await center(page.locator('.nav-item[href="/"]'));
    await expect.poll(async () => Math.abs((await center(lens)).x - home.x)).toBeLessThan(1);
  }
  await activate(tab);
  await expect(tab).toHaveAttribute("aria-current", "page");
  await page.mouse.move(1, 1);
  await expect.poll(async () => { const [p,target] = await Promise.all([center(lens),center(tab)]); return Math.hypot(p.x - target.x, p.y - target.y); }).toBeLessThan(1);
});

test("a new open request reverses an in-flight profile exit", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Профиль", exact: true });
  const panel = page.locator("#rustflow-player-profile");
  await activate(trigger);
  // A close before the very first painted opening frame has no exit distance
  // (and therefore no transitionrun). This test needs a *real* in-flight exit.
  await expect(panel).toHaveCSS("opacity", "1");
  const sameNode = await panel.evaluateHandle(el => el);
  // Use the app's normal external open request on the very first exit frame;
  // a locator.click() on the returning HUD waits for it to settle first.
  await panel.evaluate(el => {
    const reverse = (e: Event) => {
      if (e.target !== el || el.hasAttribute("data-shown")) return;
      el.removeEventListener("transitionrun", reverse);
      window.dispatchEvent(new CustomEvent("rustflow:open-profile", { detail: document.querySelector(".profile-trigger") }));
    };
    el.addEventListener("transitionrun", reverse);
  });
  await activate(panel.getByRole("button", { name: "Закрыть окно" }));
  await expect(panel).toHaveAttribute("data-shown", "");
  await panel.evaluate(el => Promise.allSettled(el.getAnimations().filter(a => a instanceof CSSTransition).map(a => a.finished)));
  expect(await sameNode.evaluate(el => el.isConnected && el.hasAttribute("data-open"))).toBe(true);
  await sameNode.dispose();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.locator(".modal-backdrop")).toHaveCount(0);
});

test("dock navigation commits the requested page and keeps browser history", async ({ page }) => {
  await page.goto("/");
  const dock = page.getByRole("navigation", { name: "Основная навигация" });
  // Check the first real DOM commit, not a later resize/animation callback.
  type Paint = { optics: string[]; roots: string[]; reserved: number; natural: number; scroll: number };
  const firstCommit = await page.evaluateHandle(() => ({ paint: new Promise<Paint>(resolve => {
    const main = document.querySelector("main")!;
    const observer = new MutationObserver(() => {
      const card = main.querySelector(".preset-card");
      if (!card) return;
      observer.disconnect();
      const surface = card.closest<HTMLElement>(".rf-page-enter")!, style = getComputedStyle(surface), optics = getComputedStyle(card);
      const roots: string[] = [];
      for (let el = card.parentElement; el; el = el.parentElement) {
        const s = getComputedStyle(el);
        if (s.filter !== "none" || s.opacity !== "1") roots.push(el.className);
      }
      const reserved = surface.closest<HTMLElement>(".rf-depth-slot")!.offsetHeight, natural = surface.offsetHeight;
      window.scrollTo({ top: 1100, behavior: "instant" });
      resolve({ optics: [style.animationName, optics.backdropFilter, optics.backfaceVisibility, optics.isolation], roots, reserved, natural, scroll: scrollY });
    });
    observer.observe(main, { childList: true, subtree: true });
  }) }));
  await activate(dock.getByRole("link", { name: "Пресеты" }));
  const paint = await firstCommit.evaluate(v => v.paint);
  expect(paint.optics).toEqual(["pageArrival", materialOptics(28, "pane"), "hidden", "isolate"]);
  expect(paint.roots).toEqual([]); expect(paint.reserved).toBe(paint.natural); expect(paint.scroll).toBe(1100);
  await firstCommit.dispose();
  await expect(page.getByRole("heading", { level: 1, name: "43 сборки для Rust" })).toBeVisible();
  await expect(page).toHaveURL(/\/presets$/);
  await activate(page.getByRole("button", { name:"Меню RustFlow" }));
  await activate(page.locator("#rustflow-menu").getByRole("link", { name: /С чего начать/ }));
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("region", { name: "Моя дорожная карта" })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/presets$/);
  await expect(page.locator(".preset-card").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Детали", exact: true })).toHaveCount(43);
  await expect(page.locator("main h1")).toHaveCount(1);
});

test("preset details land on the exact Details button, release focus immediately and recoil", async ({ page }) => {
  await page.goto("/presets");
  await page.evaluate(() => document.fonts.ready); // Auto-width trigger settles with the webfont.
  const id=await page.locator(".preset-card").nth(1).getAttribute("id"), tile=page.locator(`#${id}`);
  const trigger=tile.getByRole("button", {name:"Детали",exact:true});
  // The card grid hydrates and reflows right after load. A landing measured
  // against a moving trigger proves nothing, so wait for grid calm first.
  let last = "";
  for (let i = 0; i < 20; i++) {
    const b = (await trigger.boundingBox())!;
    const key = [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 4) / 4).join(",");
    if (key === last) break;
    last = key;
    await page.waitForTimeout(250);
  }
  const label=await trigger.textContent(); await activate(trigger);
  const panel=page.getByRole("dialog"); await expectReceded(page);
  await panel.evaluate(el=>Promise.allSettled(el.getAnimations().map(a=>a.finished)));
  // The source is never borrowed, hidden or restyled.
  await expect(trigger).toHaveCSS("opacity","1");
  expect(await trigger.textContent()).toBe(label);
  await expect(trigger.locator(".island-skin")).toHaveCount(1);
  await expect(panel).not.toHaveAttribute("data-header-motion");
  const capture=await panel.evaluateHandle(el=>({ landing:new Promise<{rect:number[]; inert:boolean; duration:number; easing:string; exit:number[]; cascade:string[]}>(resolve=>{
    const content=el.firstElementChild as HTMLElement;
    const run=(e:Event)=>{
      if(e.target!==el || (e as TransitionEvent).propertyName!=="transform")return;
      el.removeEventListener("transitionrun",run);
      // Honest FLIP: the panel itself shrinks onto the live button. Project
      // its --from pose and sample the production close cascade.
      const s=getComputedStyle(el), shell=el.parentElement!.getBoundingClientRect(), pane=el as HTMLElement;
      const matrix=new DOMMatrixReadOnly(s.getPropertyValue("--from-transform"));
      const raw=s.getPropertyValue("--from-clip").match(/inset\((.*?) round/)![1].trim().split(/\s+/).map(parseFloat);
      const [t,r,b,l]=raw, right=el.classList.contains("profile-panel"), k=matrix.a;
      const rect=[shell.x+matrix.e+(right?pane.offsetWidth*(1-k):0)+l*k, shell.y+matrix.f+t*k, (pane.offsetWidth-r-l)*k, (pane.offsetHeight-t-b)*k];
      const morph=el.getAnimations().find(a=>a instanceof CSSTransition && a.transitionProperty==="transform")!;
      const coat=content.getAnimations().find(a=>a instanceof CSSTransition && a.transitionProperty==="opacity")!;
      coat.pause(); coat.currentTime=100;
      resolve({rect, duration:Number(morph.effect!.getTiming().duration), easing:String(morph.effect!.getTiming().easing),
        exit:[Number(coat.effect!.getTiming().duration), Number(getComputedStyle(content).opacity)],
        cascade:[s.transitionDuration, s.transitionDelay],
        inert:el.closest<HTMLElement>("[data-rf-modal]")!.inert && getComputedStyle(el).pointerEvents==="none"});
    };el.addEventListener("transitionrun",run);
  })}));
  const recoil=await trigger.evaluateHandle(el=>({bounce:new Promise<string[]>(resolve=>{
    const check=()=>{const f=el.getAnimations().flatMap(a=>(a.effect as KeyframeEffect).getKeyframes()).map(k=>String(k.scale));if(f.includes("1.02"))resolve(f);else requestAnimationFrame(check);};check();
  })}));
  // Opening records a popularity view; its async re-render can reflow the
  // grid under the open dialog. Only close onto a settled trigger.
  last = "";
  for (let i = 0; i < 20; i++) {
    const b = (await trigger.boundingBox())!;
    const key = [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 4) / 4).join(",");
    if (key === last) break;
    last = key;
    await page.waitForTimeout(250);
  }
  await page.keyboard.press("Escape"); const hit=await capture.evaluate(v=>v.landing);
  expect(hit.inert).toBe(true); expect(hit.duration).toBe(340);
  expect(hit.easing).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
  expect(hit.exit).toEqual([100, 0]);
  expect(hit.cascade).toEqual(["0.34s, 0.34s, 0.1s, 0.108s", "0s, 0s, 0.24s, 0s"]);
  await expect(trigger).toBeFocused();
  expect(await recoil.evaluate(v=>v.bounce)).toEqual(expect.arrayContaining(["0.96","1.02","1"]));
  await trigger.evaluate(el=>Promise.allSettled(el.getAnimations({subtree:true}).map(a=>a.finished)));
  await expect.poll(async()=>{const r=(await trigger.boundingBox())!;return Math.max(...[r.x,r.y,r.width,r.height].map((n,i)=>Math.abs(n-hit.rect[i])));}).toBeLessThan(2.5);
  await expect(trigger).toHaveCSS("opacity","1");
  expect(await trigger.textContent()).toBe(label);
  await expect(trigger.locator(".island-skin")).toHaveCount(1);
  await capture.dispose(); await recoil.dispose(); await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
});

test("guest edits survive reload as one build and drive the actual config", async ({ page }) => {
  // A denied clipboard is a supported path; make the real Tweaker render
  // its manual-copy dialog so we can compare the whole file, not one line.
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
    writeText: async () => { throw new DOMException("Denied", "NotAllowedError"); },
  } }));
  await page.goto("/benchmark");
  const form = page.locator("#build-config");
  await expect(form.getByText(/Герцовка монитора|Профиль разгона и BIOS|Сохранить как мою сборку/)).toHaveCount(0);
  const choose = (name: string) => activate(form.getByRole("radio", { name, exact: true }));
  await activate(form.locator(".advanced-fields > summary"));
  await form.getByLabel("Название профиля").fill("Рейд в пятницу");
  await choose("Клан-рейд / 300+ онлайн");
  await choose("Reflex + Boost (Мин. инпут-лаг)");
  await choose("+ Запись откатов / Стрим");
  await choose("4096 МБ");
  await choose("Макс. читаемость врагов (Киберспорт)");
  await page.reload();
  await activate(form.locator(".advanced-fields > summary"));
  await expect(form.getByLabel("Название профиля")).toHaveValue("Рейд в пятницу");
  for (const label of ["Клан-рейд / 300+ онлайн", "Reflex + Boost (Мин. инпут-лаг)", "+ Запись откатов / Стрим", "4096 МБ", "Макс. читаемость врагов (Киберспорт)"]) {
    await expect(form.getByRole("radio", { name: label, exact: true })).toHaveAttribute("aria-checked", "true");
  }
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("rustflow:store:v1")!));
  expect(store.builds).toHaveLength(1);
  expect(store.activeBuildId).toBe(store.builds[0].id);
  await activate(page.getByText("Предпросмотр client.cfg", { exact: true }));
  for (const line of ['gc.buffer "4096"', 'graphics.reflexmode "2"', 'graphics.drawdistance "1200"', 'graphics.shaderlod "200"', 'graphics.shadowdistance "50"'])
    await expect(page.locator("[data-build-cfg]")).toContainText(line);
  const cfg = await page.locator("[data-build-cfg]").innerText();
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog")).toHaveCount(0);
  await activate(page.locator('nav a[href="/tweaker"]'));
  await activate(page.getByRole("button", { name: "Скопировать client.cfg", exact: true }));
  await expect(page.getByRole("textbox", { name: "Команды client.cfg" })).toHaveValue(cfg);
});

test("motion is local, interruptible, and keeps the modal's scroll area usable", async ({ page }, info) => {
  await page.goto("/");
  const dock = page.locator(".tabbar-bottom"), main = page.locator("main");
  await expect(page.locator('.dock-lens[data-positioned]')).toBeVisible();
  await expect(page.locator("svg #velocity-rgb, svg filter feOffset")).toHaveCount(0);
  if (!info.project.use.hasTouch) {
    const gauge = dock.locator('[href="/benchmark"]');
    await gauge.hover();
    await expect.poll(() => gauge.evaluate(el => parseFloat((el as HTMLElement).style.getPropertyValue("--mag")))).toBeCloseTo(1.38, 2);
    const scale = (href: string) => dock.locator(`[href="${href}"]`).evaluate(el => parseFloat((el as HTMLElement).style.getPropertyValue("--mag")));
    expect(await scale("/")).toBeCloseTo(1.18, 2);
    expect(await scale("/tweaker")).toBeCloseTo(1.06, 2);
  }
  // Two navigation intents in one task: only the last destination may push.
  await dock.evaluate(el => { el.querySelector<HTMLElement>('a[href="/tweaker"]')!.click(); el.querySelector<HTMLElement>('a[href="/drivers"]')!.click(); });
  await expect(page).toHaveURL(/\/drivers$/);
  await expect(main.getByRole("heading", { level: 1 })).toHaveText("Драйвер для вашего железа");
  await expect(page.locator('[data-velocity]')).toHaveCount(0);
  const profile = page.getByRole("button", { name: "Профиль", exact: true });
  await activate(profile);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("clip-path", "inset(0px round 28px)");
  await expect(page.locator(".rf-depth-plane")).toHaveCSS("filter", "none");
  await expect(dialog).toHaveCSS("scrollbar-width", "none");
  await expect(dialog).toHaveCSS("overflow-x", "hidden");
  await expect(main).toHaveCSS("transform", "none");
  await expect(main).toHaveCSS("filter", "none");
  await expect(page.locator(".wallpaper-scene")).toHaveCSS("filter", "none");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-velocity], body[data-popup-depth]')).toHaveCount(0);
  await expect(page.locator('.rf-depth-slot')).not.toHaveAttribute('style', /height:/);
  await expect(profile).toBeFocused();
});
