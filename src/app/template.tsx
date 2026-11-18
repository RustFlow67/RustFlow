import type { ReactNode } from "react";

// Next remounts the template on segment changes. Fixed chrome and portals stay outside it.
export default function PageTemplate({ children }: { children: ReactNode }) {
  return <div className="rf-page-enter">{children}</div>;
}
