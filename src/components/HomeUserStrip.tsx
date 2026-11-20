"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { Activity, CheckCircle2, Cpu, FileJson } from "lucide-react";
import Link from "next/link";
import { openPlayerProfile } from "@/components/auth/ProfileGate";
import { Button } from "@/components/ui";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { plural } from "@/lib/tweaks/meta";

/** Живая полоса статуса пользователя на главной (localStorage: сборка, твики, журнал, JSON). */
export default function HomeUserStrip({ totalActionable }: { totalActionable: number }) {
  const { state, hydrated } = useRustFlowStore();

  const activeBuild =
    hydrated && state
      ? (state.builds.find((b) => b.id === state.activeBuildId) ?? state.builds[0] ?? null)
      : null;
  const appliedCount =
    hydrated && state ? Object.values(state.tweaks).filter((t) => t.applied).length : 0;
  const logsCount = hydrated && state ? state.logs.length : 0;

  return (
    <LiquidGlass className="glass grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-4" data-reveal>
      <LiquidGlass as={Link} href="/benchmark" className="tile tile-hover flex items-center gap-3 p-4">
        <Cpu className="h-5 w-5 flex-none text-accent-hi" aria-hidden="true" />
        <div className="min-w-0">
          <span className="block text-[12px] text-ink-3">Моя сборка</span>
          <strong className="block truncate text-[15px] font-bold text-ink">
            {activeBuild
              ? `${activeBuild.score10.toFixed(1)}/10 · ${activeBuild.input.name}`
              : "Оценить ПК /10 →"}
          </strong>
        </div>
      </LiquidGlass>

      <LiquidGlass as={Link} href="/tweaks" className="tile tile-hover flex items-center gap-3 p-4">
        <CheckCircle2 className="h-5 w-5 flex-none text-ok" aria-hidden="true" />
        <div className="min-w-0">
          <span className="block text-[12px] text-ink-3">Применено твиков</span>
          <strong className="block text-[15px] font-bold tabular-nums text-ink">
            {hydrated ? `${appliedCount} из ${totalActionable}` : `${totalActionable} проверенных`}
          </strong>
        </div>
      </LiquidGlass>

      <LiquidGlass as={Link} href="/journal" className="tile tile-hover flex items-center gap-3 p-4">
        <Activity className="h-5 w-5 flex-none text-accent-hi" aria-hidden="true" />
        <div className="min-w-0">
          <span className="block text-[12px] text-ink-3">Журнал до / после</span>
          <strong className="block text-[15px] font-bold tabular-nums text-ink">
            {hydrated
              ? `${logsCount} ${plural(logsCount, ["запись", "записи", "записей"])} (авто Δ%)`
              : "Таблица замеров →"}
          </strong>
        </div>
      </LiquidGlass>

      <LiquidGlass className="tile flex items-center justify-between gap-2 p-3.5">
        <div className="min-w-0 pl-1">
          <span className="block text-[12px] text-ink-3">Профиль в браузере</span>
          <strong className="block truncate text-[14px] font-bold text-ink">Экспорт / импорт</strong>
        </div>
        <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={(event) => openPlayerProfile(event.currentTarget)}>
          <FileJson className="text-accent-hi" aria-hidden="true" />
          JSON
        </Button>
      </LiquidGlass>
    </LiquidGlass>
  );
}
