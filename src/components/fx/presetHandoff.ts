import { captureSource, type PopupSource } from "./popupGeometry";

// One explicit cross-route click, not a catalog impression/prefetch. Retain
// geometry only, never a detached document or an old React subtree.
let pending: { slug: string; at: number; rect: DOMRect; radius: NonNullable<PopupSource>["radius"] } | null =
  null;
export function rememberPreset(slug: string, from: HTMLElement | null) {
  const source = captureSource(from);
  pending = source ? { slug, at: performance.now(), rect: source.rect, radius: source.radius } : null;
}
export function consumePreset(slug: string) {
  const v = pending;
  pending = null;
  return v?.slug === slug && performance.now() - v.at < 10000 ? v : null;
}
