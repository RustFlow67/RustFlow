import { expect, test, type Page } from "@playwright/test";
import { MATERIALS } from "@/lib/materials";

const frames = (page: Page, count = 6) =>
  page.evaluate(
    (n) =>
      new Promise<void>((resolve) => {
        const tick = () => (--n ? requestAnimationFrame(tick) : resolve());
        requestAnimationFrame(tick);
      }),
    count,
  );

test("the contour fallback moves without input and releases its frame loop when still or hidden", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      value: function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
        return kind === "webgl" ? null : Reflect.apply(original, this, [kind, ...args]);
      },
    });
    const clear = CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect = function (...args) {
      if (this.canvas.closest(".wallpaper-scene"))
        this.canvas.dataset.draws = String(1 + Number(this.canvas.dataset.draws || 0));
      clear.apply(this, args);
    };
  });
  await page.goto("/guide");
  const wall = page.locator(".wallpaper-scene"),
    canvas = wall.locator("canvas").last();
  const draws = async () => Number(await canvas.getAttribute("data-draws"));
  await expect(wall).toHaveAttribute("data-renderer", "contour");
  await expect.poll(draws).toBeGreaterThan(2);
  // Keep the selected wallpaper animated: Instant must cancel the actual
  // drawing clock, not silently replace and forget the user's finish.
  await page.evaluate(() => {
    document.documentElement.dataset.wallpaper = "fusion";
    document.documentElement.dataset.engineMotion = "instant";
  });
  await expect(wall).toHaveAttribute("data-playback", "still");
  await frames(page);
  const instantCount = await draws();
  await frames(page, 12);
  expect(await draws()).toBe(instantCount);
  await page.evaluate(() => { document.documentElement.dataset.engineMotion = "standard"; });
  await expect(wall).toHaveAttribute("data-playback", "fusion");
  await expect.poll(draws).toBeGreaterThan(instantCount + 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(wall).toHaveAttribute("data-playback", "still");
  await frames(page);
  const staticCount = await draws();
  await page.mouse.move(35, 180);
  await page.mouse.move(150, 220);
  await frames(page);
  expect(await draws()).toBe(staticCount);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(draws).toBeGreaterThan(staticCount + 1);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true })));
  await expect(wall).toHaveAttribute("data-playback", "paused");
  const stopped = await draws();
  await frames(page);
  expect(await draws()).toBe(stopped);
  await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
  await expect.poll(draws).toBeGreaterThan(stopped + 1);
  await page.evaluate(() => document.documentElement.toggleAttribute("data-lite", true));
  await expect(wall).toHaveAttribute("data-playback", "still");
  await expect(page.locator("html")).not.toHaveAttribute("data-refraction", "");
  await frames(page);
  const lite = await draws();
  await frames(page);
  expect(await draws()).toBe(lite);
});

test("the actual fragment shader shades ten different finishes, including neutral crystal, and restores a lost context", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 300 });
  await page.addInitScript(() => {
    localStorage.setItem("rustflow:theme", "liquid");
    localStorage.setItem("rustflow:motion", "reduced");
    // Privacy browsers may withhold the driver name. Exercise the actual GPU
    // program even on CI's software GL; no shader or pixel values are mocked.
    const get = WebGLRenderingContext.prototype.getExtension;
    Object.defineProperty(WebGLRenderingContext.prototype, "getExtension", {
      value: function (this: WebGLRenderingContext, ext: string) {
        return ext === "WEBGL_debug_renderer_info" ? null : Reflect.apply(get, this, [ext]);
      },
    });
    const draw = WebGLRenderingContext.prototype.drawArrays;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {
      draw.apply(this, args);
      const canvas = this.canvas;
      if (!(canvas instanceof HTMLCanvasElement) || !canvas.closest(".wallpaper-scene")) return;
      const pixels = new Uint8Array(this.drawingBufferWidth * this.drawingBufferHeight * 4);
      this.readPixels(
        0,
        0,
        this.drawingBufferWidth,
        this.drawingBufferHeight,
        this.RGBA,
        this.UNSIGNED_BYTE,
        pixels,
      );
      let spread = 0,
        min = 255,
        max = 0,
        hash = 2166136261;
      for (let i = 0; i < pixels.length; i += 28) {
        const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
        spread = Math.max(spread, Math.max(r, g, b) - Math.min(r, g, b));
        min = Math.min(min, r);
        max = Math.max(max, r);
        hash = Math.imul(hash ^ ((r << 16) | (g << 8) | b), 16777619);
      }
      canvas.dataset.sample = JSON.stringify({
        finish: document.documentElement.dataset.material,
        hash,
        spread,
        range: max - min,
      });
    };
  });
  await page.goto("/");
  const wall = page.locator(".wallpaper-scene"),
    canvas = wall.locator("canvas").first();
  await expect(wall).toHaveAttribute("data-renderer", /^(contour|webgl)$/);
  test.skip(
    !(await canvas.evaluate((n) => !!(n as HTMLCanvasElement).getContext("webgl"))),
    "WebGL unavailable; the vector path is covered separately",
  );
  await expect(wall).toHaveAttribute("data-renderer", "webgl");
  const hashes = new Set();
  for (const { id } of MATERIALS) {
    await page.evaluate((id) => {
      const r = document.documentElement;
      r.dataset.material = id;
      r.dataset.theme = id === "pearl" ? "light" : "dark";
    }, id);
    await expect(canvas).toHaveAttribute("data-sample", new RegExp(`"finish":"${id}"`));
    const s = JSON.parse((await canvas.getAttribute("data-sample"))!);
    expect(s.range).toBeGreaterThan(25);
    if (id === "liquid") expect(s.spread).toBe(0);
    if (id === "rust") expect(s.spread).toBeGreaterThan(25);
    hashes.add(s.hash);
  }
  expect(hashes.size).toBe(10);
  const loss = await canvas.evaluateHandle((n) =>
    (n as HTMLCanvasElement).getContext("webgl")!.getExtension("WEBGL_lose_context"),
  );
  await loss.evaluate((e) => e!.loseContext());
  await expect(wall).toHaveAttribute("data-renderer", "contour");
  await loss.evaluate((e) => e!.restoreContext());
  await expect(wall).toHaveAttribute("data-renderer", "webgl");
  await expect(wall).toHaveAttribute("data-playback", "still");
  await loss.dispose();
});

// A url() in computed style alone doesn't prove that the renderer sampled the
// map. A misplaced/empty feImage also displaces the *whole* pane by one vector.
test("the shared glass map bends only the bevel and does not split neutral light", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-refraction", "");
  const fixture = await page.evaluateHandle(() => {
    const board = document.createElement("div"),
      lens = document.createElement("div");
    board.style.cssText =
      "position:fixed;inset:0;z-index:20000;background:repeating-linear-gradient(50deg,#222 0 10px,#ddd 10px 20px)";
    lens.style.cssText =
      "position:absolute;left:20px;top:20px;width:280px;height:170px;border-radius:22px;backdrop-filter:blur(1px)";
    board.append(lens);
    document.body.append(board);
    return lens;
  });
  const capture = async () =>
    (await page.screenshot({ clip: { x: 20, y: 20, width: 280, height: 170 }, scale: "css" })).toString(
      "base64",
    );
  const base = await capture();
  await fixture.evaluate((n) => (n.style.backdropFilter = "blur(1px) url(#rf-liquid-pane)"));
  const lit = await capture();
  const [edge, centre, fringe] = await page.evaluate(
    async (shots) => {
      const data = await Promise.all(
        shots.map(async (png) => {
          const image = new Image();
          image.src = "data:image/png;base64," + png;
          await image.decode();
          const canvas = document.createElement("canvas");
          canvas.width = 280;
          canvas.height = 170;
          const c = canvas.getContext("2d")!;
          c.drawImage(image, 0, 0);
          return c.getImageData(0, 0, 280, 170).data;
        }),
      );
      let rim = 0,
        middle = 0,
        count = 0,
        mc = 0,
        chroma = 0;
      for (let y = 2; y < 168; y++)
        for (let x = 2; x < 278; x++) {
          const i = 4 * (y * 280 + x),
            d = Math.min(x, y, 280 - x, 170 - y),
            delta = Math.abs(data[0][i] - data[1][i]);
          if (d < 14) {
            rim += delta;
            count++;
          } else if (d > 32) {
            middle += delta;
            mc++;
          }
          const [r, g, b] = [data[1][i], data[1][i + 1], data[1][i + 2]];
          chroma = Math.max(chroma, Math.max(r, g, b) - Math.min(r, g, b));
        }
      return [rim / count, middle / mc, chroma];
    },
    [base, lit],
  );
  expect(edge).toBeGreaterThan(7);
  expect(centre).toBeLessThan(3);
  expect(fringe).toBeLessThanOrEqual(1);
  await fixture.evaluate((n) => n.parentElement!.remove());
  await fixture.dispose();
});
