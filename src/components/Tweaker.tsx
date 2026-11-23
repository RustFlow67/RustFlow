"use client";
import LiquidGlass from "@/components/LiquidGlass";
import AdaptiveActions from "./AdaptiveActions";
import type { TweakPlan } from "@/services/systemBridge";
import { withHostWindows } from "@/lib/plan-windows";
import { IS_DESKTOP_APP } from "@/lib/config";
import { useDownload } from "./fx/useDownload";

import {
  Cable,
  Copy,
  Cpu,
  Download,
  Gamepad2,
  HardDrive,
  MonitorCog,
  MoveUpRight,
  Terminal,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { systemPlan } from "@/lib/catalog/system-plan";
import { useSystemPlan, PlanStrip, type MatchedPlan } from "./catalog/SystemPlan";
import SummaryButton from "./SummaryButton";
import { DockIntro } from "./DockIntro";
import PackageInsight from "./PackageInsight";
import { RESTART_LABEL } from "@/lib/tweaks/meta";
import type { BuildInput } from "@/lib/models/build";
import OriginDisclosure from "./fx/OriginDisclosure";
import AccordionBody from "./ui/AccordionBody";
import CatalogBar from "./catalog/CatalogBar";
import { matches, tokens, topPick, rankTweaks, TWEAK_SORTS, type TweakSort } from "@/lib/catalog/ranking";
import Segmented from "@/components/Segmented";
import GraphicsPicker from "@/components/GraphicsPicker";
import { FavoriteButton, useFavorites } from "@/components/addons/Favorites";
import Link from "@/components/RouteLink";
import { accountHeaders, useAccount } from "@/components/auth/AccountProvider";
import ProfileGate, { openPlayerProfile, ProfileLock } from "@/components/auth/ProfileGate";
import LiquidSelect from "@/components/LiquidSelect";
import { Button, Switch } from "@/components/ui";
import { usePopupState } from "@/components/fx/usePopupMotion";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { profileCfg, textureMipForVram, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { TWEAK_GROUPS, TWEAK_RISK_META, type TweakGroupId } from "@/lib/models/tweak";
import {
  fitsVendor,
  fitsWindows,
  isPackRam,
  isRecommendedTweak,
  isTweakerVendor,
  packEligible,
  packHref,
  type TweakerPreferences,
  type TweakerVendor,
} from "@/lib/tweaker";
import {
  getConnectionProfile,
  formatMonitorHz,
  tuningForBuild,
  isWindows,
  type ConfigTuning,
} from "@/lib/models/build-settings";
import { localAccount } from "@/lib/auth/local";
import { getGpu } from "@/lib/hardware";
import { useRustFlowStore } from "@/lib/storage/useStore";
import { gcBudget } from "@/lib/models/play-settings";
import type { TweakLite } from "@/lib/tweaks/types";

export type TweakerEntry = TweakLite & { revertSteps: string[]; warnings?: string[] };
const icons = {
  "cpu-windows": Cpu,
  gpu: MonitorCog,
  "ram-ssd": HardDrive,
  network: Cable,
  "rust-settings": Gamepad2,
  "launch-options": Terminal,
};

type TweakerProps = {
  auto?: BuildInput | "live" | null;
  inventory: TweakerEntry[];
  initialGroup: TweakGroupId | null;
  initialMode?: GraphicsProfileId;
  initialGpu: TweakerVendor | null;
  initialTweak?: string;
  personal?: { ram: number; vram: number; hdd: boolean } & ConfigTuning;
};

export default function Tweaker(props: TweakerProps) {
  const { session } = useAccount();
  const locked = Boolean(props.personal && !session?.user);
  const system = useSystemPlan();
  const seed = props.auto && props.auto !== "live" ? props.auto : null;
  const picked = useMemo(
    () => (seed ? systemPlan(withHostWindows(seed, system.hostWindows), seed.graphicsProfile ?? "competitive", system.index) : system.plan),
    [seed, system.index, system.plan, system.hostWindows],
  );
  const [revision, reset] = useState(0);
  useEffect(() => {
    const apply = () => {
      reset((v) => v + 1);
      document.getElementById("tweaker-profiles")?.scrollIntoView({ block: "center" });
    };
    window.addEventListener("rustflow:reapply-plan", apply);
    return () => window.removeEventListener("rustflow:reapply-plan", apply);
  }, []);
  const applied = props.auto ? picked : null;
  const personal = applied
    ? {
        ...tuningForBuild(applied.input),
        ram: applied.input.ramGb,
        vram: applied.vram,
        hdd: applied.input.storage === "hdd",
      }
    : locked
      ? undefined
      : props.personal;
  return (
    <TweakerForm
      {...props}
      key={`${revision}:${locked ? "general" : "requested"}`}
      personal={personal}
      plan={props.personal ? undefined : (picked ?? undefined)}
      preview={!!seed}
      notice={
        locked ? (
          <ProfileLock action="Подобрать конфиг под этот ПК" />
        ) : props.auto && !picked ? (
          "Сначала настройте сборку. Пока показан общий каталог."
        ) : null
      }
      initialMode={applied?.mode ?? (locked ? undefined : props.initialMode)}
      initialGpu={applied?.vendor ?? (locked ? null : props.initialGpu)}
    />
  );
}

function TweakerForm({
  inventory,
  initialGroup,
  initialMode,
  initialGpu,
  initialTweak,
  personal,
  plan,
  preview,
  notice,
}: TweakerProps & { plan?: MatchedPlan; preview: boolean; notice: React.ReactNode }) {
  const systemSlugs = plan?.slugs;
  const download = useDownload();
  const { toast } = useToast();
  const { session } = useAccount();
  const user = session?.user;
  const { tweak: favorites } = useFavorites();
  const { state, storage, hydrated } = useRustFlowStore();
  const saved = state?.builds.find((b) => b.id === state.activeBuildId) ?? state?.builds[0];
  const hardware = plan?.input ?? (personal ? undefined : (saved?.input ?? user?.build ?? undefined));
  const ram = personal?.ram ?? (isPackRam(hardware?.ramGb) ? hardware.ramGb : 16);
  const [osOverride, setOs] = useState<"auto" | "10" | "11">("auto");
  const { hostWindows } = useSystemPlan();
  const autoOs = personal?.windowsVersion ?? hardware?.windowsVersion ?? hostWindows;
  const systemOs = osOverride === "auto" ? autoOs : osOverride;
  const tuning: ConfigTuning = {
    ...(personal ?? (hardware ? tuningForBuild(hardware) : undefined)),
    windowsVersion: systemOs,
  };
  const connection = getConnectionProfile(tuning?.connection);
  const [local, setLocal] = useState<Partial<TweakerPreferences> | null>(null);
  const savedPrefs = local ?? state?.tweaker;
  const vendor = local?.gpu ?? initialGpu ?? savedPrefs?.gpu ?? null;
  const gpu = vendor ?? (hardware ? getGpu(hardware.gpuId)?.vendor : undefined) ?? "nvidia";
  const mode =
    local?.mode ??
    initialMode ??
    savedPrefs?.mode ??
    hardware?.graphicsProfile ??
    saved?.recommendedPreset ??
    "balanced";
  const selection = (personal ? local?.slugs : savedPrefs?.slugs) ?? null;
  function update(patch: Partial<TweakerPreferences>) {
    // In live/preview mode the rig remains authoritative until THIS field is
    // explicitly overridden. Editing one checkbox must not pin the old GPU.
    if (personal) {
      setLocal((prev) => ({ ...{ gpu: null, slugs: null }, ...prev, ...patch }));
      return;
    }
    const next = { gpu: vendor, mode, slugs: selection, ...patch };
    if (!hydrated || initialMode || initialGpu) setLocal(next);
    storage.updateTweaker(next);
  }
  const [onlyRecommended, setOnlyRecommended] = useState(Boolean(personal));
  const group = usePopupState<TweakGroupId>(initialGroup);
  const [expanded, setExpanded] = useState<string[]>(initialTweak ? [initialTweak] : []);
  const config = usePopupState<true>(),
    insight = usePopupState<true>();
  const [packing, setPacking] = useState(false);
  const eligible = inventory.filter(
    (t) => packEligible(t) && fitsVendor(t.slug, gpu) && fitsWindows(t, systemOs),
  );
  const recommended = eligible
    .filter((t) => {
      if (tuning.backgroundLoad === "stream" && t.slug === "game-mode-dvr") return false;
      if (systemSlugs) {
        if (t.slug === `windows-${systemOs}-graphics`) return true;
        if ((t.slug === "nvidia-panel" || t.slug === "amd-adrenalin") && plan?.vendor !== gpu) return true;
        return systemSlugs.includes(t.slug);
      }
      return (
        isRecommendedTweak(t, gpu) && (!personal || t.slug !== "pagefile-auto" || ram <= 16 || personal.hdd)
      );
    })
    .map((t) => t.slug);
  const chosen =
    selection === null ? recommended : eligible.filter((t) => selection.includes(t.slug)).map((t) => t.slug);
  const chosenSet = new Set(chosen);
  const category = TWEAK_GROUPS.find((g) => g.id === group.value);
  const baseVendor = hardware ? getGpu(hardware.gpuId)?.vendor : initialGpu;
  const vram =
    baseVendor === gpu ? (personal?.vram ?? (hardware ? getGpu(hardware.gpuId)?.vram : undefined)) : undefined;
  const mip = vram === undefined ? undefined : textureMipForVram(vram);
  const cfg = profileCfg(mode, ram, "", mip, tuning, gpu);

  const action: TweakPlan = { kind: "pack", cfg, slugs: chosen, mode, gpu, ram, vram, tuning };

  const [query, setQuery] = useState(""),
    [sort, setSort] = useState<TweakSort>("effective");
  const [innerQuery, setInnerQuery] = useState(""),
    [innerSort, setInnerSort] = useState<TweakSort>("effective");
  const [more, setMore] = useState(false);
  const visible = inventory.filter(
    (t) =>
      (!systemOs || fitsWindows(t, systemOs)) &&
      fitsVendor(t.slug, gpu) &&
      (!onlyRecommended || recommended.includes(t.slug) || (systemSlugs ? t.slug === "gc-buffer" : topPick(t))),
  );
  function find(q: string, order: TweakSort, scope?: TweakGroupId) {
    const words = tokens(q);
    return rankTweaks(
      visible.filter(
        (t) =>
          (!scope || scope === t.group) &&
          matches(
            words,
            `${t.title} ${t.slug} ${t.tagline} ${t.what} ${t.check} ${TWEAK_GROUPS.find((g) => g.id === t.group)?.title}`,
          ),
      ),
      order,
      favorites,
    );
  }
  const results = find(query, sort),
    scoped = category ? find(innerQuery, innerSort, category.id) : [];
  const browsing = Boolean(query.trim()) || sort !== "effective",
    full = more || browsing;
  const openGroup = (id: TweakGroupId, from: HTMLElement, slug?: string) => {
    setInnerQuery(query);
    setInnerSort(sort);
    setExpanded(slug ? [slug] : []);
    group.show(id, from);
  };
  const explain = (order: TweakSort) =>
    order === "fps"
      ? "Сначала — шаги с потенциалом для среднего FPS, если есть соответствующее узкое место. Это приоритет проверки, не проценты прироста. Плавность, отклик и свободная память не считаются приростом среднего FPS."
      : order === "safe"
        ? "Только штатные шаги с отметкой «Безопасно». Это фильтр каталога, а не гарантия античита."
        : undefined;
  const hint =
    explain(sort) ??
    "Приоритет — по пользе для FPS, плавности или отклика. Эффект зависит от ПК; сравните два прогона. Фильтры не меняют состав ZIP.";

  function toggle(slug: string) {
    update({ slugs: chosenSet.has(slug) ? chosen.filter((s) => s !== slug) : [...chosen, slug] });
  }

  function selectVendor(next: TweakerVendor) {
    if (next === gpu) return;
    const driver = next === "amd" ? "amd-adrenalin" : next === "nvidia" ? "nvidia-panel" : null;
    const hadDriver = selection?.some((slug) => slug === "amd-adrenalin" || slug === "nvidia-panel");
    update({
      gpu: next,
      slugs: selection
        ? [
            ...selection.filter((slug) => slug !== "amd-adrenalin" && slug !== "nvidia-panel"),
            ...(hadDriver && driver ? [driver] : []),
          ]
        : null,
    });
  }

  async function copyCfg(from: HTMLElement) {
    try {
      await navigator.clipboard.writeText(cfg);
      toast({
        title: "Скопировано в буфер",
        description: "Сохраните копию client.cfg перед изменением.",
        tone: "success",
      });
    } catch {
      config.show(true, from);
    }
  }

  async function downloadPack(opener: HTMLElement) {
    if (!user || packing) return;
    setPacking(true);
    try {
      let blob: Blob;
      if (user.kind === "local") {
        const { localPack } = await import("@/lib/local-pack");
        if (localAccount()?.id !== user.id) {
          openPlayerProfile(opener);
          return;
        }
        const zip = localPack({ slugs: chosen, mode, gpu, ram, vram, tuning });
        if (!zip) throw new Error("Проверьте выбранные твики.");
        blob = new Blob([new Uint8Array(zip)], { type: "application/zip" });
      } else {
        const endpoint = new URL(packHref(chosen, mode, gpu, ram, vram, tuning), location.href);
        if (endpoint.origin !== location.origin) throw new Error("Для скачивания нужен API на том же домене.");
        const response = await fetch(endpoint, {
          headers: accountHeaders(),
          credentials: "same-origin",
          cache: "no-store",
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        });
        if (response.status === 401) {
          openPlayerProfile(opener);
          return;
        }
        if (!response.ok || response.headers.get("content-type") !== "application/zip")
          throw new Error("Сервер не подготовил ZIP. Попробуйте ещё раз.");
        blob = await response.blob();
      }
      const name = `RustFlow-Pack-${mode}.zip`;
      if (download(blob, name))
        toast({ title: "Загрузка началась успешно!", description: name, tone: "success" });
    } catch (error) {
      toast({
        title: "Не удалось скачать ZIP",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setPacking(false);
    }
  }

  const discoveryItem = (t: TweakerEntry) => (
    <LiquidGlass as="button" island
      className="tile discovery-item"
      type="button"
      key={t.slug}
      aria-haspopup="dialog"
      onClick={(e) => openGroup(t.group, e.currentTarget, t.slug)}
    >
      <small>{TWEAK_GROUPS.find((g) => g.id === t.group)?.title}</small>
      <strong>{t.title}</strong>
      {systemSlugs && (recommended.includes(t.slug) || t.slug === "gc-buffer") && (
        <small>Рекомендовано для вашей системы</small>
      )}
      <span>
        {t.gainLabel} · {TWEAK_RISK_META[t.riskLevel].label} · {RESTART_LABEL[t.restart]}
      </span>
      {topPick(t) && <b className="rubric">ТОП выбор</b>}
    </LiquidGlass>
  );
  return (
    <>
      <DockIntro href="/tweaker">
        <div className="plan-actions mt-4">
          <a className="btn btn-primary" href="#pack-settings">
            Настроить пакет ↘
          </a>
          <SummaryButton show={from=>insight.show(true,from)}/>
        </div>
      </DockIntro>
      <PlanStrip preview={preview ? plan : undefined} />
      <Modal
        open={insight.isOpen}
        closing={insight.closing}
        onClose={insight.dismiss}
        onExited={insight.finish}
        source={insight.source}
        returnFocus={insight.opener}
        title="ИИ-сводка вашего пакета"
        maxWidth="max-w-2xl"
      >
        <PackageInsight
          entries={eligible.filter((t) => chosenSet.has(t.slug))}
          mode={mode}
          gpu={gpu}
          ram={ram}
          vram={vram}
          tuning={tuning}
          rig={hardware}
          cfg={cfg}
        >
          <AdaptiveActions action={action}>
            <Button
              variant="primary"
              className="summary-download"
              loading={packing}
              aria-haspopup={!user ? "dialog" : undefined}
              onClick={(e) => (user ? void downloadPack(e.currentTarget) : openPlayerProfile(e.currentTarget))}
            >
              <Download aria-hidden="true" /> Скачать готовый ZIP с откатом
            </Button>
            {!user && (
              <p className="mt-2 text-sm text-ink-3">Скачивание доступно после входа. Выбор шагов сохранится.</p>
            )}
          </AdaptiveActions>
        </PackageInsight>
      </Modal>
      <div className="space-y-5">
        {notice && <LiquidGlass className="well p-3">{notice}</LiquidGlass>}
        <LiquidGlass as="section"
          id="pack-settings"
          className="glass glass-blur liquid-glass-card p-4 sm:p-6"
          aria-labelledby="tweaker-profiles"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 id="tweaker-profiles" className="rf-page-content text-lg font-bold">
              Графический профиль
            </h2>
            <p aria-live="polite" className="chip tabular-nums text-accent-hi">
              Выбрано: {chosen.length} из {eligible.length}
            </p>
          </div>
          <GraphicsPicker
            value={mode}
            onChange={(value) => update({ mode: value })}
            label="Графический профиль Rust"
            presentation="cards"
          />
          <div className="tweaker-toolbar mt-4" aria-label="Параметры пакета">
            <Segmented
              ariaLabel="Показать твики"
              value={onlyRecommended ? "safe" : "all"}
              options={[
                { value: "safe", label: "Рекомендуемые" },
                { value: "all", label: "Все твики" },
              ]}
              onChange={(v) => setOnlyRecommended(v === "safe")}
            />
            <Segmented<TweakerVendor>
              ariaLabel="Производитель GPU"
              value={gpu}
              onChange={selectVendor}
              options={[
                { value: "nvidia", label: "NVIDIA" },
                { value: "amd", label: "AMD" },
                { value: "intel", label: "Intel" },
              ]}
            />
            <div className="os-picker">
              <span aria-hidden="true">ОС пакета</span>
              <LiquidSelect
                label="Windows для пакета"
                hideLabel
                value={osOverride}
                onChange={(v) => setOs(isWindows(v) ? v : "auto")}
                options={[
                  {
                    value: "auto",
                    label: autoOs
                      ? `Авто: Windows ${autoOs}`
                      : IS_DESKTOP_APP ? "Авто (система)" : "Версия не указана",
                  },
                  { value: "10", label: "Windows 10" },
                  { value: "11", label: "Windows 11" },
                ]}
              />
            </div>
            <AdaptiveActions action={action}>
              <ProfileGate action="Скачать ZIP с твиками и откатом" className="btn-primary">
                <Button
                  variant="primary"
                  size="sm"
                  className="liquid-glass-btn"
                  loading={packing}
                  onClick={(event) => void downloadPack(event.currentTarget)}
                >
                  <Download aria-hidden="true" /> Скачать ZIP с твиками и откатом
                </Button>
              </ProfileGate>
              <button type="button" className="btn btn-sm" onClick={(event) => void copyCfg(event.currentTarget)}>
                <Copy aria-hidden="true" /> Скопировать client.cfg
              </button>
            </AdaptiveActions>
          </div>
          {personal && (
            <p className="mt-3 text-sm text-ink-2">
              <strong className="text-accent-hi">Персональный конфиг</strong> ·{" "}
              {systemOs && `Windows ${systemOs} · `}
              {ram} ГБ ОЗУ · {vram !== undefined ? `${vram} ГБ VRAM` : "VRAM не указана для выбранной GPU"} ·{" "}
              <code>gc.buffer {gcBudget(ram, tuning).mb}</code> · текстуры выбираются в игре.
              Ничего не применяется автоматически.
            </p>
          )}
          {(tuning?.monitorHz || connection) && (
            <p className="mt-2 text-sm text-ink-2">
              {tuning?.monitorHz && (
                <span>
                  {formatMonitorHz(tuning.monitorHz)} · <code>fps.limit {tuning.monitorHz}</code>.{" "}
                </span>
              )}
              {connection && (
                <span>
                  Сеть: {connection.label}. Конфиг не изменяет сетевые параметры или пинг.{" "}
                </span>
              )}
              <button
                type="button"
                className="link"
                onClick={(event) => config.show(true, event.currentTarget)}
                aria-haspopup="dialog"
              >
                Посмотреть client.cfg
              </button>
            </p>
          )}
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            Рекомендуемые — обратимые настройки и проверки для вашего ПК. В файл настроек игры входит запас памяти между очистками:{" "}
            <code>gc.buffer {gcBudget(ram, tuning).mb}</code>
            {personal
              ? " из выбранной конфигурации"
              : hardware
                ? " из сохранённой сборки"
                : " по объёму ОЗУ"}.{" "}
            <Link href="/benchmark" className="link">
              Моя сборка
            </Link>
          </p>
        </LiquidGlass>

        <CatalogBar
          label="Твикер"
          query={query}
          onQuery={setQuery}
          sort={sort}
          onSort={setSort}
          options={TWEAK_SORTS}
          hint={hint}
        />
        <LiquidGlass as="section" className="glass discovery p-4 sm:p-5" aria-label="Подборка твиков">
          <div className="catalog-heading">
            <h2>{full ? "Результаты подбора" : "С чего начать"}</h2>
            <small aria-live="polite">Найдено: {results.length}</small>
          </div>
          <div className="discovery-list">{(browsing ? results : results.slice(0, 3)).map(discoveryItem)}</div>
          {!browsing && (
            <OriginDisclosure open={more}>
              <div id="extra-tweaks" className="discovery-list mt-2">
                {results.slice(3).map(discoveryItem)}
              </div>
            </OriginDisclosure>
          )}
          {!results.length && <p className="catalog-hint">Совпадений нет. Измените запрос или фильтр.</p>}
          {!query.trim() && sort === "effective" && results.length > 3 && (
            <button
              className="link mt-3 text-xs"
              type="button"
              aria-expanded={more}
              aria-controls="extra-tweaks"
              onClick={() => setMore(!more)}
            >
              {more ? "Свернуть список" : "Вся подборка"}
            </button>
          )}
        </LiquidGlass>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Категории твиков">
          {TWEAK_GROUPS.filter(
            (g) => (!query.trim() && sort !== "safe") || results.some((t) => t.group === g.id),
          ).map((g) => {
            const Icon = icons[g.id];
            const items = eligible.filter((t) => t.group === g.id);
            return (
              <LiquidGlass as="button" island
                key={g.id}
                type="button"
                className="glass glass-hover liquid-glass-card category-card p-4 text-left sm:p-5"
                aria-haspopup="dialog"
                onClick={(event) => {
                  openGroup(g.id, event.currentTarget);
                }}
              >
                <span className="mb-3 flex items-center justify-between gap-2">
                  <Icon className="h-5 w-5 text-accent-hi" aria-hidden="true" />
                  <span className="flex items-center gap-3 text-xs tabular-nums text-ink-3">
                    {items.filter((t) => chosenSet.has(t.slug)).length}/{items.length}
                    <MoveUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                </span>
                <span className="rf-page-content block text-base font-bold">{g.title}</span>
                <span className="rf-page-content mt-1 block text-sm leading-relaxed text-ink-2">
                  {g.description}
                </span>
              </LiquidGlass>
            );
          })}
        </div>

        <Modal
          open={group.isOpen}
          closing={group.closing}
          onClose={group.dismiss}
          onExited={group.finish}
          source={group.source}
          returnFocus={group.opener}
          title={category?.title ?? ""}
          maxWidth="max-w-2xl"
          description={category?.description}
        >
          {category && (
            <div className="space-y-3">
              <CatalogBar
                label={category.title}
                query={innerQuery}
                onQuery={setInnerQuery}
                sort={innerSort}
                onSort={setInnerSort}
                options={TWEAK_SORTS}
                hint={explain(innerSort)}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-3">Мифы и вредные советы в ZIP не добавляются.</p>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setOnlyRecommended(!onlyRecommended)}
                >
                  {onlyRecommended ? "Показать все" : "Рекомендуемые"}
                </button>
              </div>
              {scoped.map((t) => {
                const canChoose = packEligible(t) && fitsWindows(t, systemOs);
                const shown = expanded.includes(t.slug);
                return (
                  <LiquidGlass as="article" key={t.slug} className="well p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 basis-44">
                        <h3 className="font-bold">{t.title}</h3>
                        {systemSlugs && (recommended.includes(t.slug) || t.slug === "gc-buffer") && (
                          <small className="rubric">Рекомендовано для вашей системы</small>
                        )}
                        {topPick(t) && <span className="rubric">ТОП выбор</span>}
                        <p className="mt-1 text-xs text-ink-3">
                          {TWEAK_RISK_META[t.riskLevel].label} · {RESTART_LABEL[t.restart]} ·{" "}
                          {t.evidence === "myth" ? "Миф" : t.gainLabel}
                        </p>
                      </div>
                      <FavoriteButton
                        kind="tweak"
                        slug={t.slug}
                        title={t.title}
                        active={favorites.includes(t.slug)}
                      />
                      {canChoose && (
                        <button
                          type="button"
                          aria-pressed={chosenSet.has(t.slug)}
                          className="btn btn-sm profile-option"
                          aria-label={`${chosenSet.has(t.slug) ? "Убрать" : "Добавить"}: ${t.title}`}
                          onClick={() => toggle(t.slug)}
                        >
                          {chosenSet.has(t.slug) ? "В пакете" : "В пакет"}
                        </button>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-ink-2">{t.tagline}</p>
                    <button
                      type="button"
                      className="link mt-2 text-xs"
                      aria-expanded={shown}
                      aria-controls={`steps-${t.slug}`}
                      onClick={() =>
                        setExpanded(shown ? expanded.filter((s) => s !== t.slug) : [...expanded, t.slug])
                      }
                    >
                      {shown ? "Скрыть" : "Описание и откат"}
                    </button>
                    <AccordionBody open={shown} id={`steps-${t.slug}`}>
                      <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
                        {t.slug === "gc-buffer" ? (
                          <p>
                            В вашем client.cfg: <code>gc.buffer {gcBudget(ram, tuning).mb}</code>. Меняйте режим
                            в «Сборке» и сравнивайте длинные кадры на одном сервере. Отдельный скрипт не нужен.
                          </p>
                        ) : (
                          <p>{t.what}</p>
                        )}
                        {t.slug !== "gc-buffer" && (
                          <ol className="list-decimal space-y-1 pl-5">
                            {t.steps.map((step) => (
                              <li key={step}>{step}</li>
                            ))}
                          </ol>
                        )}
                        <p>
                          <strong className="text-ink">Проверка:</strong> {t.check}
                        </p>
                        <p>
                          <strong className="text-ink">Откат:</strong> {t.revertSteps.join(" ")}
                        </p>
                        {t.slug !== "gc-buffer" && (
                          <Link className="link" href={`/files/${t.slug}`}>
                            Прочитать файл и инструкцию ↗
                          </Link>
                        )}
                        {t.warnings?.map((w) => (
                          <p key={w} className="text-warn">
                            {w}
                          </p>
                        ))}
                        {t.windowsVersion && !systemOs && (
                          <p>
                            Укажите Windows {t.windowsVersion} в параметрах пакета, чтобы добавить этот шаг.
                          </p>
                        )}
                        {canChoose && (
                          <div className="flex items-center justify-between gap-2">
                            <span>Выполнено на моём ПК</span>
                            <Switch
                              checked={Boolean(state?.tweaks[t.slug]?.applied)}
                              label={`Отметить выполненным: ${t.title}`}
                              onChange={(v) => storage.setTweakApplied(t.slug, v)}
                            />
                          </div>
                        )}
                      </div>
                    </AccordionBody>
                  </LiquidGlass>
                );
              })}
              {!scoped.length && (
                <LiquidGlass as="p" className="well p-4 text-sm text-ink-2">
                  Подходящих твиков нет. Измените запрос или покажите все твики.
                </LiquidGlass>
              )}
              {category.id === "ram-ssd" && (
                <p className="text-xs text-ink-3">
                  В client.cfg используется gc.buffer {gcBudget(ram, tuning).mb} из настроек сборки.
                </p>
              )}
            </div>
          )}
        </Modal>
        <Modal
          open={config.isOpen}
          closing={config.closing}
          source={config.source}
          returnFocus={config.opener}
          onClose={config.dismiss}
          onExited={config.finish}
          title="client.cfg"
          description="Скопируйте команды вручную. Сначала сохраните свой файл настроек."
        >
          <textarea
            className="well w-full p-3 font-sans text-sm"
            aria-label="Команды client.cfg"
            value={cfg}
            readOnly
            rows={10}
          />
        </Modal>
      </div>
    </>
  );
}
