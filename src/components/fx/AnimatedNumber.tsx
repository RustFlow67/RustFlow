"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { getMotionReduced } from "@/lib/motion";

// All on-screen numeric/geometry tweens share one RAF. Offscreen values update directly.
const jobs = new Set<(time: number) => boolean>();
let frame = 0;
function tick(time: number) {
  frame = 0;
  for (const job of jobs) if (job(time)) jobs.delete(job);
  if (jobs.size) frame = requestAnimationFrame(tick);
}
export function tweenOnScreen(element: Element, change: (progress: number) => void) {
  const rect = element.getBoundingClientRect();
  if (document.hidden || getMotionReduced() || document.documentElement.hasAttribute("data-lite") || rect.bottom < 0 || rect.top > innerHeight) {
    change(1); return () => {};
  }
  const started = performance.now();
  let last = -1;
  const job = (time: number) => {
    const t = Math.max(0, Math.min(1, (time - started) / 400));
    const ease = t === 1 ? 1 : 1 - (1 - t) ** 3.65;
    if (ease !== last) { change(ease); last = ease; }
    return t === 1;
  };
  jobs.add(job);
  if (!frame) frame = requestAnimationFrame(tick);
  return () => { jobs.delete(job); if (!jobs.size && frame) { cancelAnimationFrame(frame); frame = 0; } };
}

export function AnimatedNumber({ value, digits = 0 }: { value: number; digits?: number }) {
  const element = useRef<HTMLSpanElement>(null), displayed = useRef(value);
  const [initial] = useState(() => value.toFixed(digits));
  useLayoutEffect(() => {
    const el = element.current;
    if (!el || displayed.current === value) return;
    const from = displayed.current;
    return tweenOnScreen(el, (t) => { displayed.current = from + (value - from) * t; el.textContent = displayed.current.toFixed(digits); });
  }, [value, digits]);
  return <><span ref={element} aria-hidden="true">{initial}</span><span className="sr-only">{value.toFixed(digits)}</span></>;
}
