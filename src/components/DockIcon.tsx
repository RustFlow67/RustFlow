import { MessageCircle, Settings, ShieldAlert } from "lucide-react";

export type DockGlyph = "home" | "book" | "gauge" | "gear" | "sliders" | "shield" | "chat";

/** Move the page, needle, or knob itself instead of rotating the whole glyph. */
export default function DockIcon({ glyph }: { glyph: DockGlyph }) {
  const attrs = { "data-dock-glyph": glyph, "aria-hidden": true } as const;
  if (glyph === "gear") return <Settings {...attrs} />;
  if (glyph === "shield") return <ShieldAlert {...attrs} />;
  if (glyph === "chat") return <MessageCircle {...attrs}>
    {[8, 12, 16].map((x) => <circle key={x} data-part="dot" cx={x} cy="12" r="1.15" fill="currentColor" stroke="none" />)}
  </MessageCircle>;
  return <svg {...attrs} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {glyph === "home" ? <>
      <path data-part="roof" d="m2.5 10.5 8.2-7.1a2 2 0 0 1 2.6 0l8.2 7.1" />
      <path d="M4.5 10v9.5a1.5 1.5 0 0 0 1.5 1.5h4v-7h4v7h4a1.5 1.5 0 0 0 1.5-1.5V10" />
    </> : glyph === "book" ? <>
      <path data-part="left" d="M11.95 6.3C9.5 4.1 6 4 3.2 5.15v13.6c3-.91 6.5-.74 8.75 1.26Z" />
      <path data-part="right" d="M12.05 6.3c2.45-2.2 5.95-2.3 8.75-1.15v13.6c-3-.91-6.5-.74-8.75 1.26Z" />
    </> : glyph === "gauge" ? <>
      <path d="M4.6 18.6A9 9 0 1 1 19.4 18.6ZM6 13h.85M8.8 7.5l.5.8M15.2 7.5l-.5.8M17.15 13H18" />
      <path data-part="needle" d="M12 15.2 14.7 10.6" />
      <circle cx="12" cy="15.2" r=".95" fill="currentColor" stroke="none" />
    </> : <>
      <path d="M3 6h18M3 12h18M3 18h18" />
      <circle data-part="knob-a" cx="8" cy="6" r="2.15" fill="currentColor" stroke="none" />
      <circle data-part="knob-b" cx="16" cy="12" r="2.15" fill="currentColor" stroke="none" />
      <circle data-part="knob-c" cx="10" cy="18" r="2.15" fill="currentColor" stroke="none" />
    </>}
  </svg>;
}
