import { graphicsCommands, profileCfg, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { getCpu, getGpu } from "@/lib/hardware";
import { evaluateBuild10 } from "./build";
import { type UserOwnedRecord } from "./common";
import { frameMs } from "./fps-calibration";
import { PRESET_ESTIMATES, type PresetEstimate } from "./preset-estimates";

/**
 * Конфигурации железа, шаблоны client.cfg и расчётные диапазоны FPS.
 */

export type PresetTier = "budget" | "sweetspot" | "mid-high" | "flagship";
export type PresetResolution = "1080p" | "1440p" | "4k";

export const PRESET_TIER_ORDER: readonly PresetTier[] = ["budget", "sweetspot", "mid-high", "flagship"];

export const PRESET_TIER_LABEL: Record<PresetTier, string> = {
  budget: "Бюджет",
  sweetspot: "Средний класс / Оптимум",
  "mid-high": "Предтоп / X3D и 2K",
  flagship: "Флагманы / Без компромиссов",
};

export const PRESET_FPS_SOURCE_LABEL = {
  estimate: "Оценка FPS · не замер",
} as const;

export const PRESET_SERVER = { modded: "MODDED 2X", official: "OFFICIAL" } as const;

export interface PresetSettingsSummary {
  graphicsQuality: string;
  drawDistance: number;
  shadowCascades: string;
  shadowQuality: number;
  waterQuality: number;
  shaderLevel: number;
  treeQuality: number;
  maxGibs: number;
  upscaler: string;
  reflexOrAntiLag: string;
  gcBuffer: number;
}

export interface HardwarePreset extends UserOwnedRecord {
  slug: string;
  title: string;
  badge: string;
  featured?: boolean;
  tier: PresetTier;
  priceOrder: number;
  cpuId: string;
  cpu: string;
  gpuId: string;
  gpu: string;
  vramGb: number;
  ram: string;
  ramGb: number;
  ramMhz: number;
  ramCl: number;
  storageId: "hdd" | "sata" | "nvme";
  nvmeGen?: 3 | 4 | 5;
  storage: string;
  resolution: PresetResolution;
  fpsSource: keyof typeof PRESET_FPS_SOURCE_LABEL;
  /** Диапазон среднего FPS для заданного сценария MODDED 2X. */
  fpsModded: [number, number];
  /** Диапазон среднего FPS для заданного сценария OFFICIAL. */
  fpsOfficial: [number, number];
  low1Modded: number;
  low1Official: number;
  frametimeModdedMs: number;
  frametimeOfficialMs: number;
  score10: number;
  bottleneckNote: string;
  testScene: string;
  launchOptions: string;
  settings: PresetSettingsSummary;
  cfgText: string;
  keyTweaks: string[];
  driverNote: string;
}

function makeCfg(s: {
  draw: number;
  shadowMode: number;
  shadowQuality: number;
  cascades: number;
  shadowDist: number;
  shader: number;
  water: number;
  refl: number;
  tree: number;
  meshes: number;
  grass: number;
  af: number;
  lodbias: number;
  aa: number;
  gc: number;
  reflex: number;
}): string {
  const mode: GraphicsProfileId = s.shader >= 600 ? "realistic" : s.shader >= 350 ? "quality" : s.shader >= 225 ? "balanced" : "competitive";
  return profileCfg(mode, s.gc >= 4096 ? 32 : 16);
}

type EstimateFields = Pick<HardwarePreset, "fpsSource" | "fpsModded" | "fpsOfficial" | "low1Modded" | "low1Official" | "frametimeModdedMs" | "frametimeOfficialMs" | "score10" | "testScene">;
type PresetRecord = Omit<HardwarePreset, keyof EstimateFields>;
const REFERENCE_PRESETS: PresetRecord[] = [
  {
    id: "preset_5600x_5060",
    ownerId: "system",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    slug: "r5-5600x-rtx-5060-32gb",
    title: "Ryzen 5 5600X + RTX 5060",
    badge: "Эталон 1080p",
    featured: true,
    tier: "sweetspot",
    priceOrder: 2.5,
    cpuId: "ryzen-5-5600x",
    cpu: "AMD Ryzen 5 5600X (PBO On)",
    gpuId: "geforce-rtx-5060",
    gpu: "GeForce RTX 5060 8 ГБ",
    vramGb: 8,
    ram: "32 ГБ (2×16 ГБ) DDR4-3600 CL18",
    ramGb: 32,
    ramMhz: 3600,
    ramCl: 18,
    storageId: "nvme", nvmeGen: 4,
    storage: "NVMe SSD PCIe 4.0 (1 ТБ)",
    resolution: "1080p",
    bottleneckNote: "Упор в однопоток/L3-кэш 5600X на плотной застройке; RTX 5060 в 1080p держит запас, но следите за 8 ГБ VRAM.",
    launchOptions: "-window-mode exclusive",
    settings: {
      graphicsQuality: "3 (Medium — чтобы не ронять текстуры на 8 ГБ VRAM)",
      drawDistance: 1750,
      shadowCascades: "Без каскадов (1)",
      shadowQuality: 1,
      waterQuality: 0,
      shaderLevel: 250,
      treeQuality: 100,
      maxGibs: 0,
      upscaler: "DLAA / TSSAA (DLSS Качество не даёт FPS при упоре в CPU)",
      reflexOrAntiLag: "NVIDIA Reflex: Вкл. + Boost",
      gcBuffer: 4096,
    },
    cfgText: makeCfg({
      draw: 1750,
      shadowMode: 1,
      shadowQuality: 1,
      cascades: 1,
      shadowDist: 100,
      shader: 250,
      water: 0,
      refl: 0,
      tree: 100,
      meshes: 80,
      grass: 25,
      af: 4,
      lodbias: 1.5,
      aa: 3,
      gc: 4096,
      reflex: 2,
    }),
    keyTweaks: ["xmp-expo-timings", "gc-buffer", "ultimate-power-plan", "preset-competitive", "nvidia-panel", "game-mode-dvr"],
    driverNote: "Панель NVIDIA: макс. производительность, Shader Cache 10 ГБ, V-Sync выкл., Reflex On + Boost в игре.",
  },
  {
    id: "preset_3600_1660s",
    ownerId: "system",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    slug: "r5-3600-gtx-1660s-16gb",
    title: "Ryzen 5 3600 + GTX 1660 Super",
    badge: "Старт 1080p",
    tier: "budget",
    priceOrder: 2.5,
    cpuId: "ryzen-5-3600",
    cpu: "AMD Ryzen 5 3600",
    gpuId: "geforce-gtx-1660-super",
    gpu: "GeForce GTX 1660 Super 6 ГБ",
    vramGb: 6,
    ram: "16 ГБ (2×8 ГБ) DDR4-3200 CL16",
    ramGb: 16,
    ramMhz: 3200,
    ramCl: 16,
    storageId: "sata",
    storage: "SATA SSD (500 ГБ)",
    resolution: "1080p",
    bottleneckNote: "Оба узла близки к пределу; при 16 ГБ RAM обязательно держите авто-подкачку на SSD и закрывайте браузер.",
    launchOptions: "-window-mode exclusive",
    settings: {
      graphicsQuality: "2 (Low — экономия 6 ГБ VRAM)",
      drawDistance: 1500,
      shadowCascades: "Без каскадов (1)",
      shadowQuality: 0,
      waterQuality: 0,
      shaderLevel: 150,
      treeQuality: 50,
      maxGibs: 0,
      upscaler: "FSR Качество или натив + Sharpen",
      reflexOrAntiLag: "NVIDIA Reflex: Вкл. + Boost",
      gcBuffer: 2048,
    },
    cfgText: makeCfg({
      draw: 1500,
      shadowMode: 1,
      shadowQuality: 0,
      cascades: 1,
      shadowDist: 50,
      shader: 150,
      water: 0,
      refl: 0,
      tree: 50,
      meshes: 50,
      grass: 0,
      af: 1,
      lodbias: 1,
      aa: 0,
      gc: 2048,
      reflex: 2,
    }),
    keyTweaks: ["pagefile-auto", "background-apps", "gc-buffer", "preset-competitive", "xmp-expo-timings", "ultimate-power-plan"],
    driverNote: "Закрывайте Discord-оверлей и вкладки браузера: свободно должно быть ≥11 ГБ ОЗУ до старта Rust.",
  },
  {
    id: "preset_12400f_3060",
    ownerId: "system",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    slug: "i5-12400f-rtx-3060-16gb",
    title: "Core i5-12400F + RTX 3060 12 ГБ",
    badge: "Доступный PvP",
    tier: "budget",
    priceOrder: 9.5,
    cpuId: "core-i5-12400f",
    cpu: "Intel Core i5-12400F",
    gpuId: "geforce-rtx-3060",
    gpu: "GeForce RTX 3060 12 ГБ",
    vramGb: 12,
    ram: "16 ГБ (2×8 ГБ) DDR4-3200 CL16",
    ramGb: 16,
    ramMhz: 3200,
    ramCl: 16,
    storageId: "nvme", nvmeGen: 3,
    storage: "NVMe SSD PCIe 3.0 (1 ТБ)",
    resolution: "1080p",
    bottleneckNote: "12 ГБ VRAM хватает с запасом для чётких текстур; лучший недорогой апгрейд — добавить память до 32 ГБ.",
    launchOptions: "-window-mode exclusive",
    settings: {
      graphicsQuality: "4 (High — 12 ГБ VRAM позволяют без потери FPS)",
      drawDistance: 1750,
      shadowCascades: "Без каскадов (1)",
      shadowQuality: 1,
      waterQuality: 0,
      shaderLevel: 250,
      treeQuality: 100,
      maxGibs: 0,
      upscaler: "DLSS Качество или TSSAA",
      reflexOrAntiLag: "NVIDIA Reflex: Вкл. + Boost",
      gcBuffer: 2048,
    },
    cfgText: makeCfg({
      draw: 1750,
      shadowMode: 1,
      shadowQuality: 1,
      cascades: 1,
      shadowDist: 90,
      shader: 250,
      water: 0,
      refl: 0,
      tree: 100,
      meshes: 80,
      grass: 20,
      af: 4,
      lodbias: 1.5,
      aa: 3,
      gc: 2048,
      reflex: 2,
    }),
    keyTweaks: ["xmp-expo-timings", "gc-buffer", "pagefile-auto", "background-apps", "preset-competitive", "hags"],
    driverNote: "Включите XMP Gear 1 в BIOS и Resizable BAR; в игре держите gc.buffer 2048.",
  },
  {
    id: "preset_5700x3d_4060ti",
    ownerId: "system",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    slug: "r7-5700x3d-rtx-4060ti-32gb",
    title: "Ryzen 7 5700X3D + RTX 4060 Ti",
    badge: "Король AM4 · 3D V-Cache",
    tier: "sweetspot",
    priceOrder: 6.5,
    cpuId: "ryzen-7-5700x3d",
    cpu: "AMD Ryzen 7 5700X3D (96 МБ L3)",
    gpuId: "geforce-rtx-4060-ti",
    gpu: "GeForce RTX 4060 Ti 8 ГБ",
    vramGb: 8,
    ram: "32 ГБ (2×16 ГБ) DDR4-3600 CL16",
    ramGb: 32,
    ramMhz: 3600,
    ramCl: 16,
    storageId: "nvme", nvmeGen: 4,
    storage: "NVMe SSD PCIe 4.0 (1 ТБ)",
    resolution: "1080p",
    bottleneckNote: "96 МБ 3D V-Cache кардинально поднимают FPS возле огромных баз; ограничение — 8 ГБ VRAM у 4060 Ti.",
    launchOptions: "-window-mode exclusive",
    settings: {
      graphicsQuality: "3–4 (следите за заполнением 8 ГБ VRAM)",
      drawDistance: 2000,
      shadowCascades: "Без каскадов (1)",
      shadowQuality: 1,
      waterQuality: 1,
      shaderLevel: 300,
      treeQuality: 120,
      maxGibs: 0,
      upscaler: "DLSS Качество / TSSAA",
      reflexOrAntiLag: "NVIDIA Reflex: Вкл. + Boost",
      gcBuffer: 4096,
    },
    cfgText: makeCfg({
      draw: 2000,
      shadowMode: 2,
      shadowQuality: 1,
      cascades: 1,
      shadowDist: 150,
      shader: 300,
      water: 1,
      refl: 0,
      tree: 120,
      meshes: 100,
      grass: 40,
      af: 8,
      lodbias: 2,
      aa: 3,
      gc: 4096,
      reflex: 2,
    }),
    keyTweaks: ["gc-buffer", "xmp-expo-timings", "preset-balanced", "nvidia-panel", "hags", "game-mode-dvr"],
    driverNote: "Фиксированный Curve Optimizer не универсален. Начните со штатных настроек и проверяйте стабильность после каждого изменения.",
  },
  {
    id: "preset_7500f_7800xt",
    ownerId: "system",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    slug: "r5-7500f-rx-7800xt-32gb",
    title: "Ryzen 5 7500F + RX 7800 XT",
    badge: "Баланс 1440p · AM5",
    tier: "mid-high",
    priceOrder: 5,
    cpuId: "ryzen-5-7500f",
    cpu: "AMD Ryzen 5 7500F",
    gpuId: "radeon-rx-7800-xt",
    gpu: "Radeon RX 7800 XT 16 ГБ",
    vramGb: 16,
    ram: "32 ГБ (2×16 ГБ) DDR5-6000 CL30",
    ramGb: 32,
    ramMhz: 6000,
    ramCl: 30,
    storageId: "nvme", nvmeGen: 4,
    storage: "NVMe SSD PCIe 4.0 (2 ТБ)",
    resolution: "1440p",
    bottleneckNote: "Ровная связка для 1440p: 16 ГБ VRAM снимают любые вопросы к текстурам, DDR5-6000 CL30 минимизирует задержки.",
    launchOptions: "-window-mode exclusive",
    settings: {
      graphicsQuality: "5 (Very High)",
      drawDistance: 2200,
      shadowCascades: "Два каскада (2)",
      shadowQuality: 1,
      waterQuality: 1,
      shaderLevel: 350,
      treeQuality: 150,
      maxGibs: 0,
      upscaler: "Нативное 1440p + TSSAA + Sharpen",
      reflexOrAntiLag: "Radeon Anti-Lag: Вкл. (Chill и Enhanced Sync выкл.)",
      gcBuffer: 4096,
    },
    cfgText: makeCfg({
      draw: 2200,
      shadowMode: 2,
      shadowQuality: 1,
      cascades: 2,
      shadowDist: 180,
      shader: 350,
      water: 1,
      refl: 1,
      tree: 150,
      meshes: 100,
      grass: 50,
      af: 8,
      lodbias: 2,
      aa: 3,
      gc: 4096,
      reflex: 0,
    }),
    keyTweaks: ["xmp-expo-timings", "gc-buffer", "amd-adrenalin", "preset-balanced", "ultimate-power-plan"],
    driverNote: "В AMD Adrenalin: Anti-Lag On, Chill Off, Enhanced Sync Off, Smart Access Memory (ReBAR) включён в BIOS.",
  },
  {
    id: "preset_7800x3d_4070s",
    ownerId: "system",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    slug: "r7-7800x3d-rtx-4070s-32gb",
    title: "Ryzen 7 7800X3D + RTX 4070 Super",
    badge: "Турнирный 1440p",
    tier: "mid-high",
    priceOrder: 7,
    cpuId: "ryzen-7-7800x3d",
    cpu: "AMD Ryzen 7 7800X3D",
    gpuId: "geforce-rtx-4070-super",
    gpu: "GeForce RTX 4070 Super 12 ГБ",
    vramGb: 12,
    ram: "32 ГБ (2×16 ГБ) DDR5-6000 CL30",
    ramGb: 32,
    ramMhz: 6000,
    ramCl: 30,
    storageId: "nvme", nvmeGen: 4,
    storage: "NVMe SSD PCIe 4.0 (2 ТБ)",
    resolution: "1440p",
    bottleneckNote: "Эталонная связка под 165–240 Гц монитор в Rust; в тяжёлых сценах 1440p помогает DLSS Качество.",
    launchOptions: "-window-mode exclusive",
    settings: {
      graphicsQuality: "5 (Very High)",
      drawDistance: 2500,
      shadowCascades: "Два каскада (2)",
      shadowQuality: 2,
      waterQuality: 1,
      shaderLevel: 400,
      treeQuality: 160,
      maxGibs: 0,
      upscaler: "DLSS Качество (для стабильных 165+ FPS) или DLAA",
      reflexOrAntiLag: "NVIDIA Reflex: Вкл. + Boost",
      gcBuffer: 4096,
    },
    cfgText: makeCfg({
      draw: 2500,
      shadowMode: 2,
      shadowQuality: 2,
      cascades: 2,
      shadowDist: 220,
      shader: 400,
      water: 1,
      refl: 1,
      tree: 160,
      meshes: 100,
      grass: 60,
      af: 16,
      lodbias: 2.5,
      aa: 3,
      gc: 4096,
      reflex: 2,
    }),
    keyTweaks: ["gc-buffer", "xmp-expo-timings", "nvidia-panel", "hags", "preset-balanced", "launch-options"],
    driverNote: "Для G-SYNC монитора 165/240 Гц ограничьте fps.limit 161 / 235 + Reflex On + Boost для идеально ровного frametime.",
  },
  {
    id: "preset_9800x3d_5080",
    ownerId: "system",
    createdAt: "2026-01-15T12:00:00.000Z",
    updatedAt: "2026-01-15T12:00:00.000Z",
    slug: "r7-9800x3d-rtx-5080-32gb",
    title: "Ryzen 7 9800X3D + RTX 5080",
    badge: "Максимум 240 Гц",
    tier: "flagship",
    priceOrder: 7,
    cpuId: "ryzen-7-9800x3d",
    cpu: "AMD Ryzen 7 9800X3D",
    gpuId: "geforce-rtx-5080",
    gpu: "GeForce RTX 5080 16 ГБ",
    vramGb: 16,
    ram: "32 ГБ (2×16 ГБ) DDR5-6000 CL28",
    ramGb: 32,
    ramMhz: 6000,
    ramCl: 28,
    storageId: "nvme", nvmeGen: 4,
    storage: "NVMe SSD PCIe 4.0 (2 ТБ)",
    resolution: "1440p",
    bottleneckNote: "В плотных сценах чаще ограничивает главный поток Unity; в открытых при высоких настройках возможен упор и в GPU.",
    launchOptions: "-window-mode exclusive",
    settings: {
      graphicsQuality: "6 (Ultra)",
      drawDistance: 2500,
      shadowCascades: "Два каскада (2)",
      shadowQuality: 2,
      waterQuality: 2,
      shaderLevel: 600,
      treeQuality: 200,
      maxGibs: 0,
      upscaler: "DLAA (нативное 1440p)",
      reflexOrAntiLag: "NVIDIA Reflex: Вкл. + Boost",
      gcBuffer: 4096,
    },
    cfgText: makeCfg({
      draw: 2500,
      shadowMode: 2,
      shadowQuality: 2,
      cascades: 2,
      shadowDist: 350,
      shader: 600,
      water: 2,
      refl: 2,
      tree: 200,
      meshes: 100,
      grass: 80,
      af: 16,
      lodbias: 3,
      aa: 3,
      gc: 4096,
      reflex: 2,
    }),
    keyTweaks: ["gc-buffer", "xmp-expo-timings", "nvidia-panel", "preset-quality", "launch-options"],
    driverNote: "Отключите только motion blur, vignette, lens dirt и maxgibs — остальное можно держать на максимуме.",
  },
];

const GRAPHICS_PROFILES = {
  low: {
    label: "Низкий · лёгкие текстуры", tweak: "preset-competitive",
    shadowMode: 1, shadowQuality: 0, cascades: 1, shadowDist: 60,
    tree: 50, meshes: 50, grass: 0, af: 2, lodbias: 1, aa: 0,
  },
  balanced: {
    label: "Сбалансированный · средние текстуры", tweak: "preset-balanced",
    shadowMode: 2, shadowQuality: 1, cascades: 1, shadowDist: 150,
    tree: 100, meshes: 80, grass: 30, af: 8, lodbias: 1.5, aa: 3,
  },
  quality: {
    label: "Детальный · высокие текстуры", tweak: "preset-quality",
    shadowMode: 2, shadowQuality: 2, cascades: 2, shadowDist: 210,
    tree: 150, meshes: 100, grass: 45, af: 16, lodbias: 2, aa: 3,
  },
} as const;

function makeCatalogPreset(tier: PresetTier, spec: PresetEstimate, index: number): PresetRecord {
  const { cpuId, gpuId, resolution } = spec;
  const cpu = getCpu(cpuId);
  const gpu = getGpu(gpuId);
  if (!cpu || !gpu) throw new Error(`Unknown preset hardware: ${cpuId} / ${gpuId}`);
  const [ddr, modules, stickGb, ramMhz, ramCl] = spec.ram;
  const [pcie, ssdGb] = spec.ssd;
  const [profileId, draw, shader, water] = spec.graphics;
  const profile = GRAPHICS_PROFILES[profileId];
  const ramGb = modules * stickGb;
  const storageId = pcie === "sata" ? "sata" : "nvme";
  const nvidia = gpu.vendor === "nvidia";
  const amdCpu = cpu.group === "AMD Ryzen";
  const vram = `${gpu.vram} ГБ`;
  const gpuName = gpu.name.replace(/ \d+GB$/, "");
  const shortGpu = gpu.name.replace(/^(GeForce|Radeon) /, "").replace(/ (\d+)GB$/, " $1 ГБ");
  const title = `${cpu.name} + ${shortGpu}`;
  const gc = ramGb >= 32 ? 4096 : 2048;
  const cfg = { ...profile, draw, shader, water, refl: water === 2 ? 1 : 0, gc, reflex: nvidia ? 1 : 0 };
  const memoryProfile = ddr === "DDR5" && amdCpu ? "EXPO" : "XMP";
  const pboNote = spec.pbo ? " Сценарий предполагает PBO On с достаточным охлаждением, без фиксированного Curve Optimizer." : "";
  const intelNote = /core-i[579]-1[34]\d{3}k/.test(cpuId) ? " Обновите BIOS и придерживайтесь лимитов Intel Default Settings." : "";
  const createdAt = "2026-11-17T12:00:00.000Z";

  return {
    id: `preset_${cpuId}_${gpuId}`,
    ownerId: "system",
    createdAt,
    updatedAt: createdAt,
    slug: `${cpuId}-${gpuId}-${ramGb}gb`,
    title,
    badge: PRESET_FPS_SOURCE_LABEL.estimate,
    tier,
    priceOrder: index + 1,
    cpuId,
    cpu: `${amdCpu ? "AMD" : "Intel"} ${cpu.name}${spec.pbo ? " (PBO On)" : ""}`,
    gpuId,
    gpu: `${gpuName} ${vram}`,
    vramGb: gpu.vram,
    ram: `${ramGb} ГБ (${modules}×${stickGb} ГБ) ${ddr}-${ramMhz} CL${ramCl}`,
    ramGb,
    ramMhz,
    ramCl,
    storageId, nvmeGen: pcie === "sata" ? undefined : pcie,
    storage: `${pcie === "sata" ? "SATA SSD" : `NVMe SSD PCIe ${pcie}.0`} (${ssdGb < 1000 ? `${ssdGb} ГБ` : `${ssdGb / 1000} ТБ`})`,
    resolution,
    bottleneckNote: spec.bottleneck,
    launchOptions: "-window-mode exclusive",
    settings: {
      graphicsQuality: profile.label,
      drawDistance: draw,
      shadowCascades: profile.cascades === 1 ? "Без каскадов (1)" : "Два каскада (2)",
      shadowQuality: profile.shadowQuality,
      waterQuality: water,
      shaderLevel: shader,
      treeQuality: profile.tree,
      maxGibs: 0,
      upscaler: profile.aa ? "Нативное разрешение · TSSAA" : "Нативное разрешение · AA выкл.",
      reflexOrAntiLag: nvidia ? "NVIDIA Reflex: Вкл. (если доступно)" : "Reflex выкл. · Anti-Lag отдельно в драйвере",
      gcBuffer: gc,
    },
    cfgText: makeCfg(cfg),
    keyTweaks: ["gc-buffer", "xmp-expo-timings", profile.tweak, nvidia ? "nvidia-panel" : "amd-adrenalin"],
    driverNote: `${spec.driverNote ?? `Обновите драйвер ${nvidia ? "NVIDIA" : "AMD"}. ${memoryProfile} включайте, только если плата и комплект стабильны на этой частоте.`}${intelNote}${pboNote}`,
  };
}

const catalog = [
  ...REFERENCE_PRESETS,
  ...PRESET_TIER_ORDER.flatMap((tier) => PRESET_ESTIMATES[tier].map((spec, index) => makeCatalogPreset(tier, spec, index))),
];

export const PRESET_SCENE = "Фарм / Берег · нативное разрешение, без генерации кадров. MODDED 2X и многолюдный OFFICIAL.";

export const HARDWARE_PRESETS: HardwarePreset[] = catalog.map((p) => {
  const build = evaluateBuild10({ name: p.title, cpuId: p.cpuId, gpuId: p.gpuId, ramGb: p.ramGb,
    ramMhz: p.ramMhz, ramCl: p.ramCl, storage: p.storageId, nvmeGen: p.nvmeGen, resolution: "1080p" }, "competitive");
  if (!build) throw new Error(`Invalid preset hardware: ${p.slug}`);
  const { fpsModded: m, fpsOfficial: o } = build;
  // Legacy catalog rows contain older command sets. Rebuild every downloadable
  // config from the shared profile, including the reference presets.
  const mode: GraphicsProfileId = p.settings.shaderLevel >= 600 ? "realistic" : p.settings.shaderLevel >= 350 ? "quality" : p.settings.shaderLevel >= 225 ? "balanced" : "competitive";
  const c = graphicsCommands(mode, p.ramGb);
  return { ...p, cfgText: profileCfg(mode, p.ramGb), settings: { ...p.settings, graphicsQuality: mode === "competitive" ? "Комбат" : mode === "balanced" ? "Баланс" : mode === "quality" ? "Качество" : "Реалистичность",
    drawDistance: c["graphics.drawdistance"], shaderLevel: c["graphics.shaderlod"], waterQuality: c["water.quality"],
    shadowQuality: c["graphics.shadowquality"], shadowCascades: String(c["graphics.shadowcascades"]),
    treeQuality: c["tree.quality"], maxGibs: c["effects.maxgibs"], gcBuffer: c["gc.buffer"] },
    fpsSource: "estimate", fpsModded: [m.min, m.max], fpsOfficial: [o.min, o.max],
    low1Modded: m.low1, low1Official: o.low1, frametimeModdedMs: frameMs(m), frametimeOfficialMs: frameMs(o),
    score10: build.score10, testScene: PRESET_SCENE };
});
