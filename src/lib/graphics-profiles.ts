import { mergeGraphicsCfg } from "./cfg-merge";
import { isMonitorHz, type ConfigTuning } from "./models/build-settings";
import { gcBudget, gcForMemory, supportedLatency } from "./models/play-settings";
export { gcForMemory } from "./models/play-settings";

// Conservative starting points, not measured FPS gains. Rust may clamp or
// remove convars after updates; verify them in F1 on the installed version.
export const GRAPHICS_PROFILES = [
  { id: "competitive", title: "Комбат / PvP", short: "Комбат", draw: 1500, shader: 200, water: 0, shadows: 0, cpu: 1, gpu: 1,
    hint: "Низкая дальность, минимальная трава и эффекты. Проверьте результат в своей сцене." },
  { id: "balanced", title: "Баланс", short: "Баланс", draw: 1600, shader: 300, water: 1, shadows: 1, cpu: .92, gpu: .76,
    hint: "Умеренная детализация без дорогих постэффектов." },
  { id: "quality", title: "Красота", short: "Качество", draw: 2200, shader: 400, water: 2, shadows: 2, cpu: .86, gpu: .60,
    hint: "Детализация и вода; текстуры подберите по объёму VRAM." },
  { id: "potato", title: "Слабый ПК / Ультра-картошка", short: "Potato", draw: 1200, shader: 100, water: 0, shadows: 0, cpu: 1, gpu: 1.08,
    hint: "Нативный масштаб рендера; проверяйте качество изображения и FPS." },
  { id: "realistic", title: "Реалистичность", short: "Реалистичность", draw: 2500, shader: 600, water: 2, shadows: 3, cpu: .78, gpu: .43,
    hint: "Тени, освещение и детали для мощного ПК и съёмки." },
] as const;

export type GraphicsProfileId = typeof GRAPHICS_PROFILES[number]["id"];
export const getGraphicsProfile = (id: unknown) => GRAPHICS_PROFILES.find((p) => p.id === id);

export function graphicsCommands(id: GraphicsProfileId, ramGb: number) {
  const p = getGraphicsProfile(id) ?? GRAPHICS_PROFILES[1];
  const level = p.shadows;
  return {
    "fps.limit": 0,
    "graphics.quality": level >= 2 ? 3 : level === 1 ? 2 : 1,
    "graphics.drawdistance": p.draw,
    "graphics.lodbias": level === 0 ? 1 : level === 1 ? 0.8 : 1.2,
    "graphics.shaderlod": p.shader,
    "graphics.shadowquality": level,
    // Current community documentation lists 50 as the minimum and notes
    // that shadows cannot be disabled with shadowmode 0 on newer versions.
    "graphics.shadowmode": level === 0 ? 1 : 2,
    "graphics.shadowcascades": level < 2 ? 1 : level === 2 ? 2 : 4,
    "graphics.shadowdistance": [50, 100, 300, 400][level],
    "graphics.shadowlights": level === 0 ? 1 : level === 1 ? 1 : level === 2 ? 2 : 3,
    "graphics.grassshadows": level >= 2 ? "True" : "False",
    "graphics.contactshadows": level === 3 ? "True" : "False",
    "graphics.af": [8, 4, 8, 16][level],
    "graphics.parallax": level < 2 ? 0 : level === 2 ? 1 : 2,
    "graphics.branding": "False",
    "water.quality": p.water,
    "water.reflections": level === 3 ? 2 : level === 2 ? 1 : 0,
    "grass.quality": [0, 40, 75, 100][level],
    "grass.displacement": p.id === "potato" ? "False" : "True",
    "tree.quality": [100, 150, 200, 200][level],
    "tree.meshes": [25, 75, 100, 100][level],
    "terrain.quality": [25, 50, 75, 100][level],
    "mesh.quality": [50, 150, 200, 200][level],
    "decor.quality": [25, 25, 75, 100][level],
    "particle.quality": [25, 25, 75, 100][level],
    "effects.maxgibs": level === 0 ? 0 : level === 1 ? 500 : 1500,
    "effects.ao": level >= 2 ? "True" : "False",
    "effects.bloom": level >= 2 ? "True" : "False",
    "effects.motionblur": "False",
    "effects.antialiasing": level ? 3 : 0,
    "graphics.renderscale": 1,
    "graphics.dlss": -1,
    "graphics.dlaa": 0,
    "graphics.reflexlatencymarker": "False",
    "graphicssettings.pixellightcount": 0,
    "graphicssettings.particleraycastbudget": 4,
    "graphicssettings.softparticles": "False",
    "graphics.volumetric_clouds": 0,
    "ui.showinventoryplayer": "True",
    "ui.inventoryplayerquality": 0,
    "graphicssettings.billboardsfacecameraposition": "False",
    "graphicssettings.anisotropicfiltering": 1,
    "gc.buffer": gcForMemory(ramGb),
  };
}

export const textureMipForVram = (vram: number, full = false) => vram < 8 ? 3 : vram < 16 ? 2 : full ? 0 : 1;

export function profileCfg(id: GraphicsProfileId, ramGb: number, base = "", textureMip?: number, tuning?: ConfigTuning, vendor?: string) {

  const baseCommands = graphicsCommands(id, ramGb);
  const latency = supportedLatency(tuning?.latencyMode, vendor);
  const changes = {
    ...baseCommands,
    ...(textureMip !== undefined ? { "graphics.texturequality": textureMip, "graphicssettings.globaltexturemipmaplimit": textureMip } : {}),
    ...(vendor === "nvidia" ? { "graphics.reflexmode": 1 } : {}),
    "gc.buffer": gcBudget(ramGb, tuning).mb,
    ...(tuning?.scenario === "raid" ? { "effects.maxgibs": 0 } : {}),
    ...(tuning?.latencyMode ? {
      "graphics.reflexmode": vendor === "nvidia" ? (latency === "boost" ? 2 : latency === "on" ? 1 : 0) : 0,
      ...(latency !== "standard" ? { "graphics.vsync": 0 } : {}),
    } : {}),
    ...(tuning?.renderStyle === "esports" ? { "graphics.grassshadows": "False", "effects.ao": "False", "effects.antialiasing": 0 } : {}),
    ...(tuning?.renderStyle === "clear" ? { "effects.bloom": "False", "effects.motionblur": "False" } : {}),
    ...(isMonitorHz(tuning?.monitorHz) ? { "fps.limit": tuning.monitorHz } : {}),
  };
  if (base) return mergeGraphicsCfg(base, changes);
  return Object.entries(changes).map(([key, value]) => `${key} "${value}"`).join("\n");
}
