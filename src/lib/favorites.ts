export type Favorites = { tweak: string[]; preset: string[] };
export function readFavorites(value: unknown): Favorites | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const parse = (v: unknown) => Array.isArray(v) && v.length <= 64 && v.every((s) => typeof s === "string" && /^[a-z0-9-]{1,64}$/.test(s)) ? [...new Set(v as string[])] : null;
  const tweak = parse(data.tweak), preset = parse(data.preset);
  return tweak && preset ? { tweak, preset } : null;
}
