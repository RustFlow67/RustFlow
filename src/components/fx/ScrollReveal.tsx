import type { ElementType, HTMLAttributes, ReactNode } from "react";

/**
 * Обёртка над уже существующим scroll-reveal в Effects ([data-reveal] / [data-stagger]).
 * Свой наблюдатель не заводит.
 */
export default function ScrollReveal({
  children,
  className = "",
  stagger = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  stagger?: boolean;
  as?: ElementType;
}) {
  return (
    <Tag className={className} data-reveal="" data-stagger={stagger ? "" : undefined}>
      {children}
    </Tag>
  );
}

export function RevealItem({
  children,
  className = "",
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} data-reveal="" {...rest}>
      {children}
    </div>
  );
}
