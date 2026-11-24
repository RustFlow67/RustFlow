"use client";
import { useCallback, useState } from "react";
import type { Collection } from "@/lib/catalog/keys";

/** Local, session-only ordering; no network telemetry. */
export function usePopularity(_section: Collection, _popular: boolean) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const record = useCallback((id: string) => setCounts(previous => ({ ...previous, [id]: (previous[id] ?? 0) + 1 })), []);
  return { counts, source: "Локальные открытия за текущий сеанс; при равенстве — редакционный порядок.", record };
}
