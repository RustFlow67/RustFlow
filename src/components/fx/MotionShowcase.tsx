"use client";

import { Magnet, Sparkles, Waves } from "lucide-react";
import LiquidGlass from "../LiquidGlass";
import ScrollReveal from "@/components/fx/ScrollReveal";
import VariableWeight from "@/components/fx/VariableWeight";

const CARDS = [
  {
    icon: Sparkles,
    title: "Блик по кромке",
    text: "При наведении карточка чуть поднимается, а на кромке стекла появляется блик.",
  },
  {
    icon: Magnet,
    title: "Магнит кнопки",
    text: "Кнопка чуть тянется к курсору. Если в подвале включено «Уменьшить движение», эффект замирает.",
  },
  {
    icon: Waves,
    title: "Жидкая тема",
    text: "Смена темы даёт короткий morph. Ось wght заголовка тяжелеет на наведении.",
  },
];

/** Новая секция в конце главной: stagger, tilt, magnetic, specular, wght. */
export default function MotionShowcase() {
  return (
    <section aria-labelledby="rf-motion-heading">
      <ScrollReveal>
        <p className="eyebrow">Движение</p>
        <h2 id="rf-motion-heading" className="headline mt-2.5 text-[clamp(1.55rem,3.4vw,2.25rem)]">
          <VariableWeight as="span" className="rf-spec">
            Стекло, блик и вес шрифта
          </VariableWeight>
        </h2>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
          Клик по любой карточке оставляет рябь. Слои фона сдвигаются медленнее контента. Всё останавливается
          вне экрана, на скрытой вкладке и в режиме «Уменьшить движение».
        </p>
      </ScrollReveal>
      <ScrollReveal stagger className="mt-6 grid gap-4 md:grid-cols-3">
        {CARDS.map((card) => (
          <LiquidGlass data-reveal=""
            key={card.title}
            className="glass glass-hover relative p-5"
          >
            <card.icon className="h-5 w-5 text-accent-hi" aria-hidden="true" />
            <h3 className="mt-3 text-base font-bold text-ink">
              <VariableWeight>{card.title}</VariableWeight>
            </h3>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{card.text}</p>
          </LiquidGlass>
        ))}
      </ScrollReveal>
      <div className="mt-4">
        <button type="button" className="btn btn-primary" data-magnetic="">
          <Magnet className="h-4 w-4" aria-hidden="true" />
          Магнитная кнопка
        </button>
      </div>
    </section>
  );
}
