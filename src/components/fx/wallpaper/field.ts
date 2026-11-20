/** The two inverse-square fields and independent orbits of the reference wallpaper.
 * No input coordinates, random seeds, DOM reads or frame-rate-dependent physics. */
type Blob = {
  ox: number;
  oy: number; // центр орбиты (доля от половины экрана)
  ax: number;
  ay: number; // амплитуда
  fx: number;
  fy: number; // частоты, рад/с
  px: number;
  py: number; // фазы
  r: number; // радиус
  rv: number; // пульсация радиуса
  fr: number;
  pr: number;
};

// prettier-ignore
export const pigment: Blob[] = [
  { ox: -0.25, oy: 0.05, ax: 0.55, ay: 0.45, fx: 0.11, fy: 0.087, px: 0.3, py: 1.2, r: 0.26, rv: 0.025, fr: 0.2, pr: 0.0 },
  { ox: 0.55, oy: 0.35, ax: 0.5, ay: 0.4, fx: 0.093, fy: 0.12, px: 2.1, py: 0.4, r: 0.17, rv: 0.02, fr: 0.27, pr: 1.0 },
  { ox: 0.1, oy: -0.5, ax: 0.7, ay: 0.35, fx: 0.07, fy: 0.105, px: 4.0, py: 2.6, r: 0.2, rv: 0.02, fr: 0.23, pr: 2.1 },
  { ox: -0.7, oy: -0.4, ax: 0.35, ay: 0.55, fx: 0.125, fy: 0.08, px: 5.2, py: 3.3, r: 0.13, rv: 0.015, fr: 0.31, pr: 3.0 },
  { ox: 0.8, oy: -0.2, ax: 0.4, ay: 0.6, fx: 0.082, fy: 0.099, px: 1.4, py: 5.0, r: 0.15, rv: 0.02, fr: 0.25, pr: 4.2 },
  { ox: -0.1, oy: 0.6, ax: 0.6, ay: 0.3, fx: 0.101, fy: 0.074, px: 3.6, py: 0.9, r: 0.11, rv: 0.015, fr: 0.33, pr: 5.0 },
];

// prettier-ignore
export const crystal: Blob[] = [
  { ox: 0.5, oy: 0.1, ax: 0.6, ay: 0.5, fx: 0.085, fy: 0.1, px: 0.9, py: 2.2, r: 0.24, rv: 0.025, fr: 0.18, pr: 0.5 },
  { ox: -0.55, oy: 0.55, ax: 0.5, ay: 0.4, fx: 0.105, fy: 0.078, px: 2.8, py: 4.4, r: 0.16, rv: 0.02, fr: 0.26, pr: 1.7 },
  { ox: 0.15, oy: -0.1, ax: 0.8, ay: 0.55, fx: 0.066, fy: 0.092, px: 5.5, py: 1.0, r: 0.12, rv: 0.015, fr: 0.3, pr: 2.9 },
  { ox: -0.9, oy: -0.1, ax: 0.3, ay: 0.7, fx: 0.115, fy: 0.07, px: 1.9, py: 3.9, r: 0.1, rv: 0.012, fr: 0.35, pr: 4.0 },
  { ox: 0.9, oy: 0.7, ax: 0.35, ay: 0.4, fx: 0.09, fy: 0.11, px: 4.6, py: 5.7, r: 0.19, rv: 0.02, fr: 0.22, pr: 5.3 },
];

export function orbit(blobs: Blob[], out: Float32Array, t: number, w: number, h: number, unit: number) {
  const radiusScale = Math.min(1, (w / h) * 1.45); // Leave room for the necks between drops on a phone.
  blobs.forEach((b, i) => {
    out[3 * i] = (w / (2 * unit)) * (b.ox + b.ax * Math.sin(t * b.fx + b.px));
    out[3 * i + 1] = (h / (2 * unit)) * (b.oy + b.ay * Math.cos(t * b.fy + b.py));
    out[3 * i + 2] = radiusScale * (b.r + b.rv * Math.sin(t * b.fr + b.pr));
  });
}

export type Color = [number, number, number];
export interface Light {
  ground: Color;
  accent: Color;
  pearl: number;
  clear: number;
  shine: number;
}
export type Draw = (
  w: number,
  h: number,
  unit: number,
  dye: Float32Array,
  glass: Float32Array,
  light: Light,
) => void;
export interface Renderer {
  draw: Draw;
  dispose: () => void;
}

/** All ten finishes use the very same colour tokens as their controls. */
export function lighting(root: HTMLElement): Light {
  const css = getComputedStyle(root);
  function rgb(token: string, fallback: string): Color {
    let hex = css.getPropertyValue(token).trim().replace(/^#/, "");
    if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
    const n = parseInt(/^[0-9a-f]{6}$/i.test(hex) ? hex : fallback, 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return {
    ground: rgb("--bg", "070507"),
    accent: rgb("--theme-accent", "cd412b"),
    pearl: Number(root.dataset.material === "pearl"),
    clear: Number(root.dataset.material === "liquid"),
    shine: Number(css.getPropertyValue("--rf-shine").trim() || 1),
  };
}

/** Interpolate complete illumination, never the sampling coordinates of
 * individual colour channels. Both renderers see the very same mixture. */
export function blendLight(a: Light, b: Light, progress: number): Light {
  const t = progress * progress * (3 - 2 * progress);
  const mix = (x: number, y: number) => x + (y - x) * t;
  const color = (x: Color, y: Color): Color => [mix(x[0],y[0]), mix(x[1],y[1]), mix(x[2],y[2])];
  return { ground:color(a.ground,b.ground), accent:color(a.accent,b.accent), pearl:mix(a.pearl,b.pearl), clear:mix(a.clear,b.clear), shine:mix(a.shine,b.shine) };
}
