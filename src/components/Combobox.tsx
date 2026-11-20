"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { Check, ChevronDown, Search } from "lucide-react";
import { useLiquidLens } from "./fx/useLiquidLens";
import OriginDisclosure from "@/components/fx/OriginDisclosure";
import { Fragment, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export interface ComboItem {
  id: string;
  name: string;
  group: string;
}

/** Searchable select with grouped options. */
export default function Combobox({
  label,
  placeholder,
  items,
  value,
  onChange,
  icon,
}: {
  label: string;
  placeholder: string;
  items: ComboItem[];
  value: string;
  onChange: (id: string) => void;
  icon?: ReactNode;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = items.find((item) => item.id === value);

  const filtered = useMemo(() => {
    const phrase = query.trim().toLowerCase().replace(/\s+/g, " ");
    const tokens = phrase.split(" ").filter(Boolean);
    if (tokens.length === 0) return items;
    const matches = items.filter((item) => {
      const name = item.name.toLowerCase();
      return tokens.every((token) => name.includes(token));
    });
    // Names containing the whole phrase go first: "4070 super" should not pick "4070 Ti Super".
    const exact = matches.filter((item) => item.name.toLowerCase().includes(phrase));
    if (exact.length === 0 || exact.length === matches.length) return matches;
    return [...exact, ...matches.filter((item) => !exact.includes(item))];
  }, [items, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    inputRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const safeActive = Math.min(active, Math.max(0, filtered.length - 1));

  const { list: listRef, lens } = useLiquidLens(safeActive, filtered.length, { enabled: open, continuous: true });

  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [active, open, listRef]);

  function choose(item: ComboItem) {
    onChange(item.id);
    setOpen(false);
    setQuery("");
    trigger.current?.focus({ preventScroll: true });
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filtered[safeActive];
      if (item) choose(item);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <span id={`${id}-label`} className="mb-2 block text-[13px] font-semibold text-ink-2">
        {label}
      </span>
      <button
        ref={trigger}
        type="button"
        className="field flex items-center justify-between gap-3 text-left"
        data-open={open ? "" : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label`}
        onClick={() => {
          setActive(Math.max(0, filtered.findIndex(item => item.id === value)));
          setOpen((v) => !v);
        }}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {icon}
          <span className={`truncate ${selected ? "font-medium" : "text-ink-3"}`}>{selected?.name ?? placeholder}</span>
        </span>
        <ChevronDown
          className={`h-4 w-4 flex-none text-ink-3 transition-transform duration-500 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <OriginDisclosure open={open} className="pointer-events-none absolute inset-x-0 top-full z-40 mt-2">
        <LiquidGlass className="popover pointer-events-auto p-2">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              className="field !h-11 !rounded-[14px] !pl-10"
              placeholder="Поиск модели"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-label={`${label}: поиск`}
            />
          </div>
          <div ref={listRef} id={`${id}-list`} role="listbox" className="liquid-options relative mt-2 max-h-72 overflow-y-auto pr-1">
            <LiquidGlass as="span" shape="pill" className="lens liquid-lens" ref={lens} aria-hidden="true" />
            {filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm leading-relaxed text-ink-3">
                Такой модели нет в списке. Выберите ближайшую по классу.
              </p>
            )}
            {filtered.map((item, i) => {
              const showGroup = i === 0 || filtered[i - 1].group !== item.group;
              const isSelected = item.id === value;
              return (
                <Fragment key={item.id}>
                  {showGroup && (
                    <div className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-widest text-ink-3">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    role="option" data-liquid-item=""
                    aria-selected={isSelected}
                    data-active={i === safeActive ? "" : undefined}
                    className="option"
                    onClick={() => choose(item)}
                  >
                    <span className="truncate">{item.name}</span>
                    {isSelected && <Check className="h-4 w-4 flex-none text-accent-hi" aria-hidden="true" />}
                  </button>
                </Fragment>
              );
            })}
          </div>
        </LiquidGlass>
      </OriginDisclosure>
    </div>
  );
}
