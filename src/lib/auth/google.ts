import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { googleSettings } from "./google-config";
import { authJson, authOrigin, issueSession, NO_STORE, putCookie, secureCookieName } from "./server";

const jwks = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"), { timeoutDuration: 5500 });
const cookie = (origin: URL) => secureCookieName("rustflow-oauth", origin);
const random = () => randomBytes(32).toString("base64url");
const result = (origin: URL, status: string) => NextResponse.redirect(new URL(`/#profile=${status}`, origin), { status: 303, headers: NO_STORE });
const unavailable = () => authJson({ error: "Добавьте GOOGLE_CLIENT_ID и GOOGLE_CLIENT_SECRET в .env для входа через Google" }, 503);

function googleAvatar(input: unknown) {
  if (typeof input !== "string" || input.length > 512) return null;
  try {
    const url = new URL(input);
    return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com") && !url.username && !url.password && !url.port ? url.href : null;
  } catch { return null; }
}

export function startGoogle(request: NextRequest) {
  const origin = authOrigin(request);
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return authJson({ error: "Откройте окно профиля на сайте RustFlow." }, 403);
  const settings = googleSettings(origin);
  if (!settings) return unavailable();

  const state = random();
  const verifier = random();
  const nonce = random();
  const consent = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  consent.search = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: settings.redirectUri,
    response_type: "code",
    scope: "openid profile",
    prompt: "select_account",
    state,
    nonce,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  const response = NextResponse.redirect(consent, { status: 302, headers: NO_STORE });
  putCookie(response, cookie(origin), `${state}.${verifier}.${nonce}`, origin, 600);
  return response;
}

export async function finishGoogle(request: NextRequest) {
  const origin = authOrigin(request);
  if (!origin) return authJson({ error: "Для Google требуется HTTPS или локальный запуск." }, 403);
  const settings = googleSettings(origin);
  if (!settings) return unavailable();
  const failure = result(origin, "google-error");
  putCookie(failure, cookie(origin), "", origin, 0);
  const attempt = request.cookies.get(cookie(origin))?.value;
  const code = request.nextUrl.searchParams.get("code");
  if (!attempt || !/^[\w-]{43}\.[\w-]{43}\.[\w-]{43}$/.test(attempt) || !code || code.length > 2048) return failure;
  const [state, verifier, nonce] = attempt.split(".");
  if (state !== request.nextUrl.searchParams.get("state")) return failure;

  try {
    const token = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      body: new URLSearchParams({
        code, client_id: settings.clientId, client_secret: settings.secret, redirect_uri: settings.redirectUri,
        grant_type: "authorization_code", code_verifier: verifier,
      }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000),
    });
    if (!token.ok) return failure;
    const { id_token } = await token.json() as { id_token?: unknown };
    if (typeof id_token !== "string" || id_token.length > 12000) return failure;
    const { payload } = await jwtVerify(id_token, jwks, {
      algorithms: ["RS256"], issuer: ["https://accounts.google.com", "accounts.google.com"], audience: settings.clientId,
      requiredClaims: ["sub", "exp", "iat", "nonce"], maxTokenAge: "10 minutes", clockTolerance: "5 seconds",
    });
    if (payload.nonce !== nonce || !payload.sub || payload.sub.length > 255 ||
      ((payload.azp !== undefined || Array.isArray(payload.aud)) && payload.azp !== settings.clientId)) return failure;

    const name = typeof payload.name === "string" ? payload.name.replace(/[\p{C}]/gu, "").trim() : "";
    const displayName = Array.from(name).slice(0, 36).join("") || "Игрок Google";
    // A local login can look like an email but is not verified by Google.
    // Link only by the verified provider subject, never by a matching email.
    const avatarUrl = googleAvatar(payload.picture);
    const [user] = await getDb().insert(accounts).values({ googleSub: payload.sub, displayName, avatarUrl })
      .onConflictDoUpdate({ target: accounts.googleSub, set: { displayName, avatarUrl } }).returning({ id: accounts.id });
    const response = result(origin, "google-ok");
    putCookie(response, cookie(origin), "", origin, 0);
    return await issueSession(request, response, origin, user.id);
  } catch {
    return failure;
  }
}
