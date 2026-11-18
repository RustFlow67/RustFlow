"use client";

import { isValidBuildInput, type BuildInput } from "@/lib/models/build";
import { credentials, type PasswordMode } from "./credentials";
import type { PlayerAccount } from "./types";

export const LOCAL_ACCOUNT_KEY = "rf.local-accounts.v1";
const MAX_LOCAL = 20;
const localHash = /^\$2b\$10\$[./A-Za-z0-9]{53}$/;
type Record = { login: string; name: string; hash: string; build: BuildInput | null };
type Vault = { accounts: Record[]; active: string | null };
const empty = (): Vault => ({ accounts: [], active: null });
let transient: Vault | null = null;

function read(): Vault {
  if (transient) return transient;
  try {
    const text = localStorage.getItem(LOCAL_ACCOUNT_KEY);
    if (!text || text.length > 64_000) return empty();
    const value = JSON.parse(text) as Partial<Vault> | null;
    if (!value || !Array.isArray(value.accounts)) return empty();
    return {
      active: typeof value.active === "string" ? value.active : null,
      accounts: value.accounts.slice(0, MAX_LOCAL).flatMap((item) => {
        if (!item || typeof item.login !== "string" || typeof item.name !== "string" || typeof item.hash !== "string" ||
          item.login.length > 254 || !item.name.trim() || !localHash.test(item.hash)) return [];
        return [{ login: item.login, name: item.name.slice(0, 36), hash: item.hash,
          build: item.build && isValidBuildInput(item.build) ? item.build : null }];
      }),
    };
  } catch { return empty(); }
}

function write(vault: Vault) {
  try { localStorage.setItem(LOCAL_ACCOUNT_KEY, JSON.stringify(vault)); transient = null; }
  catch { transient = vault; } // Sandboxed iframes may forbid persistent storage entirely.
}

function publicAccount(record: Record): PlayerAccount {
  return { id: `device:${record.login}`, name: record.name, avatar: null, kind: "local", build: record.build };
}

export function localAccount() {
  const vault = read();
  const record = vault.accounts.find((account) => account.login === vault.active);
  return record ? publicAccount(record) : null;
}
export const isEphemeralAccount = () => transient !== null;

export async function localPassword(mode: PasswordMode, fields: Parameters<typeof credentials>[0]) {
  const parsed = credentials(fields, mode);
  if (parsed.error) throw new Error(parsed.error);
  const { login, password, name } = parsed;
  let existing = read().accounts.find((account) => account.login === login);
  if (mode === "register") {
    if (existing) throw new Error("Локальный логин уже занят. Войдите или выберите другой.");
    const { hashPassword } = await import("./password-digest");
    const digest = await hashPassword(password, 10);
    const current = read();
    if (current.accounts.some((account) => account.login === login)) throw new Error("Локальный логин уже занят.");
    if (current.accounts.length >= MAX_LOCAL) throw new Error("В браузере уже сохранено 20 локальных профилей.");
    existing = { login, name, hash: digest, build: null };
    write({ accounts: [...current.accounts, existing], active: login });
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
  if (!record || publicAccount(record).id !== expected) throw new Error("Локальный профиль изменился. Снова откройте профиль перед сохранением.");
  if (!isValidBuildInput(input)) throw new Error("Проверьте параметры сборки.");
  const { name, cpuId, gpuId, ramGb, ramMhz, ramCl, storage, resolution, customResolution, memoryType, biosProfile, monitorHz, connection } = input;
  record.build = { name: name.trim().slice(0, 80) || "Моя сборка", cpuId, gpuId, ramGb, ramMhz, ramCl, storage, resolution, memoryType, biosProfile, monitorHz, connection,
    ...(resolution === "custom" && customResolution ? { customResolution: { width: customResolution.width, height: customResolution.height } } : {}) };
  write(vault);
  return publicAccount(record);
}

export function signOutLocal() {
  const vault = read();
  if (vault.active) write({ ...vault, active: null });
}
