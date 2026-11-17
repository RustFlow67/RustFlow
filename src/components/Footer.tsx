"use client";

import { FileJson, Flame, Moon, ShieldCheck, Sparkles, Sun, SunMoon } from "lucide-react";
import Link from "next/link";
import { useSyncExternalStore, type CSSProperties } from "react";
import { triggerBackupModal } from "@/components/Nav";
import Segmented from "@/components/Segmented";
import { applyMotionChoice, useMotion, type MotionChoice } from "@/lib/motion";
import { useTheme, type ThemeChoice } from "@/lib/theme";

const LITE_KEY = "rustflow:lite";
const LITE_EVENT = "rustflow:lite-change";
const subscribeLite = (cb: () => void) => {
  window.addEventListener(LITE_EVENT, cb);
  return () => window.removeEventListener(LITE_EVENT, cb);
};
const getLiteSnapshot = () => document.documentElement.hasAttribute("data-lite");
const getLiteServer = () => false;

const LINKS = [
  { href: "/benchmark", label: "Профиль сборки /10" },
  { href: "/tweaks", label: "Библиотека твиков" },
  { href: "/presets", label: "Пресеты железа" },
  { href: "/journal", label: "Журнал замеров" },
  { href: "/setup", label: "Полная настройка" },
  { href: "/faq", label: "Мифы и безопасность" },
  { href: "/guide", label: "Руководство" },
];

const THEME_OPTS: { value: ThemeChoice; label: React.ReactNode }[] = [
  { value: "system", label: <span className="flex items-center gap-1.5"><SunMoon className="h-3.5 w-3.5" aria-hidden="true" />Авто</span> },
  { value: "dark", label: <span className="flex items-center gap-1.5"><Moon className="h-3.5 w-3.5" aria-hidden="true" />Тёмная</span> },
  { value: "light", label: <span className="flex items-center gap-1.5"><Sun className="h-3.5 w-3.5" aria-hidden="true" />Светлая</span> },
];

const MOTION_OPTS: { value: MotionChoice; label: string }[] = [
  { value: "auto", label: "Авто" },
  { value: "full", label: "Полный motion" },
  { value: "reduced", label: "Уменьшить движение" },
];

export default function Footer() {
  const lite = useSyncExternalStore(subscribeLite, getLiteSnapshot, getLiteServer);
  const { choice: themeChoice, setChoice: setThemeChoice } = useTheme();
  const { choice: motionChoice } = useMotion();

  function toggleLite() {
    const root = document.documentElement;
    const next = !lite;
    if (next) root.setAttribute("data-lite", "");
    else root.removeAttribute("data-lite");
    try {
      window.localStorage.setItem(LITE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(LITE_EVENT));
  }

  return (
    <footer className="relative z-[2] mx-auto mb-28 mt-12 w-full max-w-6xl px-4 sm:px-6 lg:mb-10">
      <div className="glass p-6 sm:p-8" data-reveal>
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-md">
            <div className="flex items-center gap-3">
              <span
                className="icon-tile icon-tile-sm"
                style={{ "--c1": "#ffb15c", "--c2": "#ff4d2e" } as CSSProperties}
              >
                <Flame aria-hidden="true" />
              </span>
              <span className="text-lg font-extrabold tracking-tight">
                Rust<span className="text-accent-hi">Flow</span>
              </span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink-2">
              Инженерный твикер для Rust: прозрачная оценка сборки /10, проверенная библиотека твиков и разбор мифов,
              референсные пресеты железа и журнал честных замеров до/после. Все ваши данные хранятся локально в браузере.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn btn-sm" data-magnetic onClick={triggerBackupModal}>
                <FileJson className="text-accent-hi" aria-hidden="true" />
                Экспорт / импорт JSON
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                aria-pressed={lite}
                onClick={toggleLite}
                title="Отключает backdrop-blur и фоновые эффекты для слабых ПК"
              >
                <Sparkles className={lite ? "text-ink-3" : "text-accent-hi"} aria-hidden="true" />
                {lite ? "Режим без blur: вкл" : "Эконом-режим (без blur)"}
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1 lg:max-w-sm">
            <nav aria-label="Разделы сайта в подвале" className="grid grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-ink-2 transition-transform duration-200 hover:translate-x-0.5 hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="well mt-5 space-y-3.5 p-4" aria-label="Настройки оформления">
              <div>
                <span id="ft-theme-label" className="mb-1.5 block text-[12px] font-semibold text-ink-2">
                  Тема оформления
                </span>
                <Segmented
                  options={THEME_OPTS}
                  value={themeChoice}
                  onChange={setThemeChoice}
                  ariaLabel="Тема оформления"
                  className="w-full"
                />
              </div>
              <div>
                <span id="ft-motion-label" className="mb-1.5 block text-[12px] font-semibold text-ink-2">
                  Анимации и эффекты
                </span>
                <Segmented
                  options={MOTION_OPTS}
                  value={motionChoice}
                  onChange={(v) => applyMotionChoice(v)}
                  ariaLabel="Режим анимаций"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="hairline my-6" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] leading-relaxed text-ink-3">
            RustFlow — независимый проект и не связан с Facepunch Studios Ltd. и Easy Anti-Cheat. Все изменения вы
            применяете на свой страх и риск — начинайте с точки восстановления Windows.
          </p>
          <div className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[12px] font-semibold text-ink-2">
            <ShieldCheck className="h-4 w-4 text-accent-hi" aria-hidden="true" />
            <span>© {new Date().getFullYear()} RustFlow. Все права защищены.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
