"use client";

import { useMemo, useSyncExternalStore } from "react";

/** Local, per-identity presentation and activity. Not an auth source and never
 * copied to a cloud build, a shared JSON backup or assistant context. */
const PREFIX = "rustflow:cabinet:v1:";
const CHANGE = "rustflow:cabinet-change";
const memory = new Map<string, string>();
export const COLORS = { glass: "Стекло", rust: "Ржавчина", silver: "Серебро", pine: "Хвоя", ice: "Лёд" } as const;
export const ICONS = { initials: "Инициалы / фото", gamepad: "Геймпад", flame: "Пламя", hex: "Кристалл" } as const;
export interface Identity { nickname: string; color: keyof typeof COLORS; icon: keyof typeof ICONS; social: string }
interface Cabinet extends Identity { builds: number; recentIds: string[]; applied: string[] }
const defaults: Cabinet = { nickname: "", color: "glass", icon: "initials", social: "", builds: 0, recentIds: [], applied: [] };
function read(id?: string) {
  if (!id || typeof window === "undefined") return null;
  try { return memory.get(id) ?? localStorage.getItem(PREFIX + id); } catch { return memory.get(id) ?? null; }
}
function parse(raw: string | null): Cabinet {
  try {
    if (!raw || raw.length > 32_000) return defaults;
    const c = JSON.parse(raw);
    const str = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0,max) : "";
    const ids = (v: unknown, n: number) => Array.isArray(v) ? [...new Set(v.filter((s): s is string => typeof s === "string" && /^[a-z\d_-]{1,64}$/i.test(s)))].slice(0,n) : [];
    return { nickname: str(c.nickname,36), social: str(c.social,160), color: Object.hasOwn(COLORS,c.color) ? c.color : "glass",
      icon: Object.hasOwn(ICONS,c.icon) ? c.icon : "initials", builds: Number.isSafeInteger(c.builds) && c.builds > 0 ? c.builds : 0,
      recentIds: ids(c.recentIds,24), applied: ids(c.applied,160) };
  } catch { return defaults; }
}
function subscribe(fn: () => void) {
  const other = (e: StorageEvent) => { if (!e.key || e.key.startsWith(PREFIX)) fn(); };
  window.addEventListener(CHANGE,fn); window.addEventListener("storage",other);
  return () => { window.removeEventListener(CHANGE,fn); window.removeEventListener("storage",other); };
}
export function useCabinet(id?: string) {
  const raw = useSyncExternalStore(subscribe, () => read(id), () => null);
  return useMemo(() => parse(raw), [raw]);
}
function update(id: string, change: (old: Cabinet) => Cabinet) {
  const next = JSON.stringify(change(parse(read(id))));
  try { localStorage.setItem(PREFIX + id,next); memory.delete(id); } catch { memory.set(id,next); }
  window.dispatchEvent(new Event(CHANGE));
  return !memory.has(id);
}
export const saveIdentity = (id: string, fields: Identity) => update(id, c => ({ ...c, ...fields }));

// Attribute actions, not visits, to the identity actually using the device.
let actor: string | undefined;
export function setCabinetActor(id?: string) { actor = id; }
export function countBuild(buildId: string, id = actor) {
  if (id) update(id, c => c.recentIds.includes(buildId) ? c : { ...c, builds: c.builds + 1, recentIds: [buildId,...c.recentIds].slice(0,24) });
}
export function countTweak(slug: string, applied: boolean) {
  if (actor) update(actor, c => ({ ...c, applied: [...c.applied.filter(s => s !== slug), ...(applied ? [slug] : [])] }));
}
export function resetCabinetTweaks() { if (actor) update(actor, c => ({ ...c, applied: [] })); }
