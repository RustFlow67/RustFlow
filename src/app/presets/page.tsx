import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import PresetsExplorer from "@/components/PresetsExplorer";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { TWEAKS_LITE } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Пресеты железа и ориентиры FPS в Rust",
  description:
    `${HARDWARE_PRESETS.length} конфигурации от 1080p до 4K, ориентиры FPS для MODDED 2X и OFFICIAL, готовые настройки client.cfg и сравнение.`,
};

export default function PresetsPage() {
  const tweakTitles = Object.fromEntries(TWEAKS_LITE.map((t) => [t.slug, t.title]));

  return (
    <>
      <PageHeader
        eyebrow="Пресеты"
        title="43 сборки для Rust"
        text="Сравните до трёх конфигураций. Выберите режим графики, 4:3 или своё разрешение, чтобы пересчитать FPS, 1% low и время кадра."
      />
      <PresetsExplorer presets={HARDWARE_PRESETS} tweakTitles={tweakTitles} />
    </>
  );
}
