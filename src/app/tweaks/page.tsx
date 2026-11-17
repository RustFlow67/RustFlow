import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import TweakExplorer from "@/components/TweakExplorer";
import { TWEAKS_LITE } from "@/lib/tweaks";

export const metadata: Metadata = {
  title: "Библиотека твиков для Rust",
  description:
    "Твики для Rust по 6 категориям: CPU/Windows, GPU, RAM/SSD, сеть, настройки Rust, launch-опции. Маркировка риска (безопасно/осторожно/вредно), статус замерено/миф, шаги, FPS до/после и скачивание.",
};

export default function TweaksPage() {
  return (
    <>
      <PageHeader
        eyebrow="Библиотека твиков"
        title="Проверенные твики и разбор мифов"
        text="6 категорий: CPU/Windows, GPU, RAM/SSD, сеть, настройки Rust и launch-опции. Отмечайте применённые шаги, фиксируйте FPS до/после, скачивайте открытые файлы и обходите позиции «Вредно»."
      />
      <TweakExplorer tweaks={TWEAKS_LITE} />
    </>
  );
}
