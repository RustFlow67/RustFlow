import type { UserOwnedRecord } from "./common";

/**
 * Модель замера производительности до/после (logs).
 * Хранится в адаптере хранилища, содержит ownerId для Этапа 2.
 */

export type ServerKind = "modded" | "official" | "staging";

export const SERVER_KIND_LABEL: Record<ServerKind, string> = {
  modded: "Моддед (2x–5x)",
  official: "Официал (High Pop)",
  staging: "Тест / Staging",
};

export interface BenchmarkLog extends UserOwnedRecord {
  title: string;
  tweakSlug: string | null;
  serverKind: ServerKind;
  scene: string;
  beforeAvg: number;
  afterAvg: number;
  beforeLow1: number;
  afterLow1: number;
  beforeFrametime: number;
  afterFrametime: number;
  notes: string;
  /** Пометка демонстрационной записи из стартового набора. */
  isSample?: boolean;
}

export type NewBenchmarkLog = Omit<BenchmarkLog, keyof UserOwnedRecord>;

export interface LogDelta {
  avgDiff: number;
  avgPct: number;
  low1Diff: number;
  low1Pct: number;
  frametimeDiff: number;
  /** Отрицательный процент по frametime = кадр рисуется быстрее (улучшение). */
  frametimePct: number;
  verdict: "positive" | "neutral" | "negative";
}

function pctChange(before: number, after: number): number {
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return 0;
  return Math.round(((after - before) / before) * 1000) / 10;
}

export function computeLogDelta(log: Pick<
  BenchmarkLog,
  "beforeAvg" | "afterAvg" | "beforeLow1" | "afterLow1" | "beforeFrametime" | "afterFrametime"
>): LogDelta {
  const avgDiff = Math.round((log.afterAvg - log.beforeAvg) * 10) / 10;
  const avgPct = pctChange(log.beforeAvg, log.afterAvg);
  const low1Diff = Math.round((log.afterLow1 - log.beforeLow1) * 10) / 10;
  const low1Pct = pctChange(log.beforeLow1, log.afterLow1);
  const frametimeDiff = Math.round((log.afterFrametime - log.beforeFrametime) * 100) / 100;
  const frametimePct = pctChange(log.beforeFrametime, log.afterFrametime);

  // Считаем изменение значимым при сдвиге ≥2% по avg или ≥3% по 1% low
  const composite = avgPct * 0.55 + low1Pct * 0.45;
  const verdict: LogDelta["verdict"] =
    composite >= 2 || low1Pct >= 3 ? "positive" : composite <= -2 || low1Pct <= -3 ? "negative" : "neutral";

  return { avgDiff, avgPct, low1Diff, low1Pct, frametimeDiff, frametimePct, verdict };
}

export function fpsToFrametime(fps: number): number {
  if (!Number.isFinite(fps) || fps <= 0) return 0;
  return Math.round((1000 / fps) * 10) / 10;
}

/** Стартовые примерные замеры (реалистичная серия на Ryzen 5 5600X + RTX 5060 + 32GB@3600). */
export const SAMPLE_LOGS: BenchmarkLog[] = [
  {
    id: "log_sample_1",
    ownerId: "local-user",
    createdAt: "2026-02-10T18:10:00.000Z",
    updatedAt: "2026-02-10T18:10:00.000Z",
    title: "Включение XMP 3600 CL18 (вместо JEDEC 2400)",
    tweakSlug: "xmp-expo-timings",
    serverKind: "official",
    scene: "Rustafied EU Main (380 онл.) · пробежка у Outpost, полдень",
    beforeAvg: 79,
    afterAvg: 95,
    beforeLow1: 49,
    afterLow1: 65,
    beforeFrametime: 12.7,
    afterFrametime: 10.5,
    notes: "5600X + RTX 5060 + 32GB. Ушли провалы при повороте на застройку.",
    isSample: true,
  },
  {
    id: "log_sample_2",
    ownerId: "local-user",
    createdAt: "2026-02-11T19:25:00.000Z",
    updatedAt: "2026-02-11T19:25:00.000Z",
    title: "gc.buffer 4096 в client.cfg",
    tweakSlug: "gc-buffer",
    serverKind: "modded",
    scene: "Modded 2x Trio (220 онл.) · пролёт мимо клановой базы, 60 сек × 3",
    beforeAvg: 136,
    afterAvg: 139,
    beforeLow1: 71,
    afterLow1: 94,
    beforeFrametime: 7.4,
    afterFrametime: 7.2,
    notes: "Средний FPS почти тот же, но исчез пик 42 мс раз в 40 секунд.",
    isSample: true,
  },
  {
    id: "log_sample_3",
    ownerId: "local-user",
    createdAt: "2026-02-12T20:05:00.000Z",
    updatedAt: "2026-02-12T20:05:00.000Z",
    title: "Пресет графики «Максимум FPS» (после средних)",
    tweakSlug: "preset-competitive",
    serverKind: "modded",
    scene: "Modded 2x Trio (210 онл.) · перестрелка у Launch Site",
    beforeAvg: 118,
    afterAvg: 144,
    beforeLow1: 81,
    afterLow1: 96,
    beforeFrametime: 8.5,
    afterFrametime: 6.9,
    notes: "Shadow cascades 1 + water 0 + maxgibs 0 дали основной прирост.",
    isSample: true,
  },
  {
    id: "log_sample_4",
    ownerId: "local-user",
    createdAt: "2026-02-13T17:40:00.000Z",
    updatedAt: "2026-02-13T17:40:00.000Z",
    title: "Проверка мифа: -malloc=system -maxMem=32768",
    tweakSlug: "launch-myth-arma",
    serverKind: "official",
    scene: "Rustafied EU Main (370 онл.) · та же точка у Outpost",
    beforeAvg: 95,
    afterAvg: 94,
    beforeLow1: 65,
    afterLow1: 64,
    beforeFrametime: 10.5,
    afterFrametime: 10.6,
    notes: "В пределах погрешности (±1 FPS). Убрал из параметров запуска.",
    isSample: true,
  },
];

export const TEST_PROTOCOL_STEPS: { id: string; title: string; detail: string }[] = [
  {
    id: "one-change",
    title: "Строго один твик за раз",
    detail: "Применили пакет из 10 правок — не узнаете, какая дала +12%, а какая добавила статтеры.",
  },
  {
    id: "same-scene",
    title: "Одна сцена, сервер и время суток",
    detail: "Замеряйте на одном маршруте (60–90 сек) при схожем онлайне и без смены дня/ночи.",
  },
  {
    id: "warmup",
    title: "Прогрев 2–3 минуты после входа",
    detail: "Дайте Unity и драйверу подгрузить шейдеры и скины, иначе первый прогон занизит 1% low.",
  },
  {
    id: "clean-bg",
    title: "Фиксированный фон и температуры",
    detail: "Закройте браузер и загрузки Steam. Следите за 1% low и frametime (CapFrameX / MSI Afterburner / perf 4).",
  },
  {
    id: "three-runs",
    title: "Минимум 2–3 прогона и откат при <2%",
    detail: "Разница ±1–2% — шум сервера. Если прироста нет или вырос frametime — откатывайте твик.",
  },
];
