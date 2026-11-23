"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { CircleUserRound, LogOut } from "lucide-react";
import PlayerCabinet, { Avatar, socialLink } from "./auth/PlayerCabinet";
import { countBuild, useCabinet } from "@/lib/auth/cabinet";
import { apiUrl } from "@/lib/api-base";
import { signOutLocal } from "@/lib/auth/local";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useAccount } from "@/components/auth/AccountProvider";
import GoogleIcon from "@/components/auth/GoogleIcon";
import DataBackupModal, { type BackupTab } from "@/components/DataBackupModal";
import { OPEN_PROFILE_EVENT, PROFILE_DIALOG_ID } from "@/components/auth/ProfileGate";
import ProTeaser from "./ProTeaser";
import Segmented from "@/components/Segmented";
import { Badge, Button, Input } from "@/components/ui";
import { usePopupState, usePopupTrigger } from "@/components/fx/usePopupMotion";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useRustFlowStore } from "@/lib/storage/useStore";

type Mode = "login" | "register";
const MODES: { value: Mode; label: string }[] = [{ value: "login", label: "Вход" }, { value: "register", label: "Регистрация" }];

export default function PlayerProfile() {
  const trigger = useRef<HTMLButtonElement>(null);
  const { isOpen, closing, opener, source, show: present, dismiss, finish } = usePopupState<true>();
  const open = isOpen && !closing;
  const { session, ephemeral, refresh, authenticate, quickSignIn, saveBuild, signOut } = useAccount();
  const user = session?.user;
  const backupOpener = usePopupTrigger();
  const [backup, setBackup] = useState<BackupTab | null>(null);
  const cabinet = useCabinet(user?.id);
  const name = cabinet.nickname || user?.name;
  const social = socialLink(cabinet.social);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { state } = useRustFlowStore();
  const { toast } = useToast();
  const active = state?.builds.find((build) => build.id === state.activeBuildId) ?? state?.builds[0];
  const close = () => {
    dismiss();
    setBackup(null);
  };
  useLayoutEffect(() => {
    // The lock button can disappear on sign-in. Refocus after releasing HUD inertness.
    if (closing && !opener.current?.isConnected) trigger.current?.focus({ preventScroll: true });
  }, [closing, opener]);
  const show = useCallback((element: HTMLElement | null = trigger.current) => {
    present(true, element);
    setError(null);
    refresh();
  }, [present, refresh]);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const element = (event as CustomEvent<HTMLElement>).detail;
      show(element instanceof HTMLElement && element.isConnected ? element : undefined);
    };
    window.addEventListener(OPEN_PROFILE_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_PROFILE_EVENT, onOpen);
  }, [show]);

  useEffect(() => {
    // OAuth returns to the same site's dialog without leaving an error/status in its URL.
    const frame = requestAnimationFrame(() => {
      const hash = window.location.hash;
      if (!/^#profile=(google|steam)-(ok|error)$/.test(hash)) return;
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      present(true, trigger.current);
      if (hash.endsWith("ok")) { signOutLocal(); refresh(); }
      if (hash.endsWith("error")) setError("Не удалось войти через выбранный сервис. Попробуйте ещё раз или войдите с паролем.");
    });
    return () => cancelAnimationFrame(frame);
  }, [present, refresh]);

  async function run(action: string, perform: () => Promise<void>) {
    if (busy) return;
    setBusy(action);
    setError(null);
    try { await perform(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Не удалось выполнить запрос."); }
    finally { setBusy(null); }
  }

  function submit(form: HTMLFormElement | null) {
    if (!form || busy || !form.reportValidity()) return;
    const fields = new FormData(form);
    void run("credentials", () => authenticate(mode, { login: fields.get("login"), password: fields.get("password"),
      ...(mode === "register" ? { confirm: fields.get("confirm") } : {}) }));
  }

  function google() {
    if (!session?.googleEnabled) {
      void run("quick", quickSignIn);
      return;
    }
    const url = new URL(apiUrl("auth/google"), window.location.href);
    if (url.origin !== location.origin) { setError("Для Google нужен API на том же домене, что и RustFlow."); return; }
    // Google does not show its chooser inside frames. Open the full flow as a top-level page.
    if (self !== top) window.open(url.href, "_blank", "noopener,noreferrer");
    else window.location.assign(url.href);
  }

  return <>
    <LiquidGlass as="button" island shape="pill" ref={trigger} type="button" data-chrome-panel="" className="glass nav-pill profile-trigger"
      aria-label={user ? `Профиль: ${name}` : "Профиль"} title={name}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? PROFILE_DIALOG_ID : undefined}
      onClick={(event) => show(event.currentTarget)}>

      {user ? <Avatar key={`${user.id}:${user.avatar}`} user={user} identity={cabinet} />
        : <CircleUserRound aria-hidden="true" />}
      <span className="truncate">{name ?? "Профиль"}</span>
    </LiquidGlass>
    <Modal open={isOpen} closing={closing} onExited={finish} onClose={close} title="Профиль игрока" variant="profile" id={PROFILE_DIALOG_ID}
      anchor={trigger} source={source} returnFocus={opener} maxWidth={user ? "max-w-[29rem]" : "max-w-[25rem]"}>
      {user ? <PlayerCabinet key={user.id} user={user} cabinet={cabinet} active={active} open={open} close={close} backup={from => {backupOpener.capture(from); setBackup("export");}}
          identity={<>
          <div className="profile-identity">
          <Avatar key={`${user.id}:${user.avatar}`} user={user} identity={cabinet} large />
          <div className="min-w-0"><strong className="wrap-anywhere">{name}</strong>{cabinet.social && <small className="cabinet-social">{social ? <a href={social} target="_blank" rel="noopener noreferrer">{cabinet.social} ↗</a> : cabinet.social}</small>}</div>
          <Badge tone={session?.admin ? "accent" : "neutral"}>{session?.admin ? "ADMIN" : user.kind === "local" ? "Локально" : "Игрок"}</Badge>
        </div>
        {user.kind === "local" && <p className="text-xs text-ink-3">{ephemeral ? "Хранилище недоступно. Профиль действует в этой вкладке до перезагрузки." : "Профиль на этом устройстве. Не синхронизируется с сервером."}</p>}
        </>} signOut={<Button size="sm" variant="ghost" loading={busy === "logout"} disabled={Boolean(busy)} className="cabinet-signout" aria-label="Выйти из аккаунта" title="Выйти из аккаунта"
          onClick={() => void run("logout", async () => { await signOut(); setBackup(null); setMode("login"); })}><LogOut aria-hidden="true" /></Button>}
          busy={Boolean(busy)} binding={busy === "build"} bind={() => run("build", async () => {
            if (!active) return;
            await saveBuild(active.input); countBuild(active.id,user.id);
            toast({ title: user.kind === "local" ? "Сборка сохранена в локальном профиле" : "Сборка сохранена в аккаунте", tone: "success" });
          })} /> : <>
        {session?.admin && <p className="mb-3 flex items-center gap-2 text-xs text-ink-2"><Badge tone="accent">ADMIN</Badge> Бейдж активен в этом браузере</p>}
        <ProTeaser />
        <Segmented ariaLabel="Действие с аккаунтом" options={MODES} value={mode}
          onChange={(value) => { if (!busy) { setMode(value); setError(null); } }} className="w-full" />
        <form key={mode} className="profile-auth-form" method="post"
          onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement)) return;
            event.preventDefault(); submit(event.currentTarget);
          }}>
          <Input label="Логин или email" name="login" fieldSize="sm" autoComplete="username" minLength={session?.passwordEnabled ? 3 : 1} maxLength={254} required spellCheck={false} />
          <Input label="Пароль" name="password" fieldSize="sm" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={session?.passwordEnabled ? 4 : 1} maxLength={128} required />
          {mode === "register" && <Input label="Подтверждение пароля" name="confirm" fieldSize="sm" type="password" autoComplete="new-password" minLength={session?.passwordEnabled ? 4 : 1} maxLength={128} required />}
          {/* A sandbox can disallow native form submission even when JS is allowed. */}
          <Button type="button" onClick={(event) => submit(event.currentTarget.form)} variant="primary" loading={busy === "credentials"}
            disabled={Boolean(busy) || !session} size="sm" className="w-full">
            {mode === "register" ? "Создать аккаунт" : "Войти"}
          </Button>
        </form>
        <div className="profile-or" aria-hidden="true">или</div>
        <button type="button" className="btn btn-sm google-button" disabled={Boolean(busy) || !session} onClick={google} aria-describedby="rf-google-mode"><GoogleIcon /> Продолжить через Google{session && !session.googleEnabled && <small>Демо</small>}</button>
        <p className="profile-auth-note" id="rf-google-mode">{session?.googleEnabled ? "Безопасный переход к выбору аккаунта Google." : "Демо-вход на этом устройстве: без проверки Google и без облачной синхронизации."}</p>
        <button type="button" className="btn btn-sm google-button" disabled={Boolean(busy) || !session?.steamEnabled} onClick={() => {
          const url = new URL(apiUrl("auth/steam"), window.location.href);
          if (url.origin !== location.origin) { setError("Для Steam нужен API на том же домене."); return; }
          if (self !== top) window.open(url.href, "_blank", "noopener,noreferrer"); else window.location.assign(url.href);
        }}>Продолжить через Steam</button>
        {!session?.steamEnabled && <p className="profile-auth-note">Steam доступен после настройки сервера.</p>}
        <p className="mt-3 text-center text-xs text-ink-3">{session?.passwordEnabled ? "Гостевая сборка останется в браузере после входа." : "Новый логин создаёт локальный профиль. При следующем входе понадобится тот же пароль."}</p>
      </>}
      {error && <p role="alert" className="mt-3 text-sm leading-relaxed text-danger">{error}</p>}
    </Modal>
    {user && <DataBackupModal origin={backupOpener.origin} key={user.id} open={open && backup !== null} onClose={() => setBackup(null)}
      tab={backup ?? "export"} onTabChange={setBackup} />}
  </>;
}
