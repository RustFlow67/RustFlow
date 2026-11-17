"use client";

import {
  ArrowRight,
  Check,
  Copy,
  Cpu,
  Eye,
  GitCompareArrows,
  HardDrive,
  MemoryStick,
  Monitor,
  Search,
  SearchX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import CodeBlock from "@/components/CodeBlock";
import Segmented from "@/components/Segmented";
import { Badge, Button, EmptyState, Input, Meter, Select } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { getCpu, getGpu } from "@/lib/hardware";
import {
  PRESET_TIER_LABEL,
  type HardwarePreset,
  type PresetResolution,
  type PresetTier,
} from "@/lib/models/preset";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { plural } from "@/lib/tweaks/meta";

type ResFilter = "all" | PresetResolution;
type TierFilter = "all" | PresetTier;
type MinFpsFilter = "all" | "90" | "115";
type PresetSort = "featured" | "modded-desc" | "official-desc" | "low1-desc" | "price-asc" | "score-desc";

const SORT_OPTIONS = [
  { value: "featured", label: "Сортировка: эталонные" },
  { value: "modded-desc", label: "FPS Моддед 2x (убыв.)" },
  { value: "official-desc", label: "FPS Официал (убыв.)" },
  { value: "low1-desc", label: "1% low Официал (убыв.)" },
  { value: "score-desc", label: "Оценка /10 (убыв.)" },
  { value: "price-asc", label: "От бюджетных к флагманам" },
] as const;

const TIER_OPTIONS = [
  { value: "all", label: "Класс: все" },
  { value: "budget", label: "Бюджет" },
  { value: "sweetspot", label: "Оптимум" },
  { value: "mid-high", label: "Продвинутый" },
  { value: "flagship", label: "Флагман" },
] as const;

const MIN_FPS_OPTIONS = [
  { value: "all", label: "Официал FPS: любой" },
  { value: "90", label: "От 90+ FPS на официале" },
  { value: "115", label: "От 115+ FPS на официале" },
] as const;

const midFps = (r: [number, number]) => (r[0] + r[1]) / 2;

export default function PresetsExplorer({
  presets,
  tweakTitles,
}: {
  presets: HardwarePreset[];
  tweakTitles: Record<string, string>;
}) {
  const { state, hydrated } = useRustFlowStore();
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [res, setRes] = useState<ResFilter>("all");
  const [tier, setTier] = useState<TierFilter>("all");
  const [minFps, setMinFps] = useState<MinFpsFilter>("all");
  const [sort, setSort] = useState<PresetSort>("featured");

  const [compareIds, setCompareIds] = useState<string[]>([
    "preset_5600x_5060",
    "preset_5700x3d_4060ti",
  ]);
  const [includeMyBuild, setIncludeMyBuild] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailPreset, setDetailPreset] = useState<HardwarePreset | null>(null);

  const myBuild =
    hydrated && state
      ? (state.builds.find((b) => b.id === state.activeBuildId) ?? state.builds[0] ?? null)
      : null;

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = presets.filter((p) => {
      if (res !== "all" && p.resolution !== res) return false;
      if (tier !== "all" && p.tier !== tier) return false;
      if (minFps === "90" && p.fpsOfficial[1] < 90) return false;
      if (minFps === "115" && p.fpsOfficial[0] < 115) return false;
      if (tokens.length > 0) {
        const hay = `${p.title} ${p.cpu} ${p.gpu} ${p.ram} ${p.resolution} ${p.badge}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    const sorted = [...list];
    if (sort === "featured") {
      sorted.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)) || a.priceOrder - b.priceOrder);
    } else if (sort === "modded-desc") {
      sorted.sort((a, b) => midFps(b.fpsModded) - midFps(a.fpsModded));
    } else if (sort === "official-desc") {
      sorted.sort((a, b) => midFps(b.fpsOfficial) - midFps(a.fpsOfficial));
    } else if (sort === "low1-desc") {
      sorted.sort((a, b) => b.low1Official - a.low1Official);
    } else if (sort === "score-desc") {
      sorted.sort((a, b) => b.score10 - a.score10);
    } else if (sort === "price-asc") {
      sorted.sort((a, b) => a.priceOrder - b.priceOrder);
    }
    return sorted;
  }, [presets, query, res, tier, minFps, sort]);

  const comparedPresets = useMemo(
    () =>
      compareIds
        .map((id) => presets.find((p) => p.id === id))
        .filter((p): p is HardwarePreset => Boolean(p)),
    [compareIds, presets],
  );

  async function copyPresetCfg(p: HardwarePreset) {
    const full = [
      `// RustFlow — ${p.title} (${p.resolution})`,
      `// Моддед 2x: ${p.fpsModded[0]}-${p.fpsModded[1]} FPS | Официал: ${p.fpsOfficial[0]}-${p.fpsOfficial[1]} FPS`,
      `// Steam Launch Options: ${p.launchOptions}`,
      p.cfgText,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(full);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId((curr) => (curr === p.id ? null : curr)), 1800);
      toast({
        title: "Настройки скопированы",
        description: `${p.title} — вставьте в cfg\\client.cfg при закрытом Rust.`,
        tone: "success",
      });
    } catch {
      setDetailPreset(p);
      toast({
        title: "Открыто окно настроек",
        description: "Скопируйте блок client.cfg вручную.",
        tone: "info",
      });
    }
  }

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) {
        toast({
          title: "Максимум 3 пресета в сравнении",
          description: "Заменили самый первый выбранный пресет.",
          tone: "info",
        });
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  }

  function resetFilters() {
    setQuery("");
    setRes("all");
    setTier("all");
    setMinFps("all");
    setSort("featured");
  }

  const basePreset = comparedPresets[0];

  return (
    <div className="space-y-6">
      {/* Панель поиска, фильтров и сортировки (1 blur-слой страницы) */}
      <section
        className="glass glass-blur relative z-10 space-y-4 p-4 sm:p-5"
        aria-label="Поиск, фильтры и сортировка пресетов"
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_175px_215px_230px]">
          <Input
            label="Поиск по пресетам железа"
            hideLabel
            type="search"
            placeholder="Поиск: 5600X, RTX 5060, X3D, 32 ГБ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onClear={() => setQuery("")}
            icon={<Search className="h-4 w-4" />}
          />
          <Select
            label="Класс сборки"
            hideLabel
            options={TIER_OPTIONS}
            value={tier}
            onChange={(e) => setTier(e.target.value as TierFilter)}
          />
          <Select
            label="Минимальный FPS на официале"
            hideLabel
            options={MIN_FPS_OPTIONS}
            value={minFps}
            onChange={(e) => setMinFps(e.target.value as MinFpsFilter)}
          />
          <Select
            label="Сортировка пресетов"
            hideLabel
            options={SORT_OPTIONS}
            value={sort}
            onChange={(e) => setSort(e.target.value as PresetSort)}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            ariaLabel="Фильтр по разрешению"
            value={res}
            onChange={setRes}
            options={[
              { value: "all", label: `Все · ${presets.length}` },
              {
                value: "1080p",
                label: `1080p · ${presets.filter((p) => p.resolution === "1080p").length}`,
              },
              {
                value: "1440p",
                label: `1440p · ${presets.filter((p) => p.resolution === "1440p").length}`,
              },
            ]}
          />
          <p className="text-sm text-ink-3" aria-live="polite">
            Показано: <strong className="text-ink">{filtered.length}</strong>{" "}
            {plural(filtered.length, ["пресет", "пресета", "пресетов"])}
          </p>
        </div>
      </section>

      {/* Карточки пресетов */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
          title="Подходящих пресетов не найдено"
          hint="Сбросьте фильтр или рассчитайте свою точную конфигурацию в разделе «Сборка /10»."
          action={
            <>
              <Button variant="primary" onClick={resetFilters}>
                Сбросить фильтры
              </Button>
              <Link href="/benchmark" className="btn">
                Рассчитать свою сборку
              </Link>
            </>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((p) => {
            const inCompare = compareIds.includes(p.id);
            const isCopied = copiedId === p.id;
            return (
              <article
                key={p.id}
                className={`glass glass-hover flex h-full flex-col p-5 sm:p-6 ${
                  p.featured ? "glass-accent" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={p.featured ? "accent" : "measured"}>{p.badge}</Badge>
                    <Badge>{PRESET_TIER_LABEL[p.tier]}</Badge>
                    <Badge>{p.resolution}</Badge>
                  </div>
                  <span className="rounded-full bg-white/12 px-2.5 py-1 text-[13px] font-extrabold tabular-nums text-ink">
                    {p.score10.toFixed(1)} / 10
                  </span>
                </div>

                <h2 className="mt-3.5 text-xl font-bold tracking-tight text-ink">{p.title}</h2>

                {/* Комплектующие */}
                <dl className="mt-3 grid gap-1.5 text-[13px] text-ink-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 flex-none text-accent-hi" aria-hidden="true" />
                    <dt className="sr-only">Процессор</dt>
                    <dd className="truncate">{p.cpu}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 flex-none text-accent-hi" aria-hidden="true" />
                    <dt className="sr-only">Видеокарта</dt>
                    <dd className="truncate">{p.gpu}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <MemoryStick className="h-3.5 w-3.5 flex-none text-accent-hi" aria-hidden="true" />
                    <dt className="sr-only">Память</dt>
                    <dd className="truncate">{p.ram}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-3.5 w-3.5 flex-none text-accent-hi" aria-hidden="true" />
                    <dt className="sr-only">Накопитель</dt>
                    <dd className="truncate">{p.storage}</dd>
                  </div>
                </dl>

                {/* Замеры FPS: Моддед 2x / Официал */}
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <div className="well p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11.5px] font-bold uppercase tracking-wider text-sky">
                        Моддед 2x
                      </span>
                      <span className="text-[11.5px] tabular-nums text-ink-3">
                        {p.frametimeModdedMs} мс
                      </span>
                    </div>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-ink">
                      {p.fpsModded[0]}–{p.fpsModded[1]}{" "}
                      <span className="text-[12.5px] font-semibold text-ink-3">FPS</span>
                    </p>
                    <Meter
                      percent={Math.min(100, (p.fpsModded[1] / 270) * 100)}
                      fromColor="#0a84ff"
                      toColor="#8ce0ff"
                      className="mt-2"
                    />
                    <p className="mt-1.5 text-[12px] text-ink-2">
                      1% low: <strong className="tabular-nums">{p.low1Modded} FPS</strong>
                    </p>
                  </div>

                  <div className="well p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[11.5px] font-bold uppercase tracking-wider text-accent-hi">
                        Официал
                      </span>
                      <span className="text-[11.5px] tabular-nums text-ink-3">
                        {p.frametimeOfficialMs} мс
                      </span>
                    </div>
                    <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-ink">
                      {p.fpsOfficial[0]}–{p.fpsOfficial[1]}{" "}
                      <span className="text-[12.5px] font-semibold text-ink-3">FPS</span>
                    </p>
                    <Meter
                      percent={Math.min(100, (p.fpsOfficial[1] / 270) * 100)}
                      className="mt-2"
                    />
                    <p className="mt-1.5 text-[12px] text-ink-2">
                      1% low: <strong className="tabular-nums">{p.low1Official} FPS</strong>
                    </p>
                  </div>
                </div>

                {/* Ключевые настройки */}
                <div className="mt-3.5 flex flex-wrap gap-1.5 text-[12px]">
                  <Badge>Draw {p.settings.drawDistance}</Badge>
                  <Badge>Shader {p.settings.shaderLevel}</Badge>
                  <Badge>Water {p.settings.waterQuality}</Badge>
                  <Badge>gc.buffer {p.settings.gcBuffer}</Badge>
                </div>

                <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{p.bottleneckNote}</p>
                <p className="mt-1 text-[11.5px] text-ink-3">Сцена: {p.testScene}</p>

                {/* Действия */}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => copyPresetCfg(p)}
                    className="flex-1"
                  >
                    {isCopied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                    {isCopied ? "Скопировано!" : "Скопировать настройки"}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setDetailPreset(p)}>
                    <Eye aria-hidden="true" />
                    Детали
                  </Button>
                  <Button
                    variant={inCompare ? "secondary" : "ghost"}
                    size="sm"
                    aria-pressed={inCompare}
                    onClick={() => toggleCompare(p.id)}
                    style={
                      inCompare
                        ? { boxShadow: "inset 0 0 0 1.5px rgb(255 160 98 / 0.7)" }
                        : undefined
                    }
                  >
                    <GitCompareArrows
                      className={inCompare ? "text-accent-hi" : ""}
                      aria-hidden="true"
                    />
                    {inCompare ? "В сравнении" : "Сравнить"}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* ------------------- Таблица сравнения пресетов ------------------- */}
      <section
        id="compare"
        className="glass scroll-mt-24 p-5 sm:p-7"
        aria-label="Сравнение выбранных пресетов"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <GitCompareArrows className="h-5 w-5 text-accent-hi" aria-hidden="true" />
              Сравнение конфигураций
            </h2>
            <p className="mt-1 text-[13px] text-ink-3">
              Выберите до 3 карточек кнопкой «Сравнить» — дельта считается относительно первого столбца.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {myBuild && (
              <Button
                variant={includeMyBuild ? "primary" : "secondary"}
                size="sm"
                onClick={() => setIncludeMyBuild((v) => !v)}
              >
                {includeMyBuild ? "Скрыть мою сборку" : "+ Моя сборка"}
              </Button>
            )}
            {compareIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setCompareIds([])}>
                Очистить
              </Button>
            )}
          </div>
        </div>

        {comparedPresets.length === 0 && !includeMyBuild ? (
          <div className="well mt-4 p-5 text-center text-sm text-ink-2">
            Нажмите «Сравнить» на любых двух пресетах выше, чтобы сопоставить их FPS, frametime и настройки.
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/12">
                  <th className="py-3 pr-4 text-[12.5px] font-semibold text-ink-3">Параметр</th>
                  {includeMyBuild && myBuild && (
                    <th className="py-3 px-3 text-sm font-bold text-accent-hi">
                      <div>{myBuild.input.name}</div>
                      <span className="text-[11px] font-normal text-ink-3">Моя сборка (оценка)</span>
                    </th>
                  )}
                  {comparedPresets.map((p, idx) => (
                    <th key={p.id} className="py-3 px-3 text-sm font-bold text-ink">
                      <div className="flex items-start justify-between gap-2">
                        <span>
                          {p.title}
                          {idx === 0 && (
                            <span className="ml-1.5 text-[11px] font-normal text-ink-3">(база)</span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleCompare(p.id)}
                          aria-label={`Убрать «${p.title}» из сравнения`}
                          className="grid h-6 w-6 flex-none place-items-center rounded-full bg-white/10 text-ink-3 hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-[13.5px]">
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">Балл /10 · Разрешение</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 font-bold tabular-nums">
                      {myBuild.score10.toFixed(1)}/10 · {myBuild.input.resolution}
                    </td>
                  )}
                  {comparedPresets.map((p) => (
                    <td key={p.id} className="py-2.5 px-3 font-bold tabular-nums">
                      {p.score10.toFixed(1)}/10 · {p.resolution}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">CPU / GPU</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 text-ink-2">
                      {getCpu(myBuild.input.cpuId)?.name ?? myBuild.input.cpuId} ·{" "}
                      {getGpu(myBuild.input.gpuId)?.name ?? myBuild.input.gpuId}
                    </td>
                  )}
                  {comparedPresets.map((p) => (
                    <td key={p.id} className="py-2.5 px-3 text-ink-2">
                      {p.cpu} · {p.gpu}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">Память RAM</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 text-ink-2">
                      {myBuild.input.ramGb} ГБ @ {myBuild.input.ramMhz} CL{myBuild.input.ramCl}
                    </td>
                  )}
                  {comparedPresets.map((p) => (
                    <td key={p.id} className="py-2.5 px-3 text-ink-2">
                      {p.ram}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">FPS Моддед 2x</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 font-bold tabular-nums text-sky">
                      {myBuild.fpsModded[0]}–{myBuild.fpsModded[1]} FPS
                    </td>
                  )}
                  {comparedPresets.map((p, idx) => {
                    const diffPct =
                      basePreset && idx > 0
                        ? Math.round(((midFps(p.fpsModded) - midFps(basePreset.fpsModded)) / midFps(basePreset.fpsModded)) * 100)
                        : null;
                    return (
                      <td key={p.id} className="py-2.5 px-3 font-bold tabular-nums">
                        {p.fpsModded[0]}–{p.fpsModded[1]} FPS
                        {diffPct !== null && (
                          <span
                            className={`ml-1.5 text-[12px] ${
                              diffPct > 0 ? "text-ok" : diffPct < 0 ? "text-danger" : "text-ink-3"
                            }`}
                          >
                            ({diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`})
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">FPS Официал (High Pop)</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 font-bold tabular-nums text-accent-hi">
                      {myBuild.fpsOfficial[0]}–{myBuild.fpsOfficial[1]} FPS
                    </td>
                  )}
                  {comparedPresets.map((p, idx) => {
                    const diffPct =
                      basePreset && idx > 0
                        ? Math.round(
                            ((midFps(p.fpsOfficial) - midFps(basePreset.fpsOfficial)) /
                              midFps(basePreset.fpsOfficial)) *
                              100,
                          )
                        : null;
                    return (
                      <td key={p.id} className="py-2.5 px-3 font-bold tabular-nums">
                        {p.fpsOfficial[0]}–{p.fpsOfficial[1]} FPS
                        {diffPct !== null && (
                          <span
                            className={`ml-1.5 text-[12px] ${
                              diffPct > 0 ? "text-ok" : diffPct < 0 ? "text-danger" : "text-ink-3"
                            }`}
                          >
                            ({diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`})
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">1% low · Frametime (офиц)</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 text-ink-3">Замерьте в Журнале</td>
                  )}
                  {comparedPresets.map((p) => (
                    <td key={p.id} className="py-2.5 px-3 tabular-nums text-ink-2">
                      {p.low1Official} FPS · {p.frametimeOfficialMs} мс
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">Графика / gc.buffer</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 text-ink-2">
                      gc.buffer {myBuild.input.ramGb >= 32 ? 4096 : myBuild.input.ramGb >= 16 ? 2048 : 1024}
                    </td>
                  )}
                  {comparedPresets.map((p) => (
                    <td key={p.id} className="py-2.5 px-3 text-ink-2">
                      Draw {p.settings.drawDistance} · Shader {p.settings.shaderLevel} · gc {p.settings.gcBuffer}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Модальное окно полных настроек пресета */}
      <Modal
        open={detailPreset !== null}
        onClose={() => setDetailPreset(null)}
        title={detailPreset ? `${detailPreset.title} (${detailPreset.resolution})` : ""}
        description={detailPreset?.testScene}
        maxWidth="max-w-2xl"
      >
        {detailPreset && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 text-[13px] sm:grid-cols-3">
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Graphics Quality</span>
                <strong className="text-ink">{detailPreset.settings.graphicsQuality}</strong>
              </div>
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Дальность / Тени</span>
                <strong className="text-ink">
                  {detailPreset.settings.drawDistance} · {detailPreset.settings.shadowCascades}
                </strong>
              </div>
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Шейдеры / Вода</span>
                <strong className="text-ink">
                  {detailPreset.settings.shaderLevel} · Water {detailPreset.settings.waterQuality}
                </strong>
              </div>
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Апскейлер / AA</span>
                <strong className="text-ink">{detailPreset.settings.upscaler}</strong>
              </div>
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Низкая задержка</span>
                <strong className="text-ink">{detailPreset.settings.reflexOrAntiLag}</strong>
              </div>
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">gc.buffer / Gibs</span>
                <strong className="text-ink">
                  {detailPreset.settings.gcBuffer} · Gibs {detailPreset.settings.maxGibs}
                </strong>
              </div>
            </div>

            <p className="well p-3.5 text-[13px] leading-relaxed text-ink-2">
              <strong className="text-ink">Драйвер и BIOS:</strong> {detailPreset.driverNote}
            </p>

            <CodeBlock
              title={`client.cfg — ${detailPreset.slug}`}
              content={detailPreset.cfgText}
              note={`Параметры запуска Steam: ${detailPreset.launchOptions}`}
            />

            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-3">Ключевые твики в этом конфиге:</p>
              <div className="flex flex-wrap gap-1.5">
                {detailPreset.keyTweaks.map((slug) => (
                  <Link
                    key={slug}
                    href={`/tweaks/${slug}`}
                    className="chip hover:bg-white/16 hover:text-white"
                  >
                    {tweakTitles[slug] ?? slug}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2.5 pt-2">
              <Link
                href={`/benchmark?preset=${detailPreset.slug}`}
                className="btn btn-sm"
                onClick={() => setDetailPreset(null)}
              >
                Открыть в Сборке /10
                <ArrowRight aria-hidden="true" />
              </Link>
              <Button variant="primary" size="sm" onClick={() => copyPresetCfg(detailPreset)}>
                <Copy aria-hidden="true" />
                Скопировать client.cfg
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
