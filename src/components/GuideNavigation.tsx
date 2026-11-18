"use client";

import { ArrowUpRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "@/components/RouteLink";
import { openAssistant } from "@/lib/assistant/open";

const STEPS = [
  { href: "/benchmark", title: "Сборка", text: "Найдите узкое место среди CPU, GPU, RAM и SSD." },
  { href: "/presets", title: "Пресеты", text: "Сравните 1080p, 1440p и 4:3 по FPS и 1% low." },
  { href: "/tweaker", title: "Твикер", text: "Выберите профиль и рекомендуемые шаги. Скачайте ZIP с откатом." },
  { href: "/faq", title: "Мифы и EAC", text: "Проверьте рискованные советы перед применением." },
  { href: null, title: "ИИ-ассистент", text: "Разберите конкретную просадку или вопрос по настройке." },
] as const;

export function GuideSteps() {
  return <section className="mb-6" aria-labelledby="guide-steps">
    <h2 className="headline rf-page-content mb-3 text-[clamp(1rem,2.8vw,1.4rem)]" id="guide-steps">Пошаговый маршрут: от чего к чему идти</h2>
    <ol className="guide-steps">
      {STEPS.map(({ href, title, text }, i) => {
        const content = <><span className="guide-step-meta rf-page-content"><span>0{i + 1}</span><ArrowUpRight size={15} aria-hidden="true" /></span><strong className="rf-page-content">{title}</strong><span className="rf-page-content text-sm leading-relaxed text-ink-2">{text}</span></>;
        const classes = "glass glass-hover guide-step";
        return <li key={title}>{href ? <Link href={href} prefetch className={classes}>{content}</Link> : <button type="button" onClick={(event) => openAssistant(event.currentTarget)} aria-haspopup="dialog" className={classes}>{content}</button>}</li>;
      })}
    </ol>
  </section>;
}

export function GuideContents({ sections }: { sections: { id: string; title: string }[] }) {
  const list = useRef<HTMLUListElement>(null);
  const lens = useRef<HTMLLIElement>(null);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const target = hovered ?? focused ?? active;
  useLayoutEffect(() => {
    const row = list.current?.querySelectorAll<HTMLElement>("[data-guide-row]")[target];
    const glass = lens.current;
    if (!row || !glass) return;
    const align = () => {
      glass.style.transform = `translate3d(0,${row.offsetTop}px,0)`;
      glass.style.height = `${row.offsetHeight}px`;
      glass.dataset.positioned = "";
    };
    align();
    const observer = new ResizeObserver(align);
    if (list.current) observer.observe(list.current);
    observer.observe(row);
    return () => observer.disconnect();
  }, [target]);
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
  return <nav className="glass glass-blur guide-contents p-3" aria-label="Содержание базы знаний">
    <p className="px-3 pb-2 pt-1 text-xs font-bold tracking-widest text-ink-3">СОДЕРЖАНИЕ</p>
    <ul ref={list} className="guide-toc-list" onPointerLeave={() => setHovered(null)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(null); }}>
      <li ref={lens} className="guide-lens" aria-hidden="true" />
      {sections.map(({ id, title }, i) => <li key={id} data-guide-row="">
        <a href={`#${id}`} className="guide-toc-link" aria-current={active === i ? "location" : undefined}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(i); }}
          onFocus={(event) => setFocused(event.currentTarget.matches(":focus-visible") ? i : null)}>
          <span className="tabular-nums text-accent-hi">{i + 1}</span><span>{title}</span>
        </a>
      </li>)}
    </ul>
  </nav>;
}
