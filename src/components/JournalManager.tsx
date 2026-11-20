"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { usePopupTrigger } from "./fx/usePopupMotion";

import {
  Activity,
  Check,
  ClipboardCheck,
  FileJson,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { openPlayerProfile } from "@/components/auth/ProfileGate";
import LiquidSelect from "@/components/LiquidSelect";
import Segmented from "@/components/Segmented";
import { Badge, Button, EmptyState, Input, Skeleton } from "@/components/ui";
import BoundedNumber from "./ui/BoundedNumber";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  computeLogDelta,
  fpsToFrametime,
  SERVER_KIND_LABEL,
  TEST_PROTOCOL_STEPS,
  type BenchmarkLog,
  type ServerKind,
} from "@/lib/models/log";
import { useRustFlowStore } from "@/lib/storage/useStore";

type VerdictFilter = "all" | "positive" | "neutral" | "negative";

interface FormState {
  title: string;
  tweakSlug: string;
  serverKind: ServerKind;
  scene: string;
  beforeAvg: string;
  afterAvg: string;
  beforeLow1: string;
  afterLow1: string;
  beforeFrametime: string;
  afterFrametime: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  title: "",
  tweakSlug: "",
  serverKind: "official",
  scene: "",
  beforeAvg: "",
  afterAvg: "",
  beforeLow1: "",
  afterLow1: "",
  beforeFrametime: "",
  afterFrametime: "",
  notes: "",
};

function fmtPct(v: number, invertGood = false): { text: string; color: string } {
  const sign = v > 0 ? "+" : "";
  const good = invertGood ? v <= -2 : v >= 2;
  const bad = invertGood ? v >= 2 : v <= -2;
  return {
    text: `${sign}${v.toFixed(1)}%`,
    color: good ? "text-ok" : bad ? "text-danger" : "text-ink-2",
  };
}

export default function JournalManager({
  tweakOptions,
}: {
  tweakOptions: { slug: string; title: string }[];
}) {
  const { state, hydrated, storage } = useRustFlowStore();
  const { toast } = useToast();

  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const opener = usePopupTrigger();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BenchmarkLog | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const logs = useMemo(() => state?.logs ?? [], [state?.logs]);
  const checkedSteps = useMemo(() => new Set(state?.protocolChecks ?? []), [state?.protocolChecks]);
  const hasSamples = logs.some((l) => l.isSample);

  const rows = useMemo(
    () =>
      logs
        .map((log) => ({ log, delta: computeLogDelta(log) }))
        .filter((r) => verdictFilter === "all" || r.delta.verdict === verdictFilter),
    [logs, verdictFilter],
  );

  // Агрегированная статистика по положительным/всем замерам
  const summary = useMemo(() => {
    if (logs.length === 0) return { count: 0, avgGain: 0, low1Gain: 0, bestTitle: "—" };
    const deltas = logs.map((l) => ({ title: l.title, d: computeLogDelta(l) }));
    const avgGain =
      Math.round((deltas.reduce((s, x) => s + x.d.avgPct, 0) / deltas.length) * 10) / 10;
    const low1Gain =
      Math.round((deltas.reduce((s, x) => s + x.d.low1Pct, 0) / deltas.length) * 10) / 10;
    const best = [...deltas].sort(
      (a, b) => b.d.avgPct + b.d.low1Pct - (a.d.avgPct + a.d.low1Pct),
    )[0];
    return {
      count: logs.length,
      avgGain,
      low1Gain,
      bestTitle: best ? `${best.title} (+${Math.max(best.d.avgPct, best.d.low1Pct)}%)` : "—",
    };
  }, [logs]);

  // Живой предпросмотр дельты прямо в модалке
  const liveDelta = useMemo(() => {
    const bAvg = Number(form.beforeAvg);
    const aAvg = Number(form.afterAvg);
    if (!bAvg || !aAvg || bAvg <= 0 || aAvg <= 0) return null;
    const bLow = Number(form.beforeLow1) || bAvg * 0.65;
    const aLow = Number(form.afterLow1) || aAvg * 0.65;
    const bFt = Number(form.beforeFrametime) || fpsToFrametime(bAvg);
    const aFt = Number(form.afterFrametime) || fpsToFrametime(aAvg);
    return computeLogDelta({
      beforeAvg: bAvg,
      afterAvg: aAvg,
      beforeLow1: bLow,
      afterLow1: aLow,
      beforeFrametime: bFt,
      afterFrametime: aFt,
    });
  }, [form]);

  function toggleProtocol(stepId: string) {
    const next = new Set(checkedSteps);
    if (next.has(stepId)) next.delete(stepId);
    else next.add(stepId);
    storage.setProtocolChecks(Array.from(next));
  }

  function openCreate(from: HTMLButtonElement) {
    opener.capture(from);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(log: BenchmarkLog, from: HTMLButtonElement) {
    opener.capture(from);
    setEditingId(log.id);
    setForm({
      title: log.title,
      tweakSlug: log.tweakSlug ?? "",
      serverKind: log.serverKind,
      scene: log.scene,
      beforeAvg: String(log.beforeAvg),
      afterAvg: String(log.afterAvg),
      beforeLow1: String(log.beforeLow1),
      afterLow1: String(log.afterLow1),
      beforeFrametime: String(log.beforeFrametime),
      afterFrametime: String(log.afterFrametime),
      notes: log.notes,
    });
    setFormError(null);
    setModalOpen(true);
  }

  function autoFillFrametime() {
    const bAvg = Number(form.beforeAvg);
    const aAvg = Number(form.afterAvg);
    if (!bAvg || !aAvg || bAvg <= 0 || aAvg <= 0) {
      toast({ title: "Сначала введите Avg FPS до и после", tone: "warning" });
      return;
    }
    setForm((prev) => ({
      ...prev,
      beforeLow1: prev.beforeLow1 || String(Math.max(1, Math.round(bAvg * 0.66))),
      afterLow1: prev.afterLow1 || String(Math.max(1, Math.round(aAvg * 0.68))),
      beforeFrametime: String(fpsToFrametime(bAvg)),
      afterFrametime: String(fpsToFrametime(aAvg)),
    }));
    toast({ title: "Frametime рассчитан по формуле 1000 / FPS", tone: "info" });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const title =
      form.title.trim() ||
      tweakOptions.find((t) => t.slug === form.tweakSlug)?.title ||
      "";
    if (!title) {
      setFormError("Укажите название изменения или выберите твик из списка.");
      return;
    }
    const bAvg = Number(form.beforeAvg);
    const aAvg = Number(form.afterAvg);
    const bLow = Number(form.beforeLow1);
    const aLow = Number(form.afterLow1);
    if (
      !Number.isFinite(bAvg) ||
      !Number.isFinite(aAvg) ||
      bAvg < 1 ||
      aAvg < 1 ||
      bAvg > 1500 ||
      aAvg > 1500
    ) {
      setFormError("Введите корректные Avg FPS до и после (от 1 до 1500).");
      return;
    }
    if (
      !Number.isFinite(bLow) ||
      !Number.isFinite(aLow) ||
      bLow < 1 ||
      aLow < 1 ||
      bLow > 1500 ||
      aLow > 1500
    ) {
      setFormError("Введите 1% low до и после (или нажмите «Авто-расчёт мс»).");
      return;
    }
    const bFt =
      form.beforeFrametime.trim() && Number(form.beforeFrametime) > 0
        ? Number(form.beforeFrametime)
        : fpsToFrametime(bAvg);
    const aFt =
      form.afterFrametime.trim() && Number(form.afterFrametime) > 0
        ? Number(form.afterFrametime)
        : fpsToFrametime(aAvg);

    const payload = {
      title,
      tweakSlug: form.tweakSlug || null,
      serverKind: form.serverKind,
      scene: form.scene.trim() || "Контрольный маршрут · 60 сек",
      beforeAvg: bAvg,
      afterAvg: aAvg,
      beforeLow1: bLow,
      afterLow1: aLow,
      beforeFrametime: bFt,
      afterFrametime: aFt,
      notes: form.notes.trim(),
    };

    if (editingId) {
      storage.updateLog(editingId, payload);
      toast({ title: "Запись журнала обновлена", description: title, tone: "success" });
    } else {
      storage.addLog(payload);
      if (form.tweakSlug) {
        storage.setTweakFps(form.tweakSlug, bAvg, aAvg);
      }
      toast({ title: "Замер добавлен в журнал", description: title, tone: "success" });
    }
    setModalOpen(false);
  }

  const selectTweaks = [
    { value: "", label: "Без привязки к твику (своя правка)" },
    ...tweakOptions.map((t) => ({ value: t.slug, label: t.title })),
  ];

  const serverOptions = [
    { value: "official", label: SERVER_KIND_LABEL.official },
    { value: "modded", label: SERVER_KIND_LABEL.modded },
    { value: "staging", label: SERVER_KIND_LABEL.staging },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Сводка + действия (единственная blur-поверхность страницы) */}
      <LiquidGlass as="section" className="glass glass-blur p-5 sm:p-7" aria-label="Сводка журнала замеров">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="primary" size="lg" onClick={e => openCreate(e.currentTarget)}>
              <Plus aria-hidden="true" />
              Добавить замер до/после
            </Button>
            <Button variant="secondary" aria-haspopup="dialog" onClick={(event) => openPlayerProfile(event.currentTarget)}>
              <FileJson className="text-accent-hi" aria-hidden="true" />
              JSON в профиле игрока
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hydrated && hasSamples && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  storage.clearSampleLogs();
                  toast({ title: "Примеры скрыты", description: "Остались только ваши личные замеры.", tone: "info" });
                }}
              >
                Убрать примеры
              </Button>
            )}
            {hydrated && logs.length > 0 && (
              <Button variant="ghost" size="sm" onClick={e => {opener.capture(e.currentTarget); setConfirmClearAll(true);}}>
                <RotateCcw aria-hidden="true" />
                Очистить журнал
              </Button>
            )}
          </div>
        </div>

        {!hydrated ? (
          <Skeleton className="mt-5 h-24 w-full" />
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <LiquidGlass className="tile p-4">
              <span className="text-[12px] text-ink-3">Записей в журнале</span>
              <p className="mt-1 text-2xl font-extrabold tabular-nums">{summary.count}</p>
            </LiquidGlass>
            <LiquidGlass className="tile p-4">
              <span className="text-[12px] text-ink-3">Средняя Δ Avg FPS</span>
              <p
                className={`mt-1 text-2xl font-extrabold tabular-nums ${
                  summary.avgGain > 0 ? "text-ok" : summary.avgGain < 0 ? "text-danger" : "text-ink"
                }`}
              >
                {summary.avgGain > 0 ? `+${summary.avgGain}%` : `${summary.avgGain}%`}
              </p>
            </LiquidGlass>
            <LiquidGlass className="tile p-4">
              <span className="text-[12px] text-ink-3">Средняя Δ 1% low</span>
              <p
                className={`mt-1 text-2xl font-extrabold tabular-nums ${
                  summary.low1Gain > 0 ? "text-ok" : summary.low1Gain < 0 ? "text-danger" : "text-ink"
                }`}
              >
                {summary.low1Gain > 0 ? `+${summary.low1Gain}%` : `${summary.low1Gain}%`}
              </p>
            </LiquidGlass>
            <LiquidGlass className="tile p-4">
              <span className="text-[12px] text-ink-3">Лучший результат</span>
              <p className="mt-1 truncate text-sm font-bold text-ink" title={summary.bestTitle}>
                {summary.bestTitle}
              </p>
            </LiquidGlass>
          </div>
        )}
      </LiquidGlass>

      {/* Протокол честного замера */}
      <LiquidGlass as="section" className="glass p-5 sm:p-7" aria-label="Протокол тестирования">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <ClipboardCheck className="h-5 w-5 text-accent-hi" aria-hidden="true" />
              Протокол: один твик за раз, одна сцена
            </h2>
            <p className="mt-1 text-[13px] text-ink-3">
              Отметьте пункты перед серией прогонов — так вы отсеете плацебо и шум сервера.
            </p>
          </div>
          <Badge tone={checkedSteps.size === TEST_PROTOCOL_STEPS.length ? "safe" : "neutral"}>
            {checkedSteps.size} / {TEST_PROTOCOL_STEPS.length} проверено
          </Badge>
        </div>

        <ul className="mt-4 grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
          {TEST_PROTOCOL_STEPS.map((step) => {
            const done = checkedSteps.has(step.id);
            return (
              <LiquidGlass as="li" key={step.id} className="tile flex items-start gap-3 p-3.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={step.title}
                  onClick={() => toggleProtocol(step.id)}
                  className="check mt-0.5"
                >
                  <Check aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold leading-snug text-ink">{step.title}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{step.detail}</p>
                </div>
              </LiquidGlass>
            );
          })}
        </ul>
      </LiquidGlass>

      {/* Фильтр и таблица замеров до/после */}
      <section className="space-y-4" aria-label="Таблица замеров до и после">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            ariaLabel="Фильтр по результату замера"
            value={verdictFilter}
            onChange={setVerdictFilter}
            options={[
              { value: "all", label: `Все · ${logs.length}` },
              { value: "positive", label: "Прирост" },
              { value: "neutral", label: "Шум / миф (±2%)" },
              { value: "negative", label: "Регрессия" },
            ]}
          />
          {hasSamples && (
            <span className="text-[12px] text-ink-3">
              Записи с меткой «Пример» показывают эталонную серию на 5600X + RTX 5060.
            </span>
          )}
        </div>

        {!hydrated ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Activity className="h-6 w-6" aria-hidden="true" />}
            title={logs.length === 0 ? "Журнал замеров пока пуст" : "Нет записей с таким вердиктом"}
            hint={
              logs.length === 0
                ? "Добавьте первый замер до/после по протоколу выше (F1 → perf 4 или CapFrameX) либо загрузите демонстрационные примеры."
                : "Переключите фильтр обратно на «Все», чтобы увидеть остальные записи."
            }
            action={
              logs.length === 0 ? (
                <>
                  <Button variant="primary" onClick={e => openCreate(e.currentTarget)}>
                    <Plus aria-hidden="true" />
                    Добавить первый замер
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      storage.restoreSampleLogs();
                      toast({ title: "Демо-примеры восстановлены", tone: "info" });
                    }}
                  >
                    Показать примеры
                  </Button>
                </>
              ) : (
                <Button variant="primary" onClick={() => setVerdictFilter("all")}>
                  Показать все записи
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Таблица для широких экранов */}
            <LiquidGlass className="glass hidden overflow-x-auto p-4 lg:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/12 text-[12px] uppercase tracking-wider text-ink-3">
                    <th className="py-3 px-3">Твик / сцена и сервер</th>
                    <th className="py-3 px-3">Avg FPS (Δ%)</th>
                    <th className="py-3 px-3">1% low (Δ%)</th>
                    <th className="py-3 px-3">Frametime мс (Δ%)</th>
                    <th className="py-3 px-3">Вердикт</th>
                    <th className="py-3 px-2 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {rows.map(({ log, delta }) => {
                    const avgFmt = fmtPct(delta.avgPct);
                    const lowFmt = fmtPct(delta.low1Pct);
                    const ftFmt = fmtPct(delta.frametimePct, true);
                    return (
                      <tr key={log.id} className="align-top hover:bg-white/[0.03]">
                        <td className="max-w-xs py-3.5 px-3">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {log.tweakSlug ? (
                              <Link
                                href={`/tweaks/${log.tweakSlug}`}
                                className="font-bold text-ink hover:text-accent-hi"
                              >
                                {log.title}
                              </Link>
                            ) : (
                              <span className="font-bold text-ink">{log.title}</span>
                            )}
                            {log.isSample && <Badge>Пример</Badge>}
                          </div>
                          <p className="mt-1 text-[12px] text-ink-3">
                            {SERVER_KIND_LABEL[log.serverKind]} · {log.scene}
                          </p>
                          {log.notes && (
                            <p className="mt-1 text-[12px] text-ink-2">{log.notes}</p>
                          )}
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap tabular-nums">
                          <div className="font-semibold text-ink">
                            {log.beforeAvg} → {log.afterAvg}
                          </div>
                          <div className={`text-[12.5px] font-bold ${avgFmt.color}`}>
                            {avgFmt.text} ({delta.avgDiff > 0 ? `+${delta.avgDiff}` : delta.avgDiff})
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap tabular-nums">
                          <div className="font-semibold text-ink">
                            {log.beforeLow1} → {log.afterLow1}
                          </div>
                          <div className={`text-[12.5px] font-bold ${lowFmt.color}`}>
                            {lowFmt.text} ({delta.low1Diff > 0 ? `+${delta.low1Diff}` : delta.low1Diff})
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap tabular-nums">
                          <div className="font-semibold text-ink">
                            {log.beforeFrametime} → {log.afterFrametime} мс
                          </div>
                          <div className={`text-[12.5px] font-bold ${ftFmt.color}`}>
                            {ftFmt.text} ({delta.frametimeDiff > 0 ? `+${delta.frametimeDiff}` : delta.frametimeDiff} мс)
                          </div>
                        </td>
                        <td className="py-3.5 px-3 whitespace-nowrap">
                          {delta.verdict === "positive" ? (
                            <Badge tone="safe" dot>
                              Оставить
                            </Badge>
                          ) : delta.verdict === "negative" ? (
                            <Badge tone="harmful" dot>
                              Откатить
                            </Badge>
                          ) : (
                            <Badge tone="myth">Плацебо / шум</Badge>
                          )}
                        </td>
                        <td className="py-3.5 px-2 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={e => openEdit(log, e.currentTarget)}
                              aria-label={`Редактировать «${log.title}»`}
                              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-ink-2 hover:bg-white/20 hover:text-white"
                            >
                              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={e => {opener.capture(e.currentTarget); setDeleteTarget(log);}}
                              aria-label={`Удалить «${log.title}»`}
                              className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-ink-2 hover:bg-danger/25 hover:text-danger"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </LiquidGlass>

            {/* Мобильные карточки (320px+) */}
            <div className="grid gap-3 lg:hidden">
              {rows.map(({ log, delta }) => {
                const avgFmt = fmtPct(delta.avgPct);
                const lowFmt = fmtPct(delta.low1Pct);
                const ftFmt = fmtPct(delta.frametimePct, true);
                return (
                  <LiquidGlass as="article" key={log.id} className="glass p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {delta.verdict === "positive" ? (
                          <Badge tone="safe" dot>
                            Оставить
                          </Badge>
                        ) : delta.verdict === "negative" ? (
                          <Badge tone="harmful" dot>
                            Откатить
                          </Badge>
                        ) : (
                          <Badge tone="myth">Плацебо</Badge>
                        )}
                        {log.isSample && <Badge>Пример</Badge>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={e => openEdit(log, e.currentTarget)}
                          aria-label={`Редактировать «${log.title}»`}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-ink-2"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={e => {opener.capture(e.currentTarget); setDeleteTarget(log);}}
                          aria-label={`Удалить «${log.title}»`}
                          className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-ink-2"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <h3 className="mt-2.5 text-[15.5px] font-bold leading-snug">{log.title}</h3>
                    <p className="mt-1 text-[12px] text-ink-3">
                      {SERVER_KIND_LABEL[log.serverKind]} · {log.scene}
                    </p>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[12px] tabular-nums">
                      <LiquidGlass className="well p-2.5">
                        <span className="block text-[11px] text-ink-3">Avg FPS</span>
                        <strong className="block text-ink">
                          {log.beforeAvg}→{log.afterAvg}
                        </strong>
                        <span className={`font-bold ${avgFmt.color}`}>{avgFmt.text}</span>
                      </LiquidGlass>
                      <LiquidGlass className="well p-2.5">
                        <span className="block text-[11px] text-ink-3">1% low</span>
                        <strong className="block text-ink">
                          {log.beforeLow1}→{log.afterLow1}
                        </strong>
                        <span className={`font-bold ${lowFmt.color}`}>{lowFmt.text}</span>
                      </LiquidGlass>
                      <LiquidGlass className="well p-2.5">
                        <span className="block text-[11px] text-ink-3">Кадр, мс</span>
                        <strong className="block text-ink">
                          {log.beforeFrametime}→{log.afterFrametime}
                        </strong>
                        <span className={`font-bold ${ftFmt.color}`}>{ftFmt.text}</span>
                      </LiquidGlass>
                    </div>

                    {log.notes && (
                      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-2">{log.notes}</p>
                    )}
                  </LiquidGlass>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* Модалка добавления/редактирования замера */}
      <Modal {...opener.origin}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Редактировать замер" : "Новый замер до / после"}
        description="Дельта по Avg FPS, 1% low и frametime рассчитывается автоматически."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <LiquidSelect
            label="Связанный твик (необязательно)"
            options={selectTweaks}
            value={form.tweakSlug}
            onChange={(slug) => {
              const found = tweakOptions.find((t) => t.slug === slug);
              setForm((prev) => ({
                ...prev,
                tweakSlug: slug,
                title: prev.title || found?.title || "",
              }));
            }}
          />

          <Input
            label="Что изменили"
            placeholder="Например: Включил XMP 3600 CL18 / gc.buffer 4096"
            required
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <LiquidSelect
              label="Тип сервера"
              options={serverOptions}
              value={form.serverKind}
              onChange={(serverKind) => setForm((p) => ({ ...p, serverKind }))}
            />
            <Input
              label="Сервер и сцена"
              placeholder="EU Main (350 онл.), Outpost, полдень"
              value={form.scene}
              onChange={(e) => setForm((p) => ({ ...p, scene: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <BoundedNumber
              label="Avg FPS до"
              decimals={1} optional
              min={1}
              max={1500}
              placeholder="90"
              value={form.beforeAvg}
              onValue={v => setForm(p => ({...p, beforeAvg:v}))}
            />
            <BoundedNumber
              label="Avg FPS после"
              decimals={1} optional
              min={1}
              max={1500}
              placeholder="104"
              value={form.afterAvg}
              onValue={v => setForm(p => ({...p, afterAvg:v}))}
            />
            <BoundedNumber
              label="1% low до"
              decimals={1} optional
              min={1}
              max={1500}
              placeholder="58"
              value={form.beforeLow1}
              onValue={v => setForm(p => ({...p, beforeLow1:v}))}
            />
            <BoundedNumber
              label="1% low после"
              decimals={1} optional
              min={1}
              max={1500}
              placeholder="72"
              value={form.afterLow1}
              onValue={v => setForm(p => ({...p, afterLow1:v}))}
            />
            <BoundedNumber
              label="Frametime до (мс)"
              decimals={1} optional
              min={0.5}
              max={1000}
              placeholder="11.1"
              value={form.beforeFrametime}
              onValue={v => setForm(p => ({...p, beforeFrametime:v}))}
            />
            <BoundedNumber
              label="Frametime после (мс)"
              decimals={1} optional
              min={0.5}
              max={1000}
              placeholder="9.6"
              value={form.afterFrametime}
              onValue={v => setForm(p => ({...p, afterFrametime:v}))}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={autoFillFrametime}>
              <Wand2 className="text-accent-hi" aria-hidden="true" />
              Авто-расчёт мс и 1% low
            </Button>
            {liveDelta && (
              <p className="text-[13px] font-bold tabular-nums">
                Итог:{" "}
                <span className={fmtPct(liveDelta.avgPct).color}>
                  Avg {fmtPct(liveDelta.avgPct).text}
                </span>{" "}
                ·{" "}
                <span className={fmtPct(liveDelta.low1Pct).color}>
                  1% low {fmtPct(liveDelta.low1Pct).text}
                </span>{" "}
                ·{" "}
                <span className={fmtPct(liveDelta.frametimePct, true).color}>
                  мс {fmtPct(liveDelta.frametimePct, true).text}
                </span>
              </p>
            )}
          </div>

          <Input
            label="Комментарий (необязательно)"
            placeholder="Ушли статтеры у клановой базы, CPU 68 °C"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />

          {formError && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2.5 pt-1">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Отмена
            </Button>
            <Button type="submit" variant="primary">
              {editingId ? "Сохранить изменения" : "Добавить в журнал"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog {...opener.origin}
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            const removed = deleteTarget;
            storage.deleteLog(removed.id);
            toast({
              title: "Запись удалена из журнала",
              description: `«${removed.title}»`,
              tone: "info",
              durationMs: 6500,
              action: {
                label: "Вернуть",
                onClick: () => {
                  storage.restoreLogs([removed]);
                  toast({ title: "Запись восстановлена", tone: "success" });
                },
              },
            });
          }
        }}
        title="Удалить замер?"
        description={
          deleteTarget
            ? `Запись «${deleteTarget.title}» будет удалена из журнала.`
            : ""
        }
        confirmLabel="Удалить"
      />

      <ConfirmDialog {...opener.origin}
        open={confirmClearAll}
        onClose={() => setConfirmClearAll(false)}
        onConfirm={() => {
          const removedAll = [...logs];
          storage.clearAllLogs();
          toast({
            title: "Журнал замеров очищен",
            description: removedAll.length > 0 ? `Удалено записей: ${removedAll.length}` : undefined,
            tone: "info",
            durationMs: 6500,
            action:
              removedAll.length > 0
                ? {
                    label: "Вернуть всё",
                    onClick: () => {
                      storage.restoreLogs(removedAll);
                      toast({ title: "Журнал восстановлен", tone: "success" });
                    },
                  }
                : undefined,
          });
        }}
        title="Очистить весь журнал замеров?"
        description="Все записи до/после будут удалены из локального хранилища. Рекомендуем сначала экспортировать JSON."
        confirmLabel="Очистить всё"
      />
    </div>
  );
}
