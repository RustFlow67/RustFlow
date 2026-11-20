import { presetBuildInput } from "@/lib/addons/build-tools";
import { getGraphicsProfile, graphicsCommands, profileCfg, type GraphicsProfileId } from "@/lib/graphics-profiles";
import { evaluateBuild10 } from "./build";
import { type BuildResolution, formatBuildResolution, getResolutionSize } from "./build-resolution";
import { frameMs } from "./fps-calibration";
import type { HardwarePreset } from "./preset";

export interface PresetView extends HardwarePreset {
  mode: GraphicsProfileId | null;
  target: BuildResolution;
  resolutionLabel: string;
  purpose: string;
}

const PURPOSE: Record<GraphicsProfileId, string> = {
  competitive: "PvP и рейды",
  balanced: "Универсальный баланс",
  quality: "Высокая детализация",
  realistic: "Детализация и съёмка",
};

function anchorMode(preset: HardwarePreset): GraphicsProfileId {
  const shader = preset.settings.shaderLevel;
  return shader >= 600 ? "realistic" : shader >= 350 ? "quality" : shader >= 225 ? "balanced" : "competitive";
}

/** Every catalog estimate uses the same hardware model as the calculator. */
export function projectPreset(preset: HardwarePreset, mode: GraphicsProfileId | null, target?: BuildResolution): PresetView {
  const resolution: BuildResolution = target && getResolutionSize(target) ? target : { resolution: preset.resolution };
  const resolutionLabel = resolution.resolution === "4k" ? "4K" : formatBuildResolution(resolution);
  const appliedMode = mode ?? anchorMode(preset);
  const base: PresetView = { ...preset, mode, target: resolution, resolutionLabel, purpose: `${PURPOSE[appliedMode]} · ${resolutionLabel}` };
  const after = evaluateBuild10({ ...presetBuildInput(preset), ...resolution }, appliedMode);
  if (!after) return base;
  const { fpsModded: modded, fpsOfficial: official } = after;
  const profile = getGraphicsProfile(mode);
  const commands = profile ? graphicsCommands(profile.id, preset.ramGb) : null;
  return {
    ...base, fpsSource: "estimate", score10: after.score10,
    testScene: `${resolutionLabel} · ${preset.testScene}`,
    // An editorial note about the original 1440p rig is not a prediction for
    // 1080p/4:3. Use the current evaluation when the scenario has changed.
    bottleneckNote: resolution.resolution !== preset.resolution || appliedMode !== anchorMode(preset)
      ? after.notes[0] ?? preset.bottleneckNote : preset.bottleneckNote,
    fpsModded: [modded.min, modded.max], low1Modded: modded.low1, frametimeModdedMs: frameMs(modded),
    fpsOfficial: [official.min, official.max], low1Official: official.low1, frametimeOfficialMs: frameMs(official),
    cfgText: profile ? profileCfg(profile.id, preset.ramGb, preset.cfgText) : preset.cfgText,
    settings: profile && commands ? {
      ...preset.settings, graphicsQuality: profile.short, drawDistance: profile.draw,
      shaderLevel: profile.shader, waterQuality: profile.water, shadowQuality: profile.shadows,
      shadowCascades: `${commands["graphics.shadowcascades"]}`, treeQuality: commands["tree.quality"],
      upscaler: profile.shadows > 0 ? "Нативное разрешение · TSSAA" : "Нативное разрешение · AA выкл.",
      gcBuffer: commands["gc.buffer"],
    } : preset.settings,
  };
}

export function presetCalculatorHref(preset: PresetView) {
  const params = new URLSearchParams({ preset: preset.slug });
  params.set("mode", preset.mode ?? anchorMode(preset));
  if (preset.target.resolution !== preset.resolution) {
    params.set("res", preset.target.resolution);
    if (preset.target.customResolution) {
      params.set("w", String(preset.target.customResolution.width));
      params.set("h", String(preset.target.customResolution.height));
    }
  }
  return `/benchmark?${params}`;
}
