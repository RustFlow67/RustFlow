"use client";

import { useSyncExternalStore } from "react";

// Ordinals follow the browser's civil day, without DST-dependent millisecond deltas.
const DAY_MS = 86400000;
export function localDay(date = new Date()): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
const numericDate = new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
export const formatDay = (day: number, compact = false) => (compact ? numericDate : dateFormat).format(day * DAY_MS);
export const dayIso = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

const subscribers = new Set<() => void>();
let timer: number | undefined;
function refresh() {
  window.clearTimeout(timer);
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 30);
  timer = window.setTimeout(refresh, Math.max(1, +next - +now));
  subscribers.forEach((listener) => listener());
}

function onVisibilityChange() { if (!document.hidden) refresh(); }
function subscribe(listener: () => void) {
  subscribers.add(listener);
  if (subscribers.size === 1) {
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibilityChange);
    refresh();
  }
  return () => {
    subscribers.delete(listener);
    if (!subscribers.size) {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

export function useLocalDay(): number | null {
  return useSyncExternalStore(subscribe, localDay, () => null);
}
