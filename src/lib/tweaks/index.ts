import type { EvidenceStatus, TweakGroupId, TweakRiskLevel } from "@/lib/models/tweak";
import { EXTRA_TWEAKS } from "./extras";
import { GAME_TWEAKS } from "./game";
import { OTHER_TWEAKS } from "./other";
import type { Tweak, TweakFile, TweakLite } from "./types";
import { WINDOWS_TWEAKS } from "./windows";

/** Метаданные классификации и оценки прироста для существующих твиков. */
const ENRICHMENT: Record<
  string,
  { group: TweakGroupId; riskLevel?: TweakRiskLevel; evidence?: EvidenceStatus; gainPct: number; gainLabel: string }
> = {
  "restore-point": { group: "cpu-windows", gainPct: 0, gainLabel: "Страховка отката" },
  "clean-temp-cache": { group: "gpu", gainPct: 4, gainLabel: "Меньше статтеров" },
  "hardware-checklist": { group: "cpu-windows", gainPct: 16, gainLabel: "+10–20% в сумме" },
  "ultimate-power-plan": { group: "cpu-windows", gainPct: 7, gainLabel: "+5–10% 1% low" },
  "game-mode-dvr": { group: "cpu-windows", gainPct: 6, gainLabel: "+3–8% FPS" },
  hags: { group: "gpu", riskLevel: "caution", gainPct: 5, gainLabel: "+2–6% / отклик" },
  "background-apps": { group: "cpu-windows", gainPct: 5, gainLabel: "−0.8 ГБ ОЗУ в фоне" },
  "pagefile-auto": { group: "ram-ssd", gainPct: 10, gainLabel: "Без вылетов OOM" },
  "mouse-accel-off": { group: "cpu-windows", gainPct: 2, gainLabel: "Точный ввод 1:1" },
  "visual-effects": { group: "cpu-windows", gainPct: 3, gainLabel: "+2–4% на слабых GPU" },
  "mmcss-games": { group: "cpu-windows", riskLevel: "caution", gainPct: 3, gainLabel: "+1–3% 1% low" },
  "rust-priority": { group: "cpu-windows", riskLevel: "caution", gainPct: 4, gainLabel: "+2–5% при фоне" },
  "fso-gpu-pref": { group: "gpu", riskLevel: "caution", gainPct: 5, gainLabel: "Дискретная GPU + отклик" },
  "memory-integrity-off": { group: "cpu-windows", riskLevel: "caution", gainPct: 8, gainLabel: "+5–10% CPU (компромисс)" },
  "nvidia-panel": { group: "gpu", gainPct: 8, gainLabel: "−3..6 мс · Reflex" },
  "amd-adrenalin": { group: "gpu", gainPct: 8, gainLabel: "−3..6 мс · Anti-Lag" },
  "steam-checklist": { group: "rust-settings", gainPct: 6, gainLabel: "+3–7% без оверлеев" },
  "launch-options": { group: "launch-options", gainPct: 4, gainLabel: "Меньше input lag" },
  "preset-competitive": { group: "rust-settings", gainPct: 28, gainLabel: "+20–35% FPS (оценка)" },
  "preset-balanced": { group: "rust-settings", gainPct: 15, gainLabel: "+10–20% FPS (оценка)" },
  "preset-quality": { group: "rust-settings", gainPct: 3, gainLabel: "Чёткость без мыла" },
  "gc-buffer": { group: "ram-ssd", gainPct: 20, gainLabel: "+15–30% 1% low" },
  binds: { group: "rust-settings", gainPct: 1, gainLabel: "Удобство в PvP/фарме" },
  "nic-power": { group: "network", riskLevel: "caution", gainPct: 4, gainLabel: "Без микрообрывов" },
  "network-reset": { group: "network", riskLevel: "caution", gainPct: 2, gainLabel: "Ремонт стека сети" },
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
  return t.evidence ?? ENRICHMENT[t.slug]?.evidence ?? "measured";
}

export const TWEAKS: Tweak[] = [...OTHER_TWEAKS, ...WINDOWS_TWEAKS, ...GAME_TWEAKS, ...EXTRA_TWEAKS]
  .map((t) => ({
    ...t,
    group: resolveGroup(t),
    riskLevel: resolveRiskLevel(t),
    evidence: resolveEvidence(t),
    gainPct: t.gainPct ?? ENRICHMENT[t.slug]?.gainPct ?? 0,
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
    slug: t.slug,
    title: t.title,
    tagline: t.tagline,
    what: t.what,
    category: t.category,
    group: resolveGroup(t),
    riskLevel: resolveRiskLevel(t),
    evidence: resolveEvidence(t),
    gainPct: t.gainPct ?? 0,
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
