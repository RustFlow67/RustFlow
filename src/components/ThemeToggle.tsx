"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/** Тумблер тёмной/светлой темы с morph-анимацией sun ↔ moon. */
export default function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      aria-pressed={!isDark}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      className={`theme-toggle btn btn-icon ${compact ? "glass nav-pill" : ""}`}
      data-theme-state={resolved}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <Sun className="theme-icon theme-icon-sun" />
        <Moon className="theme-icon theme-icon-moon" />
      </span>
    </button>
  );
}
