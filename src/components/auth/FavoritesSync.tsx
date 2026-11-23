"use client";

import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import { readFavorites } from "@/lib/auth/favorites";
import { storage } from "@/lib/storage/adapter";
import { decodeFavorites } from "@/components/addons/Favorites";
import { accountHeaders } from "./AccountProvider";

/** Explicit direction avoids silently overwriting another device's edits. */
export default function FavoritesSync({ accountId }: { accountId: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), [accountId]);
  async function sync(direction: "upload" | "download") {
    if (busy) return;
    setBusy(true); setMessage("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const url = new URL(apiUrl("auth/favorites"), window.location.href);
      if (url.origin !== window.location.origin) throw new Error();
      const response = await fetch(url, { method: direction === "upload" ? "PUT" : "GET", credentials: "same-origin", cache: "no-store", redirect: "error", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(7500)]),
        headers: accountHeaders(direction === "upload" ? { "Content-Type": "application/json" } : undefined),
        ...(direction === "upload" ? { body: JSON.stringify({ expectedAccount: accountId, favorites: decodeFavorites(storage.addons.getSnapshot().favorites) }) } : {}) });
      const data = await response.json() as { accountId?: string; favorites?: unknown };
      if (!response.ok || data.accountId !== accountId) throw new Error();
      if (direction === "download") {
        const favorites = readFavorites(data.favorites);
        if (!favorites) { setMessage("В аккаунте пока нет сохранённого избранного."); return; }
        storage.addons.update("favorites", decodeFavorites, () => favorites);
      }
      setMessage(direction === "upload" ? "Избранное сохранено в аккаунте." : "Избранное восстановлено на устройстве.");
    } catch { if (!abort.signal.aborted) setMessage("Не удалось синхронизировать избранное. Проверьте соединение и аккаунт."); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  return <div className="cabinet-library">
    <p>Избранные твики и пресеты: сохранение заменит копию в аккаунте, восстановление — список на этом устройстве.</p>
    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void sync("upload")}>Сохранить избранное в аккаунт</button>
    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void sync("download")}>Восстановить избранное из аккаунта</button>
    {message && <p role="status">{message}</p>}
  </div>;
}
