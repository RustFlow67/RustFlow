"use client";

import { useSyncExternalStore } from "react";

/**
 * Пользовательская опция движения (доступность как опция, а не ограничение richness):
 * - "auto" — уважает prefers-reduced-motion системы;
 * - "full" — принудительно полный флагманский motion;
 * - "reduced" — спокойный режим без тяжёлых эффектов.
 */

export type MotionChoice = "auto" | "full" | "reduced";

export const MOTION_KEY = "rustflow:motion";
const MOTION_EVENT = "shift:motion-change";

function readChoice(): MotionChoice {
  if (typeof window === "undefined") return "auto";
  try {
    const v = window.localStorage.getItem(MOTION_KEY);
    if (v === "auto" || v === "full" || v === "reduced") return v;
  } catch {
    /* ignore */
  }
  return "auto";
}

export function isReducedMotion(choice: MotionChoice): boolean {
  if (choice === "reduced") return true;
  if (choice === "full") return false;
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

interface MotionSnapshot {
  choice: MotionChoice;
  reduced: boolean;
}

let cache: MotionSnapshot | null = null;
const listeners = new Set<() => void>();
let bound = false;

function snapshot(): MotionSnapshot {
  if (cache) return cache;
  const choice = readChoice();
  cache = { choice, reduced: isReducedMotion(choice) };
  return cache;
}

function emit() {
  cache = null;
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MOTION_EVENT));
  }
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (typeof window !== "undefined") {
    const onExternal = () => {
      cache = null;
      fn();
    };
    window.addEventListener(MOTION_EVENT, onExternal);
    if (!bound) {
      bound = true;
      try {
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        mq.addEventListener("change", () => {
          if (readChoice() === "auto") applyMotionChoice("auto", { persist: false });
        });
      } catch {
        /* older browsers */
      }
    }
    return () => {
      listeners.delete(fn);
      window.removeEventListener(MOTION_EVENT, onExternal);
    };
  }
  return () => {
    listeners.delete(fn);
  };
}

const serverSnapshot: MotionSnapshot = { choice: "auto", reduced: false };

export function applyMotionChoice(next: MotionChoice, opts?: { persist?: boolean }): boolean {
  const reduced = isReducedMotion(next);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-motion", reduced ? "reduced" : "full");
  }
  if (opts?.persist !== false && typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MOTION_KEY, next);
    } catch {
      /* ignore */
    }
  }
  emit();
  return reduced;
}

export function useMotion(): {
  choice: MotionChoice;
  reduced: boolean;
  setChoice: (c: MotionChoice) => void;
} {
  const snap = useSyncExternalStore(subscribe, snapshot, () => serverSnapshot);
  return {
    choice: snap.choice,
    reduced: snap.reduced,
    setChoice: (c: MotionChoice) => applyMotionChoice(c),
  };
}

export function getMotionReduced(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.matches('[data-motion="reduced"], [data-engine-motion="instant"]');
}
