"use client";

import { useEffect, useRef } from "react";
import { buildDisplacementMap, bevels } from "../LiquidGlass";

// A shared resource bank also survives React remounts and strict-mode effects.
const displacementCache = new Map<string, string>();
function displacement(section: (typeof bevels)[number]) {
  const key = `${section.w}:${section.h}:${section.r}:${section.bezel}`;
  const existing = displacementCache.get(key);
  if (existing) return existing;
  const url = buildDisplacementMap(section);
  if (url) displacementCache.set(key, url);
  return url;
}

/** One resource bank per document, including portaled menus. */
export default function LiquidGlassFilters() {
  const defs = useRef<SVGDefsElement>(null);
  useEffect(() => {
    // CSS.supports alone returns true on WebKit versions which parse url()
    // but don't sample SVG references in a backdrop. Keep their native glass.
    if (
      !/Chrom(?:e|ium)\//.test(navigator.userAgent) ||
      !CSS.supports("backdrop-filter", "url(#rf-liquid-pane)")
    )
      return;
    const root = document.documentElement,
      images = defs.current!.querySelectorAll("feImage");
    let ready = false;
    function sync() {
      if (!ready && !root.hasAttribute("data-lite")) {
        for (const [i, section] of bevels.entries()) {
          const url = displacement(section);
          if (!url) return;
          images[i].setAttribute("href", url);
        }
        ready = true;
      }
      root.toggleAttribute("data-refraction", ready && !root.hasAttribute("data-lite"));
    }
    const policy = new MutationObserver(sync);
    policy.observe(root, { attributes: true, attributeFilter: ["data-lite"] });
    sync();
    return () => {
      policy.disconnect();
      root.removeAttribute("data-refraction");
      images.forEach((el) => el.removeAttribute("href"));
    };
  }, []);
  return (
    <svg width="0" height="0" className="velocity-defs" aria-hidden="true" focusable="false">
      <defs ref={defs}>
        {bevels.map(({ name, strength }) => (
          <filter
            key={name}
            id={`rf-liquid-${name}`}
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="objectBoundingBox"
            primitiveUnits="objectBoundingBox"
            colorInterpolationFilters="sRGB"
          >
            <feImage x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="bezel" />
            <feDisplacementMap
              in="SourceGraphic"
              in2="bezel"
              scale={strength}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        ))}
      </defs>
    </svg>
  );
}
