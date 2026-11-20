"use client";

import Segmented from "@/components/Segmented";
import { GRAPHICS_PROFILES, type GraphicsProfileId } from "@/lib/graphics-profiles";

export default function GraphicsPicker({ value, onChange, label, presentation = "compact" }: {
  value: GraphicsProfileId | null;
  onChange: (value: GraphicsProfileId) => void;
  label: string;
  presentation?: "compact" | "cards";
}) {
  return <div className="graphics-picker-wrap"><Segmented value={value} onChange={onChange} presentation="grid" ariaLabel={label}
    className={`graphics-picker ${presentation === "cards" ? "graphics-picker-cards" : ""}`} options={GRAPHICS_PROFILES.map((p) => ({
      value: p.id, title: p.hint, label: <>
        <span className="graphics-picker-name font-bold">{p.short}</span>
        {presentation === "cards" && <>
          <span className="mt-1 block text-xs leading-relaxed text-ink-2">{p.hint}</span>
          <span className="mt-2 block font-sans text-[11px] text-accent-hi">Draw {p.draw} · Shader {p.shader} · Water {p.water}</span>
        </>}
      </>,
    }))} /></div>;
}
