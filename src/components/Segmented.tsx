"use client";

import { getMotionReduced } from "@/lib/motion";
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** One measured lens, including grids that wrap to more than one line. */
export default function Segmented<T extends string | number>({
  options, value, onChange, ariaLabel, className = "", presentation = "rail", disabled = false,
}: {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  presentation?: "rail" | "grid";
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null), lens = useRef<HTMLSpanElement>(null);
  const index = options.findIndex((o) => o.value === value);

  useLayoutEffect(() => {
    const el = ref.current, pill = lens.current;
    if (!el || !pill) return;
    const nodes = el.querySelectorAll<HTMLElement>("[data-seg]");
    const node = nodes[index];
    const measure = () => {
      if (!node) { pill.removeAttribute("data-positioned"); return; }
      pill.style.transform = `translate3d(${node.offsetLeft}px,${node.offsetTop}px,0)`;
      pill.style.width = `${node.offsetWidth}px`;
      pill.style.height = `${node.offsetHeight}px`;
      pill.dataset.positioned = "";
    };
    measure();
    if (presentation === "rail" && node && el.scrollWidth > el.clientWidth + 1) {
      el.scrollTo({ left: node.offsetLeft - (el.clientWidth - node.offsetWidth) / 2,
        behavior: getMotionReduced() ? "instant" : "smooth" });
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el); nodes.forEach((item) => ro.observe(item));
    return () => ro.disconnect();
  }, [index, options.length, presentation]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (disabled || !options.length) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % options.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (Math.max(0, index) - 1 + options.length) % options.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    if (next === -1) return;
    e.preventDefault();
    const trigger = ref.current?.querySelectorAll<HTMLElement>("[data-seg]")[next];
    onChange(options[next].value);
    trigger?.focus({ preventScroll: true });
  }

  return <div ref={ref} role="radiogroup" aria-label={ariaLabel} aria-disabled={disabled || undefined}
    onKeyDown={handleKeyDown} className={`segmented ${presentation === "grid" ? "segmented-grid" : ""} ${className}`}>
    <span ref={lens} className="lens" aria-hidden="true" />
    {options.map((option, i) => <button key={option.value} type="button" role="radio" data-seg="" disabled={disabled}
      tabIndex={i === Math.max(index, 0) ? 0 : -1} aria-checked={i === index} className="segmented-item" title={option.title}
      onClick={() => onChange(option.value)}>
      {option.label}
    </button>)}
  </div>;
}
