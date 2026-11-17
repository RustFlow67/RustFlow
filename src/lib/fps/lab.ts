"use client";

import { useSyncExternalStore } from "react";

/**
 * Настройки FPS-лаборатории: живые контролы визуальной нагрузки.
 * Каждый контрол реально меняет нагрузку рендера → FPS реагирует.
 * Хранится в localStorage, применяется через CSS-переменные и data-атрибуты.
 */

export interface LabSettings {
  /** Базовый радиус blur стекла, px (0–40). */
  blur: number;
  /** Дополнительные стеклянные слои фона (0–6). */
  layers: number;
  /** Число частиц в ParticleField (0–420). */
  particles: number;
  /** Интенсивность свечений/bloom (0–2). */
  glow: number;
  /** Скорость анимаций (0.25–2.5). */
  speed: number;
  /** Сила преломления SVG-линзы (0–100). */
  refraction: number;
  /** Масштаб DPR canvas (0.5–2). */
  quality: number;
  /** Стресс-режим: всё на максимум + штормовая анимация. */
  stress: boolean;
}

export const LAB_KEY = "rustflow:lab:v1";
const LAB_EVENT = "rustflow:lab-change";

export const LAB_DEFAULTS: LabSettings = {
  blur: 20,
  layers: 3,
  particles: 170,
  glow: 1,
  speed: 1,
  refraction: 55,
  quality: 1,
  stress: false,
};

export const LAB_LIMITS: Record<
  keyof Omit<LabSettings, "stress">,
  { min: number; max: number; step: number }
> = {
  blur: { min: 0, max: 40, step: 1 },
  layers: { min: 0, max: 6, step: 1 },
  particles: { min: 0, max: 420, step: 10 },
  glow: { min: 0, max: 2, step: 0.1 },
  speed: { min: 0.25, max: 2.5, step: 0.05 },
  refraction: { min: 0, max: 100, step: 1 },
  quality: { min: 0.5, max: 2, step: 0.25 },
};

function clamp(v: number, min: number, max: number): number {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function sanitize(raw: Partial<LabSettings> | null | undefined): LabSettings {
  const out: LabSettings = { ...LAB_DEFAULTS };
  if (!raw || typeof raw !== "object") return out;
  (Object.keys(LAB_LIMITS) as (keyof typeof LAB_LIMITS)[]).forEach((key) => {
    const lim = LAB_LIMITS[key];
    const v = Number((raw as Record<string, unknown>)[key]);
    if (Number.isFinite(v)) out[key] = clamp(v, lim.min, lim.max);
  });
  out.stress = Boolean(raw.stress);
  return out;
}

function readStored(): LabSettings {
  if (typeof window === "undefined") return { ...LAB_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(LAB_KEY);
    if (!raw) return { ...LAB_DEFAULTS };
    return sanitize(JSON.parse(raw) as Partial<LabSettings>);
  } catch {
    return { ...LAB_DEFAULTS };
  }
}

let cache: LabSettings | null = null;
const listeners = new Set<() => void>();

function snapshot(): LabSettings {
  if (!cache) cache = readStored();
  return cache;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  if (typeof window !== "undefined") {
    const onExternal = () => {
      cache = null;
      fn();
    };
    window.addEventListener(LAB_EVENT, onExternal);
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(fn);
      window.removeEventListener(LAB_EVENT, onExternal);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => {
    listeners.delete(fn);
  };
}

function onStorage(e: StorageEvent) {
  if (e.key === LAB_KEY) {
    cache = null;
    listeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* noop */
      }
    });
  }
}

/** Применяет настройки к DOM: CSS-переменные, data-атрибуты, SVG-линза. */
export function applyLabToDom(s: LabSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const eff: LabSettings = s.stress
    ? { blur: 40, layers: 6, particles: 420, glow: 2, speed: 2.2, refraction: 100, quality: 2, stress: true }
    : s;
  root.style.setProperty("--lab-blur", `${eff.blur}px`);
  root.style.setProperty("--lab-glow", String(eff.glow));
  root.style.setProperty("--lab-speed", String(eff.speed));
  root.style.setProperty("--lab-quality", String(eff.quality));
  root.setAttribute("data-lab-layers", String(eff.layers));
  root.toggleAttribute("data-lab-stress", eff.stress);
  const lens = document.getElementById("lg-refract-scale") as unknown as {
    setAttribute?: (k: string, v: string) => void;
  } | null;
  try {
    lens?.setAttribute?.("scale", String(Math.round((eff.refraction / 100) * 90)));
  } catch {
    /* noop */
  }
}

function persist(next: LabSettings) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(LAB_KEY, JSON.stringify(next));
    } catch {
      /* quota/private — настройки живут в памяти сессии */
    }
    window.dispatchEvent(new CustomEvent(LAB_EVENT));
  }
  applyLabToDom(next);
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}

export function setLab(patch: Partial<LabSettings>) {
  persist(sanitize({ ...snapshot(), ...patch }));
}

export function resetLab() {
  persist({ ...LAB_DEFAULTS });
}

export function randomizeLab() {
  const pick = (min: number, max: number, step: number) => {
    const n = Math.round((min + Math.random() * (max - min)) / step) * step;
    return Math.round(n * 100) / 100;
  };
  persist(
    sanitize({
      blur: pick(8, 40, 1),
      layers: pick(1, 6, 1),
      particles: pick(60, 420, 10),
      glow: pick(0.4, 2, 0.1),
      speed: pick(0.5, 2.2, 0.05),
      refraction: pick(20, 100, 1),
      quality: pick(0.75, 2, 0.25),
      stress: false,
    }),
  );
}

export function getLabSnapshot(): LabSettings {
  return snapshot();
}

const serverSnapshot: LabSettings = { ...LAB_DEFAULTS };

export function useLab(): { settings: LabSettings; set: typeof setLab } {
  const settings = useSyncExternalStore(subscribe, snapshot, () => serverSnapshot);
  return { settings, set: setLab };
}

/** Эффективные значения с учётом стресс-режима (для canvas). */
export function effectiveLab(s: LabSettings): LabSettings {
  if (!s.stress) return s;
  return { blur: 40, layers: 6, particles: 420, glow: 2, speed: 2.2, refraction: 100, quality: 2, stress: true };
}
