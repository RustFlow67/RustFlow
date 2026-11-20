import { EAC_RULES, FAQ, GUIDE, HARMFUL_TWEAKS, MYTHS } from "@/lib/content";
import { KNOWLEDGE_TYPE_LABEL, readingHome, readingHref, type ReadingHome } from "@/lib/knowledge-base";
import { tweakerHref } from "@/lib/tweaker";
import type { TweakRiskLevel } from "@/lib/models/tweak";
import { readingKey } from "./keys";
export interface ReadingEntry {
  key: string;
  group: string;
  title: string;
  text: string;
  example: string;
  category: string;
  summary?: string;
  keywords?: string;
  anchor?: string;
  code?: string;
  warning?: boolean;
  note?: string;
  badge?: string;
  risk?: TweakRiskLevel;
  href?: string;
  link?: string;
  answer?: string[];
  alternative?: string;
}
export interface ReadingGroup {
  id: string;
  title: string;
  lead: string;
  kicker: string;
  entries: ReadingEntry[];
}
// Keep reading keys stable across the move. A topic has one canonical home;
// the roadmap contains links, not a second copy of four catalogues.
const sections: Record<string, ReadingHome> = {
  files: "/tweaker",
  safety: "/faq",
  measure: "/windows",
  "kb-windows": "/windows",
  "kb-rust": "/presets",
  "kb-binds": "/presets",
  "kb-drivers": "/drivers",
  trouble: "/presets",
};
const labels: Record<ReadingHome, string> = {
  "/tweaker": "Файлы пакета",
  "/faq": "Безопасность ОС",
  "/windows": "Windows",
  "/presets": "Практика Rust",
  "/drivers": "Драйверы",
};
function distribute(home: ReadingHome): ReadingGroup[] {
  return GUIDE.flatMap((g) => {
    const points = g.points.filter((p) => (p.entry ? readingHome(p.entry) : sections[g.id]) === home);
    // A split group must have a unique id on each page, while old anchors
    // always have an unambiguous destination.
    return points.length
      ? [
          {
            id: sections[g.id] === home ? g.id : `${g.id}-${home.slice(1)}`,
            title: g.title,
            lead: g.lead,
            kicker: labels[home],
            entries: points.map((p) => ({
              key: readingKey(g.id, p.title),
              group: g.id,
              title: p.title,
              text: p.text,
              example: p.example,
              category: g.title,
              summary: p.entry?.question ?? g.lead,
              keywords: p.entry?.keywords.join(" "),
              anchor: p.entry && `kb-${p.entry.id}`,
              code: p.entry?.example,
              note: p.entry?.note,
              badge: p.entry && KNOWLEDGE_TYPE_LABEL[p.entry.type],
              risk: p.entry?.risk,
            })),
          },
        ]
      : [];
  });
}
export const driverGroups = distribute("/drivers"),
  presetGroups = distribute("/presets"),
  fileGroups = distribute("/tweaker");
export const windowsGroups: ReadingGroup[] = [
  {
    id: "windows-basics",
    title: "Параметры Windows 10 и 11",
    lead: "Откройте нужный раздел в Параметрах Windows. Запишите исходный выбор перед тестом.",
    kicker: "Настройка ОС",
    entries: [
      [
        "Питание и температуры",
        "На ноутбуке подключите штатный БП. В Windows 11 откройте Система → Питание и батарея, в Windows 10 — Электропитание. Начните со сбалансированного плана.",
        "Более высокая частота в первые секунды не доказывает выигрыш: прогрейте ПК, проверьте длительность кадров и нагрев. Верните прежний план, если шума больше, а разницы нет.",
      ],
      [
        "Game Mode и запись клипов",
        "Параметры → Игры → Игровой режим. Проверьте отдельно фоновую запись в разделе записей. Для стрима не выключайте используемый захват.",
        "Сравните один маршрут сначала с прежней записью, затем без неё. Два изменения сразу не позволят понять причину.",
      ],
      [
        "VBS, Hyper-V и целостность памяти",
        "VBS изолирует важные части Windows, а HVCI проверяет код драйверов. Отключение ослабляет защиту и не гарантирует более плавную игру. Состояние VBS видно в «Сведениях о системе». Оставьте их и гипервизор в штатном состоянии.",
        "WSL, виртуальным машинам и некоторым средствам защиты нужен гипервизор. Пакет не изменяет его и не отключает HVCI.",
      ],
      [
        "Службы и фоновые задачи",
        "Во время просадки отсортируйте Диспетчер задач по CPU и диску. Перенесите синхронизацию или сканирование на другое время; не выключайте целые группы служб.",
        "Пауза синхронизации полезнее удаления OneDrive: снимите паузу после игры. Оставьте обновления, защиту и оптимизацию дисков включёнными.",
      ],
    ].map(([title, text, example]) => ({
      key: readingKey("windows-basics", title),
      group: "windows-basics",
      title,
      text,
      example,
      category: "Windows 10 / 11",
    })),
  },
  ...distribute("/windows"),
];
const safetyGroups = distribute("/faq");
export const guideGroups = [
  ...windowsGroups,
  ...driverGroups,
  ...presetGroups,
  ...fileGroups,
  ...safetyGroups,
]; // stable popularity namespace
export const movedAnchors: Record<string, string> = Object.fromEntries([
  ...Object.entries(sections).map(([id, path]) => [id, readingHref(path, id)]),
  ...GUIDE.flatMap((g) =>
    g.points.flatMap((p) =>
      p.entry ? [[`kb-${p.entry.id}`, readingHref(readingHome(p.entry), `kb-${p.entry.id}`)]] : [],
    ),
  ),
]);
export const faqGroups: ReadingGroup[] = [
  {
    id: "eac",
    title: "Правила Easy Anti-Cheat",
    kicker: "Безопасность",
    lead: "Отличайте вмешательство в клиент от штатных настроек. Решение о санкциях принимает разработчик игры.",
    entries: EAC_RULES.map((r) => ({
      key: readingKey("eac", r.title),
      group: "eac",
      title: r.title,
      text: r.detail,
      example: r.example,
      category: "Правила EAC",
      risk: r.verdict === "ban" ? "harmful" : "safe",
      badge: r.verdict === "ban" ? "Риск блокировки" : "Штатная настройка",
    })),
  },
  ...safetyGroups,
  {
    id: "harmful",
    title: "Вредные твики: чего избегать",
    kicker: "Красный список",
    lead: "Популярное не значит безопасное. Здесь — риски и обратимые альтернативы.",
    entries: HARMFUL_TWEAKS.map((r) => ({
      key: readingKey("harmful", r.title),
      group: "harmful",
      title: r.title,
      text: r.whyHarmful,
      example: r.safeAlternative,
      alternative: r.safeAlternative,
      category: "Разбор риска",
      code: r.example,
      warning: true,
      risk: "harmful",
      badge: r.danger,
      href: r.tweakSlug && tweakerHref(r.tweakSlug),
      link: "Инструкция проверки / восстановления",
    })),
  },
  {
    id: "myths",
    title: "Список плацебо и популярных мифов",
    kicker: "Проверено замерами",
    lead: "Сравнивайте советы с поведением современного клиента Rust.",
    entries: MYTHS.map((r) => ({
      key: readingKey("myths", r.title),
      group: "myths",
      title: r.title,
      text: r.truth,
      example: `Утверждение из гайдов: «${r.code}». Что ожидать на практике: ${r.measuredDelta}.`,
      category: "Разбор мифа",
      code: r.code,
      warning: true,
      badge: `Миф · ${r.measuredDelta}`,
      href: r.tweakSlug && tweakerHref(r.tweakSlug),
      link: "Подробнее в Твикере",
    })),
  },
  {
    id: "faq",
    title: "Частые вопросы",
    kicker: "FAQ",
    lead: "Античит, настройки и проверка результата.",
    entries: FAQ.map((r) => ({
      key: readingKey("faq", r.q),
      group: "faq",
      title: r.q,
      text: r.a.join(" "),
      example: "",
      category: r.tag,
      answer: r.a,
      href: r.href,
      link: "К инструкции",
    })),
  },
];
