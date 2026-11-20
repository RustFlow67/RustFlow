import "server-only";

import { scrypt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { clientAddress } from "@/lib/client-address";
import { credentials, type PasswordMode } from "./credentials";
import { hashPassword, isBcryptDigest, verifyPassword } from "./password-digest";
import { AuthError, authJson, issueSession, readAuthJson, requireSameOrigin, sessionView } from "./server";

const DUMMY_HASH = "$2b$11$1DleFrL3Xzx22UgGwJ/q4eHnhnPtP64G2bBAUCGFAxUFT./ITYMsO";
const HASHING = { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 };
const buckets = new Map<string, { hits: number; expires: number }>();
let active = 0;

function limit(request: NextRequest, mode: PasswordMode) {
  const now = Date.now();
  if (buckets.size >= 2048) for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
  const key = `${mode}:${clientAddress(request.headers)}`;
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.expires) {
    if (!bucket && buckets.size >= 2048) throw new AuthError(429, "Слишком много запросов. Повторите позже.");
    bucket = { hits: 0, expires: now + (mode === "register" ? 60 : 5) * 60_000 };
    buckets.set(key, bucket);
  }
  if (active >= 3 || bucket.hits >= (mode === "register" ? 10 : 30)) {
    throw new AuthError(429, "Слишком много запросов. Повторите позже.");
  }
  bucket.hits++;
}

function verifyLegacy(password: string, digest: string) {
  const parts = /^scrypt1:([0-9a-f]{32}):([0-9a-f]{64})$/.exec(digest);
  if (!parts) return Promise.resolve(false);
  return new Promise<boolean>((resolve, reject) => {
    scrypt(password, Buffer.from(parts[1], "hex"), 32, HASHING, (error, key) =>
      error ? reject(error) : resolve(timingSafeEqual(key, Buffer.from(parts[2], "hex"))));
  });
}

export async function passwordSignIn(request: NextRequest, mode: PasswordMode) {
  const fields = await readAuthJson(request);
  // On public HTTP or in an opaque iframe the client probes without sending credentials.
  if (fields.deviceOnly === true) throw new AuthError(503, "Доступен профиль на этом устройстве.");
  const origin = requireSameOrigin(request);
  const parsed = credentials(fields, mode);
  if (parsed.error) throw new AuthError(400, parsed.error);
  const { login, password, name } = parsed;
  const db = getDb();
  limit(request, mode);
  active++;
  try {
    const columns = { id: accounts.id, registeredAt: accounts.createdAt, name: accounts.displayName, avatar: accounts.avatarUrl, build: accounts.activeBuild };
    let user;
    if (mode === "register") {
      const passwordHash = await hashPassword(password, 11);
      [user] = await db.insert(accounts).values({ login, displayName: name, passwordHash })
        .onConflictDoNothing({ target: accounts.login }).returning(columns);
      if (!user) throw new AuthError(409, "Этот логин уже занят. Войдите или выберите другой.");
    } else {
      const [record] = await db.select({ ...columns, hash: accounts.passwordHash }).from(accounts).where(eq(accounts.login, login)).limit(1);
      const digest = record?.hash;
      const legacy = digest?.startsWith("scrypt1:");
      const valid = legacy && digest ? await verifyLegacy(password, digest)
        : await verifyPassword(password, isBcryptDigest(digest) ? digest : DUMMY_HASH);
      if (!valid || !record || !digest || (!legacy && !isBcryptDigest(digest))) throw new AuthError(401, "Неверный логин или пароль.");
      if (legacy) await db.update(accounts).set({ passwordHash: await hashPassword(password, 11) }).where(eq(accounts.id, record.id));
      user = { id: record.id, registeredAt: record.registeredAt, name: record.name, avatar: record.avatar, build: record.build };
    }
    return await issueSession(request, authJson(await sessionView({ ...user, registeredAt: user.registeredAt.toISOString(), kind: "cloud" }, origin), mode === "register" ? 201 : 200), origin, user.id);
  } finally {
    active--;
  }
}
