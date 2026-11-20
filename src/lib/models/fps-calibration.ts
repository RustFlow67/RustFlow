import { getGraphicsProfile, type GraphicsProfileId } from "@/lib/graphics-profiles";
import type { Cpu, Gpu } from "@/lib/hardware";
import type { BuildInput, FpsRangeEstimate } from "./build";
import { getBiosProfile, getMemoryType } from "./build-settings";
import { driveEstimate } from "./drive";
import { clamp, round1 } from "./common";

import { backgroundBudget, gcBudget, PLAY_OPTIONS, supportedLatency, type RustScenario } from "./play-settings";
export type { RustScenario } from "./play-settings";

/** Estimated centers for 1080p Combat, no upscaling or frame generation.
 *  The user-supplied benchmark bands define the anchors, not measured records. */
const CPU_ANCHORS: readonly (readonly [index: number, modded: number, official: number, lowModded: number, lowOfficial: number])[] = [
  [14, 39, 29, 23, 16], [32, 75, 57, 45, 43], [45, 82, 63, 49, 46], [55, 87, 69, 54, 49],
  [61, 112, 90, 65, 63], [68, 113, 92, 67, 65], [76, 137, 112, 82, 76], [83, 139, 115, 85, 79],
  [93, 151, 125, 90, 83], [100, 157, 128, 94, 86],
];
const CACHE_ANCHORS: typeof CPU_ANCHORS = [
  [76, 157, 124, 93, 88], [82, 162, 130, 100, 94], [90, 180, 145, 110, 103],
  [95, 199, 164, 123, 115], [100, 214, 176, 130, 122],
];

function cpuTargets(cpu: Cpu) {
  const anchors = cpu.id.includes("x3d") ? CACHE_ANCHORS : CPU_ANCHORS;
  const next = anchors.findIndex(([index]) => index >= cpu.idx);
  if (next <= 0) return next === 0 ? anchors[0] : anchors[anchors.length - 1];
  const [a, b] = [anchors[next - 1], anchors[next]];
  const t = (cpu.idx - a[0]) / (b[0] - a[0]);
  return a.map((v, i) => v + (b[i] - v) * t);
}

export function calibratedFps(input: BuildInput, cpu: Cpu, gpu: Gpu, pixels: number, mode: GraphicsProfileId | null, scenario: RustScenario = input.scenario ?? "coast", textureLimit?: number) {
  const profile = getGraphicsProfile(mode ?? input.graphicsProfile) ?? getGraphicsProfile("competitive")!;
  const scene = PLAY_OPTIONS.scenario.find(item => item.value === scenario) ?? PLAY_OPTIONS.scenario[0];
  const [, baseModded, baseOfficial, lowModded, lowOfficial] = cpuTargets(cpu);
  const ddr5 = getMemoryType(input) === "DDR5";
  const bios = getBiosProfile(input.biosProfile);
  const memLatency = (input.ramCl * 2000) / input.ramMhz;
  const baselineLatency = ddr5 ? 10 : 8.89;
  const speed = clamp(1 + .09 * Math.log2(input.ramMhz / (ddr5 ? 6000 : 3600)) + .095 * Math.log2(baselineLatency / memLatency), .81, 1.08);
  const cpuRam = 1 + (speed - 1) * (cpu.id.includes("x3d") ? .43 : .78);
  const lowRam = 1 + (speed - 1) * .46;
  // Workload estimates, not measured gains. Background jobs compete for memory
  // and main-thread time. Too small a GC buffer collects often; too big pages out.
  const bg = backgroundBudget(input), gc = gcBudget(input.ramGb, input);
  const contention = bg.cpuCost * (1.25 - cpu.idx / 200);
  const mismatch = Math.abs(Math.log2(gc.mb / gc.auto));
  const latency = supportedLatency(input.latencyMode, gpu.vendor);
  // A shorter render queue is a latency trade-off, not free frames.
  const queue = latency === "on" ? .98 : latency === "boost" ? .992 : 1;
  const render = input.renderStyle;
  const capacity = gc.available >= 32 ? 1 : gc.available >= 24 ? .994 : gc.available >= 16 ? .98 : gc.available >= 12 ? .88 : .72;
  const lowCapacity = gc.available >= 32 ? 1 : gc.available >= 24 ? .984 : gc.available >= 16 ? .94 : gc.available >= 12 ? .72 : .53;
  // Disk I/O changes streaming tails, not steady-state render throughput.
  const storageLow = driveEstimate(input).lowMultiplier;
  const area = pixels / (1920 * 1080);
  const vramNeeded = (profile.shadows > 0 ? 6 : 4) + Math.max(0, Math.log2(area)) * 2;
  const pressure = clamp((vramNeeded - gpu.vram) / vramNeeded, 0, .65) * (textureLimit === 3 ? .24 : 1);
  const gpuCap = (43 + gpu.idx * 2.04) * clamp(Math.pow(area, -.58), .24, 1.45) * profile.gpu * (render === "esports" ? 1.055 : render === "clear" ? .91 : 1) * scene.gpu * (1 - pressure * .34);
  const cpuMul = cpuRam * (bios?.cpu ?? 1) * (bios?.ram ?? 1) * profile.cpu * (render === "esports" ? 1.025 : render === "clear" ? .975 : 1) * scene.cpu * (1 - contention);
  const cpuModded = baseModded * cpuMul;
  const cpuOfficial = baseOfficial * cpuMul;

  function range(cpuCap: number, gpuCap: number, lowAnchor: number, spread: number): FpsRangeEstimate {
    const center = Math.min(cpuCap, gpuCap) * capacity * queue * (1 - mismatch * .018);
    const min = Math.max(1, Math.round(center * (1 - spread)));
    const max = Math.max(min + 1, Math.round(center * (1 + spread)));
    const low = Math.min(center * .77, lowAnchor * cpuMul * Math.min(1, gpuCap / cpuCap)) * (1 - mismatch * .055) * queue * (1 - contention * .5) * lowCapacity * lowRam * storageLow * scene.low * (bios?.low ?? 1) * (1 - pressure * .41);
    const low1 = Math.max(1, Math.min(min, Math.round(low)));
    return { min, max, low1 };
  }
  return {
    modded: range(cpuModded, gpuCap, lowModded, .072), official: range(cpuOfficial, gpuCap * .93, lowOfficial, .066),
    vramPressure: pressure, cpuModded, cpuOfficial, gpuModded: gpuCap, gpuOfficial: gpuCap * .93,
  };
}

export const avgFps = ({ min, max }: FpsRangeEstimate) => (min + max) / 2;
export const frameMs = (fps: FpsRangeEstimate) => round1(1000 / avgFps(fps));
