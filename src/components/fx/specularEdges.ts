import { quietMotion } from "./velocity";

/** One delegated listener and at most one pending frame for the hovered card. */
export function specularEdges() {
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const selector = ".info-card,.preset-card,.category-card,.reading-card,.discovery-item,.glass-hover,.tile-hover,[data-rf-card]";
  let card: HTMLElement | null = null;
  let pending: { target: EventTarget | null; x: number; y: number; mouse: boolean } | null = null;
  let frame = 0;
  function reset() {
    if (card) {
      card.style.removeProperty("--spec-x");
      card.style.removeProperty("--spec-y");
    }
    card = null;
  }
  function update() {
    frame = 0;
    const point = pending;
    if (!point || !point.mouse || !fine.matches || quietMotion() || !(point.target instanceof Element)) { reset(); return; }
    const next = point.target.closest<HTMLElement>(selector);
    if (next !== card) { reset(); card = next; }
    if (!card) return;
    const rect = card.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    card.style.setProperty("--spec-x", `${Math.max(0, Math.min(100, (point.x - rect.left) / rect.width * 100))}%`);
    card.style.setProperty("--spec-y", `${Math.max(0, Math.min(100, (point.y - rect.top) / rect.height * 100))}%`);
  }
  function move(event: PointerEvent) {
    pending = { target: event.target, x: event.clientX, y: event.clientY, mouse: event.pointerType === "mouse" && !event.buttons };
    if (!frame) frame = requestAnimationFrame(update);
  }
  function stop() { cancelAnimationFrame(frame); frame = 0; pending = null; reset(); }
  function leave(event: PointerEvent) { if (!event.relatedTarget) stop(); }
  document.addEventListener("pointermove", move, { passive: true });
  document.addEventListener("pointerout", leave);
  document.addEventListener("scroll", stop, { passive: true, capture: true });
  window.addEventListener("blur", stop);
  window.addEventListener("shift:motion-change", stop);
  fine.addEventListener("change", stop);
  return () => {
    stop();
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerout", leave);
    document.removeEventListener("scroll", stop, true);
    window.removeEventListener("blur", stop);
    window.removeEventListener("shift:motion-change", stop);
    fine.removeEventListener("change", stop);
  };
}
