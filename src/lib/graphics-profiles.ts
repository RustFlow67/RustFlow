import { getConnectionProfile, isMonitorHz, type ConfigTuning } from "./models/build-settings";

import { gcBudget, gcForMemory, supportedLatency } from "./models/play-settings";
export { gcForMemory } from "./models/play-settings";

/** Shared Rust graphics choices. The original catalog configurations are never mutated. */
export const GRAPHICS_PROFILES = [
  { id: "competitive", title: "Комбат / PvP", short: "Комбат", draw: 2500, shader: 100, water: 0, shadows: 0, cpu: 1, gpu: 1,
    hint: "Читаемость в бою: без теней травы, бликов и лишних эффектов." },
  { id: "balanced", title: "Баланс", short: "Баланс", draw: 2000, shader: 250, water: 1, shadows: 1, cpu: .92, gpu: .76,
    hint: "Повседневная игра с запасом для стабильного 1% low." },
  { id: "quality", title: "Красота", short: "Качество", draw: 2500, shader: 350, water: 2, shadows: 2, cpu: .86, gpu: .60,
    hint: "Детализация и вода; текстуры подберите по объёму VRAM." },
  { id: "realistic", title: "Реалистичность", short: "Реалистичность", draw: 2500, shader: 600, water: 2, shadows: 3, cpu: .78, gpu: .43,
    hint: "Тени, освещение и детали для мощного ПК и съёмки." },
] as const;

export type GraphicsProfileId = typeof GRAPHICS_PROFILES[number]["id"];
export const getGraphicsProfile = (id: unknown) => GRAPHICS_PROFILES.find((p) => p.id === id);

export function graphicsCommands(id: GraphicsProfileId, ramGb: number) {
  const p = getGraphicsProfile(id) ?? GRAPHICS_PROFILES[1];
  const detailed = p.shadows >= 2;
  return {
    "fps.limit": 0,
    "graphics.drawdistance": p.draw,
    "graphics.shaderlod": p.shader,
    "water.quality": p.water,
    "water.reflections": p.shadows === 3 ? 2 : 0,
    "graphics.shadowquality": p.shadows,
    "graphics.shadowmode": p.shadows > 0 ? 2 : 0,
    "graphics.shadowcascades": detailed ? 2 : 1,
    "graphics.shadowdistance": [50, 150, 250, 400][p.shadows],
    "graphics.shadowlights": p.shadows === 3 ? 3 : 0,
    "graphics.contactshadows": p.shadows === 3 ? "True" : "False",
    "graphics.impostorshadows": detailed ? "True" : "False",
    "graphics.grassshadows": detailed ? "True" : "False",
    "grass.displacement": detailed ? "True" : "False",
    "grass.quality": [0, 40, 65, 100][p.shadows],
    "tree.quality": [0, 70, 120, 200][p.shadows],
    "effects.ao": detailed ? "True" : "False",
    "effects.bloom": detailed ? "True" : "False",
    "effects.lensdirt": "False",
    "effects.shafts": p.shadows === 3 ? "True" : "False",
    "effects.motionblur": "False",
    "effects.antialiasing": p.shadows > 0 ? 3 : 0,
    "gc.buffer": gcForMemory(ramGb),
  };
}

export const textureMipForVram = (vram: number) => vram <= 4 ? 3 : vram <= 6 ? 2 : vram <= 8 ? 1 : 0;

export function profileCfg(id: GraphicsProfileId, ramGb: number, base = "", textureMip?: number, tuning?: ConfigTuning, vendor?: string) {
  const connection = getConnectionProfile(tuning?.connection);
  const baseCommands = graphicsCommands(id, ramGb);
  const scene = tuning?.scenario, bg = tuning?.backgroundLoad, style = tuning?.renderStyle;
  const latency = supportedLatency(tuning?.latencyMode, vendor);
  // Only real client commands here. Radeon Anti-Lag belongs in Adrenalin (ZIP readme).
  const changes = {
    ...baseCommands,
    "gc.buffer": gcBudget(ramGb, tuning).mb,
    ...(scene === "raid" || scene === "pvp" ? {
      "graphics.drawdistance": Math.min(baseCommands["graphics.drawdistance"], scene === "raid" ? 1600 : 2000),
      "effects.maxgibs": scene === "raid" ? 0 : 16,
    } : {}),
    ...(bg === "apps" || bg === "stream" ? { "graphics.shaderlod": Math.max(50, baseCommands["graphics.shaderlod"] - (bg === "stream" ? 50 : 25)) } : {}),
    ...(tuning?.latencyMode ? {
      "graphics.reflexmode": vendor === "nvidia" ? (latency === "boost" ? 2 : latency === "on" ? 1 : 0) : 0,
      ...(latency !== "standard" ? { "graphics.vsync": 0 } : {}),
    } : {}),
    ...(style === "esports" ? { "graphics.shadowquality": 0, "graphics.shadowmode": 0, "graphics.shadowdistance": 30,
      "graphics.shadowcascades": 1, "graphics.grassshadows": "False", "effects.ao": "False", "effects.antialiasing": 0 }
      : style === "clear" ? { "graphics.shadowquality": 2, "graphics.shadowmode": 2, "graphics.shadowcascades": 2,
        "graphics.shadowdistance": 180, "effects.antialiasing": 1, "effects.bloom": "False", "effects.motionblur": "False" } : {}),
    ...(textureMip === undefined ? {} : { "graphicssettings.globaltexturemipmaplimit": textureMip }),
    ...(isMonitorHz(tuning?.monitorHz) ? { "fps.limit": tuning.monitorHz } : {}),
    ...(connection ? { "lerp.enabled": "True", "lerp.interpolation": connection.interpolation, "lerp.smoothing": connection.smoothing } : {}),
  };
  const lines = base.split(/\r?\n/).filter((line) => line.trim() && !Object.hasOwn(changes, line.trim().split(/\s+/, 1)[0]));
  for (const [key, value] of Object.entries(changes)) lines.push(`${key} "${value}"`);
  return lines.join("\n");
}
