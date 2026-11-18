"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLayoutEffect, type ComponentProps, type ReactNode } from "react";
import { getMotionReduced } from "@/lib/motion";

/** Handle deep links once the route has committed. Entry motion is CSS-only. */
export function RouteScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    const hash = window.location.hash.slice(1);
    if (hash) {
      try { document.getElementById(decodeURIComponent(hash))?.scrollIntoView({ block: "start", behavior: "instant" }); }
      catch { /* A malformed hash is not a route error. */ }
    }
  }, [pathname]);
  return children;
}

export function useRouteNavigation() {
  const router = useRouter();
  return (href: string) => router.push(href);
}

export default function RouteLink({ href, onNavigate, scrollHome, ...props }:
  ComponentProps<typeof Link> & { scrollHome?: boolean }) {
  const path = usePathname();
  return <Link {...props} href={href} onNavigate={(event) => {
    onNavigate?.(event);
    if (scrollHome && path === "/") {
      event.preventDefault();
      const instant = getMotionReduced() || document.documentElement.hasAttribute("data-lite");
      window.scrollTo({ top: 0, left: 0, behavior: instant ? "instant" : "smooth" });
    }
  }} />;
}
