import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HARDWARE_PRESETS } from "@/lib/models/preset";

export const metadata: Metadata = {
  title: "Пресеты железа и ориентиры FPS в Rust",
  description: `${HARDWARE_PRESETS.length} конфигурации от 1080p до 4K, ориентиры FPS для MODDED 2X и OFFICIAL, готовые настройки client.cfg и сравнение.`,
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
