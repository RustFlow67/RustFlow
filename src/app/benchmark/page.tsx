import BenchmarkTool from "@/components/BenchmarkTool";
import { getGraphicsProfile } from "@/lib/graphics-profiles";
import { presetBuildInput } from "@/lib/addons/build-tools";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { getResolutionSize, type BuildResolution } from "@/lib/models/build-resolution";


export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<{
    preset?: string | string[];
    mode?: string;
    account?: string;
    saved?: string;
    res?: string;
    w?: string;
    h?: string;
  }>;
}) {
  const { preset: slug, mode, account, saved, res, w, h } = await searchParams;
  // The router can render a route before committing window.location. Resolve
  // the seed from the request, consistently for links and direct visits.
  const preset = typeof slug === "string" ? HARDWARE_PRESETS.find((p) => p.slug === slug) : undefined;
  const target = {
    resolution: res,
    customResolution: res === "custom" ? { width: Number(w), height: Number(h) } : undefined,
  } as BuildResolution;
  const seed = preset
    ? { ...presetBuildInput(preset), ...(getResolutionSize(target) ? target : {}) }
    : undefined;
  const savedId = !seed && typeof saved === "string" && saved.length <= 64 ? saved : undefined;
  const initialMode = getGraphicsProfile(mode)?.id;
  return (
    <BenchmarkTool
      key={
        seed
          ? `${preset?.id}:${seed.resolution}:${w ?? ""}:${h ?? ""}:${initialMode ?? ""}`
          : account === "1"
            ? "account"
            : (savedId ?? "personal")
      }
      presetInput={seed}
      accountBuild={!seed && account === "1"}
      savedId={savedId}
      initialMode={initialMode}
    />
  );
}
