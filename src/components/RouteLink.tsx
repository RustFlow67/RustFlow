"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, startTransition, useCallback, useContext, useLayoutEffect, useOptimistic, useRef, type ComponentProps, type ReactNode } from "react";
import { DockIntro, type DockPath } from "@/components/DockIntro";
import { depart } from "./fx/routeDeparture";
import { pulsePanels, useChromeMotion } from "@/components/fx/chromeMotion";
import { getMotionReduced } from "@/lib/motion";

const DockIntent = createContext<{ intent: DockPath | null; go: (href: DockPath) => void } | null>(null);
export function useDockIntent() { return useContext(DockIntent)!; }

/** Reset scroll once per destination; preserve direct links to a section. */
export function RouteScroll({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [intent, select] = useOptimistic<DockPath | null>(null);
  const revision = useRef(0);
  const cancelExit = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    const abort = () => { revision.current++; cancelExit.current?.(); cancelExit.current = null; };
    window.addEventListener("popstate", abort); window.addEventListener("rustflow:modal-open", abort);
    return () => { abort(); window.removeEventListener("popstate", abort); window.removeEventListener("rustflow:modal-open", abort); };
  }, []);
  const destination = intent ?? pathname;
  const pulsed = useRef<string | null>(null), last = useRef(destination);
  useChromeMotion();
  useLayoutEffect(() => {
    if (last.current === destination) return;
    last.current = destination; cancelExit.current?.(); cancelExit.current = null;
    if (pulsed.current !== destination) pulsePanels();
    pulsed.current = null;
  }, [destination]);
  const go = useCallback((href: DockPath) => {
    const ticket = ++revision.current;
    cancelExit.current?.(); cancelExit.current = null;
    queueMicrotask(() => {
      if (ticket !== revision.current) return;
      const commit = () => { if (ticket === revision.current) startTransition(() => { select(href); router.push(href); }); };
      pulsed.current = href === destination ? null : href; pulsePanels();
      if (href === destination && href === pathname) {
        window.scrollTo({top:0,left:0,behavior:getMotionReduced() || document.documentElement.hasAttribute("data-lite") ? "instant" : "smooth"});
      } else if(href===destination) commit();
      else cancelExit.current = depart(commit);
    });
  }, [router, select, destination, pathname]);
  useLayoutEffect(() => {
    // Reset once, when the destination first appears. Don't force a second
    // layout of the incoming tool, or scroll to a hash left by the old page.
    const hash = location.pathname === destination ? location.hash.slice(1) : "";
    if (hash) {
      try {
        const target = document.getElementById(decodeURIComponent(hash));
        if (target) {
          // On a long catalogue a .95 entrance scale can displace a deep
          // article by several viewports. Land in its final coordinate system.
          target.closest(".rf-page-enter")?.setAttribute("data-anchor-entry", "");
          target.scrollIntoView({ block: "start", behavior: "instant" });
          return;
        }
      } catch { /* A malformed hash is not a route error. */ }
    }
    if (window.scrollY || window.scrollX) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [destination]);
  return <DockIntent.Provider value={{ intent, go }}>{children}</DockIntent.Provider>;
}

/** Key the inner surface once per destination, not again when its tools arrive. */
export function RouteSurface({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { intent } = useDockIntent();
  const pending = intent !== null && intent !== path;
  return <div key={intent ?? path} className="rf-page-enter" aria-busy={pending || undefined}>
    {pending ? <DockIntro href={intent} pending /> : children}
  </div>;
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
