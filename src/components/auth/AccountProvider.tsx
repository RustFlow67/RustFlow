"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { apiUrl } from "@/lib/api-base";
import { credentials, type PasswordMode } from "@/lib/auth/credentials";
import { isEphemeralAccount, localAccount, LOCAL_ACCOUNT_KEY, localPassword, saveLocalBuild, signOutLocal } from "@/lib/auth/local";
import type { SessionView } from "@/lib/auth/types";
import type { BuildInput } from "@/lib/models/build";

interface AccountContext {
  session: SessionView | null;
  problem: string | null;
  ephemeral: boolean;
  refresh: () => void;
  authenticate: (mode: PasswordMode, fields: Record<string, FormDataEntryValue | null>) => Promise<void>;
  saveBuild: (build: BuildInput) => Promise<void>;
  signOut: () => Promise<void>;
}

const Account = createContext<AccountContext | null>(null);
const EMPTY: SessionView = { user: null, admin: false, googleEnabled: false, secureOrigin: false };
const NETWORK_ERROR = "Сервер аккаунтов недоступен. Можно использовать локальный профиль.";
class AccountError extends Error {
  constructor(message: string, readonly status = 0) { super(message); }
  get unavailable() { return this.status === 0 || this.status === 404 || this.status >= 500; }
}

function embeddable() { return window.top !== window.self && window.location.protocol === "https:"; }
export function accountHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  if (embeddable()) headers.set("X-RustFlow-Embedded", "1");
  return headers;
}
function deviceTransport() {
  if (window.origin === "null") return true;
  return window.location.protocol === "http:" && !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

async function accountRequest(path: string, init?: RequestInit): Promise<SessionView> {
  const endpoint = new URL(apiUrl(`auth/${path}`), window.location.href);
  // Never post a password or follow a redirect to a different origin.
  if (endpoint.origin !== window.location.origin || window.origin === "null") throw new AccountError(NETWORK_ERROR);
  const headers = accountHeaders(init?.headers);
  const deadline = AbortSignal.timeout(7500);
  const signal = init?.signal ? AbortSignal.any([deadline, init.signal]) : deadline;
  const response = await fetch(endpoint, { ...init, cache: "no-store", credentials: "same-origin", headers, signal, redirect: "error" })
    .catch(() => { throw new AccountError(NETWORK_ERROR); });
  const data = await response.json().catch(() => null) as (SessionView & { error?: unknown }) | null;
  if (!response.ok || !data || typeof data.googleEnabled !== "boolean") throw new AccountError(typeof data?.error === "string" ? data.error : NETWORK_ERROR, response.ok ? 0 : response.status);
  return data;
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [ephemeral, setEphemeral] = useState(false);
  const revision = useRef(0);
  const writing = useRef(false);

  const receive = useCallback((value: SessionView) => {
    const device = localAccount();
    // A locally selected identity is never sent to an account or admin endpoint.
    setSession({ ...value, user: device ?? value.user });
    setEphemeral(Boolean(device && isEphemeralAccount()));
    setProblem(null);
  }, []);

  const refresh = useCallback((signal?: AbortSignal) => {
    if (writing.current) return;
    const request = ++revision.current;
    void accountRequest("session", { signal }).then((value) => {
      if (!signal?.aborted && request === revision.current) receive(value);
    }).catch(() => {
      if (!signal?.aborted && request === revision.current) {
        receive(EMPTY);
        setProblem(NETWORK_ERROR);
      }
    });
  }, [receive]);

  useEffect(() => {
    const controller = new AbortController();
    const update = () => { if (!document.hidden) refresh(controller.signal); };
    const storage = (event: StorageEvent) => { if (event.key === LOCAL_ACCOUNT_KEY || event.key === null) update(); };
    update();
    document.addEventListener("visibilitychange", update);
    window.addEventListener("rustflow:admin-change", update);
    window.addEventListener("storage", storage);
    return () => {
      controller.abort(); document.removeEventListener("visibilitychange", update);
      window.removeEventListener("rustflow:admin-change", update); window.removeEventListener("storage", storage);
    };
  }, [refresh]);

  function mutate(path: string, method: "POST" | "PUT", data?: unknown) {
    return accountRequest(path, { method,
      ...(data === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }),
    });
  }
  async function write(perform: () => Promise<void>) {
    if (writing.current) throw new Error("Дождитесь завершения текущего запроса.");
    writing.current = true;
    ++revision.current;
    try { await perform(); } finally { writing.current = false; }
  }

  return <Account.Provider value={{
    session, problem, ephemeral, refresh,
    authenticate: (mode, fields) => write(async () => {
      const parsed = credentials(fields, mode);
      if (parsed.error) throw new Error(parsed.error);
      let flags = session ?? EMPTY;
      try {
        const cloud = await mutate(mode, "POST", deviceTransport() ? { deviceOnly: true } : fields);
        // A cross-site iframe may accept the response but refuse to persist its cookie.
        const verified = embeddable() ? await accountRequest("session") : cloud;
        flags = verified;
        if (!cloud.user || verified.user?.id !== cloud.user.id) throw new AccountError(NETWORK_ERROR);
        signOutLocal();
        receive(verified);
        return;
      } catch (error) {
        // A local profile stays usable after the server returns, but is not a cloud identity.
        if (!(error instanceof AccountError) || (!error.unavailable && !(mode === "login" && error.status === 401))) throw error;
        try { await localPassword(mode, fields); }
        catch (failure) { throw error.status === 401 ? error : failure; }
        receive({ ...flags, user: null });
      }
    }),
    saveBuild: (build) => write(async () => {
      if (!session?.user) throw new Error("Войдите в профиль, чтобы сохранить сборку.");
      if (session.user.kind === "local") {
        saveLocalBuild(session.user.id, build);
        receive(session);
      } else {
        receive(await mutate("build", "PUT", { build, expectedAccount: session.user.id }));
      }
    }),
    signOut: () => write(async () => {
      const device = session?.user?.kind === "local";
      if (device) signOutLocal();
      try { receive(await mutate("logout", "POST")); }
      catch (error) {
        if (!device) throw error;
        receive({ ...EMPTY, googleEnabled: session?.googleEnabled ?? false });
      }
    }),
  }}>{children}</Account.Provider>;
}

export function useAccount() {
  const account = useContext(Account);
  if (!account) throw new Error("AccountProvider is missing");
  return account;
}
