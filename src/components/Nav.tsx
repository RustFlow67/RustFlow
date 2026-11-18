"use client";

import { Flame } from "lucide-react";
import DockIcon, { type DockGlyph } from "@/components/DockIcon";
import Link from "@/components/RouteLink";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import PlayerProfile from "@/components/PlayerProfile";
import ThemeToggle from "@/components/ThemeToggle";
import AiAssistant from "@/components/AiAssistant";
import { OPEN_ASSISTANT } from "@/lib/assistant/open";

const DOCK_ITEMS: { href: string; label: string; glyph: DockGlyph }[] = [
  { href: "/", label: "Главная", glyph: "home" },
  { href: "/guide", label: "База знаний", glyph: "book" },
  { href: "/benchmark", label: "Сборка", glyph: "gauge" },
  { href: "/presets", label: "Пресеты", glyph: "gear" },
  { href: "/tweaker", label: "Твикер", glyph: "sliders" },
  { href: "/faq", label: "Мифы и EAC", glyph: "shield" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function DockTabs({ pathname, chatOpen, chatTrigger, toggleChat }: {
  pathname: string; chatOpen: boolean; chatTrigger: React.RefObject<HTMLButtonElement | null>; toggleChat: (opener: HTMLButtonElement) => void;
}) {
  const list = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const targetIndex = useRef(-1);
  const [hovered, setHovered] = useState<number | null>(null);
  const active = DOCK_ITEMS.findIndex(({ href }) => isActive(pathname, href));
  const target = hovered ?? (chatOpen ? DOCK_ITEMS.length : active);

  const alignLens = useCallback(() => {
    const pill = lens.current;
    const container = list.current;
    if (!pill || !container) return;
    const item = container.querySelectorAll<HTMLElement>("[data-tab]")[targetIndex.current];
    if (!item || item.offsetParent !== container) {
      pill.removeAttribute("data-positioned");
      return;
    }
    // Layout coordinates are in exactly the same space as the absolute lens.
    // In particular, the pressed tab's scale must not affect its size or position.
    pill.style.transform = `translate3d(${item.offsetLeft}px, ${item.offsetTop}px, 0)`;
    pill.style.width = `${item.offsetWidth}px`;
    pill.style.height = `${item.offsetHeight}px`;
    pill.setAttribute("data-positioned", "");
  }, []);

  useLayoutEffect(() => {
    targetIndex.current = target;
    alignLens();
  }, [target, alignLens]);

  useEffect(() => {
    const container = list.current;
    if (!container) return;
    // The row can have a fixed width while its children change (fonts/viewport).
    const observer = new ResizeObserver(alignLens);
    observer.observe(container);
    container.querySelectorAll("[data-tab]").forEach((tab) => observer.observe(tab));
    return () => observer.disconnect();
  }, [alignLens]);

  return (
    <div ref={list} className="dock-items" onPointerLeave={() => setHovered(null)} onPointerCancel={() => setHovered(null)}>
      <span ref={lens} className="dock-lens" aria-hidden="true" />
      {DOCK_ITEMS.map(({ href, label, glyph }, index) => (
        <Link
          key={href}
          href={href}
          data-tab
          aria-current={index === active ? "page" : undefined}
          className="nav-item"
          prefetch
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse" || event.pointerType === "pen") setHovered(index);
          }}
          onFocus={() => setHovered(index)} onBlur={() => setHovered(null)}
        >
          <DockIcon glyph={glyph} />
          <span>{label}</span>
        </Link>
      ))}
      <button type="button" ref={chatTrigger} className="nav-item" data-tab data-assistant-trigger="" aria-haspopup="dialog"
        aria-expanded={chatOpen} aria-controls={chatOpen ? "rustflow-assistant-dialog" : undefined}
        onPointerEnter={(event) => { if (event.pointerType !== "touch") setHovered(DOCK_ITEMS.length); }}
        onFocus={() => setHovered(DOCK_ITEMS.length)} onBlur={() => setHovered(null)} onClick={(event) => toggleChat(event.currentTarget)}>
        <DockIcon glyph="chat" /> <span>ИИ-ассистент</span>
      </button>
    </div>
  );
}

export default function Nav() {
  const pathname = usePathname();
  const [chatOpen, setChatOpen] = useState(false);
  const chatTrigger = useRef<HTMLButtonElement>(null);
  const chatOpener = useRef<HTMLElement | null>(null);
  const showChat = useCallback((opener?: HTMLElement) => {
    chatOpener.current = opener ?? chatTrigger.current;
    setChatOpen(true);
  }, []);
  const closeChat = useCallback((refocus = true) => {
    setChatOpen(false);
    if (refocus) {
      const opener = chatOpener.current?.isConnected ? chatOpener.current : chatTrigger.current;
      opener?.focus({ preventScroll: true });
    }
  }, []);
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
      <div className="nav-capsules">
        <div className="nav-identity">
          <Link
            href="/"
            aria-label="RustFlow — на главную"
            className="glass nav-pill nav-brand"
            scrollHome
          >
            <span
              className="icon-tile nav-brand-mark"
              style={{ "--c1": "#ffb15c", "--c2": "#ff4d2e" } as CSSProperties}
            >
              <Flame aria-hidden="true" />
            </span>
            <span className="nav-brand-name">
              Rust<span className="text-accent-hi">Flow</span>
            </span>
          </Link>

          <ThemeToggle compact />
        </div>
        <PlayerProfile />
      </div>

      <nav className="glass liquid-optics nav-pill tabbar-bottom" aria-label="Основная навигация">
        <DockTabs pathname={pathname} chatOpen={chatOpen} chatTrigger={chatTrigger} toggleChat={(opener) => chatOpen ? closeChat() : showChat(opener)} />
      </nav>

      <AiAssistant open={chatOpen} onClose={closeChat} opener={chatOpener} />
    </>
  );
}
