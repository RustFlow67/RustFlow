import type { TweakLite } from "./tweaks/types";
import type { StorageId } from "./hardware";
import { getConnectionProfile, isMonitorHz, type ConfigTuning } from "./models/build-settings";
import { apiUrl } from "./api-base";
import { getGraphicsProfile, type GraphicsProfileId } from "./graphics-profiles";

export type TweakerVendor = "nvidia" | "amd" | "intel";
export const isTweakerVendor = (v: unknown): v is TweakerVendor => v === "nvidia" || v === "amd" || v === "intel";

const SUPERSEDED = new Set(["preset-competitive", "preset-balanced", "preset-quality", "gc-buffer"]);
export const isSupersededTweak = (slug: string) => SUPERSEDED.has(slug);
export const packEligible = (t: { slug: string; riskLevel?: TweakLite["riskLevel"]; evidence?: TweakLite["evidence"]; excludeFromPack?: boolean }) =>
  !isSupersededTweak(t.slug) && !t.excludeFromPack && t.riskLevel !== "harmful" && t.evidence !== "myth";
export const fitsVendor = (slug: string, gpu: TweakerVendor) =>
  slug === "nvidia-panel" ? gpu === "nvidia" : slug === "amd-adrenalin" ? gpu === "amd" : true;

// Positive estimates alone aren't enough: include only audited, reversible,
// high-impact or stability/latency steps on the matching vendor's hardware.
const VERIFIED = new Set(["game-mode-dvr", "pagefile-auto", "nvidia-panel", "amd-adrenalin", "steam-checklist"]);
export const isRecommendedTweak = (t: TweakLite, gpu: TweakerVendor) =>
  VERIFIED.has(t.slug) && t.riskLevel === "safe" && t.evidence === "measured" && packEligible(t) && fitsVendor(t.slug, gpu);
export const isPackRam = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 4 && n <= 256;

export function tweakerHref(slug: string) {
  if (slug === "gc-buffer") return "/tweaker?group=ram-ssd";
  if (isSupersededTweak(slug)) return `/tweaker?mode=${slug.slice("preset-".length)}`;
  return `/tweaker?tweak=${encodeURIComponent(slug)}`;
}

export const isPlanVram = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 64;

function appendTuning(params: URLSearchParams, tuning?: ConfigTuning) {
  if (isMonitorHz(tuning?.monitorHz)) params.set("hz", String(tuning.monitorHz));
  if (tuning?.connection && getConnectionProfile(tuning.connection)) params.set("net", tuning.connection);
  return params;
}

export function personalPlanHref(mode: GraphicsProfileId, gpu: TweakerVendor, ram: number, vram: number, storage: StorageId, tuning?: ConfigTuning) {
  return `/tweaker?${appendTuning(new URLSearchParams({ mode, gpu, ram: String(Math.round(ram)), vram: String(vram), storage, pc: "1" }), tuning)}`;
}

export function packHref(slugs: readonly string[], mode: GraphicsProfileId, gpu: TweakerVendor, ram: number, vram?: number, tuning?: ConfigTuning) {
  const params = new URLSearchParams({ tweaks: slugs.join(","), mode, gpu, ram: String(ram) });
  if (isPlanVram(vram)) params.set("vram", String(vram));
  return `${apiUrl("pack")}?${appendTuning(params, tuning)}`;
}

export interface TweakerPreferences {
  mode: GraphicsProfileId;
  gpu: TweakerVendor | null;
  slugs: string[] | null;
}

export function readTweakerPreferences(input: unknown): TweakerPreferences | null {
  if (!input || typeof input !== "object") return null;
  const { mode, preset, gpu, slugs } = input as Partial<TweakerPreferences> & { preset?: unknown };
  const profile = getGraphicsProfile(mode ?? preset);
  if (!profile) return null;
  return {
    mode: profile.id,
    gpu: isTweakerVendor(gpu) ? gpu : null,
    slugs: Array.isArray(slugs) ? Array.from(new Set(slugs.slice(0, 64).filter((slug) => typeof slug === "string" && /^[a-z0-9-]{1,64}$/.test(slug)))) : null,
  };
}
