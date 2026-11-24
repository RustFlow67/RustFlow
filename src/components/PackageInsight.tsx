import LiquidGlass from "@/components/LiquidGlass";
import { IS_DESKTOP_APP } from "@/lib/config";
import { planWindows } from "@/lib/plan-windows";
import { getCpu, getGpu } from "@/lib/hardware";
import { getGraphicsProfile, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { gcBudget } from "@/lib/models/play-settings";
import { formatBuildResolution } from "@/lib/models/build-resolution";
import { driveEstimate } from "@/lib/models/drive";
import type { BuildInput } from "@/lib/models/build";
import type { ConfigTuning } from "@/lib/models/build-settings";
import type { TweakerVendor } from "@/lib/tweaker";
import { TWEAK_RISK_META } from "@/lib/models/tweak";
import { RESTART_LABEL } from "@/lib/tweaks/meta";
import type { TweakerEntry } from "./Tweaker";

/** Pure view of the resolved pack, not a second recommendation engine. A
 * checkbox, vendor, profile or OS change uses the same cfg/entries as ZIP. */
export default function PackageInsight({
  entries,
  mode,
  gpu,
  ram,
  vram,
  tuning,
  rig,
  cfg,
  children,
}: {
  entries: TweakerEntry[];
  mode: GraphicsProfileId;
  gpu: TweakerVendor;
  ram: number;
  vram?: number;
  tuning: ConfigTuning;
  rig?: BuildInput;
  cfg: string;
  children: React.ReactNode;
}) {
  const profile = getGraphicsProfile(mode)!,
    actual = rig && getGpu(rig.gpuId),
    reboot = entries.filter((t) => t.restart === "reboot");
  const os = planWindows(tuning.windowsVersion);
  const reason = (t: TweakerEntry) => {
    switch (t.slug) {
      case "pagefile-auto":
        return `При ${ram} ГБ ОЗУ проверьте предел выделенной памяти. Системная подкачка помогает избежать отказа выделения памяти, но не заменяет ОЗУ.`;
      case "game-mode-dvr":
        return "Если запись клипов была включена, её отключение освобождает кодировщик. Если запись уже выключена, дополнительной экономии не будет.";
      case "rust-library-ssd":
        return "Для библиотеки на HDD перенос на SSD сокращает ожидание мелких чтений при подгрузке. Проверьте время входа на тот же сервер.";
      case "nvidia-panel":
      case "amd-adrenalin":
        return `Профиль ${actual?.vendor === gpu ? actual.name : gpu.toUpperCase()} меняет очередь отрисовки только для Rust. Сверьте режим задержки в игре с настройкой драйвера; не применяйте профиль глобально.`;
      case "windows-10-graphics":
      case "windows-11-graphics":
        return `В Windows ${t.windowsVersion} проверьте адаптер RustClient.exe. При уже выбранной дискретной GPU менять ничего не требуется.`;
      case "restore-point":
        return "Сохраните состояние Windows до системных изменений. Точка не заменяет отдельную резервную копию игрового конфига.";
      default:
        return t.check;
    }
  };
  return (
    <div className="build-insight package-insight">
      <small className="rubric">Локальный расчёт · не замер FPS</small>
      <p className="insight-rig">
        {rig && `${getCpu(rig.cpuId)?.name} · ${driveEstimate(rig).label} · ${formatBuildResolution(rig)} · `}
        {actual?.vendor === gpu ? actual.name : gpu.toUpperCase()} · {ram} ГБ ОЗУ
        {vram !== undefined && ` · ${vram} ГБ VRAM`}
        {os && ` · ${os}`}
      </p>
      {!tuning.windowsVersion && !IS_DESKTOP_APP && (
        <p>Шаги только для Windows 10 или 11 не добавлены. Укажите версию в параметрах пакета.</p>
      )}
      {actual && actual.vendor !== gpu && (
        <p>
          Производитель GPU изменён вручную. Настройки прежней видеокарты и её объём VRAM не перенесены в
          конфиг.
        </p>
      )}
      {!rig && (
        <p>Полная сборка не задана. Ниже — расчёт по параметрам пакета, а не обнаруженное в браузере железо.</p>
      )}
      {cfg ? <section>
        <h3>Что изменит client.cfg</h3>
        <p>
          <strong>{profile.title}.</strong> {profile.hint} Для {ram} ГБ ОЗУ и выбранной фоновой нагрузки в файл
          входит <code>gc.buffer {gcBudget(ram, tuning).mb}</code>: это запас памяти между очистками. Он меняет частоту возможных пауз, а не обещает прибавку к среднему FPS. {tuning.monitorHz && `Лимит — ${tuning.monitorHz} FPS по частоте монитора.`}
        </p>
        <details>
          <summary>Точные команды client.cfg</summary>
          <LiquidGlass as="pre" className="well overflow-x-auto p-3 text-xs" data-pack-cfg>
            {cfg}
          </LiquidGlass>
        </details>
      </section> : <p>Графический client.cfg не выбран и не будет включён или применён.</p>}
      <section>
        <h3>Выбранные шаги: {entries.length}</h3>
        {entries.length ? (
          <ol>
            {entries.map((t) => (
              <li key={t.slug} data-pack-step={t.slug}>
                <strong>{t.title}.</strong> {reason(t)}{" "}
                <small>
                  {t.fileKind === "txt" ? "Вручную" : t.fileKind.toUpperCase()} ·{" "}
                  {TWEAK_RISK_META[t.riskLevel].label} · {RESTART_LABEL[t.restart]}
                  {t.admin && " · права администратора"}
                </small>
                {t.warnings?.[0] && <p>{t.warnings[0]}</p>}
              </li>
            ))}
          </ol>
        ) : (
          <p>Системные шаги не выбраны.</p>
        )}
      </section>
      <section>
        <h3>EAC, перезапуск и откат</h3>
        <p>
          В выбранном пакете нет инжекторов, подмены DLL или изменений памяти Rust. Штатные настройки не обходят
          EAC; это не гарантия от блокировки. Не запускайте посторонние «ускорители» вместе с игрой.
        </p>
        <p>
          {reboot.length
            ? `Перезагрузка ПК нужна после: ${reboot.map((t) => t.title).join("; ")}.`
            : "Среди выбранных шагов нет требующих перезагрузки ПК."}{" "}
          Перед применением создайте точку восстановления, скопируйте свой client.cfg. Для каждого шага в Otkat
          есть файл или инструкция; возврат к умолчаниям не заменяет вашу копию.
        </p>
        {entries.some((t) => t.fileKind === "reg") && (
          <p>
            Перед каждым REG сохраните снимок из Do-REG. Если снимок не создан, не применяйте файл. Точный откат
            — restore-snapshot.bat из Otkat под той же учётной записью.
          </p>
        )}
      </section>
      <div>{children}</div>
    </div>
  );
}
