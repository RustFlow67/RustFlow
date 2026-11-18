"use client";

import { Cable, Copy, Cpu, Download, Gamepad2, HardDrive, MonitorCog, MoveUpRight, Terminal } from "lucide-react";
import { useState } from "react";
import Segmented from "@/components/Segmented";
import GraphicsPicker from "@/components/GraphicsPicker";
import { FavoriteButton, useFavorites } from "@/components/addons/Favorites";
import Link from "@/components/RouteLink";
import { accountHeaders, useAccount } from "@/components/auth/AccountProvider";
import ProfileGate, { openPlayerProfile, ProfileLock } from "@/components/auth/ProfileGate";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { profileCfg, gcForMemory, textureMipForVram, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { TWEAK_GROUPS, TWEAK_RISK_META, type TweakGroupId } from "@/lib/models/tweak";
import { fitsVendor, isPackRam, isRecommendedTweak, isTweakerVendor, packEligible, packHref, type TweakerPreferences, type TweakerVendor } from "@/lib/tweaker";
import { getConnectionProfile, formatMonitorHz, type ConfigTuning } from "@/lib/models/build-settings";
import { localAccount } from "@/lib/auth/local";
import { getGpu } from "@/lib/hardware";
import { useRustFlowStore } from "@/lib/storage/useStore";
import type { TweakLite } from "@/lib/tweaks/types";

export type TweakerEntry = TweakLite & { revertSteps: string[] };
const icons = { "cpu-windows": Cpu, gpu: MonitorCog, "ram-ssd": HardDrive, network: Cable, "rust-settings": Gamepad2, "launch-options": Terminal };

type TweakerProps = {
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
  return <>
    {locked && <div className="glass liquid-glass-card mb-4 p-4">
      <ProfileLock action="Подобрать конфиг под этот ПК" />
    </div>}
    <TweakerForm {...props} key={locked ? "general" : "requested"} personal={locked ? undefined : props.personal}
      initialMode={locked ? undefined : props.initialMode} initialGpu={locked ? null : props.initialGpu} />
  </>;
}

function TweakerForm({ inventory, initialGroup, initialMode, initialGpu, initialTweak, personal }: TweakerProps) {
  const { toast } = useToast();
  const { session } = useAccount();
  const user = session?.user;
  const { tweak: favorites } = useFavorites();
  const { state, storage, hydrated } = useRustFlowStore();
  const saved = user && (state?.builds.find((b) => b.id === state.activeBuildId) ?? state?.builds[0]);
  const hardware = saved?.input ?? user?.build ?? undefined;
  const ram = personal?.ram ?? (isPackRam(hardware?.ramGb) ? hardware.ramGb : 16);
  const tuning = personal ?? hardware;
  const connection = getConnectionProfile(tuning?.connection);
  const [local, setLocal] = useState<TweakerPreferences | null>(null);
  const savedPrefs = local ?? state?.tweaker;
  const vendor = local?.gpu ?? initialGpu ?? savedPrefs?.gpu ?? null;
  const gpu = vendor ?? (hardware ? getGpu(hardware.gpuId)?.vendor : undefined) ?? "nvidia";
  const mode = local?.mode ?? initialMode ?? savedPrefs?.mode ?? saved?.recommendedPreset ?? "balanced";
  const selection = (personal ? local?.slugs : savedPrefs?.slugs) ?? null;
  function update(patch: Partial<TweakerPreferences>) {
    const next = { gpu: vendor, mode, slugs: selection, ...patch };
    if (!hydrated || initialMode || initialGpu) setLocal(next);
    if (!personal) storage.updateTweaker(next);
  }
  const [onlyRecommended, setOnlyRecommended] = useState(Boolean(personal));
  const [openGroup, setOpenGroup] = useState(initialGroup);
  const [expanded, setExpanded] = useState<string[]>(initialTweak ? [initialTweak] : []);
  const [configOpen, setConfigOpen] = useState(false);
  const [packing, setPacking] = useState(false);
  const eligible = inventory.filter((t) => packEligible(t) && fitsVendor(t.slug, gpu));
  const recommended = eligible.filter((t) => isRecommendedTweak(t, gpu) && (!personal || t.slug !== "pagefile-auto" || ram <= 16 || personal.hdd)).map((t) => t.slug);
  const chosen = selection === null ? recommended : eligible.filter((t) => selection.includes(t.slug)).map((t) => t.slug);
  const chosenSet = new Set(chosen);
  const category = TWEAK_GROUPS.find((g) => g.id === openGroup);
  const mip = personal ? textureMipForVram(personal.vram) : undefined;
  const cfg = profileCfg(mode, ram, "", mip, tuning);

  function toggle(slug: string) {
    update({ slugs: chosenSet.has(slug) ? chosen.filter((s) => s !== slug) : [...chosen, slug] });
  }

  function selectVendor(next: TweakerVendor) {
    if (next === gpu) return;
    const driver = next === "amd" ? "amd-adrenalin" : next === "nvidia" ? "nvidia-panel" : null;
    const hadDriver = selection?.some((slug) => slug === "amd-adrenalin" || slug === "nvidia-panel");
    update({ gpu: next, slugs: selection ? [...selection.filter((slug) => slug !== "amd-adrenalin" && slug !== "nvidia-panel"), ...(hadDriver && driver ? [driver] : [])] : null });
  }

  async function copyCfg() {
    try {
      await navigator.clipboard.writeText(cfg);
      toast({ title: "Скопировано в буфер", description: "Сохраните копию client.cfg перед изменением.", tone: "success" });
    } catch { setConfigOpen(true); }
  }

  async function downloadPack(opener: HTMLElement) {
    if (!user || packing) return;
    setPacking(true);
    try {
      let blob: Blob;
      if (user.kind === "local") {
        const { localPack } = await import("@/lib/local-pack");
        if (localAccount()?.id !== user.id) { openPlayerProfile(opener); return; }
        const zip = localPack({ slugs: chosen, mode, gpu, ram, vram: personal?.vram, tuning });
        if (!zip) throw new Error("Проверьте выбранные твики.");
        blob = new Blob([new Uint8Array(zip)], { type: "application/zip" });
      } else {
        const endpoint = new URL(packHref(chosen, mode, gpu, ram, personal?.vram, tuning), location.href);
        if (endpoint.origin !== location.origin) throw new Error("Для скачивания нужен API на том же домене.");
        const response = await fetch(endpoint, { headers: accountHeaders(), credentials: "same-origin", cache: "no-store",
          redirect: "error", signal: AbortSignal.timeout(15_000) });
        if (response.status === 401) { openPlayerProfile(opener); return; }
        if (!response.ok || response.headers.get("content-type") !== "application/zip") throw new Error("Сервер не подготовил ZIP. Попробуйте ещё раз.");
        blob = await response.blob();
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `RustFlow-Pack-${mode}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      toast({ title: "Не удалось скачать ZIP", description: error instanceof Error ? error.message : undefined, tone: "error" });
    } finally { setPacking(false); }
  }

  return <div className="space-y-5">
    <section className="glass glass-blur liquid-glass-card p-4 sm:p-6" aria-labelledby="tweaker-profiles">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="tweaker-profiles" className="rf-page-content text-lg font-bold">Графический профиль</h2>
        <p aria-live="polite" className="chip tabular-nums text-accent-hi">Выбрано: {chosen.length} из {eligible.length}</p>
      </div>
      <GraphicsPicker value={mode} onChange={(value) => update({ mode: value })} label="Графический профиль Rust" presentation="cards" />
      <div className="tweaker-toolbar mt-4" aria-label="Параметры пакета">
        <Segmented ariaLabel="Показать твики" value={onlyRecommended ? "safe" : "all"}
          options={[{ value: "safe", label: "Рекомендуемые" }, { value: "all", label: "Все твики" }]}
          onChange={(v) => { setOnlyRecommended(v === "safe"); if (v === "safe") update({ slugs: null }); }} />
        <Segmented<TweakerVendor> ariaLabel="Производитель GPU" value={gpu} onChange={selectVendor}
          options={[{ value: "nvidia", label: "NVIDIA" }, { value: "amd", label: "AMD" }, { value: "intel", label: "Intel" }]} />
        <ProfileGate action="Скачать ZIP с твиками и откатом">
          <Button variant="primary" size="sm" className="liquid-glass-btn" loading={packing}
            onClick={(event) => void downloadPack(event.currentTarget)}><Download aria-hidden="true" /> Скачать ZIP с твиками и откатом</Button>
        </ProfileGate>
        <button type="button" className="btn btn-sm" onClick={copyCfg}><Copy aria-hidden="true" /> Скопировать client.cfg</button>
      </div>
      {personal && <p className="mt-3 text-sm text-ink-2"><strong className="text-accent-hi">Персональный конфиг</strong> · {ram} ГБ ОЗУ · {personal.vram} ГБ VRAM · <code>gc.buffer {gcForMemory(ram)}</code> · текстуры: {mip === 0 ? "полные" : mip === 1 ? "средние" : "лёгкие"}. Ничего не применяется автоматически.</p>}
      {(tuning?.monitorHz || connection) && <p className="mt-2 text-sm text-ink-2">
        {tuning?.monitorHz && <span>{formatMonitorHz(tuning.monitorHz)} · <code>fps.limit {tuning.monitorHz}</code>. </span>}
        {connection && <span>Сеть: {connection.label}. Больше сглаживания даёт более позднее отображение сетевых позиций, а не меньший пинг. </span>}
        <button type="button" className="link" onClick={() => setConfigOpen(true)} aria-haspopup="dialog">Посмотреть client.cfg</button>
      </p>}
      <p className="mt-3 text-xs leading-relaxed text-ink-3">Рекомендуемые — безопасные шаги с подтверждённым эффектом. Профиль входит в архив всегда; gc.buffer рассчитан для {ram} ГБ ОЗУ{personal ? " из выбранной конфигурации" : hardware ? " из сохранённой сборки" : " по умолчанию"}. <Link href="/benchmark" className="link">Моя сборка</Link></p>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Категории твиков">
      {TWEAK_GROUPS.map((g) => {
        const Icon = icons[g.id];
        const items = eligible.filter((t) => t.group === g.id);
        return <button key={g.id} type="button" className="glass glass-hover liquid-glass-card category-card p-4 text-left sm:p-5" aria-haspopup="dialog"
          onClick={() => { setOpenGroup(g.id); setExpanded([]); }}>
          <span className="mb-3 flex items-center justify-between gap-2"><Icon className="h-5 w-5 text-accent-hi" aria-hidden="true" />
            <span className="flex items-center gap-3 text-xs tabular-nums text-ink-3">{items.filter((t) => chosenSet.has(t.slug)).length}/{items.length}<MoveUpRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
          </span>
          <span className="rf-page-content block text-base font-bold">{g.title}</span>
          <span className="rf-page-content mt-1 block text-sm leading-relaxed text-ink-2">{g.description}</span>
        </button>;
      })}
    </div>

    <Modal open={Boolean(category)} onClose={() => setOpenGroup(null)} title={category?.title ?? ""} maxWidth="max-w-2xl" description={category?.description}>
      {category && <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-3">Мифы и вредные советы в ZIP не добавляются.</p>
          <button type="button" className="btn btn-sm" onClick={() => { setOnlyRecommended(!onlyRecommended); if (!onlyRecommended) update({ slugs: null }); }}>
            {onlyRecommended ? "Показать все" : "Рекомендуемые"}
          </button>
        </div>
        {inventory.filter((t) => t.group === category.id && fitsVendor(t.slug, gpu) && (!onlyRecommended || recommended.includes(t.slug))).map((t) => {
          const canChoose = packEligible(t);
          const shown = expanded.includes(t.slug);
          return <article key={t.slug} className="well p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 basis-44">
                <h3 className="font-bold">{t.title}</h3>
                <p className="mt-1 text-xs text-ink-3">{TWEAK_RISK_META[t.riskLevel].label} · {t.evidence === "myth" ? "Миф" : t.gainLabel}</p>
              </div>
              <FavoriteButton kind="tweak" slug={t.slug} title={t.title} active={favorites.includes(t.slug)} />
              {canChoose && <button type="button" aria-pressed={chosenSet.has(t.slug)} className="btn btn-sm profile-option"
                aria-label={`${chosenSet.has(t.slug) ? "Убрать" : "Добавить"}: ${t.title}`} onClick={() => toggle(t.slug)}>
                {chosenSet.has(t.slug) ? "В пакете" : "В пакет"}
              </button>}
            </div>
            <p className="mt-2 text-sm text-ink-2">{t.tagline}</p>
            <button type="button" className="link mt-2 text-xs" aria-expanded={shown} aria-controls={`steps-${t.slug}`}
              onClick={() => setExpanded(shown ? expanded.filter((s) => s !== t.slug) : [...expanded, t.slug])}>{shown ? "Скрыть" : "Описание и откат"}</button>
            <div id={`steps-${t.slug}`} hidden={!shown} className="mt-3 space-y-2 text-sm leading-relaxed text-ink-2">
              <p>{t.what}</p>
              {canChoose && <ol className="list-decimal space-y-1 pl-5">{t.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
              <p><strong className="text-ink">Проверка:</strong> {t.check}</p>
              <p><strong className="text-ink">Откат:</strong> {t.revertSteps.join(" ")}</p>
            </div>
          </article>;
        })}
        {onlyRecommended && !inventory.some((t) => t.group === category.id && recommended.includes(t.slug)) && <p className="well p-4 text-sm text-ink-2">Здесь нет универсального шага. Откройте весь список, чтобы подобрать настройку под свой ПК.</p>}
        {category.id === "ram-ssd" && <p className="text-xs text-ink-3">gc.buffer входит в client.cfg и подбирается по объёму ОЗУ.</p>}
      </div>}
    </Modal>
    <Modal open={configOpen} title="client.cfg" onClose={() => setConfigOpen(false)} description="Скопируйте команды вручную. Сначала сохраните свой файл настроек.">
      <textarea className="well w-full p-3 font-mono text-sm" aria-label="Команды client.cfg" value={cfg} readOnly rows={10} />
    </Modal>
  </div>;
}
