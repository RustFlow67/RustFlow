import { DockIntro } from "@/components/DockIntro";
import { PlanStrip } from "@/components/catalog/SystemPlan";
import ReadingCatalog from "@/components/catalog/ReadingCatalog";
import {presetGroups} from "@/lib/catalog/reading";
import PresetsExplorer from "@/components/PresetsExplorer";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { TWEAKS_LITE } from "@/lib/tweaks";


export default async function PresetsPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  const slug = (await searchParams).open;
  const initial = HARDWARE_PRESETS.find((p) => p.slug === slug);
  const tweakTitles = Object.fromEntries(TWEAKS_LITE.map((t) => [t.slug, t.title]));

  return (
    <>
      <DockIntro href="/presets"/>
      <PlanStrip frameTime />
      <PresetsExplorer
        key={initial?.id ?? "all"}
        initial={initial?.id}
        presets={HARDWARE_PRESETS}
        tweakTitles={tweakTitles}
      />
      <h2 className="section-subhead">Настройки Rust, бинды и запуск</h2>
      <ReadingCatalog section="guide" label="Практика Rust" groups={presetGroups}/>
    </>
  );
}
