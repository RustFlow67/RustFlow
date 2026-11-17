import {
  AlertOctagon,
  ArrowRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EvidenceBadge, RiskLevelBadge } from "@/components/Badges";
import FaqList from "@/components/FaqList";
import { PageHeader, SectionHead } from "@/components/PageHeader";
import { EAC_RULES, FAQ, HARMFUL_TWEAKS, MYTHS } from "@/lib/content";

export const metadata: Metadata = {
  title: "Мифы, безопасность EAC и FAQ",
  description:
    "Предупреждение Easy Anti-Cheat (инжекторы/DLL = бан, разгон = безопасно), вредные твики (отключение Defender/Update, чистильщики реестра, закрытые .exe), список плацебо и FAQ.",
};

export default function FaqPage() {
  const banRules = EAC_RULES.filter((r) => r.verdict === "ban");
  const safeRules = EAC_RULES.filter((r) => r.verdict === "safe");

  return (
    <div className="space-y-16 sm:space-y-20">
      <div>
        <PageHeader
          eyebrow="Мифы и безопасность"
          title="Античит EAC, вредные советы и разбор плацебо"
          text="Что гарантированно приводит к бану Easy Anti-Cheat, какие «оптимизации» ломают Windows без прироста FPS и какие популярные флаги Rust просто игнорирует."
        >
          <div className="mt-5 flex flex-wrap gap-2">
            <a href="#eac" className="btn btn-sm">
              Правила EAC
            </a>
            <a href="#harmful" className="btn btn-sm">
              Вредные твики
            </a>
            <a href="#myths" className="btn btn-sm">
              Список плацебо
            </a>
            <a href="#faq" className="btn btn-sm">
              Частые вопросы
            </a>
          </div>
        </PageHeader>

        {/* ----------------- Блок 1: Easy Anti-Cheat (EAC) ----------------- */}
        <section id="eac" className="scroll-mt-24" aria-labelledby="eac-heading">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Красная зона: БАН */}
            <div className="glass glass-danger p-6 sm:p-7">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="h-6 w-6 flex-none text-danger" aria-hidden="true" />
                <h2 id="eac-heading" className="text-xl font-bold tracking-tight text-ink">
                  EAC: перманентный бан
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                Любое вмешательство в процесс, память или файлы Rust расценивается Easy Anti-Cheat как чит.
              </p>
              <ul className="mt-4 space-y-3">
                {banRules.map((rule) => (
                  <li key={rule.title} className="well p-4">
                    <p className="flex items-center gap-2 text-[14.5px] font-bold text-ink">
                      <Ban className="h-4 w-4 flex-none text-danger" aria-hidden="true" />
                      {rule.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{rule.detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Зелёная зона: БЕЗОПАСНО */}
            <div className="glass p-6 sm:p-7">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-6 w-6 flex-none text-ok" aria-hidden="true" />
                <h2 className="text-xl font-bold tracking-tight text-ink">
                  EAC: полностью безопасно
                </h2>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-2">
                Разгон железа и штатные настройки ОС/драйвера/client.cfg не затрагивают память игры.
              </p>
              <ul className="mt-4 space-y-3">
                {safeRules.map((rule) => (
                  <li key={rule.title} className="tile p-4">
                    <p className="flex items-center gap-2 text-[14.5px] font-bold text-ink">
                      <CheckCircle2 className="h-4 w-4 flex-none text-ok" aria-hidden="true" />
                      {rule.title}
                    </p>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{rule.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* ---------------- Блок 2: Вредные твики ---------------- */}
      <section id="harmful" className="scroll-mt-24" aria-labelledby="harmful-heading">
        <SectionHead
          eyebrow="Красный список"
          title={<span id="harmful-heading">Вредные твики — никогда не применяйте</span>}
          text="Отключение Defender и Windows Update, чистильщики реестра и закрытые .exe не дают кадров, но ломают ОС, античит и безопасность аккаунта."
        />
        <ul className="grid gap-4 md:grid-cols-2">
          {HARMFUL_TWEAKS.map((item) => (
            <li key={item.title} className="glass glass-hover flex flex-col p-5 sm:p-6" data-reveal>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <RiskLevelBadge level="harmful" />
                <span className="chip">{item.danger}</span>
              </div>
              <h3 className="mt-3.5 flex items-start gap-2 text-[17px] font-bold leading-snug text-ink">
                <AlertOctagon className="mt-0.5 h-4 w-4 flex-none text-danger" aria-hidden="true" />
                <span>{item.title}</span>
              </h3>
              <code className="mt-2 block truncate font-mono text-[12px] text-ink-3 line-through decoration-danger/70">
                {item.example}
              </code>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{item.whyHarmful}</p>
              <div className="well mt-auto p-3.5 text-[12.5px] leading-relaxed text-ink-2" style={{ marginTop: "1rem" }}>
                <strong className="text-ok">Как правильно:</strong> {item.safeAlternative}
              </div>
              {item.tweakSlug && (
                <Link
                  href={`/tweaks/${item.tweakSlug}`}
                  className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-accent-hi hover:text-white"
                >
                  Инструкция проверки / восстановления
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Блок 3: Список плацебо и мифов ---------------- */}
      <section id="myths" className="scroll-mt-24" aria-labelledby="myths-heading">
        <SectionHead
          eyebrow="Проверено замерами"
          title={<span id="myths-heading">Список плацебо и популярных мифов</span>}
          text="Советы, которые годами копируют из гайда в гайд, хотя на современном клиенте Rust они не меняют ни FPS, ни пинг."
        />
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MYTHS.map((myth) => (
            <li key={myth.title} className="glass glass-hover flex flex-col p-5" data-reveal>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <EvidenceBadge status="myth" />
                <span className="text-[12px] font-bold tabular-nums text-ink-3">
                  {myth.measuredDelta}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold leading-snug text-ink">{myth.title}</h3>
              <code className="mt-2 block truncate font-mono text-[12px] text-ink-3 line-through decoration-danger/70">
                {myth.code}
              </code>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-2">{myth.truth}</p>
              {myth.tweakSlug && (
                <Link
                  href={`/tweaks/${myth.tweakSlug}`}
                  className="mt-auto inline-flex items-center gap-1 pt-3 text-[12.5px] font-semibold text-accent-hi hover:text-white"
                >
                  Подробнее в библиотеке
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------------- Блок 4: Частые вопросы (FAQ) ---------------- */}
      <section id="faq" className="scroll-mt-24" aria-labelledby="faq-heading">
        <SectionHead
          eyebrow="FAQ"
          title={<span id="faq-heading">Частые вопросы</span>}
          text="Короткие ответы про античит, замеры, память и хранение профиля."
        />
        <FaqList items={FAQ} />
      </section>

      <section className="glass flex flex-wrap items-center justify-between gap-5 p-6 sm:p-8" data-reveal>
        <div className="max-w-xl">
          <h2 className="headline text-[1.55rem]">Нужна пошаговая методика замера?</h2>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            Откройте Руководство пользователя или сразу внесите контрольный прогон в Журнал до/после.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/journal" className="btn btn-primary">
            Открыть Журнал
            <ArrowRight aria-hidden="true" />
          </Link>
          <Link href="/guide" className="btn">
            Руководство
          </Link>
        </div>
      </section>
    </div>
  );
}
