"use client";

import { useId } from "react";
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
  const gradient = useId();
  return <button type="button" className="favorite-drop" aria-pressed={active} title="Избранное"
    aria-label={`Избранное: ${title}`} onClick={() => storage.addons.update("favorites", decode, (saved) => ({ ...saved,
      [kind]: saved[kind].includes(slug) ? saved[kind].filter((s) => s !== slug) : [slug, ...saved[kind]].slice(0, 64),
    }))}>
    <Star size={18} aria-hidden="true" fill={active ? `url(#${gradient})` : "none"}>
      <defs><linearGradient id={gradient} x1="0%" y1="100%" x2="100%" y2="0%"><stop stopColor="var(--theme-accent)" /><stop offset="1" stopColor="var(--theme-tip)" /></linearGradient></defs>
    </Star>
  </button>;
}
