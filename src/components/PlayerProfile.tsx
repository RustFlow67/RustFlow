"use client";

import { CircleUserRound, Download, Gauge, Link2, LogOut, Upload } from "lucide-react";
import Image from "next/image";
import { apiUrl } from "@/lib/api-base";
import type { PlayerAccount } from "@/lib/auth/types";
import { signOutLocal } from "@/lib/auth/local";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount } from "@/components/auth/AccountProvider";
import GoogleIcon from "@/components/auth/GoogleIcon";
import DataBackupModal, { type BackupTab } from "@/components/DataBackupModal";
import ProfileBuilds from "@/components/auth/ProfileBuilds";
import { OPEN_PROFILE_EVENT, PROFILE_DIALOG_ID } from "@/components/auth/ProfileGate";
import Link from "@/components/RouteLink";
import Segmented from "@/components/Segmented";
import { Badge, Button, Input } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useRustFlowStore } from "@/lib/storage/useStore";

type Mode = "login" | "register";
const MODES: { value: Mode; label: string }[] = [{ value: "login", label: "Вход" }, { value: "register", label: "Регистрация" }];

function Avatar({ user, large = false }: { user: PlayerAccount; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = large ? 42 : 24;
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join("").toLocaleUpperCase("ru-RU");
  return <span className={`profile-avatar${large ? " profile-avatar-lg" : ""}`} aria-hidden="true">
    {user.avatar && !failed ? <Image src={user.avatar} alt="" width={size} height={size} unoptimized referrerPolicy="no-referrer"
      className="h-full w-full rounded-full object-cover" onError={() => setFailed(true)} /> : initials}
  </span>;
}

export default function PlayerProfile() {
  const trigger = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const { session, ephemeral, refresh, authenticate, saveBuild, signOut } = useAccount();
  const user = session?.user;
  const [open, setOpen] = useState(false);
  const [backup, setBackup] = useState<BackupTab | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { state } = useRustFlowStore();
  const { toast } = useToast();
  const active = state?.builds.find((build) => build.id === state.activeBuildId) ?? state?.builds[0];
  const close = () => {
    setOpen(false);
    setBackup(null);
    // Signing in replaces the original lock button with its enabled action.
    if (!opener.current?.isConnected) trigger.current?.focus({ preventScroll: true });
  };
  const show = useCallback((element: HTMLElement | null = trigger.current) => {
    opener.current = element;
    setError(null);
    setOpen(true);
    refresh();
  }, [refresh]);

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
      if (hash !== "#profile=google-ok" && hash !== "#profile=google-error") return;
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      opener.current = trigger.current;
      setOpen(true);
      if (hash.endsWith("ok")) { signOutLocal(); refresh(); }
      if (hash.endsWith("error")) setError("Не удалось войти через Google. Попробуйте ещё раз или войдите с паролем.");
    });
    return () => cancelAnimationFrame(frame);
  }, [refresh]);

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
      setError("Добавьте VITE_GOOGLE_CLIENT_ID в .env для входа через Google");
      return;
    }
    const url = new URL(apiUrl("auth/google"), window.location.href);
    if (url.origin !== location.origin) { setError("Для Google нужен API на том же домене, что и RustFlow."); return; }
    // Google does not show its chooser inside frames. Open the full flow as a top-level page.
    if (self !== top) window.open(url.href, "_blank", "noopener,noreferrer");
    else window.location.assign(url.href);
  }

  return <>
    <button ref={trigger} type="button" className="glass nav-pill profile-trigger"
      aria-label={user ? `Профиль: ${user.name}` : "Профиль"} title={user?.name}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? PROFILE_DIALOG_ID : undefined}
      onClick={(event) => show(event.currentTarget)}>
      {user ? <Avatar key={`${user.id}:${user.avatar}`} user={user} />
        : <CircleUserRound aria-hidden="true" />}
      <span className="truncate">{user?.name ?? "Профиль"}</span>
    </button>
    <Modal open={open} onClose={close} title="Профиль игрока" variant="profile" id={PROFILE_DIALOG_ID}
      returnFocus={opener} maxWidth="max-w-[24rem]">
      {user ? <div className="profile-account">
        <div className="profile-identity">
          <Avatar key={`${user.id}:${user.avatar}`} user={user} large />
          <strong className="min-w-0 wrap-anywhere">{user.name}</strong>
          <Badge tone={session?.admin ? "accent" : "neutral"}>{session?.admin ? "ADMIN" : user.kind === "local" ? "Локально" : "Игрок"}</Badge>
        </div>
        {user.kind === "local" && <p className="text-xs text-ink-3">{ephemeral ? "Хранилище недоступно. Профиль действует в этой вкладке до перезагрузки." : "Профиль на этом устройстве. Не синхронизируется с сервером."}</p>}
        <div className="profile-build">
          <p className="text-xs font-bold text-accent-hi">Сборка аккаунта</p>
          <p className="mt-1 wrap-anywhere text-sm text-ink-2">{user.build?.name ?? "Ещё не привязана"}</p>
          {active ? <Button size="sm" loading={busy === "build"} disabled={Boolean(busy)} title={active.input.name}
            className="mt-2 w-full" aria-describedby="rf-profile-local-build" onClick={() => void run("build", async () => {
              await saveBuild(active.input);
              toast({ title: user.kind === "local" ? "Сборка сохранена в локальном профиле" : "Сборка сохранена в аккаунте", tone: "success" });
            })}>
            <Link2 aria-hidden="true" /> {user.build ? "Обновить из браузера" : "Привязать локальную сборку"}
          </Button> : !user.build && <p className="mt-1 text-xs text-ink-3">Укажите ПК по ссылке «К моей сборке».</p>}
          {active && <p id="rf-profile-local-build" className="mt-1 wrap-anywhere text-xs text-ink-3">В браузере: {active.input.name}</p>}
        </div>
        <Link href="/benchmark?account=1#build-config" className="btn btn-sm mt-2 w-full" onNavigate={close}>
          <Gauge aria-hidden="true" /> К моей сборке
        </Link>
        <ProfileBuilds key={user.id} open={open} onNavigate={close} />
        <div className="profile-backup-actions" aria-label="Резервная копия браузера" role="group">
          <button type="button" className="btn btn-sm" aria-haspopup="dialog" onClick={() => setBackup("export")}>
            <Download aria-hidden="true" /> Экспорт JSON
          </button>
          <button type="button" className="btn btn-sm" aria-haspopup="dialog" onClick={() => setBackup("import")}>
            <Upload aria-hidden="true" /> Импорт JSON
          </button>
        </div>
        <p className="text-xs text-ink-3">В JSON входят локальные сборки, журнал замеров, отметки и настройки Твикера, но не данные входа.</p>
        <Button size="sm" variant="ghost" loading={busy === "logout"} disabled={Boolean(busy)} className="mt-3 w-full"
          onClick={() => void run("logout", async () => { await signOut(); setBackup(null); setMode("login"); })}><LogOut aria-hidden="true" /> Выйти из аккаунта</Button>
      </div> : <>
        {session?.admin && <p className="mb-3 flex items-center gap-2 text-xs text-ink-2"><Badge tone="accent">ADMIN</Badge> Бейдж активен в этом браузере</p>}
        <Segmented ariaLabel="Действие с аккаунтом" options={MODES} value={mode}
          onChange={(value) => { if (!busy) { setMode(value); setError(null); } }} className="w-full" />
        <form key={mode} className="profile-auth-form" method="post"
          onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.nativeEvent.isComposing || !(event.target instanceof HTMLInputElement)) return;
            event.preventDefault(); submit(event.currentTarget);
          }}>
          <Input label="Логин или email" name="login" fieldSize="sm" autoComplete="username" minLength={3} maxLength={254} required spellCheck={false} />
          <Input label="Пароль" name="password" fieldSize="sm" type="password" autoComplete={mode === "register" ? "new-password" : "current-password"}
            minLength={4} maxLength={128} required />
          {mode === "register" && <Input label="Подтверждение пароля" name="confirm" fieldSize="sm" type="password" autoComplete="new-password" minLength={4} maxLength={128} required />}
          {/* A sandbox can disallow native form submission even when JS is allowed. */}
          <Button type="button" onClick={(event) => submit(event.currentTarget.form)} variant="primary" loading={busy === "credentials"}
            disabled={Boolean(busy)} size="sm" className="w-full">
            {mode === "register" ? "Создать аккаунт" : "Войти"}
          </Button>
        </form>
        <div className="profile-or" aria-hidden="true">или</div>
        <button type="button" className="btn btn-sm google-button" onClick={google}><GoogleIcon /> Продолжить через Google</button>
        <p className="mt-3 text-center text-xs text-ink-3">Сохранённые сборки и JSON доступны после входа в профиль.</p>
      </>}
      {error && <p role="alert" className="mt-3 text-sm leading-relaxed text-danger">{error}</p>}
    </Modal>
    {user && <DataBackupModal key={user.id} open={open && backup !== null} onClose={() => setBackup(null)}
      tab={backup ?? "export"} onTabChange={setBackup} />}
  </>;
}
