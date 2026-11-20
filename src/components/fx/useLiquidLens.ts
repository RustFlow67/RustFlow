"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { pulseVelocity, quietMotion } from "./velocity";

const ITEM = "[data-liquid-item]";
const stops = [1.38, 1.18, 1.06, 1];
type Box = [number, number, number, number]; // left, top, width, height in the rail's own coordinates

/** One decorative surface for rails, wrapped grids and vertical menus. Hover
 * previews a destination; only the actual control commits it. JS measures
 * destinations, never interpolated frames: CSS retargets from the painted pose. */
export function useLiquidLens<
  H extends HTMLElement = HTMLDivElement,
  L extends HTMLElement = HTMLSpanElement,
>(
  selected: number,
  count: number,
  {
    dock = false,
    continuous = false,
    lazy = false,
    enabled = true,
    hostRef,
  }: {
    dock?: boolean;
    continuous?: boolean;
    lazy?: boolean;
    enabled?: boolean;
    hostRef?: RefObject<H | null>;
  } = {},
) {
  const ownRef = useRef<H>(null),
    list = hostRef ?? ownRef,
    lens = useRef<L>(null);
  const selection = useRef(selected),
    sync = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    selection.current = selected;
    sync.current?.();
  }, [selected]);
  useLayoutEffect(() => {
    const host = list.current,
      pill = lens.current;
    if (!enabled || !host || !pill) return;
    const rail = host,
      glass = pill;
    let items: HTMLElement[] = [],
      boxes: Box[] = [];
    let point: { x: number; y: number; node: HTMLElement | null } | null = null;
    let focused: HTMLElement | null = null,
      marked: HTMLElement | null = null;
    let frame = 0,
      measured = false,
      visible = !lazy;
    let stopBlur: (() => void) | undefined;
    function rect(node: HTMLElement): Box {
      let x = node.offsetLeft,
        y = node.offsetTop;
      // A listbox can group items in positioned wrappers. Measure in the
      // coordinate system of the stationary lens rail, not the wrapper.
      for (
        let group = node.offsetParent as HTMLElement | null;
        group && group !== rail && rail.contains(group);
        group = group.offsetParent as HTMLElement | null
      ) {
        x += group.offsetLeft + group.clientLeft - group.scrollLeft;
        y += group.offsetTop + group.clientTop - group.scrollTop;
      }
      return [x, y, node.offsetWidth, node.offsetHeight];
    }
    function read() {
      items = Array.from(rail.querySelectorAll<HTMLElement>(ITEM));
      boxes = dock || continuous ? items.map(rect) : [];
      measured = true;
    }
    function position() {
      frame = 0;
      if (!visible || document.hidden) return;
      if (!measured) read();
      let node = point?.node ?? focused ?? items[selection.current];
      let x = 0,
        y = 0;
      if (point) {
        // Account for a scrolled list, a scaled panel or the chrome impulse.
        const r = rail.getBoundingClientRect();
        x = ((point.x - r.left) * rail.offsetWidth) / (r.width || 1) - rail.clientLeft + rail.scrollLeft;
        y = ((point.y - r.top) * rail.offsetHeight) / (r.height || 1) - rail.clientTop + rail.scrollTop;
        if ((dock || continuous) && !point.node) {
          let best = Infinity;
          boxes.forEach(([l, t, w, h], i) => {
            const d = ((x - l - w / 2) / w) ** 2 + ((y - t - h / 2) / h) ** 2;
            if (d < best) {
              best = d;
              node = items[i];
            }
          });
        }
      }
      if (node && !rail.contains(node)) node = items[selection.current];
      const changed = marked !== node;
      if (changed) {
        marked?.removeAttribute("data-lens-target");
        node?.setAttribute("data-lens-target", "");
        marked = node ?? null;
      }
      const goal = node && rect(node);
      const animate = !quietMotion();
      if (goal && point && animate) {
        const dx = x - goal[0] - goal[2] / 2,
          dy = y - goal[1] - goal[3] / 2;
        goal[0] += Math.max(-goal[2] / 2, Math.min(goal[2] / 2, dx)) * (dock ? 0.22 : 0.055);
        goal[1] += Math.max(-goal[3] / 2, Math.min(goal[3] / 2, dy)) * (dock ? 0.14 : 0.045);
      }
      if (dock) {
        const row = node && boxes[items.indexOf(node)];
        const side = document.documentElement.dataset.dock === "left";
        boxes.forEach(([l, t, w, h], i) => {
          let scale = 1;
          if (point && row && (side || t === row[1]) && animate) {
            const next = boxes[i + 1],
              prev = boxes[i - 1];
            const pitch = side
              ? next
                ? next[1] - t
                : prev
                  ? t - prev[1]
                  : h
              : next?.[1] === t
                ? next[0] - l
                : prev?.[1] === t
                  ? l - prev[0]
                  : w;
            const d = Math.min(3, Math.abs(side ? t + h / 2 - y : l + w / 2 - x) / Math.max(1, pitch)),
              k = Math.floor(d);
            scale =
              stops[k] + ((stops[Math.min(3, k + 1)] - stops[k]) * (1 - Math.cos(Math.PI * (d - k)))) / 2;
          }
          items[i].style.setProperty("--mag", scale.toFixed(4));
          items[i].style.setProperty("--lift", `${((-10 * (scale - 1)) / 0.38).toFixed(2)}px`);
        });
        if (goal && changed && glass.hasAttribute("data-positioned") && animate) {
          // Brief optical response to the actual movement of the CSS lens.
          const axis = side ? "f" : "e";
          const here = () => new DOMMatrixReadOnly(getComputedStyle(glass).transform)[axis];
          let previous = here(),
            time = performance.now();
          stopBlur = pulseVelocity(glass, side ? "motion-blur-y" : "motion-blur-x", () => {
            const next = here(),
              now = performance.now();
            const speed = (next - previous) / Math.max(1, now - time);
            previous = next;
            time = now;
            return speed;
          });
        }
      }
      if (!goal || !goal[2] || !goal[3]) {
        delete glass.dataset.positioned;
        return;
      }
      glass.style.transform = `translate3d(${goal[0]}px,${goal[1]}px,0)`;
      glass.style.width = `${goal[2]}px`;
      glass.style.height = `${goal[3]}px`;
      if (!glass.hasAttribute("data-positioned")) {
        // Place the first rect before enabling transitions. Never sweep from
        // (0,0) on mount, or stretch the bevel with scaleX/scaleY.
        glass.getBoundingClientRect();
        glass.dataset.positioned = "";
      }
    }
    function aim() {
      if (visible && !document.hidden && !frame) frame = requestAnimationFrame(position);
    }
    function scrollEdges() {
      if (!dock) return;
      rail.toggleAttribute("data-scroll-start", rail.scrollLeft > 1);
      rail.toggleAttribute("data-scroll-end", rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1);
    }
    let scrollFrame = 0;
    function updateScroll() {
      scrollFrame = 0;
      scrollEdges();
      if (point) point.node = document.elementFromPoint(point.x, point.y)?.closest<HTMLElement>(ITEM) ?? null;
      aim();
    }
    function scrolled() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }
    function measure() {
      scrollEdges();
      measured = false;
      aim();
    }
    let pointerFrame = 0;
    let pendingPointer: { x: number; y: number; target: EventTarget | null } | null = null;
    function pointer(e: PointerEvent) {
      if (e.pointerType === "touch") return;
      pendingPointer = { x: e.clientX, y: e.clientY, target: e.target };
      if (pointerFrame) return;
      pointerFrame = requestAnimationFrame(() => {
        pointerFrame = 0;
        const current = pendingPointer;
        if (!current) return;
        point = {
          x: current.x,
          y: current.y,
          node: current.target instanceof Element ? current.target.closest<HTMLElement>(ITEM) : null,
        };
        focused = null;
        aim();
      });
    }
    function leave() {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      pendingPointer = null;
      point = null;
      focused = null;
      aim();
    }
    function focus(e: FocusEvent) {
      if (e.target instanceof HTMLElement && e.target.matches(":focus-visible")) {
        cancelAnimationFrame(pointerFrame); pointerFrame = 0; pendingPointer = null;
        focused = e.target.closest(ITEM);
        point = null;
        aim();
      }
    }
    function blur() {
      focused = null;
      aim();
    }
    function visibility() {
      if (document.hidden) {
        cancelAnimationFrame(pointerFrame); pointerFrame = 0; pendingPointer = null;
        cancelAnimationFrame(frame);
        frame = 0;
        point = null;
      } else measure();
    }
    // A narrow horizontal Dock scrolls its own tabs, never the page. Keyboard focus
    // remains native and a direct visit reveals the selected destination.
    function revealSelected() {
      if (!dock || document.documentElement.dataset.dock === "left" || rail.scrollWidth <= rail.clientWidth)
        return;
      const tab = rail.querySelectorAll<HTMLElement>(ITEM)[selection.current];
      if (!tab) return;
      if (tab.offsetLeft < rail.scrollLeft) rail.scrollLeft = tab.offsetLeft;
      else if (tab.offsetLeft + tab.offsetWidth > rail.scrollLeft + rail.clientWidth)
        rail.scrollLeft = tab.offsetLeft + tab.offsetWidth - rail.clientWidth;
    }
    function layout() {
      point = null;
      focused = null;
      revealSelected();
      measure();
    }
    if (dock) window.addEventListener("rustflow:dock-layout", layout);
    sync.current = () => {
      revealSelected();
      aim();
    };
    const ro = new ResizeObserver(() => {
      revealSelected();
      measure();
    });
    function observe() {
      ro.disconnect();
      ro.observe(rail);
      if (count < 100) for (const n of rail.querySelectorAll(ITEM)) ro.observe(n);
      // Accordion sections can move a later row without resizing that row.
      for (const group of rail.querySelectorAll(":scope > [data-liquid-group]")) ro.observe(group);
      measure();
    }
    // Searching can replace items without changing their count. A stale node
    // must never become the landing position for a new selection.
    const changes = new MutationObserver(() => {
      if (visible) {
        if (point) scrolled();
        observe();
      } else measured = false;
    });
    changes.observe(rail, { childList: true });
    const io = lazy
      ? new IntersectionObserver(
          ([e]) => {
            visible = e.isIntersecting;
            if (visible) observe();
            else {
              ro.disconnect();
              cancelAnimationFrame(frame);
              frame = 0;
              point = null;
            }
          },
          { rootMargin: "80px" },
        )
      : null;
    if (io) io.observe(rail);
    else {
      observe();
      cancelAnimationFrame(frame);
      position();
    }
    rail.addEventListener("scroll", scrolled, { passive: true });
    // Delegated pointerover is the item-enter event even on nested icons.
    // A touch tap commits via the native control, never a sticky mouse preview.
    rail.addEventListener("pointermove", pointer, { passive: true });
    rail.addEventListener("pointerover", pointer);
    rail.addEventListener("pointerleave", leave);
    rail.addEventListener("pointercancel", leave);
    rail.addEventListener("focusin", focus);
    rail.addEventListener("focusout", blur);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      if (dock) window.removeEventListener("rustflow:dock-layout", layout);
      sync.current = null;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(scrollFrame);
      cancelAnimationFrame(pointerFrame);
      stopBlur?.();
      ro.disconnect();
      changes.disconnect();
      io?.disconnect();
      marked?.removeAttribute("data-lens-target");
      delete glass.dataset.positioned;
      rail.removeEventListener("scroll", scrolled);
      rail.removeEventListener("pointermove", pointer);
      rail.removeEventListener("pointerover", pointer);
      rail.removeEventListener("pointerleave", leave);
      rail.removeEventListener("pointercancel", leave);
      rail.removeEventListener("focusin", focus);
      rail.removeEventListener("focusout", blur);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [count, dock, continuous, enabled, lazy, list]);
  return { list, lens };
}
