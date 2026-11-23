import "server-only";

// Pin all redirects to the configured public origin rather than a Host header.
export function steamOrigin(origin: URL | null) {
  if (!origin || !process.env.DATABASE_URL?.trim() || !process.env.STEAM_API_KEY?.trim()) return null;
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_SITE_URL || "");
    return configured.origin === origin.origin && (configured.protocol === "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname)) ? origin : null;
  } catch { return null; }
}
