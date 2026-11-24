"use client";

import { useSyncExternalStore } from "react";
import type { GraphicsProfileId } from "@/lib/graphics-profiles";

export type SetupLanguage = "ru" | "en";
export type SetupGoal = "fps" | "smooth" | "balanced";
export interface Setup { version: 1; language: SetupLanguage; goal: SetupGoal; accepted: true }
export const SETUP_KEY = "shift_onboarding_v5_completed";
export const SETUP_EVENT = "shift:setup-change";
export const RESTART_SETUP = "shift:restart-setup";
let memory: Setup | null = null;
let inMemoryOnly = false;
let cachedRaw: string | null | undefined;
let cached: Setup | null = null;

export function readSetup(): Setup | null {
  if (typeof window === "undefined") return null;
  if (inMemoryOnly) return memory;
  let raw: string | null;
  try { raw = localStorage.getItem(SETUP_KEY); } catch { return memory; }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (value && typeof value === "object") {
      const v = value as Partial<Setup>;
      if (v.version === 1 && v.accepted === true && (v.language === "ru" || v.language === "en") &&
          (v.goal === "fps" || v.goal === "smooth" || v.goal === "balanced")) {
        cached = { version: 1, accepted: true, language: v.language, goal: v.goal };
        return cached;
      }
    }
  } catch { /* A damaged preference starts setup again. */ }
  cached = null;
  return null;
}
export function saveSetup(language: SetupLanguage, goal: SetupGoal): void {
  const next: Setup = { version: 1, accepted: true, language, goal };
  memory = next;
  try { localStorage.setItem(SETUP_KEY, JSON.stringify(next)); cachedRaw = undefined; inMemoryOnly = false; }
  catch { cached = next; inMemoryOnly = true; }
  window.dispatchEvent(new Event(SETUP_EVENT));
}
function subscribe(callback: () => void) {
  window.addEventListener(SETUP_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(SETUP_EVENT, callback); window.removeEventListener("storage", callback); };
}
export function useSetup() { return useSyncExternalStore(subscribe, readSetup, () => null); }
export function recommendedProfile(goal: SetupGoal | undefined): GraphicsProfileId {
  return goal === "fps" ? "potato" : goal === "balanced" ? "balanced" : "competitive";
}
