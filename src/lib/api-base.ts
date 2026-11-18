/** Public API prefix, injected by next.config.ts. Keep auth/OAuth on the UI origin. */
export function apiUrl(path: string): string {
  const base = process.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "") || "";
  const prefix = base.endsWith("/api") ? base : `${base}/api`;
  return `${prefix}/${path.replace(/^\/+/, "")}`;
}
