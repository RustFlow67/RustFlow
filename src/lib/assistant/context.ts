import { isValidBuildInput, type BuildInput } from "@/lib/models/build";

export type AssistantBuild = Omit<BuildInput, "name">;

/** Project only hardware settings, never the profile name, owner ID, or measurements. */
export function assistantBuild(value: unknown): AssistantBuild | null {
  if (!value || typeof value !== "object") return null;
  const { cpuId, gpuId, ramGb, ramMhz, ramCl, storage, memoryType, windowsVersion, nvmeGen, diskCache, diskFill, resolution, customResolution } = value as Partial<BuildInput>;
  const candidate = { name: "", cpuId, gpuId, ramGb, ramMhz, ramCl, storage, memoryType, windowsVersion, nvmeGen, diskCache, diskFill, resolution, customResolution };
  if (typeof resolution !== "string" || !isValidBuildInput(candidate)) return null;
  const size = candidate.resolution === "custom" && candidate.customResolution;
  return {
    cpuId: candidate.cpuId, gpuId: candidate.gpuId, ramGb: candidate.ramGb,
    ramMhz: candidate.ramMhz, ramCl: candidate.ramCl, storage: candidate.storage, memoryType, windowsVersion, nvmeGen, diskCache, diskFill,
    resolution: candidate.resolution, ...(size ? { customResolution: { width: size.width, height: size.height } } : {}),
  };
}
