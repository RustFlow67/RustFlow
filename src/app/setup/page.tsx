import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import SetupWizard from "@/components/SetupWizard";
import { TWEAKS_LITE } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Полная настройка системы для Rust",
  description: "Пошаговая настройка Windows, видеокарты, Steam и игры: все твики по порядку, ZIP-пакет и откат.",
};

export default function SetupPage() {
  return (
    <>
      <PageHeader
        eyebrow="Полная настройка"
        title="Вся система по шагам"
        text="Шесть этапов от точки восстановления до сети. Выберите профиль, скачайте пакет целиком или идите по чек-листу и отмечайте выполненное."
      />
      <SetupWizard tweaks={TWEAKS_LITE} />
    </>
  );
}
