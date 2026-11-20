import { getCpu, getGpu } from "@/lib/hardware";
import type { BuildInput } from "@/lib/models/build";
import { getResolutionSize } from "@/lib/models/build-resolution";
import type { HardwarePreset } from "@/lib/models/preset";
import type { TweakLite } from "@/lib/tweaks/types";

export const TWEAK_SORTS = [
  { value: "effective", label: "Сначала самые эффективные" },
  { value: "fps", label: "По максимальному приросту FPS" },
  { value: "safe", label: "Только безопасные для EAC" },
  { value: "favorite", label: "Сначала избранные" },
] as const;
export const READING_SORTS = [
  { value: "important", label: "Сначала самые важные" },
  { value: "popular", label: "Популярные" },
  { value: "az", label: "По алфавиту" },
] as const;
export type TweakSort = (typeof TWEAK_SORTS)[number]["value"];
export type ReadingSort = (typeof READING_SORTS)[number]["value"];
export const tokens = (s: string) =>
  s.toLocaleLowerCase("ru").replaceAll("ё", "е").trim().split(/\s+/).filter(Boolean);
export const matches = (q: string[], text: string) => {
  const h = text.toLocaleLowerCase("ru").replaceAll("ё", "е");
  return q.every((t) => h.includes(t));
};
const top = ["nvidia-panel", "amd-adrenalin", "gc-buffer", "xmp-expo-timings"];
export const topPick = (t: TweakLite) =>
  top.includes(t.slug) && t.evidence !== "myth" && t.riskLevel !== "harmful";
export const safePick = (t: TweakLite) => t.riskLevel === "safe" && t.evidence !== "myth" && !t.excludeFromPack;
// Editorial order of conditional average-FPS opportunities, not percentage
// promises. Keep GC/latency/free RAM separate from average render throughput.
const fpsOrder = ["xmp-expo-timings", "game-mode-dvr", "steam-checklist", "visual-effects"];
const fpsRank = (t: TweakLite) => {
  const i = fpsOrder.indexOf(t.slug);
  return i === -1 ? 0 : fpsOrder.length - i;
};
export function rankTweaks<T extends TweakLite>(
  list: readonly T[],
  sort: TweakSort,
  favorites: readonly string[],
) {
  const priority = (t: T) =>
    topPick(t)
      ? 200 - top.indexOf(t.slug)
      : t.slug === "clean-temp-cache"
        ? 1
        : t.evidence === "myth" || t.riskLevel === "harmful"
          ? -1
          : 5 + t.impact.fps * 3 + t.impact.smooth * 2 + t.impact.latency;
  return list
    .filter((t) => sort !== "safe" || safePick(t))
    .sort(
      (a, b) =>
        (sort === "favorite"
          ? Number(favorites.includes(b.slug)) - Number(favorites.includes(a.slug))
          : sort === "fps"
            ? fpsRank(b) - fpsRank(a)
            : 0) ||
        priority(b) - priority(a) ||
        a.order - b.order,
    );
}
/** Distance in CPU/GPU performance, memory and vendor, not the price tier.
 * Exact hardware matches win before nearest-neighbour estimates. */
export type PresetSignature = Pick<
  HardwarePreset,
  "slug" | "title" | "cpuId" | "gpuId" | "resolution" | "ramGb"
>;
export function hardwareDistance(p: PresetSignature, b: BuildInput) {
  const cpu = getCpu(b.cpuId),
    gpu = getGpu(b.gpuId),
    pc = getCpu(p.cpuId),
    pg = getGpu(p.gpuId);
  if (!cpu || !gpu || !pc || !pg) return Infinity;
  const native = getResolutionSize(p),
    display = getResolutionSize(b);
  if (!native || !display) return Infinity;
  const screen =
    8 * Math.abs(Math.log2((native.width * native.height) / (display.width * display.height))) +
    3 * Math.abs(Math.log2(native.width / native.height / (display.width / display.height)));
  return (
    screen +
    0.43 * Math.abs(cpu.idx - pc.idx) +
    0.42 * Math.abs(gpu.idx - pg.idx) +
    0.001 * Math.abs(Math.log2(p.ramGb / b.ramGb)) /* RAM breaks equivalent hardware/display matches */ +
    Number(b.cpuId !== p.cpuId) +
    Number(b.gpuId !== p.gpuId) +
    2 * Number(gpu.vendor !== pg.vendor)
  );
}
