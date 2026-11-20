import { RESOLUTION_OPTIONS, type ResolutionId } from "@/lib/hardware";

export type BuildResolutionId = ResolutionId | "1440x1080" | "custom";

export interface ResolutionSize {
  width: number;
  height: number;
}

export interface BuildResolution {
  resolution: BuildResolutionId;
  customResolution?: ResolutionSize;
}

export const MIN_RESOLUTION_DIMENSION = 800;
export const MAX_RESOLUTION_DIMENSION = 7680;
export const MIN_RESOLUTION_HEIGHT = 600;
export const MAX_PRESET_HEIGHT = 4320;

export const RESOLUTION_SIZES: Readonly<Record<Exclude<BuildResolutionId, "custom">, Readonly<ResolutionSize>>> = {
  "1080p": { width: 1920, height: 1080 },
  "1440p": { width: 2560, height: 1440 },
  "4k": { width: 3840, height: 2160 },
  "1440x1080": { width: 1440, height: 1080 },
};

export const BUILD_RESOLUTION_OPTIONS: readonly { value: BuildResolutionId; label: string }[] = [
  ...RESOLUTION_OPTIONS.map(({ id, label }) => ({ value: id, label })),
  { value: "1440x1080", label: "1440×1080 (4:3)" },
  { value: "custom", label: "Кастомное" },
];

export function isResolutionDimension(value: unknown, axis: "width" | "height" = "width"): value is number {
  return typeof value === "number" && Number.isInteger(value) &&
    value >= (axis === "height" ? MIN_RESOLUTION_HEIGHT : MIN_RESOLUTION_DIMENSION) && value <= (axis === "height" ? MAX_PRESET_HEIGHT : MAX_RESOLUTION_DIMENSION);
}

export function getResolutionSize({ resolution, customResolution }: Partial<BuildResolution>): Readonly<ResolutionSize> | null {
  if (resolution === "custom") {
    return isResolutionDimension(customResolution?.width) && isResolutionDimension(customResolution?.height, "height")
      ? customResolution : null;
  }
  return typeof resolution === "string" && Object.hasOwn(RESOLUTION_SIZES, resolution) ? RESOLUTION_SIZES[resolution] : null;
}

export function formatBuildResolution(input: BuildResolution): string {
  if (input.resolution === "custom") {
    const size = getResolutionSize(input);
    return size ? `${size.width}×${size.height}` : "Кастомное";
  }
  return BUILD_RESOLUTION_OPTIONS.find(({ value }) => value === input.resolution)?.label ?? "—";
}
