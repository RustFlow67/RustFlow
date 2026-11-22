"use client";

import { Minus, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";
import LiquidGlass from "@/components/LiquidGlass";
import { IS_DESKTOP_APP } from "@/lib/config";
import { initSystemBridge } from "@/services/systemBridge";

export default function DesktopTitlebar() {
  useEffect(() => {
    if (IS_DESKTOP_APP) {
      initSystemBridge();
    }
  }, []);

  if (!IS_DESKTOP_APP) return null;
  const run = (action: "minimize" | "toggleMaximize" | "close") => {
    void getCurrentWindow()[action]().catch(() => {});
  };
  return <div className="desktop-titlebar" data-tauri-drag-region>
    <div className="desktop-titlebar-drag" data-tauri-drag-region />
    <LiquidGlass className="desktop-window-controls" shape="pill">
      <button type="button" aria-label="Свернуть" onClick={() => run("minimize")}><Minus size={16}/></button>
      <button type="button" aria-label="Развернуть или восстановить" onClick={() => run("toggleMaximize")}><Square size={14}/></button>
      <button type="button" aria-label="Закрыть" onClick={() => run("close")}><X size={17}/></button>
    </LiquidGlass>
  </div>;
}
