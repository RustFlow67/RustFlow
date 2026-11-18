import type { Metadata } from "next";
import BuildShare from "@/components/addons/BuildShare";
import BenchmarkTool, { type TweakIndex } from "@/components/BenchmarkTool";
import { PageHeader } from "@/components/PageHeader";
import { getGraphicsProfile } from "@/lib/graphics-profiles";
import { presetBuildInput } from "@/lib/addons/build-tools";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { getResolutionSize, type BuildResolution } from "@/lib/models/build-resolution";
import { TWEAKS_LITE } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Сборка",
  description:
    "Взвешенная оценка сборки под Rust: однопоток CPU, частота и задержка RAM, случайное чтение SSD, тир GPU и запас VRAM, оценка FPS для MODDED 2X и OFFICIAL HIGH POP и персональные твики.",
};

export default async function BenchmarkPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string | string[]; mode?: string; account?: string; saved?: string; res?: string; w?: string; h?: string }>;
}) {
  const { preset: slug, mode, account, saved, res, w, h } = await searchParams;
  // The router can render a route before committing window.location. Resolve
  // the seed from the request, consistently for links and direct visits.
  const preset = typeof slug === "string" ? HARDWARE_PRESETS.find((p) => p.slug === slug) : undefined;
  const target = { resolution: res, customResolution: res === "custom" ? { width: Number(w), height: Number(h) } : undefined } as BuildResolution;
  const seed = preset ? { ...presetBuildInput(preset), ...(getResolutionSize(target) ? target : {}) } : undefined;
  const savedId = !seed && typeof saved === "string" && saved.length <= 64 ? saved : undefined;
  const initialMode = getGraphicsProfile(mode)?.id;
  const tweakIndex: TweakIndex = Object.fromEntries(
    TWEAKS_LITE.map((t) => [
      t.slug,
      { title: t.title, tagline: t.tagline, group: t.group, gainLabel: t.gainLabel },
    ]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Сборка"
        title="Что ограничивает ваш FPS?"
        text="Укажите комплектующие и разрешение. Радар покажет сильные и слабые стороны ПК, а оценка FPS и план твиков помогут выбрать, что менять первым."
      />
      <BenchmarkTool
        key={seed ? `${preset?.id}:${seed.resolution}:${w ?? ""}:${h ?? ""}:${initialMode ?? ""}` : account === "1" ? "account" : savedId ?? "personal"}
        tweakIndex={tweakIndex}
        presetInput={seed}
        accountBuild={!seed && account === "1"}
        savedId={savedId}
        initialMode={initialMode}
      />
      <div className="mt-6"><BuildShare /></div>
    </>
  );
}
