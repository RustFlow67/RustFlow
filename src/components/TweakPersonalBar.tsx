"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { usePopupTrigger } from "./fx/usePopupMotion";

import { Activity, Check, RotateCcw } from "lucide-react";
import Link from "next/link";
import BoundedNumber from "./ui/BoundedNumber";
import { useState } from "react";
import { Button, Skeleton, Switch } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { fpsToFrametime } from "@/lib/models/log";
import { calcUserTweakDelta, type TweakRiskLevel } from "@/lib/models/tweak";
import { useRustFlowStore } from "@/lib/storage/useStore";

/** Личный блок «Применено + мой замер FPS до/после» на странице твика. */
export default function TweakPersonalBar({
  slug,
  title,
  riskLevel,
}: {
  slug: string;
  title: string;
  riskLevel: TweakRiskLevel;
}) {
  const { state, hydrated, storage } = useRustFlowStore();
  const { toast } = useToast();
  const record = state?.tweaks[slug];

  const [beforeDraft, setBeforeDraft] = useState<string | null>(null);
  const [afterDraft, setAfterDraft] = useState<string | null>(null);
  const opener = usePopupTrigger();
  const [confirmHarmful, setConfirmHarmful] = useState(false);
  const before = beforeDraft ?? record?.fpsBefore?.toString() ?? "";
  const after = afterDraft ?? record?.fpsAfter?.toString() ?? "";

  if (!hydrated) {
    return <Skeleton className="h-36 w-full" />;
  }

  const applied = Boolean(record?.applied);
  const isHarmful = riskLevel === "harmful";
  const delta = calcUserTweakDelta({
    fpsBefore: before ? Number(before) : null,
    fpsAfter: after ? Number(after) : null,
  });

  function toggle(next: boolean, from: HTMLElement) {
    if (next && isHarmful) {
      opener.capture(from);
      setConfirmHarmful(true);
      return;
    }
    storage.setTweakApplied(slug, next);
    toast({
      title: next ? "Отмечено как «Применено»" : "Отметка снята",
      description: title,
      tone: next ? "success" : "info",
    });
  }

  function saveFps(before:string,after:string) {
    const b = before.trim() ? Number(before) : null;
    const a = after.trim() ? Number(after) : null;
    storage.setTweakFps(slug, b, a);
  }

  function pushToJournal() {
    const b = Number(before);
    const a = Number(after);
    if (!Number.isFinite(b) || !Number.isFinite(a) || b <= 0 || a <= 0) {
      toast({
        title: "Заполните поля «FPS до» и «FPS после»",
        description: "Числа должны быть больше нуля.",
        tone: "warning",
      });
      return;
    }
    saveFps(before,after);
    storage.addLog({
      title,
      tweakSlug: slug,
      serverKind: "official",
      scene: "Контрольная сцена · 1 твик за раз",
      beforeAvg: b,
      afterAvg: a,
      beforeLow1: Math.max(1, Math.round(b * 0.66)),
      afterLow1: Math.max(1, Math.round(a * 0.68)),
      beforeFrametime: fpsToFrametime(b),
      afterFrametime: fpsToFrametime(a),
      notes: `Записано со страницы твика «${title}».`,
    });
    toast({
      title: "Замер сохранён в Журнал",
      description: `${b} → ${a} FPS (${delta && delta.pct > 0 ? "+" : ""}${delta?.pct ?? 0}%)`,
      tone: "success",
    });
  }

  return (
    <>
      <LiquidGlass as="section" className="glass p-5" aria-label="Статус и личный замер">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">Мой статус</h2>
            <p className="text-[12.5px] text-ink-3">
              {applied ? (
                <span className="inline-flex items-center gap-1 text-ok">
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  Применено на моём ПК
                </span>
              ) : isHarmful ? (
                "Не применять (анти-твик)"
              ) : (
                "Ещё не применён"
              )}
            </p>
          </div>
          <Switch checked={applied} onChange={toggle} label={`Применено: ${title}`} />
        </div>

        <div className="hairline my-4" />

        <p className="text-[12.5px] font-semibold text-ink-2">Личный замер (1 сцена)</p>
        <div className="mt-2 grid grid-cols-2 gap-2.5">
          <div>
            <BoundedNumber label="FPS до" optional decimals={1} min={1} max={1500} value={before} onValue={setBeforeDraft} onCommit={s=>{saveFps(s,after);setBeforeDraft(null);}}/>
          </div>
          <div>
            <BoundedNumber label="FPS после" optional decimals={1} min={1} max={1500} value={after} onValue={setAfterDraft} onCommit={s=>{saveFps(before,s);setAfterDraft(null);}}/>
          </div>
        </div>

        {delta && (
          <p className="mt-2.5 text-[13px] font-semibold tabular-nums text-ink-2">
            Дельта:{" "}
            <span className={delta.pct > 1 ? "text-ok" : delta.pct < -1 ? "text-danger" : "text-ink"}>
              {delta.diff > 0 ? `+${delta.diff}` : delta.diff} FPS ({delta.pct > 0 ? `+${delta.pct}%` : `${delta.pct}%`})
            </span>
          </p>
        )}

        <div className="mt-3.5 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={pushToJournal} className="flex-1">
            <Activity className="text-accent-hi" aria-hidden="true" />
            В журнал
          </Button>
          {(before || after) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setBeforeDraft(null);
                setAfterDraft(null);
                storage.setTweakFps(slug, null, null);
                toast({ title: "Поля FPS очищены", tone: "info" });
              }}
              aria-label="Очистить поля FPS"
            >
              <RotateCcw aria-hidden="true" />
            </Button>
          )}
        </div>
        <Link href="/journal" className="link mt-3 inline-block text-[12.5px]">
          Открыть весь журнал замеров →
        </Link>
      </LiquidGlass>

      <ConfirmDialog {...opener.origin}
        open={confirmHarmful}
        onClose={() => setConfirmHarmful(false)}
        onConfirm={() => {
          storage.setTweakApplied(slug, true);
          toast({ title: "Помечено для отката", tone: "warning" });
        }}
        title="Внимание: это вредный анти-твик"
        description="Мы не рекомендуем применять эту настройку. Включайте отметку, только чтобы зафиксировать, что она уже была применена и требует отката."
        confirmLabel="Всё равно отметить"
      />
    </>
  );
}
