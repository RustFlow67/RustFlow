"use client";

import { getMotionReduced } from "@/lib/motion";
import { useEffect, useRef, useState } from "react";

/** Cosmetic widgets get no clock of their own. Run their native animations
 * only in view; a quiet mode always renders the fully readable still state. */
export function useAmbientPlayback<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [playback, setPlayback] = useState<"still" | "paused" | "playing">("still");
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    let inView = false,
      pageHidden = false;
    const sync = () => {
      const quiet = getMotionReduced() || root.hasAttribute("data-lite");
      const paused =
        !inView || pageHidden || document.hidden || document.body.hasAttribute("data-popup-depth");
      setPlayback(quiet ? "still" : paused ? "paused" : "playing");
    };
    const view = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    const settings = new MutationObserver(sync);
    const hide = () => {
      pageHidden = true;
      sync();
    };
    const show = () => {
      pageHidden = false;
      sync();
    };
    view.observe(element);
    settings.observe(root, {
      attributes: true,
      attributeFilter: ["data-engine-motion", "data-motion", "data-lite"],
    });
    settings.observe(document.body, { attributes: true, attributeFilter: ["data-popup-depth"] });
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      view.disconnect();
      settings.disconnect();
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, []);
  return { ref, playback };
}
