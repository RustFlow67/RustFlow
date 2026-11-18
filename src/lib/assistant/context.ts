import { isValidBuildInput, type BuildInput } from "@/lib/models/build";

export type AssistantBuild = Omit<BuildInput, "name">;

/** Project only hardware settings, never the profile name, owner ID, or measurements. */
export function assistantBuild(value: unknown): AssistantBuild | null {
  if (!value || typeof value !== "object") return null;
  const { cpuId, gpuId, ramGb, ramMhz, ramCl, storage, resolution, customResolution } = value as Partial<BuildInput>;
  const candidate = { name: "", cpuId, gpuId, ramGb, ramMhz, ramCl, storage, resolution, customResolution };
  if (typeof resolution !== "string" || !isValidBuildInput(candidate)) return null;
  const size = candidate.resolution === "custom" && candidate.customResolution;
  return {
    cpuId: candidate.cpuId, gpuId: candidate.gpuId, ramGb: candidate.ramGb,
    ramMhz: candidate.ramMhz, ramCl: candidate.ramCl, storage: candidate.storage,
    resolution: candidate.resolution, ...(size ? { customResolution: { width: size.width, height: size.height } } : {}),
  };
}

let current: { build: AssistantBuild | null } | undefined;

/** The live calculator draft takes precedence over the saved build while mounted. */
export function publishAssistantBuild(input: BuildInput): () => void {
  const registration = { build: assistantBuild(input) };
  current = registration;
  return () => { if (current === registration) current = undefined; };
}

export const currentAssistantBuild = () => current?.build;
