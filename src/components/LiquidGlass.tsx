import { createElement, type ComponentPropsWithRef, type CSSProperties, type ElementType, type ReactNode } from "react";

// Share normalized bevels: a long catalogue does not need a full-size bitmap,
// ResizeObserver and SVG tree on every button. The native element remains the
// only hit/FLIP target. All text and icons are painted *after* this backdrop.
export const bevels = [
  { name: "pane", w: 252, h: 166, r: 22, bezel: 14, strength: 0.068 },
  { name: "pill", w: 128, h: 44, r: 22, bezel: 12, strength: 0.19 },
  { name: "round", w: 54, h: 54, r: 27, bezel: 13, strength: 0.46 },
  { name: "rail", w: 480, h: 38, r: 19, bezel: 10, strength: 0.044 },
  { name: "side", w: 44, h: 296, r: 22, bezel: 11, strength: 0.075 },
] as const;

/** Rounded-rectangle distance and inward bezel normal from LiquidGlass.tsx.
 * The map encodes an XY vector; it is never rendered or mixed into the scene. */
export function buildDisplacementMap({ w, h, r, bezel }: (typeof bevels)[number]) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const image = ctx.createImageData(w, h),
    d = image.data;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const px = x + 0.5 - w / 2,
        py = y + 0.5 - h / 2,
        qx = Math.abs(px) - (w / 2 - r),
        qy = Math.abs(py) - (h / 2 - r);
      const ox = Math.max(qx, 0),
        oy = Math.max(qy, 0),
        len = Math.hypot(ox, oy);
      const dist = r - len - Math.min(Math.max(qx, qy), 0);
      const amount = dist <= -1 ? 0 : Math.max(0, 1 - Math.max(dist, 0) / bezel) ** 2.2;
      const nx = len ? ox / len : +(qx > qy),
        ny = len ? oy / len : +(qx <= qy),
        i = 4 * (y * w + x);
      d[i] = 128 - 127 * amount * nx * Math.sign(px);
      d[i + 1] = 128 - 127 * amount * ny * Math.sign(py);
      d[i + 2] = 128;
      d[i + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL();
}

type Shape = (typeof bevels)[number]["name"];
type GlassProps<T extends ElementType> = {
  as?: T;
  shape?: Shape;
  /** Defaults to the active finish; Pure Liquid always uses a neutral coat. */
  tint?: string;
  /** Keep the semantic button in the HUD; lend its visual skin to its panel. */
  island?: boolean;
  children?: ReactNode;
} & Omit<ComponentPropsWithRef<NoInfer<T>>, "as" | "shape" | "tint" | "children">;

/** The native element IS the glass surface. No wrapper div, client hook,
 * per-card canvas, or filter applied to the text. Safe in server components;
 * React 19 forwards the original ref, events and ARIA attributes to the host. */
export default function LiquidGlass<T extends ElementType = "div">({
  as, shape = "pane", tint, island, children, ...props
}: GlassProps<T>) {
  const tag = as ?? "div";
  const style = tint ? { ...props.style, "--lg-tint": tint } as CSSProperties : props.style;
  if (!island) return createElement(tag, { ...props, style, "data-liquid-glass": shape }, children);
  return createElement(tag, { ...props, style, "data-island-button": shape }, <>
    <span data-island-home="" aria-hidden="true"><LiquidGlass as="span" shape={shape} tint={tint} className="island-skin" /></span>
    <span data-island-ink="">{children}</span>
  </>);
}
