"use client";
import LiquidGlass from "@/components/LiquidGlass";
import { Settings } from "lucide-react";
import { useRef, useState } from "react";
import { useAppearance } from "./GlassAppearance";
import { DOCK_POSITIONS } from "@/lib/dock-position";
import ThemeCollection from "./ThemeCollection";
import Segmented from "./Segmented";
import GlassStudio from "./GlassStudio";
import { Modal } from "./ui/Modal";
import { usePopupState } from "./fx/usePopupMotion";

export default function HeaderStudio() {
  const { dock, setDock } = useAppearance();
  const [tab, setTab] = useState<"theme" | "engine">("theme");
  const gear = useRef<HTMLButtonElement>(null),
    sheet = usePopupState<true>();
  return (
    <>
      <LiquidGlass as="button" island shape="round"
        ref={gear}
        type="button"
        className="glass nav-pill studio-trigger"
        data-chrome-panel=""
        aria-label="Настройки"
        title="Настройки"
        aria-haspopup="dialog"
        aria-expanded={sheet.isOpen && !sheet.closing}
        onClick={(e) => sheet.show(true, e.currentTarget)}
      >
        <Settings aria-hidden="true" />
      </LiquidGlass>
      <Modal
        open={sheet.isOpen}
        closing={sheet.closing}
        onClose={sheet.dismiss}
        onExited={sheet.finish}
        anchor={gear}
        source={sheet.source}
        returnFocus={sheet.opener}
        title="Настройки"
        variant="studio"
        maxWidth="max-w-[440px]"
      >
        <div className="settings-body">
          <section>
            <h3>Расположение Dock-бара</h3>
            <Segmented
              ariaLabel="Расположение Dock-бара"
              presentation="grid"
              className="settings-dock-options"
              options={DOCK_POSITIONS}
              value={dock}
              onChange={setDock}
            />
          </section>
          <Segmented
            ariaLabel="Оформление"
            options={[
              { value: "theme", label: "Темы оформления" },
              { value: "engine", label: "Стекло и обои" },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "theme" ? <ThemeCollection /> : <GlassStudio />}
        </div>
      </Modal>
    </>
  );
}
