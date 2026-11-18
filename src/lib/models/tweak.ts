import type { UserOwnedRecord } from "./common";

/**
 * Модель твиков и пользовательских отметок (tweaks).
 * Содержит 6 целевых категорий под Rust, трёхуровневый риск
 * (безопасно / осторожно / вредно), статус верификации (замерено / миф)
 * и user-ready запись состояния с ownerId для Этапа 2.
 */

export type TweakGroupId =
  | "cpu-windows"
  | "gpu"
  | "ram-ssd"
  | "network"
  | "rust-settings"
  | "launch-options";

export type TweakRiskLevel = "safe" | "caution" | "harmful";
export type EvidenceStatus = "measured" | "myth";

export interface TweakGroupMeta {
  id: TweakGroupId;
  title: string;
  shortTitle: string;
  description: string;
}

export const TWEAK_GROUPS: TweakGroupMeta[] = [
  {
    id: "cpu-windows",
    title: "CPU и Windows",
    shortTitle: "CPU / Win",
    description: "Схема питания, Game DVR, планировщик, приоритет, точка восстановления и анти-твики ОС.",
  },
  {
    id: "gpu",
    title: "GPU и драйвер",
    shortTitle: "GPU",
    description: "Панель NVIDIA, AMD Adrenalin, HAGS, Reflex/Anti-Lag и чистка кэша шейдеров.",
  },
  {
    id: "ram-ssd",
    title: "RAM и SSD",
    shortTitle: "RAM / SSD",
    description: "Профили XMP/EXPO, тайминги, двухканал, gc.buffer, файл подкачки и TRIM на SSD.",
  },
  {
    id: "network",
    title: "Сеть",
    shortTitle: "Сеть",
    description: "Энергосбережение сетевой карты, сброс Winsock/DNS и разбор TCP-мифов.",
  },
  {
    id: "rust-settings",
    title: "Настройки Rust",
    shortTitle: "Rust",
    description: "Пресеты client.cfg, каскады теней, вода, maxgibs, оверлеи Steam и полезные бинды.",
  },
  {
    id: "launch-options",
    title: "Launch-опции",
    shortTitle: "Launch",
    description: "Рабочие аргументы Unity для Steam и проверка нерабочих флагов из старых гайдов.",
  },
];

export const TWEAK_RISK_META: Record<
  TweakRiskLevel,
  { label: string; hint: string; order: number }
> = {
  safe: {
    label: "Безопасно",
    hint: "Штатная настройка, обратима в один шаг, без риска для ОС и EAC",
    order: 1,
  },
  caution: {
    label: "Осторожно",
    hint: "Эффект зависит от железа или есть компромисс — замеряйте до/после",
    order: 2,
  },
  harmful: {
    label: "Вредно",
    hint: "Анти-твик: не применять! Не даёт FPS, ломает защиту ОС, стабильность или EAC",
    order: 3,
  },
};

export const EVIDENCE_META: Record<EvidenceStatus, { label: string; hint: string }> = {
  measured: {
    label: "Замерено",
    hint: "Подтверждено документацией движка/ОС и повторяемым эффектом на FPS, 1% low или стабильности",
  },
  myth: {
    label: "Миф",
    hint: "Плацебо или вредный совет из старых гайдов: прирост в пределах погрешности либо регрессия",
  },
};

/** Пользовательская отметка применения и личного замера по конкретному твику. */
export interface UserTweakRecord extends UserOwnedRecord {
  slug: string;
  applied: boolean;
  fpsBefore: number | null;
  fpsAfter: number | null;
  note: string;
}
