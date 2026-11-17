"use client";

import {
  Activity,
  Code2,
  Cpu,
  FileJson,
  Flame,
  Gauge,
  Home,
  ListChecks,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import DataBackupModal from "@/components/DataBackupModal";
import ThemeToggle from "@/components/ThemeToggle";

export const OPEN_BACKUP_EVENT = "rustflow:open-backup";

export function triggerBackupModal() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_BACKUP_EVENT));
  }
}

const TOP_ITEMS = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/benchmark", label: "Сборка /10", icon: Gauge },
  { href: "/tweaks", label: "Твики", icon: SlidersHorizontal },
  { href: "/presets", label: "Пресеты", icon: Cpu },
  { href: "/journal", label: "Журнал", icon: Activity },
  { href: "/setup", label: "Сетап", icon: ListChecks },
  { href: "/faq", label: "Мифы и EAC", icon: ShieldAlert },
];

const BOTTOM_ITEMS = [
  { href: "/", label: "Главная", icon: Home },
  { href: "/benchmark", label: "Сборка", icon: Gauge },
  { href: "/tweaks", label: "Твики", icon: SlidersHorizontal },
  { href: "/presets", label: "Пресеты", icon: Cpu },
  { href: "/journal", label: "Журнал", icon: Activity },
  { href: "/faq", label: "Мифы", icon: ShieldAlert },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function TabBar({
  items,
}: {
  items: { href: string; label: string; icon: typeof Home }[];
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [lens, setLens] = useState<{ x: number; w: number } | null>(null);
  const active = items.findIndex((item) => isActive(pathname, item.href));
  const target = hover ?? active;

  useEffect(() => {
    const el = ref.current;
    if (!el || target < 0) {
      setLens(null);
      return;
    }
    const measure = () => {
      const node = el.querySelectorAll<HTMLElement>("[data-tab]")[target];
      setLens(node ? { x: node.offsetLeft, w: node.offsetWidth } : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [target, items.length]);

  return (
    <div ref={ref} className="relative flex items-center" onPointerLeave={() => setHover(null)}>
      <span
        className="lens"
        aria-hidden="true"
        style={
          lens
            ? { transform: `translate3d(${lens.x}px,0,0)`, width: lens.w, opacity: 1 }
            : { opacity: 0 }
        }
      />
      {items.map((item, i) => {
        const Icon = item.icon;
        const current = i === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            data-tab
            aria-current={current ? "page" : undefined}
            className="nav-item"
            onPointerEnter={(e) => {
              if (e.pointerType === "mouse") setHover(i);
            }}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
          >
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

export default function Nav() {
  const [backupOpen, setBackupOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setBackupOpen(true);
    window.addEventListener(OPEN_BACKUP_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_BACKUP_EVENT, onOpen);
  }, []);

  return (
    <>
      <div className="scroll-edge scroll-edge-top" aria-hidden="true" />
      <div className="scroll-edge scroll-edge-bottom lg:hidden" aria-hidden="true" />

      <header className="nav-shell">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 sm:px-6">
          <Link
            href="/"
            aria-label="RustFlow — на главную"
            className="glass nav-pill group flex h-11 flex-none items-center gap-2 pl-1.5 pr-3.5 hover:scale-[1.02] active:scale-95"
          >
            <span
              className="icon-tile icon-tile-sm !h-8 !w-8 !rounded-full"
              style={{ "--c1": "#ffb15c", "--c2": "#ff4d2e" } as CSSProperties}
            >
              <Flame aria-hidden="true" />
            </span>
            <span className="text-[15px] font-extrabold tracking-tight">
              Rust<span className="text-accent-hi">Flow</span>
            </span>
          </Link>

          {/* Единственная blur-поверхность навигации на десктопе */}
          <nav className="glass glass-blur nav-pill hidden p-1 lg:block" aria-label="Основная навигация">
            <TabBar items={TOP_ITEMS} />
          </nav>

          <div className="flex flex-none items-center gap-1.5">
                                      <button
              type="button"
              onClick={() => setBackupOpen(true)}
              className="btn btn-sm !h-10 !px-2.5 sm:!px-3"
              aria-label="Экспорт и импорт профиля JSON"
              title="Экспорт и импорт JSON (сборка, твики, журнал)"
            >
              <FileJson className="text-accent-hi" aria-hidden="true" />
              <span className="hidden 2xl:inline">Бэкап</span>
            </button>
            <ThemeToggle compact />
          </div>
        </div>
      </header>

      {/* Единственная blur-поверхность навигации на мобильных */}
      <nav className="glass glass-blur nav-pill tabbar-bottom lg:hidden" aria-label="Мобильная навигация">
        <TabBar items={BOTTOM_ITEMS} />
      </nav>

      <DataBackupModal open={backupOpen} onClose={() => setBackupOpen(false)} />
    </>
  );
}
