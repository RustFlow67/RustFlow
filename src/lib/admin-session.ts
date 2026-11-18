import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { clientAddress } from "@/lib/client-address";
import { cookies, headers } from "next/headers";

const COOKIE = "rustflow-admin";
const SESSION_SECONDS = 8 * 60 * 60;
const TOKEN_FORMAT = /^[0-9a-f]{64}$/i;
const ATTEMPT_WINDOW = 60 * 60_000;
const ATTEMPTS_MAX = 5;
const shared = globalThis as typeof globalThis & { __rfAdminFailures?: Map<string, { count: number; until: number }> };
const failures = shared.__rfAdminFailures ??= new Map<string, { count: number; until: number }>();

function token() {
  const value = process.env.RUSTFLOW_ADMIN_TOKEN?.trim();
  return value && TOKEN_FORMAT.test(value) ? value : null;
}

export function hasAdminToken() {
  return token() !== null;
}

function signature(secret: string, session: string) {
  return createHmac("sha256", secret).update(`rustflow:admin-session:v1:${session}`).digest("hex");
}

function equal(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}

export async function isAdminSession() {
  const secret = token();
  if (!secret || !adminOrigin(await headers())) return false;
  const jar = await cookies();
  return [jar.get(COOKIE)?.value, jar.get(`__Host-${COOKIE}-embed`)?.value].some((value) => {
    if (!value || !/^\d{1,12}\.[0-9a-f]{32}\.[0-9a-f]{64}$/.test(value)) return false;
    const [expiration, nonce, mac] = value.split(".");
    return Number(expiration) > Math.floor(Date.now() / 1000) && equal(signature(secret, `${expiration}.${nonce}`), mac);
  });
}

// Next sets these headers on direct requests. A reverse proxy must overwrite
// them with the public host and scheme. Admin and cloud passwords travel only over TLS or loopback.
export function adminOrigin(req: Pick<Headers, "get">) {
  const host = (req.get("x-forwarded-host") ?? req.get("host"))?.split(",", 1)[0].trim();
  const proto = (req.get("x-forwarded-proto") ?? "http").split(",", 1)[0].trim();
  if (!host || (proto !== "https" && proto !== "http")) return null;
  try {
    const origin = new URL(`${proto}://${host}`);
    return proto === "https" || ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) ? origin : null;
  } catch { return null; }
}

function actionOrigin(req: Pick<Headers, "get">) {
  const origin = adminOrigin(req);
  return origin?.origin === req.get("origin") && req.get("sec-fetch-site") !== "cross-site" ? origin : null;
}

async function setSession(value: string, maxAge: number, origin: URL, embedded = false) {
  const jar = await cookies();
  embedded = embedded && origin.protocol === "https:";
  const options = { httpOnly: true, secure: origin.protocol === "https:", path: "/", maxAge,
    ...(maxAge === 0 ? { expires: new Date(0) } : {}) };
  if (!embedded || !value) jar.set(COOKIE, value, { ...options, sameSite: "strict" });
  if ((embedded || !value) && options.secure) {
    jar.set(`__Host-${COOKIE}-embed`, value, { ...options, sameSite: "none", partitioned: true });
  }
}

export async function startAdminSession(candidate: FormDataEntryValue | null) {
  const req = await headers(), origin = actionOrigin(req);
  if (!origin) return "connection";
  const secret = token();
  if (!secret) return "disabled";
  const ip = clientAddress(req), now = Date.now();
  const saved = failures.get(ip);
  const bucket = saved && saved.until > now ? saved : { count: 0, until: now + ATTEMPT_WINDOW };
  if (bucket.count >= ATTEMPTS_MAX) return "blocked";
  if (typeof candidate !== "string" || !TOKEN_FORMAT.test(candidate) || !equal(candidate, secret)) {
    if (failures.size >= 2048 && !failures.has(ip)) {
      for (const [key, value] of failures) if (value.until <= now) failures.delete(key);
      if (failures.size >= 2048) return "blocked";
    }
    bucket.count++;
    if (bucket.count === ATTEMPTS_MAX) bucket.until = now + ATTEMPT_WINDOW;
    failures.set(ip, bucket);
    return bucket.count >= ATTEMPTS_MAX ? "blocked" : "token";
  }
  failures.delete(ip);
  const expiration = Math.floor(now / 1000) + SESSION_SECONDS;
  const session = `${expiration}.${randomBytes(16).toString("hex")}`;
  await setSession(`${session}.${signature(secret, session)}`, SESSION_SECONDS, origin, req.get("x-rustflow-embedded") === "1");
  return null;
}

export async function endAdminSession() {
  const origin = actionOrigin(await headers());
  if (!origin) return false;
  await setSession("", 0, origin);
  return true;
}
