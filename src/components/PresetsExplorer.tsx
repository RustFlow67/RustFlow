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
import Link from "@/components/RouteLink";
import { useMemo, useState } from "react";
import CodeBlock from "@/components/CodeBlock";
import { PresetRadar } from "@/components/addons/BuildRadar";
import LiquidSelect from "@/components/LiquidSelect";
import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import OriginDisclosure from "@/components/fx/OriginDisclosure";
import GraphicsPicker from "@/components/GraphicsPicker";
import { FavoriteButton, useFavorites } from "@/components/addons/Favorites";
import Segmented from "@/components/Segmented";
import { Badge, Button, EmptyState, Input, Meter } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { getCpu, getGpu } from "@/lib/hardware";
import {
  PRESET_FPS_SOURCE_LABEL,
  PRESET_SERVER,
  PRESET_TIER_LABEL,
  PRESET_TIER_ORDER,
  type HardwarePreset,
  type PresetResolution,
  type PresetTier,
} from "@/lib/models/preset";
import { formatBuildResolution, isResolutionDimension, MAX_PRESET_HEIGHT, type BuildResolution } from "@/lib/models/build-resolution";
import { presetCalculatorHref, projectPreset, type PresetView } from "@/lib/models/preset-projection";
import { getGraphicsProfile, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { tweakerHref } from "@/lib/tweaker";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { plural } from "@/lib/tweaks/meta";

type ResFilter = "all" | PresetResolution | "1440x1080" | "custom";
type TierFilter = "all" | PresetTier;
type MinFpsFilter = "all" | "90" | "115";
type PresetSort = "featured" | "modded-desc" | "official-desc" | "low1-desc" | "price-asc" | "score-desc";

const SORT_OPTIONS = [
  { value: "featured", label: "Сортировка: эталонные" },
  { value: "modded-desc", label: `${PRESET_SERVER.modded}: FPS ↓` },
  { value: "official-desc", label: `${PRESET_SERVER.official}: FPS ↓` },
  { value: "low1-desc", label: `${PRESET_SERVER.official}: 1% low ↓` },
  { value: "score-desc", label: "По запасу железа" },
  { value: "price-asc", label: "От бюджетных к флагманам" },
] as const;

const TIER_OPTIONS = [
  { value: "all", label: "Класс: все" },
  { value: "budget", label: "Бюджет" },
  { value: "sweetspot", label: "Оптимум" },
  { value: "mid-high", label: "Предтоп / X3D" },
  { value: "flagship", label: "Флагманы" },
] as const;

const MIN_FPS_OPTIONS = [
  { value: "all", label: `${PRESET_SERVER.official}: любой FPS` },
  { value: "90", label: `${PRESET_SERVER.official}: верх ≥ 90 FPS` },
  { value: "115", label: `${PRESET_SERVER.official}: от 115 FPS` },
] as const;

const RESOLUTIONS = ["1080p", "1440p", "4k"] as const;
const QUICK_SIZES = [[1280, 960], [1440, 1080], [1600, 1080], [1728, 1080], [2560, 1080]] as const;
const DEFAULT_SIZE = { width: 1728, height: 1080 };
const resolutionLabel = (res: PresetResolution) => res === "4k" ? "4K" : res;
const midFps = (r: [number, number]) => (r[0] + r[1]) / 2;
const classLabel = (p: HardwarePreset) => p.tier === "flagship" ? "Флагман" : /X3D/i.test(p.cpu) ? "X3D" : p.tier === "budget" ? "Бюджет" : "Оптимум";
const byPrice = (a: HardwarePreset, b: HardwarePreset) =>
  PRESET_TIER_ORDER.indexOf(a.tier) - PRESET_TIER_ORDER.indexOf(b.tier) || a.priceOrder - b.priceOrder;

const SERVERS = [
  { label: PRESET_SERVER.modded, range: "fpsModded", low: "low1Modded", ms: "frametimeModdedMs", tone: "text-accent-hi" },
  { label: PRESET_SERVER.official, range: "fpsOfficial", low: "low1Official", ms: "frametimeOfficialMs", tone: "text-accent-hi" },
] as const;

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
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { preset: favorites } = useFavorites();

  const [globalMode, setGlobalMode] = useState<GraphicsProfileId>("competitive");
  const [cardModes, setCardModes] = useState<Record<string, GraphicsProfileId>>({});
  const [dimensions, setDimensions] = useState({ width: "1728", height: "1080" });
  const width = Number(dimensions.width);
  const height = Number(dimensions.height);
  const validWidth = isResolutionDimension(width);
  const validHeight = isResolutionDimension(height, "height") && height <= MAX_PRESET_HEIGHT;
  // Keep the results stable while the user types an incomplete size.
  const [lastValid, setLastValid] = useState(DEFAULT_SIZE);
  const activeWidth = validWidth && validHeight ? width : lastValid.width;
  const activeHeight = validWidth && validHeight ? height : lastValid.height;
  function setSize(value: typeof dimensions) {
    setDimensions(value);
    const width = Number(value.width);
    const height = Number(value.height);
    if (isResolutionDimension(width) && isResolutionDimension(height, "height") && height <= MAX_PRESET_HEIGHT) setLastValid({ width, height });
  }
  const target = useMemo<BuildResolution | undefined>(() => res === "1440x1080" ? { resolution: res }
    : res === "custom" ? { resolution: res, customResolution: { width: activeWidth, height: activeHeight } } : { resolution: res === "all" ? "1080p" : res },
  [res, activeWidth, activeHeight]);
  const views = useMemo(() => presets.map((p) => projectPreset(p, cardModes[p.id] ?? globalMode, target)), [presets, target, cardModes, globalMode]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [includeMyBuild, setIncludeMyBuild] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailPreset = views.find((p) => p.id === detailId);

  const myBuild =
    hydrated && state
      ? (state.builds.find((b) => b.id === state.activeBuildId) ?? state.builds[0] ?? null)
      : null;

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = views.filter((p) => {
      if (res !== "all" && res !== "custom" && res !== "1440x1080" && p.resolution !== res) return false;
      if (onlyFavorites && !favorites.includes(p.slug)) return false;
      if (tier !== "all" && p.tier !== tier) return false;
      if (minFps === "90" && p.fpsOfficial[1] < 90) return false;
      if (minFps === "115" && p.fpsOfficial[0] < 115) return false;
      if (tokens.length > 0) {
        const hay = `${p.title} ${p.cpu} ${p.gpu} ${p.ram} ${p.storage} ${p.resolution} ${p.badge} ${PRESET_TIER_LABEL[p.tier]}`.toLowerCase();
        if (!tokens.every((t) => hay.includes(t))) return false;
      }
      return true;
    });

    if (sort === "featured") {
      // Keep the original references at the top, with the featured card first.
      list.sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    } else if (sort === "modded-desc") {
      list.sort((a, b) => midFps(b.fpsModded) - midFps(a.fpsModded));
    } else if (sort === "official-desc") {
      list.sort((a, b) => midFps(b.fpsOfficial) - midFps(a.fpsOfficial));
    } else if (sort === "low1-desc") {
      list.sort((a, b) => b.low1Official - a.low1Official);
    } else if (sort === "score-desc") {
      list.sort((a, b) => b.score10 - a.score10);
    } else if (sort === "price-asc") {
      list.sort(byPrice);
    }
    return list;
  }, [views, query, res, tier, minFps, sort, onlyFavorites, favorites]);

  const comparedPresets = useMemo(
    () =>
      compareIds
        .map((id) => views.find((p) => p.id === id))
        .filter((p): p is PresetView => Boolean(p)),
    [compareIds, views],
  );

  async function copyPresetCfg(p: PresetView) {
    try {
      // Copy valid cfg lines only; the test conditions and Steam options are in Details.
      await navigator.clipboard.writeText(p.cfgText);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId((curr) => (curr === p.id ? null : curr)), 1800);
      toast({
        title: "Настройки скопированы",
        description: "При закрытом Rust сохраните копию cfg\\client.cfg, затем замените только эти строки.",
        tone: "success",
      });
    } catch {
      setDetailId(p.id);
      toast({
        title: "Открыто окно настроек",
        description: "Скопируйте блок client.cfg вручную.",
        tone: "info",
      });
    }
  }

  function openComparison(id?: string) {
    if (id && !compareIds.includes(id)) {
      if (compareIds.length >= 3) toast({ title: "Максимум 3 пресета", description: "Заменили первый выбранный пресет.", tone: "info" });
      setCompareIds([...compareIds.slice(-2), id]);
    }
    setCompareOpen(true);
  }

  function resetFilters() {
    setQuery("");
    setRes("all");
    setTier("all");
    setMinFps("all");
    setSort("featured");
    setOnlyFavorites(false);
  }

  const basePreset = comparedPresets[0];

  return (
    <div className="space-y-6">
      {/* Панель поиска, фильтров и сортировки (1 blur-слой страницы) */}
      <section
        className="glass glass-blur relative space-y-4 p-4 sm:p-5"
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
          <LiquidSelect
            label="Класс сборки"
            hideLabel
            options={TIER_OPTIONS}
            value={tier}
            onChange={setTier}
          />
          <LiquidSelect
            label={`Фильтр FPS · ${PRESET_SERVER.official}`}
            hideLabel
            options={MIN_FPS_OPTIONS}
            value={minFps}
            onChange={setMinFps}
          />
          <LiquidSelect
            label="Сортировка пресетов"
            hideLabel
            options={SORT_OPTIONS}
            value={sort}
            onChange={setSort}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            ariaLabel="Фильтр по разрешению"
            value={res}
            onChange={setRes}
            options={[
              { value: "all", label: `Все · ${presets.length}` },
              ...RESOLUTIONS.map((value) => ({
                value,
                label: `${resolutionLabel(value)} · ${presets.filter((p) => p.resolution === value).length}`,
              })),
              { value: "1440x1080", label: "4:3" },
              { value: "custom", label: "Своё" },
            ]}
          />
          <p className="text-sm text-ink-3" aria-live="polite">
            Показано: <strong className="text-ink">{filtered.length}</strong>{" "}
            {plural(filtered.length, ["пресет", "пресета", "пресетов"])}
          </p>
        </div>
        <OriginDisclosure open={res === "custom"}><div className="well grid gap-3 p-3 sm:grid-cols-[minmax(0,300px)_1fr] sm:items-center">
          <div className="grid grid-cols-2 gap-2">
            <Input label="Ширина, px" type="number" min={800} max={7680} step={1} value={dimensions.width}
              onChange={(e) => setSize({ ...dimensions, width: e.target.value })} error={!validWidth ? "800–7680 px" : undefined} />
            <Input label="Высота, px" type="number" min={600} max={4320} step={1} value={dimensions.height}
              onChange={(e) => setSize({ ...dimensions, height: e.target.value })} error={!validHeight ? "600–4320 px" : undefined} />
          </div>
          <Segmented value={`${width}x${height}`} onChange={(value) => {
            const [width, height] = value.split("x"); setSize({ width, height });
          }} options={QUICK_SIZES.map(([w,h]) => ({ value: `${w}x${h}`, label: `${w}×${h}` }))} ariaLabel="Быстрые разрешения" />
        </div></OriginDisclosure>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="rf-page-content"><h2 className="font-bold">Графика всех сборок</h2><p className="text-xs text-ink-3">{getGraphicsProfile(globalMode)?.short} · режим можно изменить у отдельной карточки.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {(globalMode !== "competitive" || Object.keys(cardModes).length > 0) && <button type="button" className="link text-xs" onClick={() => { setGlobalMode("competitive"); setCardModes({}); }}>Сбросить графику</button>}
            {(favorites.length > 0 || onlyFavorites) && <Button variant="ghost" size="sm" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}>Избранные</Button>}
            <Button variant="secondary" size="sm" onClick={() => openComparison()} aria-haspopup="dialog"><GitCompareArrows aria-hidden="true" /> Сравнение · {compareIds.length}</Button>
          </div>
        </div>
        <GraphicsPicker value={globalMode} onChange={(value) => { setGlobalMode(value); setCardModes({}); }} label="Графика всех пресетов" />
        <p className="text-xs leading-relaxed text-ink-3">
          По умолчанию расчёт для 1080p и «Комбат». Фильтр 1440p/4K показывает сборки этого класса и пересчитывает нагрузку. FPS и 1% low рассчитаны по той же модели, что и в «Сборке».
          Время кадра ≈ 1000 / середина диапазона FPS. Это оценки, без генерации кадров.
        </p>
      </section>

      {/* Карточки пресетов */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
          title="Подходящих пресетов не найдено"
          hint="Сбросьте фильтр или рассчитайте свою точную конфигурацию в разделе «Сборка»."
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
                id={`preset-${p.slug}`}
                style={{ scrollMarginTop: "7rem" }}
                className={`glass glass-hover liquid-glass-card preset-card flex h-full flex-col p-4 sm:p-6 ${
                  p.featured ? "glass-accent" : ""
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="accent">{classLabel(p)}</Badge>
                    <Badge>{p.resolutionLabel}</Badge>
                    <Badge tone="accent">{p.purpose}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FavoriteButton kind="preset" slug={p.slug} title={p.title} active={favorites.includes(p.slug)} />
                  </div>
                </div>

                <h2 className="mt-3.5 text-xl font-bold tracking-tight text-ink">{p.title}</h2>

                {/* Комплектующие */}
                <dl className="mt-3 grid gap-1.5 text-[13px] text-ink-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5 flex-none text-accent-hi" aria-hidden="true" />
                    <dt className="sr-only">Процессор</dt>
                    <dd className="min-w-0">{p.cpu}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3.5 w-3.5 flex-none text-accent-hi" aria-hidden="true" />
                    <dt className="sr-only">Видеокарта</dt>
                    <dd className="min-w-0">{p.gpu}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <MemoryStick className="h-3.5 w-3.5 flex-none text-accent-hi" aria-hidden="true" />
                    <dt className="sr-only">Память</dt>
                    <dd className="min-w-0">{p.ram}</dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-3.5 w-3.5 flex-none text-accent-hi" aria-hidden="true" />
                    <dt className="sr-only">Накопитель</dt>
                    <dd className="min-w-0">{p.storage}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {SERVERS.map((server) => (
                    <div className="well p-3.5" key={server.label}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-[11.5px] font-bold tracking-wider ${server.tone}`}>
                          {server.label}
                        </span>
                        <span className="text-[11.5px] tabular-nums text-ink-3" title="Время кадра">
                          <span className="sr-only">Время кадра: </span><AnimatedNumber value={p[server.ms]} digits={1} /> мс
                        </span>
                      </div>
                      <p className="mt-1 font-display text-2xl font-extrabold tabular-nums tracking-tight text-accent-hi">
                        <AnimatedNumber value={p[server.range][0]} />–<AnimatedNumber value={p[server.range][1]} />{" "}
                        <span className="font-sans text-[12.5px] font-semibold text-ink-3">FPS</span>
                      </p>
                      <Meter
                        percent={Math.min(100, (p[server.range][1] / 240) * 100)}
                        fromColor="#e05a2b"
                        toColor="#ffc38b"
                        className="mt-2"
                      />
                      <p className="mt-1.5 text-[12px] text-ink-2">
                        1% low: <strong className="font-display tabular-nums text-accent-hi"><AnimatedNumber value={p[server.low]} /></strong> FPS
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-3.5">
                  <GraphicsPicker value={p.mode} label={`Графика: ${p.title}`} onChange={(value) => setCardModes((previous) => ({ ...previous, [p.id]: value }))} />
                </div>
                {/* Ключевые настройки */}
                <div className="mt-3.5 flex flex-wrap gap-1.5 text-[12px]">
                  <Badge className="chip-command">Draw {p.settings.drawDistance}</Badge>
                  <Badge className="chip-command">Shader {p.settings.shaderLevel}</Badge>
                  <Badge className="chip-command">Water {p.settings.waterQuality}</Badge>
                  <Badge className="chip-command">gc.buffer {p.settings.gcBuffer}</Badge>
                </div>

                <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{p.bottleneckNote}</p>
                <p className="mt-1 text-[11.5px] text-ink-3">
                  {"Сценарий оценки: "}{p.testScene}
                </p>

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
                  <Button variant="secondary" size="sm" onClick={() => setDetailId(p.id)} aria-haspopup="dialog">
                    <Eye aria-hidden="true" />
                    Детали
                  </Button>
                  <Button
                    variant={inCompare ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => openComparison(p.id)}
                    aria-haspopup="dialog"
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

      <Modal open={compareOpen} onClose={() => setCompareOpen(false)} title="Сравнение конфигураций"
        description="До трёх пресетов. Таблица учитывает выбранную графику и разрешение." maxWidth="max-w-5xl">
        <div className="mb-4 flex flex-wrap justify-end gap-2">
          {myBuild && <Button size="sm" variant="secondary" aria-pressed={includeMyBuild} onClick={() => setIncludeMyBuild(!includeMyBuild)}>{includeMyBuild ? "Скрыть мою сборку" : "+ Моя сборка"}</Button>}
          {compareIds.length > 0 && <Button size="sm" variant="ghost" onClick={() => setCompareIds([])}>Очистить пресеты</Button>}
        </div>
        {(compareIds.length > 0 || includeMyBuild && myBuild) ? <>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Таблица сравнения">
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
                          onClick={() => setCompareIds(compareIds.filter((id) => id !== p.id))}
                          aria-label={`Убрать «${p.title}» из сравнения`}
                          className="grid h-6 w-6 flex-none place-items-center rounded-full bg-white/10 text-ink-3 hover:text-white"
                        >
                          <X className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <span className="mt-0.5 block text-[11px] font-normal text-ink-3">{PRESET_FPS_SOURCE_LABEL[p.fpsSource]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8 text-[13.5px]">
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">Класс · Разрешение</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 font-bold tabular-nums">
                      Моя сборка · {formatBuildResolution(myBuild.input)}
                    </td>
                  )}
                  {comparedPresets.map((p) => (
                    <td key={p.id} className="py-2.5 px-3 font-bold tabular-nums">
                      {classLabel(p)} · {p.resolutionLabel}
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
                {SERVERS.map((server) => (
                  <tr key={server.label}>
                    <th scope="row" className={`py-2.5 pr-4 text-[12.5px] font-semibold ${server.tone}`}>
                      {server.label}
                    </th>
                    {includeMyBuild && myBuild && (
                      <td className="py-2.5 px-3 tabular-nums">
                        <strong className={server.tone}><span className="font-display">{myBuild[server.range][0]}–{myBuild[server.range][1]}</span> FPS</strong>
                        <span className="mt-0.5 block text-[12px] text-ink-3">{myBuild[server.range][0] > 0 ? `~${(2000 / (myBuild[server.range][0] + myBuild[server.range][1])).toFixed(1)} мс` : "—"} · оценка</span>
                      </td>
                    )}
                    {comparedPresets.map((p, idx) => {
                      const base = basePreset ? midFps(basePreset[server.range]) : 0;
                      const diff = base && idx > 0 ? Math.round(100 * (midFps(p[server.range]) / base - 1)) : null;
                      return (
                        <td key={p.id} className="py-2.5 px-3 tabular-nums">
                          <strong><span className="font-display"><AnimatedNumber value={p[server.range][0]} />–<AnimatedNumber value={p[server.range][1]} /></span> FPS</strong>
                          {diff !== null && (
                            <span className={`ml-1.5 text-[12px] ${diff > 0 ? "text-ok" : diff < 0 ? "text-danger" : "text-ink-3"}`}>
                              ({diff > 0 ? `+${diff}` : diff}%)
                            </span>
                          )}
                          <span className="mt-0.5 block text-[12px] text-ink-2">1% low <span className="font-display"><AnimatedNumber value={p[server.low]} /></span> FPS · <AnimatedNumber value={p[server.ms]} digits={1} /> мс</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="py-2.5 pr-4 text-ink-3">Графика / gc.buffer</td>
                  {includeMyBuild && myBuild && (
                    <td className="py-2.5 px-3 text-ink-2">
                      gc.buffer {myBuild.input.ramGb >= 32 ? 4096 : myBuild.input.ramGb >= 16 ? 2048 : 1024}
                    </td>
                  )}
                  {comparedPresets.map((p) => (
                    <td key={p.id} className="py-2.5 px-3 text-ink-2">
                      Draw {p.settings.drawDistance} · Shader {p.settings.shaderLevel} · Water {p.settings.waterQuality} · gc.buffer {p.settings.gcBuffer}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4"><PresetRadar presets={comparedPresets} myBuild={includeMyBuild ? myBuild : null} /></div>
        </> : <p className="well p-4 text-sm text-ink-2">Нажмите «Сравнить» на карточке нужной сборки. Затем добавьте ещё одну или две.</p>}
      </Modal>

      {/* Модальное окно полных настроек пресета */}
      <Modal
        open={Boolean(detailPreset)}
        onClose={() => setDetailId(null)}
        title={detailPreset ? `${detailPreset.title} (${detailPreset.resolutionLabel})` : ""}
        description={detailPreset ? `${PRESET_FPS_SOURCE_LABEL[detailPreset.fpsSource]}. ${detailPreset.testScene}` : undefined}
        maxWidth="max-w-2xl"
      >
        {detailPreset && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVERS.map((server) => <div className="well p-3" key={server.label}>
                <p className="text-xs font-bold text-accent-hi">{server.label}</p>
                <strong className="text-accent-hi"><span className="font-display tabular-nums text-accent-hi"><AnimatedNumber value={detailPreset[server.range][0]} />–<AnimatedNumber value={detailPreset[server.range][1]} /></span> FPS</strong>
                <p className="text-xs text-ink-2">1% low <span className="font-display tabular-nums text-accent-hi"><AnimatedNumber value={detailPreset[server.low]} /></span> FPS · <AnimatedNumber value={detailPreset[server.ms]} digits={1} /> мс</p>
              </div>)}
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-[13px] sm:grid-cols-3">
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Graphics Quality</span>
                <strong className="text-ink">{detailPreset.settings.graphicsQuality}</strong>
              </div>
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Draw / Тени</span>
                <strong className="text-ink">
                  {detailPreset.settings.drawDistance} · Quality {detailPreset.settings.shadowQuality}
                </strong>
              </div>
              <div className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Shader / Water</span>
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
              title={`client.cfg · ${detailPreset.slug}`}
              content={detailPreset.cfgText}
              note={`Сохраните копию cfg\\client.cfg и замените только эти команды при закрытом Rust. Разрешение и качество текстур выберите в игре. Параметры запуска Steam: ${detailPreset.launchOptions}`}
            />

            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-3">Ключевые твики в этом конфиге:</p>
              <div className="flex flex-wrap gap-1.5">
                {detailPreset.keyTweaks.map((slug) => (
                  <Link
                    key={slug}
                    href={tweakerHref(slug)}
                    className="chip hover:bg-white/16 hover:text-white"
                    onNavigate={() => setDetailId(null)}
                  >
                    {tweakTitles[slug] ?? slug}
                  </Link>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2.5 pt-2">
              <Link
                href={presetCalculatorHref(detailPreset)}
                className="btn btn-sm"
                onNavigate={() => setDetailId(null)}
              >
                Открыть в разделе «Сборка»
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
