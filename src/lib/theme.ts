"use client";

import { useSyncExternalStore } from "react";

export type ThemeChoice = "system" | "dark" | "light";
export type ResolvedTheme = "dark" | "light";

export const THEME_KEY = "rustflow:theme";
const THEME_EVENT = "rustflow:theme-change";

export const THEME_META_COLOR: Record<ResolvedTheme, string> = {
  dark: "#0A0908",
  light: "#F2EFEA",
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
            applyThemeChoice("system", { persist: false });
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

/** Apply the palette immediately; don't freeze the document in a view snapshot. */
export function applyThemeChoice(next: ThemeChoice, opts?: { persist?: boolean }): ResolvedTheme {
  const resolved = resolveChoice(next);
  if (typeof window === "undefined" || typeof document === "undefined") return resolved;
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  if (opts?.persist !== false) {
    try { window.localStorage.setItem(THEME_KEY, next); }
    catch { /* quota / private mode — theme still applies for the session */ }
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_META_COLOR[resolved]);
  emit();
  return resolved;
}

export function toggleTheme(): ResolvedTheme {
  return applyThemeChoice(snapshot().resolved === "dark" ? "light" : "dark");
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
