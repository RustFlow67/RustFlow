"use client";

import { useEffect } from "react";

/** Короткий liquid-morph поверх смены data-theme. Не трогает applyThemeChoice. */
export default function LiquidMorph() {
  useEffect(() => {
    const root = document.documentElement;
    let last = root.getAttribute("data-theme");
    let timer = 0;

    const play = () => {
      if (root.getAttribute("data-motion") === "reduced" || root.hasAttribute("data-lite")) return;
      root.classList.remove("rf-liquid-morph");
      // reflow, чтобы анимация перезапустилась при быстрых кликах
      void root.offsetWidth;
      root.classList.add("rf-liquid-morph");
      window.clearTimeout(timer);
      timer = window.setTimeout(() => root.classList.remove("rf-liquid-morph"), 760);
    };

    const mo = new MutationObserver(() => {
      const next = root.getAttribute("data-theme");
      if (next && next !== last) {
        last = next;
        play();
      }
    });
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mo.disconnect();
      window.clearTimeout(timer);
      root.classList.remove("rf-liquid-morph");
    };
  }, []);

  return null;
}
