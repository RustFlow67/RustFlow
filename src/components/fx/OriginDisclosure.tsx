"use client";
import { useState, type ReactNode } from "react";
import AccordionBody from "../ui/AccordionBody";

/** Lazy first mount (large hardware lists); preserve the body during collapse.
 * Both pointer and keyboard are blocked as soon as a disclosure closes. */
export default function OriginDisclosure({
  open,
  children,
  className,
}: {
  open: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [visited, visit] = useState(open);
  if (open && !visited) visit(true);
  return (
    <div className={className}>
      <AccordionBody open={open}>{(visited || open) && children}</AccordionBody>
    </div>
  );
}
