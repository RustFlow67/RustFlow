import { ArrowRight, BookOpen, FileText, Gauge, LifeBuoy, Ruler, ShieldCheck, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { delay, PageHeader } from "@/components/PageHeader";
import { GUIDE } from "@/lib/content";

export const metadata: Metadata = {
  title: "Руководство пользователя",
  description: "Как пользоваться RustFlow: быстрый старт, форматы файлов, безопасность, замер результата и решение проблем.",
};

const ICONS: Record<string, { icon: typeof BookOpen; colors: [string, string] }> = {
  start: { icon: Sparkles, colors: ["#ffb15c", "#ff4d2e"] },
  files: { icon: FileText, colors: ["#64d2ff", "#0a84ff"] },
  safety: { icon: ShieldCheck, colors: ["#7ff0ac", "#30a46c"] },
  measure: { icon: Ruler, colors: ["#bf5af2", "#5e5ce6"] },
  trouble: { icon: LifeBuoy, colors: ["#ffd60a", "#ff9f0a"] },
  principles: { icon: BookOpen, colors: ["#8e8e93", "#48484a"] },
};

export default function GuidePage() {
  return (
    <>
      <PageHeader
        eyebrow="Руководство"
        title="Как пользоваться RustFlow"
        text="Короткое руководство: с чего начать, как запускать файлы, как измерить результат и что делать, если что-то пошло не так."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <nav className="glass glass-blur p-3 lg:sticky lg:top-24" aria-label="Содержание руководства">
          <p className="px-3 pb-2 pt-2 text-[12px] font-bold uppercase tracking-widest text-ink-3">Содержание</p>
          <ol className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
            {GUIDE.map((section, i) => (
              <li key={section.id} className="flex-none">
                <a
                  href={`#${section.id}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-ink-2 transition-transform duration-200 hover:translate-x-1 hover:bg-white/10 hover:text-white active:scale-95"
                >
                  <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-white/10 text-[12px] tabular-nums text-white">
                    {i + 1}
                  </span>
                  <span className="whitespace-nowrap">{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="min-w-0 space-y-6">
          {GUIDE.map((section) => {
            const meta = ICONS[section.id] ?? ICONS.start;
            const Icon = meta.icon;
            return (
              <section key={section.id} id={section.id} className="glass group scroll-mt-28 p-6 sm:p-8" data-reveal>
                <div className="flex items-start gap-4">
                  <span className="icon-tile" style={{ "--c1": meta.colors[0], "--c2": meta.colors[1] } as CSSProperties}>
                    <Icon aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="headline text-[1.7rem]">{section.title}</h2>
                    <p className="mt-2 text-[15.5px] leading-relaxed text-ink-2">{section.lead}</p>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {section.points.map((point, i) => (
                    <div key={point.title} className="tile tile-hover p-4" data-reveal style={delay(i)}>
                      <h3 className="text-[15px] font-bold leading-snug">{point.title}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{point.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="glass glass-accent p-6 text-center sm:p-9" data-reveal="scale">
            <h2 className="headline text-[clamp(1.6rem,3.6vw,2.2rem)]">Готовы начать?</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15.5px] leading-relaxed text-ink-2">
              Оценка ПК займёт меньше минуты и подскажет, какие твики дадут результат на вашей системе.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/benchmark" className="btn btn-primary btn-lg">
                <Gauge aria-hidden="true" />
                Оценить ПК
              </Link>
              <Link href="/setup" className="btn btn-lg">
                Полная настройка
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
