"use client";

import { getMotionReduced } from "@/lib/motion";
import { useEffect, useRef } from "react";
import { blendLight, crystal, pigment, lighting, orbit, type Renderer } from "./fx/wallpaper/field";
import { contourRenderer } from "./fx/wallpaper/contours";
import { webglRenderer } from "./fx/wallpaper/webgl";

export default function BlobWallpaper() {
  const scene = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = scene.current!,
      root = document.documentElement;
    // Owned by this mount. A failed/lost GL context can't lock the fallback canvas.
    const gpu = document.createElement("canvas"),
      vector = document.createElement("canvas");
    host.append(gpu, vector);
    let gl: WebGLRenderingContext | null = null,
      gpuRenderer: Renderer | null = null,
      flat: Renderer | null = null;
    let triedGL = false,
      pageHidden = false,
      windowBlurred = false,
      disposed = false,
      frame = 0,
      last = 0,
      t = 12;
    let light = lighting(root),
      mode = "drift",
      lite = false,
      still = false;
    const a = new Float32Array(3 * pigment.length),
      b = new Float32Array(3 * crystal.length);
    let from = light, target = light, mixStart: number | null = null;
    let finish = root.dataset.material;
    let width = host.clientWidth,
      height = host.clientHeight;
    function select() {
      if (!lite && !triedGL) {
        triedGL = true;
        gl = gpu.getContext("webgl", {
          alpha: false,
          antialias: false,
          depth: false,
          stencil: false,
          powerPreference: "low-power",
          failIfMajorPerformanceCaveat: true,
        });
        if (gl) {
          // Some software drivers report no major caveat but read back every
          // full-screen frame through the CPU. Use the vector field instead.
          const info = gl.getExtension("WEBGL_debug_renderer_info");
          const software =
            info &&
            /swiftshader|llvmpipe|softpipe|software rasterizer/i.test(
              gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
            );
          if (!software) gpuRenderer = webglRenderer(gl);
          if (!gpuRenderer) {
            gl.getExtension("WEBGL_lose_context")?.loseContext();
            gl = null;
          }
        }
      }
      if (!gpuRenderer || lite) {
        if (!flat) {
          const ctx = vector.getContext("2d");
          if (ctx) flat = contourRenderer(ctx);
        }
        return flat;
      }
      return gpuRenderer;
    }
    function paint(now: number) {
      frame = 0;
      if (disposed || pageHidden || windowBlurred || document.hidden || !width || !height) return;
      const renderer = select(),
        isGpu = !!renderer && renderer === gpuRenderer;
      if (!renderer) {
        host.dataset.renderer = "gradient";
        return;
      }
      const canvas = isGpu ? gpu : vector,
        speed = mode === "fusion" ? 1.75 : 1;
      // A calm wallpaper does not need to run a high-DPI 4K fragment shader at 120 Hz.
      if (!last || now - last >= (isGpu ? 1000 / 30 : 1000 / 18) - 1) {
        const scale = Math.min(
          devicePixelRatio || 1,
          1.5,
          Math.sqrt((isGpu ? 1_200_000 : 650_000) / (width * height)),
        );
        const w = Math.max(1, Math.round(width * scale)),
          h = Math.max(1, Math.round(height * scale));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        if (last && !still) t += (Math.min(now - last, 100) * speed) / 1000;
        const unit = Math.max(h, 0.5 * w);
        orbit(pigment, a, t, w, h, unit);
        orbit(crystal, b, t, w, h, unit);
        if (mixStart !== null) {
          const elapsed = Math.min(1, Math.max(0, (now - mixStart) / 420));
          light = elapsed < 1 ? blendLight(from, target, elapsed) : target;
          if (elapsed === 1) mixStart = null;
        }
        renderer.draw(w, h, unit, a, b, light);
        last = now;
        const kind = isGpu ? "webgl" : "contour";
        if (host.dataset.renderer !== kind) host.dataset.renderer = kind;
      }
      if (!still) frame = requestAnimationFrame(paint);
    }
    function refresh() {
      cancelAnimationFrame(frame);
      frame = 0;
      last = 0;
      lite = root.hasAttribute("data-lite");
      mode = root.dataset.wallpaper || "drift";
      still = lite || getMotionReduced() || mode === "still";
      host.dataset.playback = pageHidden || windowBlurred || document.hidden ? "paused" : still ? "still" : mode;
      if (disposed || document.hidden || pageHidden || windowBlurred) return;
      const next = lighting(root);
      if (still || !host.dataset.renderer) {
        light = target = next; mixStart = null;
      } else if (root.dataset.material !== finish || next.shine !== target.shine) {
        // Rapid changes retarget from the last painted palette, not from
        // the preceding theme's endpoint. No second animation clock.
        from = light; target = next; mixStart = performance.now();
      }
      finish = root.dataset.material;
      width = host.clientWidth;
      height = host.clientHeight;
      frame = requestAnimationFrame(paint);
    }
    const lost = (e: Event) => {
      if (!gl) return; // deliberate release of a software/unsupported context
      e.preventDefault();
      gpuRenderer = null;
      refresh();
    };
    const restored = () => {
      if (gl) gpuRenderer = webglRenderer(gl);
      refresh();
    };
    const hide = () => {
        pageHidden = true;
        refresh();
      },
      show = () => {
        pageHidden = false;
        refresh();
      };
    // Minimizing the Tauri window (or switching apps) fires blur without a
    // reliable visibilitychange in WebView2: stop the GPU loop entirely.
    const blur = () => {
        windowBlurred = true;
        refresh();
      },
      focus = () => {
        windowBlurred = false;
        refresh();
      };
    const size = new ResizeObserver(refresh),
      policy = new MutationObserver(refresh);
    gpu.addEventListener("webglcontextlost", lost);
    gpu.addEventListener("webglcontextrestored", restored);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    size.observe(host);
    policy.observe(root, {
      attributes: true,
      attributeFilter: ["data-material", "data-motion", "data-engine-motion", "data-lite", "data-wallpaper", "style"],
    });
    refresh();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      size.disconnect();
      policy.disconnect();
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
      gpu.removeEventListener("webglcontextlost", lost);
      gpu.removeEventListener("webglcontextrestored", restored);
      gpuRenderer?.dispose();
      flat?.dispose();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
      gpu.remove();
      vector.remove();
      delete host.dataset.renderer;
      delete host.dataset.playback;
    };
  }, []);
  return <div ref={scene} className="wallpaper-scene" aria-hidden="true" />;
}
