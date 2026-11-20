import { quietMotion } from "./velocity";

const material = ".glass,.tile,.well,.segmented,.btn,.popover,.liquid-lens,.chip,.modal-panel";
const timing: KeyframeAnimationOptions = { duration: 160, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" };

/** Two actual phases, no duplicate page, snapshot dependency or fixed-height
 * slot. Fade at the painted surfaces: opacity on an ancestor of a card would
 * isolate its backdrop. Skip offscreen branches of long guides/catalogues. */
export function depart(commit: () => void): () => void {
  const pane = document.querySelector<HTMLElement>(".rf-page-enter");
  if (!pane || quietMotion() || !pane.animate) { commit(); return () => {}; }
  const painted: Element[] = [];
  function visit(node: Element) {
    const r = node.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight || !r.width) return;
    if (node.matches(material) || !node.querySelector(material)) painted.push(node);
    else for (const child of node.children) visit(child);
  }
  for (const child of pane.children) visit(child);
  const fades = painted.map(node => node.animate([{ opacity: getComputedStyle(node).opacity }, { opacity: 0 }], timing));
  const shift = pane.animate([{ transform: getComputedStyle(pane).transform }, { transform: "translate3d(0,22px,0) scale(.95)" }], timing);
  let cancelled = false;
  void shift.finished.then(() => { if (!cancelled) commit(); }, () => {});
  // Keep the last frame until the destination commits; a later intent can
  // cancel it and the associated push, including during the exit itself.
  return () => { cancelled = true; shift.cancel(); for (const a of fades) a.cancel(); };
}
