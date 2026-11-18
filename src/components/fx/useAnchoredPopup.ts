"use client";

import { useLayoutEffect, useRef, useState, type RefObject } from "react";

/** CSS does the spring. Keep only its inert exit frame, never a dormant overlay. */
export function useAnchoredPopup<T extends HTMLElement>(open: boolean, anchor?: RefObject<HTMLElement | null>) {
  const panelRef = useRef<T>(null);
  const [retained, setRetained] = useState(false);
  if (open && anchor && !retained) setRetained(true);
  const present = open || retained;

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!present || !panel || !anchor) return;
    // Measure the untransformed positioning wrapper, not the animating surface.
    const frame = panel.parentElement?.getBoundingClientRect();
    const from = anchor.current?.isConnected ? anchor.current.getBoundingClientRect() : null;
    if (frame?.width && frame.height && from?.width && from.height) {
      panel.style.setProperty("--popup-x", `${from.left + from.width / 2 - frame.left - frame.width / 2}px`);
      panel.style.setProperty("--popup-y", `${from.top + from.height / 2 - frame.top - frame.height / 2}px`);
      panel.style.setProperty("--popup-scale", String(Math.min(1, from.width / frame.width, from.height / frame.height)));
    }
    // Do not tween the initial measurement from the CSS fallback pose. Install the
    // transition only after the real source pose is committed; later toggles can reverse it.
    if (open && !panel.hasAttribute("data-ready")) {
      panel.getBoundingClientRect();
      panel.setAttribute("data-ready", "");
    }
    panel.toggleAttribute("data-shown", open);
    if (open) return;

    let cancelled = false;
    const remove = () => { if (!cancelled) setRetained(false); };
    // No transitions in lite/reduced mode: the empty promise list settles immediately.
    // The timeout also covers browsers that suspend animation events on a hidden tab.
    const fallback = window.setTimeout(remove, 400);
    if (panel.getAnimations) void Promise.allSettled(panel.getAnimations().map((animation) => animation.finished)).then(remove);
    return () => { cancelled = true; clearTimeout(fallback); };
  }, [open, present, anchor]);

  return { present, panelRef };
}
