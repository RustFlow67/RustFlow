import { expect, test, type Locator, type Page } from "@playwright/test";

const press = (control: Locator) => (test.info().project.use.hasTouch ? control.tap() : control.click());
const release = async (page: Page) => {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(1, 1);
};
const running = (element: Locator) =>
  element.evaluate(
    (el) =>
      el
        .getAnimations({ subtree: true })
        .filter((a) => a instanceof CSSAnimation && a.playState === "running").length,
  );
const frameLength = (figure: Locator) =>
  figure.locator(".frame-trace").evaluate((el) => (el as SVGPathElement).getTotalLength());

test("F1 pauses the glyph and the verified dwell, copies just a command and resumes", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const terminal = page.getByRole("region", { name: "Rust F1 Console · client.cfg" });
  const copies = terminal.getByRole("button", { name: /^Скопировать команду / });
  const current = terminal.locator("li[data-last]"),
    status = terminal.locator(".terminal-status");
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await terminal.evaluate((el) => el.scrollIntoView({ block: "center", behavior: "instant" }));
  await release(page);
  await expect(terminal).toHaveAttribute("data-playback", "playing");
  await page.waitForFunction(() => {
    const a = document.querySelector("[data-writing] .terminal-type")?.getAnimations()[0];
    const progress = a?.effect?.getComputedTiming().progress;
    if (progress == null || progress < 0.04 || progress > 0.65) return false;
    // Take keyboard focus in the same painted frame that we sampled. A
    // cross-process pointer trip can easily outlast a short command on CI.
    const first = [...document.querySelectorAll<HTMLElement>(".terminal-copy")].find((b) => b.offsetWidth)!;
    first.focus({ preventScroll: true });
    return true;
  });
  if (!test.info().project.use.hasTouch) {
    await terminal.locator(".terminal-bar").hover();
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur()); // only the real hover now holds it
  }
  await terminal.evaluate((el) =>
    Promise.all(el.getAnimations({ subtree: true }).map((a) => a.ready)).then(() => undefined),
  );
  await expect(status).toHaveText("Writing...");
  await expect(current.locator(".terminal-reply")).toBeHidden();
  await expect.poll(() => running(terminal)).toBe(0);
  const typed = await current.locator("code").innerText();
  const glyph = await current.locator("code").evaluate((el) => getComputedStyle(el).transform);
  // Longer than the remaining type time: neither text nor its clock may skip ahead.
  await page.waitForTimeout(1600);
  expect(await current.locator("code").evaluate((el) => getComputedStyle(el).transform)).toBe(glyph);
  await expect(status).toHaveText("Writing...");
  await expect(copies).toHaveCount(test.info().project.use.hasTouch ? 2 : 5);
  await expect(copies.first()).toHaveCSS("opacity", "1");
  const command = await copies.first().locator("..").locator("code").innerText();
  await press(copies.first());
  const notice = page.getByRole("region", { name: "Уведомления" });
  await expect(notice.getByRole("status")).toContainText("Команда скопирована");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(command);
  await notice.getByRole("button", { name: "Закрыть уведомление" }).click();
  await release(page);
  await expect(status).toHaveText("Verified");
  await copies.first().focus();
  await expect(current.locator(".terminal-reply")).toBeVisible();
  await expect(current.locator(".terminal-reply")).toContainText("→");
  await expect.poll(() => running(terminal)).toBe(0);
  await page.waitForTimeout(1750);
  await expect(current.locator("code")).toHaveText(typed);
  // Clipboard permission can be denied in the embedding browser.
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Denied", "NotAllowedError");
        },
      },
    }),
  );
  await press(copies.first());
  await expect(notice.getByRole("alert")).toContainText("Не удалось скопировать");
  await expect(notice.getByRole("status")).toHaveCount(0);
  await release(page);
  await expect(current.locator("code")).not.toHaveText(typed);
});

test("Frame Time is an illustrated themed SVG; visible clocks stop on live policy changes and in a hidden tab", async ({
  page,
}) => {
  await page.goto("/");
  const terminal = page.locator(".rf-terminal"),
    figure = page.getByRole("figure", { name: "Frame Time" });
  await expect(page.locator(".dock-lens[data-positioned]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // On a phone the two regions are stacked. Observe both inside the real viewport.
  await page.evaluate(() => {
    const a = document.querySelector(".rf-terminal")!.getBoundingClientRect(),
      b = document.querySelector(".frame-time")!.getBoundingClientRect();
    scrollBy({ top: (a.bottom + b.top - innerHeight) / 2, behavior: "instant" });
  });
  await release(page);
  await expect(terminal).toHaveAttribute("data-playback", "playing");
  await expect(figure).toHaveAttribute("data-playback", "playing");
  await expect(figure).toContainText("Иллюстрация");
  await expect(figure.locator(".frame-legend > span")).toHaveText([
    "Без оптимизации · фризы",
    "RustFlow · стабильный 1% low",
  ]);
  const length = await frameLength(figure);
  await expect.poll(() => frameLength(figure)).not.toBe(length);
  const stop = figure.locator("stop").last(),
    colour = await stop.evaluate((el) => getComputedStyle(el).stopColor);
  await page.evaluate(() => (document.documentElement.dataset.material = "emerald"));
  await expect(stop).not.toHaveCSS("stop-color", colour);
  expect(
    await stop.evaluate((el) => {
      const chip = document.createElement("i");
      chip.style.color = "var(--theme-accent)";
      document.body.append(chip);
      const ok = getComputedStyle(el).stopColor === getComputedStyle(chip).color;
      chip.remove();
      return ok;
    }),
  ).toBe(true);
  for (const [attr, val] of [
    ["data-engine-motion", "instant"],
    ["data-motion", "reduced"],
    ["data-lite", ""],
  ]) {
    const prior = await page.locator("html").getAttribute(attr);
    await page.evaluate(([key, v]) => document.documentElement.setAttribute(key, v), [attr, val]);
    await expect(terminal).toHaveAttribute("data-playback", "still");
    await expect(terminal.locator(".terminal-status")).toHaveText("Verified");
    await expect(terminal.locator("[data-writing], .terminal-caret")).toHaveCount(0);
    await expect(figure).toHaveAttribute("data-playback", "still");
    await expect(figure.locator("animate")).toHaveCount(0);
    expect(await running(terminal)).toBe(0);
    await page.evaluate(
      ({ key, value }) =>
        value == null
          ? document.documentElement.removeAttribute(key)
          : document.documentElement.setAttribute(key, value),
      { key: attr, value: prior },
    );
    await expect(terminal).toHaveAttribute("data-playback", "playing");
    await expect(figure.locator("animate")).toHaveCount(1);
  }
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(terminal).toHaveAttribute("data-playback", "paused");
  await expect(figure.locator("animate")).toHaveCount(0);
  await expect.poll(() => running(terminal)).toBe(0);
  await page.evaluate(() => {
    Reflect.deleteProperty(document, "hidden");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(figure.locator("animate")).toHaveCount(1);
  await expect.poll(() => running(terminal)).toBeGreaterThan(0);
  await page.evaluate(() => scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await expect(terminal).toHaveAttribute("data-playback", "paused");
  await expect(figure.locator("animate")).toHaveCount(0);
  await page.goto("/presets");
  await expect(page.locator(".plan-strip").getByRole("figure", { name: "Frame Time" })).toHaveCount(1);
  await page.goto("/tweaker");
  await expect(page.locator(".frame-time")).toHaveCount(0);
});

test("the logo menu closes by backdrop, close button or section choice; navigation waits for landing", async ({
  page,
}) => {
  await page.goto("/");
  const brand = page.locator(".nav-brand"),
    panel = page.locator("#rustflow-menu");
  for (const exit of ["backdrop", "close", "link"]) {
    await press(brand);
    await expect(panel).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
    if (exit === "link") {
      // Inspect a frame of the actual exit, not just the eventual URL.
      const closing = await panel.evaluateHandle((el) => ({
        sample: new Promise((resolve) => {
          const changes = new MutationObserver(() => {
            if (el.hasAttribute("data-open")) return;
            changes.disconnect();
            requestAnimationFrame(() =>
              resolve({
                path: location.pathname,
                retained: el.isConnected,
                inert: el.closest<HTMLElement>(".modal-backdrop")!.inert,
                source: el.hasAttribute("data-flip-source"),
              }),
            );
          });
          changes.observe(el, { attributes: true, attributeFilter: ["data-open"] });
        }),
      }));
      await press(panel.getByRole("link", { name: /С чего начать/ }));
      expect(await closing.evaluate((v) => v.sample)).toEqual({
        path: "/",
        retained: true,
        inert: true,
        source: true,
      });
      await closing.dispose();
      await expect(page).toHaveURL(/\/guide$/);
    } else if (exit === "backdrop") {
      const backdrop = page.locator("[data-rf-modal][data-open]");
      if (test.info().project.use.hasTouch) await backdrop.tap({ position: { x: 4, y: 4 } });
      else await backdrop.click({ position: { x: 4, y: 4 } });
    } else await press(panel.getByRole("button", { name: "Закрыть окно" }));
    await expect(panel).toHaveCount(0);
    await expect(page.locator("main")).not.toHaveAttribute("inert", "");
    if (exit !== "link") await expect(brand).toBeFocused();
  }
});
