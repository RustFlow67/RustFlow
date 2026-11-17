import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Ban,
  BookOpen,
  Code2,
  Cpu,
  Download,
  Gauge,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { EvidenceBadge, RiskLevelBadge } from "@/components/Badges";
import CategoryIcon from "@/components/CategoryIcon";
import DownloadButton from "@/components/DownloadButton";
import MotionShowcase from "@/components/fx/MotionShowcase";
import HomeUserStrip from "@/components/HomeUserStrip";
import { SectionHead } from "@/components/PageHeader";
import ScoreRing from "@/components/ScoreRing";
import { MYTHS } from "@/lib/content";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import { TWEAK_GROUPS } from "@/lib/models/tweak";
import { ACTIONABLE_TWEAKS, TWEAKS, TWEAKS_LITE } from "@/lib/tweaks";
import { plural } from "@/lib/tweaks/meta";
import type { TweakLite } from "@/lib/tweaks/types";

const FEATURED_SLUGS = [
  "xmp-expo-timings",
  "gc-buffer",
  "preset-competitive",
  "pagefile-auto",
  "ultimate-power-plan",
  "nvidia-panel",
];

function HeroShowcase() {
  const rows = [
    { label: "Моддед 2x", value: "130–150", scale: 0.86 },
    { label: "Официал", value: "90–100", scale: 0.62 },
    { label: "1% low (2x)", value: "~94 FPS", scale: 0.58 },
  ];
  return (
    <div className="relative mx-auto w-full max-w-[430px] lg:mr-1">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[38px] shadow-[0_36px_84px_-22px_rgb(0_0_0/0.85),inset_0_0_0_1px_rgb(255_255_255/0.16)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero.jpg"
          alt="Заброшенная спутниковая тарелка и радиовышка Rust на закате"
          width={880}
          height={1100}
          decoding="async"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/35" />
      </div>

      <div className="absolute right-3.5 top-3.5">
        <span className="chip chip-on-photo">5600X + RTX 5060</span>
      </div>

      {/* Плавающий виджет оценки /10 */}
      <div className="absolute left-2 top-12 sm:-left-7">
        <div
          className="glass glass-clear float-a flex w-[210px] items-center gap-3 p-3"
          style={{ "--r": "24px" } as CSSProperties}
        >
          <ScoreRing value={76} size={68} stroke={7}>
            <span className="text-[19px] font-extrabold tabular-nums tracking-tight">7.6</span>
          </ScoreRing>
          <div className="min-w-0">
            <p className="text-[11.5px] font-semibold text-ink-2">Оценка /10</p>
            <p className="text-[15px] font-bold leading-tight text-ink">Оптимум</p>
            <p className="mt-0.5 text-[11px] text-ink-3">32 ГБ @ 3600 CL18</p>
          </div>
        </div>
      </div>

      {/* Плавающий виджет твика */}
      <div className="absolute right-2 top-[41%] sm:-right-6">
        <div
          className="glass glass-clear float-b w-[198px] p-3"
          style={{ "--r": "22px" } as CSSProperties}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[11.5px] font-semibold text-ink">
              client.cfg
            </span>
            <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-white/15">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </div>
          <pre className="mt-1.5 font-mono text-[11px] leading-relaxed text-ink-2">
            {'gc.buffer "4096"\neffects.maxgibs "0"'}
          </pre>
        </div>
      </div>

      {/* Единственный blur-виджет на главной (в сумме с шапкой = 2 blur-слоя ≤ 4) */}
      <div className="absolute inset-x-3.5 bottom-4 sm:inset-x-5">
        <div className="glass glass-blur p-4" style={{ "--r": "26px" } as CSSProperties}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-ink">Референс 1080p (FPS)</p>
            <span className="text-[11px] text-accent-hi">Замерено</span>
          </div>
          <div className="mt-2.5 space-y-2">
            {rows.map((row) => (
              <div key={row.label} className="flex items-center gap-2.5">
                <span className="w-[82px] flex-none text-[12px] font-medium text-ink-2">
                  {row.label}
                </span>
                <div className="meter flex-1">
                  <i style={{ "--scale": String(row.scale) } as CSSProperties} />
                </div>
                <span className="w-[62px] flex-none text-right text-[12px] font-bold tabular-nums text-ink">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const featured = FEATURED_SLUGS.map((slug) => TWEAKS_LITE.find((t) => t.slug === slug)).filter(
    (t): t is TweakLite => Boolean(t),
  );
  const spotlightPresets = HARDWARE_PRESETS.slice(0, 3);

  return (
    <div className="space-y-20 sm:space-y-24">
      {/* ------------------------------- Hero ------------------------------- */}
      <section className="grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10">
        <div>
          <span className="chip chip-accent">
            <i className="dot dot-pulse" aria-hidden="true" />
            Твикер и бенчмарк под Rust · Без риска EAC
          </span>
          <h1 className="display mt-5 text-[clamp(2.35rem,6vw,4rem)]">
            Rust без фризов.
            <br />
            <span className="text-glow">Плавно, как жидкое стекло.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[16.5px] leading-relaxed text-ink-2 sm:text-[17.5px]">
            Прозрачная оценка сборки <strong>/10</strong>, библиотека проверенных твиков и мифов, эталонные пресеты
            железа и журнал замеров до/после. К каждому твику — инструкция, открытый файл и откат.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/benchmark" className="btn btn-primary btn-lg">
              <Gauge aria-hidden="true" />
              Оценить сборку /10
            </Link>
            <Link href="/tweaks" className="btn btn-lg">
              Библиотека твиков
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
          <ul className="mt-7 flex flex-wrap gap-2">
            <li className="chip">
              <ShieldCheck className="text-ok" aria-hidden="true" />
              EAC-безопасно · без .exe
            </li>
            <li className="chip">
              <RotateCcw aria-hidden="true" />
              Файл отката к каждому шагу
            </li>
            <li className="chip">
              <Ban className="text-danger" aria-hidden="true" />
              Маркировка мифов и вреда
            </li>
          </ul>
        </div>
        <HeroShowcase />
      </section>

      {/* -------------------- Живая панель профиля -------------------- */}
      <section aria-label="Быстрый доступ к вашему профилю">
        <HomeUserStrip totalActionable={ACTIONABLE_TWEAKS.length} />
      </section>

      {/* -------------------- 6 категорий библиотеки -------------------- */}
      <section aria-labelledby="cats-heading">
        <SectionHead
          eyebrow="6 категорий"
          title={<span id="cats-heading">Вся система — от таймингов RAM до launch-опций</span>}
          text="Каждая карточка помечена уровнем риска («Безопасно», «Осторожно», «Вредно») и статусом проверки («Замерено» или «Миф»)."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TWEAK_GROUPS.map((grp) => {
            const count = TWEAKS.filter((t) => t.group === grp.id).length;
            return (
              <Link
                key={grp.id}
                href={`/tweaks#${grp.id}`}
                className="glass glass-hover group flex flex-col p-5"
                data-reveal
              >
                <div className="flex items-center justify-between gap-3">
                  <CategoryIcon group={grp.id} />
                  <span className="chip">
                    {count} {plural(count, ["позиция", "позиции", "позиций"])}
                  </span>
                </div>
                <h3 className="mt-4 text-[17px] font-bold tracking-tight text-ink">{grp.title}</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{grp.description}</p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-[13px] font-semibold text-accent-hi">
                  Открыть категорию
                  <ArrowUpRight className="arrow-nudge h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* -------------------- Пресеты железа (витрина) -------------------- */}
      <section aria-labelledby="presets-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead
            eyebrow="Пресеты железа"
            title={<span id="presets-heading">Реальные конфиги с замерами Моддед / Официал</span>}
            text="Сверьтесь с эталоном (включая Ryzen 5 5600X + RTX 5060 + 32GB@3600), скопируйте client.cfg или сравните сборки."
          />
          <Link href="/presets" className="btn btn-sm mb-8">
            <Cpu aria-hidden="true" />
            Все {HARDWARE_PRESETS.length} пресетов и сравнение
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {spotlightPresets.map((p) => (
            <article
              key={p.id}
              className={`glass glass-hover flex flex-col p-5 ${p.featured ? "glass-accent" : ""}`}
              data-reveal
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`chip ${p.featured ? "chip-accent" : "chip-measured"}`}>
                  {p.badge}
                </span>
                <span className="text-sm font-extrabold tabular-nums text-ink">
                  {p.score10.toFixed(1)}/10
                </span>
              </div>
              <h3 className="mt-3.5 text-lg font-bold tracking-tight text-ink">{p.title}</h3>
              <p className="mt-1 text-[13px] text-ink-2">
                {p.ram} · {p.resolution}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-2 text-center tabular-nums">
                <div className="well p-3">
                  <span className="block text-[11px] font-bold uppercase text-sky">Моддед 2x</span>
                  <strong className="mt-0.5 block text-lg font-extrabold text-ink">
                    {p.fpsModded[0]}–{p.fpsModded[1]}
                  </strong>
                  <span className="text-[11px] text-ink-3">1% low {p.low1Modded}</span>
                </div>
                <div className="well p-3">
                  <span className="block text-[11px] font-bold uppercase text-accent-hi">Официал</span>
                  <strong className="mt-0.5 block text-lg font-extrabold text-ink">
                    {p.fpsOfficial[0]}–{p.fpsOfficial[1]}
                  </strong>
                  <span className="text-[11px] text-ink-3">1% low {p.low1Official}</span>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <Link
                  href={`/benchmark?preset=${p.slug}`}
                  className="text-[13px] font-semibold text-ink-2 hover:text-white"
                >
                  В калькулятор /10
                </Link>
                <Link href="/presets" className="btn btn-sm">
                  Настройки
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* -------------------- Ключевые проверенные твики -------------------- */}
      <section aria-labelledby="featured-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead
            eyebrow="Главный вклад в FPS"
            title={<span id="featured-heading">С чего начать оптимизацию</span>}
            text="Эти шесть шагов дают основную долю прироста среднего FPS и 1% low без компромиссов по безопасности."
          />
          <Link href="/tweaks" className="btn btn-sm mb-8">
            Все {TWEAKS.length} позиций
            <ArrowRight aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((tweak) => (
            <Link
              key={tweak.slug}
              href={`/tweaks/${tweak.slug}`}
              className="glass glass-hover group flex h-full flex-col p-5"
              data-reveal
            >
              <div className="flex items-start justify-between gap-2">
                <CategoryIcon group={tweak.group} size="sm" />
                <div className="flex flex-wrap justify-end gap-1.5">
                  <EvidenceBadge status={tweak.evidence} />
                  <RiskLevelBadge level={tweak.riskLevel} />
                </div>
              </div>
              <h3 className="mt-3.5 text-[17px] font-bold leading-snug text-ink">{tweak.title}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-2">{tweak.tagline}</p>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                <span className="text-[12.5px] font-semibold text-accent-hi">{tweak.gainLabel}</span>
                <span className="arrow-nudge grid h-8 w-8 place-items-center rounded-full bg-white/10">
                  <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* -------------------- Мифы и безопасность EAC -------------------- */}
      <section aria-labelledby="safety-home-heading">
        <div className="glass grid gap-8 p-6 sm:p-9 lg:grid-cols-[0.95fr_1.05fr]" data-reveal>
          <div>
            <p className="eyebrow">Мифы и безопасность EAC</p>
            <h2 id="safety-home-heading" className="headline mt-3 text-[clamp(1.75rem,3.8vw,2.5rem)]">
              Никаких плацебо, сломанного Defender и банов EAC
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
              Инжекторы, DLL-моды и утилиты, лезущие в память Rust, ведут к перманентному бану EAC, а вырезание
              Defender/Update и чистильщики реестра ломают ОС при 0% прироста. Аппаратный разгон (XMP/EXPO, PBO, GPU)
              и штатный <code className="font-mono text-ink">client.cfg</code> полностью безопасны.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href="/faq#eac" className="btn btn-primary">
                <ShieldAlert aria-hidden="true" />
                Правила EAC и вредные твики
              </Link>
              <Link href="/journal" className="btn">
                <Activity aria-hidden="true" />
                Журнал замеров
              </Link>
            </div>
          </div>

          <ul className="grid gap-3">
            {MYTHS.slice(0, 4).map((myth) => (
              <li key={myth.title} className="tile p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <EvidenceBadge status="myth" />
                    <h3 className="text-[14.5px] font-bold text-ink">{myth.title}</h3>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums text-ink-3">
                    {myth.measuredDelta}
                  </span>
                </div>
                <code className="mt-2 block truncate font-mono text-[12px] text-ink-3 line-through decoration-danger/70">
                  {myth.code}
                </code>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{myth.truth}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* -------------------- Полная настройка CTA -------------------- */}
      <section aria-labelledby="cta-heading">
        <div className="glass glass-accent p-7 text-center sm:p-11" data-reveal="scale">
          <p className="eyebrow">Полная настройка системы</p>
          <h2 id="cta-heading" className="display mx-auto mt-3.5 max-w-3xl text-[clamp(1.9rem,4.6vw,3.1rem)]">
            От точки восстановления до client.cfg — одним пакетом
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2">
            Идите по интерактивному чек-листу на сайте, скачайте ZIP с открытыми файлами и папкой отката или изучите
            краткое руководство.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/setup" className="btn btn-primary btn-lg sweep sweep-auto magnetic" data-magnetic>
              Открыть полную настройку
              <ArrowRight aria-hidden="true" />
            </Link>
            <DownloadButton
              href="/api/pack?profile=recommended&preset=balanced&gpu=all"
              label="Скачать рекомендуемый ZIP"
              variant="glass"
              size="lg"
            />
            <Link href="/guide" className="btn btn-lg">
              <BookOpen aria-hidden="true" />
              Руководство
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------- Исходный код сайта + App Kit -------------------- */}
      <section aria-labelledby="dev-kit-heading">
        <div className="glass flex flex-col gap-6 p-6 sm:p-9 lg:flex-row lg:items-center lg:justify-between" data-reveal>
          <div className="max-w-2xl">
            <p className="eyebrow">Open Source &amp; Desktop App Kit</p>
            <h2 id="dev-kit-heading" className="headline mt-2.5 text-[clamp(1.55rem,3.4vw,2.25rem)]">
              <span className="text-glass">Заберите весь код этого сайта и соберите своё .exe приложение</span>
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-2">
              Скачайте полный проект Next.js 16 со всеми 32 твиками, пресетами, темами Liquid Glass iOS 26 и шрифтами,
              а также готовый App Kit для сборки Windows <code className="font-mono text-ink">Setup.exe</code> (Tauri v2
              на Rust и Electron), Docker, Nginx и облачной синхронизации профилей.
            </p>
          </div>
          <div className="flex flex-none flex-wrap gap-2.5">
            <DownloadButton
              href="/api/source?download=full"
              label="Скачать весь проект (ZIP)"
              variant="primary"
              size="lg"
            />
            <Link href="/dev" className="btn btn-lg">
              <Code2 className="text-accent-hi" aria-hidden="true" />
              Код и App Kit
            </Link>
          </div>
        </div>
      </section>

      <MotionShowcase />
    </div>
  );
}
