"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { useEffect, useState } from "react";
import { useLiquidLens } from "./fx/useLiquidLens";
export function GuideContents({ sections }: { sections: { id: string; title: string }[] }) {
  const [active, setActive] = useState(0);
  const { list, lens } = useLiquidLens<HTMLUListElement, HTMLLIElement>(active, sections.length, { continuous: true });
  useEffect(() => {
    const sectionsByPosition = sections.flatMap(({ id }, index) => {
      const node = document.getElementById(id);
      return node ? [{ node, index }] : [];
    });
    const main = document.getElementById("main-content");
    let zone = 96;
    let frame = 0;
    let shown = -1;
    const update = () => {
      frame = 0;
      let nearest = 0;
      // The last heading that has passed the reading line owns the section, including gaps.
      // Use all positions, not the unordered set of changed IntersectionObserver entries.
      for (const { node, index } of sectionsByPosition) {
        if (node.getBoundingClientRect().top > zone) break;
        nearest = index;
      }
      if (shown !== nearest) { shown = nearest; setActive(nearest); }
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const resize = () => { zone = (main ? parseFloat(getComputedStyle(main).paddingTop) : 88) + 8; schedule(); };
    const observer = new ResizeObserver(resize);
    if (main) observer.observe(main);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", resize);
    window.addEventListener("hashchange", schedule);
    resize();
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", resize);
      window.removeEventListener("hashchange", schedule);
    };
  }, [sections]);
  return <LiquidGlass as="nav" className="glass glass-blur guide-contents p-3" aria-label="Содержание раздела">
    <p className="rubric mb-2 ml-2">СОДЕРЖАНИЕ</p>
    <ul ref={list} className="guide-toc-list">
      <LiquidGlass as="li" shape="pill" ref={lens} className="guide-lens liquid-lens" aria-hidden="true" />
      {sections.map(({ id, title }, i) => <li key={id} data-liquid-item="">
        <a href={`#${id}`} className="guide-toc-link" aria-current={active === i ? "location" : undefined}>
          <span className="tabular-nums text-accent-hi">{i + 1}</span><span>{title}</span>
        </a>
      </li>)}
    </ul>
  </LiquidGlass>;
}
