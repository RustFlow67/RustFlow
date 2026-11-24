import type { ReactNode } from "react";
import { IS_DESKTOP_APP } from "@/lib/config";
import { ArrowDownRight } from "lucide-react";
import SummaryButton from "./SummaryButton";
import HomeConsole from "./HomeConsole";
import { PageHeader } from "./PageHeader";

// Same banner on first paint and on an optimistic Dock transition. Large route
// tools own their interactive action; the pending banner cannot open a stale rig.
const intros = {
  "/guide": {
    eyebrow: "С чего начать",
    title: "Пять шагов к настройке Rust",
    text: "Пройдите путь от резервной копии до контрольного замера. Отмечайте только то, что уже сделали на своём ПК.",
  },
  "/benchmark": {
    eyebrow: "01 // HARDWARE LAB",
    title: "Сборка.",
    text: "Начните с модели процессора и видеокарты. Прогноз — расчёт для выбранного ПК, не замер в игре. Конфиг — текстовый файл настроек Rust.",
  },
  "/presets": {
    eyebrow: "02 // CONFIG LAB",
    title: "Пресеты.",
    text: IS_DESKTOP_APP ? "Пресет — готовый набор настроек игры. Выберите похожий ПК и откройте «Детали», чтобы проверить команды перед применением." : "Пресет — готовый набор настроек игры. Выберите похожий ПК и откройте «Детали», чтобы посмотреть или скачать файл client.cfg.",
  },
  "/tweaker": {
    eyebrow: "03 // SYSTEM CONTROL",
    title: "Твикер.",
    text: IS_DESKTOP_APP ? "Выберите графику и обратимые шаги. Перед применением проверьте список и команды своего конфига." : "Выберите графику и понятные вам изменения. Твикер соберёт ZIP с настройками и инструкцией, как вернуть всё назад. На ПК ничего не запускается автоматически.",
  },
  "/windows": {eyebrow:"Windows",title:"Настройте Windows для игры",text:"Сначала запишите, как игра работает сейчас. Затем измените один параметр и повторите тот же маршрут: так проще отличить пользу от случайности."},
  "/faq": {
    eyebrow: "06 // SAFETY & FAQ",
    title: "FAQ.",
    text: "EAC — античит Rust. Прежде чем пробовать чужой «ускоритель», проверьте, не вмешивается ли он в игру и есть ли штатная альтернатива.",
  },
} as const;
export type DockPath = "/" | keyof typeof intros;
const actions = {
  "/guide": ["#roadmap", "К моей дорожной карте"],
  "/windows": ["#measure","К протоколу замера"],
  "/presets": ["#preset-library", "Выбрать пресет"],
  "/tweaker": ["#pack-settings", "Настроить пакет"],
  "/faq": ["#eac", "Проверить правила EAC"],
} as const;

export function DockIntro({
  href,
  pending = false,
  children,
}: {
  href: DockPath;
  pending?: boolean;
  children?: ReactNode;
}) {
  if (href === "/")
    return (
      <section className="rf-home-hero" aria-labelledby="home-title">
        <div className="rf-hero-copy rf-page-content">
          <h1 id="home-title" className="rf-home-title" aria-label="Rust без фризов. Максимум FPS. Ноль лишнего.">
            <span>Rust без фри&shy;зов.</span> <span>Мак&shy;си&shy;мум FPS.</span> <span>Ноль лиш&shy;не&shy;го.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-2 sm:text-lg">
            От характеристик вашего ПК до готового файла настроек. Без .exe, с проверкой результата и откатом.
          </p>
          <a className="btn btn-primary mt-4" href="#home-steps">
            Начать с трёх шагов <ArrowDownRight aria-hidden="true" />
          </a>
        </div>
        <HomeConsole />
      </section>
    );
  const button = "btn btn-primary mt-4";
  const intro = intros[href];
  const editorialTitle = href === "/benchmark" || href === "/presets" || href === "/tweaker"
    ? <em>{intro.title}</em> : intro.title;
  return (
    <PageHeader {...intro} title={editorialTitle}>
      {children ??
        (href === "/benchmark" ? (
          <div className="mt-4"><SummaryButton disabled /></div>
        ) : pending ? (
          <button className={button} disabled>
            {actions[href][1]} <ArrowDownRight aria-hidden="true" />
          </button>
        ) : (
          <a href={actions[href][0]} className={button}>
            {actions[href][1]} <ArrowDownRight aria-hidden="true" />
          </a>
        ))}
    </PageHeader>
  );
}
