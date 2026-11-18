import { BookOpen, FileText, LifeBuoy, Monitor, Gamepad2, Cpu, Keyboard, Ruler, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { GuideContents, GuideSteps } from "@/components/GuideNavigation";
import { RiskLevelBadge } from "@/components/Badges";
import { KNOWLEDGE_TYPE_LABEL } from "@/lib/knowledge-base";
import { PageHeader } from "@/components/PageHeader";
import { GUIDE } from "@/lib/content";

export const metadata: Metadata = {
  title: "База знаний",
  description: "Как пользоваться RustFlow: быстрый старт, форматы файлов, безопасность, замер результата и решение проблем.",
};

const ICONS: Record<string, typeof BookOpen> = {
  files: FileText, safety: ShieldCheck, measure: Ruler, trouble: LifeBuoy,
  "kb-windows": Monitor, "kb-rust": Gamepad2, "kb-drivers": Cpu, "kb-binds": Keyboard,
};
const SECTIONS = GUIDE;

export default function GuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="База знаний"
        title="Как пользоваться RustFlow"
        text="Диагностика, безопасная настройка и замер результата. Проверяйте эффект каждого шага на своём ПК."
      />

      <GuideSteps />
      <div className="grid items-start gap-5 lg:grid-cols-[244px_minmax(0,1fr)]">
        <GuideContents sections={SECTIONS.map(({ id, title }) => ({ id, title }))} />
        <div className="min-w-0 space-y-5">
          {SECTIONS.map((section) => {
            const Icon = ICONS[section.id] ?? BookOpen;
            return (
              <section key={section.id} id={section.id} className="glass p-4 sm:p-6" data-guide-section="">
                <div className="rf-page-content flex items-start gap-4">
                  <span className="icon-tile icon-tile-sm">
                    <Icon aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="headline text-[clamp(1rem,2.7vw,1.35rem)]">{section.title}</h2>
                    <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{section.lead}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {section.points.map((point) => (
                    <div key={point.title} id={point.entry ? `kb-${point.entry.id}` : undefined}
                      className="tile tile-hover min-w-0 scroll-mt-28 p-4">
                      {point.entry && <div className="mb-2 flex flex-wrap items-center gap-2">
                        <RiskLevelBadge level={point.entry.risk} />
                        <span className="chip">{KNOWLEDGE_TYPE_LABEL[point.entry.type]}</span>
                      </div>}
                      <h3 className="text-[15px] font-bold leading-snug">{point.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{point.text}</p>
                      {point.entry?.example && <pre className="well mt-3 max-w-full whitespace-pre-wrap break-all p-2.5 font-mono text-[12px] leading-relaxed text-ink">{point.entry.example}</pre>}
                      {point.entry?.note && <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{point.entry.note}</p>}
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

        </div>
      </div>
    </>
  );
}
