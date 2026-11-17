"use client";

import {
  ArrowRight,
  BookmarkCheck,
  Calculator,
  Check,
  Cpu,
  FileJson,
  Gauge,
  Info,
  Lightbulb,
  Monitor,
  ScanLine,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import CategoryIcon from "@/components/CategoryIcon";
import Combobox from "@/components/Combobox";
import { triggerBackupModal } from "@/components/Nav";
import ScoreRing from "@/components/ScoreRing";
import Segmented from "@/components/Segmented";
import { Badge, Button, Input, Meter, Select, Skeleton, Switch } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  BOTTLENECK_LABEL,
  CPUS,
  detectGpu,
  GPUS,
  RAM_OPTIONS,
  RESOLUTION_OPTIONS,
  STORAGE_OPTIONS,
  type ResolutionId,
  type StorageId,
} from "@/lib/hardware";
import {
  calcRamLatencyNs,
  defaultClForMhz,
  evaluateBuild10,
  QUICK_SAMPLE_BUILDS,
  RAM_CL_OPTIONS,
  RAM_FREQ_OPTIONS,
  RUST_SCORE_WEIGHTS,
  type BuildInput,
} from "@/lib/models/build";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import type { TweakGroupId } from "@/lib/models/tweak";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { PRESETS } from "@/lib/tweaks/meta";

export interface TweakIndex {
  [slug: string]: {
    title: string;
    tagline: string;
    group: TweakGroupId;
    gainLabel: string;
  };
}

export default function BenchmarkTool({ tweakIndex }: { tweakIndex: TweakIndex }) {
  const { state, hydrated, storage } = useRustFlowStore();
  const { toast } = useToast();
  const resultRef = useRef<HTMLDivElement>(null);

  const initialSeed = useMemo<{ input: BuildInput; id?: string }>(() => {
    if (typeof window !== "undefined") {
      const presetSlug = new URLSearchParams(window.location.search).get("preset");
      const found = presetSlug ? HARDWARE_PRESETS.find((p) => p.slug === presetSlug) : undefined;
      if (found) {
        return {
          input: {
            name: found.title,
            cpuId: found.cpuId,
            gpuId: found.gpuId,
            ramGb: found.ramGb,
            ramMhz: found.ramMhz,
            ramCl: found.ramCl,
            storage: found.storageId,
            resolution: found.resolution,
          },
        };
      }
    }
    const active = state?.builds.find((b) => b.id === state.activeBuildId) ?? state?.builds[0];
    if (active) return { input: active.input, id: active.id };
    return {
      input: {
        name: "Моя сборка",
        cpuId: "ryzen-5-5600x",
        gpuId: "geforce-rtx-5060",
        ramGb: 32,
        ramMhz: 3600,
        ramCl: 18,
        storage: "nvme",
        resolution: "1080p",
      },
    };
  }, [state]);

  const [draft, setDraft] = useState<{ input: BuildInput; id?: string } | null>(null);
  const current = draft ?? initialSeed;
  const input = current.input;
  const editingId = current.id;
  const { name, cpuId, gpuId, ramGb, ramMhz, ramCl, storage: storageType, resolution } = input;

  const patchInput = (patch: Partial<BuildInput>) =>
    setDraft((prev) => {
      const base = prev ?? initialSeed;
      return { ...base, input: { ...base.input, ...patch } };
    });

  const setName = (v: string) => patchInput({ name: v });
  const setCpuId = (v: string) => patchInput({ cpuId: v });
  const setGpuId = (v: string) => patchInput({ gpuId: v });
  const setRamGb = (v: number) => patchInput({ ramGb: v });
  const setRamCl = (v: number) => patchInput({ ramCl: v });
  const setStorageType = (v: StorageId) => patchInput({ storage: v });
  const setResolution = (v: ResolutionId) => patchInput({ resolution: v });

  const [detectNotes, setDetectNotes] = useState<string[] | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [showWeights, setShowWeights] = useState(false);

  const evaluation = useMemo(() => evaluateBuild10(input), [input]);
  const latencyNs = calcRamLatencyNs(ramMhz, ramCl);
  const savedBuilds = state?.builds ?? [];
  const activeBuild =
    savedBuilds.find((b) => b.id === state?.activeBuildId) ?? savedBuilds[0] ?? null;

  function applySample(sample: BuildInput) {
    setDraft({ input: { ...sample }, id: undefined });
    toast({
      title: "Конфигурация подставлена",
      description: `${sample.name} — нажмите «Сохранить как мою сборку», чтобы закрепить.`,
      tone: "info",
    });
  }

  function handleFreqChange(nextMhz: number) {
    const wasDdr5 = ramMhz >= 4400;
    const isDdr5 = nextMhz >= 4400;
    patchInput({
      ramMhz: nextMhz,
      ...(wasDdr5 !== isDdr5 ? { ramCl: defaultClForMhz(nextMhz) } : {}),
    });
  }

  function handleAutoDetect() {
    const notes: string[] = [];
    try {
      const canvas = document.createElement("canvas");
      const gl = (canvas.getContext("webgl") ??
        canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
      const ext = gl?.getExtension("WEBGL_debug_renderer_info");
      const renderer = gl && ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? "") : "";
      const gpu = renderer ? detectGpu(renderer) : null;
      if (gpu) {
        setGpuId(gpu.id);
        notes.push(`GPU определён по WebGL: ${gpu.name}.`);
      } else if (renderer) {
        notes.push(`WebGL сообщил «${renderer.slice(0, 72)}» — выберите ближайшую видеокарту из списка.`);
      } else {
        notes.push("Браузер скрывает точную модель GPU — выберите видеокарту вручную.");
      }
    } catch {
      notes.push("WebGL недоступен — выберите видеокарту вручную.");
    }
    const threads = navigator.hardwareConcurrency;
    if (threads) {
      notes.push(`Потоков CPU: ${threads}. Модель CPU, частоту и тайминги RAM браузер не видит — укажите вручную.`);
    }
    setDetectNotes(notes);
    toast({ title: "Автопроверка выполнена", description: "Проверьте CPU и параметры RAM.", tone: "info" });
  }

  function handleSaveBuild(asNew = false) {
    if (!evaluation) {
      toast({
        title: "Выберите CPU и GPU из списка",
        tone: "warning",
      });
      return;
    }
    const saved = storage.saveBuild(input, asNew ? undefined : editingId);
    if (saved) {
      setDraft({ input: saved.input, id: saved.id });
      toast({
        title: "Сохранено как «Моя сборка»",
        description: `${saved.input.name} · Оценка ${saved.score10}/10 (хранится в localStorage)`,
        tone: "success",
      });
      if (window.innerWidth < 1024) {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  function loadSavedBuild(id: string) {
    const b = savedBuilds.find((x) => x.id === id);
    if (!b) return;
    storage.setActiveBuild(b.id);
    setDraft({ input: { ...b.input }, id: b.id });
    toast({ title: "Активная сборка переключена", description: b.input.name, tone: "info" });
  }

  return (
    <div className="space-y-6">
      {/* Быстрые референсы */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-semibold text-ink-3">Быстрый пример:</span>
        {QUICK_SAMPLE_BUILDS.map((sample) => (
          <button
            key={sample.label}
            type="button"
            onClick={() => applySample(sample.input)}
            className="chip !h-8 !px-3 transition-transform hover:bg-white/15 hover:text-white active:scale-95"
          >
            <Sparkles className="text-accent-hi" aria-hidden="true" />
            {sample.label}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        {/* ----------------------- Форма конфигурации ----------------------- */}
        <section
          className="glass glass-blur relative z-20 p-5 sm:p-7"
          aria-label="Параметры вашей сборки ПК"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <h2 className="text-xl font-bold tracking-tight">Конфигурация ПК</h2>
            <Button variant="secondary" size="sm" onClick={handleAutoDetect}>
              <ScanLine aria-hidden="true" />
              Определить GPU
            </Button>
          </div>

          {detectNotes && (
            <ul className="well pop-in mt-4 space-y-1.5 p-3.5 text-[12.5px] leading-relaxed text-ink-2" aria-live="polite">
              {detectNotes.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 flex-none text-sky" aria-hidden="true" />
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 space-y-4">
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

            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Частота RAM"
                options={RAM_FREQ_OPTIONS}
                value={ramMhz}
                onChange={(e) => handleFreqChange(Number(e.target.value))}
              />
              <Select
                label="Первый тайминг (CAS)"
                options={RAM_CL_OPTIONS}
                value={ramCl}
                onChange={(e) => setRamCl(Number(e.target.value))}
                hint={`Задержка доступа: ~${latencyNs} нс`}
              />
            </div>

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

            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Целевое разрешение</span>
              <Segmented
                options={RESOLUTION_OPTIONS.map((r) => ({ value: r.id, label: r.label }))}
                value={resolution}
                onChange={setResolution}
                ariaLabel="Разрешение экрана"
                className="w-full"
              />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleSaveBuild(false)}
              disabled={!evaluation}
              className="flex-1"
            >
              <BookmarkCheck aria-hidden="true" />
              {editingId ? "Обновить «Мою сборку»" : "Сохранить как мою сборку"}
            </Button>
            {editingId && (
              <Button
                variant="secondary"
                size="lg"
                onClick={() => handleSaveBuild(true)}
                title="Сохранить копию под новым ID для сравнения"
              >
                + Копия
              </Button>
            )}
          </div>
          <p className="mt-2.5 text-center text-[12px] text-ink-3">
            Без бэкенда: профиль сохраняется в localStorage и подставляется в «Сетап» и «Пресеты».
          </p>
        </section>

        {/* --------------------- Результат оценки /10 --------------------- */}
        <div ref={resultRef} className="scroll-mt-24 space-y-6" aria-live="polite">
          {!hydrated ? (
            <Skeleton className="h-[460px] w-full" />
          ) : !evaluation ? (
            <section className="glass p-8 text-center">
              <Gauge className="mx-auto h-10 w-10 text-ink-3" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-bold">Выберите CPU и GPU</h2>
              <p className="mt-2 text-sm text-ink-2">
                Как только будут выбраны комплектующие, появится взвешенная оценка /10 и расчёт FPS.
              </p>
            </section>
          ) : (
            <>
              {/* Карточка главного балла /10 + разбивка по 5 факторам */}
              <section className="glass p-5 sm:p-7" aria-label="Итоговая оценка сборки /10">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge tone="accent" title="Расчётная модель по индексам железа, не фактический бенчмарк">
                    <Calculator aria-hidden="true" />
                    Оценка, не замер
                  </Badge>
                  {activeBuild && editingId === activeBuild.id && (
                    <Badge tone="safe" dot>
                      Сохранено как «Моя сборка»
                    </Badge>
                  )}
                </div>

                <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row">
                  <ScoreRing
                    value={evaluation.score10 * 10}
                    size={164}
                    stroke={13}
                    color={evaluation.verdictColor}
                    colorTo="#ffffff"
                  >
                    <div>
                      <span className="block text-[44px] font-extrabold leading-none tracking-tighter tabular-nums">
                        {evaluation.score10.toFixed(1)}
                      </span>
                      <span className="mt-1 block text-[12.5px] font-semibold text-ink-2">из 10.0</span>
                    </div>
                  </ScoreRing>

                  <div className="min-w-0 flex-1 text-center sm:text-left">
                    <h2 className="headline text-[1.75rem]">{evaluation.verdictLabel}</h2>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-2">
                      {evaluation.verdictSummary}
                    </p>
                    <p className="mt-2.5 text-[12.5px] text-ink-3">
                      {evaluation.cpuName} · {evaluation.gpuName} ({evaluation.vramGb} ГБ) · {ramGb} ГБ @{" "}
                      {ramMhz} CL{ramCl} (~{evaluation.ramLatencyNs} нс)
                    </p>
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

                {showWeights && (
                  <div className="well pop-in mt-3 space-y-1.5 p-3.5 text-[12.5px] leading-relaxed text-ink-2">
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
                )}

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
                          {item.score.toFixed(1)}
                          <span className="text-[12px] font-normal text-ink-3">
                            {" "}
                            / 10 (+{item.weighted.toFixed(1)})
                          </span>
                        </span>
                      </div>
                      <Meter
                        percent={item.score * 10}
                        label={`${item.label}: ${item.score} из 10`}
                        fromColor={item.score >= 7.5 ? "#30d158" : item.score >= 5 ? "#ff8e4f" : "#ff6961"}
                        toColor={item.score >= 7.5 ? "#a7f8c2" : item.score >= 5 ? "#ffd4a6" : "#ffb5b0"}
                      />
                      <p className="mt-1 text-[12px] text-ink-3">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Ожидаемый диапазон FPS: Моддед vs Официал */}
              <section className="glass p-5 sm:p-7" aria-label="Ожидаемый диапазон FPS">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xl font-bold tracking-tight">Ожидаемый диапазон FPS</h2>
                  <Badge tone="accent">Оценка, не замер</Badge>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-3">
                  Соревновательные настройки в {resolution === "4k" ? "4K" : resolution}. Фактический FPS зависит
                  от онлайна, числа построек и дня вайпа — свои реальные цифры фиксируйте в{" "}
                  <Link href="/journal" className="link">
                    Журнале замеров
                  </Link>
                  .
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="tile p-4">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-sky">
                      Моддед 2x (180–250 онл.)
                    </span>
                    <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-ink">
                      {evaluation.fpsModded.min}–{evaluation.fpsModded.max}{" "}
                      <span className="text-sm font-semibold text-ink-3">FPS</span>
                    </p>
                    <Meter
                      percent={Math.min(100, (evaluation.fpsModded.max / 240) * 100)}
                      fromColor="#0a84ff"
                      toColor="#8ce0ff"
                      className="mt-3"
                    />
                    <p className="mt-2 text-[12.5px] text-ink-2">
                      Оценка 1% low: <strong className="tabular-nums">~{evaluation.fpsModded.low1} FPS</strong>
                    </p>
                  </div>

                  <div className="tile p-4">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-accent-hi">
                      Официал High Pop (350–500 онл.)
                    </span>
                    <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight text-ink">
                      {evaluation.fpsOfficial.min}–{evaluation.fpsOfficial.max}{" "}
                      <span className="text-sm font-semibold text-ink-3">FPS</span>
                    </p>
                    <Meter
                      percent={Math.min(100, (evaluation.fpsOfficial.max / 240) * 100)}
                      className="mt-3"
                    />
                    <p className="mt-2 text-[12.5px] text-ink-2">
                      Оценка 1% low: <strong className="tabular-nums">~{evaluation.fpsOfficial.low1} FPS</strong>
                    </p>
                  </div>
                </div>

                {/* Сравнение по пресетам графики */}
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {PRESETS.map((p) => {
                    const est = evaluation.fpsByPreset[p.id];
                    const rec = evaluation.recommendedPreset === p.id;
                    return (
                      <div
                        key={p.id}
                        className="well p-3"
                        style={
                          rec
                            ? { boxShadow: "inset 0 0 0 1.5px rgb(255 160 98 / 0.6)" }
                            : undefined
                        }
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[12.5px] font-semibold text-ink-2">{p.title}</span>
                          {rec && <Check className="h-3.5 w-3.5 text-accent-hi" aria-hidden="true" />}
                        </div>
                        <p className="mt-1 text-lg font-extrabold tabular-nums">
                          ≈ {est.avg} <span className="text-[12px] font-normal text-ink-3">FPS (low ~{est.low})</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Узкое место + персональный список твиков */}
              <section className="glass p-5 sm:p-7" aria-label="Узкое место и персональный список твиков">
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

                <div className="hairline my-5" />

                <h3 className="text-lg font-bold tracking-tight">Персональный план твиков</h3>
                <p className="mt-1 text-[13px] text-ink-3">
                  Подобран по слабым местам вашей сборки. Применяйте по одному и отмечайте выполнение.
                </p>

                <ol className="mt-4 space-y-2.5">
                  {evaluation.recommendations.map((rec) => {
                    const meta = tweakIndex[rec.slug];
                    if (!meta) return null;
                    const isApplied = Boolean(state?.tweaks[rec.slug]?.applied);
                    return (
                      <li key={rec.slug} className="tile flex items-center gap-3 p-3.5">
                        <CategoryIcon group={meta.group} size="sm" />
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/tweaks/${rec.slug}`}
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
                  <Link href="/setup" className="btn btn-primary flex-1">
                    Открыть полную настройку + ZIP
                    <ArrowRight aria-hidden="true" />
                  </Link>
                  <Link href="/presets" className="btn">
                    Сравнить с пресетами
                  </Link>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ---------------- Сохранённые сборки (localStorage) ---------------- */}
      <section className="glass p-5 sm:p-7" aria-label="Мои сохранённые сборки">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Мои сохранённые сборки</h2>
            <p className="mt-1 text-[13px] text-ink-3">
              Хранятся локально в вашем браузере (готовы к экспорту JSON и переходу на облачный профиль).
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={triggerBackupModal}>
            <FileJson className="text-accent-hi" aria-hidden="true" />
            Экспорт / импорт JSON
          </Button>
        </div>

        {!hydrated ? (
          <Skeleton className="mt-4 h-20 w-full" />
        ) : savedBuilds.length === 0 ? (
          <div className="well mt-4 flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-ink-2">
              У вас пока нет сохранённой сборки. Нажмите «Сохранить как мою сборку» выше, чтобы закрепить профиль.
            </p>
            <Button variant="primary" size="sm" onClick={() => handleSaveBuild(false)}>
              Сохранить текущую
            </Button>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {savedBuilds.map((b) => {
              const isActive = activeBuild?.id === b.id;
              return (
                <li
                  key={b.id}
                  className="tile flex items-center gap-3.5 p-3.5"
                  style={
                    isActive
                      ? { boxShadow: "inset 0 0 0 1.5px rgb(255 160 98 / 0.6)" }
                      : undefined
                  }
                >
                  <button
                    type="button"
                    onClick={() => loadSavedBuild(b.id)}
                    className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
                  >
                    <span className="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white/10 text-base font-extrabold tabular-nums text-accent-hi">
                      {b.score10.toFixed(1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-bold text-ink">{b.input.name}</span>
                        {isActive && <Badge tone="safe">Активна</Badge>}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">
                        {b.input.ramGb} ГБ@{b.input.ramMhz} CL{b.input.ramCl} · {b.input.resolution} · Моддед{" "}
                        {b.fpsModded[0]}–{b.fpsModded[1]} / Офиц {b.fpsOfficial[0]}–{b.fpsOfficial[1]} FPS
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTargetId(b.id)}
                    className="grid h-9 w-9 flex-none place-items-center rounded-full bg-white/8 text-ink-3 hover:bg-danger/25 hover:text-danger"
                    aria-label={`Удалить сборку «${b.input.name}»`}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleteTargetId !== null}
        onClose={() => setDeleteTargetId(null)}
        onConfirm={() => {
          if (deleteTargetId) {
            storage.deleteBuild(deleteTargetId);
            if (editingId === deleteTargetId) setDraft(null);
            toast({ title: "Сборка удалена", tone: "info" });
          }
        }}
        title="Удалить сохранённую сборку?"
        description="Запись будет удалена из локального хранилища браузера. Отмеченные твики и журнал замеров останутся."
        confirmLabel="Удалить"
      />
    </div>
  );
}
