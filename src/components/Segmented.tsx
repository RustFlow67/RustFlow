"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

/**
 * Единый iOS Liquid Glass переключатель (Tabs / Segmented)
 * с навигацией стрелками, Home/End, roving tabIndex и композитной линзой.
 */
export default function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; w: number } | null>(null);
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const node = el.querySelectorAll<HTMLElement>("[data-seg]")[index];
      setLens(node ? { x: node.offsetLeft, w: node.offsetWidth } : null);
      if (node && el.scrollWidth > el.clientWidth + 1) {
        el.scrollTo({
          left: node.offsetLeft - (el.clientWidth - node.offsetWidth) / 2,
          behavior: "smooth",
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [index, options.length]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (options.length === 0) return;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (index + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (index - 1 + options.length) % options.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = options.length - 1;
    }
    if (next !== -1) {
      e.preventDefault();
      onChange(options[next].value);
      ref.current?.querySelectorAll<HTMLElement>("[data-seg]")[next]?.focus();
    }
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`segmented ${className}`}
    >
      <span
        className="lens"
        aria-hidden="true"
        style={
          lens
            ? { transform: `translate3d(${lens.x}px,0,0)`, width: lens.w, opacity: 1 }
            : { opacity: 0 }
        }
      />
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            data-seg
            tabIndex={selected || (index === 0 && i === 0) ? 0 : -1}
            aria-checked={selected}
            className="segmented-item"
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
