"use client";

import { useEffect, useRef, useState } from "react";

/** Number that counts up with an ease-out curve when it scrolls into view. */
export default function CountUp({
  value,
  duration = 1400,
  className,
}: {
  value: number;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      if (reduce) {
        from.current = value;
        setShown(value);
        return;
      }
      const start = performance.now();
      const base = from.current;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 4);
        const current = Math.round(base + (value - base) * eased);
        setShown(current);
        if (t < 1) raf = requestAnimationFrame(tick);
        else from.current = value;
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        run();
        io.disconnect();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ""}`}>
      {shown.toLocaleString("ru-RU")}
    </span>
  );
}
