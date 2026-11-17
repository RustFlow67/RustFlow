import { FlaskConical, HelpCircle, ShieldAlert } from "lucide-react";
import type { CSSProperties } from "react";
import {
  EVIDENCE_META,
  TWEAK_RISK_META,
  type EvidenceStatus,
  type TweakRiskLevel,
} from "@/lib/models/tweak";
import { RISK_META } from "@/lib/tweaks/meta";
import type { Impact, Risk } from "@/lib/tweaks/types";

export function RiskBadge({ risk }: { risk: Risk }) {
  return (
    <span className={`chip chip-${risk}`} title={RISK_META[risk].hint}>
      <i className="dot" aria-hidden="true" />
      {RISK_META[risk].label}
    </span>
  );
}

/** Трёхуровневый бейдж риска: Безопасно / Осторожно / Вредно. */
export function RiskLevelBadge({ level }: { level: TweakRiskLevel }) {
  const meta = TWEAK_RISK_META[level];
  return (
    <span className={`chip chip-${level}`} title={meta.hint}>
      {level === "harmful" ? (
        <ShieldAlert aria-hidden="true" />
      ) : (
        <i className="dot" aria-hidden="true" />
      )}
      {meta.label}
    </span>
  );
}

/** Бейдж верификации: Замерено / Миф. */
export function EvidenceBadge({ status }: { status: EvidenceStatus }) {
  const meta = EVIDENCE_META[status];
  const Icon = status === "measured" ? FlaskConical : HelpCircle;
  return (
    <span className={`chip chip-${status}`} title={meta.hint}>
      <Icon aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export const IMPACT_LABELS: { key: keyof Impact; label: string; hint: string }[] = [
  { key: "fps", label: "FPS", hint: "Средняя частота кадров" },
  { key: "smooth", label: "1% low", hint: "Плавность и ровность frametime" },
  { key: "latency", label: "Отклик", hint: "Задержка ввода и сети" },
];

const LEVEL_TEXT = ["нет", "небольшое", "заметное", "сильное"];

function Pips({ value }: { value: number }) {
  return (
    <span className="pips" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <i key={i} data-on={i <= value ? "" : undefined} />
      ))}
    </span>
  );
}

export function ImpactRow({ impact }: { impact: Impact }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12px] font-medium text-ink-3">
      {IMPACT_LABELS.map(({ key, label }) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          {label}
          <Pips value={impact[key]} />
          <span className="sr-only">: влияние {LEVEL_TEXT[impact[key]]}</span>
        </span>
      ))}
    </div>
  );
}

export function ImpactBars({ impact }: { impact: Impact }) {
  return (
    <div className="space-y-4">
      {IMPACT_LABELS.map(({ key, label, hint }) => {
        const scale = Math.max(0.05, impact[key] / 3);
        return (
          <div key={key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[12.5px] text-ink-2">{LEVEL_TEXT[impact[key]]}</span>
            </div>
            <div className="meter" title={hint}>
              <i style={{ "--scale": String(scale) } as CSSProperties} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
