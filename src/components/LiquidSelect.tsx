"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

export interface LiquidOption<T extends string | number> { value: T; label: string }

/** Select-only combobox. Focus stays on the trigger; the list escapes glass stacking contexts. */
export default function LiquidSelect<T extends string | number>({ label, hideLabel, hint, options, value, onChange, className = "" }: {
  label: string; hideLabel?: boolean; hint?: string;
  options: readonly LiquidOption<T>[]; value: T; onChange: (value: T) => void; className?: string;
}) {
  const id = useId(), trigger = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const typed = useRef({ text: "", time: 0 });
  const selected = options.findIndex((o) => o.value === value);
  const cursor = Math.max(0, Math.min(options.length - 1, active));
  const show = () => { setActive(Math.max(0, selected)); setOpen(true); };
  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open) return;
    const anchor = trigger.current, list = panel.current;
    if (!anchor || !list) return;
    list.toggleAttribute("data-in-dialog", Boolean(anchor.closest("[role=dialog]")));
    let frame = 0;
    function align() {
      if (!anchor || !list) return;
      const rect = anchor.getBoundingClientRect(), vp = window.visualViewport;
      const top = vp?.offsetTop ?? 0, bottom = top + (vp?.height ?? window.innerHeight);
      if (rect.bottom < top || rect.top > bottom) { setOpen(false); return; }
      const below = bottom - rect.bottom - 12, above = rect.top - top - 12;
      const up = below < Math.min(248, list.scrollHeight + 8) && above > below;
      const available = Math.max(0, Math.min(290, up ? above : below));
      if (available < 46) { setOpen(false); return; }
      list.dataset.side = up ? "top" : "bottom";
      list.style.left = `${rect.left}px`;
      list.style.width = `${rect.width}px`;
      list.style.maxHeight = `${available}px`;
      list.style.top = up ? "auto" : `${rect.bottom + 6}px`;
      list.style.bottom = up ? `${window.innerHeight - rect.top + 6}px` : "auto";
    }
    function queue() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; align(); }); }
    align();
    const observer = new ResizeObserver(queue); observer.observe(anchor);
    window.addEventListener("scroll", queue, { passive: true, capture: true });
    window.addEventListener("resize", queue);
    window.visualViewport?.addEventListener("resize", queue);
    window.visualViewport?.addEventListener("scroll", queue);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      window.removeEventListener("scroll", queue, true); window.removeEventListener("resize", queue);
      window.visualViewport?.removeEventListener("resize", queue);
      window.visualViewport?.removeEventListener("scroll", queue);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) close();
    }
    document.addEventListener("pointerdown", outside, true);
    return () => document.removeEventListener("pointerdown", outside, true);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const list = panel.current;
    const option = list?.querySelector<HTMLElement>("[data-active]");
    if (!list || !option) return;
    if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
    else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
    }
  }, [cursor, open]);

  function choose(option: LiquidOption<T>) { onChange(option.value); close(); }
  function keys(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Tab") { close(); return; }
    if (event.key === "Escape" && open) {
      event.preventDefault(); event.stopPropagation(); close(); return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open && options[cursor]) choose(options[cursor]); else show();
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(event.key)) {
      event.preventDefault();
      if (!open) show();
      const at = open ? cursor : Math.max(0, selected);
      const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1
        : at + (event.key === "PageDown" ? 5 : event.key === "PageUp" ? -5 : event.key === "ArrowDown" ? 1 : -1);
      setActive(Math.max(0, Math.min(options.length - 1, next)));
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now(), key = event.key.toLowerCase();
      const prev = now - typed.current.time < 650 ? typed.current.text : "";
      const text = prev === key ? key : prev + key;
      typed.current = { text, time: now };
      const match = options.findIndex((option, i) => i !== cursor && option.label.toLowerCase().startsWith(text));
      if (match >= 0) { event.preventDefault(); if (!open) show(); setActive(match); }
    }
  }

  return <div className={`min-w-0 ${className}`}>
    <label id={`${id}-label`} htmlFor={id} className={hideLabel ? "sr-only" : "mb-1.5 block text-[13px] font-semibold text-ink-2"}>{label}</label>
    <button ref={trigger} id={id} type="button" role="combobox" className="field liquid-select-trigger" aria-haspopup="listbox"
      aria-labelledby={`${id}-label`} aria-expanded={open} aria-controls={open ? `${id}-list` : undefined}
      aria-activedescendant={open && options.length ? `${id}-${cursor}` : undefined} aria-describedby={hint ? `${id}-hint` : undefined}
      data-open={open ? "" : undefined} onClick={() => open ? close() : show()} onBlur={close} onKeyDown={keys}>
      <span className="truncate">{options[selected]?.label ?? String(value)}</span><ChevronDown aria-hidden="true" />
    </button>
    {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-3">{hint}</p>}
    {open && createPortal(<div ref={panel} id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`}
      className="popover liquid-select-panel" data-open="">
      {options.map((option, i) => <div key={option.value} id={`${id}-${i}`} role="option" aria-selected={value === option.value}
        className="option liquid-select-option" data-active={cursor === i ? "" : undefined}
        onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
        <span>{option.label}</span>{value === option.value && <Check aria-hidden="true" className="h-4 w-4 flex-none text-accent-hi" />}
      </div>)}
    </div>, document.body)}
  </div>;
}
