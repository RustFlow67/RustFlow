import type { ElementType, ReactNode } from "react";

/** Hover по оси wght вариативного шрифта Inter. */
export default function VariableWeight({
  children,
  className = "",
  as: Tag = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: ElementType;
}) {
  return <Tag className={`rf-wght ${className}`.trim()}>{children}</Tag>;
}
