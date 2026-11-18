import "server-only";

export function googleSettings(origin: URL | null) {
  const clientId = (process.env.VITE_GOOGLE_CLIENT_ID?.trim() || process.env.GOOGLE_CLIENT_ID?.trim());
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!origin || !clientId || !secret) return null;
  const redirectUri = new URL("/api/auth/google/callback", origin).href;
  // A configured callback pins OAuth to this deployment's public origin.
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (configured && configured !== redirectUri) return null;
  return { clientId, secret, redirectUri };
}
