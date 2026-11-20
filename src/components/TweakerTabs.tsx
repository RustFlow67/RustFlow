"use client";

import { Activity, useLayoutEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Segmented from "./Segmented";

const tabs = [
  { value: "game", label: "Игровой конфиг" },
  { value: "windows", label: "Система Windows" },
] as const;
type Tab = (typeof tabs)[number]["value"];
const id = "tweaker-workspace";

function Panel({ tab, active, children }: { tab: Tab; active: boolean; children: ReactNode }) {
  // Don't initialise a second catalogue on entry. Once visited, retain edits
  // and stop its effects (including dialogs) while the other tab is visible.
  const [visited, setVisited] = useState(active);
  if (active && !visited) setVisited(true);
  return (
    <section id={`${id}-panel-${tab}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} hidden={!active}>
      {visited && <Activity mode={active ? "visible" : "hidden"}>{children}</Activity>}
    </section>
  );
}

export default function TweakerTabs({ children, windows }: { children: ReactNode; windows: ReactNode }) {
  const active: Tab = useSearchParams().get("tab") === "windows" ? "windows" : "game";
  function select(tab: Tab) {
    if (active === tab) return;
    const url = new URL(location.href);
    if (tab === "game") url.searchParams.delete("tab");
    else url.searchParams.set("tab", tab);
    url.hash = "";
    // Next subscribes to native history. No fetch or remount of the lens,
    // and the original rig/OS parameters survive both switching and Back.
    history.pushState(null, "", url);
  }
  useLayoutEffect(() => {
    if (!location.hash) return;
    try {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!target?.closest(`#${id}-panel-${active}`)) return;
      target.closest(".rf-page-enter")?.setAttribute("data-anchor-entry", "");
      target.scrollIntoView({ block: "start", behavior: "instant" });
    } catch {
      /* Ignore malformed incoming anchors. */
    }
  }, [active]);
  return (
    <>
      <Segmented
        options={tabs}
        value={active}
        onChange={select}
        tabsId={id}
        ariaLabel="Раздел Твикера"
        className="tweaker-workspace-tabs"
      />
      <Panel tab="game" active={active === "game"}>
        {children}
      </Panel>
      <Panel tab="windows" active={active === "windows"}>
        {windows}
      </Panel>
    </>
  );
}
