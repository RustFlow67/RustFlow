"use client";

import { Star } from "lucide-react";
import { useAddonValue } from "@/lib/addons/progress";
import { storage } from "@/lib/storage/adapter";

type Kind = "tweak" | "preset";
function slugs(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,64}$/.test(s)))].slice(0, 64) : [];
}
function decode(value: unknown): Record<Kind, string[]> {
  const raw = value && typeof value === "object" ? value as Partial<Record<Kind, unknown>> : {};
  return { tweak: slugs(raw.tweak), preset: slugs(raw.preset) };
}
export const useFavorites = () => useAddonValue("favorites", decode);

export function FavoriteButton({ kind, slug, title, active }: { kind: Kind; slug: string; title: string; active: boolean }) {
  return <button type="button" className="btn btn-sm !h-8 !w-8 !p-0" aria-pressed={active} title="Избранное"
    aria-label={`Избранное: ${title}`} onClick={() => storage.addons.update("favorites", decode, (saved) => ({ ...saved,
      [kind]: saved[kind].includes(slug) ? saved[kind].filter((s) => s !== slug) : [slug, ...saved[kind]].slice(0, 64),
    }))}>
    <Star className={active ? "text-accent-hi" : "text-ink-3"} fill={active ? "currentColor" : "none"} aria-hidden="true" />
  </button>;
}
