import type { Metadata } from "next";
import ReadingCatalog from "@/components/catalog/ReadingCatalog";
import TweakerTabs from "@/components/TweakerTabs";
import { DockIntro } from "@/components/DockIntro";
import { fileGroups, windowsGroups } from "@/lib/catalog/reading";
import { readPlanSeed } from "@/lib/catalog/system-plan";
import Tweaker from "@/components/Tweaker";
import { getGraphicsProfile } from "@/lib/graphics-profiles";
import { getConnectionProfile, isWindows, parseMonitorHz } from "@/lib/models/build-settings";
import { readPlaySettings, type PlayKey } from "@/lib/models/play-settings";
import { TWEAK_GROUPS } from "@/lib/models/tweak";
import { isPackRam, isPlanVram, isSupersededTweak, isTweakerVendor } from "@/lib/tweaker";
import { TWEAKS, toLite } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Твикер",
  description:
    "Четыре графических профиля Rust и шесть категорий настроек. Соберите свой client.cfg и ZIP с точными шагами и откатом.",
};

export default async function TweakerPage({
  searchParams,
}: {
  searchParams: Promise<
    {
      auto?: string;
      windows?: string;
      mode?: string;
      tweak?: string;
      group?: string;
      gpu?: string;
      pc?: string;
      ram?: string;
      vram?: string;
      storage?: string;
      hz?: string;
      net?: string;
    } & Partial<Record<PlayKey, string>>
  >;
}) {
  const params = await searchParams;
  const auto = params.auto === "live" ? "live" : params.auto === "preview" ? readPlanSeed(params) : null;
  const inventory = TWEAKS.filter((t) => t.slug === "gc-buffer" || !isSupersededTweak(t.slug)).map((t) => ({
    ...toLite(t),
    ...(t.slug === "gc-buffer"
      ? {
          title: "Оптимизация gc.buffer",
          tagline: "Бюджет сборщика мусора под объём ОЗУ и фоновые задачи.",
          gainLabel: "Плавность · паузы GC",
        }
      : {}),
    warnings: t.warnings,
    revertSteps:
      t.slug === "gc-buffer"
        ? ["Верните исходное значение gc.buffer из сохранённой копии client.cfg."]
        : t.revertSteps,
  }));
  const tweak = inventory.find((t) => t.slug === params.tweak);
  const group = tweak?.group ?? TWEAK_GROUPS.find((g) => g.id === params.group)?.id ?? null;
  const mode = getGraphicsProfile(params.mode)?.id;
  const gpu = isTweakerVendor(params.gpu)
    ? params.gpu
    : tweak?.slug.startsWith("amd-")
      ? "amd"
      : tweak?.slug.startsWith("nvidia-")
        ? "nvidia"
        : null;

  const ram = Number(params.ram),
    vram = Number(params.vram);
  const monitorHz = parseMonitorHz(params.hz),
    connection = getConnectionProfile(params.net)?.value;
  const play = readPlaySettings((k) => params[k]);
  const windowsVersion = isWindows(params.windows) ? params.windows : undefined;
  const personal =
    play &&
    (params.windows === undefined || windowsVersion) &&
    params.pc === "1" &&
    mode &&
    gpu &&
    isPackRam(ram) &&
    isPlanVram(vram)
      ? { ...play, windowsVersion, ram, vram, hdd: params.storage === "hdd", monitorHz, connection }
      : undefined;
  return (
    <TweakerTabs windows={<>
      <DockIntro href="/windows" />
      <ReadingCatalog section="guide" label="Windows" groups={windowsGroups} />
    </>}>
      <Tweaker
        auto={auto}
        key={`${JSON.stringify(auto)}:${mode ?? "base"}:${gpu ?? "auto"}:${group ?? "all"}:${tweak?.slug ?? ""}:${personal ? JSON.stringify(personal) : ""}`}
        personal={personal}
        inventory={inventory}
        initialGroup={group}
        initialTweak={tweak?.slug}
        initialMode={mode}
        initialGpu={gpu}
      />
      <h2 className="section-subhead">Как применять и откатывать файлы</h2>
      <ReadingCatalog section="guide" label="Форматы и откат" groups={fileGroups} />
    </TweakerTabs>
  );
}
