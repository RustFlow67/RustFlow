import type { ReactNode } from "react";

/** Inserts only the open disclosure, with a small CSS entry transition. */
export default function OriginDisclosure({ open, children, className, fallback = null }: {
  open: boolean;
  children: ReactNode;
  className?: string;
  fallback?: ReactNode;
}) {
  if (!open) return fallback;
  return <div className={className}><div className="rf-popup-motion" data-open="">{children}</div></div>;
}
