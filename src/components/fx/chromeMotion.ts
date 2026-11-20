import { useLayoutEffect } from "react";
import { quietMotion } from "./velocity";

const pulseTime = 350;
const micro: Record<string, Keyframe[]> = {
  chip:[{scale:"1"},{scale:".9"},{scale:"1"}],
  window:[{translate:"0 0"},{translate:"0 -2px"},{translate:"0 0"}],
  roof: [{ translate: "0 0" }, { translate: "0 -2px" }, { translate: "0 0" }],
  left: [{ rotate: "0deg" }, { rotate: "-9deg" }, { rotate: "0deg" }],
  right: [{ rotate: "0deg" }, { rotate: "9deg" }, { rotate: "0deg" }],
  needle: [{ rotate: "0deg" }, { rotate: "24deg" }, { rotate: "0deg" }],
  gear: [{ rotate: "0deg" }, { rotate: "42deg" }, { rotate: "0deg" }],
  "knob-a": [{ translate: "0 0" }, { translate: "3px 0" }, { translate: "0 0" }],
  "knob-b": [{ translate: "0 0" }, { translate: "-3px 0" }, { translate: "0 0" }],
  "knob-c": [{ translate: "0 0" }, { translate: "2px 0" }, { translate: "0 0" }],
  shield: [{ scale: "1" }, { scale: "1.12" }, { scale: "1" }],
};
export const pulsePanels = () => window.dispatchEvent(new Event("rustflow:chrome-pulse"));
export function useChromeMotion() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    let animations: Animation[] = [],
      previous = Math.max(0, window.scrollY);
    root.toggleAttribute("data-scrolled", previous > 0);
    let scrollFrame = 0;
    const updateScroll = () => {
      scrollFrame = 0;
      const y = Math.max(0, window.scrollY);
      root.toggleAttribute("data-scrolled", y > 0);
      if (y !== previous && !document.body.hasAttribute("data-popup-depth")) {
        // Threshold for entering only: the first negative page delta releases
        // the lift, including a two-pixel reversal far from the page top.
        root.toggleAttribute("data-scroll-down", y > 15 && y > previous);
        root.toggleAttribute("data-scroll-up", y > 0 && y < previous);
      }
      previous = y;
    };
    const scroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); };
    // A fine trackpad can reverse before its first subpixel delta has changed
    // scrollY. Begin the return now; never consume native scrolling or zoom.
    const wheel = (e: WheelEvent) => {
      if (e.deltaY < 0 && !e.ctrlKey && root.hasAttribute("data-scroll-down") && !document.body.hasAttribute("data-popup-depth")) {
        root.removeAttribute("data-scroll-down");
        root.toggleAttribute("data-scroll-up", previous > 0);
      }
    };
    const clear = () => {
      for (const a of animations) a.cancel();
      animations = [];
    };
    const pulse = () => {
      clear();
      if (quietMotion() || document.body.hasAttribute("data-popup-depth")) return;
      const easing = "cubic-bezier(.16,1,.3,1)";
      // Feedback stays on the controls. No viewport-sized blur or edge flash.
      for (const bar of document.querySelectorAll("[data-chrome-panel]")) {
        // A menu selection may commit its route on the landing frame. Do
        // not replace the source recoil with a second, larger scale pulse.
        if (bar.getAnimations({subtree:true}).some(a => a.id === "rf-source-recoil")) continue;
        animations.push(
          bar.animate(
            ["1", "1.045", "1"].map((scale, i) => ({
              scale,
              offset: [0, 0.42, 1][i],
              easing,
            })),
            pulseTime,
          ),
        );
      }
      // Individual transform properties compose with pointer magnification and
      // the glyph's own internal animation. The last icon settles at 350 ms.
      document.querySelectorAll(".dock-glyph-wrap").forEach((icon, i) => {
        animations.push(
          icon.animate(
            [
              { translate: "0 0", rotate: "0deg" },
              { translate: "0 -4px", rotate: "-6deg" },
              { translate: "0 2px", rotate: "5deg" },
              { translate: "0 -1px", rotate: "-2deg" },
              { translate: "0 0", rotate: "0deg" },
            ].map((f, j) => ({ ...f, easing, offset: [0, 0.23, 0.49, 0.72, 1][j] })),
            { delay: i * 11, duration: pulseTime - i * 11 },
          ),
        );
        icon
          .querySelectorAll<SVGElement>("[data-part],[data-dock-glyph=gear],[data-dock-glyph=shield]")
          .forEach((node, j) => {
            const frames = micro[node.dataset.part ?? node.dataset.dockGlyph ?? ""];
            const delay = i * 11 + j * 12;
            if (frames) animations.push(node.animate(frames, { duration: pulseTime - delay, delay, easing }));
          });
      });
    };
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("wheel", wheel, { passive: true });
    window.addEventListener("rustflow:chrome-pulse", pulse);
    window.addEventListener("rustflow:modal-open", clear);
    return () => {
      clear();
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("wheel", wheel);
      window.removeEventListener("rustflow:chrome-pulse", pulse);
      window.removeEventListener("rustflow:modal-open", clear);
      delete root.dataset.scrolled;
      delete root.dataset.scrollDown;
      delete root.dataset.scrollUp;
    };
  }, []);
}
