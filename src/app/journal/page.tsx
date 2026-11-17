import type { Metadata } from "next";
import JournalManager from "@/components/JournalManager";
import { PageHeader } from "@/components/PageHeader";
import { TWEAKS_LITE } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Журнал замеров FPS до и после",
  description:
    "Ручной журнал замеров Rust (Avg FPS, 1% low, frametime, сервер и сцена) с авторасчётом дельты % и протоколом «один твик за раз, одна сцена».",
};

export default function JournalPage() {
  const tweakOptions = TWEAKS_LITE.map((t) => ({ slug: t.slug, title: t.title }));

  return (
    <>
      <PageHeader
        eyebrow="Журнал замеров"
        title="Честные замеры до и после с автодельтой %"
        text="Записывайте Avg FPS, 1% low и время кадра (мс) на одной и той же сцене. Сайт сам посчитает дельту в процентах и подскажет, что оставить, а что откатить."
      />
      <JournalManager tweakOptions={tweakOptions} />
    </>
  );
}
