"use client";

import { useEffect, useRef } from "react";
import { fpsEngine } from "@/lib/fps/engine";
import { getPointerPosition } from "@/lib/pointer";

/** Buttery cursor-following ambient glow, driven by the shared engine tick. */
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cx = -9999;
    let cy = -9999;
    let visible = false;

    const unsub = fpsEngine.onTick(() => {
      const root = document.documentElement;
      const calm =
        root.getAttribute("data-motion") === "reduced" || root.hasAttribute("data-lite");
      const p = getPointerPosition();
      const show = p.active && !calm && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (!show) {
        if (visible) {
          visible = false;
          el.style.opacity = "0";
        }
        return;
      }
      if (cx < -1000) {
        cx = p.x;
        cy = p.y;
      }
      cx += (p.x - cx) * 0.09;
      cy += (p.y - cy) * 0.09;
      el.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      if (!visible) {
        visible = true;
        el.style.opacity = "";
      }
    });

    return unsub;
  }, []);

  return <div ref={ref} className="cursor-glow" aria-hidden="true" style={{ opacity: 0 }} />;
}
