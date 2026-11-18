"use client";

import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  Download,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EvidenceBadge, RiskLevelBadge } from "@/components/Badges";
import CategoryIcon from "@/components/CategoryIcon";
import { Badge, Switch } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { fpsToFrametime } from "@/lib/models/log";
import { calcUserTweakDelta, TWEAK_GROUP_BY_ID, type UserTweakRecord } from "@/lib/models/tweak";
import { storage } from "@/lib/storage/adapter";
import type { TweakLite } from "@/lib/tweaks/types";

/**
 * Карточка твика: что делает, категория, риск (безопасно/осторожно/вредно),
 * бейдж «замерено/миф», раскрывающиеся шаги, поля FPS до/после с дельтой %,
 * переключатель «применено» и скачивание файла.
 */
export default function TweakCard({
  tweak,
  record,
  interactive = true,
}: {
  tweak: TweakLite;
  record?: UserTweakRecord;
  interactive?: boolean;
}) {
  const { toast } = useToast();
  const [stepsOpen, setStepsOpen] = useState(false);
  const [warnHarmful, setWarnHarmful] = useState(false);
  const [beforeDraft, setBeforeDraft] = useState<string | null>(null);
  const [afterDraft, setAfterDraft] = useState<string | null>(null);
  const beforeVal = beforeDraft ?? record?.fpsBefore?.toString() ?? "";
  const afterVal = afterDraft ?? record?.fpsAfter?.toString() ?? "";

  const applied = Boolean(record?.applied);
  const isHarmful = tweak.riskLevel === "harmful";
  const isMyth = tweak.evidence === "myth";
  const groupMeta = TWEAK_GROUP_BY_ID[tweak.group];
  const delta = calcUserTweakDelta({
    fpsBefore: beforeVal ? Number(beforeVal) : null,
    fpsAfter: afterVal ? Number(afterVal) : null,
  });

  function handleToggle(next: boolean) {
    if (next && isHarmful) {
      setWarnHarmful(true);
      return;
    }
    storage.setTweakApplied(tweak.slug, next);
    toast({
      title: next ? "Твик отмечен как применённый" : "Отметка снята",
      description: tweak.title,
      tone: next ? (isMyth ? "warning" : "success") : "info",
    });
  }

  function commitFps(nextBefore: string, nextAfter: string) {
    const b = nextBefore.trim() === "" ? null : Number(nextBefore);
    const a = nextAfter.trim() === "" ? null : Number(nextAfter);
    if ((b !== null && (!Number.isFinite(b) || b <= 0 || b > 1500)) || (a !== null && (!Number.isFinite(a) || a <= 0 || a > 1500))) {
      return;
    }
    storage.setTweakFps(tweak.slug, b, a);
  }

  function saveToJournal() {
    const b = Number(beforeVal);
    const a = Number(afterVal);
    if (!Number.isFinite(b) || !Number.isFinite(a) || b <= 0 || a <= 0) {
      toast({
        title: "Введите FPS до и после",
        description: "Укажите положительные значения (например 92 и 108).",
        tone: "warning",
      });
      return;
    }
    commitFps(beforeVal, afterVal);
    storage.addLog({
      title: tweak.title,
      tweakSlug: tweak.slug,
      serverKind: "official",
      scene: "Контрольная сцена (из карточки твика)",
      beforeAvg: b,
      afterAvg: a,
      beforeLow1: Math.max(1, Math.round(b * 0.66)),
      afterLow1: Math.max(1, Math.round(a * 0.68)),
      beforeFrametime: fpsToFrametime(b),
      afterFrametime: fpsToFrametime(a),
      notes: `Сохранено из карточки «${tweak.title}». Уточните 1% low и сцену в Журнале.`,
    });
    toast({
      title: "Замер добавлен в Журнал",
      description: `${b} → ${a} FPS (${delta && delta.pct >= 0 ? "+" : ""}${delta?.pct ?? 0}%)`,
      tone: "success",
    });
  }

  return (
    <>
      <article
        className={`glass glass-hover group flex h-full flex-col p-5 ${
          isHarmful ? "glass-danger" : ""
        }`}
        data-open={stepsOpen ? "" : undefined}
      >
        {/* Шапка карточки: иконка + бейджи риска и верификации */}
        <div className="flex items-start justify-between gap-3">
          <CategoryIcon group={tweak.group} size="sm" />
          <div className="flex flex-wrap justify-end gap-1.5">
            <EvidenceBadge status={tweak.evidence} />
            <RiskLevelBadge level={tweak.riskLevel} />
          </div>
        </div>

        {/* Категория и ожидаемый эффект */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
          <span className="font-semibold text-ink-3">{groupMeta.title}</span>
          <span className="text-ink-4" aria-hidden="true">·</span>
          <span
            className={`font-semibold ${
              isHarmful ? "text-danger" : isMyth ? "text-violet" : "text-accent-hi"
            }`}
          >
            {tweak.gainLabel}
          </span>
        </div>

        {/* Заголовок и описание что делает */}
        <h3 className="mt-2 text-[17px] font-bold leading-snug tracking-tight text-ink">
          <Link href={`/tweaks/${tweak.slug}`} className="hover:text-accent-hi">
            {tweak.title}
          </Link>
        </h3>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{tweak.what}</p>

        {/* Раскрывающиеся шаги инструкции */}
        <div className="mt-3.5">
          <button
            type="button"
            onClick={() => setStepsOpen((v) => !v)}
            aria-expanded={stepsOpen}
            className="inline-flex items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-[12.5px] font-semibold text-ink-2 hover:bg-white/14 hover:text-white"
          >
            <span>{isHarmful ? "Как защититься / откатить" : `Шаги (${tweak.steps.length})`}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-300 ${stepsOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>

          {stepsOpen && (
            <div className="well pop-in mt-2.5 space-y-2 p-3.5">
              <ol className="space-y-1.5 text-[12.5px] leading-relaxed text-ink-2">
                {tweak.steps.map((step, idx) => (
                  <li key={idx} className="flex gap-2">
                    <span className="font-bold tabular-nums text-accent-hi">{idx + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
              <p className="border-t border-white/10 pt-2 text-[12px] text-ink-3">
                <strong className="text-ink-2">Проверка:</strong> {tweak.check}
              </p>
            </div>
          )}
        </div>

        {/* Интерактивный блок: FPS до/после + Применено */}
        {interactive && (
          <div className="well mt-auto space-y-3 p-3 pt-3" style={{ marginTop: "1rem" }}>
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                {applied && <Check className="h-4 w-4 text-ok" aria-hidden="true" />}
                {isHarmful
                  ? applied
                    ? "Отмечен (откатите!)"
                    : "Не применять"
                  : applied
                    ? "Применено"
                    : "Отметить применённым"}
              </span>
              <Switch
                checked={applied}
                onChange={handleToggle}
                label={`Применено: ${tweak.title}`}
              />
            </div>

            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <div>
                <label
                  htmlFor={`fps-b-${tweak.slug}`}
                  className="mb-1 block text-[11px] font-semibold text-ink-3"
                >
                  FPS до
                </label>
                <input
                  id={`fps-b-${tweak.slug}`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={1500}
                  placeholder="95"
                  value={beforeVal}
                  onChange={(e) => setBeforeDraft(e.target.value)}
                  onBlur={() => {
                    commitFps(beforeVal, afterVal);
                    setBeforeDraft(null);
                  }}
                  className="field field-sm tabular-nums"
                />
              </div>
              <div>
                <label
                  htmlFor={`fps-a-${tweak.slug}`}
                  className="mb-1 block text-[11px] font-semibold text-ink-3"
                >
                  FPS после
                </label>
                <input
                  id={`fps-a-${tweak.slug}`}
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={1500}
                  placeholder="112"
                  value={afterVal}
                  onChange={(e) => setAfterDraft(e.target.value)}
                  onBlur={() => {
                    commitFps(beforeVal, afterVal);
                    setAfterDraft(null);
                  }}
                  className="field field-sm tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={saveToJournal}
                className="btn btn-sm !h-[38px] !px-2.5 !text-[12px]"
                title="Сохранить этот замер в Журнал замеров"
                aria-label={`Отправить замер по «${tweak.title}» в журнал`}
              >
                <Activity className="text-accent-hi" aria-hidden="true" />
                {delta ? (
                  <span
                    className={`font-bold tabular-nums ${
                      delta.pct > 1 ? "text-ok" : delta.pct < -1 ? "text-danger" : "text-ink-2"
                    }`}
                  >
                    {delta.pct > 0 ? `+${delta.pct}%` : `${delta.pct}%`}
                  </span>
                ) : (
                  <span className="text-ink-2">Δ%</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Футер карточки: мета + скачать + подробнее */}
        <div
          className={`${interactive ? "mt-3.5" : "mt-auto pt-4"} flex flex-wrap items-center justify-between gap-2`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge>{tweak.fileKind.toUpperCase()}</Badge>
            {tweak.admin && (
              <Badge title="Нужны права администратора">
                <KeyRound aria-hidden="true" />
                Админ
              </Badge>
            )}
            {tweak.hasRevert && (
              <Badge title="Есть отдельный файл отката">
                <RotateCcw aria-hidden="true" />
                Откат
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <a
              href={`/api/download/${tweak.slug}`}
              download
              aria-label={
                isHarmful
                  ? `Скачать файл восстановления ${tweak.fileName}`
                  : `Скачать файл ${tweak.fileName}`
              }
              title={
                isHarmful
                  ? `Скачать инструкцию/скрипт восстановления (${tweak.fileName})`
                  : `Скачать ${tweak.fileName}`
              }
              className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-ink hover:bg-white/20"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </a>
            <Link
              href={`/tweaks/${tweak.slug}`}
              aria-label={`Открыть инструкцию и код: ${tweak.title}`}
              title="Инструкция и содержимое файла"
              className="arrow-nudge grid h-9 w-9 place-items-center rounded-full bg-white/12 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:bg-white/20"
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </article>

      <ConfirmDialog
        open={warnHarmful}
        onClose={() => setWarnHarmful(false)}
        onConfirm={() => {
          storage.setTweakApplied(tweak.slug, true);
          toast({
            title: "Помечено для отката",
            description: "Рекомендуем как можно скорее вернуть стандартную настройку по инструкции.",
            tone: "warning",
          });
        }}
        title="Это вредный анти-твик!"
        description={`«${tweak.title}» не даёт прироста FPS в Rust и может нарушить безопасность Windows, стабильность системы или работу EAC. Отмечайте его, только если он уже применён у вас ранее и вы хотите не забыть его откатить.`}
        confirmLabel="Пометить (был включён ранее)"
      />
    </>
  );
}

    
