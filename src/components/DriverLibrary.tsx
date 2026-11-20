"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { useState, type ReactNode } from "react";
import {
  AudioLines,
  CircuitBoard,
  Cpu,
  EthernetPort,
  MonitorCog,
  ChevronDown,
  Check,
  ArrowUpRight,
} from "lucide-react";
import {
  DRIVER_FAMILIES,
  DRIVER_SERIES,
  DDU,
  NVCLEANSTALL,
  OEM_LINKS,
  driverChoice,
  type FamilyId,
} from "@/lib/drivers";
import AdaptiveActions from "./AdaptiveActions";
import { IS_DESKTOP_APP } from "@/lib/config";
import { Modal } from "./ui/Modal";
import { usePopupState } from "./fx/usePopupMotion";
import { useLiquidLens } from "./fx/useLiquidLens";
import AccordionBody from "./ui/AccordionBody";
const icons = {
  nvidia: MonitorCog,
  radeon: CircuitBoard,
  arc: Cpu,
  "network-drivers": EthernetPort,
  chipset: AudioLines,
};
const ext = (url: string, label: string, button = false) => (
  <a
    key={url}
    className={button ? "btn btn-sm" : "link"}
    href={url}
    target="_blank"
    rel="noopener noreferrer"
  >
    {label} ↗
  </a>
);
function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li>
      <span aria-hidden="true">{n}</span>
      <div>
        <h4>{title}</h4>
        <p>{children}</p>
      </div>
    </li>
  );
}
function Instructions({ family, model }: { family: FamilyId; model: string }) {
  const r = driverChoice(family, model)!;
  const gpu = family === "nvidia" || family === "radeon" || family === "arc";
  return (
    <LiquidGlass className="glass driver-result" data-driver-model={model}>
      <small className="rubric">02 / Рекомендация для Windows 10 и 11</small>
      <h3 aria-live="polite" aria-atomic="true">
        {model}
      </h3>
      <strong className="driver-branch">{r.name}</strong>
      <p>{r.advice}</p>
      {r.notes && (
        <p className="driver-version">
          Пример совместимого выпуска: {ext(r.notes, r.version!)}. Это не требование ставить старую версию.
          WHQL — проверка совместимости с Windows, а не тест скорости в Rust.
        </p>
      )}
      {r.url && (
        <div className="driver-downloads">
          <AdaptiveActions key={model} action={{kind:"driver",family,model}}>
            {ext(r.url, `Открыть официальный подбор для ${model}`, true)}
            {gpu && ext(DDU, "Скачать DDU (удаление старого драйвера)", true)}
            {family === "nvidia" && ext(NVCLEANSTALL, "Скачать чистый драйвер + NVCleanstall без телеметрии", true)}
          </AdaptiveActions>
        </div>
      )}
      <h3 className="install-heading">{gpu ? "Как установить без лишнего" : "Как установить и проверить"}</h3>
      {gpu ? (
        <>
          <p>
            Если всё работает, DDU не нужен. При сбоях или смене видеокарты сначала сохраните новый и прежний
            драйверы. Создайте точку восстановления; для безопасного режима проверьте пароль Windows и ключ
            BitLocker, если диск зашифрован.
          </p>
          {family === "nvidia" && !IS_DESKTOP_APP && (
            <small>
              NVCleanstall скачивается у TechPowerUp и работает с пакетом NVIDIA. Это не готовая сборка
              драйвера для Rust. Загрузки запускаете только вы.
            </small>
          )}
          <ol className="driver-steps">
            <Step n="1" title="При необходимости удалите старый видеодрайвер">
              DDU — утилита очистки видеодрайвера. После загрузки файлов временно отключите сеть, через
              параметры восстановления Windows войдите в безопасный режим. Выберите в DDU тип GPU,
              производителя удаляемого драйвера и «Clean and restart». На ноутбуке не удаляйте второй адаптер.
            </Step>
            <Step
              n="2"
              title={
                family === "nvidia" ? "Установите драйвер без NVIDIA App" : "Установите пакет производителя"
              }
            >
              {family === "nvidia"
                ? "В NVCleanstall (выбор компонентов драйвера NVIDIA) укажите совместимый подписанный пакет. Оставьте Display Driver и нужные вам PhysX и HDMI-аудио (звук монитора). Не выбирайте NVIDIA App, наложение поверх игры и необязательные компоненты телеметрии. Не меняйте подпись драйвера. Если инструмент требует такую правку, используйте официальный установщик: «Графический драйвер NVIDIA» без приложения."
                : family === "radeon"
                  ? "В обычном режиме Windows запустите AMD Software. Для минимального набора выберите Driver Only, если он доступен. Для Anti-Lag понадобится панель AMD Software. Не используйте утилиты установки NVIDIA."
                  : "В обычном режиме Windows запустите подписанный установщик Intel Arc и следуйте его проверке совместимости. Для гибридного ноутбука сначала проверьте пакет производителя ноутбука."}
            </Step>
            <Step n="3" title="Проверьте Rust и возможность отката">
              Подключите сеть и сверьте версию в диспетчере устройств.{" "}
              {family === "nvidia"
                ? "Для меньшей задержки отклика попробуйте NVIDIA Reflex в меню Rust, если он доступен. Отсутствие телеметрии само по себе не гарантирует меньшую задержку. "
                : ""}
              Сравните один прогретый маршрут с прежним результатом. Если появились сбои — верните сохранённый
              совместимый пакет или используйте «Откатить драйвер» в свойствах устройства.
            </Step>
          </ol>
        </>
      ) : (
        <>
          <ol className="driver-steps">
            <Step n="1" title="Найдите точную модель">
              Диспетчер устройств → нужное устройство → Свойства → Сведения → ИД оборудования. Запишите
              идентификатор, версию и название платы или ноутбука.
            </Step>
            <Step n="2" title="Сохраните прежний пакет и установите новый">
              {family === "network-drivers"
                ? "Скачайте файл до отключения адаптера: во время установки сеть может пропасть. Используйте пакет платы или производителя контроллера."
                : "Для чипсета и встроенного звука берите пакет точной модели платы или ноутбука. Для внешнего USB-аудио — со страницы устройства. Не прошивайте BIOS ради этого шага."}
            </Step>
            <Step n="3" title="Проверьте результат">
              {family === "network-drivers"
                ? "После перезапуска проверьте соединение по тому же кабелю и потери до роутера. Драйвер не меняет расстояние до игрового сервера."
                : "DPC Latency — задержка обработки событий драйвером: она может проявляться щелчками звука. Повторите тот же звуковой тест. Один пик не указывает на конкретный неисправный драйвер."}{" "}
              При ухудшении верните прежний пакет.
            </Step>
          </ol>
        </>
      )}
      <details className="driver-oem">
        <summary>Ноутбук или готовый ПК: где найти OEM-пакет?</summary>
        <p>
          OEM — производитель вашего устройства. Его пакет может учитывать переключение видеокарт, звук и
          выход из сна. Найдите поддержку точной модели, а не только марки чипа.
        </p>
        <div className="driver-downloads">{OEM_LINKS.map(([label, url]) => ext(url, label))}</div>
      </details>
    </LiquidGlass>
  );
}
function DevicePicker({ family }: { family: FamilyId }) {
  const series = DRIVER_SERIES[family];
  const folded = family === "nvidia" || family === "radeon";
  const [open, setOpen] = useState<string | null>(folded ? null : series[0].title);
  const [model, setModel] = useState<string | null>(folded || IS_DESKTOP_APP ? null : series[0].models[0]);
  const expanded = series.find(s => s.title === open);
  const current = model && expanded?.models.includes(model) ? model : open;
  const rows = series.flatMap(s => [s.title, ...s.models]);
  const {list, lens} = useLiquidLens<HTMLElement>(current ? rows.indexOf(current) : -1, rows.length, { continuous: true });
  return (
    <div className="driver-workbench">
      <LiquidGlass as="nav" ref={list} className="glass device-dock" aria-label="Линейка и модель устройства">
        <LiquidGlass as="span" shape="pill" ref={lens} className="liquid-lens" aria-hidden="true" />
        <small className="rubric">01 / Линейка и модель</small>
        <p className="device-help">Не видите серию? Прокрутите этот список.</p>
        {series.map((s, i) => (
          <div key={s.title} data-liquid-group="">
            <button
              type="button"
              className="series-toggle" data-liquid-item=""
              aria-expanded={open === s.title}
              aria-controls={`models-${i}`}
              onClick={() => setOpen(open === s.title ? null : s.title)}
            >
              {s.title}
              <ChevronDown size={16} />
            </button>
            <AccordionBody id={`models-${i}`} open={open === s.title}>
              <div className="model-list">
                {s.models.map((name) => (
                  <button
                    key={name}
                    className="model-choice" data-liquid-item=""
                    type="button"
                    aria-pressed={model === name}
                    onClick={() => setModel(name)}
                  >
                    {name}
                    {model === name && <Check size={14} aria-hidden="true" />}
                  </button>
                ))}
              </div>
            </AccordionBody>
          </div>
        ))}
      </LiquidGlass>
      {model ? <Instructions family={family} model={model} /> : (
        <LiquidGlass className="glass driver-result">
          <small className="rubric">02 / Подбор драйвера</small>
          <h3>Выберите свою модель</h3>
          <p>Раскройте серию и нажмите на устройство. От модели зависит ветка драйвера: пакет для новой карты может не поддерживать старую.</p>
        </LiquidGlass>
      )}
    </div>
  );
}
export default function DriverLibrary() {
  const sheet = usePopupState<FamilyId>();
  const [last, setLast] = useState<FamilyId | null>(null);
  const { list, lens } = useLiquidLens(
    DRIVER_FAMILIES.findIndex((f) => f.id === last),
    DRIVER_FAMILIES.length,
    { continuous: true },
  );
  return (
    <section id="driver-selector" className="driver-library" aria-labelledby="driver-pick-heading">
      <header>
        <small className="rubric">Подбор по устройству</small>
        <h2 id="driver-pick-heading">Какое устройство настроить?</h2>
        <p>
          Откройте в Windows «Диспетчер устройств». Для видеокарты смотрите «Видеоадаптеры», для проводного
          интернета — «Сетевые адаптеры».
        </p>
      </header>
      <LiquidGlass ref={list} className="glass family-switch" role="group" aria-label="Семейства устройств">
        <LiquidGlass as="span" shape="pill" ref={lens} className="liquid-lens" aria-hidden="true" />
        {DRIVER_FAMILIES.map((f) => {
          const Icon = icons[f.id];
          return (
            <button
              key={f.id}
              id={f.id}
              className="family-choice"
              data-liquid-item=""
              type="button"
              aria-label={f.title}
              aria-haspopup="dialog"
              onClick={(e) => {
                setLast(f.id);
                sheet.show(f.id, e.currentTarget);
              }}
            >
              <span>
                <Icon size={21} aria-hidden="true" />
                <ArrowUpRight size={14} aria-hidden="true" />
              </span>
              <strong>{f.title}</strong>
              <small>{f.note}</small>
            </button>
          );
        })}
      </LiquidGlass>
      <p className="catalog-hint">
        Подбираем совместимую ветку, а не обещаем «самый быстрый» драйвер. Результат зависит от модели, версии
        Windows и самой игры.
      </p>
      <Modal
        open={sheet.isOpen}
        closing={sheet.closing}
        source={sheet.source}
        returnFocus={sheet.opener}
        onClose={sheet.dismiss}
        onExited={sheet.finish}
        title={DRIVER_FAMILIES.find((f) => f.id === sheet.value)?.title ?? "Драйвер"}
        description="Найдите свою серию и нажмите на модель, чтобы увидеть подходящий пакет и порядок установки."
        maxWidth="max-w-4xl"
      >
        {sheet.value && <DevicePicker key={sheet.value} family={sheet.value} />}
      </Modal>
    </section>
  );
}
