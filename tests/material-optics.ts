// These projects use Chromium. Assert a real reference filter in the material,
// not just a CSS colour or the existence of the SVG resource elsewhere.
export const optics = (px: number, shape: string) =>
  `blur(${px}px) saturate(1.65) url("#rf-liquid-${shape}") brightness(1.08)`;
