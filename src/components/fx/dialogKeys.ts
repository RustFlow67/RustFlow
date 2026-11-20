const selector = ':is(a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),summary,[tabindex]):not([tabindex="-1"])';
export function dialogControls(panel: HTMLElement) {
  return Array.from(panel.querySelectorAll<HTMLElement>(selector)).filter(node => {
    const closed = node.closest("details:not([open])");
    return !node.closest("[inert]") && node.getClientRects().length && (!closed || (node.tagName === "SUMMARY" && node.parentElement === closed));
  });
}
/** Both regular sheets and the assistant belong to the same modal stack. */
export function guardKeys(panel: HTMLElement, dismiss: () => void) {
  const keydown = (e: KeyboardEvent) => {
    if (e.defaultPrevented || e.isComposing || Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).at(-1) !== panel) return;
    if (e.key === "Escape") { e.preventDefault(); dismiss(); }
    else if (e.key === "Tab") {
      const controls = dialogControls(panel), first = controls[0], last = controls.at(-1);
      if (!first || !last) return;
      const outside = !panel.contains(document.activeElement);
      if (e.shiftKey && (outside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (outside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", keydown);
  return () => document.removeEventListener("keydown", keydown);
}
