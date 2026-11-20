"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { useAppearance } from "./GlassAppearance";
import HeaderStudio from "./HeaderStudio";
import BrandMenu from "./BrandMenu";
import DockIcon, { type DockGlyph } from "@/components/DockIcon";
import Link, { useDockIntent } from "@/components/RouteLink";
import type { DockPath } from "@/components/DockIntro";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import PlayerProfile from "@/components/PlayerProfile";
import { Sparkles } from "lucide-react";
import { useLiquidLens } from "@/components/fx/useLiquidLens";
import { usePopupState } from "@/components/fx/usePopupMotion";
import AiAssistant from "@/components/AiAssistant";
import { OPEN_ASSISTANT } from "@/lib/assistant/open";

const DOCK_ITEMS: { href: DockPath; label: string; glyph: DockGlyph }[] = [
  { href: "/", label: "Главная", glyph: "home" },
  { href: "/benchmark", label: "Сборка", glyph: "gauge" },
  { href: "/presets", label: "Пресеты", glyph: "gear" },
  { href: "/tweaker", label: "Твикер", glyph: "sliders" },
  { href: "/drivers", label: "Драйверы", glyph: "chip" },
];

function isActive(pathname: string, href: string) {
  if(href==="/tweaker" && pathname.startsWith("/files/")) return true;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function DockTabs({ pathname }: { pathname: string }) {
  const { intent, go } = useDockIntent();
  const active = DOCK_ITEMS.findIndex(({ href }) => isActive(intent ?? pathname, href));
  const { list, lens } = useLiquidLens(active, DOCK_ITEMS.length, { dock: true });
  const router = useRouter();
  useEffect(() => {
    // Start warming after hydration; the visible links request full prefetch even on dynamic routes.
    function warm() {
      if (document.hidden) return;
      for (const { href } of DOCK_ITEMS) if (href !== location.pathname) router.prefetch(href);
      // Also evaluate the three large interactive bundles off the first-click path.
      // Importing a module does not mount its controls, dialogs or subscriptions.
      if (location.pathname === "/" && !document.documentElement.hasAttribute("data-lite")) {
        void Promise.allSettled([import("@/components/BenchmarkTool"), import("@/components/PresetsExplorer"), import("@/components/Tweaker")]);
      }
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 700 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(warm, 0);
    return () => window.clearTimeout(id);
  }, [router]);

  return (
    <div ref={list} className="dock-items">
      <LiquidGlass as="span" shape="pill" ref={lens} className="dock-lens liquid-lens" aria-hidden="true" />
      {DOCK_ITEMS.map(({ href, label, glyph }, index) => (
        <Link
          key={href}
          href={href} aria-label={label} data-tooltip={label}
          data-tab data-liquid-item=""
          aria-current={index === active ? "page" : undefined}
          className="nav-item"
          prefetch={true}
          onNavigate={event => { event.preventDefault(); go(href); }}
        >
          <span className="dock-tab-face"><span className="dock-glyph-wrap"><DockIcon glyph={glyph} /></span><span className="dock-label">{label}</span></span>
        </Link>
      ))}
    </div>
  );
}

export default function Nav() {
  const {dock}=useAppearance();
  const pathname = usePathname();
  const { isOpen, closing, opener: chatOpener, source, show, dismiss, finish } = usePopupState<true>();
  const chatOpen = isOpen && !closing;
  const chatTrigger = useRef<HTMLButtonElement>(null);
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current !== pathname) { previousPath.current = pathname; dismiss(); }
  }, [pathname, dismiss]);
  const showChat = useCallback((opener?: HTMLElement) => {
    show(true, opener ?? chatTrigger.current);
  }, [show]);
  const returnToChat = useRef(false);
  const closeChat = useCallback((refocus = true) => { returnToChat.current = refocus; dismiss(); }, [dismiss]);
  useLayoutEffect(() => {
    if (closing && returnToChat.current) {
      const source = chatOpener.current?.isConnected ? chatOpener.current : chatTrigger.current;
      source?.focus({ preventScroll: true });
    }
  }, [closing, chatOpener]);
  useEffect(() => {
    const launchChat = (event: Event) => {
      const opener = (event as CustomEvent<HTMLElement>).detail;
      showChat(opener instanceof HTMLElement && opener.isConnected ? opener : undefined);
    };
    window.addEventListener(OPEN_ASSISTANT, launchChat);
    return () => window.removeEventListener(OPEN_ASSISTANT, launchChat);
  }, [showChat]);

  return (
    <>
      <div className="chrome-veil chrome-veil-top" aria-hidden="true" />
      <div className="chrome-veil chrome-veil-bottom" aria-hidden="true" />
      <div data-hud="top" className="nav-capsules">
        <div className="hud-brand-tools">
          <BrandMenu /><HeaderStudio />
          <LiquidGlass as="button" island shape="round" type="button" ref={chatTrigger} className="glass nav-pill assistant-trigger" data-assistant-trigger="" data-chrome-panel=""
            aria-label="ИИ-ассистент" title="ИИ-ассистент" aria-haspopup="dialog" aria-expanded={chatOpen}
            aria-controls={chatOpen ? "rustflow-assistant-dialog" : undefined} onClick={e => showChat(e.currentTarget)}>
            <Sparkles aria-hidden="true" />
          </LiquidGlass>
        </div>
        <PlayerProfile />
      </div>

      <LiquidGlass as="nav" shape="rail" data-hud={dock} data-chrome-panel="" className="glass liquid-optics nav-pill tabbar-bottom" aria-label="Основная навигация">

        <DockTabs pathname={pathname} />
      </LiquidGlass>

      <AiAssistant anchor={chatTrigger} source={source} isOpen={isOpen} closing={closing} onExited={finish} onClose={closeChat} />
    </>
  );
}
