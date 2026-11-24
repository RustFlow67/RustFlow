"use client";

import { specularEdges } from "./fx/specularEdges";
import { useEffect } from "react";
import { applyMotionChoice, MOTION_KEY } from "@/lib/motion";

/** Pause CSS decoration in background tabs; the wallpaper owns its own clock. */
export default function Effects() {
  useEffect(specularEdges, []);
  useEffect(() => {
    const root = document.documentElement;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    function motion() {
      let choice = "auto";
      try { choice = localStorage.getItem(MOTION_KEY) ?? choice; } catch { /* private browsing */ }
      applyMotionChoice(choice === "full" || choice === "reduced" ? choice : "auto", { persist: false });
    }
    motion();
    const visibility = () => root.toggleAttribute("data-rfx-paused", document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", motion);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", motion);
    };
  }, []);
  return null;
}
