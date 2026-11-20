"use client";

import LiquidGlass from "@/components/LiquidGlass";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Flame,
  House,
  Info,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { useLiquidLens } from "./fx/useLiquidLens";
import { usePopupState } from "./fx/usePopupMotion";
import { captureSource, type PopupSource } from "./fx/popupGeometry";
import { quietMotion } from "./fx/velocity";
import AccordionBody from "./ui/AccordionBody";
import { Modal } from "./ui/Modal";

const FAQ = [
  [
    "Как RustFlow относится к EAC?",
    "Мы предлагаем штатные настройки Rust, Windows и драйвера. Не изменяем память игры и не обходим античит. Читайте описание и риск каждого шага; решение о правилах принимает разработчик игры.",
  ],
  [
    "Как откатить изменения?",
    "До изменений сохраните копию client.cfg и создайте точку восстановления. В ZIP есть папка Otkat с инструкциями для выбранных шагов. Возвращайте изменения по одному.",
  ],
  [
    "Есть ли в архиве .exe?",
    "Нет. В архиве — конфигурация, читаемые скрипты и инструкции. Сайт ничего не запускает на вашем ПК автоматически.",
  ],
  [
    "Калькулятор показывает реальный FPS?",
    "Нет, это оценка диапазона FPS и 1% low по вашей сборке, сценарию, разрешению и фоновым задачам. Для проверки сравните два замера в одной сцене Rust.",
  ],
  [
    "Зачем нужен gc.buffer?",
    "Rust периодически освобождает память. gc.buffer задаёт запас между такими очистками: от него зависят паузы и расход ОЗУ. «Авто по RAM» учитывает объём памяти после вычета фоновой нагрузки. Можно выбрать 2048 или 4096 МБ; больший буфер не всегда лучше. Проверяйте паузы и расход ОЗУ.",
  ],
] as const;

function MenuFaq() {
  const [active, setActive] = useState<number | null>(null),
    prefix = useId();
  return (
    <div className="brand-faq">
      {FAQ.map(([question, answer], i) => (
        <section key={question}>
          <h3>
            <button
              type="button"
              aria-expanded={i === active}
              aria-controls={`${prefix}-${i}`}
              onClick={() => setActive(i === active ? null : i)}
            >
              {question}
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          </h3>
          <AccordionBody open={active === i} id={`${prefix}-${i}`}>
            <p>{answer}</p>
          </AccordionBody>
        </section>
      ))}
    </div>
  );
}

type InfoPage = "faq" | "about";
// Links stay native (including modifier-clicks); local pages are dialogs, not fake links.
const items = [
  { href: "/", title: "Вернуться на главную", hint: "Стартовый экран RustFlow", Icon: House },
  { href: "/guide", title: "С чего начать", hint: "Пять шагов от копии до замера", Icon: BookOpen },
  { href: "/faq", title: "Мифы и EAC", hint: "Что безопасно менять в Rust", Icon: ShieldCheck },
  { action: "faq", title: "FAQ", hint: "Безопасность, замеры и откат", Icon: CircleHelp },
  { action: "about", title: "О нас", hint: "Что делает RustFlow", Icon: Info },
] as const;
type Destination = "/" | "/guide" | "/faq" | InfoPage;

function MenuLinks({
  choose,
  dismissNative,
  first,
}: {
  choose: (href: Destination, from: HTMLElement) => void;
  dismissNative: () => void;
  first: RefObject<HTMLAnchorElement | null>;
}) {
  const path = usePathname();
  const selected = items.findIndex((item) => "href" in item && item.href === path);
  const { list, lens } = useLiquidLens<HTMLElement>(Math.max(0, selected), items.length, {
    continuous: true,
  });
  function arrows(e: KeyboardEvent<HTMLElement>) {
    const links = Array.from(e.currentTarget.querySelectorAll<HTMLElement>("[data-liquid-item]"));
    const at = links.indexOf(document.activeElement as HTMLElement);
    let next: number;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        next = (at + 1) % links.length;
        break;
      case "ArrowUp":
      case "ArrowLeft":
        next = (at + links.length - 1) % links.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = links.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    links[next]?.focus();
  }
  return (
    <nav aria-label="Разделы RustFlow" className="brand-list" ref={list} onKeyDown={arrows}>
      <LiquidGlass as="span" shape="pill" className="lens liquid-lens" aria-hidden="true" ref={lens} />
      {items.map((item, i) => {
        const { Icon, title, hint } = item;
        const row = (
          <>
            <span className="brand-row-icon">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span>
              <strong>{title}</strong>
              <small>{hint}</small>
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </>
        );
        return "href" in item ? (
          <Link
            key={item.href}
            href={item.href}
            ref={i === 0 ? first : undefined}
            className="brand-row"
            data-liquid-item=""
            aria-current={i === selected ? "page" : undefined}
            onClick={(event) => {
              // Modifier/middle clicks keep their native new-tab behavior;
              // just release the menu without a deferred same-tab push.
              if (
                event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
                event.button !== 0
              ) {
                dismissNative();
                return;
              }
              event.preventDefault();
              choose(item.href, event.currentTarget);
            }}
          >
            {row}
          </Link>
        ) : (
          <button
            key={item.action}
            type="button"
            className="brand-row"
            data-liquid-item=""
            aria-haspopup="dialog"
            onClick={(e) => choose(item.action, e.currentTarget)}
          >
            {row}
          </button>
        );
      })}
    </nav>
  );
}

export default function BrandMenu() {
  const menu = usePopupState<true>(),
    { dismiss } = menu;
  const sheet = usePopupState<InfoPage>(),
    dismissSheet = sheet.dismiss;
  const brand = useRef<HTMLButtonElement>(null);
  const pending = useRef<Destination | null>(null),
    pendingSource = useRef<PopupSource>(null),
    first = useRef<HTMLAnchorElement>(null);
  const path = usePathname(),
    previous = useRef(path),
    router = useRouter();
  // A history change or a second open request wins over deferred navigation.
  useEffect(() => {
    const cancel = () => {
      pending.current = null;
      pendingSource.current = null;
      dismiss();
      dismissSheet();
    };
    if (previous.current !== path) {
      previous.current = path;
      cancel();
    }
    window.addEventListener("popstate", cancel);
    const supersede = () => {
      pending.current = null;
      pendingSource.current = null;
    };
    window.addEventListener("rustflow:modal-open", supersede);
    return () => {
      window.removeEventListener("popstate", cancel);
      window.removeEventListener("rustflow:modal-open", supersede);
    };
  }, [path, dismiss, dismissSheet]);
  const open = (from: HTMLButtonElement) => {
    pending.current = null;
    pendingSource.current = null;
    menu.show(true, from);
  };
  const landed = () => {
    menu.finish();
    const href = pending.current;
    const row = pendingSource.current;
    pending.current = null;
    pendingSource.current = null;
    if (!href) return;
    // A selected row disappears with the menu. Start the requested page only
    // after landing, and return its focus to the persistent RustFlow control.
    if (href === "faq" || href === "about") {
      const home = menu.opener.current;
      // Open from the clicked row's captured geometry; land back on the
      // persistent brand control that receives focus.
      sheet.show(
        href,
        home,
        row && home ? { node: home, rect: row.rect, radius: row.radius } : (row ?? undefined),
      );
      return;
    }
    if (href === location.pathname && !location.search && !location.hash)
      window.scrollTo({ top: 0, behavior: quietMotion() ? "instant" : "smooth" });
    else router.push(href);
  };
  return (
    <div className="nav-identity">
      <LiquidGlass as="button" island shape="pill"
        type="button"
        ref={brand}
        className="glass nav-pill nav-brand"
        data-chrome-panel=""
        aria-label="Меню RustFlow"
        aria-haspopup="dialog"
        aria-expanded={menu.isOpen && !menu.closing}
        aria-controls={menu.isOpen ? "rustflow-menu" : undefined}
        onClick={(e) => open(e.currentTarget)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            open(e.currentTarget);
          }
        }}
      >
        <span className="icon-tile nav-brand-mark">
          <Flame aria-hidden="true" />
        </span>
        <span className="nav-brand-name">
          Rust<span className="text-accent-hi">Flow</span>
        </span>
        <ChevronDown className="brand-chevron" size={15} aria-hidden="true" />
      </LiquidGlass>
      <Modal
        id="rustflow-menu"
        open={menu.isOpen}
        closing={menu.closing}
        title="Меню RustFlow"
        variant="brand"
        anchor={brand}
        maxWidth="max-w-sm"
        source={menu.source}
        returnFocus={menu.opener}
        initialFocus={first}
        onClose={dismiss}
        onExited={landed}
      >
        <MenuLinks
          first={first}
          dismissNative={dismiss}
          choose={(href, from) => {
            pending.current = href;
            pendingSource.current = captureSource(from);
            dismiss();
          }}
        />
      </Modal>
      <Modal
        open={sheet.isOpen}
        closing={sheet.closing}
        onClose={sheet.dismiss}
        onExited={sheet.finish}
        source={sheet.source}
        returnFocus={sheet.opener}
        title={sheet.value === "faq" ? "FAQ (Частые вопросы)" : "О нас"}
        maxWidth="max-w-lg"
      >
        {sheet.value === "faq" ? (
          <MenuFaq />
        ) : (
          <div className="brand-about">
            <span className="eyebrow">RustFlow · О проекте</span>
            <h3>Сначала замер. Затем настройка.</h3>
            <p>
              RustFlow помогает подобрать настройки Rust под конкретный ПК. Калькулятор оценивает FPS и 1%
              low, каталог сравнивает сборки, а Твикер собирает выбранные команды и инструкции по откату.
            </p>
            <p>
              Сайт не запускает твики автоматически. Гостевая сборка остаётся в вашем браузере. RustFlow —
              независимый проект, не связанный с Facepunch или Easy Anti-Cheat.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
