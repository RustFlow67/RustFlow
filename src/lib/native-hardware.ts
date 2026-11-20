import { CPUS, GPUS, type StorageId } from "./hardware";
import { isValidBuildInput, type BuildInput } from "./models/build";
import { isWindows, requiredMemory, type WindowsVersion } from "./models/build-settings";

export interface DetectedHardware {
  cpu: string;
  gpu: string;
  ramGb: number;
  ramMhz?: number;
  storage?: StorageId | null;
  windowsVersion?: WindowsVersion;
}

// Exact normalized matches only: 4070 is not 4070 Ti, and laptop variants
// must not silently inherit desktop performance estimates.
function normalize(name: string) {
  return name.toLowerCase().replace(/\([rtm]+\)/g, " ")
    .replace(/@.*/, " ").replace(/\b(?:amd|intel|nvidia|processor|cpu)\b/g, " ")
    .replace(/\b\d+-core\b/g, " ").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function exact<T extends { name: string }>(name: string, items: readonly T[]): T | undefined {
  const normalized = normalize(name);
  if (!normalized) return undefined;
  const matches = items.filter(item => normalize(item.name) === normalized);
  return matches.length === 1 ? matches[0] : undefined;
}

/** The calculator also requires CAS latency and resolution, which WMI does
 * not reliably provide. These are explicit estimates, not detected facts. */
export function detectedBuild(info: DetectedHardware): BuildInput | undefined {
  const cpu = exact(info.cpu, CPUS), gpu = exact(info.gpu, GPUS);
  if (!cpu || !gpu || !info.storage || !info.ramMhz || !isWindows(info.windowsVersion)) return;
  const memoryType = requiredMemory(cpu.id) ?? (info.ramMhz >= 4800 ? "DDR5" : "DDR4");
  const build: BuildInput = {
    name: "Обнаруженный ПК", cpuId: cpu.id, gpuId: gpu.id,
    ramGb: info.ramGb, ramMhz: info.ramMhz, memoryType,
    ramCl: memoryType === "DDR5" ? 40 : 22,
    storage: info.storage, windowsVersion: info.windowsVersion, resolution: "1080p",
  };
  return isValidBuildInput(build) ? build : undefined;
}
