import type { Metadata } from "next";
import { DockIntro } from "@/components/DockIntro";
import Roadmap from "@/components/Roadmap";
import { movedAnchors } from "@/lib/catalog/reading";
export const metadata: Metadata = {
  title: "С чего начать: дорожная карта Rust",
  description: "Пять проверяемых шагов от резервной копии до измерения результата и отката.",
};
export default function GuidePage() {
  return (
    <>
      <DockIntro href="/guide" />
      <Roadmap legacy={movedAnchors} />
    </>
  );
}
