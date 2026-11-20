"use client";

import { borrowIsland } from "./headerIsland";
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
    island = useRef<ReturnType<typeof borrowIsland>>(null),
    captured = useRef<PopupSource>(null),
    finish = useRef(onExited);
  useLayoutEffect(() => {
    finish.current = onExited;
  }, [onExited]);
  // Do not put this cleanup in the open/close effect: a reversed flight
  // must retain the borrowed element until the dialog actually unmounts.
  useLayoutEffect(() => () => { island.current?.release(); island.current = null; }, [isOpen]);
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!isOpen || !panel) return;
    const initial = !panel.hasAttribute("data-ready");
    if (initial || !closing) {
      captured.current = source ? source.current : captureSource(anchor?.current ?? null);
    }
    const origin = captured.current;
    panel.toggleAttribute("data-flip-source", !!origin);
    // A housed skin (home still holds it) borrows exactly like a header
    // capsule; a retained flight keeps its button while the home is empty.
    const housed = !!origin?.node?.querySelector(":scope > [data-island-home] > .island-skin");
    const direct = !!origin?.node && (origin.node === anchor?.current || housed || island.current?.button === origin.node);
    if (island.current && (!direct || island.current.button !== origin?.node)) {
      island.current.release(); island.current = null;
    }
    if (direct && origin?.node && !island.current) island.current = borrowIsland(origin.node, panel);
    const flight = island.current;
    panel.toggleAttribute("data-header-motion", !!flight);
    if (flight && origin) flight.pose(origin, closing);
    if (!flight) setSourcePose(panel, origin, closing);
    if (initial) {
      (flight?.skin ?? panel).getBoundingClientRect(); // Commit the exact button pose before the target.
      panel.dataset.ready = "";
    }
    flight?.move(closing);
    panel.toggleAttribute("data-shown", !closing);
    // Bidirectional shell/content flight: the same blur + vector stretch on
    // open and on close, sharp at rest. The island animates its borrowed
    // glass and the transparent ink plane separately; an ordinary shell
    // carries its contents with it.
    const box = sourceBox(origin, closing);
    const slot = panel.parentElement?.getBoundingClientRect();
    const dx = box && slot ? slot.left + slot.width / 2 - (box.left + box.width / 2) : 0;
    const dy = box && slot ? slot.top + slot.height / 2 - (box.top + box.height / 2) : 0;
    const flightTime = flight ? (closing ? 380 : 420) : closing ? 420 : 440;
    const shells = flight && origin ? [flight.skin, panel] : origin ? [panel] : [];
    const stopFlight = shells.length ? pulseFlight(shells, dx, dy, flightTime) : undefined;
    if (!closing) {
      const release = enterDepth(panel);
      return () => {
        stopFlight?.();
        release();
      };
    }
    // The source stays hidden for the whole flight; its rebound plays only
    // once the skin is home and the button is visible again (see done()).
    const ink = flight?.button.querySelector<HTMLElement>("[data-island-ink]");
    let cancelled = false;
    const done = () => {
      if (cancelled) return;
      cancelled = true;
      if (flight) {
        flight.release(); island.current = null;
        if (ink && !quietMotion()) ink.animate([{scale:".96"}, {scale:"1.02",offset:.52}, {scale:"1"}], {
          id:"rf-source-recoil", duration:275.82, easing:"cubic-bezier(.2,.75,.25,1)",
        });
      }
      else if (origin?.node?.isConnected && !quietMotion())
        origin.node.animate([{ scale: ".96" }, { scale: "1.02", offset: 0.52 }, { scale: "1" }], {
          id: "rf-source-recoil",
          duration: 270,
          easing: "cubic-bezier(.2,.75,.25,1)",
        });
      captured.current = null;
      finish.current();
    };
    const deadline = window.setTimeout(done, 490);
    const transitions = [...panel.getAnimations(), ...(flight?.skin.getAnimations() ?? [])]
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
