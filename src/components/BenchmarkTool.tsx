"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { useSystemPlan } from "@/components/catalog/SystemPlan";
import { IS_DESKTOP_APP } from "@/lib/config";
import { getSystemBridge } from "@/services/systemBridge";
import AdaptiveActions from "./AdaptiveActions";
import { DockIntro } from "./DockIntro";
import BuildInsight from "./BuildInsight";
import BoundedNumber from "./ui/BoundedNumber";
import { Modal } from "./ui/Modal";
import { usePopupState } from "./fx/usePopupMotion";
import OriginDisclosure from "@/components/fx/OriginDisclosure";
import { Cpu, Monitor, ChevronDown } from "lucide-react";
import SummaryButton from "./SummaryButton";
import BuildResult from "./BuildResult";
import { useEffect, useMemo, useState } from "react";
import HardwareDrawer from "@/components/HardwareDrawer";
import LiquidSelect from "@/components/LiquidSelect";
import { MemoryControls, TimingControl, PersonalBuildSettings } from "@/components/BuildSetupControls";
import Segmented from "@/components/Segmented";
import { Input } from "@/components/ui";
import { publishDraft } from "@/lib/storage/calculator-draft";
import { CPUS, getCpu, GPUS, getGpu, RAM_OPTIONS } from "@/lib/hardware";
import { evaluateBuild10, type BuildInput } from "@/lib/models/build";
import {
  BUILD_RESOLUTION_OPTIONS,
  getResolutionSize,
  MAX_PRESET_HEIGHT,
  MAX_RESOLUTION_DIMENSION,
  MIN_RESOLUTION_DIMENSION,
  MIN_RESOLUTION_HEIGHT,
  RESOLUTION_SIZES,
  type BuildResolutionId,
} from "@/lib/models/build-resolution";
import { useShiftStore } from "@/lib/storage/useStore";
import { profileCfg, textureMipForVram, type GraphicsProfileId } from "@/lib/graphics-profiles";
import DriveControls, { DriveDetails } from "./DriveControls";
import { bestUpgrade } from "@/lib/models/build-upgrade";
import {
  defaultMemoryKit,
  tuningForBuild,
  getMemoryType,
  validMemory,
  requiredMemory,
  WINDOWS,
} from "@/lib/models/build-settings";
import { PLAY_DEFAULTS, supportedLatency } from "@/lib/models/play-settings";
import { recommendedProfile, useSetup } from "@/lib/shift-setup";

const dimensionMin = (axis: "width" | "height") =>
  axis === "height" ? MIN_RESOLUTION_HEIGHT : MIN_RESOLUTION_DIMENSION;

type Props = {
  presetInput?: BuildInput;
  initialMode?: GraphicsProfileId;
  accountBuild?: boolean;
  savedId?: string;
};

export default function BenchmarkTool(props: Props) {
  return <BenchmarkForm {...props} />;
}

function BenchmarkForm({ presetInput, initialMode, savedId }: Props) {
  const { state, hydrated, storage } = useShiftStore();
  const [detected, setDetected] = useState<{ cpu: string; gpu: string; ramGb: number; ramMhz?: number; os?: string }>();
  useEffect(() => {
    if (!IS_DESKTOP_APP) return;
    let active = true;
    const host = getSystemBridge();
    void Promise.all([host.readHardware(), host.readOperatingSystem()]).then(([hardware, os]) => {
      if (active && hardware.status === "ok") setDetected({ ...hardware.value, os: os.status === "ok" ? os.value.name : undefined });
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const setup = useSetup();
  const { detectedInput } = useSystemPlan();
  const initialSeed = useMemo<{ input: BuildInput; id?: string }>(() => {
    if (presetInput) return { input: presetInput };
    const active =
      state?.builds.find((b) => b.id === (savedId ?? state.activeBuildId)) ??
      state?.builds.find((b) => b.id === state.activeBuildId) ??
      state?.builds[0];
    if (active) return { input: active.input, id: active.id };
    if (detectedInput) return { input: detectedInput };
    return {
      input: {
        name: "Моя сборка",
        cpuId: "ryzen-5-5600x",
        gpuId: "geforce-rtx-5060",
        ramGb: 32,
        ramMhz: 3600,
        ramCl: 16,
        storage: "nvme",
        resolution: "1080p",
      },
    };
  }, [state, presetInput, savedId, detectedInput]);

  const [draft, setDraft] = useState<{ input: BuildInput; id?: string } | null>(null);
  const current = draft ?? initialSeed;
  // Once an edit has a persisted id, read its latest snapshot too (e.g. another tab).
  const saved = state?.builds.find((b) => b.id === current.id);
  const input = saved?.input ?? current.input;
  const activeInput =
    state?.builds.find((b) => b.id === state.activeBuildId)?.input ??
    state?.builds[0]?.input;
  const editingId = current.id;
  const { name, cpuId, gpuId, ramGb, resolution } = input;

  const mode = input.graphicsProfile ?? initialMode ?? recommendedProfile(setup?.goal);
  useEffect(
    () => (hydrated ? publishDraft({ input, mode, id: editingId }) : undefined),
    [hydrated, input, mode, editingId],
  );
  // Only a user edit writes. A prefetch, SSR/hydration or an incomplete numeric
  // field must never replace the last good build. Reuse the same record per edit.
  function patchInput(patch: Partial<BuildInput>) {
    const next = { ...input, graphicsProfile: mode, ...patch };
    const saved = storage.saveBuild(next, editingId);
    setDraft({ input: next, id: saved?.id ?? editingId });
    if (saved && presetInput && !editingId) {
      // A preset/account link is a seed, not a command to discard edits on reload.
      window.history.replaceState(
        null,
        "",
        `/benchmark?saved=${encodeURIComponent(saved.id)}${location.hash}`,
      );
    }
  }
  const setName = (v: string) => patchInput({ name: v });
  const setCpuId = (cpuId: string) => {
    const fixed = requiredMemory(cpuId),
      memory = getMemoryType(input);
    patchInput({ cpuId, ...(fixed && fixed !== memory ? defaultMemoryKit(fixed) : { memoryType: memory }) });
  };
  const setGpuId = (gpuId: string) =>
    patchInput({ gpuId, latencyMode: supportedLatency(input.latencyMode, getGpu(gpuId)?.vendor) });
  const setRamGb = (v: number) => patchInput({ ramGb: v });
  const resolutionSize = getResolutionSize(input);
  const setResolution = (v: BuildResolutionId) =>
    patchInput({
      resolution: v,
      customResolution: v === "custom" ? (resolutionSize ?? RESOLUTION_SIZES["1080p"]) : undefined,
    });
  const setDimension = (axis: "width" | "height", value: number) =>
    patchInput({
      customResolution: { ...RESOLUTION_SIZES["1080p"], ...input.customResolution, [axis]: value },
    });

  const preview = usePopupState<true>();
  const insight = usePopupState<true>();
  const { evaluation, upgrade, ramValid, cfg } = useMemo(() => {
    const scene = input.scenario ?? PLAY_DEFAULTS.scenario;
    const evaluation = evaluateBuild10(input, mode, scene);
    return {
      evaluation,
      upgrade: evaluation ? bestUpgrade(input, mode, scene) : null,
      ramValid: validMemory(input),
      cfg: evaluation
        ? profileCfg(
            mode,
            input.ramGb,
            "",
            textureMipForVram(evaluation.vramGb),
            tuningForBuild(input),
            getGpu(input.gpuId)?.vendor,
          )
        : "",
    };
  }, [input, mode]);
  return (
    <>
      <DockIntro href="/benchmark">
        <div className="mt-4">
          <SummaryButton disabled={!evaluation} show={(from) => insight.show(true, from)} />
        </div>
      </DockIntro>
      <LiquidGlass className="glass build-workspace">
        <section id="build-config" className="build-inputs" aria-labelledby="computer-heading">
          {detected && <p role="status" className="text-sm text-ink-2">Обнаружено: {detected.cpu} · {detected.gpu} · {detected.ramGb} ГБ ОЗУ{detected.ramMhz ? `, ${detected.ramMhz} МТ/с` : ""}{detected.os ? ` · ${detected.os}` : ""}{detectedInput && input === detectedInput ? ". Разрешение 1080p и тайминг RAM заданы приблизительно; проверьте их." : detectedInput ? ". Сохранённая или выбранная сборка сохранена без изменений." : ". Не удалось однозначно заполнить все поля; проверьте комплектующие ниже."}</p>}
          <header className="work-heading">
            <small className="rubric">01 / Комплектующие</small>
            <h2 id="computer-heading">Ваш компьютер</h2>
            <p>
              Модели указаны в диспетчере задач Windows → «Производительность». Изменения сохраняются в этом
              браузере.
            </p>
          </header>
          <div className="build-fields">
            <HardwareDrawer
              label="Процессор (CPU)"
              placeholder={
                getCpu(cpuId)?.name
                  ? `${getCpu(cpuId)!.name} · из сохранённой конфигурации`
                  : "Выберите процессор"
              }
              items={CPUS}
              value={cpuId}
              onChange={setCpuId}
              icon={<Cpu size={17} aria-hidden="true" />}
            />
            <HardwareDrawer
              label="Видеокарта (GPU)"
              placeholder="Выберите видеокарту"
              items={GPUS}
              value={gpuId}
              onChange={setGpuId}
              icon={<Monitor size={17} aria-hidden="true" />}
            />
            <div>
              <h3 className="field-title">Оперативная память (RAM)</h3>
              <Segmented
                options={RAM_OPTIONS.filter((r) => r === ramGb || [8, 16, 32, 64].includes(r)).map((r) => ({
                  value: r as number,
                  label: `${r} ГБ`,
                }))}
                value={ramGb}
                onChange={setRamGb}
                ariaLabel="Объём оперативной памяти"
                className="w-full"
              />
            </div>
            <div className="input-pair">
              <MemoryControls input={input} patch={patchInput} />
            </div>
            <div className="build-disk">
              <h3 className="field-title">Диск с Rust</h3>
              <DriveControls input={input} patch={patchInput} />
            </div>
            <div className="input-pair">
              <LiquidSelect
                label="Версия Windows"
                value={input.windowsVersion ?? "unknown"}
                options={[{ value: "unknown", label: "Не указана" }, ...WINDOWS]}
                onChange={(v) => patchInput({ windowsVersion: v === "unknown" ? undefined : v })}
              />
              <LiquidSelect
                label="Целевое разрешение"
                options={BUILD_RESOLUTION_OPTIONS}
                value={resolution}
                onChange={setResolution}
              />
            </div>
            <OriginDisclosure open={resolution === "custom"}>
              <fieldset aria-label="Размеры кастомного разрешения" className="input-pair">
                {(
                  [
                    ["width", "Ширина, px"],
                    ["height", "Высота, px"],
                  ] as const
                ).map(([axis, label]) => {
                  const value = input.customResolution?.[axis];
                  return (
                    <BoundedNumber
                      key={axis}
                      label={label}
                      min={dimensionMin(axis)}
                      max={axis === "height" ? MAX_PRESET_HEIGHT : MAX_RESOLUTION_DIMENSION}
                      value={value ?? RESOLUTION_SIZES["1080p"][axis]}
                      unit="px"
                      onValue={(s) => {
                        if (Number(s) !== value) setDimension(axis, Number(s));
                      }}
                    />
                  );
                })}
              </fieldset>
            </OriginDisclosure>
            <a className="build-result-jump link" href="#build-result">
              К прогнозу FPS ↓
            </a>
            <details className="build-disclosure advanced-fields">
              <summary>
                Дополнительные параметры <ChevronDown size={16} />
              </summary>
              <div className="build-fields">
                <Input
                  label="Название профиля"
                  placeholder="Моя сборка"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <TimingControl input={input} patch={patchInput} />
                <DriveDetails input={input} patch={patchInput} />
                <PersonalBuildSettings input={input} patch={patchInput} />
                <label className="capture-mode">
                  <input
                    type="checkbox"
                    checked={mode === "realistic"}
                    onChange={(e) =>
                      patchInput({ graphicsProfile: e.target.checked ? "realistic" : "quality" })
                    }
                  />{" "}
                  Реалистичность — особый режим для съёмки
                </label>
              </div>
            </details>
          </div>
        </section>
        <section id="build-result" className="build-output" aria-labelledby="result-heading">
          <header className="work-heading">
            <small className="rubric">02 / Прогноз</small>
            <h2 id="result-heading">Результат и рекомендации</h2>
            <p>
              Прогноз меняется вместе с вашей сборкой. Сравнивайте с замером на том же сервере и маршруте.
            </p>
          </header>
          {evaluation ? (
            <BuildResult
              input={input}
              evaluation={evaluation}
              mode={mode}
              upgrade={upgrade}
              changeMode={(graphicsProfile) => patchInput({ graphicsProfile })}
              preview={(from) => preview.show(true, from)}
            />
          ) : (
            <p role="status">
              {!ramValid
                ? "Проверьте частоту памяти и тайминг CL."
                : resolutionSize
                  ? "Выберите процессор и видеокарту."
                  : "Проверьте ширину и высоту разрешения."}
            </p>
          )}
        </section>
      </LiquidGlass>
      <Modal
        open={insight.isOpen}
        closing={insight.closing}
        onClose={insight.dismiss}
        onExited={insight.finish}
        source={insight.source}
        returnFocus={insight.opener}
        title="Сводка вашей сборки"
        maxWidth="max-w-2xl"
      >
        {evaluation && (
          <BuildInsight
            input={input}
            mode={mode}
            evaluation={evaluation}
            live={input === activeInput && mode === (activeInput?.graphicsProfile ?? "competitive")}
          />
        )}
      </Modal>
      <Modal
        open={preview.isOpen}
        closing={preview.closing}
        onExited={preview.finish}
        onClose={preview.dismiss}
        source={preview.source}
        returnFocus={preview.opener}
        title="Предпросмотр client.cfg"
        description="Это команды Rust для вашей сборки и режима. Окно ничего не записывает в папку игры."
      >
        {evaluation && (
          <>
            <LiquidGlass as="pre" className="well overflow-x-auto p-3 text-xs leading-relaxed" data-build-cfg>
              {cfg}
            </LiquidGlass>
            <p className="mt-3 text-sm text-ink-2">
              Перед заменой сохраните копию своего файла. Для отката верните её при закрытой игре.
            </p>
            <AdaptiveActions action={{kind:"cfg",cfg}}>
            <a
              className="btn btn-primary mt-3"
              download="shift-graphics-fragment.cfg"
              href={`data:text/plain;charset=utf-8,${encodeURIComponent(cfg + "\n")}`}
            >
              Скачать фрагмент настроек
            </a>
            </AdaptiveActions>
          </>
        )}
      </Modal>
    </>
  );
}
