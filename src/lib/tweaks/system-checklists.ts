import type { Tweak } from "./types";
import { WINDOWS } from "../models/build-settings";

/** Manual, reversible checks. They aren't benchmark results and don't install
 * a driver, edit the registry or change another application's settings. */
function checklist(
  meta: Pick<
    Tweak,
    "slug" | "title" | "tagline" | "category" | "phase" | "order" | "os" | "group" | "windowsVersion"
  >,
  steps: string[],
  check: string,
  revert: string,
): Tweak {
  return {
    ...meta,
    risk: "safe", evidence:"conditional",
    impact: { fps: 0, smooth: 0, latency: 0 },
    gainLabel: "Ручная проверка",
    admin: false,
    restart: "game",
    time: "По ситуации",
    what: meta.tagline,
    why: "Сравните результат до и после в одной сцене. Если настройка уже подходит, пропустите шаг.",
    steps,
    check,
    revertSteps: [revert],
    file: {
      kind: "txt",
      name: `${meta.slug}.txt`,
      content: [meta.title, ...steps, check, revert].join("\n"),
    },
  };
}
export const SYSTEM_CHECKLISTS: Tweak[] = [
  ...WINDOWS.map(({ value: version, label }, i) =>
    checklist(
      {
        slug: `windows-${version}-graphics`,
        title: `${label}: проверить графический профиль Rust`,
        tagline: `Штатный выбор видеокарты для игры в ${label}`,
        group: "cpu-windows",
        category: "windows",
        phase: 2,
        order: 26 + i,
        os: label,
        windowsVersion: version,
      },
      [
        version === "11"
          ? "Откройте Параметры → Система → Дисплей → Графика."
          : "Откройте Параметры → Система → Дисплей → Настройки графики.",
        "Найдите RustClient.exe или добавьте его как классическое приложение. Запишите исходный выбор.",
        "Если в ПК две видеокарты, выберите для игры производительную GPU. На ПК с одной GPU оставьте настройку без изменений.",
      ],
      "Перезапустите Rust и проверьте используемый графический процессор в диспетчере задач.",
      "В том же разделе верните записанный вариант либо удалите созданный профиль приложения.",
    ),
  ),
  checklist(
    {
      slug: "rust-library-ssd",
      title: "Перенос Rust с HDD на SSD",
      tagline: "Проверьте расположение библиотеки до настройки Windows",
      category: "prep",
      group: "ram-ssd",
      phase: 1,
      order: 6,
      os: "Любая ОС",
    },
    [
      "В Steam → Настройки → Хранилище проверьте диск, на котором установлен Rust. Если это уже SSD, шаг не нужен.",
      "При наличии SSD с достаточным свободным местом добавьте его в библиотеку, выделите Rust и нажмите «Переместить». Не удаляйте исходные файлы вручную.",
    ],
    "Дождитесь окончания переноса в Steam, проверьте целостность файлов и сравните время входа на тот же сервер.",
    "В Steam так же перенесите игру обратно в исходную библиотеку.",
  ),
  checklist(
    {
      slug: "render-resolution-check",
      title: "Проверка нагрузки GPU при высоком разрешении",
      tagline: "Отделите ограничение видеокарты от ограничения главного потока",
      category: "game",
      group: "rust-settings",
      phase: 5,
      order: 245,
      os: "Любая ОС",
    },
    [
      "Запишите текущее разрешение, масштаб рендера и настройки теней. Сохраните свой client.cfg.",
      "На том же сервере и в той же точке уменьшите только масштаб рендера на один шаг. Сравните средний FPS и 1% low, затем отдельно проверьте качество теней.",
    ],
    "Если FPS почти не изменился, верните разрешение: вероятнее ограничение CPU или сервера.",
    "Верните записанный масштаб, разрешение и настройки теней в игре.",
  ),
];
