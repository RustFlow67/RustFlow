import {
  CPUS,
  getCpu,
  getGpu,
  GPUS,
  type Bottleneck,
  type ResolutionId,
  type StorageId,
} from "@/lib/hardware";
import type { GpuVendor, PresetId } from "@/lib/tweaks/meta";
import { clamp, round1, type UserOwnedRecord } from "./common";

/**
 * Модель пользовательской сборки и прозрачной взвешенной оценки /10 под Rust (builds).
 * Все числа помечаются в интерфейсе как «оценка», а не фактический замер.
 */

export const RAM_FREQ_OPTIONS = [
  { value: 2133, label: "2133 МТ/с (JEDEC DDR4)" },
  { value: 2400, label: "2400 МТ/с (DDR4)" },
  { value: 2666, label: "2666 МТ/с (DDR4)" },
  { value: 3000, label: "3000 МТ/с (DDR4)" },
  { value: 3200, label: "3200 МТ/с (DDR4 XMP)" },
  { value: 3600, label: "3600 МТ/с (DDR4 Sweet Spot)" },
  { value: 4000, label: "4000 МТ/с (DDR4 OC)" },
  { value: 4800, label: "4800 МТ/с (JEDEC DDR5)" },
  { value: 5200, label: "5200 МТ/с (DDR5)" },
  { value: 5600, label: "5600 МТ/с (DDR5)" },
  { value: 6000, label: "6000 МТ/с (DDR5 Sweet Spot)" },
  { value: 6400, label: "6400 МТ/с (DDR5 OC)" },
  { value: 7200, label: "7200 МТ/с (DDR5 High)" },
] as const;

export const RAM_CL_OPTIONS = [
  { value: 14, label: "CL14 (ужатые DDR4)" },
  { value: 16, label: "CL16 (хорошие DDR4)" },
  { value: 18, label: "CL18 (типовые DDR4-3600)" },
  { value: 20, label: "CL20 (DDR4)" },
  { value: 22, label: "CL22 (JEDEC DDR4)" },
  { value: 28, label: "CL28 (ужатые DDR5)" },
  { value: 30, label: "CL30 (отличные DDR5-6000)" },
  { value: 32, label: "CL32 (хорошие DDR5)" },
  { value: 36, label: "CL36 (средние DDR5)" },
  { value: 40, label: "CL40 (JEDEC DDR5)" },
] as const;

export interface BuildInput {
  name: string;
  cpuId: string;
  gpuId: string;
  ramGb: number;
  ramMhz: number;
  ramCl: number;
  storage: StorageId;
  resolution: ResolutionId;
}

export type BreakdownKey = "cpuSingle" | "ramLatency" | "ssdRandom" | "gpuTier" | "vramHeadroom";

export interface BreakdownItem {
  key: BreakdownKey;
  label: string;
  weight: number; // сумма весов = 1.00 (100%)
  score: number; // 0.0..10.0
  weighted: number; // вклад в итоговый балл /10
  detail: string;
}

/** Прозрачные веса под движок Unity / Rust (сумма = 100%). */
export const RUST_SCORE_WEIGHTS: Record<BreakdownKey, { label: string; weight: number; why: string }> = {
  cpuSingle: {
    label: "Однопоток и L3-кэш CPU",
    weight: 0.35,
    why: "Главный поток Unity обрабатывает постройки, сущности и вызовы отрисовки.",
  },
  ramLatency: {
    label: "Объём, ПСП и задержка RAM",
    weight: 0.2,
    why: "Скорость подкачки данных при промахах кэша и запас под сборщик мусора (gc.buffer).",
  },
  gpuTier: {
    label: "Тир GPU в выбранном разрешении",
    weight: 0.22,
    why: "Растеризация шейдеров, воды, теней и растительности с учётом 1080p/1440p/4K.",
  },
  vramHeadroom: {
    label: "Запас видеопамяти (VRAM)",
    weight: 0.13,
    why: "Текстуры мира, монументов и тысяч скинов игроков без выгрузки в ОЗУ.",
  },
  ssdRandom: {
    label: "Случайное чтение накопителя",
    weight: 0.1,
    why: "Скорость входа на сервер, подгрузка префабов на бегу и работа файла подкачки.",
  },
};

export interface FpsRangeEstimate {
  min: number;
  max: number;
  low1: number;
}

export interface TweakRecommendation {
  slug: string;
  reason: string;
  priority: "high" | "medium";
}

export interface BuildEvaluation {
  score10: number;
  verdictLabel: string;
  verdictSummary: string;
  verdictColor: string;
  ramLatencyNs: number;
  isX3d: boolean;
  breakdown: BreakdownItem[];
  fpsModded: FpsRangeEstimate;
  fpsOfficial: FpsRangeEstimate;
  fpsByPreset: Record<PresetId, { avg: number; low: number }>;
  bottleneck: Bottleneck;
  recommendedPreset: PresetId;
  vendor: GpuVendor;
  recommendations: TweakRecommendation[];
  notes: string[];
  cpuName: string;
  gpuName: string;
  vramGb: number;
}

export interface UserBuild extends UserOwnedRecord {
  input: BuildInput;
  score10: number;
  verdictLabel: string;
  fpsModded: [number, number];
  fpsOfficial: [number, number];
  recommendedPreset: PresetId;
  vendor: GpuVendor;
}

/** Рекомендуемый дефолтный CL при переключении частоты RAM. */
export function defaultClForMhz(mhz: number): number {
  if (mhz >= 6000) return 30;
  if (mhz >= 5200) return 36;
  if (mhz >= 4800) return 40;
  if (mhz >= 3600) return 18;
  if (mhz >= 3000) return 16;
  return 22;
}

/** Первая задержка доступа к ячейке RAM (first-word latency), наносекунды. */
export function calcRamLatencyNs(mhz: number, cl: number): number {
  if (!mhz || !cl) return 14;
  return round1((cl * 2000) / mhz);
}

const RES_GPU_SCALE: Record<ResolutionId, number> = {
  "1080p": 1,
  "1440p": 0.72,
  "4k": 0.44,
};

const RES_VRAM_TARGET: Record<ResolutionId, { min: number; comfy: number; ideal: number }> = {
  "1080p": { min: 6, comfy: 8, ideal: 12 },
  "1440p": { min: 8, comfy: 12, ideal: 16 },
  "4k": { min: 10, comfy: 16, ideal: 24 },
};

const STORAGE_SPEC: Record<StorageId, { score10: number; fpsMul: number; lowMul: number; detail: string }> = {
  hdd: {
    score10: 2.5,
    fpsMul: 0.91,
    lowMul: 0.8,
    detail: "HDD (~100 IOPS): долгая загрузка карты (10–25 мин) и статтеры подгрузки баз",
  },
  sata: {
    score10: 7.8,
    fpsMul: 0.985,
    lowMul: 0.97,
    detail: "SATA SSD (~70K IOPS): нормальная подгрузка префабов, вход на сервер за 2–4 мин",
  },
  nvme: {
    score10: 9.8,
    fpsMul: 1,
    lowMul: 1,
    detail: "NVMe SSD (300K+ IOPS): быстрый прогрев ассетов и минимальные задержки стриминга",
  },
};

function softMin(a: number, b: number): number {
  return Math.pow(Math.pow(Math.max(1, a), -4.5) + Math.pow(Math.max(1, b), -4.5), -1 / 4.5);
}

export function isValidBuildInput(input: Partial<BuildInput> | null | undefined): input is BuildInput {
  if (!input) return false;
  return (
    typeof input.cpuId === "string" &&
    CPUS.some((c) => c.id === input.cpuId) &&
    typeof input.gpuId === "string" &&
    GPUS.some((g) => g.id === input.gpuId) &&
    typeof input.ramGb === "number" &&
    input.ramGb >= 8 &&
    input.ramGb <= 128 &&
    typeof input.ramMhz === "number" &&
    input.ramMhz >= 1600 &&
    input.ramMhz <= 9600 &&
    typeof input.ramCl === "number" &&
    input.ramCl >= 10 &&
    input.ramCl <= 56 &&
    (input.storage === "hdd" || input.storage === "sata" || input.storage === "nvme") &&
    (input.resolution === "1080p" || input.resolution === "1440p" || input.resolution === "4k")
  );
}

/**
 * Прозрачный расчёт оценки сборки /10 и ожидаемых диапазонов FPS под Rust.
 * Откалиброван на референсных точках (в т.ч. Ryzen 5 5600X + RTX 5060 + 32GB@3600 CL18:
 * моддед 2x ≈ 130–150 FPS, официал ≈ 90–100 FPS).
 */
export function evaluateBuild10(input: BuildInput): BuildEvaluation | null {
  const cpu = getCpu(input.cpuId);
  const gpu = getGpu(input.gpuId);
  if (!cpu || !gpu || !isValidBuildInput(input)) return null;

  const isX3d = /X3D/i.test(cpu.name);
  const latencyNs = calcRamLatencyNs(input.ramMhz, input.ramCl);

  // 1) Однопоток + кэш CPU (/10)
  const cpuScore = round1(clamp(cpu.idx / 10, 1, 10));
  const cpuDetail = isX3d
    ? `Индекс ${cpu.idx}/100 · увеличенный 3D V-Cache отлично держит FPS у больших баз`
    : cpu.idx >= 75
      ? `Индекс ${cpu.idx}/100 · сильный однопоток для плотных серверов`
      : cpu.idx >= 55
        ? `Индекс ${cpu.idx}/100 · уверенный средний уровень, упор появится на 300+ онлайна`
        : `Индекс ${cpu.idx}/100 · главный ограничитель FPS на застроенных картах`;

  // 2) Объём + пропускная способность + задержка RAM (/10)
  const capScore =
    input.ramGb >= 32 ? 10 : input.ramGb >= 24 ? 9 : input.ramGb >= 16 ? 7.4 : input.ramGb >= 12 ? 4.6 : 2.4;
  // Пропускная способность (2133 -> ~3.5, 3200 -> ~6.8, 3600 -> ~7.8, 6000 -> ~9.6)
  const bwScore = clamp(
    input.ramMhz >= 4400
      ? 6.4 + ((input.ramMhz - 4400) / 2200) * 3.6
      : 3.2 + ((input.ramMhz - 2133) / 1867) * 5.2,
    2.5,
    10,
  );
  // Задержка (9 нс -> 10, 10 нс -> 9.0, 12 нс -> 7.0, 16+ нс -> 3.5)
  const latScore = clamp(10 - Math.max(0, latencyNs - 8.8) * 0.85, 2.5, 10);
  const ramScore = round1(clamp(capScore * 0.5 + bwScore * 0.25 + latScore * 0.25, 1, 10));
  const isJedec =
    (input.ramMhz <= 2400 && input.ramCl >= 17) || (input.ramMhz === 4800 && input.ramCl >= 38);
  const ramDetail = `${input.ramGb} ГБ · ${input.ramMhz} МТ/с CL${input.ramCl} (~${latencyNs} нс)${
    isJedec ? " — похоже, не включён XMP/EXPO" : ""
  }`;

  // 3) Тир GPU в выбранном разрешении (/10)
  const effectiveGpu = gpu.idx * RES_GPU_SCALE[input.resolution];
  // effectiveGpu 58 (RTX 5060 @ 1080p) -> ~7.6; 80+ -> 9.2..10; 28 -> 4.6
  const gpuScore = round1(clamp(Math.pow(effectiveGpu / 88, 0.72) * 10, 1, 10));
  const gpuDetail = `${gpu.name} с учётом ${input.resolution === "4k" ? "4K" : input.resolution} (эфф. индекс ${Math.round(effectiveGpu)})`;

  // 4) Запас VRAM (/10)
  const vt = RES_VRAM_TARGET[input.resolution];
  let vramRaw: number;
  if (gpu.vram >= vt.ideal) {
    vramRaw = 9.2 + clamp((gpu.vram - vt.ideal) / 12, 0, 0.8);
  } else if (gpu.vram >= vt.comfy) {
    vramRaw = 7.4 + ((gpu.vram - vt.comfy) / Math.max(1, vt.ideal - vt.comfy)) * 1.8;
  } else if (gpu.vram >= vt.min) {
    vramRaw = 5.2 + ((gpu.vram - vt.min) / Math.max(1, vt.comfy - vt.min)) * 2.2;
  } else {
    vramRaw = clamp((gpu.vram / vt.min) * 4.8, 1.2, 4.8);
  }
  const vramScore = round1(clamp(vramRaw, 1, 10));
  const vramDetail =
    gpu.vram >= vt.ideal
      ? `${gpu.vram} ГБ — полный запас под высокие текстуры и скины в ${input.resolution}`
      : gpu.vram >= vt.comfy
        ? `${gpu.vram} ГБ — достаточно для средних/высоких текстур в ${input.resolution}`
        : `${gpu.vram} ГБ — впритык для ${input.resolution}, снижайте качество текстур до 1–2`;

  // 5) Накопитель (/10)
  const st = STORAGE_SPEC[input.storage];
  const ssdScore = st.score10;

  const rawItems: { key: BreakdownKey; score: number; detail: string }[] = [
    { key: "cpuSingle", score: cpuScore, detail: cpuDetail },
    { key: "ramLatency", score: ramScore, detail: ramDetail },
    { key: "gpuTier", score: gpuScore, detail: gpuDetail },
    { key: "vramHeadroom", score: vramScore, detail: vramDetail },
    { key: "ssdRandom", score: ssdScore, detail: st.detail },
  ];

  const breakdown: BreakdownItem[] = rawItems.map((item) => {
    const meta = RUST_SCORE_WEIGHTS[item.key];
    return {
      key: item.key,
      label: meta.label,
      weight: meta.weight,
      score: item.score,
      weighted: round1(item.score * meta.weight),
      detail: item.detail,
    };
  });

  // Точная взвешенная сумма /10
  const score10 = round1(
    clamp(
      rawItems.reduce((acc, item) => acc + item.score * RUST_SCORE_WEIGHTS[item.key].weight, 0),
      1,
      10,
    ),
  );

  // Оценка FPS (моддед 2x и официал high-pop)
  // Множитель скорости памяти: 3600 CL18 (10ns, bw ~7.8) = 1.00; JEDEC 2133 = ~0.85; DDR5-6000 CL30 = ~1.05
  const ramSpeedMul = clamp(0.84 + (bwScore * 0.5 + latScore * 0.5) * 0.019, 0.82, 1.06);
  // Для X3D чувствительность к частоте RAM вдвое ниже благодаря огромному L3-кэшу
  const cpuRamMul = isX3d ? 1 + (ramSpeedMul - 1) * 0.45 : ramSpeedMul;
  const ramCapMul =
    input.ramGb >= 32 ? 1 : input.ramGb >= 24 ? 0.985 : input.ramGb >= 16 ? 0.95 : input.ramGb >= 12 ? 0.82 : 0.64;
  const vramMul = gpu.vram < vt.min ? 0.85 : 1;

  // Калибровка: 5600X (idx=62) + RTX 5060 (eff=58) + 32GB@3600 CL18 -> моддед 130–150 FPS, официал 90–100 FPS
  const cpuModded = cpu.idx * 2.36 * cpuRamMul;
  const gpuModded = effectiveGpu * 3.65 * vramMul;
  const moddedCenter = softMin(cpuModded, gpuModded) * ramCapMul * st.fpsMul;

  // На официале (350–500 pop) нагрузка на CPU выше (~0.66x, у X3D ~0.74x), на GPU почти та же (~0.90x)
  const cpuOfficial = cpuModded * (isX3d ? 0.74 : 0.66);
  const gpuOfficial = gpuModded * 0.9;
  const officialCenter = softMin(cpuOfficial, gpuOfficial) * ramCapMul * st.fpsMul;

  const lowBaseRatio =
    (input.ramGb >= 32 ? 0.67 : input.ramGb >= 16 ? 0.61 : 0.44) *
    st.lowMul *
    (isX3d ? 1.06 : 1) *
    (isJedec ? 0.92 : 1);

  const makeRange = (center: number, spread: number): FpsRangeEstimate => {
    const min = Math.max(15, Math.round((center * (1 - spread)) / 2) * 2);
    const max = Math.max(min + 6, Math.round((center * (1 + spread)) / 2) * 2);
    const low1 = Math.max(10, Math.round(center * clamp(lowBaseRatio, 0.3, 0.76)));
    return { min, max, low1 };
  };

  const fpsModded = makeRange(moddedCenter, 0.072);
  const fpsOfficial = makeRange(officialCenter, 0.055);

  // Ориентир по 3 пресетам графики (смешанный сервер ~250 онл.)
  const presetFactors: Record<PresetId, { c: number; g: number }> = {
    competitive: { c: 1.0, g: 1.0 },
    balanced: { c: 0.92, g: 0.76 },
    quality: { c: 0.83, g: 0.54 },
  };
  const fpsByPreset = {} as Record<PresetId, { avg: number; low: number }>;
  for (const pid of ["competitive", "balanced", "quality"] as PresetId[]) {
    const pf = presetFactors[pid];
    const vPen = pid !== "competitive" && gpu.vram < vt.comfy ? 0.86 : 1;
    const avg = Math.max(
      15,
      Math.round(softMin(cpuModded * 0.86 * pf.c, gpuModded * pf.g * vPen) * ramCapMul * st.fpsMul),
    );
    fpsByPreset[pid] = {
      avg,
      low: Math.max(10, Math.round(avg * clamp(lowBaseRatio, 0.3, 0.76))),
    };
  }

  // Узкое место
  let bottleneck: Bottleneck = "balanced";
  if (input.ramGb < 16) bottleneck = "ram";
  else if (cpuOfficial < gpuOfficial * 0.82) bottleneck = "cpu";
  else if (gpuModded < cpuModded * 0.85) bottleneck = "gpu";

  let recommendedPreset: PresetId = "quality";
  if (fpsOfficial.max < 95 || gpu.vram < vt.comfy) recommendedPreset = "competitive";
  else if (fpsOfficial.max < 140 || gpu.vram < vt.ideal) recommendedPreset = "balanced";

  const vendor: GpuVendor = gpu.vendor === "nvidia" ? "nvidia" : gpu.vendor === "amd" ? "amd" : "all";

  // Вердикт по шкале /10
  let verdictLabel = "Тяжело";
  let verdictSummary = "Нужны минимальные настройки, строгая чистка фона и апгрейд слабого узла.";
  let verdictColor = "#ff6961";
  if (score10 >= 8.7) {
    verdictLabel = "Флагман под Rust";
    verdictSummary = "Высокий запас под 144–240 Гц даже на плотных официалах и в крупных рейдах.";
    verdictColor = "#30d158";
  } else if (score10 >= 7.5) {
    verdictLabel = "Отличный баланс";
    verdictSummary = "Ровный frametime и 100+ FPS на большинстве серверов. Твики отполируют 1% low.";
    verdictColor = "#64d2ff";
  } else if (score10 >= 6.2) {
    verdictLabel = "Уверенный оптимум";
    verdictSummary = "Комфортный PvP на соревновательных и сбалансированных настройках с грамотным gc.buffer.";
    verdictColor = "#ffd60a";
  } else if (score10 >= 4.8) {
    verdictLabel = "Играбельно с твиками";
    verdictSummary = "Ставка на пресет «Максимум FPS», авто-подкачку и правильную настройку ОЗУ/SSD.";
    verdictColor = "#ff9f0a";
  }

  // Персональные рекомендации твиков с причиной
  const recs: TweakRecommendation[] = [];
  const push = (slug: string, reason: string, priority: "high" | "medium" = "high") => {
    if (!recs.some((r) => r.slug === slug)) recs.push({ slug, reason, priority });
  };

  if (input.storage === "hdd") {
    push("ssd-trim-free-space", "Игра на HDD — перенос Rust на SSD уберёт главные фризы подгрузки и сократит вход в 4–5 раз.");
  }
  if (isJedec || latencyNs > 11.2) {
    push(
      "xmp-expo-timings",
      `Память ${input.ramMhz} МТ/с CL${input.ramCl} (~${latencyNs} нс): включение XMP/EXPO и двухканала даст +10–20% к 1% low.`,
    );
  }
  if (input.ramGb >= 12) {
    const targetBuf = input.ramGb >= 32 ? 4096 : input.ramGb >= 16 ? 2048 : 1024;
    push("gc-buffer", `Для ${input.ramGb} ГБ ОЗУ оптимален gc.buffer ${targetBuf} — редкие паузы сборщика мусора Unity.`);
  }
  if (input.ramGb <= 16) {
    push("pagefile-auto", `При ${input.ramGb} ГБ ОЗУ авто-подкачка на SSD защищает от вылетов при загрузке больших карт.`);
    push("background-apps", "Освобождает 600–1200 МБ ОЗУ и фоновые пробуждения CPU.", "medium");
  }
  push(
    `preset-${recommendedPreset}`,
    recommendedPreset === "competitive"
      ? "Снижает draw calls, тени и воду — максимальный прирост FPS и читаемости в бою."
      : recommendedPreset === "balanced"
        ? "Убирает тяжёлые постэффекты, сохраняя чёткую картинку под ваш запас GPU."
        : "Раскрывает запас видеокарты без мыльных эффектов (motion blur, vignette).",
  );
  if (bottleneck === "cpu" || cpuScore < 8) {
    push("ultimate-power-plan", "Убирает парковку ядер и просадки частоты при упоре в главный поток Rust.");
  }
  if (vendor === "nvidia") {
    push("nvidia-panel", "Режим макс. производительности, Shader Cache 10 ГБ и NVIDIA Reflex On + Boost.", "medium");
  } else if (vendor === "amd") {
    push("amd-adrenalin", "Radeon Anti-Lag On и отключение Chill/Enhanced Sync для ровного отклика.", "medium");
  }
  push("game-mode-dvr", "Отключает фоновую запись Game DVR и отдаёт приоритет потокам игры.", "medium");
  push("launch-options", "Чистый -window-mode exclusive без нерабочих флагов из Arma.", "medium");
  push("restore-point", "Создайте точку восстановления перед системными правками.", "medium");

  // Аналитические заметки
  const notes: string[] = [];
  if (bottleneck === "ram") {
    notes.push(
      `Критический узел — ${input.ramGb} ГБ ОЗУ: Rust с картой потребляет 11–16 ГБ, система постоянно обращается к подкачке.`,
    );
  } else if (bottleneck === "cpu") {
    notes.push(
      `На плотных серверах FPS упирается в однопоток/кэш ${cpu.name}. Апскейлер (DLSS/FSR) почти не прибавит кадров — важнее дальность прорисовки, каскады теней и скорость RAM.`,
    );
  } else if (bottleneck === "gpu") {
    notes.push(
      `В ${input.resolution === "4k" ? "4K" : input.resolution} основной упор — ${gpu.name}. Пресет графики и DLSS/FSR «Качество» дадут прямой прирост +20–35% FPS.`,
    );
  } else {
    notes.push(
      `Сбалансированная связка: на моддед 2x нагрузка распределена ровно, на официале 350+ онлайна плавно смещается на ${cpu.name}.`,
    );
  }
  if (isJedec) {
    notes.push(
      `Задержка RAM ~${latencyNs} нс выглядит как базовый JEDEC. Проверьте в BIOS профиль XMP / DOCP / EXPO и слоты A2+B2.`,
    );
  }
  if (gpu.vram <= 8 && input.resolution !== "1080p") {
    notes.push(
      `${gpu.vram} ГБ VRAM маловато для ${input.resolution}: держите Graphics Quality 2–3, чтобы избежать статтеров переполнения буфера.`,
    );
  }

  return {
    score10,
    verdictLabel,
    verdictSummary,
    verdictColor,
    ramLatencyNs: latencyNs,
    isX3d,
    breakdown,
    fpsModded,
    fpsOfficial,
    fpsByPreset,
    bottleneck,
    recommendedPreset,
    vendor,
    recommendations: recs.slice(0, 8),
    notes,
    cpuName: cpu.name,
    gpuName: gpu.name,
    vramGb: gpu.vram,
  };
}

/** Быстрые эталонные конфигурации для проверки калькулятора в один клик. */
export const QUICK_SAMPLE_BUILDS: { label: string; input: BuildInput }[] = [
  {
    label: "R5 5600X + RTX 5060 · 32GB@3600",
    input: {
      name: "Мой ПК (5600X + RTX 5060)",
      cpuId: "ryzen-5-5600x",
      gpuId: "geforce-rtx-5060",
      ramGb: 32,
      ramMhz: 3600,
      ramCl: 18,
      storage: "nvme",
      resolution: "1080p",
    },
  },
  {
    label: "i5-12400F + RTX 3060 · 16GB@3200",
    input: {
      name: "Сборка 1080p (12400F + 3060)",
      cpuId: "core-i5-12400f",
      gpuId: "geforce-rtx-3060",
      ramGb: 16,
      ramMhz: 3200,
      ramCl: 16,
      storage: "sata",
      resolution: "1080p",
    },
  },
  {
    label: "R7 7800X3D + RTX 4070S · 32GB@6000",
    input: {
      name: "Турнирный 1440p (7800X3D)",
      cpuId: "ryzen-7-7800x3d",
      gpuId: "geforce-rtx-4070-super",
      ramGb: 32,
      ramMhz: 6000,
      ramCl: 30,
      storage: "nvme",
      resolution: "1440p",
    },
  },
];
