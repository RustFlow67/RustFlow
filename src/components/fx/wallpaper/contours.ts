import type { Color, Renderer } from "./field";

type Point = { x: number; y: number; links: number[] };
/** Lightweight Canvas2D fallback: trace the *same* f=1 isocontour, not a
 * collection of overlapping circles. Grid resolution is independent of DPR. */
function outline(w: number, h: number, unit: number, drops: Float32Array) {
  const step = Math.max(9, Math.max(w, h) / 74),
    pad = 4, // close off-screen loops beyond the reflected shoulder, not on the viewport border
    cols = Math.ceil(w / step) + 2 * pad + 1,
    rows = Math.ceil(h / step) + 2 * pad + 1;
  const f = new Float32Array(cols * rows),
    points = new Map<number, Point>();
  for (let j = 1; j < rows - 1; j++)
    for (let i = 1; i < cols - 1; i++) {
      const x = ((i - pad) * step - w / 2) / unit,
        y = (h / 2 - (j - pad) * step) / unit;
      let v = 0;
      for (let k = 0; k < drops.length; k += 3) {
        const dx = x - drops[k],
          dy = y - drops[k + 1];
        v += drops[k + 2] ** 2 / (dx * dx + dy * dy + 0.00001);
      }
      f[j * cols + i] = v;
    }
  function crossing(n: number, vertical: number) {
    const key = 2 * n + vertical;
    if (!points.has(key)) {
      const next = n + (vertical ? cols : 1),
        t = (1 - f[n]) / (f[next] - f[n]);
      points.set(key, {
        x: ((n % cols) - pad + (vertical ? 0 : t)) * step,
        y: (Math.floor(n / cols) - pad + (vertical ? t : 0)) * step,
        links: [],
      });
    }
    return key;
  }
  function connect(a: number, b: number) {
    points.get(a)!.links.push(b);
    points.get(b)!.links.push(a);
  }
  for (let j = 0; j < rows - 1; j++)
    for (let i = 0; i < cols - 1; i++) {
      const n = j * cols + i,
        a = f[n] >= 1,
        b = f[n + 1] >= 1,
        c = f[n + cols + 1] >= 1,
        d = f[n + cols] >= 1;
      if (a === b && a === c && a === d) continue;
      const seg: number[] = [];
      if (a !== b) seg.push(crossing(n, 0));
      if (b !== c) seg.push(crossing(n + 1, 1));
      if (c !== d) seg.push(crossing(n + cols, 0));
      if (d !== a) seg.push(crossing(n, 1));
      if (seg.length === 4 && a !== (f[n] + f[n + 1] + f[n + cols] + f[n + cols + 1]) * 0.25 >= 1)
        seg.push(seg.shift()!);
      connect(seg[0], seg[1]);
      if (seg.length === 4) connect(seg[2], seg[3]);
    }
  const path = new Path2D();
  for (const [start, first] of points) {
    let prev = start,
      id = first.links[0],
      p = points.get(id)!;
    const x0 = (p.x + first.x) / 2,
      y0 = (p.y + first.y) / 2;
    path.moveTo(x0, y0);
    while (id !== start) {
      const next = p.links[0] === prev ? p.links[1] : p.links[0],
        q = points.get(next)!;
      path.quadraticCurveTo(p.x, p.y, (p.x + q.x) / 2, (p.y + q.y) / 2);
      points.delete(id);
      prev = id;
      id = next;
      p = q;
    }
    path.quadraticCurveTo(first.x, first.y, x0, y0);
    path.closePath();
    points.delete(start);
  }
  return path;
}
const rgba = (color: Color, alpha: number) =>
  `rgba(${color.map((c) => Math.round(c * 255)).join(",")},${alpha})`;
export function contourRenderer(ctx: CanvasRenderingContext2D): Renderer {
  return {
    draw(w, h, unit, a, b, light) {
      ctx.clearRect(0, 0, w, h); // themed CSS gradient remains visible through the pools
      for (const [i, blobs] of [a, b].entries()) {
        const path = outline(w, h, unit, blobs),
          dye: Color = i ? [0.88, 0.88, 0.88] : light.accent;
        const fill = ctx.createLinearGradient(0, 0, w * 0.74, h);
        const strength = i ? 0.35 : 0.69 - 0.37 * light.clear;
        fill.addColorStop(0, rgba(dye, strength));
        fill.addColorStop(0.57, rgba(dye, strength * 0.44));
        fill.addColorStop(1, rgba(dye, strength * 0.78));
        ctx.fillStyle = fill;
        ctx.fill(path, "evenodd");
        // Cast the light from outside the combined contour so that a pair of
        // merging drops has a single continuous shoulder, never two circles.
        const outside = new Path2D();
        outside.rect(-32, -32, w + 64, h + 64);
        outside.addPath(path);
        ctx.save();
        ctx.clip(path, "evenodd");
        ctx.fillStyle = "#fff";
        ctx.shadowColor = rgba([1, 1, 1], 0.43 * light.shine);
        ctx.shadowBlur = Math.max(2, unit * 0.012);
        ctx.shadowOffsetX = unit * 0.004;
        ctx.shadowOffsetY = unit * 0.007;
        ctx.fill(outside, "evenodd");
        ctx.shadowColor = rgba([1, 1, 1], 0.26 * light.shine);
        ctx.shadowOffsetX = -unit * 0.007;
        ctx.shadowOffsetY = -unit * 0.01;
        ctx.fill(outside, "evenodd");
        ctx.restore();
        const rim = ctx.createLinearGradient(0, 0, w, h);
        for (const [stop, alpha] of [
          [0, 0.86],
          [0.34, 0.13],
          [0.58, 0.05],
          [0.85, 0.63],
          [1, 0.24],
        ])
          rim.addColorStop(stop, rgba([1, 1, 1], alpha * light.shine));
        ctx.strokeStyle = rim;
        ctx.lineWidth = Math.max(1.2, unit / 445);
        ctx.stroke(path);
      }
    },
    dispose() {},
  };
}
