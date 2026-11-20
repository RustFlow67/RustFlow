import { expect, test, type Locator } from "@playwright/test";

const press = (node: Locator) => (test.info().project.use.hasTouch ? node.tap() : node.click());
const settled = (el: Locator) =>
  el.evaluate((e) => Promise.allSettled(e.getAnimations().map((a) => a.finished)));

test("a menu previews a differently sized row and glides back to the current page, not the first row", async ({
  page,
}, info) => {
  await page.goto("/guide");
  await press(page.locator(".nav-brand"));
  const menu = page.getByRole("dialog", { name: "Меню RustFlow" });
  await settled(menu);
  const lens = menu.locator(".liquid-lens[data-positioned]"),
    active = menu.locator('.brand-row[aria-current="page"]'),
    other = menu.getByRole("button", { name: /О нас/ });
  await expect(active).toHaveAttribute("href", "/guide");
  await expect(lens).toHaveCSS("transition-property", "all");
  await expect(lens).toHaveCSS("transition-duration", "0.48s");
  await expect(lens).toHaveCSS("transition-timing-function", "cubic-bezier(0.22, 1, 0.36, 1)");
  if (info.project.use.hasTouch) {
    // A tap's compatibility pointerover is not a persistent mouse preview.
    await active.focus();
    await page.keyboard.press("End");
    await expect(other).toBeFocused();
    await active.dispatchEvent("pointerover", {
      pointerType: "touch",
      bubbles: true,
    });
    await expect(other).toHaveAttribute("data-lens-target", "");
  } else {
    // Unlike the five uniform Dock tabs, this row changes all three dimensions
    // of the glide. Check real transitionrun events on enter *and* leave.
    await other.evaluate((el) =>
      Object.assign((el as HTMLElement).style, {
        width: "76%",
        minHeight: "70px",
      }),
    );
    await active.hover();
    await page.mouse.move(1, 1);
    await expect(active).toHaveAttribute("data-lens-target", "");
    await settled(lens);
    const record = await lens.evaluateHandle((el) => {
      const moves: Record<string, number> = {};
      el.addEventListener("transitionrun", (event) => {
        const e = event as TransitionEvent;
        if (e.target === el && !e.pseudoElement) moves[e.propertyName] = (moves[e.propertyName] ?? 0) + 1;
      });
      return moves;
    });
    const positionError = (row: Locator) =>
      row.evaluate((el) => {
        const a = el.getBoundingClientRect(),
          b = el.closest("nav")!.querySelector(".liquid-lens")!.getBoundingClientRect();
        return Math.max(...(["left", "top", "width", "height"] as const).map((k) => Math.abs(a[k] - b[k])));
      });
    await other.hover();
    await expect(other).toHaveAttribute("data-lens-target", "");
    await expect.poll(() => positionError(other)).toBeLessThan(1.2);
    await settled(lens);
    await expect.poll(() => record.jsonValue()).toMatchObject({ transform: 1, width: 1, height: 1 });
    await expect(active).toHaveAttribute("aria-current", "page");
    await page.mouse.move(1, 1);
    await expect(active).toHaveAttribute("data-lens-target", "");
    await expect.poll(() => positionError(active)).toBeLessThan(1.2);
    await expect.poll(() => record.jsonValue()).toMatchObject({ transform: 2, width: 2, height: 2 });
    await record.dispose();
  }
  await expect(page).toHaveURL(/\/guide$/);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
});

test("an open chat follows a reflowed header; a shorter visual viewport clips neither the slot nor its input", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/benchmark");
  const button = page.locator(".assistant-trigger");
  await press(button);
  const chat = page.getByRole("dialog", { name: "ИИ-ассистент RustFlow" });
  const input = chat.getByLabel("Вопрос помощнику");
  await settled(chat);
  const first = (await chat.boundingBox())!;
  // Desktop Chromium has no OS keyboard; change the actual visualViewport
  // event source without resizing the layout viewport, as a keyboard would.
  await input.focus();
  await page.evaluate(() => {
    const vp = window.visualViewport!;
    Object.defineProperty(vp, "height", { configurable: true, value: 300 });
    vp.dispatchEvent(new Event("resize"));
  });
  await expect
    .poll(async () => {
      const b = (await chat.boundingBox())!;
      return b.y + b.height;
    })
    .toBeLessThanOrEqual(293);
  expect((await chat.boundingBox())!.x).toBe(first.x);
  expect((await chat.boundingBox())!.y).toBe(first.y);
  await input.scrollIntoViewIfNeeded();
  await input.fill("Черновик");
  const field = (await input.boundingBox())!;
  expect(field.y + field.height).toBeLessThan(301);
  expect(field.x).toBeGreaterThanOrEqual(first.x);
  await page.evaluate(() => {
    const vp = window.visualViewport!;
    Reflect.deleteProperty(vp, "height");
    vp.dispatchEvent(new Event("resize"));
  });
  await page.setViewportSize({ width: 900, height: 560 });
  await expect.poll(async () => (await chat.boundingBox())!.width).toBeGreaterThan(first.width + 50);
  const reflowed = (await chat.boundingBox())!;
  await expect(input).toHaveValue("Черновик");
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-rf-assistant]")).toHaveCount(0);
  await expect(button).toBeFocused();
  await settled(button);
  const current = (await button.boundingBox())!;
  expect(Math.abs(reflowed.x - current.x)).toBeLessThan(1.5);
  expect(Math.abs(reflowed.y - current.y - current.height - 10)).toBeLessThan(1.5);
});

test("the studio panel lands on the live gear; the source button is never touched", async ({page}) => {
  await page.goto("/");
  const gear = page.locator(".studio-trigger"), label = await gear.textContent();
  await press(gear);
  const panel = page.getByRole("dialog",{name:"Настройки",exact:true});
  await settled(panel);
  await expect(gear).toHaveCSS("opacity", "1");
  expect(await gear.textContent()).toBe(label);
  // Frame-independent capture: headless can stall frame production with the
  // close transitions created but frozen at 0 and transitionrun never
  // dispatched. Poll on wall timers; getAnimations() forces the recalc that
  // creates the transitions once React flushes the close render.
  const mid = await panel.evaluate(async (el) => {
    (el.querySelector('[aria-label="Закрыть окно"]') as HTMLButtonElement).click();
    for (let i = 0; i < 50 && !el.getAnimations().some((a) => a instanceof CSSTransition && a.transitionProperty === "transform"); i++)
      await new Promise((r) => setTimeout(r, 20));
    const anim = el.getAnimations().find((a) => a instanceof CSSTransition && a.transitionProperty === "transform") as CSSTransition;
    const s = getComputedStyle(el);
    return {
      duration: Number(anim.effect!.getTiming().duration),
      easing: String(anim.effect!.getTiming().easing),
      cascade: [s.transitionDuration, s.transitionDelay],
      glass: s.backgroundImage,
      inert: el.closest<HTMLElement>(".modal-backdrop")!.inert,
    };
  });
  expect(mid.duration).toBe(340); expect(mid.easing).toBe("cubic-bezier(0.32, 0.72, 0, 1)");
  expect(mid.cascade).toEqual(["0.34s, 0.34s, 0.1s, 0.108s", "0s, 0s, 0.24s, 0s"]);
  expect(mid.glass).not.toBe("none"); expect(mid.inert).toBe(true);
  await expect(page.locator("[data-rf-modal]")).toHaveCount(0);
  await expect(gear).toHaveCSS("opacity", "1");
  expect(await gear.textContent()).toBe(label);
  await expect(gear.locator(".island-skin")).toHaveCount(1);
  await expect(gear).toBeFocused();
});
