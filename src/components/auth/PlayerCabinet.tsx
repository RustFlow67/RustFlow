"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { ArrowUpRight, Archive, Boxes, ChartNoAxesCombined, Check, ChevronDown, Cpu, Flame, Gamepad2, Gauge, Gem, HardDrive, Link2, MemoryStick, Microchip, PencilLine, SlidersHorizontal, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useMemo, useState, type ReactNode } from "react";
import { COLORS, ICONS, saveIdentity, type Identity, type useCabinet } from "@/lib/auth/cabinet";
import type { PlayerAccount } from "@/lib/auth/types";
import { useCalculatorDraft } from "@/lib/storage/calculator-draft";
import { evaluateBuild10, isValidBuildInput, type UserBuild } from "@/lib/models/build";
import { getMemoryType } from "@/lib/models/build-settings";
import { driveEstimate } from "@/lib/models/drive";
import { avgFps } from "@/lib/models/fps-calibration";
import { getGraphicsProfile } from "@/lib/graphics-profiles";
import Link from "../RouteLink";
import { Button, Input } from "../ui";
import { useToast } from "../ui/Toast";
import LiquidSelect from "../LiquidSelect";
import ProfileBuilds from "./ProfileBuilds";
import FavoritesSync from "./FavoritesSync";

export function Avatar({ user, identity, large }: { user: PlayerAccount; identity: Identity; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const name = identity.nickname || user.name;
  const initials = name.trim().split(/\s+/).slice(0,2).map(p => Array.from(p)[0]).join("").toLocaleUpperCase("ru-RU");
  const Glyph = { gamepad: Gamepad2, flame: Flame, hex: Gem, initials: null }[identity.icon];
  return <span className={`profile-avatar${large ? " profile-avatar-lg" : ""}`} data-color={identity.color} aria-hidden="true">
    {Glyph ? <Glyph size={large ? 24 : 16} /> : user.avatar && !failed ? <Image src={user.avatar} alt="" width={40} height={40} unoptimized referrerPolicy="no-referrer"
      className="h-full w-full rounded-full object-cover" onError={() => setFailed(true)} /> : initials}
  </span>;
}

// Tags stay plain text. Only recognised HTTPS profile links become navigable.
export function socialLink(text: string) {
  try {
    const url = new URL(text);
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["discord.com","discord.gg","steamcommunity.com"].includes(url.hostname) ? url.href : null;
  } catch { return null; }
}
function AccountEditor({ user, identity }: { user: PlayerAccount; identity: Identity }) {
  const [edits, set] = useState<Identity | null>(null);
  const draft = edits ?? { ...identity, nickname: identity.nickname || user.name };
  const [error, setError] = useState("");
  const { toast } = useToast();
  function save(form: HTMLFormElement | null) {
    if (!form?.reportValidity()) return;
    const nickname = draft.nickname.trim(), social = draft.social.trim();
    if (!nickname) { setError("Введите никнейм."); return; }
    if (social.includes("://") && !socialLink(social)) { setError("Укажите тег или HTTPS-ссылку Discord или Steam Community."); return; }
    const persistent = saveIdentity(user.id, { nickname, social, color: draft.color, icon: draft.icon });
    set(null); setError(""); toast({ title: persistent ? "Изменения сохранены на устройстве" : "Изменения действуют только в этой вкладке", tone: persistent ? "success" : "info" });
  }
  return <LiquidGlass as="details" className="cabinet-edit"><summary><PencilLine size={17} /> Редактировать профиль <ChevronDown size={16} /></summary>
    <form onSubmit={e => { e.preventDefault(); save(e.currentTarget); }} onKeyDown={e => {
      if (e.key === "Enter" && e.target instanceof HTMLInputElement && !e.nativeEvent.isComposing) { e.preventDefault(); save(e.currentTarget); }
    }}>
      <Input label="Никнейм" value={draft.nickname} onChange={e => set({ ...draft, nickname: e.target.value })} maxLength={36} fieldSize="sm" required />
      <div className="avatar-options">
        <LiquidSelect label="Цвет аватара" value={draft.color} options={Object.entries(COLORS).map(([value,label])=>({value:value as Identity["color"],label}))} onChange={color=>set({...draft,color})}/>
        <LiquidSelect label="Иконка аватара" value={draft.icon} options={Object.entries(ICONS).map(([value,label])=>({value:value as Identity["icon"],label}))} onChange={icon=>set({...draft,icon})}/>
      </div>
      <Input label="Discord или Steam" placeholder="Тег игрока или ссылка на профиль" fieldSize="sm" maxLength={160} value={draft.social} onChange={e => set({ ...draft,social:e.target.value })} />
      <p className="cabinet-note">Видно только в этом браузере. Никнейм не меняет логин для входа.</p>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <Button type="button" size="sm" onClick={e => save(e.currentTarget.form)}><Check /> Сохранить изменения</Button>
    </form>
  </LiquidGlass>;
}

function Widget({ icon: Icon, label, value, note }: { icon: LucideIcon; label: string; value: string | number; note: string }) {
  return <LiquidGlass className="cabinet-widget"><dt><Icon size={15} aria-hidden="true" />{label}</dt><dd><b>{value}</b><small>{note}</small></dd></LiquidGlass>;
}
export default function PlayerCabinet({ user, cabinet, active, open, close, bind, binding, busy, backup, identity, signOut }: {
  user: PlayerAccount; cabinet: ReturnType<typeof useCabinet>; active?: UserBuild; open: boolean; close: () => void;
  identity: ReactNode; signOut: ReactNode;
  bind: () => Promise<void>; binding: boolean; busy: boolean; backup: (from: HTMLButtonElement) => void;
}) {
  const draft = useCalculatorDraft();
  const live = draft && isValidBuildInput(draft.input) ? draft : null;
  const build = live?.input ?? active?.input ?? user.build;
  const mode = live?.mode ?? build?.graphicsProfile ?? "competitive";
  const result = useMemo(() => build ? evaluateBuild10(build,mode) : null, [build,mode]);
  const gain = result ? Math.round(avgFps(result.fpsModded)) - result.fpsByPreset.quality.avg : null;
  const done = result?.recommendations.filter(r => cabinet.applied.includes(r.slug)).length ?? 0;
  const date = user.registeredAt && new Date(user.registeredAt);
  const href = live ? "#build-config" : active ? `/benchmark?saved=${encodeURIComponent(active.id)}#build-config` : user.build ? "/benchmark?account=1#build-config" : "/benchmark#build-config";
  return <div className="cabinet-body">
    <LiquidGlass as="section" className="cabinet-person" aria-label="Игрок">
      {identity}
      <div className="cabinet-actions"><AccountEditor key={user.id} user={user} identity={cabinet}/>{signOut}</div>
      {date && Number.isFinite(+date) && <small className="cabinet-note">В RustFlow с {date.toLocaleDateString("ru-RU",{day:"numeric",month:"long",year:"numeric"})}</small>}
    </LiquidGlass>
    <section aria-labelledby="cabinet-stats"><h3 id="cabinet-stats">Статистика аккаунта</h3><dl className="cabinet-widgets">
      <Widget icon={Boxes} label="Создано сборок" value={Math.max(cabinet.builds,user.build ? 1 : 0)} note="Созданы или привязаны к профилю" />
      <Widget icon={SlidersHorizontal} label="Применено твиков" value={cabinet.applied.length} note="Отмечены вами на устройстве" />
      <Widget icon={ChartNoAxesCombined} label="Расчётный прирост FPS" value={gain === null ? "—" : `${gain > 0 ? "+" : ""}${gain} FPS`} note={`Оценка: «${getGraphicsProfile(mode)!.short}» против «Качества» на той же карте`} />
      <Widget icon={Gauge} label="Уровень оптимизации ПК" value={result?.recommendations.length ? `${Math.round(100 * done / result.recommendations.length)}%` : "—"} note={result ? `${done} из ${result.recommendations.length} рекомендаций отмечено` : "Появится после расчёта сборки"} />
    </dl></section>
    <LiquidGlass as="section" className="rig-showcase" aria-labelledby="cabinet-build"><header><div><small className="rubric">{live ? "Открыта в калькуляторе" : active ? "Активна в браузере" : user.build ? "Из аккаунта" : "Паспорт ПК"}</small><h3 id="cabinet-build">Активная сборка</h3></div><Microchip size={23}/></header>
      <p className="rig-name">{build?.name ?? "Сборка ещё не настроена"}</p><dl className="rig-parts">
        {([[Cpu,"CPU",result?.cpuName],[Microchip,"GPU",result?.gpuName],[MemoryStick,"RAM",build && `${build.ramGb} ГБ ${getMemoryType(build)} · ${build.ramMhz} МТ/с CL${build.ramCl}`],[HardDrive,"Диск",build && driveEstimate(build).label]] as const).map(([Icon,label,value]) =>
          <div key={label}><dt><Icon size={15}/>{label}</dt><dd>{value ?? "—"}</dd></div>)}
      </dl>{build?.windowsVersion && <small>Операционная система: Windows {build.windowsVersion}</small>}<Link href={href} className="btn btn-sm btn-primary" onNavigate={close}>Настроить в Сборке ↗</Link>
      <details className="cabinet-tools"><summary>Сохранение и копии <ChevronDown size={15}/></summary><div className="cabinet-library">
      {result && <small>Индекс производительности Rust: {result.score10.toFixed(1)} / 10</small>}
      <p>В аккаунте: {user.build?.name ?? "Ещё не привязана"}</p>
      {active && (!live || live.id === active.id) && <Button size="sm" loading={binding} disabled={busy} onClick={() => void bind()}><Link2 /> {user.build ? "Обновить из браузера" : "Привязать локальную сборку"}</Button>}
      {active && user.build && <Link className="link" href="/benchmark?account=1#build-config" onNavigate={close}>Открыть привязанную версию</Link>}
      {user.kind === "cloud" && <FavoritesSync accountId={user.id} />}
      <ProfileBuilds open={open} onNavigate={close} />
      <button type="button" className="cabinet-backup" aria-haspopup="dialog" onClick={e => backup(e.currentTarget)}><Archive size={15} /> Резервная копия браузера <ArrowUpRight size={15} /></button>
      </div></details>
    </LiquidGlass>
  </div>;
}
