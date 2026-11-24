/** Palette IDs are stable storage values; dark/light remain the colour schemes. */
export const MATERIALS = [
  { id: "amber", name: "Янтарный закат", finish: "Ember glass", swatch: "#e9743b", vip: false },
  { id: "pearl", name: "Светлый перламутр", finish: "Crystal light", swatch: "#dfe7f5", vip: false },
  { id: "ruby", name: "Кибер-Рубин", finish: "Red Liquid", swatch: "#e44c64", vip: false },
  { id: "emerald", name: "Изумрудный Токсик", finish: "Military Rust", swatch: "#78b778", vip: false },
  { id: "rust", name: "Оригинальные цвета Rust", finish: "Оксид / сталь", swatch: "#CD412B", vip: false },
  { id: "liquid", name: "Полный Liquid (Чистое стекло)", finish: "Прозрачный хрусталь", swatch: "#cccccc", vip: false },
  { id: "ice", name: "Арктический лед", finish: "Ice Glass", swatch: "#8dd8ee", vip: true },
  { id: "amethyst", name: "Королевский аметист", finish: "Purple Neon", swatch: "#b18af0", vip: true },
  { id: "obsidian", name: "Графитовый стелс", finish: "Pure Obsidian", swatch: "#8993a1", vip: true },
  { id: "gold", name: "Золотой слиток", finish: "Sulfur Gold", swatch: "#ebc359", vip: true },
] as const;
export type Material = typeof MATERIALS[number];
export type MaterialId = Material["id"];
export const material = (id: unknown) => MATERIALS.find(m => m.id === id);
export const PUBLIC_THEME_KEY = "rustflow:theme";
export const ENGINE_KEY = "rustflow:glass-studio:v1:";
export const PRO_TEASER = "Войдите в профиль, чтобы разблокировать 4 эксклюзивные темы в Настройках, облачное сохранение сборок и сохранение настроек студии Liquid Glass";

export const ANIMATIONS = [
  { value: "standard", label: "Стандарт (120 Гц)" }, { value: "spring", label: "Ультра-плавные пружины" }, { value: "instant", label: "Киберспорт (мгновенный отклик)" },
] as const;
export const WALLPAPERS = [
  { value: "drift", label: "Спокойный дрейф" }, { value: "fusion", label: "Активное слияние капель" }, { value: "still", label: "Статичный фон" },
] as const;
export interface Engine { blur: number; shine: number; motion: typeof ANIMATIONS[number]["value"]; wallpaper: typeof WALLPAPERS[number]["value"] }
export const DEFAULT_ENGINE: Engine = { blur: 20, shine: 100, motion: "spring", wallpaper: "still" };
export type Studio = Engine & { vip: MaterialId | null };
export const defaultStudio: Studio = { ...DEFAULT_ENGINE, vip: null };
export function parseStudio(raw: string | null): Studio {
  try {
    if (!raw || raw.length > 1024) return defaultStudio;
    const p = JSON.parse(raw);
    const number = (v: unknown, min: number, max: number, fallback: number) => typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, Math.round(v))) : fallback;
    const vip = material(p?.vip);
    return { blur: number(p?.blur, 8, 40, DEFAULT_ENGINE.blur), shine: number(p?.shine, 20, 100, DEFAULT_ENGINE.shine),
      motion: ANIMATIONS.find(o => o.value === p?.motion)?.value ?? DEFAULT_ENGINE.motion,
      wallpaper: WALLPAPERS.find(o => o.value === p?.wallpaper)?.value ?? DEFAULT_ENGINE.wallpaper, vip: vip?.vip ? vip.id : null };
  } catch { return defaultStudio; }
}
