"use client";

import {
  ArrowRight,
  Check,
  ChevronDown,
  FileJson,
  Gauge,
  PartyPopper,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { RiskLevelBadge } from "@/components/Badges";
import DownloadButton from "@/components/DownloadButton";
import { triggerBackupModal } from "@/components/Nav";
import ScoreRing from "@/components/ScoreRing";
import Segmented from "@/components/Segmented";
import { Button, Skeleton } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useRustFlowStore } from "@/lib/storage/useStore";
import {
  inSelection,
  PHASES,
  plural,
  PRESETS,
  PROFILES,
  RESTART_LABEL,
  type GpuVendor,
  type PresetId,
  type ProfileId,
} from "@/lib/tweaks/meta";
import type { TweakLite } from "@/lib/tweaks/types";

const VENDORS: { value: GpuVendor; label: string }[] = [
  { value: "nvidia", label: "NVIDIA" },
  { value: "amd", label: "AMD" },
  { value: "all", label: "Оба чек-листа" },
];

export default function SetupWizard({ tweaks }: { tweaks: TweakLite[] }) {
  const { state, hydrated, storage } = useRustFlowStore();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const profile: ProfileId = state?.setup.profile ?? "recommended";
  const preset: PresetId = state?.setup.preset ?? "balanced";
  const gpu: GpuVendor = state?.setup.gpu ?? "all";
  const tweakMap = useMemo(() => state?.tweaks ?? {}, [state?.tweaks]);

  const activeBuild =
    hydrated && state
      ? (state.builds.find((b) => b.id === state.activeBuildId) ?? state.builds[0] ?? null)
      : null;

  const actionableTweaks = useMemo(() => tweaks.filter((t) => !t.excludeFromPack), [tweaks]);

  const selected = useMemo(
    () => actionableTweaks.filter((t) => inSelection(t, { profile, preset, gpu })),
    [actionableTweaks, profile, preset, gpu],
  );

  const doneCount = selected.filter((t) => tweakMap[t.slug]?.applied).length;
  const anyApplied = Object.values(tweakMap).some((t) => t.applied);
  const percent = selected.length ? Math.round((doneCount / selected.length) * 100) : 0;
  const packHref = `/api/pack?profile=${profile}&preset=${preset}&gpu=${gpu}`;

  const skipped = actionableTweaks
    .filter((t) => t.risk === "advanced" || t.risk === "moderate")
    .filter((t) => !PROFILES.find((p) => p.id === profile)?.risks.includes(t.risk)).length;

  const presetTitle = PRESETS.find((p) => p.id === activeBuild?.recommendedPreset)?.title;

  function toggleStep(t: TweakLite) {
    const next = !tweakMap[t.slug]?.applied;
    storage.setTweakApplied(t.slug, next);
    toast({
      title: next ? "Шаг отмечен выполненным" : "Отметка снята",
      description: t.title,
      tone: next ? "success" : "info",
    });
  }

  const orderMap = useMemo(() => {
    const m = new Map<string, number>();
    let n = 0;
    for (const ph of PHASES) {
      for (const t of selected) {
        if (t.phase === ph.id) {
          n += 1;
          m.set(t.slug, n);
        }
      }
    }
    return m;
  }, [selected]);

  return (
    <div className="space-y-6">
      {/* Панель управления пакетом (единственная blur-поверхность страницы) */}
      <section className="glass glass-blur relative z-10 p-5 sm:p-8" aria-label="Конфигурация пакета">
        {!hydrated ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <>
            <div className="grid items-center gap-7 lg:grid-cols-[auto_minmax(0,1fr)]">
              <div className="mx-auto text-center">
                <ScoreRing value={percent} size={160} color="#30d158" colorTo="#b8ffd2">
                  <div>
                    <span className="block text-[40px] font-extrabold leading-none tracking-tighter tabular-nums">
                      {percent}%
                    </span>
                    <span className="mt-1 block text-[12.5px] font-semibold text-ink-2">
                      {doneCount} из {selected.length}
                    </span>
                  </div>
                </ScoreRing>
                <p className="mt-2.5 text-[12.5px] text-ink-3">Синхронизировано с каталогом твиков</p>
              </div>

              <div className="min-w-0 space-y-4">
                <div>
                  <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Профиль риска</span>
                  <Segmented
                    options={PROFILES.map((p) => ({ value: p.id, label: p.title }))}
                    value={profile}
                    onChange={(next) => storage.updateSetup({ profile: next })}
                    ariaLabel="Профиль риска"
                    className="w-full"
                  />
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-3">
                    {PROFILES.find((p) => p.id === profile)?.description}
                    {skipped > 0 &&
                      ` Скрыто шагов с повышенным риском: ${skipped}.`}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="min-w-0">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Пресет графики</span>
                    <Segmented
                      options={PRESETS.map((p) => ({ value: p.id, label: p.title }))}
                      value={preset}
                      onChange={(next) => storage.updateSetup({ preset: next })}
                      ariaLabel="Пресет графики"
                      className="w-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1.5 block text-[13px] font-semibold text-ink-2">Видеокарта</span>
                    <Segmented
                      options={VENDORS}
                      value={gpu}
                      onChange={(next) => storage.updateSetup({ gpu: next })}
                      ariaLabel="Производитель видеокарты"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <DownloadButton
                    href={packHref}
                    label={`Скачать ZIP · ${selected.length} ${plural(selected.length, ["твик", "твика", "твиков"])}`}
                    size="lg"
                  />
                  <Button variant="secondary" onClick={triggerBackupModal}>
                    <FileJson className="text-accent-hi" aria-hidden="true" />
                    Бэкап JSON
                  </Button>
                  {anyApplied && (
                    <Button variant="ghost" onClick={() => setConfirmReset(true)}>
                      <RotateCcw aria-hidden="true" />
                      Сбросить прогресс
                    </Button>
                  )}
                </div>
                <p className="text-[12.5px] leading-relaxed text-ink-3">
                  В архиве только проверенные шаги (без мифов и вредных твиков), пронумерованные по этапам, README и папка Otkat.
                </p>
              </div>
            </div>

            {activeBuild ? (
              <div className="well mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-2">
                  <Sparkles className="mt-0.5 h-4 w-4 flex-none text-accent-hi" aria-hidden="true" />
                  <span>
                    Моя сборка: <strong className="text-ink">{activeBuild.input.name}</strong> ({activeBuild.score10.toFixed(1)}/10).
                    Рекомендуемый пресет: «{presetTitle}».
                  </span>
                </p>
                {activeBuild.recommendedPreset !== preset && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      storage.updateSetup({
                        preset: activeBuild.recommendedPreset,
                        gpu: activeBuild.vendor,
                      });
                      toast({ title: "Подставлен пресет вашей сборки", tone: "success" });
                    }}
                  >
                    Применить
                  </Button>
                )}
              </div>
            ) : (
              <div className="well mt-5 flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-2">
                  <Gauge className="mt-0.5 h-4 w-4 flex-none text-accent-hi" aria-hidden="true" />
                  <span>Соберите профиль ПК (/10) — подходящий пресет и вендор GPU подставятся автоматически.</span>
                </p>
                <Link href="/benchmark" className="btn btn-sm">
                  Оценить сборку /10
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            )}
          </>
        )}
      </section>

      {hydrated && percent === 100 && selected.length > 0 && (
        <section className="glass glass-accent pop-in flex flex-wrap items-center gap-4 p-6" aria-live="polite">
          <span className="icon-tile" style={{ "--c1": "#7ff0ac", "--c2": "#30a46c" } as CSSProperties}>
            <PartyPopper aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight">Все шаги выполнены!</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">
              Перезагрузите компьютер, сделайте контрольный прогон и запишите результат в Журнал замеров.
            </p>
          </div>
          <Link href="/journal" className="btn btn-primary">
            В журнал замеров
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      )}

      {/* Этапы */}
      {PHASES.map((phase) => {
        const items = selected.filter((t) => t.phase === phase.id);
        if (items.length === 0) return null;
        const phaseDone = items.filter((t) => tweakMap[t.slug]?.applied).length;
        return (
          <section key={phase.id} className="glass p-5 sm:p-7" data-reveal>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-gradient-to-b from-[#ffce99] to-[#ff7a35] text-lg font-extrabold text-[#1c0900]">
                  {phase.id}
                </span>
                <div className="min-w-0">
                  <h2 className="text-xl font-bold tracking-tight">{phase.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-ink-2">{phase.description}</p>
                </div>
              </div>
              <span className={`chip ${phaseDone === items.length ? "chip-safe" : ""}`}>
                {phaseDone === items.length && <Check aria-hidden="true" />}
                {phaseDone} / {items.length}
              </span>
            </header>

            <ul className="mt-5 space-y-2.5">
              {items.map((t) => {
                const stepNum = orderMap.get(t.slug) ?? 1;
                const isDone = Boolean(tweakMap[t.slug]?.applied);
                const isOpen = expanded === t.slug;
                return (
                  <li key={t.slug} className="tile p-3 sm:p-4" data-open={isOpen ? "" : undefined}>
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={isDone}
                        aria-label={`Отметить «${t.title}» как выполненный`}
                        className="check"
                        onClick={() => toggleStep(t)}
                      >
                        <Check aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setExpanded(isOpen ? null : t.slug)}
                        aria-expanded={isOpen}
                      >
                        <span
                          className={`block text-[14.5px] font-semibold leading-snug sm:text-[15px] ${
                            isDone ? "text-ink-3 line-through decoration-white/30" : "text-ink"
                          }`}
                        >
                          <span className="mr-1.5 tabular-nums text-ink-3">
                            {String(stepNum).padStart(2, "0")}
                          </span>
                          {t.title}
                        </span>
                        <span className="mt-0.5 block truncate text-[12.5px] text-ink-3">{t.tagline}</span>
                      </button>
                      <span className="hidden md:block">
                        <RiskLevelBadge level={t.riskLevel} />
                      </span>
                      <DownloadButton
                        href={`/api/download/${t.slug}`}
                        label={`Скачать ${t.fileName}`}
                        variant="glass"
                        size="sm"
                        iconOnly
                        className="!h-9 !w-9 flex-none"
                      />
                      <button
                        type="button"
                        className="btn btn-icon !h-9 !w-9 flex-none"
                        onClick={() => setExpanded(isOpen ? null : t.slug)}
                        aria-label={isOpen ? "Свернуть шаги" : "Показать шаги"}
                        aria-expanded={isOpen}
                      >
                        <ChevronDown className="acc-chevron" aria-hidden="true" />
                      </button>
                    </div>

                    <div className="acc-body">
                      <div className="pt-4">
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          <span className="md:hidden">
                            <RiskLevelBadge level={t.riskLevel} />
                          </span>
                          <span className="chip">{t.gainLabel}</span>
                          <span className="chip">{t.fileKind.toUpperCase()}</span>
                          <span className="chip">{RESTART_LABEL[t.restart]}</span>
                          <span className="chip">{t.admin ? "Админ" : "Без админа"}</span>
                          <span className="chip">{t.time}</span>
                        </div>
                        <ol className="space-y-2">
                          {t.steps.map((step, i) => (
                            <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-2">
                              <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-white/12 text-[12px] font-bold text-white">
                                {i + 1}
                              </span>
                              <span>{step}</span>
                            </li>
                          ))}
                        </ol>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link href={`/tweaks/${t.slug}`} className="btn btn-sm">
                            Код файла и проверка
                            <ArrowRight aria-hidden="true" />
                          </Link>
                          {t.hasRevert && (
                            <DownloadButton
                              href={`/api/download/${t.slug}?v=revert`}
                              label="Файл отката"
                              variant="revert"
                              size="sm"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          storage.resetTweakProgress();
          toast({ title: "Прогресс настройки сброшен", tone: "info" });
        }}
        title="Сбросить отмеченные шаги?"
        description="Все галочки выполнения в мастере и переключатели «Применено» в библиотеке твиков будут сняты."
        confirmLabel="Да, сбросить"
      />
    </div>
  );
}
