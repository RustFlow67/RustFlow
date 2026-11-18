import { getConnectionProfile, isMonitorHz, type ConfigTuning } from "./models/build-settings";

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
export const gcForMemory = (ramGb: number) => ramGb >= 32 ? 4096 : ramGb >= 16 ? 2048 : 1024;

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

export function profileCfg(id: GraphicsProfileId, ramGb: number, base = "", textureMip?: number, tuning?: ConfigTuning) {
  const connection = getConnectionProfile(tuning?.connection);
  const changes = {
    ...graphicsCommands(id, ramGb),
    ...(textureMip === undefined ? {} : { "graphicssettings.globaltexturemipmaplimit": textureMip }),
    ...(isMonitorHz(tuning?.monitorHz) ? { "fps.limit": tuning.monitorHz } : {}),
    ...(connection ? { "lerp.enabled": "True", "lerp.interpolation": connection.interpolation, "lerp.smoothing": connection.smoothing } : {}),
  };
  const lines = base.split(/\r?\n/).filter((line) => line.trim() && !Object.hasOwn(changes, line.trim().split(/\s+/, 1)[0]));
  for (const [key, value] of Object.entries(changes)) lines.push(`${key} "${value}"`);
  return lines.join("\n");
}
