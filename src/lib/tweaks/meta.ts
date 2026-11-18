import type { FileKind, Restart, Risk } from "./types";

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

export type PresetId = "competitive" | "balanced" | "quality";
export type GpuVendor = "nvidia" | "amd" | "all";

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

export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
