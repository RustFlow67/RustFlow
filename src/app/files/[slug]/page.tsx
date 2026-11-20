import LiquidGlass from "@/components/LiquidGlass";
import {
  AlertTriangle,
  AppWindow,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  KeyRound,
  ListChecks,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { EvidenceBadge, ImpactBars, RiskLevelBadge } from "@/components/Badges";
import CategoryIcon from "@/components/CategoryIcon";
import CodeBlock from "@/components/CodeBlock";
import DownloadButton from "@/components/DownloadButton";
import { delay } from "@/components/PageHeader";
import { TWEAK_GROUP_BY_ID, TWEAK_RISK_META } from "@/lib/models/tweak";
import { getTweak, TWEAKS } from "@/lib/tweaks";
import { registryBackup } from "@/lib/tweaks/registry-backup";
import { FILE_LABEL, PHASES, RESTART_LABEL } from "@/lib/tweaks/meta";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return TWEAKS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const tweak = getTweak(slug);
  if (!tweak) return { title: "Твик не найден" };
  return { title: tweak.title, description: `${tweak.tagline}. Инструкция, проверка, файл и откат.` };
}

export default async function TweakPage({ params }: Props) {
  const { slug } = await params;
  const tweak = getTweak(slug);
  if (!tweak) notFound();

  const index = TWEAKS.findIndex((t) => t.slug === slug);
  const prev = index > 0 ? TWEAKS[index - 1] : undefined;
  const next = index < TWEAKS.length - 1 ? TWEAKS[index + 1] : undefined;
  const group = TWEAK_GROUP_BY_ID[tweak.group ?? "cpu-windows"];
  const riskLevel = tweak.riskLevel ?? "safe";
  const evidence = tweak.evidence ?? "conditional";
  const snapshot = registryBackup(tweak);
  const isHarmful = riskLevel === "harmful";
  const phase = PHASES.find((p) => p.id === tweak.phase);

  const meta = [
    { icon: ShieldCheck, label: "Уровень риска", value: TWEAK_RISK_META[riskLevel].label },
    { icon: KeyRound, label: "Права", value: tweak.admin ? "Администратор" : "Обычный пользователь" },
    { icon: RefreshCw, label: "После шага", value: RESTART_LABEL[tweak.restart] },
    { icon: Clock, label: "Время", value: tweak.time },
    { icon: AppWindow, label: "Система", value: tweak.os },
    { icon: FileText, label: "Формат файла", value: FILE_LABEL[tweak.file.kind] },
  ];

  return (
    <article className="file-detail">
      <Link href="/tweaker" className="btn btn-sm mb-6">
        <ArrowLeft aria-hidden="true" />
        Библиотека твиков
      </Link>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          {/* Header — единственная blur-поверхность страницы */}
          <LiquidGlass as="header" className={`glass glass-blur group p-6 sm:p-8 ${isHarmful ? "glass-danger" : ""}`}>
            <div className="flex flex-wrap items-center gap-2.5">
              <CategoryIcon group={group.id} />
              <div className="flex flex-wrap gap-2">
                <span className="chip">{group.title}</span>
                <EvidenceBadge status={evidence} />
                <RiskLevelBadge level={riskLevel} />
                {!tweak.excludeFromPack && phase && <span className="chip">Этап {phase.id}</span>}
              </div>
            </div>

            <h1 className="headline mt-5 text-[clamp(1.85rem,4.4vw,2.85rem)]">{tweak.title}</h1>
            <p className="mt-3 text-[16.5px] leading-relaxed text-ink-2">{tweak.tagline}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              <DownloadButton
                href={`/api/download/${tweak.slug}`}
                label={
                  isHarmful
                    ? tweak.file.kind === "txt"
                      ? "Скачать памятку (TXT)"
                      : `Файл восстановления (${tweak.file.kind.toUpperCase()})`
                    : `Скачать ${tweak.file.kind.toUpperCase()}`
                }
                variant={isHarmful && tweak.file.kind !== "txt" ? "revert" : "primary"}
                size="lg"
              />
              {snapshot && (
                <DownloadButton href={`/api/download/${slug}?v=snapshot`} label="Снимок до REG (BAT)" />
              )}
              {snapshot && (
                <DownloadButton
                  href={`/api/download/${slug}?v=restore-snapshot`}
                  label="Откат из снимка (BAT)"
                  variant="revert"
                />
              )}
              {tweak.revert && (
                <DownloadButton
                  href={`/api/download/${tweak.slug}?v=revert`}
                  label={snapshot ? "Сброс без снимка (REG)" : "Файл отката"}
                  variant="revert"
                  size="lg"
                />
              )}
            </div>
            {snapshot && (
              <p className="mt-3 text-sm text-ink-2">
                Сначала сохраните снимок под своей учётной записью. Если резервная копия не создана, REG не
                применяйте. Сброс без снимка возвращает типовые, а не ваши прежние значения.
              </p>
            )}
            <p className="mt-3.5 font-sans text-[12.5px] text-ink-3">{tweak.file.name}</p>
          </LiquidGlass>

          {/* Параметры */}
          <section aria-label="Параметры твика" className="file-meta grid grid-cols-2 gap-3 sm:grid-cols-3">
            {meta.map((item, i) => {
              const Icon = item.icon;
              return (
                <LiquidGlass
                  key={item.label}
                  className="glass glass-hover p-4"
                  data-reveal
                  style={{ ...delay(i), "--r": "22px" } as CSSProperties}
                >
                  <Icon className="h-[18px] w-[18px] text-accent-hi" aria-hidden="true" />
                  <p className="mt-2 text-[12.5px] font-medium text-ink-3">{item.label}</p>
                  <p className="mt-0.5 text-[14.5px] font-semibold leading-snug">{item.value}</p>
                </LiquidGlass>
              );
            })}
          </section>

          {/* Что делает / Чего ожидать */}
          <LiquidGlass as="section" className="glass p-6 sm:p-8" data-reveal>
            <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
              <Wrench className="h-5 w-5 text-accent-hi" aria-hidden="true" />
              Что делает
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{tweak.what}</p>
            <div className="hairline my-6" />
            <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
              <Sparkles className="h-5 w-5 text-accent-hi" aria-hidden="true" />
              Чего ожидать в Rust ({tweak.gainLabel})
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{tweak.why}</p>
          </LiquidGlass>

          {/* Инструкция */}
          <LiquidGlass as="section" className="glass p-6 sm:p-8" data-reveal>
            <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
              <ListChecks className="h-5 w-5 text-accent-hi" aria-hidden="true" />
              {isHarmful ? "Как защититься и восстановить норму" : "Пошаговая инструкция"}
            </h2>
            <ol className="mt-5 space-y-3">
              {tweak.steps.map((step, i) => (
                <LiquidGlass as="li" key={i} className="tile tile-hover flex gap-4 p-4">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-gradient-to-b from-[#ffce99] to-[#ff7a35] text-[14px] font-extrabold text-[#1c0900]">
                    {i + 1}
                  </span>
                  <p className="pt-1 text-[15px] leading-relaxed text-ink">{step}</p>
                </LiquidGlass>
              ))}
            </ol>

            <LiquidGlass className="well mt-5 flex gap-3 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-ok" aria-hidden="true" />
              <div>
                <h3 className="text-[15px] font-bold">Как проверить</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-2">{tweak.check}</p>
              </div>
            </LiquidGlass>
          </LiquidGlass>

          {/* Предупреждения */}
          {tweak.warnings && tweak.warnings.length > 0 && (
            <LiquidGlass as="section" className={`glass ${isHarmful ? "glass-danger" : "glass-accent"} p-6 sm:p-8`} data-reveal>
              <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
                <AlertTriangle className="h-5 w-5 text-warn" aria-hidden="true" />
                Важно знать
              </h2>
              <ul className="mt-4 space-y-3">
                {tweak.warnings.map((w, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink">
                    <i className="dot mt-2 flex-none text-warn" aria-hidden="true" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </LiquidGlass>
          )}

          {/* Содержимое файла */}
          <LiquidGlass as="section" className="glass p-6 sm:p-8" data-reveal>
            <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
              <FileText className="h-5 w-5 text-accent-hi" aria-hidden="true" />
              Открытое содержимое файла
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-2">
              Это ровно тот текст, который скачивается по кнопке выше — никаких скомпилированных .exe и скрытых
              команд.
            </p>
            <div className="mt-5 space-y-4">
              <CodeBlock title={tweak.file.name} content={tweak.file.content} />
              {tweak.manual && (
                <CodeBlock
                  title={tweak.manual.title}
                  content={tweak.manual.content}
                  note={tweak.manual.note}
                  collapsible
                />
              )}
            </div>
          </LiquidGlass>

          {/* Откат */}
          <LiquidGlass as="section" className="glass p-6 sm:p-8" data-reveal>
            <h2 className="flex items-center gap-2.5 text-xl font-bold tracking-tight">
              <RotateCcw className="h-5 w-5 text-accent-hi" aria-hidden="true" />
              Как откатить
            </h2>
            <ul className="mt-4 space-y-3">
              {tweak.revertSteps.map((step, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-2">
                  <i className="dot mt-2 flex-none text-accent-hi" aria-hidden="true" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
            {tweak.revert && (
              <div className="mt-5 space-y-4">
                <DownloadButton
                  href={`/api/download/${tweak.slug}?v=revert`}
                  label="Скачать файл отката"
                  variant="revert"
                />
                <CodeBlock title={tweak.revert.name} content={tweak.revert.content} collapsible />
              </div>
            )}
          </LiquidGlass>
        </div>

        {/* Боковая колонка */}
        <aside className="space-y-6 lg:sticky lg:top-24">
          <Link href={`/tweaker?tweak=${slug}`} className="btn w-full">
            К шагу в Твикере ↗
          </Link>

          <LiquidGlass as="section" className="glass p-5" data-reveal="right">
            <h2 className="text-base font-bold tracking-tight">Профиль влияния</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-3">
              Ожидаемый эффект: <strong className="text-ink-2">{tweak.gainLabel}</strong>
            </p>
            <div className="mt-4">
              <ImpactBars impact={tweak.impact} />
            </div>
          </LiquidGlass>

          <LiquidGlass as="nav" className="glass space-y-2.5 p-4" aria-label="Соседние твики">
            {prev && (
              <LiquidGlass as={Link} href={`/files/${prev.slug}`} className="tile tile-hover flex items-center gap-3 p-3.5">
                <ArrowLeft className="h-4 w-4 flex-none text-ink-3" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[12px] text-ink-3">Предыдущий</span>
                  <span className="block truncate text-sm font-semibold">{prev.title}</span>
                </span>
              </LiquidGlass>
            )}
            {next && (
              <LiquidGlass as={Link}
                href={`/files/${next.slug}`}
                className="tile tile-hover flex items-center justify-between gap-3 p-3.5"
              >
                <span className="min-w-0">
                  <span className="block text-[12px] text-ink-3">Следующий</span>
                  <span className="block truncate text-sm font-semibold">{next.title}</span>
                </span>
                <ArrowRight className="h-4 w-4 flex-none text-ink-3" aria-hidden="true" />
              </LiquidGlass>
            )}
            <Link href="/guide" className="btn btn-primary w-full">
              К дорожной карте
              <ArrowRight aria-hidden="true" />
            </Link>
          </LiquidGlass>
        </aside>
      </div>
    </article>
  );
}
