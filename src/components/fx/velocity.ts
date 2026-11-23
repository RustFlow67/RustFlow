/** Each resource has a single clock. Retargeting cancels the old RAF and removes
 * its binding before a new pulse starts. Different axes can run concurrently. */
type Channel = "motion-blur-x" | "motion-blur-y";
const stopByChannel = new Map<Channel, () => void>();
export const quietMotion = () => document.hidden || document.documentElement.matches('[data-motion="reduced"], [data-lite], [data-engine-motion="instant"]');

/** Bidirectional flight blur + vector stretch for dialog shells. The blur
 * rises to its peak at 40% of the trajectory, holds through 80%, then fades
 * smoothly across the final fifth so the shell lands sharp with no click or
 * flicker on the source button. The dominant travel axis picks the stretch
 * direction so a vertical morph elongates vertically and a horizontal one
 * sideways. WAAPI `filter`/`scale` never touch the FLIP `transform`/
 * `clip-path`/`opacity`/`backdrop-filter` timelines the tests seek; the FLIP
 * itself runs on GPU-composited transform/clip-path/opacity only. */
export function pulseFlight(targets: readonly HTMLElement[], dx: number, dy: number, duration: number) {
  if (quietMotion() || !targets.length || !duration || duration <= 0) return;
  const mag = Math.hypot(dx, dy);
  const vertical = Math.abs(dy) >= Math.abs(dx);
  const sx = vertical ? 0.985 : 1.03;
  const sy = vertical ? 1.03 : 0.985;
  // Cap raster blur on full dialog surfaces to preserve readability and limit paint cost.
  const blurPeak = mag < 40 ? 1 : mag < 160 ? 2 : 3;
  const running: Animation[] = [];
  for (const el of targets) {
    if (!el.isConnected || typeof el.animate !== "function") continue;
    try {
      running.push(
        el.animate(
          [
            { filter: "blur(0px)", scale: "1 1", offset: 0 },
            { filter: `blur(${blurPeak}px)`, scale: `${sx} ${sy}`, offset: 0.4 },
            { filter: `blur(${blurPeak}px)`, scale: `${sx} ${sy}`, offset: 0.8 },
            { filter: "blur(0px)", scale: "1 1", offset: 1 },
          ],
          { duration, easing: "linear", fill: "none" },
        ),
      );
    } catch {
      /* WAAPI unavailable: the CSS flight still runs sharp. */
    }
  }
  if (!running.length) return;
  return () => {
    for (const a of running) {
      try {
        a.cancel();
      } catch {
        /* Already finished. */
      }
    }
  };
}

export function pulseVelocity(surface: HTMLElement, channel: Channel, speed: () => number = () => 1) {
  stopByChannel.get(channel)?.();
  if (quietMotion()) return;
  const def = document.getElementById(channel);
  const blur = def?.querySelector("feGaussianBlur");
  if (!blur) return;
  const apply = (strength: number) => {
    const x = channel === "motion-blur-x" ? 20 * strength : 0;
    const y = channel === "motion-blur-y" ? 16 * strength : 0;
    blur.setAttribute("stdDeviation", `${+x.toFixed(2)}, ${+y.toFixed(2)}`);
  };
  const start = performance.now(), duration = channel === "motion-blur-y" ? 180 : 280;
  const peak = channel === "motion-blur-y" ? 72 : 140;
  let frame = 0, stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame); apply(0);
    if (surface.dataset.velocity === channel) delete surface.dataset.velocity;
    stopByChannel.delete(channel);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("pagehide", stop);
  };
  const visibility = () => { if (document.hidden) stop(); };
  const tick = (now: number) => {
    const t = Math.max(0, now - start);
    if (t >= duration || !surface.isConnected || quietMotion()) { stop(); return; }
    // A smooth, zero-slope rise/fall near peak speed; dock strength also
    // depends on actual lens velocity, not pointer event frequency.
    const u = t < peak ? t / peak : (duration - t) / (duration - peak);
    apply(u * u * (3 - 2 * u) * Math.min(1, Math.abs(speed())));
    frame = requestAnimationFrame(tick);
  };
  apply(0); surface.dataset.velocity = channel;
  stopByChannel.set(channel, stop);
  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("pagehide", stop);
  frame = requestAnimationFrame(tick);
  return stop;
}
