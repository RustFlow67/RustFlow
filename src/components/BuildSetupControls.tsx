"use client";

import { useState } from "react";
import LiquidSelect from "@/components/LiquidSelect";
import Segmented from "@/components/Segmented";
import OriginDisclosure from "@/components/fx/OriginDisclosure";
import { getGpu } from "@/lib/hardware";
import {
  backgroundBudget,
  gcBudget,
  PLAY_DEFAULTS,
  PLAY_OPTIONS,
  supportedLatency,
} from "@/lib/models/play-settings";
import BoundedNumber from "./ui/BoundedNumber";
import { calcRamLatencyNs, RAM_CL_OPTIONS, RAM_FREQ_OPTIONS, type BuildInput } from "@/lib/models/build";
import {
  CONNECTION_PROFILES,
  DEFAULT_CONNECTION,
  defaultMemoryKit,
  getMemoryType,
  validMemory,
  MEMORY_LIMITS,
  requiredMemory,
  type MemoryType,
} from "@/lib/models/build-settings";

const MEMORY_TYPES = [
  { value: "DDR4", label: "DDR4" },
  { value: "DDR5", label: "DDR5" },
] as const;
type InputProps = { input: BuildInput; patch: (value: Partial<BuildInput>) => void };

function RamNumber({
  label,
  fieldLabel,
  options,
  value,
  onChange,
  bounds,
  hint,
  memory,
}: {
  memory: MemoryType;
  label: string;
  fieldLabel: string;
  options: readonly { value: number; label: string }[];
  value: number;
  onChange: (value: number) => void;
  bounds: { min: number; max: number };
  hint?: string;
}) {
  const [custom, setCustom] = useState(false);
  const manual = custom || !options.some((opt) => opt.value === value);
  return (
    <div className="min-w-0 space-y-2">
      <LiquidSelect<number | "custom">
        label={label}
        value={manual ? "custom" : value}
        options={[...options, { value: "custom", label: "Кастомное" }]}
        hint={hint}
        onChange={(next) => {
          setCustom(next === "custom");
          if (next !== "custom") onChange(next);
        }}
      />
      <OriginDisclosure open={manual}>
        <BoundedNumber
          label={fieldLabel}
          {...bounds}
          value={value}
          context={memory}
          unit={label === "Частота RAM" ? "МТ/с" : "CL"}
          onValue={(v) => {
            if (Number(v) !== value) onChange(Number(v));
          }}
        />
      </OriginDisclosure>
    </div>
  );
}

export function MemoryControls({ input, patch }: InputProps) {
  const memory = getMemoryType(input),
    fixed = requiredMemory(input.cpuId);
  return (
    <>
      <div>
        <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Поколение памяти</span>
        <Segmented<MemoryType>
          options={fixed ? MEMORY_TYPES.filter((item) => item.value === fixed) : MEMORY_TYPES}
          value={memory}
          onChange={(type) => {
            if (type !== memory) patch(defaultMemoryKit(type));
          }}
          ariaLabel="Поколение памяти"
          className="w-full"
        />
        {fixed && <p className="mt-1.5 text-xs text-ink-3">Этот процессор использует {fixed}.</p>}
      </div>
      <RamNumber
        key={memory}
        label="Частота RAM"
        fieldLabel="Частота RAM вручную, МТ/с"
        value={input.ramMhz}
        bounds={MEMORY_LIMITS[memory].speed}
        memory={memory}
        hint={`${memory}: ${MEMORY_LIMITS[memory].speed.min}–${MEMORY_LIMITS[memory].speed.max} МТ/с. Укажите скорость из диспетчера задач, а не цель разгона.`}
        options={RAM_FREQ_OPTIONS.filter((o) => o.label.includes(memory)).map((o) => ({
          value: o.value,
          label: `${o.value} МТ/с`,
        }))}
        onChange={(ramMhz) => patch({ memoryType: memory, ramMhz })}
      />
    </>
  );
}

export function TimingControl({ input, patch }: InputProps) {
  const memory = getMemoryType(input);
  const valid = validMemory(input);
  const latency = valid
    ? `CAS — ожидание ответа памяти. По расчёту: ~${calcRamLatencyNs(input.ramMhz, input.ramCl).toFixed(1)} нс`
    : "Укажите действительные частоту и CL.";
  return (
    <RamNumber
      key={memory}
      label="Первый тайминг (CAS)"
      fieldLabel="Первый тайминг вручную, CL"
      value={input.ramCl}
      bounds={MEMORY_LIMITS[memory].cl}
      memory={memory}
      options={RAM_CL_OPTIONS.filter(({ value }) => (memory === "DDR5" ? value >= 28 : value <= 22))}
      hint={latency}
      onChange={(ramCl) => patch({ memoryType: memory, ramCl })}
    />
  );
}

function PlayControl<T extends string>({
  n,
  title,
  options,
  value,
  onChange,
  hint,
}: {
  n: string;
  title: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  hint: string;
}) {
  return (
    <div className="play-control">
      <h4>
        <span aria-hidden="true">{n}</span>
        {title}
      </h4>
      <Segmented
        options={options}
        value={value}
        onChange={onChange}
        presentation="grid"
        ariaLabel={title}
        className="play-picker"
      />
      <p>{hint}</p>
    </div>
  );
}

export function PersonalBuildSettings({ input, patch }: InputProps) {
  const vendor = getGpu(input.gpuId)?.vendor;
  const latency = supportedLatency(input.latencyMode, vendor);
  const gc = gcBudget(input.ramGb, input);
  return (
    <>
      <section className="play-settings" aria-label="Параметры игровой сессии">
        <header>
          <p className="eyebrow">Профиль сессии</p>
          <h3 className="mt-1 text-lg font-bold">Параметры Rust</h3>
        </header>
        <PlayControl
          n="01"
          title="Игровой сценарий / Нагрузка"
          options={PLAY_OPTIONS.scenario}
          value={input.scenario ?? PLAY_DEFAULTS.scenario}
          onChange={(scenario) => patch({ scenario })}
          hint="Постройки, эффекты и число игроков меняют нагрузку на главный поток и видеокарту."
        />
        <PlayControl
          n="02"
          title="Режим задержки GPU и системы"
          options={PLAY_OPTIONS.latencyMode.filter((o) => supportedLatency(o.value, vendor) === o.value)}
          value={latency}
          onChange={(latencyMode) => patch({ latencyMode })}
          hint={
            vendor === "amd"
              ? "Anti-Lag включается в AMD Software. Boost доступен только на NVIDIA."
              : vendor === "intel"
                ? "Для этой видеокарты Reflex и Radeon Anti-Lag недоступны."
                : "Короткая очередь рендера снижает задержку, а не гарантирует рост FPS. Boost может увеличить энергопотребление."
          }
        />
        <PlayControl
          n="03"
          title="Фоновая нагрузка на систему"
          options={PLAY_OPTIONS.backgroundLoad}
          value={input.backgroundLoad ?? PLAY_DEFAULTS.backgroundLoad}
          onChange={(backgroundLoad) => patch({ backgroundLoad })}
          hint={`Модель учитывает занятые потоки CPU. Резерв RAM для фоновых задач: ${backgroundBudget(input).reserveGb} ГБ.`}
        />
        <PlayControl
          n="04"
          title="Размер буфера сборки мусора (gc.buffer)"
          options={PLAY_OPTIONS.gcBuffer}
          value={input.gcBuffer ?? PLAY_DEFAULTS.gcBuffer}
          onChange={(gcBuffer) => patch({ gcBuffer })}
          hint={`gc.buffer задаёт запас памяти между её очистками: слишком частая очистка может ощущаться как рывок. В client.cfg: gc.buffer ${gc.mb}. ${gc.mb > gc.auto ? "Выше автоматического значения: проверьте запас ОЗУ и подкачку." : "Авто учитывает объём памяти после вычета фоновой нагрузки."}`}
        />
        <PlayControl
          n="05"
          title="Оптимизация рендера и теней"
          options={PLAY_OPTIONS.renderStyle}
          value={input.renderStyle ?? PLAY_DEFAULTS.renderStyle}
          onChange={(renderStyle) => patch({ renderStyle })}
          hint="Настраивает тени и сглаживание поверх базового графического пресета."
        />
      </section>
      <div>
        <h3 className="mb-2 text-sm font-bold">Качество соединения / Сеть</h3>
        <Segmented
          options={CONNECTION_PROFILES}
          value={input.connection ?? DEFAULT_CONNECTION}
          onChange={(connection) => patch({ connection })}
          presentation="grid"
          ariaLabel="Качество соединения / Сеть"
          className="build-profile-picker"
        />
        <p className="mt-1.5 text-xs text-ink-3">
          Меняет сглаживание сетевых позиций в client.cfg, а не пинг или FPS.
        </p>
      </div>
    </>
  );
}
