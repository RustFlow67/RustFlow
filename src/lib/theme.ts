"use client";

import { useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

export const THEME_KEY = "rustflow:theme";
const THEME_EVENT = "rustflow:theme-change";

export const THEME_META_COLOR: Record<ResolvedTheme, string> = {
  dark: "#050609",
  light: "#f4efe6",
};

function readChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    /* private mode — fall through to system */
  }
  return "system";
}

export function resolveChoice(choice: ThemeChoice): ResolvedTheme {
  if (choice === "dark" || choice === "light") return choice;
  if (typeof window === "undefined") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

interface ThemeSnapshot {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
}

let cache: ThemeSnapshot | null = null;
const listeners = new Set<() => void>();
let sysBound = false;

function snapshot(): ThemeSnapshot {
  if (cache) return cache;
  const choice = readChoice();
  let resolved = resolveChoice(choice);
  if (typeof document !== "undefined") {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark" || attr === "light") resolved = attr;
  }
  cache = { choice, resolved };
  return cache;
}

function emit() {
  cache = null;
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* never break subscribers */
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(THEME_EVENT));
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (typeof window !== "undefined") {
    const onExternal = () => {
      cache = null;
      fn();
    };
    window.addEventListener(THEME_EVENT, onExternal);
    if (!sysBound) {
      sysBound = true;
      try {
        const mq = window.matchMedia("(prefers-color-scheme: light)");
        mq.addEventListener("change", () => {
          if (readChoice() === "system") {
            applyThemeChoice("system", { transition: false, persist: false });
          }
        });
      } catch {
        /* older browsers */
      }
    }
    return () => {
      listeners.delete(fn);
      window.removeEventListener(THEME_EVENT, onExternal);
    };
  }
  return () => {
    listeners.delete(fn);
  };
}

const serverSnapshot: ThemeSnapshot = { choice: "system", resolved: "dark" };

/**
 * Сериализация переходов темы: повторные клики во время активного перехода
 * применяются мгновенно, а устаревший VT-колбэк отменяется токеном.
 * Гарантия: каждый клик меняет состояние, залипаний и потерянных тоглов нет.
 */
let vtInflight = false;
let vtSeq = 0;

/** Применяет тему с плавным cross-fade через View Transitions API (fallback — мгновенно). */
export function applyThemeChoice(
  next: ThemeChoice,
  opts?: { transition?: boolean; persist?: boolean },
): ResolvedTheme {
  const resolved = resolveChoice(next);
  if (typeof window === "undefined" || typeof document === "undefined") return resolved;
  const root = document.documentElement;

  const doApply = () => {
    root.setAttribute("data-theme", resolved);
    try {
      root.style.colorScheme = resolved;
    } catch {
      /* noop */
    }
    if (opts?.persist !== false) {
      try {
        window.localStorage.setItem(THEME_KEY, next);
      } catch {
        /* quota / private mode — theme still applies for the session */
      }
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", THEME_META_COLOR[resolved]);
    emit();
  };

  let reduce = false;
  try {
    reduce =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      root.getAttribute("data-motion") === "reduced";
  } catch {
    /* noop */
  }
  const vt = (document as Document & { startViewTransition?: (cb: () => void) => { finished?: Promise<unknown> } })
    .startViewTransition;
  if (opts?.transition !== false && typeof vt === "function" && !reduce && !vtInflight) {
    const my = ++vtSeq;
    vtInflight = true;
    const settle = () => {
      vtInflight = false;
    };
    try {
      const t = vt.call(document, () => {
        // Устаревший колбэк (поверх уже применённого нового интента) отменяется.
        if (my === vtSeq) doApply();
      });
      if (t && typeof t.finished?.then === "function") {
        t.finished.then(settle, settle);
      } else {
        setTimeout(settle, 600);
      }
      // Страховка: флаг не должен зависнуть, даже если finished не сетится.
      setTimeout(settle, 1500);
      return resolved;
    } catch {
      settle();
    }
  }
  // Мгновенный путь: новый интент побеждает ожидающий VT-колбэк.
  vtSeq += 1;
  doApply();
  return resolved;
}

export function toggleTheme(): ResolvedTheme {
  const current = snapshot().resolved;
  return applyThemeChoice(current === "dark" ? "light" : "dark");
}

export function useTheme(): {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (c: ThemeChoice) => void;
  toggle: () => void;
} {
  const snap = useSyncExternalStore(subscribe, snapshot, () => serverSnapshot);
  return {
    choice: snap.choice,
    resolved: snap.resolved,
    setChoice: (c: ThemeChoice) => applyThemeChoice(c),
    toggle: () => toggleTheme(),
  };
}

/** Текущий резолв темы без подписки (для canvas-рендера). */
export function getResolvedTheme(): ResolvedTheme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
