import LiquidGlass from "@/components/LiquidGlass";
import type { CSSProperties, ReactNode } from "react";

export const delay = (n: number) => ({ "--d": n }) as CSSProperties;

/** Заголовок первого экрана — рендерится мгновенно для минимального LCP. */
export function PageHeader({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  text?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <LiquidGlass as="header" className="glass liquid-optics liquid-glass-card section-title mb-6 px-4 py-5 sm:mb-8 sm:px-7 sm:py-6">
      <div className="rf-page-content">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="headline mt-2.5 text-[clamp(1.35rem,4.5vw,2.7rem)]">
          <span className="text-glass">{title}</span>
        </h1>
        {text && <p className="mt-3 max-w-3xl text-sm leading-relaxed text-ink-2 sm:text-base">{text}</p>}
      </div>
      {children}
    </LiquidGlass>
  );
}

export function SectionHead({
  eyebrow,
  title,
  text,
  center = false,
}: {
  eyebrow: string;
  title: ReactNode;
  text?: ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`mb-7 max-w-2xl ${center ? "mx-auto text-center" : ""}`}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="headline mt-2.5 text-[clamp(1.6rem,3.6vw,2.4rem)]">
        <span className="text-glass">{title}</span>
      </h2>
      {text && <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-2">{text}</p>}
    </div>
  );
}
