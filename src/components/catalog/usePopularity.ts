"use client";
import { useCallback,useEffect, useState } from "react";
import { apiUrl } from "@/lib/api-base";
import type { Collection } from "@/lib/catalog/keys";

const seen = new Set<string>();
export function usePopularity(section: Collection, popular: boolean) {
  const [counts, set] = useState<Record<string, number>>({}),
    [source, sourceIs] = useState("При равенстве — редакционный порядок.");
  const endpoint = `${apiUrl("catalog")}?section=${section}`;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(endpoint, { signal: controller.signal, cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = await r.json();
        if (controller.signal.aborted) return;
        set(data.counts ?? {});
        sourceIs(
          data.period === "instance"
            ? "По открытиям игроками с запуска сервера; при равенстве — редакционный порядок."
            : "По открытиям игроками; при равенстве — редакционный порядок.",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          set({});
          sourceIs("Статистика недоступна — редакционный порядок.");
        }
      });
    return () => controller.abort();
  }, [endpoint, popular]);
  const record=useCallback((id:string)=>{
    const key = `rustflow:opened:${section}:${id}`;
    if (seen.has(key)) return;
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {
      /* private session */
    }
    seen.add(key);
    void fetch(`${endpoint}&item=${encodeURIComponent(id)}`, {
      method: "POST",
      headers: { "X-RustFlow-Open": "1" },
      keepalive: true,
    })
      .then((r) => {
        if (!r.ok) throw Error();
        // Keep the current browse order stable under an open sheet. Refresh when
        // popularity is selected again or on the next visit.
        try {
          sessionStorage.setItem(key, "1");
        } catch {
          /* in-memory dedupe */
        }
      })
      .catch(() => seen.delete(key));
  },[endpoint,section]);
  return { counts, source, record };
}
