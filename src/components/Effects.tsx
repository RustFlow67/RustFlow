"use client";

import { useEffect } from "react";
import { clearPointerPosition, setPointerPosition } from "@/lib/pointer";

declare global {
  interface Window {
    __rf?: boolean;
  }
}

const SHEEN_SELECTOR = ".glass, .btn";

/**
 * Флагманский слой motion:
 * - cinematic scroll-reveal + staggered-группы [data-stagger],
 * - спекулярный блик, 3D-tilt [data-tilt] и magnetic [data-magnetic] — один rAF,
 * - параллакс обоев, data-scrolled и hue-сдвиг секций при скролле.
 * Всё уважает data-motion="reduced" и data-lite.
 */
export default function Effects() {
  useEffect(() => {
    window.__rf = true;
    const root = document.documentElement;
    const calm = () =>
      root.getAttribute("data-motion") === "reduced" || root.hasAttribute("data-lite");

    /* ---------- scroll reveal + stagger groups ---------- */
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "");
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -4% 0px", threshold: 0.02 },
    );

    const stagger = (scope: ParentNode) => {
      scope.querySelectorAll("[data-stagger]:not([data-staggered])").forEach((group) => {
        group.setAttribute("data-staggered", "");
        group.querySelectorAll(":scope [data-reveal]").forEach((child, i) => {
          (child as HTMLElement).style.setProperty("--d", String(Math.min(i, 10)));
        });
      });
    };

    const scan = (node: ParentNode) => {
      stagger(node);
      node.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((el) => io.observe(el));
    };
    scan(document);

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          const el = n as Element;
          if (el.matches("[data-reveal]:not([data-revealed])")) io.observe(el);
          scan(el);
        });
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });

    /* ---------- pointer: sheen + tilt + magnetic (один rAF) ---------- */
    let raf = 0;
    let last: PointerEvent | null = null;
    let magneticEl: HTMLElement | null = null;
    let tiltEl: HTMLElement | null = null;

    const resetFx = (el: HTMLElement | null) => {
      if (!el) return;
      el.style.removeProperty("--tilt-x");
      el.style.removeProperty("--tilt-y");
      el.style.removeProperty("--tilt-lift");
      if (el.hasAttribute("data-magnetic")) el.style.transform = "";
    };

    const applyPointer = () => {
      raf = 0;
      const e = last;
      if (!e) return;
      setPointerPosition(e.clientX, e.clientY);
      if (calm()) return;

      const target = e.target as Element | null;
      const sheen = target?.closest?.(SHEEN_SELECTOR) as HTMLElement | null;
      if (sheen) {
        const r = sheen.getBoundingClientRect();
        sheen.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
        sheen.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
      }

      const tilt = target?.closest?.("[data-tilt]") as HTMLElement | null;
      if (tiltEl && tiltEl !== tilt) resetFx(tiltEl);
      tiltEl = tilt;
      if (tilt) {
        const r = tilt.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          tilt.style.setProperty("--tilt-x", `${(-py * 7).toFixed(2)}deg`);
          tilt.style.setProperty("--tilt-y", `${(px * 9).toFixed(2)}deg`);
          tilt.style.setProperty("--tilt-lift", "-4px");
        }
      }

      const mag = target?.closest?.("[data-magnetic]") as HTMLElement | null;
      if (magneticEl && magneticEl !== mag) resetFx(magneticEl);
      magneticEl = mag;
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const dist = Math.hypot(dx, dy) || 1;
        const pull = Math.min(1, 90 / dist);
        mag.style.transform = `translate3d(${(dx * 0.12 * pull).toFixed(1)}px, ${(dy * 0.16 * pull).toFixed(1)}px, 0) scale(1.03)`;
      }
    };

    const onPointer = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      last = e;
      if (!raf) raf = requestAnimationFrame(applyPointer);
    };
    const onLeave = () => {
      clearPointerPosition();
      resetFx(magneticEl);
      resetFx(tiltEl);
      magneticEl = null;
      tiltEl = null;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    /* ---------- scroll: parallax + hue-shift + nav state ---------- */
    const parallax = document.getElementById("backdrop-parallax");
    let scrollRaf = 0;
    const applyScroll = () => {
      scrollRaf = 0;
      const y = window.scrollY;
      root.toggleAttribute("data-scrolled", y > 20);
      if (calm()) return;
      if (parallax) {
        parallax.style.transform = `translate3d(0, ${(-Math.min(y, 5000) * 0.05).toFixed(1)}px, 0)`;
      }
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const hue = Math.min(1, y / max) * 70;
      root.style.setProperty("--hue-shift", `${hue.toFixed(1)}deg`);
    };
    const onScroll = () => {
      if (!scrollRaf) scrollRaf = requestAnimationFrame(applyScroll);
    };
    applyScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("pointermove", onPointer);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
    };
  }, []);

  return null;
}
