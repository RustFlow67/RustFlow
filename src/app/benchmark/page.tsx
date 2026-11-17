import type { Metadata } from "next";
import BenchmarkTool, { type TweakIndex } from "@/components/BenchmarkTool";
import { PageHeader } from "@/components/PageHeader";
import { TWEAKS_LITE } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Профиль сборки и оценка /10 под Rust",
  description:
    "Взвешенная оценка сборки /10 под Rust: однопоток CPU, частота и задержка RAM, случайное чтение SSD, тир GPU и запас VRAM, оценка FPS для моддед и официала и персональные твики.",
};

export default function BenchmarkPage() {
  const tweakIndex: TweakIndex = Object.fromEntries(
    TWEAKS_LITE.map((t) => [
      t.slug,
      { title: t.title, tagline: t.tagline, group: t.group, gainLabel: t.gainLabel },
    ]),
  );

  return (
    <>
      <PageHeader
        eyebrow="Профиль сборки · Оценка /10"
        title="Прозрачная оценка ПК под Rust"
        text="Укажите CPU, GPU, объём, частоту и тайминги RAM, накопитель и разрешение. Получите взвешенный балл /10 по 5 узлам, расчётную оценку FPS (моддед 2x / официал) и персональный план твиков."
      />
      <BenchmarkTool tweakIndex={tweakIndex} />
    </>
  );
}
