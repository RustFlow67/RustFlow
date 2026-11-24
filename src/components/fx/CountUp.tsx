"use client";
import { useEffect, useRef, useState } from "react";

/** Interpolate only changing forecast readouts; estimates remain labelled as estimates. */
export function CountUp({ value, digits = 0 }: { value: number; digits?: number }) {
  const [number, setNumber] = useState(value);
  const current = useRef(value);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced") {
      current.current = value;
      return;
    }
    const start = current.current, started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - started) / 600);
      current.current = start + (value - start) * (1 - Math.pow(1 - t, 3));
      setNumber(current.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const reduced = typeof window !== "undefined" && (matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "reduced");
  return <span>{(reduced ? value : number).toFixed(digits)}</span>;
}
