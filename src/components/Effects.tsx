"use client";

import { useEffect } from "react";
import { applyMotionChoice, getMotionReduced, MOTION_KEY } from "@/lib/motion";

/** One event-driven frame for the fixed wallpaper parallax. */
export default function Effects() {
  useEffect(() => {
    const root = document.documentElement;
    const backdrop = document.querySelector<HTMLElement>(".wallpaper-scene");
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const finePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    let frame = 0;
    let last: MouseEvent | null = null;

    function enabled() { return !document.hidden && !getMotionReduced() && !root.hasAttribute("data-lite"); }
    function clear() {
      last = null;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
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
      // Mouse offsets are local to the fixed wallpaper; scrolling never moves it.
      const x = (event.clientX / Math.max(1, window.innerWidth) * 2 - 1) * 16;
      const y = (event.clientY / Math.max(1, window.innerHeight) * 2 - 1) * 12;
      backdrop?.style.setProperty("--mouse-x", `${x.toFixed(1)}px`);
      backdrop?.style.setProperty("--mouse-y", `${y.toFixed(1)}px`);
    }
    function track(event: MouseEvent) {
      const source = (event as MouseEvent & { sourceCapabilities?: { firesTouchEvents?: boolean } }).sourceCapabilities;
      if (!finePointer.matches || source?.firesTouchEvents || !enabled()) return;
      last = event;
      if (!frame) frame = requestAnimationFrame(update);
    }

    visibility();
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", motion);
    window.addEventListener("mousemove", track, { passive: true });
    root.addEventListener("mouseleave", clear);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", motion);
      window.removeEventListener("mousemove", track);
      root.removeEventListener("mouseleave", clear);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, []);
  return null;
}
