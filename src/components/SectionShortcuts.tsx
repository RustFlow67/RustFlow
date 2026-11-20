"use client";

import LiquidGlass from "@/components/LiquidGlass";
import { useSyncExternalStore } from "react";
import { useLiquidLens } from "./fx/useLiquidLens";

const subscribe = (fn: () => void) => {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
};
const hash = () => location.hash;
const server = () => "";

/** Real fragment links (including back/forward), with the same hover preview as tabs. */
export default function SectionShortcuts({ sections, label }: { sections: readonly [string, string][]; label: string }) {
  const active = useSyncExternalStore(subscribe, hash, server);
  const index = Math.max(0, sections.findIndex(([href]) => active === href));
  const { list, lens } = useLiquidLens<HTMLElement>(index, sections.length, { continuous: true });
  return <LiquidGlass as="nav" ref={list} aria-label={label} className="segmented mt-5">
    <LiquidGlass as="span" shape="pill" ref={lens} className="liquid-lens" aria-hidden="true" />
    {sections.map(([href, name], i) => <a key={href} href={href} data-liquid-item="" aria-current={i === index ? "location" : undefined} className="segmented-item">{name}</a>)}
  </LiquidGlass>;
}
