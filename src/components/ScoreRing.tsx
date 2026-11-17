"use client";

import { useId, type ReactNode } from "react";

/** Лёгкий круговой индикатор (0..100) без тяжёлых SVG drop-shadow фильтров. */
export default function ScoreRing({
  value,
  size = 172,
  stroke = 13,
  color = "#ff8e4f",
  colorTo = "#ffd9a8",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  colorTo?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className="relative grid flex-none place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={colorTo} />
            <stop offset="1" stopColor={color} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(0 0 0 / 0.42)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(255 255 255 / 0.1)"
          strokeWidth={1}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}
