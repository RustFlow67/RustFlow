import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Сборка",
  description:
    "Взвешенная оценка сборки под Rust: однопоток CPU, частота и задержка RAM, случайное чтение SSD, тир GPU и запас VRAM, оценка FPS для MODDED 2X и OFFICIAL HIGH POP и персональные твики.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
