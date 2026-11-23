/** Optional on disk: a v1 build without these keys is the original coast benchmark. */
export const PLAY_OPTIONS = {
  scenario: [
    { value: "coast", label: "Соло / Фарм", cpu: 1, gpu: 1, low: 1 },
    { value: "pvp", label: "Активное PvP / Монументы", cpu: .85, gpu: .92, low: .94 },
    { value: "raid", label: "Клан-рейд / 300+ онлайн", cpu: .627, gpu: .63, low: .90 },
  ],
  latencyMode: [
    { value: "standard", label: "Стандарт" }, { value: "on", label: "NVIDIA Reflex / Anti-Lag (Вкл)" },
    { value: "boost", label: "Reflex + Boost (Мин. инпут-лаг)" },
  ],
  backgroundLoad: [
    { value: "game", label: "Только игра", reserveGb: 0, cpuCost: 0 },
    { value: "apps", label: "+ Discord и браузер", reserveGb: 3, cpuCost: .035 },
    { value: "stream", label: "+ Запись откатов / Стрим", reserveGb: 6, cpuCost: .09 },
  ],
  gcBuffer: [{ value: "auto", label: "Авто по RAM" }, { value: "2048", label: "2048 МБ" }, { value: "4096", label: "4096 МБ" }],
  renderStyle: [
    { value: "esports", label: "Макс. читаемость врагов (Киберспорт)" },
    { value: "balanced", label: "Сбалансированный" }, { value: "clear", label: "Четкая картинка без мыла" },
  ],
} as const;
export type PlayKey = keyof typeof PLAY_OPTIONS;
export type PlaySettings = { [K in PlayKey]?: typeof PLAY_OPTIONS[K][number]["value"] };
export type RustScenario = NonNullable<PlaySettings["scenario"]>;
export const PLAY_KEYS = Object.keys(PLAY_OPTIONS) as PlayKey[];
export const PLAY_DEFAULTS = { scenario: "coast", latencyMode: "standard", backgroundLoad: "game", gcBuffer: "auto", renderStyle: "balanced" } as const satisfies Required<PlaySettings>;

/** Shared allowlist for backup/account/benchmark input and both ZIP URLs. */
export function readPlaySettings(read: (key: PlayKey) => unknown): PlaySettings | null {
  const entries: [PlayKey, string][] = [];
  for (const key of PLAY_KEYS) {
    const value = read(key);
    if (value === undefined || value === null) continue;
    if (typeof value !== "string" || !PLAY_OPTIONS[key].some(option => option.value === value)) return null;
    entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

export const backgroundBudget = (s?: PlaySettings) => PLAY_OPTIONS.backgroundLoad.find(p => p.value === s?.backgroundLoad) ?? PLAY_OPTIONS.backgroundLoad[0];
export const gcForMemory = (gb: number) => gb >= 32 ? 4096 : gb >= 16 ? 2048 : 1024;
export function gcBudget(ram: number, s?: PlaySettings) {
  const available = Math.max(1, ram - backgroundBudget(s).reserveGb);
  const auto = gcForMemory(ram);
  const mb = s?.gcBuffer === "4096" ? 4096 : s?.gcBuffer === "2048" ? 2048 : auto;
  return { available, auto, mb };
}
export function supportedLatency(mode: PlaySettings["latencyMode"], vendor?: string) {
  if (!mode || mode === "standard" || (vendor !== "amd" && vendor !== "nvidia")) return "standard";
  return mode === "boost" && vendor === "nvidia" ? "boost" : "on";
}
