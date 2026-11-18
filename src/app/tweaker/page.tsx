import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import Tweaker from "@/components/Tweaker";
import { getGraphicsProfile } from "@/lib/graphics-profiles";
import { getConnectionProfile, parseMonitorHz } from "@/lib/models/build-settings";
import { TWEAK_GROUPS } from "@/lib/models/tweak";
import { isPackRam, isPlanVram, isSupersededTweak, isTweakerVendor } from "@/lib/tweaker";
import { TWEAKS, toLite } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Твикер",
  description: "Четыре графических профиля Rust и шесть категорий настроек. Соберите свой client.cfg и ZIP с точными шагами и откатом.",
};

export default async function TweakerPage({ searchParams }: {
  searchParams: Promise<{ mode?: string; tweak?: string; group?: string; gpu?: string; pc?: string; ram?: string; vram?: string; storage?: string; hz?: string; net?: string }>;
}) {
  const params = await searchParams;
  const inventory = TWEAKS.filter((t) => !isSupersededTweak(t.slug)).map((t) => ({ ...toLite(t), revertSteps: t.revertSteps }));
  const tweak = inventory.find((t) => t.slug === params.tweak);
  const group = tweak?.group ?? TWEAK_GROUPS.find((g) => g.id === params.group)?.id ?? null;
  const mode = getGraphicsProfile(params.mode)?.id;
  const gpu = isTweakerVendor(params.gpu) ? params.gpu : tweak?.slug === "amd-adrenalin" ? "amd" : tweak?.slug === "nvidia-panel" ? "nvidia" : null;

  const ram = Number(params.ram), vram = Number(params.vram);
  const monitorHz = parseMonitorHz(params.hz), connection = getConnectionProfile(params.net)?.value;
  const personal = params.pc === "1" && mode && gpu && isPackRam(ram) && isPlanVram(vram) ? { ram, vram, hdd: params.storage === "hdd", monitorHz, connection } : undefined;
  return <>
    <PageHeader eyebrow="Твикер" title="Настройте Rust под себя"
      text="Выберите графический профиль и нужные шаги. В ZIP попадут выбранные твики, ваш client.cfg и инструкции по откату." />
    <Tweaker key={`${mode ?? "base"}:${gpu ?? "auto"}:${group ?? "all"}:${tweak?.slug ?? ""}:${personal ? `${ram}:${vram}:${personal.hdd}:${monitorHz ?? ""}:${connection ?? ""}` : ""}`} personal={personal} inventory={inventory} initialGroup={group}
      initialTweak={tweak?.slug} initialMode={mode} initialGpu={gpu} />
  </>;
}
