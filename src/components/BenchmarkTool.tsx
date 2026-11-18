"use client";

import OriginDisclosure from "@/components/fx/OriginDisclosure";
import {
  ArrowRight,
  BookmarkCheck,
  Calculator,
  Cpu,
  Gauge,
  Lightbulb,
  Monitor,
  Target,
} from "lucide-react";
import Link from "@/components/RouteLink";
import { useEffect, useMemo, useState } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import Combobox from "@/components/Combobox";
import LiquidSelect from "@/components/LiquidSelect";
import GraphicsPicker from "@/components/GraphicsPicker";
import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import ProfileGate, { ProfileLock } from "@/components/auth/ProfileGate";
import { MemoryControls, PersonalBuildSettings } from "@/components/BuildSetupControls";
import BuildRadar from "@/components/addons/BuildRadar";
import { useAccount } from "@/components/auth/AccountProvider";
import Segmented from "@/components/Segmented";
import { Badge, Button, Input, Meter, Skeleton, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { publishAssistantBuild } from "@/lib/assistant/context";
import {
  BOTTLENECK_LABEL,
  CPUS,
  GPUS,
  getGpu,
  RAM_OPTIONS,
  STORAGE_OPTIONS,
  type StorageId,
} from "@/lib/hardware";
import {
  evaluateBuild10,
  RUST_SCORE_WEIGHTS,
  type BuildInput,
} from "@/lib/models/build";
import {
  BUILD_RESOLUTION_OPTIONS,
  formatBuildResolution,
  getResolutionSize,
  isResolutionDimension,
  MAX_RESOLUTION_DIMENSION,
  MIN_RESOLUTION_DIMENSION,
  MIN_RESOLUTION_HEIGHT,
  RESOLUTION_SIZES,
  type BuildResolutionId,
} from "@/lib/models/build-resolution";
import type { TweakGroupId } from "@/lib/models/tweak";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { getGraphicsProfile, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { SCENARIOS, frameMs, type RustScenario } from "@/lib/models/fps-calibration";
import { bestUpgrade } from "@/lib/models/build-upgrade";
import { defaultMemoryKit, DEFAULT_CONNECTION, DEFAULT_MONITOR_HZ, getMemoryType, isRamValue, requiredMemory, RAM_MHZ_BOUNDS, RAM_CL_BOUNDS } from "@/lib/models/build-settings";
import { personalPlanHref, tweakerHref } from "@/lib/tweaker";

const dimensionMin = (axis: "width" | "height") => axis === "height" ? MIN_RESOLUTION_HEIGHT : MIN_RESOLUTION_DIMENSION;
const pixelFormat = new Intl.NumberFormat("ru-RU");

export interface TweakIndex {
  [slug: string]: {
    title: string;
    tagline: string;
    group: TweakGroupId;
    gainLabel: string;
  };
}

type Props = { tweakIndex: TweakIndex; presetInput?: BuildInput; initialMode?: GraphicsProfileId; accountBuild?: boolean; savedId?: string };

export default function BenchmarkTool({ accountBuild, ...props }: Props) {
  const { session, problem } = useAccount();
  if (accountBuild && !session && !problem) return <section id="build-config" className="glass p-4 sm:p-6" aria-busy="true">
    <p role="status" className="mb-3 text-sm text-ink-2">Загружаем сборку аккаунта…</p>
    <Skeleton className="h-44 w-full" />
  </section>;
  const user = session?.user;
  if ((accountBuild || props.savedId) && !user) return <section id="build-config" className="glass liquid-glass-card p-4 sm:p-6">
    <ProfileLock action="Открыть сохранённую сборку" />
    <Link href="/benchmark" className="link mt-3 inline-block">Перейти к свободному расчёту</Link>
  </section>;
  return <BenchmarkForm key={accountBuild ? user?.id : "personal"} {...props}
    presetInput={accountBuild ? user?.build ?? props.presetInput : props.presetInput} editingAccount={Boolean(accountBuild && user)} />;
}

function BenchmarkForm({ tweakIndex, presetInput, initialMode = "competitive", editingAccount, savedId }: Props & {
  editingAccount: boolean;
}) {
  const { session, saveBuild } = useAccount();
  const user = session?.user;
  const { state, hydrated, storage } = useRustFlowStore();
  const { toast } = useToast();

  const initialSeed = useMemo<{ input: BuildInput; id?: string }>(() => {
    if (presetInput) return { input: presetInput };
    const active = user && (state?.builds.find((b) => b.id === (savedId ?? state.activeBuildId))
      ?? state?.builds.find((b) => b.id === state.activeBuildId) ?? state?.builds[0]);
    if (active) return { input: active.input, id: active.id };
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
  }, [state, presetInput, savedId, user]);

  const [draft, setDraft] = useState<{ input: BuildInput; id?: string } | null>(null);
  const current = draft ?? initialSeed;
  const input = current.input;
  useEffect(() => hydrated ? publishAssistantBuild(input) : undefined, [hydrated, input]);
  const editingId = current.id;
  const { name, cpuId, gpuId, ramGb, ramMhz, ramCl, storage: storageType, resolution } = input;

  const patchInput = (patch: Partial<BuildInput>) =>
    setDraft((prev) => {
      const base = prev ?? initialSeed;
      return { ...base, input: { ...base.input, ...patch } };
    });

  const setName = (v: string) => patchInput({ name: v });
  const setCpuId = (cpuId: string) => {
    const fixed = requiredMemory(cpuId), memory = getMemoryType(input);
    patchInput({ cpuId, ...(fixed && fixed !== memory ? defaultMemoryKit(fixed) : { memoryType: memory }) });
  };
  const setGpuId = (v: string) => patchInput({ gpuId: v });
  const setRamGb = (v: number) => patchInput({ ramGb: v });
  const setStorageType = (v: StorageId) => patchInput({ storage: v });
  const resolutionSize = getResolutionSize(input);
  const setResolution = (v: BuildResolutionId) => patchInput({
    resolution: v,
    customResolution: v === "custom" ? resolutionSize ?? RESOLUTION_SIZES["1080p"] : undefined,
  });
  const setDimension = (axis: "width" | "height", value: number) => patchInput({
    customResolution: { ...RESOLUTION_SIZES["1080p"], ...input.customResolution, [axis]: value },
  });

  const [showWeights, setShowWeights] = useState(false);
  const [saving, setSaving] = useState(false);

  const [mode, setMode] = useState<GraphicsProfileId>(initialMode);
  const [scene, setScene] = useState<RustScenario>("coast");
  const evaluation = useMemo(() => evaluateBuild10(input, mode, scene), [input, mode, scene]);
  const upgrade = useMemo(() => evaluation ? bestUpgrade(input, mode, scene) : null, [evaluation, input, mode, scene]);
  const activeBuild = state?.builds.find((b) => b.id === state.activeBuildId) ?? state?.builds[0];
  const ramValid = isRamValue(ramMhz, RAM_MHZ_BOUNDS) && isRamValue(ramCl, RAM_CL_BOUNDS);
  const tuning = { monitorHz: input.monitorHz ?? DEFAULT_MONITOR_HZ, connection: input.connection ?? DEFAULT_CONNECTION };

  async function handleSaveBuild(asNew = false) {
    if (!evaluation || !user || saving) return;
    const configured: BuildInput = { ...input, ...tuning, memoryType: getMemoryType(input), biosProfile: input.biosProfile ?? "xmp" };
    setSaving(true);
    try {
      if (!asNew) await saveBuild(configured);
      if (asNew || !editingAccount) {
        const saved = storage.saveBuild(configured, asNew ? undefined : editingId);
        if (saved && !editingAccount) setDraft((latest) => ({
          input: latest && latest.input !== input ? latest.input : saved.input,
          id: saved.id,
        }));
      }
      toast({
        title: asNew ? "Копия сохранена в браузере" : user.kind === "local" ? "Сборка сохранена в локальном профиле" : "Сборка сохранена в аккаунте",
        description: "Сборки и JSON доступны в профиле игрока.",
        tone: "success",
      });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : "Не удалось сохранить сборку", tone: "error" });
    } finally { setSaving(false); }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-stretch">
        {/* ----------------------- Форма конфигурации ----------------------- */}
        <section
          id="build-config"
          className="glass glass-blur liquid-glass-card build-config-layout relative z-20 scroll-mt-[calc(var(--header-size)+12px)] p-5 sm:p-7"
          aria-label="Параметры вашей сборки ПК"
        >
          <h2 className="text-xl font-bold tracking-tight">Конфигурация ПК</h2>

          <div className="build-fields mt-5 grid min-w-0 gap-4">
            <Input
              label="Название профиля"
              placeholder="Моя сборка"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <Combobox
              label="Процессор (CPU)"
              placeholder="Выберите процессор"
              items={CPUS}
              value={cpuId}
              onChange={setCpuId}
              icon={<Cpu className="h-[17px] w-[17px] flex-none text-accent-hi" aria-hidden="true" />}
            />

            <Combobox
              label="Видеокарта (GPU)"
              placeholder="Выберите видеокарту"
              items={GPUS}
              value={gpuId}
              onChange={setGpuId}
              icon={<Monitor className="h-[17px] w-[17px] flex-none text-accent-hi" aria-hidden="true" />}
            />

            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Объём RAM</span>
              <Segmented
                options={RAM_OPTIONS.map((r) => ({ value: r as number, label: `${r} ГБ` }))}
                value={ramGb}
                onChange={setRamGb}
                ariaLabel="Объём оперативной памяти"
                className="w-full"
              />
            </div>

            <MemoryControls input={input} patch={patchInput} />

            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">
                Накопитель, где установлен Rust
              </span>
              <Segmented
                options={STORAGE_OPTIONS.map((s) => ({ value: s.id, label: s.label }))}
                value={storageType}
                onChange={setStorageType}
                ariaLabel="Тип накопителя"
                className="w-full"
              />
            </div>

            <div className="space-y-2.5">
              <LiquidSelect
                label="Целевое разрешение"
                options={BUILD_RESOLUTION_OPTIONS}
                value={resolution}
                onChange={setResolution}
              />
              <OriginDisclosure open={resolution === "custom"}>
                <fieldset aria-label="Размеры кастомного разрешения" className="grid grid-cols-2 gap-2.5">
                  {([ ["width", "Ширина, px"], ["height", "Высота, px"] ] as const).map(([axis, label]) => {
                    const value = input.customResolution?.[axis];
                    return <Input key={axis} label={label} type="number" inputMode="numeric" required
                      min={dimensionMin(axis)} max={MAX_RESOLUTION_DIMENSION} step={1}
                      value={value !== undefined && Number.isFinite(value) ? value : ""}
                      error={isResolutionDimension(value, axis) ? undefined : `${dimensionMin(axis)}–${MAX_RESOLUTION_DIMENSION} px (целое число)`}
                      onChange={(event) => setDimension(axis, event.target.valueAsNumber)} />;
                  })}
                </fieldset>
              </OriginDisclosure>
              <p className="text-[12px] leading-relaxed text-ink-3" aria-live="polite">
                {resolutionSize
                  ? `${resolutionSize.width}×${resolutionSize.height} · ${pixelFormat.format(resolutionSize.width * resolutionSize.height)} пикселей`
                  : "Укажите ширину 800–7680 px и высоту 600–7680 px."}
              </p>
            </div>
            <PersonalBuildSettings input={input} patch={patchInput} evaluation={evaluation} />
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <ProfileGate className="w-full" action="Сохранить как мою сборку">
              <Button variant="primary" size="lg" onClick={() => void handleSaveBuild()} loading={saving}
                disabled={!evaluation} className="liquid-glass-btn build-save-button flex-1">
                <BookmarkCheck aria-hidden="true" />
                {editingAccount ? (user?.kind === "local" ? "Сохранить в профиле" : "Сохранить в аккаунте") : editingId ? "Обновить «Мою сборку»" : "Сохранить как мою сборку"}
              </Button>
              {(editingId || editingAccount) && <Button size="sm" onClick={() => void handleSaveBuild(true)} disabled={!evaluation || saving}>
                {editingAccount ? "Копия в браузер" : "+ Копия"}
              </Button>}
            </ProfileGate>
          </div>
          {user && <p className="mt-2 text-center text-xs text-ink-3">Сохранение в профиле; копии в браузере доступны для JSON.</p>}
        </section>

        {/* --------------------- Результат оценки /10 --------------------- */}
        <section className="flex min-w-0 scroll-mt-24 flex-col gap-6" aria-label="Анализ сборки ПК">
          {/* A default/preset calculation doesn't depend on browser storage. */}
          {!evaluation ? (
            <section className="glass liquid-glass-card flex flex-1 flex-col justify-center p-8 text-center">
              <Gauge className="mx-auto h-10 w-10 text-ink-3" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-bold">{!ramValid ? "Проверьте частоту ОЗУ и CL" : resolutionSize ? "Выберите CPU и GPU" : "Проверьте размеры разрешения"}</h2>
              <p className="mt-2 text-sm text-ink-2">
                {resolutionSize && ramValid
                  ? "Как только будут выбраны комплектующие, появится взвешенная оценка и расчёт FPS."
                  : "До исправления оценка недоступна. Используйте целые числа в допустимых пределах."}
              </p>
            </section>
          ) : (
            <>
              {/* Карточка главного балла /10 + разбивка по 5 факторам */}
              <section className="glass liquid-glass-card p-5 sm:p-7" aria-label="Итоговая оценка сборки">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="accent" title="Расчётная модель по индексам железа, не фактический бенчмарк">
                    <Calculator aria-hidden="true" />
                    Оценка, не замер
                  </Badge>
                  {user && activeBuild && editingId === activeBuild.id && (
                    <Badge tone="safe" dot>
                      {input === activeBuild.input ? "Сохранено как «Моя сборка»" : "Редактируется «Моя сборка»"}
                    </Badge>
                  )}
                </div>

                <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
                  <div className="w-full max-w-[240px] flex-none sm:w-[42%]">
                    <div className="flex items-baseline justify-center gap-2">
                      <strong className="font-mono text-[36px] font-extrabold leading-none tabular-nums">
                        <AnimatedNumber value={evaluation.score10} digits={1} />
                      </strong>
                      <span className="text-[12.5px] font-semibold text-ink-2">из 10.0</span>
                    </div>
                    <BuildRadar builds={[{ id: "benchmark", input, evaluation }]} compact />
                  </div>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h2 className="headline rf-page-content text-[1.75rem]">{evaluation.verdictLabel}</h2>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">
                      {evaluation.verdictSummary}
                    </p>
                    <p className="mt-2.5 text-[12.5px] text-ink-3">
                      {evaluation.cpuName} · {evaluation.gpuName} ({evaluation.vramGb} ГБ) · {ramGb} ГБ @{" "}
                      {ramMhz} CL{ramCl} (~{evaluation.ramLatencyNs} нс)
                    </p>
                    <p className="mt-2.5 text-sm font-semibold text-ink-2">Узкое место: {BOTTLENECK_LABEL[evaluation.bottleneck]}</p>
                    <a href="#build-recommendations" className="link mt-1.5 inline-block text-sm">К рекомендациям</a>
                  </div>
                </div>

                <div className="hairline my-6" />

                {/* 5-факторная взвешенная разбивка */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-[15px] font-bold">Прозрачная разбивка под Rust (сумма весов = 100%)</h3>
                  <button
                    type="button"
                    onClick={() => setShowWeights((v) => !v)}
                    aria-expanded={showWeights}
                    className="link text-[12.5px]"
                  >
                    {showWeights ? "Скрыть методику" : "Почему такие веса?"}
                  </button>
                </div>

                <OriginDisclosure open={showWeights} className="mt-3">
                  <div className="well space-y-1.5 p-3.5 text-[12.5px] leading-relaxed text-ink-2">
                    <p className="font-semibold text-ink">
                      Формула: Итог = 0.35×CPU + 0.20×RAM + 0.22×GPU + 0.13×VRAM + 0.10×SSD
                    </p>
                    {Object.entries(RUST_SCORE_WEIGHTS).map(([k, w]) => (
                      <p key={k}>
                        <strong className="text-ink-2">
                          {w.label} ({Math.round(w.weight * 100)}%):
                        </strong>{" "}
                        {w.why}
                      </p>
                    ))}
                  </div>
                </OriginDisclosure>

                <div className="mt-4 space-y-3.5">
                  {evaluation.breakdown.map((item) => (
                    <div key={item.key}>
                      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold text-ink">
                          {item.label}{" "}
                          <span className="text-[12px] font-normal text-ink-3">
                            (вес {Math.round(item.weight * 100)}%)
                          </span>
                        </span>
                        <span className="font-bold tabular-nums text-ink">
                          <AnimatedNumber value={item.score} digits={1} />
                          <span className="text-[12px] font-normal text-ink-3">
                            {" "}
                            / 10 (+<AnimatedNumber value={item.weighted} digits={1} />)
                          </span>
                        </span>
                      </div>
                      <Meter
                        percent={item.score * 10}
                        label={`${item.label}: ${item.score} из 10`}
                        fromColor="#e05a2b"
                        toColor="#ffc38b"
                      />
                      <p className="mt-1 text-[12px] text-ink-3">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Ожидаемый диапазон FPS: MODDED 2X / OFFICIAL HIGH POP */}
              <section className="glass liquid-glass-card flex-1 p-5 sm:p-7" aria-label="Ожидаемый диапазон FPS">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="rf-page-content text-xl font-bold tracking-tight">Ожидаемый диапазон FPS</h2>
                  <Badge tone="accent">Оценка, не замер</Badge>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
                  {getGraphicsProfile(mode)?.short} · {formatBuildResolution(input)}. При упоре в CPU смена разрешения может мало влиять на FPS. Сравнивайте показатели в одной сцене.
                </p>

                <div className="mt-3"><GraphicsPicker value={mode} onChange={setMode} label="Режим графики сборки" /></div>
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-bold">Симулятор сценариев Rust</h3>
                  <Segmented options={SCENARIOS} value={scene} onChange={setScene} presentation="grid"
                    className="scenario-picker" ariaLabel="Симулятор сценариев Rust" />
                  <p className="mt-2 min-h-8 text-xs text-ink-3">{SCENARIOS.find((s) => s.value === scene)?.hint}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-live="polite">
                  {[
                    { name: "MODDED 2X", online: "180–250 игроков", fps: evaluation.fpsModded },
                    { name: "OFFICIAL HIGH POP", online: "350–500 игроков", fps: evaluation.fpsOfficial },
                  ].map(({ name, online, fps }) => <div key={name} className="well p-4" data-server={name}>
                    <h3 className="text-xs font-extrabold tracking-wider text-accent-hi">{name}</h3>
                    <p className="mt-0.5 text-xs text-ink-3">{online}</p>
                    <p className="rf-page-content mt-2 font-display text-3xl font-extrabold tabular-nums tracking-tight text-accent-hi">
                      <AnimatedNumber value={fps.min} />–<AnimatedNumber value={fps.max} /> <span className="font-sans text-sm font-semibold">FPS</span>
                    </p>
                    <Meter percent={Math.min(100, (fps.max / 240) * 100)} fromColor="#e05a2b" toColor="#ffc38b" className="mt-3" />
                    <p className="mt-2 text-xs text-ink-2">1% low: <strong className="font-display tabular-nums text-accent-hi">~<AnimatedNumber value={fps.low1} /></strong> FPS · <AnimatedNumber value={frameMs(fps)} digits={1} /> мс/кадр</p>
                  </div>)}
                </div>
                <article className="tile tile-hover mt-4 p-4" aria-labelledby="upgrade-title">
                  <h3 id="upgrade-title" className="font-bold">Умный вердикт по апгрейду</h3>
                  {upgrade ? <>
                    <p className="mt-2 font-bold text-accent-hi">{upgrade.title}</p>
                    <p className="mt-1 text-sm text-ink-2">{upgrade.detail}</p>
                    <p className="mt-2 text-xs text-ink-3">OFFICIAL в этой сцене: ≈ <strong className="text-accent-hi">+<AnimatedNumber value={upgrade.avg} />% FPS</strong> · +<AnimatedNumber value={upgrade.low} />% к 1% low. Это прогноз, не замер.</p>
                  </> : <p className="mt-2 text-sm text-ink-2">Для этой сцены нет явного выигрыша среди проверенных замен. Сначала замерьте время кадра и 1% low.</p>}
                  {evaluation.vramGb <= 6 && upgrade?.textureLimit === undefined && <p className="mt-2 text-xs text-ink-3">У GPU {evaluation.vramGb} ГБ VRAM. Сначала попробуйте лёгкие текстуры и повторите замер, особенно в 1440p и на серверах с большим числом скинов.</p>}
                </article>
              </section>
            </>
          )}
        </section>

        {/* Узкое место + персональный список твиков */}
        {evaluation && (
          <section id="build-recommendations" className="glass liquid-glass-card scroll-mt-24 p-5 sm:p-7 lg:col-span-2" aria-label="Узкое место и персональный список твиков">
            <div className="grid grid-cols-1 gap-5 lg:gap-6">
              <div className="min-w-0">
                <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
                  <Target className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                  Узкое место: {BOTTLENECK_LABEL[evaluation.bottleneck]}
                </h2>
                <ul className="mt-3 space-y-2">
                  {evaluation.notes.map((note, idx) => (
                    <li key={idx} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-2">
                      <Lightbulb className="mt-0.5 h-4 w-4 flex-none text-warn" aria-hidden="true" />
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-bold tracking-tight">Персональный план твиков</h2>
                <p className="mt-1 text-[13px] text-ink-3">
                  Подобран по слабым местам вашей сборки. Применяйте по одному и отмечайте выполнение.
                </p>

                <ol className="build-rec-list mt-4 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                  {evaluation.recommendations.map((rec) => {
                    const meta = tweakIndex[rec.slug];
                    if (!meta) return null;
                    const isApplied = Boolean(state?.tweaks[rec.slug]?.applied);
                    return (
                      <li key={rec.slug} className="tile flex items-center gap-3 p-3.5">
                        <CategoryIcon group={meta.group} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={tweakerHref(rec.slug)}
                            className="block text-[14.5px] font-bold leading-snug hover:text-accent-hi"
                          >
                            {meta.title}
                          </Link>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">{rec.reason}</p>
                        </div>
                        <Switch
                          checked={isApplied}
                          onChange={(next) => {
                            storage.setTweakApplied(rec.slug, next);
                            toast({
                              title: next ? "Отмечено применённым" : "Отметка снята",
                              description: meta.title,
                              tone: next ? "success" : "info",
                            });
                          }}
                          label={`Применено: ${meta.title}`}
                        />
                      </li>
                    );
                  })}
                </ol>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <ProfileGate className="w-full sm:flex-1" action="Подобрать конфиг под этот ПК">
                    <Link href={personalPlanHref(mode, getGpu(input.gpuId)?.vendor ?? "intel", input.ramGb, evaluation.vramGb, input.storage, tuning)} className="btn btn-primary liquid-glass-btn build-plan-button flex-1">
                      Подобрать конфиг под этот ПК
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </ProfileGate>
                  <Link href="/presets" className="btn">
                    Сравнить с пресетами
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}
    </div>
  );
}
