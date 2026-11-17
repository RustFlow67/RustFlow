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
    <header className="hero-scrim mb-8 max-w-3xl sm:mb-10">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="headline mt-2.5 text-[clamp(1.9rem,5vw,3.2rem)]">
        <span className="text-glass">{title}</span>
      </h1>
      {text && (
        <p className="mt-3.5 max-w-2xl text-[16px] leading-relaxed text-ink-2 sm:text-[17px]">{text}</p>
      )}
      {children}
    </header>
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
    <div className={`mb-7 max-w-2xl ${center ? "mx-auto text-center" : ""}`} data-reveal>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="headline mt-2.5 text-[clamp(1.6rem,3.6vw,2.4rem)]">
        <span className="text-glass">{title}</span>
      </h2>
      {text && <p className="mt-2.5 text-[15.5px] leading-relaxed text-ink-2">{text}</p>}
    </div>
  );
}
