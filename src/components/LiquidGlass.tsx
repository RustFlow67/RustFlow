import { createElement, type ComponentPropsWithRef, type CSSProperties, type ElementType, type ReactNode } from "react";

type Shape = "pane" | "pill" | "round" | "rail" | "side";
type GlassProps<T extends ElementType> = {
  as?: T;
  shape?: Shape;
  tint?: string;
  island?: boolean;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<NoInfer<T>>, "as" | "shape" | "tint" | "children">;

/** A semantic, server-compatible surface; no canvas or per-element filters. */
export default function LiquidGlass<T extends ElementType = "div">({ as, shape = "pane", tint, island, children, ...props }: GlassProps<T>) {
  const tag = as ?? "div";
  const style = tint ? { ...props.style, "--lg-tint": tint } as CSSProperties : props.style;
  if (!island) return createElement(tag, { ...props, style, "data-liquid-glass": shape }, children);
  return createElement(tag, { ...props, style, "data-island-button": shape }, <>
    <span data-island-home="" aria-hidden="true"><LiquidGlass as="span" shape={shape} tint={tint} className="island-skin" /></span>
    <span data-island-ink="">{children}</span>
  </>);
}
