import { getGraphicsProfile, type GraphicsProfileId } from "@/lib/graphics-profiles";
import {
  getCpu,
  getGpu,
  GPUS,
  type Bottleneck,
} from "@/lib/hardware";
import type { GpuVendor, PresetId } from "@/lib/tweaks/meta";
import { formatBuildResolution, getResolutionSize, RESOLUTION_SIZES, type BuildResolution } from "./build-resolution";
import { getBiosProfile, getMemoryType, validMemory, isValidBuildSettings, type BuildSettings } from "./build-settings";
import { clamp, round1, type UserOwnedRecord } from "./common";
import { driveEstimate, validDrive, warmupTime, type DriveSettings } from "./drive";
import { gcBudget } from "./play-settings";
import { avgFps, calibratedFps, type RustScenario } from "./fps-calibration";

/**
 * Модель пользовательской сборки и прозрачной взвешенной оценки /10 под Rust (builds).
 * Все числа помечаются в интерфейсе как «оценка», а не фактический замер.
 */

export const RAM_FREQ_OPTIONS = [
  { value: 2133, label: "2133 МТ/с (JEDEC DDR4)" },
  { value: 2400, label: "2400 МТ/с (DDR4)" },
  { value: 2666, label: "2666 МТ/с (DDR4)" },
  { value: 2933, label: "2933 МТ/с (DDR4)" },
  { value: 3000, label: "3000 МТ/с (DDR4)" },
  { value: 3200, label: "3200 МТ/с (DDR4 XMP)" },
  { value: 3600, label: "3600 МТ/с (DDR4 Sweet Spot)" },
  { value: 4000, label: "4000 МТ/с (DDR4 OC)" },
  { value: 5333, label: "5333 МТ/с (DDR4)" },
  { value: 4800, label: "4800 МТ/с (JEDEC DDR5)" },
  { value: 5200, label: "5200 МТ/с (DDR5)" },
  { value: 5600, label: "5600 МТ/с (DDR5)" },
  { value: 6000, label: "6000 МТ/с (DDR5 Sweet Spot)" },
  { value: 6400, label: "6400 МТ/с (DDR5 OC)" },
  { value: 6800, label: "6800 МТ/с (DDR5 OC)" },
  { value: 7200, label: "7200 МТ/с (DDR5 High)" },
  { value: 7600, label: "7600 МТ/с (DDR5)" },
  { value: 8000, label: "8000 МТ/с (DDR5)" },
  { value: 9600, label: "9600 МТ/с (DDR5)" },
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
  { value: 34, label: "CL34 (DDR5)" },
  { value: 36, label: "CL36 (средние DDR5)" },
  { value: 38, label: "CL38 (DDR5)" },
  { value: 40, label: "CL40 (JEDEC DDR5)" },
] as const;

export interface BuildInput extends BuildResolution, BuildSettings, DriveSettings {
  graphicsProfile?: GraphicsProfileId;
  name: string;
  cpuId: string;
  gpuId: string;
  ramGb: number;
  ramMhz: number;
  ramCl: number;
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
    why: "Растеризация шейдеров, воды, теней и растительности с учётом числа выводимых пикселей.",
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
  if (mhz >= 3600) return 16;
  if (mhz >= 3000) return 16;
  return 22;
}

/** Первая задержка доступа к ячейке RAM (first-word latency), наносекунды. */
export function calcRamLatencyNs(mhz: number, cl: number): number {
  if (!mhz || !cl) return 14;
  return round1((cl * 2000) / mhz);
}

// Keep the existing 1080p / 1440p / 4K calibration points. Other sizes
// interpolate (or extrapolate GPU load) by pixel area, not aspect ratio.
const RES_LOAD_POINTS = ([
  { id: "1080p", gpu: 1, min: 6, comfy: 8, ideal: 12 },
  { id: "1440p", gpu: 0.72, min: 8, comfy: 12, ideal: 16 },
  { id: "4k", gpu: 0.44, min: 10, comfy: 16, ideal: 24 },
] as const).map(({ id, ...load }) => ({ ...load, pixels: RESOLUTION_SIZES[id].width * RESOLUTION_SIZES[id].height }));

function resolutionLoad(pixels: number) {
  const exact = RES_LOAD_POINTS.find((point) => point.pixels === pixels);
  if (exact) return exact;
  const i = pixels < RES_LOAD_POINTS[1].pixels ? 0 : 1;
  const a = RES_LOAD_POINTS[i];
  const b = RES_LOAD_POINTS[i + 1];
  const t = Math.log(pixels / a.pixels) / Math.log(b.pixels / a.pixels);
  const vramT = clamp(t, 0, 1);
  const lerp = (low: number, high: number) => low + (high - low) * vramT;
  return {
    gpu: a.gpu * (b.gpu / a.gpu) ** t,
    min: lerp(a.min, b.min), comfy: lerp(a.comfy, b.comfy), ideal: lerp(a.ideal, b.ideal),
  };
}

export function isValidBuildInput(input: Partial<BuildInput> | null | undefined): input is BuildInput {
  if (!input) return false;
  return (
    typeof input.name === "string" &&
    typeof input.cpuId === "string" &&
    Boolean(getCpu(input.cpuId)) &&
    typeof input.gpuId === "string" &&
    GPUS.some((g) => g.id === input.gpuId) &&
    typeof input.ramGb === "number" &&
    Number.isInteger(input.ramGb) && input.ramGb >= 8 &&
    input.ramGb <= 128 &&
    validMemory({...input,cpuId:input.cpuId}) &&
    isValidBuildSettings(input, input.cpuId) &&
    (input.graphicsProfile === undefined || !!getGraphicsProfile(input.graphicsProfile)) &&
    validDrive(input) &&
    getResolutionSize(input) !== null
  );
}

/**
 * Прозрачный расчёт оценки сборки /10 и ожидаемых диапазонов FPS под Rust.
 * FPS: общие диапазоны режима «Комбат» и поправки на нагрузку, память и сервер.
 */
export function evaluateBuild10(input: BuildInput, mode: GraphicsProfileId | null = null, scene: RustScenario = input.scenario ?? "coast"): BuildEvaluation | null {
  const cpu = getCpu(input.cpuId);
  const gpu = getGpu(input.gpuId);
  if (!cpu || !gpu || !isValidBuildInput(input)) return null;
  const size = getResolutionSize(input);
  if (!size) return null;
  const pixels = size.width * size.height;
  const resolutionLabel = formatBuildResolution(input);
  const load = resolutionLoad(pixels);

  const isX3d = /X3D/i.test(cpu.name);
  const latencyNs = calcRamLatencyNs(input.ramMhz, input.ramCl);
  const bios = getBiosProfile(input.biosProfile);
  const ddr5 = getMemoryType(input) === "DDR5";

  // 1) Однопоток + кэш CPU (/10)
  const cpuScore = round1(clamp((cpu.idx / 10) * (bios?.cpu ?? 1), 1, 10));
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
    ddr5
      ? 6.4 + ((input.ramMhz - 4800) / 3200) * 3.6
      : 3.2 + ((input.ramMhz - 2133) / 1867) * 5.2,
    2.5,
    10,
  );
  // Задержка (9 нс -> 10, 10 нс -> 9.0, 12 нс -> 7.0, 16+ нс -> 3.5)
  const latScore = clamp(10 - Math.max(0, latencyNs - 6.8) * 0.78, 2.5, 10);
  const ramScore = round1(clamp((capScore * 0.5 + bwScore * 0.25 + latScore * 0.25) * (bios?.ram ?? 1), 1, 10));
  const isJedec =
    (input.ramMhz <= 2400 && input.ramCl >= 17) || (input.ramMhz === 4800 && input.ramCl >= 38);
  const ramDetail = `${input.ramGb} ГБ · ${input.ramMhz} МТ/с CL${input.ramCl} (~${latencyNs} нс)${
    input.biosProfile === "stock" ? " · режим без XMP" : !bios && isJedec ? " · проверьте XMP/EXPO" : ""
  }`;

  // 3) Тир GPU в выбранном разрешении (/10)
  const effectiveGpu = gpu.idx * load.gpu;
  // effectiveGpu 58 (RTX 5060 @ 1080p) -> ~7.6; 80+ -> 9.2..10; 28 -> 4.6
  const gpuScore = round1(clamp(Math.pow(effectiveGpu / 88, 0.72) * 10, 1, 10));
  const gpuDetail = `${gpu.name} с учётом ${resolutionLabel} (эфф. индекс ${Math.round(effectiveGpu)})`;

  // 4) Запас VRAM (/10)
  const vt = load;
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
      ? `${gpu.vram} ГБ — полный запас под высокие текстуры и скины в ${resolutionLabel}`
      : gpu.vram >= vt.comfy
        ? `${gpu.vram} ГБ — достаточно для средних/высоких текстур в ${resolutionLabel}`
        : `${gpu.vram} ГБ — впритык для ${resolutionLabel}, снижайте качество текстур до 1–2`;

  // 5) Накопитель (/10)
  const st = driveEstimate(input);
  const ssdScore = st.score;

  const rawItems: { key: BreakdownKey; score: number; detail: string }[] = [
    { key: "cpuSingle", score: cpuScore, detail: cpuDetail },
    { key: "ramLatency", score: ramScore, detail: ramDetail },
    { key: "gpuTier", score: gpuScore, detail: gpuDetail },
    { key: "vramHeadroom", score: vramScore, detail: vramDetail },
    { key: "ssdRandom", score: ssdScore, detail: `${st.label}. Asset Warmup: ${warmupTime(st.warmupMin)}–${warmupTime(st.warmupMax)} мин:с (модель)` },
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

  const { modded: fpsModded, official: fpsOfficial, cpuModded, cpuOfficial, gpuModded, gpuOfficial } = calibratedFps(input, cpu, gpu, pixels, mode, scene);
  const fpsByPreset = {} as BuildEvaluation["fpsByPreset"];
  for (const id of ["competitive", "balanced", "quality"] as const) {
    const { modded } = calibratedFps(input, cpu, gpu, pixels, id, scene);
    fpsByPreset[id] = { avg: Math.round(avgFps(modded)), low: modded.low1 };
  }

  // Узкое место
  let bottleneck: Bottleneck = "balanced";
  if (input.ramGb < 16) bottleneck = "ram";
  else if (cpuOfficial < gpuOfficial * 0.82) bottleneck = "cpu";
  else if (gpuModded < cpuModded * 0.85) bottleneck = "gpu";

  const baselineOfficialMax = calibratedFps(input, cpu, gpu, pixels, "competitive").official.max;
  let recommendedPreset: PresetId = "quality";
  if (baselineOfficialMax < 95 || gpu.vram < vt.comfy) recommendedPreset = "competitive";
  else if (baselineOfficialMax < 140 || gpu.vram < vt.ideal) recommendedPreset = "balanced";

  const vendor: GpuVendor = gpu.vendor === "nvidia" ? "nvidia" : gpu.vendor === "amd" ? "amd" : "all";

  // Вердикт по шкале /10
  let verdictLabel = "Тяжело";
  let verdictSummary = "Нужны минимальные настройки, строгая чистка фона и апгрейд слабого узла.";
  let verdictColor = "#E05A2B";
  if (score10 >= 8.7) {
    verdictLabel = "Флагман под Rust";
    verdictSummary = "Высокий запас по железу. На плотных серверах и в рейдах ориентируйтесь на FPS и 1% low выбранного сценария.";
    verdictColor = "#ffc38b";
  } else if (score10 >= 7.5) {
    verdictLabel = "Отличный баланс";
    verdictSummary = "Сбалансированные комплектующие. Стабильность проверьте по 1% low в вашей сцене.";
    verdictColor = "#f58a3e";
  } else if (score10 >= 6.2) {
    verdictLabel = "Уверенный оптимум";
    verdictSummary = "Комфортный PvP на соревновательных и сбалансированных настройках с грамотным gc.buffer.";
    verdictColor = "#e2824a";
  } else if (score10 >= 4.8) {
    verdictLabel = "Играбельно с твиками";
    verdictSummary = "Ставка на пресет «Максимум FPS», авто-подкачку и правильную настройку ОЗУ/SSD.";
    verdictColor = "#ff8a3d";
  }

  // Персональные рекомендации твиков с причиной
  const recs: TweakRecommendation[] = [];
  const push = (slug: string, reason: string, priority: "high" | "medium" = "high") => {
    if (!recs.some((r) => r.slug === slug)) recs.push({ slug, reason, priority });
  };

  if (input.storage === "hdd") {
    push("rust-library-ssd", "Игра на HDD: перенос на SSD сокращает задержку случайного чтения. Сравните Asset Warmup и длинные кадры на своём маршруте.");
  }
  if (input.storage!=="hdd" && input.diskFill === "high") push("ssd-trim-free-space", "Диск заполнен более чем на 85%: освободите место и повторите прогрев карты до покупки нового SSD.");
  if (input.biosProfile === "stock" || (!bios && isJedec) || latencyNs > 11.2) {
    push(
      "xmp-expo-timings",
      `Память ${input.ramMhz} МТ/с CL${input.ramCl} (~${latencyNs} нс): сверьте режим двухканала и совместимый профиль памяти. Эффект проверьте по 1% low.`,
    );
  }
  {
    const { mb: targetBuf } = gcBudget(input.ramGb, input);
    push("gc-buffer", `В конфиге gc.buffer ${targetBuf} при ${input.ramGb} ГБ ОЗУ. Сравните паузы GC и расход памяти в одной сцене.`);
  }
  if (input.ramGb <= 16) {
    push("pagefile-auto", `При ${input.ramGb} ГБ ОЗУ авто-подкачка на SSD защищает от вылетов при загрузке больших карт.`);
    push("startup-apps", "При малом объёме ОЗУ проверьте автозапуск одного ненужного лаунчера, не выключая службы Windows.", "medium");
  }
  if (input.windowsVersion) push(`windows-${input.windowsVersion}-graphics`, `Проверьте штатный профиль приложения в Windows ${input.windowsVersion}. Если выбрана правильная GPU, менять ничего не нужно.`);
  push("steam-checklist", "Проверьте фоновые загрузки Steam и ненужные оверлеи перед контрольным прогоном.", "medium");
  if (bottleneck === "gpu" && pixels>1920*1080) push("render-resolution-check", `При цели ${resolutionLabel} вероятный ограничитель — GPU. Сравните масштаб рендера и качество теней в одной сцене.`, "medium");
  if (bottleneck === "cpu" || cpuScore < 8) {
    push("hardware-checklist", "Проверьте частоты и температуру главного потока под длительной нагрузкой. Не фиксируйте питание всех ядер без сравнения.");
  }
  if (vendor === "nvidia") {
    push("nvidia-panel", "Сверьте параметры драйвера NVIDIA и выбранный для Rust режим Reflex. Сравните задержку и 1% low в одной сцене.", "medium");
  } else if (vendor === "amd") {
    push("amd-adrenalin", "Сверьте настройки AMD Software с выбранным режимом задержки. Radeon Anti-Lag меняется в драйвере, а не в client.cfg.", "medium");
  }
  if (input.backgroundLoad !== "stream") push("game-mode-dvr", "Отключает фоновую запись Game DVR и отдаёт приоритет потокам игры.", "medium");
  push("launch-options", "Чистый -window-mode exclusive без нерабочих флагов из Arma.", "medium");
  push("restore-point", "Создайте точку восстановления перед системными правками.", "medium");

  // Диагностика узких мест
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
      `В ${resolutionLabel} основной упор — ${gpu.name}. Сравните пресеты графики или проверьте масштаб рендера на той же сцене.`,
    );
  } else {
    notes.push(
      `Сбалансированная связка: на MODDED 2X нагрузка распределена ровно, на OFFICIAL HIGH POP с 350+ онлайна плавно смещается на ${cpu.name}.`,
    );
  }
  if (isJedec) {
    notes.push(
      `Задержка RAM ~${latencyNs} нс выглядит как базовый JEDEC. Проверьте в BIOS профиль XMP / DOCP / EXPO и слоты A2+B2.`,
    );
  }
  if (gpu.vram < vt.comfy && pixels > RES_LOAD_POINTS[0].pixels) {
    notes.push(
      `${gpu.vram} ГБ VRAM — ограниченный запас в ${resolutionLabel}. Проверьте более низкое качество текстур на том же маршруте.`,
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
    recommendations: recs,
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
      ramCl: 16,
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
