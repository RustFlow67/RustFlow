"use client";

import { profileBuild } from "./profile-build";
import { readSavedBuild } from "@/lib/models/saved-build";
import { type BuildInput } from "@/lib/models/build";
import type { PasswordMode } from "./credentials";
import type { PlayerAccount } from "./types";
import { LOCAL_ACCOUNT_KEY, QUICK_ID, QUICK_LOGIN } from "./device-keys";
export { LOCAL_ACCOUNT_KEY } from "./device-keys";
const MAX_LOCAL = 20;
const localHash = /^\$2b\$10\$[./A-Za-z0-9]{53}$/;
type Record = { registeredAt?: string; login: string; name: string; hash: string; build: BuildInput | null };
// A separate device-only, passwordless identity. Never a Google subject or a
// server session, and never aliases a password account (control characters are rejected).
type Vault = { accounts: Record[]; active: string | null; quickSince?: string; quickBuild?: BuildInput | null };
const isoDate = (v: unknown) => typeof v === "string" && v.length <= 32 && Number.isFinite(Date.parse(v)) ? v : undefined;
const empty = (): Vault => ({ accounts: [], active: null });
let transient: Vault | null = null;

function source(): Vault | string | null {
  if (transient) return transient;
  try { return localStorage.getItem(LOCAL_ACCOUNT_KEY); } catch { return null; }
}
function read(text = source()): Vault {
  if (text && typeof text === "object") return text;
  try {
    if (!text || text.length > 64_000) return empty();
    const value = JSON.parse(text) as Partial<Vault> | null;
    if (!value || !Array.isArray(value.accounts)) return empty();
    return {
      active: typeof value.active === "string" ? value.active : null,
      quickSince: isoDate(value.quickSince),
      quickBuild: readSavedBuild(value.quickBuild),
      accounts: value.accounts.slice(0, MAX_LOCAL).flatMap((item) => {
        if (!item || typeof item.login !== "string" || typeof item.name !== "string" || typeof item.hash !== "string" ||
          item.login.length > 254 || !item.name.trim() || !localHash.test(item.hash)) return [];
        return [{ registeredAt: isoDate(item.registeredAt), login: item.login, name: item.name.slice(0, 36), hash: item.hash,
          build: readSavedBuild(item.build) }];
      }),
    };
  } catch { return empty(); }
}

const SESSION_CHANGE = "rustflow:device-session";
let cachedSource: ReturnType<typeof source> | undefined;
let cachedUser: PlayerAccount | null = null;
export function subscribeLocalAccount(fn: () => void) {
  const storage = (event: StorageEvent) => { if (event.key === LOCAL_ACCOUNT_KEY || event.key === null) fn(); };
  window.addEventListener(SESSION_CHANGE, fn); window.addEventListener("storage", storage);
  return () => { window.removeEventListener(SESSION_CHANGE, fn); window.removeEventListener("storage", storage); };
}

function write(vault: Vault) {
  try { localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(vault)); transient = null; }
  catch { transient = vault; } // Sandboxed iframes may forbid persistent storage entirely.
  cachedSource = undefined;
  window.dispatchEvent(new Event(SESSION_CHANGE));
}

function publicAccount(record: Record): PlayerAccount {
  return { id: `device:${record.login}`, name: record.name, registeredAt: record.registeredAt, avatar: null, kind: "local", build: record.build };
}

export function localAccount(): PlayerAccount | null {
  const raw = source();
  if (raw === cachedSource) return cachedUser;
  const vault = read(raw);
  const record = vault.accounts.find((account) => account.login === vault.active);
  cachedSource = raw;
  cachedUser = vault.active === QUICK_LOGIN ? { id: QUICK_ID, registeredAt: vault.quickSince, name: "Игрок RustFlow", kind: "local", avatar: null, build: vault.quickBuild ?? null }
    : record ? publicAccount(record) : null;
  return cachedUser;
}
export const isEphemeralAccount = () => transient !== null;

export function quickLocalSignIn() { const v = read(); write({ ...v, quickSince: v.quickSince ?? new Date().toISOString(), active: QUICK_LOGIN }); }

export async function localPassword(mode: PasswordMode, fields: { login?: unknown; password?: unknown; confirm?: unknown }, createOnFirstLogin = false) {
  const login = typeof fields.login === "string" ? fields.login.normalize("NFKC").trim().toLowerCase() : "";
  const password = fields.password;
  if (!login || login.length > 254 || /\p{C}/u.test(login) || typeof password !== "string" || !password.length || password.length > 128)
    throw new Error("Введите непустой логин (до 254 символов) и пароль (до 128 символов).");
  if (mode === "register" && fields.confirm !== password) throw new Error("Пароли не совпадают.");
  const name = Array.from(login.split("@")[0] || login).slice(0, 36).join("");
  let existing = read().accounts.find((account) => account.login === login);
  if (mode === "register" || (!existing && createOnFirstLogin)) {
    if (existing) throw new Error("Локальный логин уже занят. Войдите или выберите другой.");
    const { hashPassword } = await import("./password-digest");
    const digest = await hashPassword(password, 10);
    const current = read();
    if (current.accounts.some((account) => account.login === login)) throw new Error("Локальный логин уже занят.");
    if (current.accounts.length >= MAX_LOCAL) throw new Error("В браузере уже сохранено 20 локальных профилей.");
    existing = { registeredAt: new Date().toISOString(), login, name, hash: digest, build: null };
    write({ ...current, accounts: [...current.accounts, existing], active: login });
  } else {
    const { verifyPassword } = await import("./password-digest");
    if (!existing || !await verifyPassword(password, existing.hash)) throw new Error("Неверный логин или пароль локального профиля.");
    const current = read();
    if (!current.accounts.some((account) => account.login === login && account.hash === existing?.hash)) throw new Error("Локальный профиль изменился. Попробуйте ещё раз.");
    write({ ...current, active: login });
  }
  return publicAccount(existing);
}

export function saveLocalBuild(expected: string, input: BuildInput) {
  const vault = read();
  const record = vault.accounts.find((account) => account.login === vault.active);
  const quick = vault.active === QUICK_LOGIN && expected === QUICK_ID;
  if (!quick && (!record || publicAccount(record).id !== expected)) throw new Error("Локальный профиль изменился. Снова откройте профиль перед сохранением.");
  const build = profileBuild(input);
  if (!build) throw new Error("Проверьте параметры сборки.");
  if (quick) vault.quickBuild = build; else if (record) record.build = build;
  write(vault);
}

export function signOutLocal() {
  const vault = read();
  if (vault.active) write({ ...vault, active: null });
}
