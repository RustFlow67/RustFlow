import "server-only";

import { clientAddress } from "@/lib/client-address";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const COOLDOWN = 5_000;
const MAX_PEERS = 8192;
const shared = globalThis as typeof globalThis & { __rfChatRequests?: Map<string, number[]> };
const hits = shared.__rfChatRequests ??= new Map<string, number[]>();

/** Reserve a slot synchronously before hitting the provider; only store timestamps. */
export function reserveQuestion(headers: Headers, now = Date.now()) {
  const ip = clientAddress(headers);
  const history = (hits.get(ip) ?? []).filter((stamp) => stamp + DAY > now);
  const recent = history.filter((stamp) => stamp + HOUR > now);
  const retry = (until: number, reason: string) => ({ seconds: Math.max(1, Math.ceil((until - now) / 1000)), reason });
  if (history.length >= 12) return retry(history[0] + DAY, "Достигнут лимит: 12 запросов за 24 часа.");
  if (recent.length >= 5) return retry(recent[0] + HOUR, "Достигнут лимит: 5 запросов за час.");
  const last = history.at(-1) ?? -Infinity;
  if (last + COOLDOWN > now) return retry(last + COOLDOWN, "Между запросами должно пройти 5 секунд.");
  if (!hits.has(ip) && hits.size >= MAX_PEERS) {
    for (const [key, list] of hits) if ((list.at(-1) ?? 0) + DAY <= now) hits.delete(key);
    if (hits.size >= MAX_PEERS) return retry(now + HOUR, "Помощник занят. Повторите позже.");
  }
  hits.set(ip, [...history, now]);
  return null;
}
