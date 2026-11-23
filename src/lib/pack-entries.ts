import { encodeFile, TWEAKS } from "./tweaks";
import { getGraphicsProfile, profileCfg, textureMipForVram, type GraphicsProfileId } from "./graphics-profiles";
import { getConnectionProfile, isMonitorHz, type ConfigTuning } from "./models/build-settings";
import { supportedLatency, gcBudget } from "./models/play-settings";
import { registryBackup } from "./tweaks/registry-backup";
import { cfgRestore } from "./tweaks/helpers";
import { TWEAK_RISK_META } from "./models/tweak";
import { PHASES, RESTART_LABEL } from "./tweaks/meta";
import { fitsVendor, fitsWindows, packEligible, type TweakerVendor } from "./tweaker";

const ROOT = "RustFlow-Pack";

export function packEntries({
  slugs,
  mode,
  gpu,
  ram,
  vram,
  tuning,
}: {
  slugs: readonly string[];
  mode: GraphicsProfileId;
  gpu: TweakerVendor;
  ram: number;
  vram?: number;
  tuning?: ConfigTuning;
}) {
  const chosen = TWEAKS.filter(
    (t) =>
      slugs.includes(t.slug) &&
      packEligible(t) &&
      fitsVendor(t.slug, gpu) &&
      fitsWindows(t, tuning?.windowsVersion),
  );
  if (chosen.length !== new Set(slugs).size) return null;
  const encoder = new TextEncoder();
  const entries: { name: string; data: Uint8Array<ArrayBuffer> }[] = [];
  const text = (name: string, content: string) =>
    entries.push({
      name: `${ROOT}/${name}`,
      data: encoder.encode(`\uFEFF${content.replace(/\r?\n/g, "\r\n")}`),
    });
  const reverts = new Set<string>();
  const profile = getGraphicsProfile(mode)!;
  const connection = getConnectionProfile(tuning?.connection);
  text(
    "README.txt",
    [
      "RustFlow — выбранные настройки Rust",
      `Профиль: ${profile.title}. Видеокарта: ${gpu.toUpperCase()}. ОЗУ: ${ram} ГБ. Выбрано шагов: ${chosen.length}.`,
      ...(tuning?.windowsVersion ? [`ОС: Windows ${tuning.windowsVersion}.`] : []),
      `Буфер GC: ${gcBudget(ram, tuning).mb} МБ.`,
      ...(gpu === "amd" && supportedLatency(tuning?.latencyMode, gpu) === "on"
        ? ["Radeon Anti-Lag включите вручную в AMD Software для профиля Rust. Конфиг не меняет драйвер."]
        : []),
      ...(isMonitorHz(tuning?.monitorHz)
        ? [`Лимит FPS: ${tuning.monitorHz}, по выбранной частоте монитора.`]
        : []),
      ...(connection
        ? [`Сеть: ${connection.label}. Параметры сети в client.cfg не меняются.`]
        : []),
      "",
      "1. Распакуйте архив. Перед системными изменениями создайте точку восстановления Windows и запишите текущие значения.",
      ...(chosen.some((t) => t.file.kind === "reg")
        ? [
            "Перед каждым REG запустите его snapshot.bat из папки Do-REG. Если снимок не создан, не применяйте REG. Сохраните снимок в %LOCALAPPDATA%\\RustFlow\\Registry до отката; используйте ту же учётную запись. При возврате используйте restore-snapshot.bat, а не общий сброс к умолчаниям. Откатывайте в обратном порядке, особенно если шаги меняли один параметр.",
          ]
        : []),
      "2. Прочитайте инструкции и открытые файлы перед применением. Выполняйте только подходящие пункты, по одному.",
      "3. Перед правкой графики закройте Rust. Сохраните копию cfg\\client.cfg рядом с оригиналом как client.cfg.rustflow-backup.",
      "   Перенесите команды из client.cfg этого архива в оригинал, заменяя только одноимённые строки.",
      "   Разрешение и текстуры выставьте в меню игры; остальные настройки своего файла сохраните.",
      "4. Проверьте FPS и 1% low в одной сцене. Откат к каждому шагу — в папке Otkat, системное восстановление — rstrui.",
      "",
      "Штатные настройки Windows, драйвера и игры; без вмешательства в память Rust. RustFlow не связан с Facepunch Studios.",
      "",
      ...chosen.map((t) => `• ${t.title} (${t.slug})`),
      "",
    ].join("\n"),
  );
  entries.push({
    name: `${ROOT}/client.cfg`,
    data: encoder.encode(
      profileCfg(mode, ram, "", vram === undefined ? undefined : textureMipForVram(vram), tuning, gpu).replace(
        /\n/g,
        "\r\n",
      ) + "\r\n",
    ),
  });
  entries.push({
    name: `${ROOT}/Otkat/rustflow-restore-client-cfg.bat`,
    data: encodeFile({ name: "rustflow-restore-client-cfg.bat", kind: "bat", content: cfgRestore() }),
  });
  text(
    "Otkat/client-cfg.txt",
    "При закрытом Rust восстановите свой cfg\\client.cfg из сохранённой копии. Если копия называется client.cfg.rustflow-backup, это можно сделать файлом rustflow-restore-client-cfg.bat. Скрипт не загружает файлы из интернета.",
  );

  let n = 0;
  for (const phase of PHASES) {
    for (const t of chosen.filter((item) => item.phase === phase.id)) {
      const num = String(++n).padStart(2, "0");
      const backup = registryBackup(t);
      if (t.file.kind === "reg" && !backup) return null; // Never ship a registry dialect we cannot snapshot.
      if (backup) {
        entries.push(
          { name: `${ROOT}/Do-REG/${backup.save.name}`, data: encodeFile(backup.save) },
          { name: `${ROOT}/Otkat/${backup.restore.name}`, data: encodeFile(backup.restore) },
        );
      }
      const path = `${phase.folder}/${num}-${t.file.name}`;
      entries.push({ name: `${ROOT}/${path}`, data: encodeFile(t.file) });
      text(
        `${phase.folder}/${num}-${t.slug}-steps.txt`,
        [
          t.title,
          t.what,
          `Файл: ${num}-${t.file.name}`,
          ...(backup ? [`Перед REG: Do-REG/${backup.save.name}. При ошибке остановитесь.`] : []),
          `${TWEAK_RISK_META[t.riskLevel ?? "caution"].label} · ${RESTART_LABEL[t.restart]}${t.admin ? " · Нужны права администратора" : ""}`,
          "",
          ...(t.warnings ?? []).map((w) => `Важно: ${w}`),
          ...t.steps.map((s, i) => `${i + 1}. ${s}`),
          "",
          `Проверка: ${t.check}`,
        ].join("\n"),
      );
      if (t.revert && !reverts.has(t.revert.name)) {
        reverts.add(t.revert.name);
        entries.push({ name: `${ROOT}/Otkat/${t.revert.name}`, data: encodeFile(t.revert) });
      }
      text(
        `Otkat/${num}-${t.slug}.txt`,
        [
          t.title,
          ...(t.revert ? [`Файл отката: ${t.revert.name}`] : []),
          ...(backup
            ? [`Точный возврат из снимка: ${backup.restore.name}. Следующие варианты — только если снимка нет:`]
            : []),
          ...t.revertSteps,
        ].join("\n"),
      );
    }
  }
  return entries;
}
