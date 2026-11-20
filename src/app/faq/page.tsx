import type { Metadata } from "next";
import { DockIntro } from "@/components/DockIntro";
import ReadingCatalog from "@/components/catalog/ReadingCatalog";
import { faqGroups } from "@/lib/catalog/reading";
import SectionShortcuts from "@/components/SectionShortcuts";
export const metadata: Metadata = {
  title: "Мифы, безопасность EAC и FAQ",
  description: "Правила EAC, вредные советы, проверка мифов и ответы на частые вопросы.",
};
export default function FaqPage() {
  return (
    <>
      <DockIntro href="/faq" />
      <ReadingCatalog
        section="faq"
        groups={faqGroups}
        shortcuts={
          <SectionShortcuts
            label="Разделы о безопасности и мифах"
            sections={[
              ["#eac", "Правила EAC"],
              ["#harmful", "Вредные твики"],
              ["#myths", "Список плацебо"],
              ["#faq", "Частые вопросы"],
            ]}
          />
        }
      />
    </>
  );
}
