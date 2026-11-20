import { isValidBuildInput, type BuildInput } from "./build";
import { defaultMemoryKit, getMemoryType, isRamValue, MEMORY_LIMITS } from "./build-settings";
import { MAX_PRESET_HEIGHT, MAX_RESOLUTION_DIMENSION } from "./build-resolution";

/** Read compatibility only. A record legal in the old editor isn't a reason
 * to drop the whole rig. New edits/API submissions still use strict bounds. */
export function readSavedBuild(raw: unknown): BuildInput | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const old: Partial<BuildInput> = raw;
  if (isValidBuildInput(old)) return old;
  const input = { ...raw } as Partial<BuildInput>;
  if (
    typeof input.cpuId !== "string" ||
    !isRamValue(input.ramMhz, { min: 1600, max: 9600 }) ||
    !isRamValue(input.ramCl, { min: 10, max: 60 })
  )
    return null;
  const memory = getMemoryType({ cpuId: input.cpuId, ramMhz: input.ramMhz, memoryType: input.memoryType }),
    limits = MEMORY_LIMITS[memory];
  if (memory !== "DDR4" && memory !== "DDR5") return null;
  input.ramMhz = Math.max(limits.speed.min, Math.min(limits.speed.max, input.ramMhz));
  if (!isRamValue(input.ramCl, limits.cl)) input.ramCl = defaultMemoryKit(memory).ramCl;
  const size = input.customResolution;
  if (
    input.resolution === "custom" &&
    size &&
    Number.isInteger(size.height) &&
    size.height > MAX_PRESET_HEIGHT &&
    size.height <= MAX_RESOLUTION_DIMENSION
  )
    input.customResolution = { width: size.width, height: MAX_PRESET_HEIGHT };
  return isValidBuildInput(input) ? input : null;
}
