import { encodeFile, TWEAKS } from "./tweaks";
import { getGraphicsProfile, profileCfg, textureMipForVram, type GraphicsProfileId } from "./graphics-profiles";
import { getConnectionProfile, isMonitorHz, type ConfigTuning } from "./models/build-settings";
import { cfgRestore } from "./tweaks/helpers";
import { PHASES, RESTART_LABEL, RISK_META } from "./tweaks/meta";
import { fitsVendor, packEligible, type TweakerVendor } from "./tweaker";

const ROOT = "RustFlow-Pack";

export function packEntries({ slugs, mode, gpu, ram, vram, tuning }: {
  slugs: readonly string[];
  mode: GraphicsProfileId;
  gpu: TweakerVendor;
  ram: number;
  vram?: number;
  tuning?: ConfigTuning;
}) {
  const chosen = TWEAKS.filter((t) => slugs.includes(t.slug) && packEligible(t) && fitsVendor(t.slug, gpu));
  if (chosen.length !== new Set(slugs).size) return null;
  const encoder = new TextEncoder();
  const entries: { name: string; data: Uint8Array<ArrayBuffer> }[] = [];
  const text = (name: string, content: string) => entries.push({ name: `${ROOT}/${name}`, data: encoder.encode(`\uFEFF${content.replace(/\r?\n/g, "\r\n")}`) });
  const reverts = new Set<string>();
  const profile = getGraphicsProfile(mode)!;
  const connection = getConnectionProfile(tuning?.connection);
  text("README.txt", [
    "RustFlow — выбранные настройки Rust",
    `Профиль: ${profile.title}. Видеокарта: ${gpu.toUpperCase()}. ОЗУ: ${ram} ГБ. Выбрано шагов: ${chosen.length}.`,
    ...(isMonitorHz(tuning?.monitorHz) ? [`Лимит FPS: ${tuning.monitorHz}, по выбранной частоте монитора.`] : []),
    ...(connection ? [`Сеть: ${connection.label}. Настроено сглаживание позиций, пинг и параметры сервера не меняются.`] : []),
    "",
    "1. Распакуйте архив. Перед системными изменениями создайте точку восстановления Windows и запишите текущие значения.",
    "2. Прочитайте инструкции и открытые файлы перед применением. Выполняйте только подходящие пункты, по одному.",
    "3. Перед правкой графики закройте Rust. Сохраните копию cfg\\client.cfg рядом с оригиналом как client.cfg.rustflow-backup.",
    "   Перенесите команды из client.cfg этого архива в оригинал, заменяя только одноимённые строки.",
    vram === undefined ? "   Разрешение и текстуры выставьте в меню игры; остальные настройки своего файла сохраните." : `   Текстуры: лимит mipmap ${textureMipForVram(vram)} для ${vram} ГБ VRAM. Разрешение оставьте выбранным в игре.`,
    "4. Проверьте FPS и 1% low в одной сцене. Откат к каждому шагу — в папке Otkat, системное восстановление — rstrui.",
    "",
    "Штатные настройки Windows, драйвера и игры; без вмешательства в память Rust. RustFlow не связан с Facepunch Studios.",
    "",
    ...chosen.map((t) => `• ${t.title} (${t.slug})`),
    "",
  ].join("\n"));
  entries.push({ name: `${ROOT}/client.cfg`, data: encoder.encode(profileCfg(mode, ram, "", vram === undefined ? undefined : textureMipForVram(vram), tuning).replace(/\n/g, "\r\n") + "\r\n") });
  entries.push({ name: `${ROOT}/Otkat/rustflow-restore-client-cfg.bat`, data: encodeFile({ name: "rustflow-restore-client-cfg.bat", kind: "bat", content: cfgRestore() }) });
  text("Otkat/client-cfg.txt", "При закрытом Rust восстановите свой cfg\\client.cfg из сохранённой копии. Если копия называется client.cfg.rustflow-backup, это можно сделать файлом rustflow-restore-client-cfg.bat. Скрипт не загружает файлы из интернета.");

  let n = 0;
  for (const phase of PHASES) {
    for (const t of chosen.filter((item) => item.phase === phase.id)) {
      const num = String(++n).padStart(2, "0");
      const path = `${phase.folder}/${num}-${t.file.name}`;
      entries.push({ name: `${ROOT}/${path}`, data: encodeFile(t.file) });
      text(`${phase.folder}/${num}-${t.slug}-steps.txt`, [t.title, t.what, `Файл: ${t.file.name}`,
        `${RISK_META[t.risk].label} · ${RESTART_LABEL[t.restart]}${t.admin ? " · Нужны права администратора" : ""}`,
        "", ...t.steps.map((s, i) => `${i + 1}. ${s}`), "", `Проверка: ${t.check}`].join("\n"));
      if (t.revert && !reverts.has(t.revert.name)) {
        reverts.add(t.revert.name);
        entries.push({ name: `${ROOT}/Otkat/${t.revert.name}`, data: encodeFile(t.revert) });
      }
      text(`Otkat/${num}-${t.slug}.txt`, [t.title, ...(t.revert ? [`Файл отката: ${t.revert.name}`] : []), ...t.revertSteps].join("\n"));
    }
  }
  return entries;
}
