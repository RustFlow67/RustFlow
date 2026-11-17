import type { EvidenceStatus, TweakGroupId, TweakRiskLevel } from "@/lib/models/tweak";

export type Risk = "safe" | "moderate" | "advanced";
export type CategoryId = "prep" | "windows" | "gpu" | "game" | "network";
export type FileKind = "reg" | "bat" | "txt";
export type Level = 0 | 1 | 2 | 3;
export type Restart = "none" | "game" | "relogin" | "reboot";

export interface TweakFile {
  name: string;
  kind: FileKind;
  content: string;
}

export interface Impact {
  fps: Level;
  smooth: Level;
  latency: Level;
}

export interface Tweak {
  slug: string;
  title: string;
  tagline: string;
  category: CategoryId;
  /** Целевая категория библиотеки твиков (1 из 6). */
  group?: TweakGroupId;
  /** Трёхуровневый риск: safe (безопасно), caution (осторожно), harmful (вредно — анти-твик). */
  riskLevel?: TweakRiskLevel;
  /** Верификация эффекта: measured (замерено) или myth (миф/плацебо). */
  evidence?: EvidenceStatus;
  /** Типовой ожидаемый прирост (%) для фильтрации и сортировки (0 для плацебо, <0 для вредных). */
  gainPct?: number;
  /** Короткая честная подпись ожидаемого эффекта. */
  gainLabel?: string;
  /** Исключить из мастера полной настройки и ZIP-пакета (для мифов и вредных анти-твиков). */
  excludeFromPack?: boolean;
  /** Setup phase (1..6) and position inside the full setup. */
  phase: number;
  order: number;
  risk: Risk;
  impact: Impact;
  admin: boolean;
  restart: Restart;
  time: string;
  os: string;
  featured?: boolean;
  /** What exactly the file changes. */
  what: string;
  /** Honest explanation of what to expect in Rust. */
  why: string;
  steps: string[];
  check: string;
  revertSteps: string[];
  warnings?: string[];
  file: TweakFile;
  revert?: TweakFile;
  /** Optional copy-paste block for applying the tweak by hand. */
  manual?: { title: string; note: string; content: string };
}

/** Client-safe summary without full script bodies. */
export interface TweakLite {
  slug: string;
  title: string;
  tagline: string;
  what: string;
  category: CategoryId;
  group: TweakGroupId;
  riskLevel: TweakRiskLevel;
  evidence: EvidenceStatus;
  gainPct: number;
  gainLabel: string;
  excludeFromPack: boolean;
  phase: number;
  order: number;
  risk: Risk;
  impact: Impact;
  admin: boolean;
  restart: Restart;
  time: string;
  featured: boolean;
  fileName: string;
  fileKind: FileKind;
  hasRevert: boolean;
  steps: string[];
  check: string;
}
