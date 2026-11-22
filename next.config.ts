import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";
import { WINDOWS_TAB_HREF } from "./src/lib/tweaker-routes";

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
    compress: true,
    poweredByHeader: false,
    // Permit loopback and this sandbox's preview to hydrate and connect to HMR.
    allowedDevOrigins: ["127.0.0.1", ...(previewId ? [`3000-${previewId}.e2b.app`] : [])],
    devIndicators: false,
    env: { VITE_API_BASE_URL: publicApiBase },
    experimental: {
      optimizePackageImports: ["lucide-react"],
    },
    ...(staticExport
      ? {}
      : {
          // The ZIP endpoint reads the allowlisted project files at runtime, not the whole checkout.
          outputFileTracingIncludes: {
            "/api/source": [
              "./src/**/*.{ts,tsx,js,mjs,cjs,css,json,svg,md}",
              "./public/**/*",
              "./README.md",
              "./package.json",
              "./package-lock.json",
              "./docs/{production-audit,addons}.md",
              "./tsconfig.json",
              "./next.config.ts",
              "./postcss.config.mjs",
              "./eslint.config.mjs",
              "./drizzle.config.ts",
              "./.env.example",
              "./.dockerignore",
              "./Dockerfile",
              "./docker-compose.yml",
            ],
          },
          async redirects() {
            return [
              { source: "/windows", destination: WINDOWS_TAB_HREF, permanent: true },
              { source: "/setup", destination: "/tweaker", permanent: true },
              { source: "/tweaks", destination: "/tweaker", permanent: true },
              { source: "/tweaks/:slug", destination: "/tweaker?tweak=:slug", permanent: true },
            ];
          },
          async rewrites() {
            const prefix = publicApiBase.endsWith("/api") ? publicApiBase : `${publicApiBase}/api`;
            return [
              { source: "/api/auth/build", destination: "/api/auth/active-build" },
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
