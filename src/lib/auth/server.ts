import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { accounts, accountSessions } from "@/db/schema";
import { adminOrigin, isAdminSession } from "@/lib/admin-session";
import { googleSettings } from "./google-config";
import type { PlayerAccount, SessionView } from "./types";

export const NO_STORE = { "Cache-Control": "private, no-store" };
const LIFETIME = 14 * 24 * 60 * 60;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const BODY_MAX = 4096;

export class AuthError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
export const authJson = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: NO_STORE });

export async function authHandler(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    // Database drivers can include parameters in their errors. Don't return or log them.
    return error instanceof AuthError ? authJson({ error: error.message }, error.status)
      : authJson({ error: "Аккаунты временно недоступны. Проверьте подключение к PostgreSQL и схему базы данных." }, 503);
  }
}

export function authOrigin(request: NextRequest) {
  return adminOrigin(request.headers);
}

export function requireSameOrigin(request: NextRequest) {
  const origin = authOrigin(request);
  if (!origin || request.headers.get("origin") !== origin.origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AuthError(403, "Запрос входа должен происходить в открытом окне RustFlow.");
  }
  return origin;
}

export async function readAuthJson(request: NextRequest): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new AuthError(415, "Ожидается запрос JSON.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AuthError(400, "Пустой запрос.");
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > BODY_MAX) throw new AuthError(413, "Запрос слишком большой.");
      text += decoder.decode(value, { stream: true });
    }
    const fields: unknown = JSON.parse(text + decoder.decode());
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) throw new Error();
    return fields as Record<string, unknown>;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    throw new AuthError(400, "Некорректный запрос.");
  } finally {
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function secureCookieName(name: string, origin: URL) {
  return origin.protocol === "https:" ? `__Host-${name}` : name;
}

const embedded = (request: NextRequest, origin: URL) => origin.protocol === "https:" && request.headers.get("x-rustflow-embedded") === "1";
const cookieName = (origin: URL, partitioned = false) => secureCookieName(`rustflow-session${partitioned ? "-embed" : ""}`, origin);
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function sessionHash(request: NextRequest, origin: URL) {
  const token = request.cookies.get(cookieName(origin, embedded(request, origin)))?.value;
  return token && TOKEN_PATTERN.test(token) ? hashToken(token) : null;
}

export async function accountFor(request: NextRequest, origin: URL | null) {
  const token = origin && sessionHash(request, origin);
  if (!token) return null;
  const [row] = await getDb().select({ id: accounts.id, name: accounts.displayName, avatar: accounts.avatarUrl, build: accounts.activeBuild })
    .from(accountSessions).innerJoin(accounts, eq(accountSessions.accountId, accounts.id))
    .where(and(eq(accountSessions.tokenHash, token), gt(accountSessions.expiresAt, new Date()))).limit(1);
  return row ? { ...row, kind: "cloud" as const } : null;
}

export async function sessionView(user: PlayerAccount | null, origin: URL | null): Promise<SessionView> {
  return { user, admin: await isAdminSession(), googleEnabled: Boolean(googleSettings(origin)), secureOrigin: Boolean(origin) };
}

export function putCookie(response: NextResponse, name: string, value: string, origin: URL, maxAge: number, partitioned = false) {
  response.cookies.set(name, value, {
    httpOnly: true, sameSite: partitioned ? "none" : "lax", partitioned, secure: origin.protocol === "https:", path: "/", maxAge,
    // Next can normalize multiple Set-Cookie headers and drop a zero maxAge.
    ...(maxAge === 0 ? { expires: new Date(0) } : {}),
  });
}

export async function issueSession(request: NextRequest, response: NextResponse, origin: URL, id: string) {
  const token = randomBytes(32).toString("hex");
  const previous = sessionHash(request, origin);
  await getDb().transaction(async (tx) => {
    if (previous) await tx.delete(accountSessions).where(eq(accountSessions.tokenHash, previous));
    await tx.delete(accountSessions).where(and(eq(accountSessions.accountId, id), lte(accountSessions.expiresAt, new Date())));
    await tx.insert(accountSessions).values({ tokenHash: hashToken(token), accountId: id, expiresAt: new Date(Date.now() + LIFETIME * 1000) });
  });
  const partitioned = embedded(request, origin);
  putCookie(response, cookieName(origin, partitioned), token, origin, LIFETIME, partitioned);
  return response;
}

export async function revokeSession(request: NextRequest, response: NextResponse, origin: URL) {
  const token = sessionHash(request, origin);
  if (token) {
    // The browser must be able to sign out also when the database is unavailable.
    try { await getDb().delete(accountSessions).where(eq(accountSessions.tokenHash, token)); } catch { /* Session still expires server-side. */ }
  }
  const partitioned = embedded(request, origin);
  putCookie(response, cookieName(origin, partitioned), "", origin, 0, partitioned);
}
