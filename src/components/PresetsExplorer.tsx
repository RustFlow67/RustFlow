"use client";

import LiquidGlass from "@/components/LiquidGlass";
import {
  ArrowRight,
  Download,
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
import { startTransition, useEffect,useLayoutEffect,useRef, useMemo, useState } from "react";
import AdaptiveActions from "./AdaptiveActions";
import { IS_DESKTOP_APP } from "@/lib/config";
import CodeBlock from "@/components/CodeBlock";
import { PresetRadar } from "@/components/addons/BuildRadar";
import LiquidSelect from "@/components/LiquidSelect";
import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import OriginDisclosure from "@/components/fx/OriginDisclosure";
import GraphicsPicker from "@/components/GraphicsPicker";
import { FavoriteButton, useFavorites } from "@/components/addons/Favorites";
import Segmented from "@/components/Segmented";
import { Badge, Button, EmptyState, Input, Meter } from "@/components/ui";
import { usePopupState } from "@/components/fx/usePopupMotion";
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
import { consumePreset } from "./fx/presetHandoff";
import BoundedNumber from "./ui/BoundedNumber";
import { usePopularity } from "./catalog/usePopularity";
import { hardwareDistance, matches, tokens } from "@/lib/catalog/ranking";
import { useSystemPlan } from "./catalog/SystemPlan";
import { gcBudget } from "@/lib/models/play-settings";
import { formatBuildResolution, type BuildResolution } from "@/lib/models/build-resolution";
import { presetCalculatorHref, projectPreset, type PresetView } from "@/lib/models/preset-projection";
import { getGraphicsProfile, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { tweakerHref } from "@/lib/tweaker";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { plural } from "@/lib/tweaks/meta";

type ResFilter = "all" | PresetResolution | "1440x1080" | "custom";
type TierFilter = "all" | PresetTier;
type MinFpsFilter = "all" | "90" | "115";
type PresetSort = "popular" | "match" | "favorite" | "modded-desc" | "official-desc" | "low1-desc" | "price-asc" | "score-desc";

const SORT_OPTIONS = [
  { value: "popular", label: "Сначала популярные у игроков" },
  { value: "match", label: "Лучше всего под мою сборку" },
  { value: "favorite", label: "Сначала избранные" },
  { value: "modded-desc", label: "По максимальному FPS" },
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

// Web: download the displayed cfg without clipboard permission or a Blob URL.
function CfgDownload({preset}:{preset:PresetView}) {
  return <AdaptiveActions action={{kind:"cfg",cfg:preset.cfgText}}><a className="btn btn-sm btn-primary" download="client.cfg" href={`data:text/plain;charset=utf-8,${encodeURIComponent(preset.cfgText + "\n")}`}>
    <Download aria-hidden="true"/> Скачать client.cfg</a></AdaptiveActions>;
}

const SERVERS = [
  { label: PRESET_SERVER.modded, range: "fpsModded", low: "low1Modded", ms: "frametimeModdedMs", tone: "text-accent-hi" },
  { label: PRESET_SERVER.official, range: "fpsOfficial", low: "low1Official", ms: "frametimeOfficialMs", tone: "text-accent-hi" },
] as const;

/** Keep complete HTML on direct visits. On dock navigation, mount the first
 * cards immediately and fill the offscreen controls in interruptible batches. */
function useCardBudget(total: number, hydrated: boolean) {
  const [count, setCount] = useState(() => !hydrated || window.location.hash ? total : 4);
  useEffect(() => {
    if (count >= total) return;
    const more = () => startTransition(() => setCount(n => Math.min(total, n + 12)));
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(more, { timeout: 160 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(more, 16);
    return () => window.clearTimeout(id);
  }, [count, total]);
  return count;
}

export default function PresetsExplorer({
  presets,
  tweakTitles, initial,
}: {
  initial?:string; presets: HardwarePreset[];
  tweakTitles: Record<string, string>;
}) {
  const { state, hydrated } = useRustFlowStore();
  const cardBudget = useCardBudget(presets.length, hydrated);
  const { toast } = useToast();

  const [query, setQuery] = useState("");
  const [res, setRes] = useState<ResFilter>(presets.find(p=>p.id===initial)?.resolution??"all");
  const [tier, setTier] = useState<TierFilter>("all");
  const [minFps, setMinFps] = useState<MinFpsFilter>("all");
  const [sort, setSort] = useState<PresetSort>("popular");
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { preset: favorites } = useFavorites();

  const [globalMode, setGlobalMode] = useState<GraphicsProfileId>("competitive");
  const [cardModes, setCardModes] = useState<Record<string, GraphicsProfileId>>({});
  const [dimensions, setDimensions] = useState(DEFAULT_SIZE);
  const {width,height}=dimensions;
  const target = useMemo<BuildResolution>(()=>res==="custom"?{resolution:res,customResolution:dimensions}:{resolution:res==="all"?"1080p":res},[res,dimensions]);
  const views = useMemo(() => presets.map((p) => projectPreset(p, cardModes[p.id] ?? globalMode, target)), [presets, target, cardModes, globalMode]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [includeMyBuild, setIncludeMyBuild] = useState(false);
  const comparison = usePopupState<true>();
  const detail=usePopupState<string>();
  const {show:showDetail}=detail;
  const {counts,record,source}=usePopularity("presets", sort==="popular");
  const opened=useRef(false);
  useLayoutEffect(()=>{
    if(!initial||opened.current)return;
    const p=presets.find(p=>p.id===initial);if(!p)return;
    const tile=document.getElementById(`preset-${p.slug}`), tap=consumePreset(p.slug);
    if(!tile)return;opened.current=true;
    const button=tile.querySelector<HTMLElement>("button[aria-haspopup='dialog']")??tile;
    showDetail(p.id,button,tap?{node:button,rect:tap.rect,radius:tap.radius}:undefined);
    if(tap)record(p.slug);
  },[initial,presets,showDetail,record]);
  useEffect(()=>{const open=(e:Event)=>{const {slug,from}=(e as CustomEvent).detail??{};const p=presets.find(p=>p.slug===slug);if(p){setRes(p.resolution);showDetail(p.id,from instanceof HTMLElement?from:null);record(p.slug);}};
    window.addEventListener("rustflow:matched-preset",open);return ()=>window.removeEventListener("rustflow:matched-preset",open);},[presets,showDetail,record]);
  const detailPreset = views.find((p) => p.id === detail.value);

  const myBuild =
    hydrated && state
      ? (state.builds.find((b) => b.id === state.activeBuildId) ?? state.builds[0] ?? null)
      : null;

  const {plan}=useSystemPlan();
  const rig=plan?.input;
  const filtered = useMemo(() => {
    const words=tokens(query);
    const list = views.filter((p) => {
      if (res !== "all" && res !== "custom" && res !== "1440x1080" && p.resolution !== res) return false;
      if (onlyFavorites && !favorites.includes(p.slug)) return false;
      if (tier !== "all" && p.tier !== tier) return false;
      if (minFps === "90" && p.fpsOfficial[1] < 90) return false;
      if (minFps === "115" && p.fpsOfficial[0] < 115) return false;
      if (words.length > 0) {
        const hay = `${p.title} ${p.cpu} ${p.gpu} ${p.ram} ${p.storage} ${p.resolution} ${p.badge} ${PRESET_TIER_LABEL[p.tier]}`.toLowerCase();
        if (!matches(words,hay)) return false;
      }
      return true;
    });

    if (sort === "popular" || sort === "favorite" || sort === "match") {
      list.sort((a,b)=>(sort === "match" && rig ? hardwareDistance(a,rig)-hardwareDistance(b,rig) : sort === "favorite" ? Number(favorites.includes(b.slug))-Number(favorites.includes(a.slug)) : 0)
        || (counts[b.slug]??0)-(counts[a.slug]??0) || Number(Boolean(b.featured))-Number(Boolean(a.featured)));
    } else if (sort === "modded-desc") {
      list.sort((a, b) => b.fpsModded[1] - a.fpsModded[1] || midFps(b.fpsModded) - midFps(a.fpsModded));
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
  }, [views, query, res, tier, minFps, sort, onlyFavorites, favorites, counts, rig]);

  const comparedPresets = useMemo(
    () =>
      compareIds
        .map((id) => views.find((p) => p.id === id))
        .filter((p): p is PresetView => Boolean(p)),
    [compareIds, views],
  );

  function openComparison(from: HTMLElement, id?: string) {
    if (id && !compareIds.includes(id)) {
      if (compareIds.length >= 3) toast({ title: "Максимум 3 пресета", description: "Заменили первый выбранный пресет.", tone: "info" });
      setCompareIds([...compareIds.slice(-2), id]);
    }
    comparison.show(true, from);
  }

  function resetFilters() {
    setQuery("");
    setRes("all");
    setTier("all");
    setMinFps("all");
    setSort("popular");
    setOnlyFavorites(false);
  }

  const basePreset = comparedPresets[0];

  return (
    <div className="space-y-6">
      {/* Панель поиска, фильтров и сортировки (1 blur-слой страницы) */}
      <LiquidGlass as="section"
        className="glass glass-blur relative space-y-4 p-4 sm:p-5"
        id="preset-library" aria-label="Поиск, фильтры и сортировка пресетов"
      >
        <div className="preset-filters">
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
          <LiquidSelect label="Сортировка пресетов" hideLabel options={SORT_OPTIONS} value={sort} onChange={setSort}/>
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
        </div>

        <p className="catalog-hint">{sort === "popular" ? source : sort === "match" ? rig ? `Сходство с «${rig.name}»: производительность CPU/GPU и объём RAM.` : "Сначала сохраните сборку в калькуляторе. Пока показываем популярные." : sort === "modded-desc" ? "По верхней границе оценки среднего FPS на MODDED 2X при выбранных настройках." : null}</p>
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
        <OriginDisclosure open={res === "custom"}><LiquidGlass className="well grid gap-3 p-3 sm:grid-cols-[minmax(0,300px)_1fr] sm:items-center">
          <div className="grid grid-cols-2 gap-2">
            <BoundedNumber label="Ширина, px" min={800} max={7680} value={width} onValue={width=>setDimensions({...dimensions,width:Number(width)})}/>
            <BoundedNumber label="Высота, px" min={600} max={4320} value={height} onValue={height=>setDimensions({...dimensions,height:Number(height)})}/>
          </div>
          <Segmented value={`${width}x${height}`} onChange={(value) => {
            const [width, height] = value.split("x"); setDimensions({ width:Number(width), height:Number(height) });
          }} options={QUICK_SIZES.map(([w,h]) => ({ value: `${w}x${h}`, label: `${w}×${h}` }))} ariaLabel="Быстрые разрешения" />
        </LiquidGlass></OriginDisclosure>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="rf-page-content"><h2 className="font-bold">Графика всех сборок</h2><p className="text-xs text-ink-3">{getGraphicsProfile(globalMode)?.short} · режим можно изменить у отдельной карточки.</p></div>
          <div className="flex flex-wrap items-center gap-2">
            {(globalMode !== "competitive" || Object.keys(cardModes).length > 0) && <button type="button" className="link text-xs" onClick={() => { setGlobalMode("competitive"); setCardModes({}); }}>Сбросить графику</button>}
            {(favorites.length > 0 || onlyFavorites) && <Button variant="ghost" size="sm" aria-pressed={onlyFavorites} onClick={() => setOnlyFavorites(!onlyFavorites)}>Избранные</Button>}
            <Button variant="secondary" size="sm" onClick={e => openComparison(e.currentTarget)} aria-haspopup="dialog"><GitCompareArrows aria-hidden="true" /> Сравнение · {compareIds.length}</Button>
          </div>
        </div>
        <GraphicsPicker value={globalMode} onChange={(value) => { setGlobalMode(value); setCardModes({}); }} label="Графика всех пресетов" />
        <p className="text-xs leading-relaxed text-ink-3">
          Начните с 1080p и «Комбат» или выберите своё разрешение. 1% low показывает скорость в самых медленных кадрах: сравнивайте его, если в бою заметны рывки. Все показатели — расчёт, а не замер.
        </p>
      </LiquidGlass>

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
          {filtered.map((p, index) => {
            if (index >= cardBudget && p.id !== initial) return <LiquidGlass as="article" key={p.id} id={`preset-${p.slug}`} aria-busy="true" className="glass preset-card preset-preview p-4 sm:p-6">
              <h2 className="text-xl font-bold">{p.title}</h2><p className="mt-3 text-sm text-ink-2">{p.cpu} · {p.gpu}</p>
            </LiquidGlass>;
            const inCompare = compareIds.includes(p.id);
            return (
              <LiquidGlass as="article"
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
                    {plan?.best.slug===p.slug && <Badge tone="safe">Рекомендовано для вашей системы</Badge>}
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
                    <LiquidGlass className="well p-3.5" key={server.label}>
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
                        className="mt-2"
                      />
                      <p className="mt-1.5 text-[12px] text-ink-2">
                        1% low: <strong className="font-display tabular-nums text-accent-hi"><AnimatedNumber value={p[server.low]} /></strong> FPS
                      </p>
                    </LiquidGlass>
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
                  <CfgDownload preset={p}/>
                  <Button island variant="secondary" size="sm" onClick={e => {detail.show(p.id,e.currentTarget);record(p.slug);}} aria-haspopup="dialog">
                    <Eye aria-hidden="true" />
                    Детали
                  </Button>
                  <Button
                    variant={inCompare ? "secondary" : "ghost"}
                    size="sm"
                    onClick={e => openComparison(e.currentTarget, p.id)}
                    aria-haspopup="dialog"
                    style={
                      inCompare
                        ? { boxShadow: "var(--lg-bevel), 0 0 8px -4px var(--theme-glow)" }
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
              </LiquidGlass>
            );
          })}
        </div>
      )}

      <Modal open={comparison.isOpen} closing={comparison.closing} onClose={comparison.dismiss} onExited={comparison.finish} source={comparison.source} returnFocus={comparison.opener} title="Сравнение конфигураций"
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
                      gc.buffer {gcBudget(myBuild.input.ramGb, myBuild.input).mb}
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
        </> : <LiquidGlass as="p" className="well p-4 text-sm text-ink-2">Нажмите «Сравнить» на карточке нужной сборки. Затем добавьте ещё одну или две.</LiquidGlass>}
      </Modal>

      {/* Модальное окно полных настроек пресета */}
      <Modal
        open={detail.isOpen} closing={detail.closing} source={detail.source} returnFocus={detail.opener}
        onClose={detail.dismiss} onExited={detail.finish}
        title={detailPreset ? `${detailPreset.title} (${detailPreset.resolutionLabel})` : ""}
        description={detailPreset ? `${PRESET_FPS_SOURCE_LABEL[detailPreset.fpsSource]}. ${detailPreset.testScene}` : undefined}
        maxWidth="max-w-2xl"
      >
        {detailPreset && (
          <div className="space-y-4">
            {plan?.best.slug===detailPreset.slug && <Badge tone="safe">Рекомендовано для вашей системы</Badge>}
            <div className="grid gap-2 sm:grid-cols-2">
              {SERVERS.map((server) => <LiquidGlass className="well p-3" key={server.label}>
                <p className="text-xs font-bold text-accent-hi">{server.label}</p>
                <strong className="text-accent-hi"><span className="font-display tabular-nums text-accent-hi"><AnimatedNumber value={detailPreset[server.range][0]} />–<AnimatedNumber value={detailPreset[server.range][1]} /></span> FPS</strong>
                <p className="text-xs text-ink-2">1% low <span className="font-display tabular-nums text-accent-hi"><AnimatedNumber value={detailPreset[server.low]} /></span> FPS · <AnimatedNumber value={detailPreset[server.ms]} digits={1} /> мс</p>
              </LiquidGlass>)}
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-[13px] sm:grid-cols-3">
              <LiquidGlass className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Graphics Quality</span>
                <strong className="text-ink">{detailPreset.settings.graphicsQuality}</strong>
              </LiquidGlass>
              <LiquidGlass className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Draw / Тени</span>
                <strong className="text-ink">
                  {detailPreset.settings.drawDistance} · Quality {detailPreset.settings.shadowQuality}
                </strong>
              </LiquidGlass>
              <LiquidGlass className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Shader / Water</span>
                <strong className="text-ink">
                  {detailPreset.settings.shaderLevel} · Water {detailPreset.settings.waterQuality}
                </strong>
              </LiquidGlass>
              <LiquidGlass className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Апскейлер / AA</span>
                <strong className="text-ink">{detailPreset.settings.upscaler}</strong>
              </LiquidGlass>
              <LiquidGlass className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">Низкая задержка</span>
                <strong className="text-ink">{detailPreset.settings.reflexOrAntiLag}</strong>
              </LiquidGlass>
              <LiquidGlass className="tile p-3">
                <span className="block text-[11.5px] text-ink-3">gc.buffer / Gibs</span>
                <strong className="text-ink">
                  {detailPreset.settings.gcBuffer} · Gibs {detailPreset.settings.maxGibs}
                </strong>
              </LiquidGlass>
            </div>

            <LiquidGlass as="p" className="well p-3.5 text-[13px] leading-relaxed text-ink-2">
              <strong className="text-ink">Драйвер и BIOS:</strong> {detailPreset.driverNote}
            </LiquidGlass>

            <CodeBlock
              title={`client.cfg · ${detailPreset.slug}`}
              content={detailPreset.cfgText}
              copyable={!IS_DESKTOP_APP}
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
                    onNavigate={detail.dismiss}
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
                onNavigate={detail.dismiss}
              >
                Открыть в разделе «Сборка»
                <ArrowRight aria-hidden="true" />
              </Link>
              <CfgDownload preset={detailPreset}/>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
