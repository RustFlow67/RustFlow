"use client";

import { useId } from "react";
import { Star } from "lucide-react";
import { readFavorites } from "@/lib/favorites";
import { useAddonValue } from "@/lib/addons/progress";
import { storage } from "@/lib/storage/adapter";

type Kind = "tweak" | "preset";
export function decodeFavorites(value: unknown): Record<Kind, string[]> {
  return readFavorites(value) ?? { tweak: [], preset: [] };
}
export const useFavorites = () => useAddonValue("favorites", decodeFavorites);

export function FavoriteButton({ kind, slug, title, active }: { kind: Kind; slug: string; title: string; active: boolean }) {
  const gradient = useId();
  return <button type="button" className="favorite-drop" aria-pressed={active} title="Избранное"
    aria-label={`Избранное: ${title}`} onClick={() => storage.addons.update("favorites", decodeFavorites, (saved) => ({ ...saved,
      [kind]: saved[kind].includes(slug) ? saved[kind].filter((s) => s !== slug) : [slug, ...saved[kind]].slice(0, 64),
    }))}>
    <Star size={18} aria-hidden="true" fill={active ? `url(#${gradient})` : "none"}>
      <defs><linearGradient id={gradient} x1="0%" y1="100%" x2="100%" y2="0%"><stop stopColor="var(--theme-accent)" /><stop offset="1" stopColor="var(--theme-tip)" /></linearGradient></defs>
    </Star>
  </button>;
}
