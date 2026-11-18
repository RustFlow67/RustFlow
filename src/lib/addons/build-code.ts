import { isValidBuildInput, type BuildInput } from "@/lib/models/build";

const FIXED_VERSION = 1;
const CUSTOM_VERSION = 2;
const SETTINGS_VERSION = 3;

/** Only hardware and settings travel in the fragment; no title, ownerId or scores. */
export function encodeBuildCode(input: BuildInput): string | null {
  if (!isValidBuildInput(input)) return null;
  const dimensions = input.resolution === "custom" ? input.customResolution : undefined;
  const { memoryType, biosProfile, monitorHz, connection } = input;
  const settings = [memoryType, biosProfile, monitorHz, connection];
  const tuned = settings.some((value) => value !== undefined);
  const data = [tuned ? SETTINGS_VERSION : dimensions ? CUSTOM_VERSION : FIXED_VERSION, input.cpuId, input.gpuId, input.ramGb,
    input.ramMhz, input.ramCl, input.storage, input.resolution,
    ...(tuned ? [dimensions?.width ?? null, dimensions?.height ?? null, ...settings] : dimensions ? [dimensions.width, dimensions.height] : [])];
  return btoa(JSON.stringify(data)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

export function decodeBuildCode(code: string): BuildInput | null {
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(code)) return null;
  try {
    const raw: unknown = JSON.parse(atob(code.replaceAll("-", "+").replaceAll("_", "/")));
    if (!Array.isArray(raw)) return null;
    const custom = raw[7] === "custom";
    const tuned = raw[0] === SETTINGS_VERSION && raw.length === 14;
    if (!tuned && !(custom ? raw[0] === CUSTOM_VERSION && raw.length === 10 : raw[0] === FIXED_VERSION && raw.length === 8)) return null;
    const input = {
      name: "Сборка из ссылки", cpuId: raw[1], gpuId: raw[2], ramGb: raw[3],
      ramMhz: raw[4], ramCl: raw[5], storage: raw[6], resolution: raw[7],
      ...(custom ? { customResolution: { width: raw[8], height: raw[9] } } : {}),
      ...(tuned ? { memoryType: raw[10] ?? undefined, biosProfile: raw[11] ?? undefined, monitorHz: raw[12] ?? undefined, connection: raw[13] ?? undefined } : {}),
    };
    return isValidBuildInput(input) ? input : null;
  } catch {
    return null;
  }
}
