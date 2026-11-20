import type { Locator } from "@playwright/test";

// Sample the outline defined by the source transform AND its clipping insets.
// The settled shell itself never moves; a click target can differ from the
// visual source (a small Details button inside a tile, or a sign-in gate).
export async function sourceOutline(panel: Locator) {
  return panel.evaluate((node) => {
    const el = node as HTMLElement,
      shell = el.parentElement!.getBoundingClientRect(),
      style = getComputedStyle(el);
    // Honest FLIP projects the panel through --from-transform/--from-clip.
    // The probe never paints (hidden, removed in the same task).
    const probe = document.createElement("div");
    Object.assign(probe.style, {
      position: "fixed",
      left: `${shell.x}px`,
      top: `${shell.y}px`,
      width: `${el.offsetWidth}px`,
      height: `${el.offsetHeight}px`,
      pointerEvents: "none",
      visibility: "hidden",
      transform: style.getPropertyValue("--from-transform"),
      clipPath: style.getPropertyValue("--from-clip"),
      transformOrigin: style.transformOrigin,
    });
    document.body.append(probe);
    const r = probe.getBoundingClientRect(),
      k = r.width / el.offsetWidth;
    const edges = getComputedStyle(probe)
      .clipPath.match(/^inset\(([^)]*?)(?: round|\))/)![1]
      .split(/ +/)
      .map(parseFloat);
    probe.remove();
    const [t, u = t, b = t, l = u] = edges;
    return [r.x + l * k, r.y + t * k, r.width - (l + u) * k, r.height - (t + b) * k];
  });
}
