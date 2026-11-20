/** Focus and optical geometry share the actual invoker. Never borrow a
 * parent tile's outline or replace its contents with a placeholder. */
type Corners = readonly [number, number][];
export type PopupSource = {
  node: HTMLElement | null;
  rect: DOMRect;
  radius: Corners;
} | null;
// Resolve each horizontal/vertical radius in the visible coordinate space.
// CSS scales *all* four corners together when adjacent radii overlap (pills).
export function cornerRadii(node: HTMLElement, box: DOMRect): Corners {
  const s = getComputedStyle(node),
    w = node.offsetWidth || box.width,
    h = node.offsetHeight || box.height;
  const length = (v: string, size: number) => parseFloat(v) * (v.endsWith("%") ? size / 100 : 1) || 0;
  const r = [
    s.borderTopLeftRadius,
    s.borderTopRightRadius,
    s.borderBottomRightRadius,
    s.borderBottomLeftRadius,
  ].map((v) => {
    const [x, y = x] = v.split(" ");
    return [(length(x, w) * box.width) / w, (length(y, h) * box.height) / h];
  });
  const fit = Math.min(
    1,
    box.width / (r[0][0] + r[1][0] || 1),
    box.width / (r[3][0] + r[2][0] || 1),
    box.height / (r[0][1] + r[3][1] || 1),
    box.height / (r[1][1] + r[2][1] || 1),
  );
  return r.map(([x, y]) => [x * fit, y * fit]);
}
export function captureSource(node: HTMLElement | null): PopupSource {
  if (!node || node === document.body || node === document.documentElement) return null;
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { node, rect, radius: cornerRadii(node, rect) };
}

/** Measure the CURRENT home position, not that of a receding plane/flying
 * rail. Account for scroll, resize, a changed nickname or reordered results. */
export function restingRect(node: HTMLElement, r = node.getBoundingClientRect()) {
  const plane = node.closest<HTMLElement>("[data-hud], .rf-depth-plane");
  if (!plane) return r;
  const live = plane.getBoundingClientRect();
  const rest = plane.matches("[data-hud]")
    ? {
        x: plane.offsetLeft,
        y: plane.offsetTop,
        width: plane.offsetWidth,
        height: plane.offsetHeight,
      }
    : plane.parentElement!.getBoundingClientRect();
  const sx = rest.width / (live.width || 1),
    sy = rest.height / (live.height || 1);
  return new DOMRect(rest.x + (r.x - live.x) * sx, rest.y + (r.y - live.y) * sy, r.width * sx, r.height * sy);
}
/** Current source rect: live resting geometry on landing when the invoker
 * is still connected, otherwise the rect captured at press time. */
export function sourceBox(source: PopupSource, landing: boolean) {
  if (!source) return null;
  const node = source.node;
  const live = landing && node?.isConnected ? node.getBoundingClientRect() : null;
  return node && live?.width && live.height ? restingRect(node, live) : source.rect;
}
export function setSourcePose(panel: HTMLElement, source: PopupSource, landing: boolean) {
  const box = sourceBox(source, landing);
  if (!source || !box) return 0; // URL/keyboard entry without a visible source: a simple fade.
  const shell = panel.parentElement!.getBoundingClientRect();
  const w = panel.offsetWidth,
    h = panel.offsetHeight;
  if (!box.width || !box.height || !w || !h) return 0;
  const right = panel.classList.contains("profile-panel");
  // Uniform scale avoids stretching text. The rounded clip supplies the other
  // dimension, so the first and last *visible* frames match all four edges.
  const k = Math.max(box.width / w, box.height / h);
  const cropX = Math.max(0, w - box.width / k),
    cropY = Math.max(0, h - box.height / k);
  const radii = landing && source.node?.isConnected ? cornerRadii(source.node, box) : source.radius;
  const radius = [0, 1].map((axis) => radii.map((r) => `${r[axis] / k}px`).join(" ")).join(" / ");
  // The rounded crop, not the full transformed rectangle, is the visible edge.
  panel.style.setProperty("--rim-left", `${right ? cropX : 0}px`);
  panel.style.setProperty("--rim-right", `${right ? 0 : cropX}px`);
  panel.style.setProperty("--rim-bottom", `${cropY}px`);
  panel.style.setProperty("--rim-radius", radius);
  panel.style.setProperty(
    "--from-transform",
    `translate3d(${right ? box.right - shell.right : box.left - shell.left}px,${box.top - shell.top}px,0) scale(${k})`,
  );
  panel.style.setProperty(
    "--from-clip",
    `inset(0px ${right ? 0 : cropX}px ${cropY}px ${right ? cropX : 0}px round ${radius})`,
  );
  // Vertical travel of the two edges, including scale when the centres coincide.
  return Math.min(0.65, (Math.abs(shell.top - box.top) + Math.abs(shell.bottom - box.bottom)) / 1200);
}
