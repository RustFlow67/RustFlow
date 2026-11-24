"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { usePopupTrigger } from "./fx/usePopupMotion";

import { FileJson, RotateCcw, Search, SearchX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import LiquidSelect from "@/components/LiquidSelect";
import { useLiquidLens } from "./fx/useLiquidLens";
import Segmented from "@/components/Segmented";
import TweakCard from "@/components/TweakCard";
import { Button, EmptyState, Input, Skeleton } from "@/components/ui";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import {
  calcUserTweakDelta,
  EVIDENCE_META,
  TWEAK_GROUPS,
  TWEAK_RISK_META,
  type EvidenceStatus,
  type TweakGroupId,
  type TweakRiskLevel,
} from "@/lib/models/tweak";
import { useShiftStore } from "@/lib/storage/useStore";
import { plural } from "@/lib/tweaks/meta";
import type { TweakLite } from "@/lib/tweaks/types";

type GroupFilter = "all" | TweakGroupId;
type EvidenceFilter = "all" | EvidenceStatus;
type GainFilter = "all" | "mid" | "high" | "applied";
type SortId = "recommended" | "gain-desc" | "safe-first" | "my-delta" | "title";

const RISK_LEVELS: TweakRiskLevel[] = ["safe", "caution", "harmful"];

/** Поддержка старых хешей URL (#prep, #windows, #game) и новых 6 категорий. */
const HASH_ALIAS: Record<string, TweakGroupId> = {
  "cpu-windows": "cpu-windows",
  windows: "cpu-windows",
  prep: "ram-ssd",
  gpu: "gpu",
  "ram-ssd": "ram-ssd",
  network: "network",
  "rust-settings": "rust-settings",
  game: "rust-settings",
  "launch-options": "launch-options",
};

const GAIN_OPTIONS = [
  { value: "all", label: "Влияние на FPS: любое" },
  { value: "mid", label: "Средний потенциал и выше" },
  { value: "high", label: "Высокий потенциал" },
  { value: "applied", label: "Только применённые" },
] as const;

const SORT_OPTIONS = [
  { value: "recommended", label: "Сортировка: по порядку" },
  { value: "gain-desc", label: "По потенциалу среднего FPS" },
  { value: "safe-first", label: "Сначала безопасные" },
  { value: "my-delta", label: "По моему замеру Δ%" },
  { value: "title", label: "По названию (А–Я)" },
] as const;

export default function TweakExplorer({ tweaks }: { tweaks: TweakLite[] }) {
  const { state, hydrated, storage } = useShiftStore();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupFilter>("all");
  const [risks, setRisks] = useState<Set<TweakRiskLevel>>(() => new Set(RISK_LEVELS));
  const [evidence, setEvidence] = useState<EvidenceFilter>("all");
  const [gain, setGain] = useState<GainFilter>("all");
  const [sort, setSort] = useState<SortId>("recommended");
  const opener = usePopupTrigger();
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const readHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash && HASH_ALIAS[hash]) setGroup(HASH_ALIAS[hash]);
    };
    readHash();
    window.addEventListener("hashchange", readHash);
    return () => window.removeEventListener("hashchange", readHash);
  }, []);

  const userMap = useMemo(() => state?.tweaks ?? {}, [state?.tweaks]);
  const appliedCount = useMemo(
    () => Object.values(userMap).filter((r) => r.applied).length,
    [userMap],
  );

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = tweaks.filter((t) => {
      if (group !== "all" && t.group !== group) return false;
      if (!risks.has(t.riskLevel)) return false;
      if (evidence !== "all" && t.evidence !== evidence) return false;
      if (gain === "mid" && t.impact.fps < 2) return false;
      if (gain === "high" && t.impact.fps < 3) return false;
      if (gain === "applied" && !userMap[t.slug]?.applied) return false;
      if (tokens.length > 0) {
        const hay = `${t.title} ${t.tagline} ${t.what} ${t.fileName} ${t.gainLabel}`.toLowerCase();
        if (!tokens.every((tok) => hay.includes(tok))) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sort === "gain-desc") {
      sorted.sort((a, b) => b.impact.fps - a.impact.fps || a.order - b.order);
    } else if (sort === "safe-first") {
      sorted.sort(
        (a, b) =>
          TWEAK_RISK_META[a.riskLevel].order - TWEAK_RISK_META[b.riskLevel].order ||
          b.impact.fps - a.impact.fps,
      );
    } else if (sort === "my-delta") {
      sorted.sort((a, b) => {
        const da = calcUserTweakDelta(userMap[a.slug])?.pct ?? -9999;
        const db = calcUserTweakDelta(userMap[b.slug])?.pct ?? -9999;
        return db - da || b.impact.fps - a.impact.fps;
      });
    } else if (sort === "title") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "ru"));
    }
    return sorted;
  }, [tweaks, query, group, risks, evidence, gain, sort, userMap]);

  function selectGroup(next: GroupFilter) {
    setGroup(next);
    window.history.replaceState(
      null,
      "",
      next === "all" ? window.location.pathname : `#${next}`,
    );
  }

  const { list: riskRail, lens: riskLens } = useLiquidLens(RISK_LEVELS.findIndex(level => risks.has(level)), RISK_LEVELS.length, { continuous: true });
  function toggleRisk(level: TweakRiskLevel) {
    setRisks((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next.size === 0 ? new Set(RISK_LEVELS) : next;
    });
  }

  function resetFilters() {
    setQuery("");
    setRisks(new Set(RISK_LEVELS));
    setEvidence("all");
    setGain("all");
    setSort("recommended");
    selectGroup("all");
  }

  const groupTabs = [
    { value: "all" as GroupFilter, label: `Все · ${tweaks.length}` },
    ...TWEAK_GROUPS.map((g) => ({
      value: g.id as GroupFilter,
      label: `${g.shortTitle} · ${tweaks.filter((t) => t.group === g.id).length}`,
    })),
  ];

  const evidenceTabs: { value: EvidenceFilter; label: string }[] = [
    { value: "all", label: "Все статусы" },
    {
      value: "measured",
      label: `${EVIDENCE_META.measured.label} · ${tweaks.filter((t) => t.evidence === "measured").length}`,
    },
    {
      value:"conditional", label:EVIDENCE_META.conditional.label,
    },
    {
      value: "myth",
      label: `${EVIDENCE_META.myth.label} · ${tweaks.filter((t) => t.evidence === "myth").length}`,
    },
  ];

  const hasCustomFilter =
    Boolean(query) ||
    group !== "all" ||
    evidence !== "all" ||
    gain !== "all" ||
    risks.size !== RISK_LEVELS.length;

  return (
    <div>
      {/* Единственная blur-панель страницы — панель поиска и фильтров */}
      <LiquidGlass as="section"
        className="glass glass-blur relative z-10 mb-6 space-y-4 p-4 sm:p-5"
        aria-label="Поиск, фильтры и сортировка твиков"
      >
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_230px]">
          <Input
            label="Поиск по библиотеке твиков"
            hideLabel
            type="search"
            placeholder="Поиск: XMP, gc.buffer, Reflex, Нейгл, Defender…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            icon={<Search className="h-4 w-4" />}
          />
          <LiquidSelect
            label="Фильтр по приросту"
            hideLabel
            options={GAIN_OPTIONS}
            value={gain}
            onChange={setGain}
          />
          <LiquidSelect
            label="Сортировка твиков"
            hideLabel
            options={SORT_OPTIONS}
            value={sort}
            onChange={setSort}
          />
        </div>

        {/* Категории (6 целевых групп) */}
        <Segmented
          options={groupTabs}
          value={group}
          onChange={selectGroup}
          ariaLabel="Категория твиков"
          className="w-full"
        />

        {/* Риск + Верификация (Замерено / Миф) */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div ref={riskRail} className="liquid-filter-list flex flex-wrap items-center gap-2" role="group" aria-label="Уровень риска">
            <LiquidGlass as="span" shape="pill" ref={riskLens} className="lens liquid-lens" aria-hidden="true" />
            {RISK_LEVELS.map((level) => {
              const active = risks.has(level);
              return (
                <button
                  key={level} data-liquid-item=""
                  type="button"
                  aria-pressed={active}
                  title={TWEAK_RISK_META[level].hint}
                  onClick={() => toggleRisk(level)}
                  className={`chip chip-${level} !h-9 !px-3.5 transition-transform duration-200 ${
                    active ? "" : "opacity-45"
                  }`}
                >
                  <i className="dot" aria-hidden="true" />
                  {TWEAK_RISK_META[level].label}
                </button>
              );
            })}
          </div>

          <Segmented
            options={evidenceTabs}
            value={evidence}
            onChange={setEvidence}
            ariaLabel="Статус подтверждения эффекта"
          />
        </div>
      </LiquidGlass>

      {/* Сводная строка + действия */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1 text-sm">
        <p className="text-ink-2" aria-live="polite">
          Найдено: <strong className="text-ink">{filtered.length}</strong>{" "}
          {plural(filtered.length, ["позиция", "позиции", "позиций"])}
          {hydrated && (
            <span className="text-ink-3">
              {" "}
              · Применено у вас: <strong className="text-ok">{appliedCount}</strong>
            </span>
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {hasCustomFilter && (
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          )}
          <Button variant="ghost" size="sm" aria-haspopup="dialog" onClick={(event) => window.dispatchEvent(new CustomEvent("shift:backup", { detail: event.currentTarget }))}>
            <FileJson className="text-accent-hi" aria-hidden="true" />
            JSON
          </Button>
          {hydrated && appliedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={e => {opener.capture(e.currentTarget); setConfirmReset(true);}}>
              <RotateCcw aria-hidden="true" />
              Сбросить отметки
            </Button>
          )}
        </div>
      </div>

      {/* Сетка карточек / Skeleton / EmptyState */}
      {!hydrated ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Загрузка твиков">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-[340px] w-full" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tweak) => (
            <TweakCard key={tweak.slug} tweak={tweak} record={userMap[tweak.slug]} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
          title="По текущим фильтрам ничего не найдено"
          hint={
            gain === "applied"
              ? "Вы ещё не отметили ни одного твика переключателем «Применено». Сбросьте фильтр и начните с безопасных твиков RAM/SSD и настроек Rust."
              : "Попробуйте другой поисковый запрос, включите все уровни риска или переключите статус подтверждения эффекта."
          }
          action={
            <Button variant="primary" onClick={resetFilters}>
              Показать все твики ({tweaks.length})
            </Button>
          }
        />
      )}

      <ConfirmDialog {...opener.origin}
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          storage.resetTweakProgress();
          toast({ title: "Отметки твиков и поля FPS сброшены", tone: "info" });
        }}
        title="Сбросить отметки применённых твиков?"
        description="Переключатели «Применено» и введённые в карточках значения FPS до/после будут очищены. Записи в Журнале замеров сохранятся."
        confirmLabel="Сбросить отметки"
      />
    </div>
  );
}
