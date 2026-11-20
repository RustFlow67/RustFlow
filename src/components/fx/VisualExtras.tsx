"use client";

import { useEffect } from "react";
import { fpsEngine } from "@/lib/fps/engine";

/**
 * Параллакс новых слоёв фона на общем тике fpsEngine.
 * Пауза: document.hidden (движок) + IntersectionObserver + data-rf-hold для CSS.
 */
export default function VisualExtras() {
  useEffect(() => {
    const root = document.documentElement;
    const layers = Array.from(document.querySelectorAll<HTMLElement>("[data-rf-parallax]"));
    const backdrop = document.querySelector(".backdrop");
    let scrollY = window.scrollY;
    let onScreen = true;

    const calm = () =>
      root.getAttribute("data-motion") === "reduced" || root.hasAttribute("data-lite");

    const syncHold = () => {
      const hold = document.hidden || !onScreen || calm();
      root.toggleAttribute("data-rf-hold", hold);
    };

    const io = new IntersectionObserver(
      (entries) => {
        onScreen = entries.some((e) => e.isIntersecting);
        syncHold();
      },
      { threshold: 0 },
    );
    if (backdrop) io.observe(backdrop);

    let scrollFrame = 0;
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(() => { scrollFrame = 0; scrollY = window.scrollY; });
    };
    const onVisibility = () => syncHold();

    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    syncHold();

    const unsub = fpsEngine.onTick(() => {
      if (document.hidden || !onScreen || calm()) return;
      const y = Math.min(scrollY, 4000);
      for (const el of layers) {
        const k = Number(el.dataset.rfParallax || "0.08");
        const depth = Number.isFinite(k) ? k : 0.08;
        el.style.transform = `translate3d(0, ${(-y * depth).toFixed(2)}px, 0)`;
      }
    });

    return () => {
      unsub();
      cancelAnimationFrame(scrollFrame);
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      root.removeAttribute("data-rf-hold");
    };
  }, []);

  return null;
}
