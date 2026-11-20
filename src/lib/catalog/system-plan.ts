import { getGpu } from "@/lib/hardware";
import { evaluateBuild10, isValidBuildInput, type BuildInput } from "@/lib/models/build";
import { hardwareDistance, type PresetSignature } from "./ranking";
import { fitsVendor, fitsWindows, packEligible } from "@/lib/tweaker";
import type { TweakLite } from "@/lib/tweaks/types";
import type { GraphicsProfileId } from "@/lib/graphics-profiles";
import { gcBudget } from "@/lib/models/play-settings";

export type PlanIndex = {
  presets: PresetSignature[];
  steps: Pick<TweakLite, "slug" | "riskLevel" | "evidence" | "excludeFromPack" | "windowsVersion">[];
};
export function systemPlan(
  input: BuildInput,
  mode: GraphicsProfileId,
  index: PlanIndex,
  result = evaluateBuild10(input, mode),
) {
  if (!result || !index.presets.length) return null;
  const vendor = getGpu(input.gpuId)!.vendor;
  const best = index.presets.reduce((a, b) =>
    hardwareDistance(b, input) < hardwareDistance(a, input) ? b : a,
  );
  const allowed = new Set(
    index.steps
      .filter(
        (t) =>
          t.riskLevel === "safe" &&
          packEligible(t) &&
          fitsVendor(t.slug, vendor) &&
          fitsWindows(t, input.windowsVersion),
      )
      .map((t) => t.slug),
  );
  const slugs = result.recommendations.map((r) => r.slug).filter((s) => allowed.has(s));
  return { input, mode, best, slugs, gc: gcBudget(input.ramGb, input).mb, vendor, vram: result.vramGb };
}
// Active builds follow the reactive store (including changes in another tab).
// A calculator preview is not a save: transfer only its validated hardware
// settings, never a profile ID, nickname, tweak scripts or an arbitrary URL.
export function systemPlanHref(input: BuildInput, mode: GraphicsProfileId, live: boolean) {
  if (live) return "/tweaker?auto=live";
  const p = new URLSearchParams({ auto: "preview", graphicsProfile: mode });
  for (const key of seedKeys) {
    const v = input[key];
    if (v !== undefined && key !== "graphicsProfile") p.set(key, String(v));
  }
  if (input.resolution === "custom" && input.customResolution) {
    p.set("w", String(input.customResolution.width));
    p.set("h", String(input.customResolution.height));
  }
  return `/tweaker?${p}`;
}
const seedKeys = [
  "cpuId",
  "gpuId",
  "ramGb",
  "ramMhz",
  "ramCl",
  "memoryType",
  "resolution",
  "storage",
  "nvmeGen",
  "diskCache",
  "diskFill",
  "windowsVersion",
  "biosProfile",
  "monitorHz",
  "connection",
  "graphicsProfile",
  "scenario",
  "latencyMode",
  "backgroundLoad",
  "gcBuffer",
  "renderStyle",
] as const;
const numbers = new Set<string>(["ramGb", "ramMhz", "ramCl", "nvmeGen", "monitorHz"]);
export function readPlanSeed(query: Record<string, unknown>) {
  const raw: Record<string, unknown> = { name: "Предпросмотр сборки" };
  for (const key of seedKeys) {
    const v = query[key];
    if (v === undefined) continue;
    if (typeof v !== "string" || v.length > 80 || (numbers.has(key) && !/^\d{1,5}$/.test(v))) return null;
    raw[key] = numbers.has(key) ? Number(v) : v;
  }
  if (raw.resolution === "custom") {
    if (![query.w, query.h].every((v) => typeof v === "string" && /^\d{3,4}$/.test(v))) return null;
    raw.customResolution = { width: Number(query.w), height: Number(query.h) };
  }
  return isValidBuildInput(raw) ? raw : null;
}
