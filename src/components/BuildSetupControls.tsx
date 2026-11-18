"use client";

import { useState } from "react";
import LiquidSelect from "@/components/LiquidSelect";
import Segmented from "@/components/Segmented";
import OriginDisclosure from "@/components/fx/OriginDisclosure";
import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import { Input, Meter } from "@/components/ui";
import { calcRamLatencyNs, RAM_CL_OPTIONS, RAM_FREQ_OPTIONS, type BuildEvaluation, type BuildInput } from "@/lib/models/build";
import {
  BIOS_PROFILES, CONNECTION_PROFILES, DEFAULT_CONNECTION, DEFAULT_MONITOR_HZ, REFRESH_RATES,
  defaultMemoryKit, formatMonitorHz, getMemoryType, isRamValue, monitorPotential, RAM_CL_BOUNDS, RAM_MHZ_BOUNDS, requiredMemory,
  type MemoryType,
} from "@/lib/models/build-settings";
import { avgFps } from "@/lib/models/fps-calibration";

const MEMORY_TYPES = [ { value: "DDR4", label: "DDR4" }, { value: "DDR5", label: "DDR5" } ] as const;
const MONITORS = REFRESH_RATES.map((value) => ({ value, label: formatMonitorHz(value) }));
type InputProps = { input: BuildInput; patch: (value: Partial<BuildInput>) => void };

function RamNumber({ label, fieldLabel, options, value, onChange, bounds, hint }: {
  label: string; fieldLabel: string; options: readonly { value: number; label: string }[];
  value: number; onChange: (value: number) => void; bounds: { min: number; max: number }; hint?: string;
}) {
  const [custom, setCustom] = useState(false);
  const valid = isRamValue(value, bounds);
  const manual = custom || !options.some((opt) => opt.value === value);
  return <div className="min-w-0 space-y-2">
    <LiquidSelect<number | "custom">
      label={label}
      value={manual ? "custom" : value}
      options={[...options, { value: "custom", label: "Кастомное" }]}
      hint={hint}
      onChange={(next) => { setCustom(next === "custom"); if (next !== "custom") onChange(next); }} />
    <OriginDisclosure open={manual}>
      <Input label={fieldLabel} type="number" inputMode="numeric" step={1} required {...bounds}
        value={Number.isFinite(value) ? value : ""} error={valid ? undefined : `${bounds.min}–${bounds.max}, целое число`}
        onChange={(event) => { setCustom(true); onChange(event.target.valueAsNumber); }} />
    </OriginDisclosure>
  </div>;
}

export function MemoryControls({ input, patch }: InputProps) {
  const memory = getMemoryType(input), fixed = requiredMemory(input.cpuId);
  const valid = isRamValue(input.ramMhz, RAM_MHZ_BOUNDS) && isRamValue(input.ramCl, RAM_CL_BOUNDS);
  const latency = valid ? `Задержка доступа: ~${calcRamLatencyNs(input.ramMhz, input.ramCl).toFixed(1)} нс` : "Укажите действительные частоту и CL.";
  return <>
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Поколение памяти</span>
      <Segmented<MemoryType> options={fixed ? MEMORY_TYPES.filter((item) => item.value === fixed) : MEMORY_TYPES} value={memory}
        onChange={(type) => { if (type !== memory) patch(defaultMemoryKit(type)); }}
        ariaLabel="Поколение памяти" className="w-full" />
      {fixed && <p className="mt-1.5 text-xs text-ink-3">Этот процессор использует {fixed}.</p>}
    </div>
    <div key={memory} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <RamNumber label="Частота RAM" fieldLabel="Частота RAM вручную, МТ/с" value={input.ramMhz} bounds={RAM_MHZ_BOUNDS}
        options={RAM_FREQ_OPTIONS.filter(({ value }) => memory === "DDR5" ? value >= 4800 : value <= 4000)}
        onChange={(ramMhz) => patch({ memoryType: memory, ramMhz })} />
      <RamNumber label="Первый тайминг (CAS)" fieldLabel="Первый тайминг вручную, CL" value={input.ramCl} bounds={RAM_CL_BOUNDS}
        options={RAM_CL_OPTIONS.filter(({ value }) => memory === "DDR5" ? value >= 28 : value <= 22)}
        hint={latency} onChange={(ramCl) => patch({ memoryType: memory, ramCl })} />
    </div>
  </>;
}

export function PersonalBuildSettings({ input, patch, evaluation }: InputProps & { evaluation: BuildEvaluation | null }) {
  const hz = input.monitorHz ?? DEFAULT_MONITOR_HZ;
  const potential = evaluation ? monitorPotential(avgFps(evaluation.fpsOfficial), hz) : null;
  return <div className="build-personal well space-y-4 p-3 sm:p-4">
    <div>
      <h3 className="mb-2 text-sm font-bold">Профиль разгона и BIOS</h3>
      <Segmented options={BIOS_PROFILES} value={input.biosProfile ?? "xmp"} onChange={(biosProfile) => patch({ biosProfile })}
        presentation="grid" ariaLabel="Профиль разгона и BIOS" className="build-profile-picker" />
      <p className="mt-1.5 text-xs text-ink-3">Поправка к оценке CPU/RAM, FPS и 1% low. Калькулятор не меняет настройки BIOS.</p>
    </div>
    <div>
      <h3 className="mb-2 text-sm font-bold">Герцовка монитора</h3>
      <Segmented options={MONITORS} value={hz} onChange={(monitorHz) => patch({ monitorHz })}
        presentation="grid" ariaLabel="Герцовка монитора" className="build-monitor-picker" />
      <p className="mt-2 text-xs text-ink-2" aria-live="polite">
        {potential === null ? "Потенциал монитора появится после расчёта." : <>Потенциал монитора: раскрыт на <strong className="tabular-nums text-accent-hi"><AnimatedNumber value={potential} />%</strong></>}
      </p>
      {potential !== null && <Meter percent={potential} className="mt-2" />}
      <p className="mt-1.5 text-xs text-ink-3">По среднему OFFICIAL в выбранной сцене. В конфиге: <code className="text-accent-hi">fps.limit {hz}</code>.</p>
    </div>
    <div>
      <h3 className="mb-2 text-sm font-bold">Качество соединения / Сеть</h3>
      <Segmented options={CONNECTION_PROFILES} value={input.connection ?? DEFAULT_CONNECTION}
        onChange={(connection) => patch({ connection })} presentation="grid" ariaLabel="Качество соединения / Сеть" className="build-profile-picker" />
      <p className="mt-1.5 text-xs text-ink-3">Меняет сглаживание сетевых позиций в client.cfg, а не пинг или FPS.</p>
    </div>
  </div>;
}
