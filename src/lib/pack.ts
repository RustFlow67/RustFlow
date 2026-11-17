import { encodeFile, TWEAKS } from "./tweaks";
import {
  inSelection,
  PHASES,
  PRESETS,
  PROFILES,
  RESTART_LABEL,
  RISK_META,
  type Selection,
} from "./tweaks/meta";
import { createZip, type ZipEntry } from "./zip";

const ROOT = "RustFlow-Pack";

/** Builds the full-setup ZIP: numbered files by phase, revert files and a README. */
export function buildPack(sel: Selection): { zip: Buffer; count: number } {
  const chosen = TWEAKS.filter((t) => inSelection(t, sel));
  const entries: ZipEntry[] = [];
  const reverts = new Set<string>();
  const profile = PROFILES.find((p) => p.id === sel.profile) ?? PROFILES[1];
  const preset = PRESETS.find((p) => p.id === sel.preset) ?? PRESETS[1];

  const lines: string[] = [
    "RustFlow — полная настройка системы для Rust",
    "============================================",
    "",
    `Профиль: ${profile.title}. Пресет графики: ${preset.title}. Твиков в пакете: ${chosen.length}.`,
    "",
    "КАК ПОЛЬЗОВАТЬСЯ",
    "1. Распакуйте архив в любую папку.",
    "2. Идите по папкам и номерам файлов по порядку. Первым шагом создаётся точка восстановления.",
    "3. Файлы .reg и .bat запускаются двойным кликом. Если SmartScreen предупреждает о неизвестном",
    "   издателе — «Подробнее» → «Выполнить в любом случае». Все файлы текстовые: их можно открыть",
    "   в Блокноте и прочитать перед запуском.",
    "4. Файлы .txt — чек-листы для настроек, которые делаются вручную.",
    "5. После всех шагов перезагрузите компьютер и сравните FPS (в игре: F1 → perf 1).",
    "",
    "ОТКАТ",
    "Файлы для отмены каждого изменения лежат в папке Otkat.",
    "Вернуть всё сразу можно через точку восстановления: Win + R → rstrui.",
    "",
    "ВАЖНО",
    "Твики меняют только настройки Windows, драйвера и штатные настройки игры.",
    "Файлы игры и её память не затрагиваются. Вы применяете изменения на свой страх и риск.",
    "RustFlow не связан с Facepunch Studios.",
    "",
  ];

  let n = 0;
  for (const phase of PHASES) {
    const items = chosen.filter((t) => t.phase === phase.id);
    if (items.length === 0) continue;
    lines.push("", `ЭТАП ${phase.id}. ${phase.title.toUpperCase()}`, "-".repeat(60), phase.description, "");
    for (const t of items) {
      n += 1;
      const num = String(n).padStart(2, "0");
      const fileName = `${num}-${t.file.name}`;
      entries.push({ name: `${ROOT}/${phase.folder}/${fileName}`, data: encodeFile(t.file) });
      if (t.revert && !reverts.has(t.revert.name)) {
        reverts.add(t.revert.name);
        entries.push({ name: `${ROOT}/Otkat/${t.revert.name}`, data: encodeFile(t.revert) });
      }
      lines.push(
        `${num}. ${t.title}`,
        `    Файл: ${phase.folder}\\${fileName}`,
        `    Уровень: ${RISK_META[t.risk].label}. ${RESTART_LABEL[t.restart]}. ${t.admin ? "Нужны права администратора." : "Права администратора не нужны."}`,
        `    Что делает: ${t.what}`,
        "    Шаги:",
        ...t.steps.map((s, i) => `      ${i + 1}) ${s}`),
        `    Проверка: ${t.check}`,
        `    Откат: ${t.revertSteps.join(" ")}`,
        "",
      );
    }
  }

  const readme = `\uFEFF${lines.join("\r\n")}\r\n`;
  entries.unshift({ name: `${ROOT}/README.txt`, data: Buffer.from(readme, "utf8") });

  return { zip: createZip(entries), count: chosen.length };
}
