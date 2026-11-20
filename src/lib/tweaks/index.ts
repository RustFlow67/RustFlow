import type { EvidenceStatus, TweakGroupId, TweakRiskLevel } from "@/lib/models/tweak";
import { ADVISORIES } from "./advisories";
import { PRACTICAL } from "./practical";
import { SYSTEM_CHECKLISTS } from "./system-checklists";
import { EXTRA_TWEAKS } from "./extras";
import { GAME_TWEAKS } from "./game";
import { OTHER_TWEAKS } from "./other";
import type { Tweak, TweakFile, TweakLite } from "./types";
import { WINDOWS_TWEAKS } from "./windows";

/** Метаданные классификации и оценки прироста для существующих твиков. */
const ENRICHMENT: Record<
  string,
  { group: TweakGroupId; riskLevel?: TweakRiskLevel; evidence?: EvidenceStatus; gainLabel: string }
> = {
  "restore-point": { group: "cpu-windows", gainLabel: "Страховка отката" },
  "clean-temp-cache": { group: "gpu", gainLabel: "Меньше статтеров" },
  "hardware-checklist": { group: "cpu-windows", gainLabel: "Проверка ограничений" },
  "ultimate-power-plan": { group: "cpu-windows", gainLabel: "Сравнить от сети" },
  "game-mode-dvr": { group: "cpu-windows", gainLabel: "Если включена запись" },
  hags: { group: "gpu", riskLevel: "caution", gainLabel: "Возможна регрессия" },
  "background-apps": { group: "cpu-windows", gainLabel: "Фон приложений Store" },
  "pagefile-auto": { group: "ram-ssd", gainLabel: "При нехватке памяти" },
  "mouse-accel-off": { group: "cpu-windows", gainLabel: "Движение указателя" },
  "visual-effects": { group: "cpu-windows", gainLabel: "Интерфейс Windows" },
  "mmcss-games": { group: "cpu-windows", riskLevel: "caution", gainLabel: "Не для пакета" },
  "rust-priority": { group: "cpu-windows", riskLevel: "caution", gainLabel: "Тест при загрузке CPU" },
  "fso-gpu-pref": { group: "gpu", riskLevel: "caution", gainLabel: "Проверка режима вывода" },
  "nvidia-panel": { group: "gpu", gainLabel: "Отклик · Reflex" },
  "amd-adrenalin": { group: "gpu", gainLabel: "Отклик · Anti-Lag" },
  "steam-checklist": { group: "rust-settings", gainLabel: "Если занят фон Steam" },
  "launch-options": { group: "launch-options", gainLabel: "Проверка запуска" },
  "preset-competitive": { group: "rust-settings", gainLabel: "При ограничении рендера" },
  "preset-balanced": { group: "rust-settings", gainLabel: "Компромисс графики" },
  "preset-quality": { group: "rust-settings", gainLabel: "Чёткость без мыла" },
  "gc-buffer": { group: "ram-ssd", gainLabel: "Бюджет GC" },
  binds: { group: "rust-settings", gainLabel: "Удобство в PvP/фарме" },
  "nic-power": { group: "network", riskLevel: "caution", gainLabel: "Тест после сна" },
  "network-reset": { group: "network", riskLevel: "caution", gainLabel: "Ремонт стека сети" },
};

function resolveGroup(t: Tweak): TweakGroupId {
  if (t.group) return t.group;
  if (ENRICHMENT[t.slug]) return ENRICHMENT[t.slug].group;
  if (t.category === "gpu") return "gpu";
  if (t.category === "network") return "network";
  if (t.category === "game") return "rust-settings";
  return "cpu-windows";
}

function resolveRiskLevel(t: Tweak): TweakRiskLevel {
  if (t.riskLevel) return t.riskLevel;
  if (ENRICHMENT[t.slug]?.riskLevel) return ENRICHMENT[t.slug].riskLevel!;
  return t.risk === "safe" ? "safe" : "caution";
}

function resolveEvidence(t: Tweak): EvidenceStatus {
  return t.evidence ?? ENRICHMENT[t.slug]?.evidence ?? "conditional";
}

export const TWEAKS: Tweak[] = [
  ...OTHER_TWEAKS,
  ...WINDOWS_TWEAKS,
  ...SYSTEM_CHECKLISTS,
  ...GAME_TWEAKS,
  ...EXTRA_TWEAKS,
  ...PRACTICAL,
  ...ADVISORIES,
]
  .map((t) => ({
    ...t,
    group: resolveGroup(t),
    riskLevel: resolveRiskLevel(t),
    evidence: resolveEvidence(t),
    gainLabel: t.gainLabel ?? ENRICHMENT[t.slug]?.gainLabel ?? "Стабильность",
    excludeFromPack: Boolean(t.excludeFromPack),
  }))
  .sort((a, b) => a.order - b.order);

const BY_SLUG = new Map(TWEAKS.map((t) => [t.slug, t]));

export function getTweak(slug: string): Tweak | undefined {
  return BY_SLUG.get(slug);
}

export function toLite(t: Tweak): TweakLite {
  return {
    windowsVersion: t.windowsVersion,
    slug: t.slug,
    title: t.title,
    tagline: t.tagline,
    what: t.what,
    category: t.category,
    group: resolveGroup(t),
    riskLevel: resolveRiskLevel(t),
    evidence: resolveEvidence(t),
    gainLabel: t.gainLabel ?? "Стабильность",
    excludeFromPack: Boolean(t.excludeFromPack),
    phase: t.phase,
    order: t.order,
    risk: t.risk,
    impact: t.impact,
    admin: t.admin,
    restart: t.restart,
    time: t.time,
    featured: Boolean(t.featured),
    fileName: t.file.name,
    fileKind: t.file.kind,
    hasRevert: Boolean(t.revert),
    steps: t.steps,
    check: t.check,
  };
}

export const TWEAKS_LITE: TweakLite[] = TWEAKS.map(toLite);

export function encodeFile(file: TweakFile) {
  const text = file.content.replace(/\r?\n/g, "\r\n");
  return new TextEncoder().encode(file.kind === "txt" ? `\uFEFF${text}` : text);
}

export function isAscii(text: string): boolean {
  return /^[\x00-\x7F]*$/.test(text);
}
