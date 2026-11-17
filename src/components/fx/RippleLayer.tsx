"use client";

import { useEffect } from "react";

const HOST = ".glass, .btn";
const MAX = 6;

/** Клик-рябь на стекле и кнопках. Только transform/opacity, без своего rAF. */
export default function RippleLayer() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const root = document.documentElement;
      if (root.getAttribute("data-motion") === "reduced" || root.hasAttribute("data-lite")) return;
      const host = (e.target as Element | null)?.closest?.(HOST) as HTMLElement | null;
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const dot = document.createElement("span");
      dot.className = "rf-ripple";
      dot.style.left = `${e.clientX - rect.left}px`;
      dot.style.top = `${e.clientY - rect.top}px`;
      host.appendChild(dot);
      const ripples = host.querySelectorAll(".rf-ripple");
      if (ripples.length > MAX) ripples[0]?.remove();
      dot.addEventListener("animationend", () => dot.remove(), { once: true });
    };
    document.addEventListener("pointerdown", onDown, { passive: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  return null;
}
