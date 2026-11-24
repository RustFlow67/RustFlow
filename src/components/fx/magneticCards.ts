import { quietMotion } from "./velocity";

const cards =
  ".info-card,.discovery-item,.category-card,.preset-card:not([aria-busy]),.reading-answer,.glass-hover,.tile-hover,.material-tile,.graphics-picker-cards [data-seg],article.well:has(button[aria-expanded]),[data-magnetic]";
/** One delegated pointer listener. Hit-testing/clicks stay native, including
 * Home's independent CTA. No permanent per-card RAFs or compositing layers. */
export function magneticCards() {
  const fine = matchMedia("(hover:hover) and (pointer:fine)");
  let tile: HTMLElement | null = null,
    box: DOMRect | null = null,
    x = 0,
    y = 0,
    goalX = 0,
    goalY = 0,
    last = 0,
    frame = 0;
  let releaseAnimation: Animation | null = null;
  const reset = (spring: boolean) => {
    cancelAnimationFrame(frame);
    frame = 0;
    if (!tile) return;
    const { translate, rotate } = tile.style;
    if (spring && translate && !quietMotion()) {
      releaseAnimation?.cancel();
      releaseAnimation = tile.animate(
        [
          { translate, rotate },
          { translate: `${-0.12 * x}px ${-0.12 * y}px`, rotate: "0deg", offset: 0.62 },
          { translate: "0px 0px", rotate: "0deg" },
        ],
        { duration: 320, easing: "cubic-bezier(.22,.75,.28,1)" },
      );
    }
    tile.style.removeProperty("translate");
    tile.style.removeProperty("rotate");
    delete tile.dataset.magnet;
    tile = null;
    box = null;
    last = 0;
    x = 0;
    y = 0;
  };
  const paint = (now: number) => {
    frame = 0;
    if (!tile || !tile.isConnected || quietMotion()) {
      reset(false);
      return;
    }
    const k = 1 - Math.exp(-Math.min(100, now - (last || now - 16)) / 68);
    last = now;
    x += (goalX - x) * k;
    y += (goalY - y) * k;
    tile.style.translate = `${x}px ${y}px`;
    tile.style.rotate = `${-y} ${x} 0 ${Math.hypot(x, y) * 0.43}deg`;
    tile.dataset.magnet = "";
    if (Math.hypot(goalX - x, goalY - y) > 0.02) frame = requestAnimationFrame(paint);
    else last = 0;
  };
  let pointerX = 0,
    pointerY = 0;
  const aim = () => {
    if (!tile || !box) return;
    const dx = (2 * (pointerX - box.left)) / Math.max(1, box.width) - 1,
      dy = (2 * (pointerY - box.top)) / Math.max(1, box.height) - 1;
    const limit = 5 / Math.max(1, Math.hypot(dx, dy));
    goalX = dx * limit;
    goalY = dy * limit;
    if (!frame) frame = requestAnimationFrame(paint);
  };
  let moveFrame = 0, scrollFrame = 0;
  let pending: { x: number; y: number; target: EventTarget | null; mouse: boolean } | null = null;
  const move = (e: PointerEvent) => {
    pending = { x: e.clientX, y: e.clientY, target: e.target, mouse: e.pointerType === "mouse" && !e.buttons };
    if (moveFrame) return;
    moveFrame = requestAnimationFrame(() => {
      moveFrame = 0;
      const current = pending;
      if (!current) return;
      pointerX = current.x;
      pointerY = current.y;
      const next = current.mouse && fine.matches && !quietMotion() && current.target instanceof Element
        ? current.target.closest<HTMLElement>(cards) : null;
      if (next !== tile) {
        reset(true);
        tile = next;
        box = tile?.getBoundingClientRect() ?? null;
      }
      aim();
    });
  };
  const stop = () => {
    cancelAnimationFrame(moveFrame); cancelAnimationFrame(scrollFrame);
    moveFrame = 0; scrollFrame = 0; pending = null;
    reset(false);
    releaseAnimation?.cancel();
  };
  // A scroll notification may arrive *after* pointermove for the new layout.
  // Keep following a stationary pointer if its real hit is still this tile;
  // otherwise release. Never leave a translated tile over another control.
  const updateScroll = () => {
    scrollFrame = 0;
    if (!tile) return;
    if (!tile.contains(document.elementFromPoint(pointerX, pointerY))) {
      stop();
      return;
    }
    const r = tile.getBoundingClientRect();
    box = new DOMRect(r.x - x, r.y - y, r.width, r.height);
    aim();
  };
  const scrolled = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); };
  const leave = (e: PointerEvent) => {
    if (!e.relatedTarget) {
      cancelAnimationFrame(moveFrame); moveFrame = 0; pending = null;
      reset(true);
    }
  };
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerout", leave);
  window.addEventListener("scroll", scrolled, { passive: true, capture: true });
  window.addEventListener("blur", stop);
  window.addEventListener("shift:motion-change", stop);
  fine.addEventListener("change", stop);
  document.addEventListener("keydown", stop);
  window.addEventListener("shift:modal-open", stop);
  return () => {
    stop();
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerout", leave);
    window.removeEventListener("scroll", scrolled, true);
    window.removeEventListener("blur", stop);
    window.removeEventListener("shift:motion-change", stop);
    fine.removeEventListener("change", stop);
    document.removeEventListener("keydown", stop);
    window.removeEventListener("shift:modal-open", stop);
  };
}
