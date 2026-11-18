"use client";

import { useEffect } from "react";
import { applyMotionChoice, getMotionReduced, MOTION_KEY } from "@/lib/motion";

const SURFACE = ".glass, .btn, .tile, .profile-option, .nav-item, .segmented-item, .modal-panel, .popover";
const CARD = ".glass-hover, article.glass, .tile-hover, [data-tilt]";

/** One event-driven frame for wallpaper parallax and the local glass highlight. */
export default function Effects() {
  useEffect(() => {
    const root = document.documentElement;
    const backdrop = document.querySelector<HTMLElement>(".wallpaper-scene");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    let frame = 0;
    let last: MouseEvent | null = null;
    let lit: HTMLElement[] = [];
    let tilted: HTMLElement | null = null;

    function enabled() { return !document.hidden && !getMotionReduced() && !root.hasAttribute("data-lite"); }
    function resetTilt() { tilted?.removeAttribute("data-rf-tilt"); tilted = null; }
    function clearHighlights() {
      resetTilt();
      for (const node of lit) node.removeAttribute("data-glint");
      lit = [];
    }
    function clear() {
      last = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      clearHighlights();
      backdrop?.style.removeProperty("--mouse-x");
      backdrop?.style.removeProperty("--mouse-y");
    }
    function motion() {
      let choice = "auto";
      try { choice = localStorage.getItem(MOTION_KEY) ?? "auto"; } catch { /* unavailable */ }
      applyMotionChoice(choice === "full" || choice === "reduced" ? choice : "auto", { persist: false });
      if (!enabled()) clear();
    }
    function visibility() {
      root.toggleAttribute("data-rfx-paused", document.hidden);
      if (document.hidden) clear();
    }
    function update() {
      frame = 0;
      if (!enabled()) { clear(); return; }
      const event = last;
      last = null;
      if (!event) return;
      const target = event.target instanceof Element ? event.target : null;
      const surface = target?.closest<HTMLElement>(SURFACE);
      const card = target?.closest<HTMLElement>(CARD) ?? null;
      const outer = card ?? surface?.closest<HTMLElement>(".glass, .modal-panel, .popover");
      const nodes = surface ? (outer && outer !== surface ? [surface, outer] : [surface]) : [];
      const points = nodes.map((node) => ({ node, bounds: node.getBoundingClientRect() }));
      // Mouse offsets are local to the fixed wallpaper; scrolling never moves it.
      const x = (event.clientX / Math.max(1, window.innerWidth) * 2 - 1) * 16;
      const y = (event.clientY / Math.max(1, window.innerHeight) * 2 - 1) * 12;
      backdrop?.style.setProperty("--mouse-x", `${x.toFixed(1)}px`);
      backdrop?.style.setProperty("--mouse-y", `${y.toFixed(1)}px`);
      if (tilted && tilted !== card) resetTilt();
      for (const node of lit) if (!nodes.includes(node)) node.removeAttribute("data-glint");
      for (const { node, bounds } of points) {
        if (!bounds.width || !bounds.height) continue;
        const u = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
        const v = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height));
        node.style.setProperty("--mx", `${u * 100}%`);
        node.style.setProperty("--my", `${v * 100}%`);
        node.dataset.glint = "";
        if (card === node) {
          node.style.setProperty("--tilt-x", `${(0.5 - v) * 5.6}deg`);
          node.style.setProperty("--tilt-y", `${(u - .5) * 5.6}deg`);
          node.dataset.rfTilt = "";
          tilted = node;
        }
      }
      lit = nodes;
    }
    function track(event: MouseEvent) {
      const source = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
      if (!finePointer.matches || source?.firesTouchEvents || !enabled()) return;
      last = event;
      if (!frame) frame = requestAnimationFrame(update);
    }
    function scroll() {
      last = null;
      clearHighlights();
    }

    visibility();
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", motion);
    window.addEventListener("mousemove", track, { passive: true });
    window.addEventListener("scroll", scroll, { passive: true });
    root.addEventListener("mouseleave", clear);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", motion);
      window.removeEventListener("mousemove", track);
      window.removeEventListener("scroll", scroll);
      root.removeEventListener("mouseleave", clear);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);
  return null;
}
