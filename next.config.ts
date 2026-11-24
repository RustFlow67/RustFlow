import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";
import { randomBytes } from "node:crypto";

// npm scripts use the webpack next/font loader so even air-gapped builds
// can resolve the requested Google family from the checked-in OFL subsets.
// Direct `next build` (Turbopack) uses the regular Google build-time fetch.
// The dev compiler is forked without the CLI's --webpack argv. Next sets
// TURBOPACK before loading this config in both CLI and worker processes.
if (!process.env.TURBOPACK && process.env.RUSTFLOW_FONT_SOURCE !== "google") {
  process.env.NEXT_FONT_GOOGLE_MOCKED_RESPONSES ??= path.resolve("src/lib/unbounded-offline.cjs");
}

// Only this public prefix is inlined; API keys and client secrets stay at runtime on the server.
function apiBase(raw: string | undefined) {
  const value = raw?.trim().replace(/\/+$/, "") ?? "";
  if (!value) return "";
  if (/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(value)) return value;
  try {
    const url = new URL(value);
    if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password && !url.search && !url.hash) return value;
  } catch { /* See the configuration error below. */ }
  throw new Error("VITE_API_BASE_URL must be a path prefix or an HTTP(S) URL without credentials, query or hash.");
}
const publicApiBase = apiBase(process.env.VITE_API_BASE_URL);
const previewId = process.env.E2B_SANDBOX_ID;
// Legacy service workers cached dev chunks at stable paths, so an old layout
// could be mixed with fresh server output. Give each dev compilation namespace
// fresh URLs even before the legacy worker has had a chance to retire itself.
// The content hash also changes on HMR recompilation within the same session.
const devChunkTag = randomBytes(6).toString("hex");

export default function createNextConfig(phase: string): NextConfig {
  // Десктопный режим включается флагом NEXT_PUBLIC_IS_DESKTOP_APP=true (или TAURI_ENV=true).
  // Во время `next dev` (PHASE_DEVELOPMENT_SERVER) оставляем обычный сервер для HMR и Playwright-тестов,
  // а при сборке десктопного бандла включаем статический экспорт в `out/`.
  const isDesktopApp =
    process.env.NEXT_PUBLIC_IS_DESKTOP_APP === "true" ||
    process.env.TAURI_ENV === "true";
  const staticExport = isDesktopApp && phase !== PHASE_DEVELOPMENT_SERVER;

  return {
    ...(staticExport ? { output: "export", trailingSlash: true } : {}),
    ...(isDesktopApp ? { images: { unoptimized: true } } : {}),
    webpack(config, { dev, isServer }) {
      if (dev && !isServer && config.output) {
        for (const key of ["filename", "chunkFilename"] as const) {
          const value = config.output[key];
          if (typeof value === "string" && value.endsWith(".js")) {
            // Lazy route chunks can be requested before their content hash exists
            // in webpack's dev runtime. A session tag avoids stale workers while
            // leaving those on-demand filenames resolvable on the first visit.
            config.output[key] = value.slice(0, -3) + `.shift-${devChunkTag}${key === "filename" ? ".[contenthash]" : ""}.js`;
          }
        }
      }
      return config;
    },
    compress: true,
    poweredByHeader: false,
    // Permit loopback and this sandbox's preview to hydrate and connect to HMR.
    allowedDevOrigins: ["127.0.0.1", ...(previewId ? [`3000-${previewId}.e2b.app`, `3002-${previewId}.e2b.app`] : [])],
    devIndicators: false,
    env: { VITE_API_BASE_URL: publicApiBase },
    experimental: {
      optimizePackageImports: ["lucide-react"],
    },
    ...(staticExport
      ? {}
      : {
          async rewrites() {
            const prefix = publicApiBase.endsWith("/api") ? publicApiBase : `${publicApiBase}/api`;
            return [
              { source: "/manifest.webmanifest", destination: "/manifest.json" },
              ...(prefix.startsWith("/") && prefix !== "/api" ? [{ source: `${prefix}/:path*`, destination: "/api/:path*" }] : []),
            ];
          },
          async headers() {
            return [
              {
                source: "/fonts/:path*",
                headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
              },
              {
                source: "/images/:path*",
                headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
              },
              {
                source: "/icon.svg",
                headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
              },
              {
                source: "/favicon.ico",
                headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
              },
              {
                // Service Worker обязан проверяться на свежесть при каждой загрузке.
                source: "/sw.js",
                headers: [
                  { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
                  { key: "Service-Worker-Allowed", value: "/" },
                ],
              },
              {
                source: "/:manifest(manifest.json|manifest.webmanifest)",
                headers: [
                  { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
                  { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
                ],
              },
            ];
          },
        }),
  };
}
