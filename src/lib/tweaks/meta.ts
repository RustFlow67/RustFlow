import type { CategoryId, FileKind, Restart, Risk } from "./types";

export interface CategoryMeta {
  id: CategoryId;
  title: string;
  description: string;
  /** Two gradient stops for the icon tile. */
  from: string;
  to: string;
}

export const CATEGORIES: CategoryMeta[] = [
  {
    id: "prep",
    title: "Подготовка",
    description: "Точка восстановления, чистка кэшей, RAM XMP/EXPO, SSD и чек-лист железа.",
    from: "#8e8e93",
    to: "#48484a",
  },
  {
    id: "windows",
    title: "Windows",
    description: "Электропитание, игровой режим, планировщик, файл подкачки и фоновые процессы.",
    from: "#0a84ff",
    to: "#5e5ce6",
  },
  {
    id: "gpu",
    title: "Видеокарта",
    description: "Чек-листы для панели NVIDIA и AMD Adrenalin под Rust.",
    from: "#30d158",
    to: "#00a67d",
  },
  {
    id: "game",
    title: "Rust",
    description: "Пресеты графики, gc.buffer, параметры запуска, бинды и Steam.",
    from: "#ff9f0a",
    to: "#ff453a",
  },
  {
    id: "network",
    title: "Сеть",
    description: "Сброс сетевого стека и отключение энергосбережения адаптера.",
    from: "#64d2ff",
    to: "#0a84ff",
  },
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  CategoryMeta
>;

export const RISK_META: Record<Risk, { label: string; hint: string }> = {
  safe: { label: "Безопасно", hint: "Штатные настройки, легко откатить" },
  moderate: { label: "Осторожно", hint: "Проверьте результат, эффект зависит от системы" },
  advanced: { label: "Продвинуто", hint: "Компромисс с безопасностью или стабильностью" },
};

export const RESTART_LABEL: Record<Restart, string> = {
  none: "Без перезагрузки",
  game: "Перезапуск игры",
  relogin: "Выход из системы",
  reboot: "Перезагрузка ПК",
};

export const FILE_LABEL: Record<FileKind, string> = {
  reg: "REG · реестр",
  bat: "BAT · скрипт",
  txt: "TXT · чек-лист",
};

export interface Phase {
  id: number;
  title: string;
  folder: string;
  description: string;
}

export const PHASES: Phase[] = [
  {
    id: 1,
    title: "Подготовка, RAM и SSD",
    folder: "1-Podgotovka",
    description: "Сначала страховка: точка восстановления, чистые кэши, XMP/EXPO и TRIM на SSD.",
  },
  {
    id: 2,
    title: "CPU и Windows",
    folder: "2-Windows",
    description: "Системные настройки, которые освобождают ресурсы и убирают лишние задержки.",
  },
  {
    id: 3,
    title: "Видеокарта",
    folder: "3-Videokarta",
    description: "Настройки драйвера. Выберите чек-лист под вашего производителя.",
  },
  {
    id: 4,
    title: "Steam и launch-опции",
    folder: "4-Steam",
    description: "Клиент Steam, оверлеи и параметры запуска без мифов и плацебо.",
  },
  {
    id: 5,
    title: "Настройки Rust",
    folder: "5-Igra",
    description: "Пресет графики под ваш ПК, сборщик мусора Unity и бинды.",
  },
  {
    id: 6,
    title: "Сеть",
    folder: "6-Set",
    description: "Стабильность соединения. На пинг до сервера эти шаги не влияют напрямую.",
  },
];

export type ProfileId = "safe" | "recommended" | "max";
export type PresetId = "competitive" | "balanced" | "quality";
export type GpuVendor = "nvidia" | "amd" | "all";

export const PROFILES: { id: ProfileId; title: string; description: string; risks: Risk[] }[] = [
  {
    id: "safe",
    title: "Безопасный",
    description: "Только штатные настройки без побочных эффектов.",
    risks: ["safe"],
  },
  {
    id: "recommended",
    title: "Рекомендуемый",
    description: "Безопасные и проверенные умеренные твики — оптимальный выбор.",
    risks: ["safe", "moderate"],
  },
  {
    id: "max",
    title: "Максимум",
    description: "Включает компромиссные твики (например HVCI). Вредные анти-твики исключены.",
    risks: ["safe", "moderate", "advanced"],
  },
];

export const PRESETS: { id: PresetId; slug: string; title: string; description: string }[] = [
  {
    id: "competitive",
    slug: "preset-competitive",
    title: "Максимум FPS",
    description: "Минимум графики, максимум кадров и читаемости в бою.",
  },
  {
    id: "balanced",
    slug: "preset-balanced",
    title: "Баланс",
    description: "Аккуратная картинка без дорогих эффектов.",
  },
  {
    id: "quality",
    slug: "preset-quality",
    title: "Красота",
    description: "Высокая детализация для мощных видеокарт.",
  },
];

const PRESET_SLUGS = new Set(PRESETS.map((p) => p.slug));

export interface Selection {
  profile: ProfileId;
  preset: PresetId;
  gpu: GpuVendor;
}

/** Решает, входит ли твик в пакет полной настройки (мифы и вредные исключаются всегда). */
export function inSelection(
  t: { slug: string; risk: Risk; excludeFromPack?: boolean },
  sel: Selection,
): boolean {
  if (t.excludeFromPack) return false;
  const profile = PROFILES.find((p) => p.id === sel.profile) ?? PROFILES[1];
  if (!profile.risks.includes(t.risk)) return false;
  if (PRESET_SLUGS.has(t.slug)) return t.slug === `preset-${sel.preset}`;
  if (t.slug === "nvidia-panel") return sel.gpu !== "amd";
  if (t.slug === "amd-adrenalin") return sel.gpu !== "nvidia";
  return true;
}

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
