"use client";

import { enterDepth } from "./pageDepth";
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

import { captureSource, setSourcePose, sourceBox, type PopupSource } from "./popupGeometry";
import { pulseFlight, quietMotion } from "./velocity";

export type PopupOrigin = { source: RefObject<PopupSource>; returnFocus: RefObject<HTMLElement | null> };

/** Capture synchronously in the invoker's own handler, before a click can
 * cause focus, layout, navigation, or a parent sheet to change. */
export function usePopupTrigger() {
  const triggerElementRef = useRef<HTMLElement | null>(null);
  const source = useRef<PopupSource>(null);
  const capture = useCallback((from: HTMLElement | null, measured?: PopupSource) => {
    triggerElementRef.current = from;
    source.current = measured ?? captureSource(from);
  }, []);
  return { capture, origin: { source, returnFocus: triggerElementRef } satisfies PopupOrigin };
}

/** Keep the payload until the inert closing transition finishes. Showing it
 * again mid-exit reverses the transition without a stale timer closing it. */
export function usePopupState<T>(initial: T | null = null) {
  const [state, set] = useState({ value: initial, closing: false });
  const {capture, origin} = usePopupTrigger();
  const show = useCallback((value: T, from: HTMLElement | null, measured?: PopupSource) => {
    capture(from, measured);
    set({ value, closing: false });
  }, [capture]);
  const dismiss = useCallback(
    () => set((s) => (s.value !== null && !s.closing ? { ...s, closing: true } : s)),
    [],
  );
  const finish = useCallback(() => set((s) => (s.closing ? { value: null, closing: false } : s)), []);
  return {
    value: state.value,
    isOpen: state.value !== null,
    closing: state.closing,
    opener: origin.returnFocus,
    source: origin.source,
    show,
    dismiss,
    finish,
  };
}

/** CSS transitions reverse from the painted pose. Release background ownership
 * and focus at dismissal, never on the decorative landing/timeout. */
export function usePopupMotion<T extends HTMLElement>(
  isOpen: boolean,
  closing: boolean,
  onExited: () => void,
  source?: RefObject<PopupSource>,
  anchor?: RefObject<HTMLElement | null>,
) {
  const panelRef = useRef<T>(null),
    captured = useRef<PopupSource>(null),
    finish = useRef(onExited);
  useLayoutEffect(() => {
    finish.current = onExited;
  }, [onExited]);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel) return;
    const initial = !panel.hasAttribute("data-ready");
    if (initial || !closing) {
      captured.current = source ? source.current : captureSource(anchor?.current ?? null);
    }
    const origin = captured.current;
    panel.toggleAttribute("data-flip-source", !!origin);
    // Honest FLIP: the panel itself morphs from the source rect. The source
    // button is never borrowed, hidden or restyled in any way.
    setSourcePose(panel, origin, closing);
    if (initial) {
      panel.getBoundingClientRect(); // Commit the exact button pose before the target.
      panel.dataset.ready = "";
    }
    panel.toggleAttribute("data-shown", !closing);
    // Bidirectional shell/content flight: the same blur + vector stretch on
    // open and on close, sharp at rest. The shell carries its contents.
    const box = sourceBox(origin, closing);
    const slot = panel.parentElement?.getBoundingClientRect();
    const dx = box && slot ? slot.left + slot.width / 2 - (box.left + box.width / 2) : 0;
    const dy = box && slot ? slot.top + slot.height / 2 - (box.top + box.height / 2) : 0;
    const flightTime = closing ? 340 : 380;
    const shells = origin ? [panel] : [];
    const stopFlight = shells.length ? pulseFlight(shells, dx, dy, flightTime) : undefined;
    if (!closing) {
      const release = enterDepth(panel);
      // A HUD source stays visible in its pinned bar while siblings recede;
      // page sources ride the depth plane untouched. Markers only — the
      // button's own styles are never changed.
      const src = origin?.node ?? null;
      const hud = origin?.node?.closest("[data-hud]") as HTMLElement | null;
      if (hud && !hud.hasAttribute("data-source-pinned")) {
        hud.style.setProperty("--source-pinned-pose", getComputedStyle(hud).transform);
        hud.dataset.sourcePinned = "";
      }
      src?.setAttribute("data-flip-anchor", "");
      return () => {
        stopFlight?.();
        release();
        src?.removeAttribute("data-flip-anchor");
        if (hud && !hud.querySelector("[data-flip-anchor]")) {
          delete hud.dataset.sourcePinned;
          hud.style.removeProperty("--source-pinned-pose");
        }
      };
    }
    // Exactly at 340ms the window unmounts and the untouched source plays
    // its landing bounce. No post-close ghost, no extra timers.
    let cancelled = false;
    const done = () => {
      if (cancelled) return;
      cancelled = true;
      if (origin?.node?.isConnected && !quietMotion())
        origin.node.animate([{ scale: ".96" }, { scale: "1.02", offset: 0.52 }, { scale: "1" }], {
          id: "rf-source-recoil",
          duration: 270,
          easing: "cubic-bezier(.2,.75,.25,1)",
        });
      captured.current = null;
      finish.current();
    };
    // Unified close cycle: every window is gone exactly 340ms after the
    // dismiss click. Transitions ending on time resolve through allSettled
    // on the same tick; the deadline only guards a stalled timeline.
    const deadline = window.setTimeout(done, 340);
    const transitions = [...panel.getAnimations()]
      .filter(
        (a) =>
          "transitionProperty" in a &&
          ["transform", "clip-path", "opacity", "width", "height", "border-top-left-radius"].includes(String(a.transitionProperty)),
      );
    void Promise.allSettled(transitions.map((a) => a.finished)).then(done);
    return () => {
      cancelled = true;
      stopFlight?.();
      clearTimeout(deadline);
    };
  }, [isOpen, closing, source, anchor]);
  return panelRef;
}
