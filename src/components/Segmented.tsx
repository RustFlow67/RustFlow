"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { useLiquidLens } from "@/components/fx/useLiquidLens";
import { type KeyboardEvent, type ReactNode } from "react";

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
  title?: string;
}

/** One measured lens, including grids that wrap to more than one line. */
export default function Segmented<T extends string | number>({
  options, value, onChange, ariaLabel, className = "", presentation = "rail", disabled = false, tabsId,
}: {
  options: readonly SegmentedOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
  presentation?: "rail" | "grid";
  disabled?: boolean;
  /** When switching panels, expose tabs instead of a form field. */
  tabsId?: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  const { list: ref, lens } = useLiquidLens(index, options.length, { lazy: presentation === "grid", enabled: !disabled, continuous: true });

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

  return <LiquidGlass ref={ref} role={tabsId ? "tablist" : "radiogroup"} aria-label={ariaLabel} aria-disabled={disabled || undefined}
    onKeyDown={handleKeyDown} className={`segmented ${presentation === "grid" ? "segmented-grid" : ""} ${className}`}>
    <LiquidGlass as="span" shape="pill" ref={lens} className="lens liquid-lens" aria-hidden="true" />
    {options.map((option, i) => <button key={option.value} type="button" role={tabsId ? "tab" : "radio"} id={tabsId && `${tabsId}-tab-${option.value}`}
      aria-controls={tabsId && `${tabsId}-panel-${option.value}`} aria-selected={tabsId ? i === index : undefined} data-liquid-item="" data-seg="" disabled={disabled}
      tabIndex={i === Math.max(index, 0) ? 0 : -1} aria-checked={tabsId ? undefined : i === index} className="segmented-item" title={option.title}
      onClick={() => onChange(option.value)}>
      {option.label}
    </button>)}
  </LiquidGlass>;
}
