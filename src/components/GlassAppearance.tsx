"use client";

import { createContext, useContext, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { DOCK_KEY,readDock,type DockPosition } from "@/lib/dock-position";
import { quietMotion } from "./fx/velocity";
import { localAccount } from "@/lib/auth/local";
import { useAccount } from "./auth/AccountProvider";
import { DEFAULT_ENGINE, defaultStudio, ENGINE_KEY, material, parseStudio, PUBLIC_THEME_KEY, type Engine, type MaterialId } from "@/lib/materials";

const EVENT = "rustflow:appearance";
const memory = new Map<string, string>(); // Also works in storage-denied embeds.
function get(key: string) {
  try { return memory.get(key) ?? localStorage.getItem(key); } catch { return memory.get(key) ?? null; }
}
function put(key: string, value: string) {
  try { localStorage.setItem(key, value); memory.delete(key); } catch { memory.set(key, value); }
}
function subscribe(change: () => void) {
  const media = matchMedia("(prefers-color-scheme: light)");
  const storage = (e: StorageEvent) => { if (!e.key || e.key === DOCK_KEY || e.key === PUBLIC_THEME_KEY || e.key.startsWith(ENGINE_KEY)) change(); };
  window.addEventListener(EVENT, change); window.addEventListener("storage", storage); media.addEventListener("change", change);
  return () => { window.removeEventListener(EVENT, change); window.removeEventListener("storage", storage); media.removeEventListener("change", change); };
}
const server = () => "";
const publish = () => window.dispatchEvent(new Event(EVENT));
interface Appearance { dock:DockPosition; setDock:(p:DockPosition)=>void; id: MaterialId; engine: Engine; select: (id: MaterialId) => void; tune: (patch: Partial<Engine>) => void }
const Context = createContext<Appearance | null>(null);

export function GlassAppearance({ children }: { children: ReactNode }) {
  const { session } = useAccount();
  const [preview, setPreview] = useState(defaultStudio);
  const ready = session !== null;
  const key = session?.user ? ENGINE_KEY + session.user.id : null;
  const raw = useSyncExternalStore(subscribe, () => JSON.stringify([get(PUBLIC_THEME_KEY), key && get(key), matchMedia("(prefers-color-scheme: light)").matches]), server);
  const dock=useSyncExternalStore(subscribe,()=>readDock(get(DOCK_KEY)),()=>"bottom" as const);
  useLayoutEffect(()=>{
    const root=document.documentElement,bar=document.querySelector<HTMLElement>(".tabbar-bottom");
    // Wait for the client snapshot rather than replacing a prepainted saved Dock on hydration.
    if(!raw || root.dataset.dock===dock)return;
    const first=bar?.getBoundingClientRect();root.dataset.dock=dock;
    window.dispatchEvent(new Event("rustflow:dock-layout"));
    if(!bar || !first || quietMotion() || document.body.hasAttribute("data-popup-depth"))return;
    const last=bar.getBoundingClientRect();
    const move=bar.animate([{translate:`${first.x+first.width/2-last.x-last.width/2}px ${first.y+first.height/2-last.y-last.height/2}px`,scale:`${first.width/last.width} ${first.height/last.height}`},{translate:"0 0",scale:"1 1"}],{duration:440,easing:"cubic-bezier(.32,.72,0,1)"});
    return ()=>move.cancel();
  },[raw,dock]);
  const { id, engine } = useMemo(() => {
    const [stored, privatePrefs, light] = raw ? JSON.parse(raw) : [];
    const base = material(stored === "light" ? "pearl" : stored === "dark" ? "amber" : stored);
    const engine = key ? parseStudio(privatePrefs) : preview;
    const id = engine.vip ?? (base && !base.vip ? base.id : light ? "pearl" : "amber");
    return { id, engine };
  }, [raw, key, preview]);
  useLayoutEffect(() => {
    // Preserve an existing device finish through hydration, but don't make a
    // guest wait for the network before changing a public material.
    if (!raw || (!ready && localAccount())) return;
    const root = document.documentElement, light = id === "pearl";
    root.dataset.material = id; root.dataset.theme = light ? "light" : "dark"; root.style.colorScheme = root.dataset.theme;
    root.dataset.engineMotion = engine.motion; root.dataset.wallpaper = engine.wallpaper;
    root.style.setProperty("--rf-blur", `${engine.blur}px`); root.style.setProperty("--rf-shine", String(engine.shine / 100));
    if (engine.blur !== DEFAULT_ENGINE.blur) root.style.setProperty("--lg-native-blur", `${engine.blur}px`);
    else root.style.removeProperty("--lg-native-blur");
    const color = getComputedStyle(root).getPropertyValue("--bg").trim();
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", color));
  }, [raw, id, engine, ready]);
  return <Context.Provider value={{ id, engine, dock, setDock:p=>{put(DOCK_KEY,readDock(p));publish();},
    select: (id) => {
      const next = material(id);
      if (!next || (next.vip && !key)) return;
      if (!next.vip) put(PUBLIC_THEME_KEY, next.id);
      if (key) put(key, JSON.stringify({ ...parseStudio(get(key)), vip: next.vip ? next.id : null }));
      publish();
    },
    tune: patch => { if (key) { put(key, JSON.stringify({ ...parseStudio(get(key)), ...patch })); publish(); } else { setPreview(p=>({...p,...patch})); } },
  }}>{children}</Context.Provider>;
}
export function useAppearance() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing GlassAppearance");
  return value;
}
