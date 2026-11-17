import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import PresetsExplorer from "@/components/PresetsExplorer";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { TWEAKS_LITE } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Пресеты железа и замеры FPS в Rust",
  description:
    "Референсные конфигурации ПК под Rust (включая Ryzen 5 5600X + RTX 5060 + 32GB@3600: моддед 2x 130–150 FPS, официал 90–100 FPS) с готовыми настройками client.cfg и сравнением.",
};

export default function PresetsPage() {
  const tweakTitles = Object.fromEntries(TWEAKS_LITE.map((t) => [t.slug, t.title]));

  return (
    <>
      <PageHeader
        eyebrow="Пресеты железа"
        title="Готовые конфиги с замерами и client.cfg"
        text="Реалистичные связки от бюджетного 1080p до 9800X3D (включая эталон Ryzen 5 5600X + RTX 5060 + 32GB@3600). Скопируйте настройки в один клик или сравните до трёх сборок между собой."
      />
      <PresetsExplorer presets={HARDWARE_PRESETS} tweakTitles={tweakTitles} />
    </>
  );
}
