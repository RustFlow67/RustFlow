/** Own only the content plane and HUD. A nested confirm dialog must not bring
 * navigation back while its parent is still open. No filtered app ancestor. */
const owners = new Set<HTMLElement>();
let background: HTMLElement[] = [];
export function enterDepth(panel: HTMLElement) {
  if (!owners.size) {
    const slot = document.querySelector<HTMLElement>(".rf-depth-slot");
    if (slot) slot.style.setProperty("--depth-y", `${innerHeight / 2 - slot.getBoundingClientRect().top}px`);
    document.body.dataset.popupDepth = "";
    // Release the scroll impulse before the HUD recedes; a pinned source
    // bar holds the pose captured at press time instead.
    document.documentElement.removeAttribute("data-scroll-down"); document.documentElement.removeAttribute("data-scroll-up");
    background = Array.from(document.querySelectorAll<HTMLElement>("[data-hud], .rf-main, .rf-footer-wrap, .skip-link")).filter(el => !el.inert);
    for (const el of background) el.inert = true;
    window.dispatchEvent(new Event("rustflow:modal-open"));
  }
  owners.add(panel);
  // A nested login/confirmation must own Tab, the accessibility tree and
  // pointer events even while the parent remains mounted to receive focus.
  for(const owner of owners) owner.inert=owner!==panel;
  return () => {
    owners.delete(panel);panel.inert=false;
    const last=Array.from(owners).at(-1);if(last)last.inert=false;
    if (!owners.size) {
      delete document.body.dataset.popupDepth;
      for (const el of background) el.inert = false;
      background = [];
    }
  };
}
