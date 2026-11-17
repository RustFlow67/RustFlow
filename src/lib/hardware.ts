import type { GpuVendor, PresetId } from "./tweaks/meta";

/**
 * PC rating model for Rust.
 *
 * The indexes below are approximate relative gaming-performance figures
 * (CPU: Ryzen 7 9800X3D = 100; GPU: relative raster performance at 1080p).
 * They are estimates used to rank hardware and to produce a ballpark FPS
 * range. They are not measurements of a specific PC.
 */

export type StorageId = "hdd" | "sata" | "nvme";
export type ResolutionId = "1080p" | "1440p" | "4k";
export type TierId = "S" | "A" | "B" | "C" | "D";
export type Bottleneck = "cpu" | "gpu" | "ram" | "balanced";

export const RAM_OPTIONS = [8, 12, 16, 24, 32, 64] as const;

export const STORAGE_OPTIONS: { id: StorageId; label: string }[] = [
  { id: "hdd", label: "HDD" },
  { id: "sata", label: "SATA SSD" },
  { id: "nvme", label: "NVMe SSD" },
];

export const RESOLUTION_OPTIONS: { id: ResolutionId; label: string }[] = [
  { id: "1080p", label: "1080p" },
  { id: "1440p", label: "1440p" },
  { id: "4k", label: "4K" },
];

export interface Cpu {
  id: string;
  name: string;
  group: string;
  idx: number;
}

export interface Gpu {
  id: string;
  name: string;
  group: string;
  idx: number;
  vram: number;
  vendor: "nvidia" | "amd" | "intel";
  key: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const cpus = (group: string, rows: [string, number][]): Cpu[] =>
  rows.map(([name, idx]) => ({ id: slug(name), name, group, idx }));

const gpus = (group: string, vendor: Gpu["vendor"], rows: [string, number, number][]): Gpu[] =>
  rows.map(([name, idx, vram]) => ({
    id: slug(name),
    name,
    group,
    idx,
    vram,
    vendor,
    key: name
      .toLowerCase()
      .replace(/^(geforce|radeon|intel)\s+/, "")
      .replace(/\s+laptop$/, ""),
  }));

export const CPUS: Cpu[] = [
  ...cpus("AMD Ryzen", [
    ["Ryzen 7 9800X3D", 100],
    ["Ryzen 9 9950X3D", 100],
    ["Ryzen 7 7800X3D", 95],
    ["Ryzen 9 7950X3D", 94],
    ["Ryzen 5 7600X3D", 90],
    ["Ryzen 9 9950X", 85],
    ["Ryzen 9 9900X", 83],
    ["Ryzen 7 9700X", 82],
    ["Ryzen 5 9600X", 80],
    ["Ryzen 7 5800X3D", 82],
    ["Ryzen 9 7950X", 82],
    ["Ryzen 9 7900X", 81],
    ["Ryzen 7 7700X", 80],
    ["Ryzen 7 7700", 79],
    ["Ryzen 5 7600X", 78],
    ["Ryzen 7 5700X3D", 78],
    ["Ryzen 5 7600", 76],
    ["Ryzen 5 7500F", 76],
    ["Ryzen 5 5600X3D", 76],
    ["Ryzen 9 5950X", 66],
    ["Ryzen 9 5900X", 66],
    ["Ryzen 7 5800X", 65],
    ["Ryzen 7 5700X", 63],
    ["Ryzen 5 5600X", 62],
    ["Ryzen 5 5600", 61],
    ["Ryzen 5 5600G", 52],
    ["Ryzen 5 5500", 52],
    ["Ryzen 9 3900X", 48],
    ["Ryzen 7 3700X", 47],
    ["Ryzen 5 3600", 45],
    ["Ryzen 3 3100", 38],
    ["Ryzen 7 2700X", 35],
    ["Ryzen 5 2600", 32],
    ["Ryzen 7 1700", 28],
    ["Ryzen 5 1600", 27],
    ["Ryzen 5 1400", 22],
    ["Ryzen 3 1200", 20],
    ["FX-8350", 14],
  ]),
  ...cpus("Intel Core", [
    ["Core i9-14900K", 92],
    ["Core i9-13900K", 90],
    ["Core i7-14700K", 88],
    ["Core i7-13700K", 86],
    ["Core Ultra 9 285K", 86],
    ["Core Ultra 7 265K", 84],
    ["Core i5-14600K", 83],
    ["Core i5-13600K", 81],
    ["Core Ultra 5 245K", 80],
    ["Core i9-12900K", 78],
    ["Core i7-12700K", 75],
    ["Core i5-12600K", 70],
    ["Core i5-14400F", 69],
    ["Core i5-13400F", 68],
    ["Core i5-12400F", 64],
    ["Core i7-11700K", 62],
    ["Core i9-10900K", 61],
    ["Core i3-13100F", 60],
    ["Core i3-12100F", 58],
    ["Core i7-10700K", 58],
    ["Core i9-9900K", 57],
    ["Core i7-9700K", 55],
    ["Core i5-11400F", 54],
    ["Core i5-10600K", 52],
    ["Core i7-8700K", 50],
    ["Core i5-9600K", 48],
    ["Core i5-10400F", 47],
    ["Core i5-9400F", 43],
    ["Core i5-8400", 41],
    ["Core i7-7700K", 41],
    ["Core i3-10100F", 40],
    ["Core i7-6700K", 37],
    ["Core i7-4790K", 33],
    ["Core i3-8100", 30],
    ["Core i7-4770K", 30],
    ["Core i5-7400", 29],
    ["Core i5-6500", 28],
    ["Core i5-4460", 24],
  ]),
  ...cpus("Ноутбуки", [
    ["Core i7-13700H", 70],
    ["Ryzen 7 7840HS", 68],
    ["Core i7-12700H", 66],
    ["Core i5-12500H", 60],
    ["Ryzen 7 6800H", 58],
    ["Ryzen 7 5800H", 54],
    ["Ryzen 5 5600H", 50],
    ["Core i5-11400H", 48],
    ["Core i7-10750H", 44],
    ["Core i5-10300H", 38],
  ]),
];

export const GPUS: Gpu[] = [
  ...gpus("NVIDIA GeForce", "nvidia", [
    ["GeForce RTX 5090", 160, 32],
    ["GeForce RTX 5080", 118, 16],
    ["GeForce RTX 5070 Ti", 104, 16],
    ["GeForce RTX 5070", 86, 12],
    ["GeForce RTX 5060 Ti", 66, 16],
    ["GeForce RTX 5060", 58, 8],
    ["GeForce RTX 5050", 50, 8],
    ["GeForce RTX 4090", 132, 24],
    ["GeForce RTX 4080 Super", 106, 16],
    ["GeForce RTX 4080", 104, 16],
    ["GeForce RTX 4070 Ti Super", 93, 16],
    ["GeForce RTX 4070 Ti", 86, 12],
    ["GeForce RTX 4070 Super", 80, 12],
    ["GeForce RTX 4070", 70, 12],
    ["GeForce RTX 4060 Ti", 56, 8],
    ["GeForce RTX 4060", 48, 8],
    ["GeForce RTX 3090 Ti", 94, 24],
    ["GeForce RTX 3090", 86, 24],
    ["GeForce RTX 3080 Ti", 84, 12],
    ["GeForce RTX 3080", 76, 10],
    ["GeForce RTX 3070 Ti", 63, 8],
    ["GeForce RTX 3070", 59, 8],
    ["GeForce RTX 3060 Ti", 52, 8],
    ["GeForce RTX 3060", 40, 12],
    ["GeForce RTX 3050", 28, 8],
    ["GeForce RTX 2080 Ti", 58, 11],
    ["GeForce RTX 2080 Super", 50, 8],
    ["GeForce RTX 2080", 48, 8],
    ["GeForce RTX 2070 Super", 45, 8],
    ["GeForce RTX 2070", 40, 8],
    ["GeForce RTX 2060 Super", 39, 8],
    ["GeForce RTX 2060", 34, 6],
    ["GeForce GTX 1660 Ti", 29, 6],
    ["GeForce GTX 1660 Super", 28, 6],
    ["GeForce GTX 1660", 25, 6],
    ["GeForce GTX 1650 Super", 22, 4],
    ["GeForce GTX 1650", 16, 4],
    ["GeForce GTX 1630", 9, 4],
    ["GeForce GTX 1080 Ti", 45, 11],
    ["GeForce GTX 1080", 35, 8],
    ["GeForce GTX 1070 Ti", 32, 8],
    ["GeForce GTX 1070", 28, 8],
    ["GeForce GTX 1060 6GB", 21, 6],
    ["GeForce GTX 1060 3GB", 19, 3],
    ["GeForce GTX 1050 Ti", 13, 4],
    ["GeForce GTX 1050", 10, 2],
    ["GeForce GTX 980 Ti", 26, 6],
    ["GeForce GTX 980", 20, 4],
    ["GeForce GTX 970", 17, 4],
    ["GeForce GTX 960", 11, 2],
    ["GeForce GTX 750 Ti", 7, 2],
  ]),
  ...gpus("AMD Radeon", "amd", [
    ["Radeon RX 9070 XT", 102, 16],
    ["Radeon RX 9070", 90, 16],
    ["Radeon RX 9060 XT", 67, 16],
    ["Radeon RX 7900 XTX", 108, 24],
    ["Radeon RX 7900 XT", 94, 20],
    ["Radeon RX 7900 GRE", 83, 16],
    ["Radeon RX 7800 XT", 77, 16],
    ["Radeon RX 7700 XT", 65, 12],
    ["Radeon RX 7600 XT", 48, 16],
    ["Radeon RX 7600", 45, 8],
    ["Radeon RX 6950 XT", 88, 16],
    ["Radeon RX 6900 XT", 84, 16],
    ["Radeon RX 6800 XT", 78, 16],
    ["Radeon RX 6800", 68, 16],
    ["Radeon RX 6750 XT", 57, 12],
    ["Radeon RX 6700 XT", 55, 12],
    ["Radeon RX 6650 XT", 46, 8],
    ["Radeon RX 6600 XT", 45, 8],
    ["Radeon RX 6600", 39, 8],
    ["Radeon RX 6500 XT", 20, 4],
    ["Radeon RX 5700 XT", 42, 8],
    ["Radeon RX 5700", 37, 8],
    ["Radeon RX 5600 XT", 33, 6],
    ["Radeon RX 5500 XT", 23, 8],
    ["Radeon RX 590", 21, 8],
    ["Radeon RX 580", 19, 8],
    ["Radeon RX 570", 16, 4],
    ["Radeon RX 560", 9, 4],
    ["Radeon RX 550", 6, 4],
  ]),
  ...gpus("Intel Arc", "intel", [
    ["Arc B580", 50, 12],
    ["Arc B570", 44, 10],
    ["Arc A770", 42, 16],
    ["Arc A750", 38, 8],
    ["Arc A380", 14, 6],
  ]),
  ...gpus("Ноутбуки", "nvidia", [
    ["GeForce RTX 4070 Laptop", 52, 8],
    ["GeForce RTX 4060 Laptop", 46, 8],
    ["GeForce RTX 4050 Laptop", 38, 6],
    ["GeForce RTX 3060 Laptop", 36, 6],
    ["GeForce RTX 3050 Laptop", 24, 4],
    ["GeForce GTX 1650 Laptop", 14, 4],
  ]),
  ...gpus("Встроенная графика", "amd", [
    ["Radeon 780M", 15, 2],
    ["Radeon 680M", 12, 2],
    ["Radeon Vega 8", 6, 2],
  ]),
  ...gpus("Встроенная графика", "intel", [
    ["Intel Iris Xe", 6, 2],
    ["Intel UHD Graphics", 3, 1],
  ]),
];

const CPU_BY_ID = new Map(CPUS.map((c) => [c.id, c]));
const GPU_BY_ID = new Map(GPUS.map((g) => [g.id, g]));

export const getCpu = (id: string) => CPU_BY_ID.get(id);
export const getGpu = (id: string) => GPU_BY_ID.get(id);

export const TIERS: Record<TierId, { label: string; summary: string; color: string }> = {
  S: {
    label: "Флагман",
    summary: "Запас по всем компонентам. Можно играть с красивой картинкой и высоким FPS.",
    color: "#30d158",
  },
  A: {
    label: "Отлично",
    summary: "Комфортная игра на высоких кадрах. Твики добавят стабильности в рейдах.",
    color: "#64d2ff",
  },
  B: {
    label: "Хорошо",
    summary: "Играть комфортно на сбалансированных настройках. Оптимизация даст заметный эффект.",
    color: "#ffd60a",
  },
  C: {
    label: "Играбельно",
    summary: "Нужны минимальные настройки графики и полная настройка системы.",
    color: "#ff9f0a",
  },
  D: {
    label: "Тяжело",
    summary: "Rust запустится, но комфортной игры не будет без обновления железа.",
    color: "#ff453a",
  },
};

export interface EvalInput {
  cpuId: string;
  gpuId: string;
  ram: number;
  storage: StorageId;
  resolution: ResolutionId;
}

export interface FpsEstimate {
  avg: number;
  low: number;
}

export interface EvalResult {
  score: number;
  tier: TierId;
  parts: { cpu: number; gpu: number; ram: number; storage: number };
  fps: Record<PresetId, FpsEstimate>;
  bottleneck: Bottleneck;
  preset: PresetId;
  vendor: GpuVendor;
  tweaks: string[];
  notes: string[];
  cpuName: string;
  gpuName: string;
}

const RES_FACTOR: Record<ResolutionId, number> = { "1080p": 1, "1440p": 0.7, "4k": 0.42 };

const STORAGE: Record<StorageId, { factor: number; low: number; score: number }> = {
  hdd: { factor: 0.92, low: -0.1, score: 35 },
  sata: { factor: 0.985, low: -0.01, score: 85 },
  nvme: { factor: 1, low: 0, score: 100 },
};

const PRESET_MUL: Record<PresetId, { cpu: number; gpu: number }> = {
  competitive: { cpu: 1.1, gpu: 1.35 },
  balanced: { cpu: 1, gpu: 1 },
  quality: { cpu: 0.9, gpu: 0.7 },
};

function ramProfile(ram: number): { factor: number; low: number; score: number } {
  if (ram >= 32) return { factor: 1, low: 0.68, score: 100 };
  if (ram >= 24) return { factor: 0.985, low: 0.65, score: 90 };
  if (ram >= 16) return { factor: 0.95, low: 0.6, score: 78 };
  if (ram >= 12) return { factor: 0.82, low: 0.46, score: 50 };
  return { factor: 0.62, low: 0.34, score: 30 };
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Smooth minimum: behaves like min() but blends near the crossover point. */
const softMin = (a: number, b: number) => Math.pow(Math.pow(a, -4) + Math.pow(b, -4), -0.25);

export function isValidInput(input: EvalInput): boolean {
  return (
    CPU_BY_ID.has(input.cpuId) &&
    GPU_BY_ID.has(input.gpuId) &&
    (RAM_OPTIONS as readonly number[]).includes(input.ram) &&
    input.storage in STORAGE &&
    input.resolution in RES_FACTOR
  );
}

export function evaluate(input: EvalInput): EvalResult | null {
  const cpu = CPU_BY_ID.get(input.cpuId);
  const gpu = GPU_BY_ID.get(input.gpuId);
  if (!cpu || !gpu || !isValidInput(input)) return null;

  const ram = ramProfile(input.ram);
  const storage = STORAGE[input.storage];
  const cpuFps = cpu.idx * 1.9;
  const gpuFps = gpu.idx * 3 * RES_FACTOR[input.resolution];
  const x3d = /X3D/i.test(cpu.name);
  const lowVram = gpu.vram <= 4;

  const fps = {} as Record<PresetId, FpsEstimate>;
  for (const preset of Object.keys(PRESET_MUL) as PresetId[]) {
    const mul = PRESET_MUL[preset];
    const vramPenalty = lowVram && preset !== "competitive" ? 0.82 : 1;
    const raw = softMin(cpuFps * mul.cpu, gpuFps * mul.gpu * vramPenalty);
    const avg = raw * ram.factor * storage.factor;
    const lowRatio = clamp(ram.low + storage.low + (x3d ? 0.04 : 0), 0.25, 0.75);
    fps[preset] = { avg: Math.max(1, Math.round(avg)), low: Math.max(1, Math.round(avg * lowRatio)) };
  }

  const parts = {
    cpu: clamp(Math.round(cpu.idx), 1, 100),
    gpu: clamp(Math.round(gpuFps / 2), 1, 100),
    ram: ram.score,
    storage: storage.score,
  };

  const score = clamp(
    Math.round(
      Math.exp(
        0.38 * Math.log(parts.cpu) +
          0.3 * Math.log(parts.gpu) +
          0.22 * Math.log(parts.ram) +
          0.1 * Math.log(parts.storage),
      ),
    ),
    1,
    100,
  );

  const tier: TierId = score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : "D";

  let bottleneck: Bottleneck = "balanced";
  if (input.ram < 16) bottleneck = "ram";
  else if (cpuFps < gpuFps * 0.8) bottleneck = "cpu";
  else if (gpuFps < cpuFps * 0.8) bottleneck = "gpu";

  let preset: PresetId = "quality";
  if (fps.balanced.avg < 75) preset = "competitive";
  else if (fps.balanced.avg < 135 || lowVram) preset = "balanced";

  const vendor: GpuVendor = gpu.vendor === "nvidia" ? "nvidia" : gpu.vendor === "amd" ? "amd" : "all";
  const panel = vendor === "nvidia" ? "nvidia-panel" : vendor === "amd" ? "amd-adrenalin" : null;

  const list: string[] = ["restore-point", "hardware-checklist", `preset-${preset}`];
  if (input.ram >= 12) list.push("gc-buffer");
  if (input.ram <= 16) list.push("pagefile-auto", "background-apps");
  if (bottleneck === "gpu") {
    if (panel) list.push(panel);
    list.push("hags", "game-mode-dvr", "ultimate-power-plan");
  } else {
    list.push("ultimate-power-plan", "game-mode-dvr", "rust-priority");
    if (panel) list.push(panel);
  }
  if (gpu.idx <= 16) list.push("visual-effects", "fso-gpu-pref");
  if (input.storage === "hdd") list.push("steam-checklist");
  list.push("launch-options");
  const tweaks = Array.from(new Set(list)).slice(0, 10);

  const notes: string[] = [];
  if (bottleneck === "ram") {
    notes.push(
      `Оперативной памяти ${input.ram} ГБ — меньше рекомендуемых 16 ГБ. Rust будет выгружаться в файл подкачки, отсюда фризы. Апгрейд памяти даст больше, чем любой твик.`,
    );
  } else if (bottleneck === "cpu") {
    notes.push(
      "FPS ограничивает процессор: Rust нагружает один-два потока. Снижение графики почти не добавит кадров — помогут пресет с меньшей дальностью прорисовки, план электропитания и быстрая память.",
    );
  } else if (bottleneck === "gpu") {
    notes.push(
      "FPS ограничивает видеокарта. Здесь настройки графики работают лучше всего: пресет, DLSS или FSR и меньшее разрешение дадут ощутимый прирост.",
    );
  } else {
    notes.push("Процессор и видеокарта подобраны ровно: явного узкого места нет.");
  }
  if (input.storage === "hdd") {
    notes.push(
      "Игра на HDD: загрузка в мир занимает минуты, а текстуры подгружаются рывками. Перенос Rust на SSD — самое заметное улучшение за свои деньги.",
    );
  }
  if (lowVram) {
    notes.push(
      `У видеокарты ${gpu.vram} ГБ видеопамяти — этого мало для высоких текстур. Используйте пресет «Максимум FPS» или «Баланс».`,
    );
  }
  if (x3d) {
    notes.push("Процессор с 3D V-Cache — лучший тип процессора для Rust: большой кэш заметно поднимает минимальный FPS.");
  }
  if (input.ram >= 32 && bottleneck !== "ram") {
    notes.push("32 ГБ и больше позволяют поставить gc.buffer 4096 — пауз сборщика мусора станет меньше всего.");
  }

  return {
    score,
    tier,
    parts,
    fps,
    bottleneck,
    preset,
    vendor,
    tweaks,
    notes,
    cpuName: cpu.name,
    gpuName: gpu.name,
  };
}

/** Tries to match a WebGL renderer string to a GPU from the list. */
export function detectGpu(renderer: string): Gpu | null {
  const text = renderer.toLowerCase().replace(/\(r\)|\(tm\)/g, "");
  const laptop = /laptop|mobile|max-q/.test(text);
  let best: Gpu | null = null;
  for (const gpu of GPUS) {
    if (!text.includes(gpu.key)) continue;
    const isLaptopEntry = gpu.group === "Ноутбуки";
    if (isLaptopEntry !== laptop && GPUS.some((g) => g.key === gpu.key && (g.group === "Ноутбуки") === laptop)) {
      continue;
    }
    if (!best || gpu.key.length > best.key.length) best = gpu;
  }
  return best;
}

export const BOTTLENECK_LABEL: Record<Bottleneck, string> = {
  cpu: "Процессор",
  gpu: "Видеокарта",
  ram: "Оперативная память",
  balanced: "Сбалансировано",
};
