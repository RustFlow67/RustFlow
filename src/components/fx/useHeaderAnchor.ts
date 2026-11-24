import { useLayoutEffect, type RefObject } from "react";
import { restingRect, type PopupSource } from "./popupGeometry";

const GAP = 10;

// Offset geometry is independent of the HUD's scroll zoom and offscreen exit.
// Use it only to follow layout changes *after* measuring the painted button.
function layoutEdges(button: HTMLElement) {
  let left = 0,
    top = 0;
  for (let el: HTMLElement | null = button; el; el = el.offsetParent as HTMLElement | null) {
    left += el.offsetLeft;
    top += el.offsetTop;
    if (getComputedStyle(el).position === "fixed") break;
  }
  return {
    left,
    right: left + button.offsetWidth,
    bottom: top + button.offsetHeight,
  };
}

/** Pin the portal's stationary slot, not the transforming dialog. Take the
 * direct trigger's click rect before enterDepth moves the HUD. A nested lock
 * still opens at the profile corner but keeps its own FLIP/focus source. */
export function useHeaderAnchor(
  anchor: RefObject<HTMLElement | null> | undefined,
  slot: RefObject<HTMLElement | null>,
  side: "left" | "right",
  open: boolean,
  source?: RefObject<PopupSource>,
) {
  useLayoutEffect(() => {
    const button = anchor?.current,
      shell = slot.current;
    if (!open || !button || !shell) return;
    const hud = button.closest<HTMLElement>('[data-hud="top"]');
    const initial = layoutEdges(button);
    const pressed = source?.current;
    const direct = pressed?.node === button;
    const painted = direct ? pressed.rect : button.getBoundingClientRect();
    // A real click can arrive before the returning HUD is fully opaque.
    // Keep that exact rect. Only a hidden/programmatic invoker needs its
    // resting geometry, not its position halfway offscreen.
    const visible =
      !hud || (!hud.inert && painted.bottom > 0 && (direct || Number(getComputedStyle(hud).opacity) > 0.99));
    const rect = visible ? painted : restingRect(button);
    let keepPress = true;
    const vp = window.visualViewport;
    const align = () => {
      const layout = layoutEdges(button);
      if (layout[side] !== initial[side] || layout.bottom !== initial.bottom) keepPress = false;
      // A resized/rearranged toolbar has a new home; don't carry the old
      // scroll-zoom offset across a breakpoint or a change of Dock position.
      const edge = keepPress ? rect : hud?.hasAttribute("data-source-pinned") ? button.getBoundingClientRect() : restingRect(button);
      const left = vp?.offsetLeft ?? 0,
        right = left + (vp?.width ?? document.documentElement.clientWidth);
      const viewportTop = vp?.offsetTop ?? 0;
      const top = Math.max(viewportTop, edge.bottom + GAP);
      const x = Math.max(left, Math.min(right, edge[side]));
      shell.style.setProperty(
        "--anchor-inset",
        `${side === "left" ? x : document.documentElement.clientWidth - x}px`,
      );
      shell.style.setProperty("--anchor-width", `${side === "left" ? right - x : x - left}px`);
      shell.style.setProperty("--anchor-top", `${top}px`);
      shell.style.setProperty(
        "--anchor-room",
        `${Math.max(0, viewportTop + (vp?.height ?? innerHeight) - top)}px`,
      );
    };
    align();
    const sizes = new ResizeObserver(align);
    sizes.observe(button);
    if (hud) {
      sizes.observe(hud);
      for (const sibling of hud.querySelectorAll("[data-chrome-panel]")) sizes.observe(sibling);
    }
    window.addEventListener("shift:dock-layout", align);
    window.addEventListener("resize", align);
    vp?.addEventListener("resize", align);
    let scrollFrame = 0;
    const onScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; align(); }); };
    vp?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      sizes.disconnect();
      window.removeEventListener("shift:dock-layout", align);
      window.removeEventListener("resize", align);
      vp?.removeEventListener("resize", align);
      cancelAnimationFrame(scrollFrame);
      vp?.removeEventListener("scroll", onScroll);
    };
  }, [anchor, slot, side, open, source]);
}
