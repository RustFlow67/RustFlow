"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { usePopupTrigger } from "../fx/usePopupMotion";

import { ArrowUpRight, Command, Cpu, Layers3, Search, SlidersHorizontal } from "lucide-react";
import { useRouteNavigation } from "@/components/RouteLink";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLiquidLens } from "../fx/useLiquidLens";
import { Modal } from "@/components/ui/Modal";
import styles from "./addons.module.css";

export interface CommandEntry {
  href: string;
  title: string;
  kind: "Страница" | "Твик" | "Пресет" | "Инструмент";
  keywords?: string;
}

const OPEN_EVENT = "shift:open-palette";
const ICONS = { Страница: Layers3, Твик: SlidersHorizontal, Пресет: Cpu, Инструмент: Command };
const normalize = (value: string) => value.toLocaleLowerCase("ru").replaceAll("ё", "е").replace(/[-_/]+/g, " ");

export function PaletteButton() {
  return <button type="button" aria-haspopup="dialog" className={styles.action}
    onClick={e => window.dispatchEvent(new CustomEvent(OPEN_EVENT, {detail:e.currentTarget}))}>
    <Command aria-hidden="true" />Палитра команд <kbd className={styles.keys}>Ctrl / ⌘ + K</kbd>
  </button>;
}

export default function CommandPalette({ entries }: { entries: readonly CommandEntry[] }) {
  const {capture, origin} = usePopupTrigger();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const goTo = useRouteNavigation();
  const catalog = useMemo(() => entries.map((entry) => ({
    entry, search: normalize(`${entry.title} ${entry.kind} ${entry.keywords ?? ""} ${entry.href}`),
  })), [entries]);
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  const matched = catalog.filter(({ search }) => terms.every((term) => search.includes(term)));
  const results = matched.slice(0, terms.length === 0 ? 12 : 24);
  const active = Math.min(highlight, results.length - 1);
  const { list, lens } = useLiquidLens<HTMLUListElement, HTMLLIElement>(active, results.length, { enabled: open, continuous: true });
  const activeId = active >= 0 ? `${listId}-${active}` : undefined;

  useEffect(() => {
    function launch(event?: Event) {
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      capture(event instanceof CustomEvent && event.detail instanceof HTMLElement ? event.detail : null);
      setQuery("");
      setHighlight(0);
      setOpen(true);
    }
    function shortcut(event: globalThis.KeyboardEvent) {
      if (event.isComposing || event.repeat || event.defaultPrevented || event.altKey || event.shiftKey ||
          !(event.ctrlKey || event.metaKey) || (event.code !== "KeyK" && event.key.toLowerCase() !== "k")) return;
      if (!open && document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      if (open) setOpen(false);
      else launch();
    }
    window.addEventListener(OPEN_EVENT, launch);
    window.addEventListener("keydown", shortcut);
    return () => {
      window.removeEventListener(OPEN_EVENT, launch);
      window.removeEventListener("keydown", shortcut);
    };
  }, [open, capture]);

  useEffect(() => { if (open) input.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => {
    if (open && activeId) document.getElementById(activeId)?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [open, activeId]);

  function navigate(entry: CommandEntry) {
    setOpen(false);
    goTo(entry.href);
  }

  function onQueryKey(event: KeyboardEvent<HTMLInputElement>) {
    if (!results.length || event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
    } else if (event.key === "Enter" && results[active]) {
      event.preventDefault();
      navigate(results[active].entry);
    }
  }

  return <Modal {...origin} open={open} title="Палитра команд" onClose={() => setOpen(false)} maxWidth="max-w-2xl">
    <div className={`${styles.surface} ${styles.palette}`}>
      <label className={styles.label}>
        <span className={styles.actions}><Search size={15} aria-hidden="true" />Поиск по SHIFT</span>
        <input ref={input} className={styles.input} value={query} maxLength={100} role="combobox" aria-expanded="true"
          aria-controls={listId} aria-autocomplete="list" aria-activedescendant={activeId}
          type="text" autoComplete="off" placeholder="Например: 7800X3D, замеры, миф…"
          onChange={(event) => { setQuery(event.target.value); setHighlight(0); }} onKeyDown={onQueryKey} />
      </label>
      <ul ref={list} className={`${styles.options} liquid-options`} id={listId} role="listbox" aria-label="Найденные команды">
        <LiquidGlass as="li" shape="pill" ref={lens} aria-hidden="true" className="lens liquid-lens" />
        {results.map(({ entry }, index) => {
          const Icon = ICONS[entry.kind];
          return <li key={entry.href} role="option" data-liquid-item="" id={`${listId}-${index}`} aria-selected={index === active}
            className={styles.option} onMouseDown={(event) => event.preventDefault()} onClick={() => navigate(entry)}>
            <Icon aria-hidden="true" />
            <span><strong>{entry.title}</strong><span className={`block ${styles.muted}`}>{entry.kind}</span></span>
            <ArrowUpRight aria-hidden="true" />
          </li>;
        })}
      </ul>
      <p className={styles.muted} role="status">{results.length === 0 ? "Ничего не найдено. Попробуйте другой запрос." :
        matched.length > results.length && terms.length > 0 ? `Показано ${results.length} из ${matched.length}. Уточните запрос.` : "↑ ↓ — выбрать, Enter — открыть, Esc — закрыть."}</p>
    </div>
  </Modal>;
}
