import type { ReactNode } from "react";

/** Intrinsic-height transition in both directions. The closed answer is never
 * exposed to tab navigation, even while it is visually collapsing. */
export default function AccordionBody({ open, id, children }: { open: boolean; id?: string; children: ReactNode }) {
  return <div id={id} className="accordion-body" data-expanded={open || undefined} inert={!open} aria-hidden={!open || undefined}>
    <div>{children}</div></div>;
}
