"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { Activity } from "lucide-react";
import { useId } from "react";
import { useAmbientPlayback } from "./fx/useAmbientPlayback";

// Equal numbers of quadratic segments let SVG interpolate between traces.
// Small stalls on the left taper to an even cadence; no invented FPS result.
function trace(phase: number) {
  const points = Array.from({ length: 81 }, (_, i) => {
    const x = i * 4,
      envelope = Math.max(0, 1 - x / 200);
    const peak = (at: number, height: number) =>
      height * Math.exp(-((x - at - 3 * Math.sin(phase + at)) ** 2) / 24);
    const y =
      31 +
      (0.55 + 2.3 * envelope) * Math.sin(x * 0.23 + phase) -
      peak(28, 14) -
      peak(64, 23) -
      peak(102, 11) -
      peak(138, 17) -
      peak(174, 6);
    return [x, y] as const;
  });
  let d = `M0 ${points[0][1].toFixed(2)}`;
  for (let i = 1; i < points.length; i++) {
    const [x, y] = points[i - 1],
      [nx, ny] = points[i];
    d += ` Q${x} ${y.toFixed(2)} ${(x + nx) / 2} ${((y + ny) / 2).toFixed(2)}`;
  }
  return d + ` T320 ${points.at(-1)![1].toFixed(2)}`;
}
const traces = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map(trace);
const sequence = [...traces, traces[0]].join(";");

export default function FrameTime() {
  const id = useId(),
    { ref, playback } = useAmbientPlayback<HTMLElement>();
  return (
    <LiquidGlass as="figure" ref={ref} className="well frame-time" data-playback={playback} aria-labelledby={`${id}-title`}>
      <figcaption>
        <strong id={`${id}-title`}>
          <Activity size={14} aria-hidden="true" /> Frame Time
        </strong>
        <span>Иллюстрация · мс/кадр</span>
      </figcaption>
      <svg viewBox="0 0 320 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-ink`}>
            <stop offset="0%" stopColor="var(--ink-2)" />
            <stop offset="41%" stopColor="var(--ink-2)" />
            <stop offset="59%" stopColor="var(--theme-accent)" />
            <stop offset="100%" stopColor="var(--theme-accent)" />
          </linearGradient>
        </defs>
        <path className="frame-grid" d="M0 8H320 M0 21H320 M0 35H320 M160 2V42" />
        <path
          className="frame-trace"
          d={traces[0]}
          fill="none"
          stroke={`url(#${id}-ink)`}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        >
          {playback === "playing" && (
            <animate
              attributeName="d"
              values={sequence}
              dur="4.8s"
              repeatCount="indefinite"
              calcMode="spline"
              keyTimes="0;0.333;0.667;1"
              keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1"
            />
          )}
        </path>
      </svg>
      <div className="frame-legend">
        <span>Без оптимизации · фризы</span>
        <span>RustFlow · стабильный 1% low</span>
      </div>
    </LiquidGlass>
  );
}
