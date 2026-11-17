/**
 * Общие типы пользовательских записей (user-ready для Этапа 2).
 * Сейчас все записи создаются локально с ownerId = LOCAL_OWNER_ID,
 * в Этапе 2 поле заполнится идентификатором пользователя из auth/BaaS.
 */

export const SCHEMA_VERSION = 1 as const;
export const LOCAL_OWNER_ID = "local-user" as const;

export interface UserOwnedRecord {
  id: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
