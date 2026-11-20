import { optics } from "./material-optics";
import { expect, test, type Locator } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { MATERIALS } from "@/lib/materials";
import { DOCK_KEY } from "@/lib/dock-position";

const press = (c: Locator) => (test.info().project.use.hasTouch ? c.tap() : c.click());
const insightName = "Посмотреть ИИ-сводку ✨";

for (const position of ["left", "bottom"] as const)
  test(`54px HUD, focus and hit-testing in every finish: ${position}`, async ({ page }) => {
    test.setTimeout(150000);
    await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [DOCK_KEY, position]);
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        json: { user: null, admin: false, secureOrigin: true, passwordEnabled: false, googleEnabled: false },
      }),
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/benchmark");
    const gear = page.getByRole("button", { name: "Настройки", exact: true }),
      profile = page.locator(".profile-trigger"),
      bar = page.locator(".tabbar-bottom"),
      studio = page.getByRole("dialog", { name: "Настройки", exact: true });
    await press(profile);
    const account = page.getByRole("dialog", { name: "Профиль игрока" });
    await press(account.getByRole("button", { name: /Продолжить через Google/ }));
    await expect(account.locator(".cabinet-widgets")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(account).toHaveCount(0);
    await expect(profile).toHaveAccessibleName("Профиль: Игрок RustFlow");
    for (const theme of MATERIALS) {
      await test.step(theme.id, async () => {
        await press(gear);
        await press(studio.getByRole("radio", { name: "Темы оформления" }));
        const choice = studio
          .getByRole("group", { name: "Темы оформления" })
          .getByRole("button", { name: theme.name, exact: false });
        await press(choice);
        await expect(page.locator("html")).toHaveAttribute("data-material", theme.id);
        await expect(studio).toHaveCSS("backdrop-filter", "none"); // ink is not a second glass surface
        await expect(page.locator("[data-island-bed] .island-skin")).toHaveCSS("backdrop-filter", optics(28,"pane"));
        await expect(page.locator("main")).toHaveAttribute("inert", "");
        await expect(bar).toHaveCSS("pointer-events", "none");
        await page.keyboard.press("Escape");
        await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
        await expect(gear).toBeFocused();
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await expect(page.locator("html")).not.toHaveAttribute("data-scrolled", "");
        await page.evaluate(() => scrollTo({ top: 130, behavior: "instant" }));
        await expect(page.locator("html")).toHaveAttribute("data-scroll-down", "");
        const shadow = await page.evaluate(() => {
          const sample = document.createElement("span");
          sample.style.boxShadow = "var(--lg-bevel), 0 12px 36px var(--theme-glow)";
          document.body.append(sample);
          const value = getComputedStyle(sample).boxShadow;
          sample.remove();
          return value;
        });
        for (const panel of await page.locator('[data-hud] [data-island-home] .island-skin, .tabbar-bottom:not([data-hud="left"])').all())
          await expect(panel).toHaveCSS("box-shadow", shadow);
        if (position === "left") {
          await expect(page.locator(".chrome-veil-bottom")).toBeHidden();
          await expect(bar).not.toHaveCSS("box-shadow", shadow);
        }
        const name = profile.locator(".truncate"),
          avatar = profile.locator(".profile-avatar");
        for (const node of [name, avatar]) {
          await expect(node).toHaveCSS("color", "rgb(255, 255, 255)");
          await expect(profile.locator("[data-island-ink]")).toHaveCSS("z-index", "2");
        }
        const geometry = () =>
          page.evaluate((position) => {
            const el = (s: string) => document.querySelector<HTMLElement>(s)!;
            const pills = [".nav-brand", ".studio-trigger", ".assistant-trigger", ".profile-trigger"].map(el),
              dock = el(".tabbar-bottom");
            const rs = pills.map((a) => a.getBoundingClientRect());
            const hits = [...pills, el('.tabbar-bottom [aria-current="page"]')].map((n) => {
              const r = n.getBoundingClientRect();
              return n.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            });
            return {
              // The layout hit targets stay 54px; scroll zoom changes their painted size.
              size:
                pills.every((p) => p.offsetHeight === 54) &&
                rs.every((r) => Math.abs(r.height - 54 * 1.035) < 0.25) &&
                [rs[1],rs[2]].every(r => Math.abs(r.width - 54 * 1.035) < 0.25) &&
                (position !== "left" || Math.abs(dock.getBoundingClientRect().width - 54) < 0.25),
              oneLine: rs.every((r) => Math.abs(rs[0].top - r.top) < 0.25),
              separated:rs.slice(1).every((r,i) => r.left > rs[i].right),
              radius:pills.every((n)=>getComputedStyle(n).borderTopLeftRadius === (n.dataset.islandButton === "round" ? "50%" : "27px")) && getComputedStyle(dock).borderRadius==="9999px" && getComputedStyle(el(".dock-lens")).borderRadius==="9999px",
              hits: hits.every(Boolean),
              fits: document.documentElement.scrollWidth <= innerWidth,
            };
          }, position);
        await expect
          .poll(geometry)
          .toEqual({ size: true, oneLine: true, separated: true, radius: true, hits: true, fits: true });
        const radar = page.getByRole("group", { name: /Радар оценок/ });
        for (const layer of [radar, radar.locator("..")]) {
          await expect(layer).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
          await expect(layer).toHaveCSS("background-image", "none");
          await expect(layer).toHaveCSS("backdrop-filter", "none");
          await expect(layer).toHaveCSS("border-top-width", "0px");
        }
        await expect(radar.locator("..")).toHaveCSS("margin-top", "16px");
        const scores=page.locator(".balance-score dd");await expect(scores).toHaveCount(5);
        const ink=await page.locator(".balance-score").evaluate(el=>{const swatch=document.createElement("span");swatch.style.color="var(--theme-ink)";el.append(swatch);const c=getComputedStyle(swatch).color;swatch.remove();return c});
        await expect(scores.first()).toHaveCSS("color",ink);
        if(position==="bottom")await expect(bar).toHaveCSS("padding","4px");
      });
    }
    // The HUD is usable again, not just visible above the page.
    await press(page.getByRole("button", { name: "Меню RustFlow" }));
    await press(page.locator("#rustflow-menu").getByRole("link", { name: /Мифы и EAC/ }));
    await expect(page).toHaveURL(/\/faq$/);
    expect(errors).toEqual([]);
  });

test("new player route, actual Cyrillic display face and downloadable preset", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".rf-home-hero + .system-plan + .home-journey h2")).toHaveText(
    "Как настроить Rust за 3 простых шага",
  );
  await expect(page.locator("main .btn-primary")).toHaveText("Начать с трёх шагов");
  const setup = page.locator(".system-plan .plan-actions a");
  await expect(setup).toHaveCount(2);
  expect(await setup.first().evaluate(e=>getComputedStyle(e).background)).toBe(await setup.last().evaluate(e=>getComputedStyle(e).background));
  const h = page.locator("#home-title");
  await expect(h).toHaveCSS("font-weight", "800");
  await expect(h).toHaveCSS("font-family", /Unbounded/);
  const fonts = await h.evaluate(async (el) => {
    await document.fonts.ready;
    const css = getComputedStyle(el);
    return {
      faces: [...document.fonts]
        .filter((f) => f.family.includes("Unbounded") && f.status === "loaded")
        .map((f) => f.unicodeRange),
      size: parseFloat(css.fontSize),
      line: parseFloat(css.lineHeight) / parseFloat(css.fontSize),
      expected: Math.min(76.8, Math.max(44.8, innerWidth * 0.055)),
    };
  });
  expect(fonts.faces.join(" ")).toMatch(/400-45F/i);
  expect(fonts.size).toBeCloseTo(fonts.expected, 1);
  expect(fonts.line).toBeCloseTo(1.05, 2);
  await expect(h.locator("span").first()).toHaveCSS("background-clip", /text/);
  await expect(h.locator("span").first()).toHaveCSS("filter", /drop-shadow.*drop-shadow/);
  await expect(page.locator(".rf-hero-copy > p")).toHaveCSS("font-family", /Inter Variable/);
  const links = page.locator(".home-steps a");
  expect(await links.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")))).toEqual([
    "/benchmark#build-config",
    "/presets",
    "/tweaker",
  ]);
  await expect(
    page
      .getByRole("region", { name: "Автоподбор по конфигурации" })
      .getByRole("link", { name: /Настроить сборку/ }),
  ).toHaveAttribute("href", "/benchmark#build-config");
  await press(links.nth(1));
  const card = page.locator(".preset-card").first();
  await press(card.getByRole("button", { name: "Детали" }));
  const dialog = page.getByRole("dialog"),
    file = page.waitForEvent("download");
  const expected = await dialog.locator("pre").innerText();
  await press(dialog.getByRole("link", { name: "Скачать client.cfg" }));
  const dl = await file;
  expect(dl.suggestedFilename()).toBe("client.cfg");
  expect((await readFile((await dl.path())!, "utf8")).trim()).toBe(expected.trim());
  expect(expected).toMatch(/^gc\.buffer\s/m);
});

test("reading bodies are not stretched buttons; two independent briefs and focus returns", async ({
  page,
}) => {
  for (const [path, part] of [
    ["/guide#files", "#files"],
    ["/faq#myths", "#myths"],
  ]) {
    await page.goto(path);
    const card = page.locator(`${part} .reading-card`).first(),
      title = card.getByRole("heading"),
      btn = card.getByRole("button", { name: /Подробнее:/ });
    await title.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
    await press(title);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await btn.boundingBox())!.width).toBeLessThan((await card.boundingBox())!.width * 0.8);
    await expect(btn.locator(".island-skin")).toHaveCSS("box-shadow", /inset/);
    await press(btn);
    await expect(page.getByRole("dialog")).toHaveAccessibleName(await title.innerText());
    await page.keyboard.press("Escape");
    await expect(btn).toBeFocused();
    await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
  }
});

test("a sourced report lands its borrowed skin; content fades first and the scrim releases immediately", async ({ page }) => {
  const buttonName = insightName, dialogName = "ИИ-сводка вашей сборки";
  await page.goto("/benchmark");
  await page.evaluate(() => document.fonts.ready); // Auto-width trigger settles with the webfont.
  const trigger = page.getByRole("button", { name: buttonName });
  // Emoji faces can arrive after fonts.ready; only measure a settled trigger.
  let lastBox = "";
  for (let i = 0; i < 20; i++) {
    const b = (await trigger.boundingBox())!;
    const key = [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 4) / 4).join(",");
    if (key === lastBox) break;
    lastBox = key;
    await page.waitForTimeout(250);
  }
  const skin = await trigger.locator(".island-skin").elementHandle();
  await press(trigger);
  const panel = page.getByRole("dialog", { name: dialogName });
  await panel.evaluate((el) => Promise.allSettled(el.getAnimations().map((a) => a.finished)));
  await expect(panel).toHaveAttribute("data-header-motion", "");
  const flight = await panel.evaluate(async (el) => {
    const shell = el.parentElement!.querySelector<HTMLElement>("[data-island-bed] .island-skin")!,
      layer = el.closest<HTMLElement>(".modal-backdrop")!,
      content = el.firstElementChild as HTMLElement;
    (el.querySelector('[aria-label="Закрыть окно"]') as HTMLButtonElement).click();
    await new Promise(requestAnimationFrame);
    const animations = layer.getAnimations({ subtree: true }).filter((a) => a instanceof CSSTransition);
    // Seek the *browser's production transitions*: a headless frame may be
    // slower than 16ms. No timer-based guessing about the middle of a close.
    const width = shell.getAnimations().find((a) => a instanceof CSSTransition && a.transitionProperty === "width")!;
    const fade = document.querySelector<HTMLElement>('[data-island-source="landing"] [data-island-ink]')!.getAnimations().find((a) => a instanceof CSSTransition && a.transitionProperty === "opacity")!;
    const times = [0, 60, 110, 145, 200, 330, 420];
    return {
      duration: Number(width.effect!.getTiming().duration),
      ink: [Number(fade.effect!.getTiming().delay), Number(fade.effect!.getTiming().duration)],
      samples: times.map((t) => {
        for (const a of animations) {
          a.pause();
          a.currentTime = t;
        }
        const r = shell.getBoundingClientRect();
        return {
          coat: Number(getComputedStyle(content).opacity),
          shell: Number(getComputedStyle(shell).opacity),
          rect: [r.x, r.y, r.width, r.height],
          scrim: Number(getComputedStyle(layer, "::before").opacity),
          background: getComputedStyle(el).backgroundColor,
          blocked: document.body.hasAttribute("data-popup-depth") || !layer.inert,
        };
      }),
    };
  });
  expect(flight.duration).toBe(380);
  expect(flight.ink[0]).toBeCloseTo(104.18, 1);
  expect(flight.ink[1]).toBeCloseTo(275.82, 1);
  const samples = flight.samples;
  // Content leaves first across 140ms; the borrowed glass lands, never fades.
  expect(samples[0].coat).toBe(1);
  expect(samples[1].coat).toBeLessThan(1);
  expect(samples[3].coat).toBe(0);
  for (const s of samples) expect(s.shell).toBe(1);
  expect(samples[0].rect).not.toEqual(samples.at(-1)!.rect);
  expect(samples.at(-1)!.rect[2]).toBeLessThan(samples[0].rect[2]);
  expect(samples[1].scrim).toBeLessThan(samples[0].scrim);
  expect(samples[5].scrim).toBe(0); // The independent 260ms scrim exit is done.
  for (const s of samples) {
    expect(s.background).toBe("rgba(0, 0, 0, 0)"); // No opaque second panel.
    expect(s.blocked).toBe(false);
  }
  await expect(trigger).toBeFocused();
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
  expect(await trigger.evaluate((el, original) => el.querySelector(".island-skin") === original, skin)).toBe(true);
  await skin?.dispose();
  // The depth plane restores on the compositor timeline, which headless
  // frame bursts can hold past detach; only measure a settled trigger.
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector(".rf-depth-plane")!).transform === "none",
    null,
    { timeout: 8000 },
  );
  let box = (await trigger.boundingBox())!;
  for (let i = 0; i < 20; i++) {
    const b = (await trigger.boundingBox())!;
    const key = [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 4) / 4).join(",");
    if (key === lastBox) { box = b; break; }
    lastBox = key;
    box = b;
    await page.waitForTimeout(150);
  }
  expect(Math.max(...[box.x, box.y, box.width, box.height].map((n, i) => Math.abs(n - samples.at(-1)!.rect[i])))).toBeLessThan(2.5);
  const left = page.locator("#build-config");
  expect(
    await left.evaluate(
      (el) =>
        el.getBoundingClientRect().bottom - el.querySelector(".build-fields")!.getBoundingClientRect().bottom,
    ),
  ).toBeLessThan(25);
});

test("320px reduced motion: all five compact tabs fit and assistant returns keyboard focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 620 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((key) => localStorage.setItem(key, "top"), DOCK_KEY);
  await page.goto("/drivers");
  await expect(page.locator("html")).toHaveAttribute("data-dock","bottom");
  expect(await page.evaluate(key=>localStorage.getItem(key),DOCK_KEY)).toBe("bottom");
  const nav = page.locator(".tabbar-bottom"),
    active = nav.locator('[aria-current="page"]');
  await expect(nav.locator(".dock-lens[data-positioned]")).toBeVisible();
  expect(await nav.locator(".dock-items").evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);
  await page.evaluate(() => scrollTo({ top: 300, behavior: "instant" }));
  await expect(page.locator("html")).toHaveAttribute("data-scroll-down", "");
  for (const bar of [page.locator(".nav-capsules"), nav])
    await expect(bar).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
  await expect(page.locator(".chrome-veil-top")).toHaveCSS("backdrop-filter", "blur(8px)");
  await expect
    .poll(() =>
      active.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    )
    .toBe(true);
  const chat = page.locator('[data-hud="top"]').getByRole("button", { name: "ИИ-ассистент" });
  await chat.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "ИИ-ассистент RustFlow" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("transition-property", "none");
  expect(
    await dialog.evaluate((el) => el.getAnimations().filter((a) => a instanceof CSSTransition).length),
  ).toBe(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(chat).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("an open hardware summary follows external edits to the same saved rig", async ({ page, context }) => {
  await page.goto("/benchmark");
  await press(page.locator(".advanced-fields > summary"));
  await page.getByLabel("Название профиля").fill("Живая сборка");
  await press(page.getByRole("button", { name: insightName }));
  const summary = page.getByRole("dialog", { name: "ИИ-сводка вашей сборки" });
  await expect(summary).toContainText("Версия Windows не указана");
  const other = await context.newPage();
  await other.goto("/benchmark");
  await press(other.getByRole("combobox", { name: "Версия Windows" }));
  await press(other.getByRole("option", { name: "Windows 11" }));
  await press(other.getByRole("combobox", { name: "Интерфейс и поколение" }));
  await press(other.getByRole("option", { name: "HDD (7200 RPM)" }));
  await other.close();
  await expect(summary).toContainText("В Windows 11 откройте");
  await expect(summary).toContainText("Rust на HDD");
  await expect(summary.getByRole("link", { name: "Подготовить пакет в Твикере ↗" })).toHaveAttribute(
    "href",
    "/tweaker?auto=live",
  );
});
