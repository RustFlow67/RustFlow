import type { BuildInput } from "@/lib/models/build";
import type { HardwarePreset } from "@/lib/models/preset";

export function presetBuildInput(preset: HardwarePreset): BuildInput {
  return {
    name: preset.title,
    cpuId: preset.cpuId,
    gpuId: preset.gpuId,
    ramGb: preset.ramGb,
    ramMhz: preset.ramMhz,
    ramCl: preset.ramCl,
    storage: preset.storageId,
    resolution: preset.resolution,
  };
}
