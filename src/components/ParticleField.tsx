"use client";

import { useEffect, useRef } from "react";
import { fpsEngine } from "@/lib/fps/engine";
import { effectiveLab, getLabSnapshot } from "@/lib/fps/lab";
import { getResolvedTheme } from "@/lib/theme";

/** Deterministic PRNG so the field is stable between mounts. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface P {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  tw: number;
  ph: number;
  c: number;
  bloom: boolean;
}

const MAX = 420;

/**
 * Dense cinematic particle field driven by the single FPS-engine rAF loop.
 * Count, speed, glow and DPR come from the FPS lab; paused when the tab is
 * hidden, and disabled in reduced-motion / lite modes.
 */
export default function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const rand = mulberry32(20261117);
    const parts: P[] = Array.from({ length: MAX }, () => ({
      x: rand(),
      y: rand(),
      r: 0.7 + rand() * 2.4,
      vx: (rand() - 0.5) * 0.028,
      vy: -0.004 - rand() * 0.03,
      tw: 0.5 + rand() * 2,
      ph: rand() * Math.PI * 2,
      c: Math.floor(rand() * 4),
      bloom: rand() < 0.3,
    }));

    let w = 0;
    let h = 0;
    let dpr = 1;

    const resize = (quality: number) => {
      const base = Math.min(2, window.devicePixelRatio || 1);
      dpr = Math.min(2.5, Math.max(0.5, base * quality));
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
    };
    resize(1);

    let lastQuality = 1;
    const onResize = () => resize(lastQuality);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);

    const isCalm = () => {
      const root = document.documentElement;
      return (
        root.getAttribute("data-motion") === "reduced" || root.hasAttribute("data-lite")
      );
    };

    const unsub = fpsEngine.onTick((dtMs, nowMs) => {
      const s = effectiveLab(getLabSnapshot());
      if (s.quality !== lastQuality) {
        lastQuality = s.quality;
        resize(s.quality);
      }
      const count = Math.round(s.particles);
      if (count <= 0 || isCalm()) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      const light = getResolvedTheme() === "light";
      const palette = light
        ? ["200,90,18", "11,108,171", "122,63,209", "150,80,10"]
        : ["255,150,80", "120,216,255", "200,150,255", "255,220,170"];
      const dt = Math.min(0.05, dtMs / 1000) * s.speed;
      const t = nowMs / 1000;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = light ? "multiply" : "lighter";

      const n = Math.min(count, parts.length);
      for (let i = 0; i < n; i += 1) {
        const p = parts[i];
        p.x += p.vx * dt * (0.6 + 0.4 * Math.sin(t * 0.3 + p.ph));
        p.y += p.vy * dt;
        if (p.y < -0.03) {
          p.y = 1.03;
          p.x = (p.x + 0.37) % 1;
        }
        if (p.x < -0.03) p.x = 1.03;
        else if (p.x > 1.03) p.x = -0.03;
        const tw = 0.45 + 0.55 * Math.sin(t * p.tw + p.ph);
        const alpha = (light ? 0.5 : 0.65) * tw * Math.min(1.4, 0.4 + s.glow * 0.6);
        const px = p.x * w;
        const py = p.y * h;
        if (p.bloom && s.glow > 0.25) {
          ctx.shadowBlur = 14 * s.glow;
          ctx.shadowColor = `rgba(${palette[p.c]},${(alpha * 0.9).toFixed(3)})`;
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = `rgba(${palette[p.c]},${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(px, py, p.r * (light ? 1.1 : 1.3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = "source-over";
    });

    return () => {
      unsub();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, []);

  return <canvas ref={ref} className="particle-canvas" aria-hidden="true" />;
}
