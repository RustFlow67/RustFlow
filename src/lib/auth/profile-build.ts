import { isValidBuildInput, type BuildInput } from "@/lib/models/build";
import { readPlaySettings } from "@/lib/models/play-settings";

/** Both kinds of profile bind the same allowlisted build. A JSON import or
 * request may contain other fields; never copy those into the account record. */
export function profileBuild(raw: unknown): BuildInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input: Partial<BuildInput> = raw;
  if (typeof input.resolution !== "string" || !isValidBuildInput(input)) return null;
  const { name, cpuId, gpuId, ramGb, ramMhz, ramCl, storage, nvmeGen, diskCache, diskFill, resolution, memoryType, biosProfile,
    windowsVersion, monitorHz, connection, graphicsProfile, customResolution } = input;
  return { name: name.trim().slice(0, 80) || "Моя сборка", cpuId, gpuId, ramGb, ramMhz, ramCl,
    storage, nvmeGen, diskCache, diskFill, resolution, memoryType, biosProfile, windowsVersion, monitorHz, connection, graphicsProfile,
    ...readPlaySettings(k => input[k]),
    ...(resolution === "custom" && customResolution ? { customResolution: { width: customResolution.width, height: customResolution.height } } : {}),
  };
}
