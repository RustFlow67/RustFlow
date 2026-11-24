"use client";

import { useEffect } from "react";

// Progressive enhancement: animate only at viewport entry and never change
// React-owned DOM attributes, including while Next streams/hydrates a route.
export default function RevealOnScroll() {
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const selector = ".section-title, .work-heading, .build-fields > div, .result-sections > *, .config-workbench, #preset-library, .preset-card, .family-choice, .reading-group, .reading-card, .reading-answer, .category-card, .catalog-bar, .section-subhead, #knowledge article, .telemetry-section .section-bar, .shift-directory .section-bar, .telemetry-cell, .overlay-workspace, .shift-module, .shift-manifesto, .tweak-card, .driver-library > header";
    const seen = new WeakSet<Element>();
    const running = new Set<Animation>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        if (reduced.matches || document.documentElement.dataset.motion === "reduced" || document.documentElement.hasAttribute("data-lite")) continue;
        const element = entry.target as HTMLElement;
        const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
        const delay = Math.min(Math.max(siblings.indexOf(element), 0) % 4, 3) * 50;
        const animation = element.animate(
          [{ opacity: 0, transform: "translateY(36px) scale(.98)" }, { opacity: 1, transform: "translateY(0) scale(1)" }],
          { duration: 650, delay, easing: "cubic-bezier(.22,1,.36,1)" },
        );
        running.add(animation);
        void animation.finished.catch(() => {}).finally(() => running.delete(animation));
      }
    }, { threshold: .15 });
    function scan() {
      if (reduced.matches || document.documentElement.dataset.motion === "reduced") return;
      document.querySelectorAll<HTMLElement>(selector).forEach(element => {
        if (seen.has(element) || element.closest('[role="dialog"]') || element.closest('[inert]')) return;
        const box = element.getBoundingClientRect();
        if (!box.width || !box.height) return;
        seen.add(element);
        if (box.top > innerHeight && box.height < innerHeight * 3) observer.observe(element);
      });
    }
    scan();
    const mutations = new MutationObserver(scan);
    mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["inert"] });
    const finishMotion = () => { if (reduced.matches || document.documentElement.dataset.motion === "reduced") running.forEach(animation => animation.cancel()); else scan(); };
    reduced.addEventListener("change", finishMotion);
    window.addEventListener("shift:motion-change", finishMotion);
    return () => { observer.disconnect(); mutations.disconnect(); running.forEach(animation => animation.cancel()); reduced.removeEventListener("change", finishMotion); window.removeEventListener("shift:motion-change", finishMotion); };
  }, []);
  return null;
}
