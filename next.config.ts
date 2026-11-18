import type { NextConfig } from "next";

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

const nextConfig: NextConfig = {
  compress: true,
  poweredByHeader: false,
  // Allow this sandbox's proxied dev preview without trusting other origins.
  allowedDevOrigins: previewId ? [`3000-${previewId}.e2b.app`] : undefined,
  devIndicators: false,
  env: { VITE_API_BASE_URL: publicApiBase },
  // The ZIP endpoint reads the allowlisted project files at runtime, not the whole checkout.
  outputFileTracingIncludes: { "/api/source": [
    "./src/**/*.{ts,tsx,js,mjs,cjs,css,json,svg,md}", "./public/**/*",
    "./README.md", "./package.json", "./package-lock.json", "./docs/{production-audit,addons}.md", "./tsconfig.json", "./next.config.ts", "./postcss.config.mjs",
    "./eslint.config.mjs", "./drizzle.config.ts", "./.env.example", "./.dockerignore", "./Dockerfile", "./docker-compose.yml",
  ] },
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async redirects() {
    return [
      { source: "/setup", destination: "/tweaker", permanent: true },
      { source: "/tweaks", destination: "/tweaker", permanent: true },
      { source: "/tweaks/:slug", destination: "/tweaker?tweak=:slug", permanent: true },
    ];
  },
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
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/icon.svg",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Service Worker обязан проверяться на свежесть при каждой загрузке.
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Service-Worker-Allowed",
            value: "/",
          },
        ],
      },
      {
        source: "/:manifest(manifest.json|manifest.webmanifest)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
          { key: "Content-Type", value: "application/manifest+json; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
