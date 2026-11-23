import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { readFavorites } from "@/lib/auth/favorites";
import { accountFor, AuthError, authHandler, authJson, authOrigin, readAuthJson, requireSameOrigin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";
export function GET(request: NextRequest) {
  return authHandler(async () => {
    const user = await accountFor(request, authOrigin(request));
    if (!user) throw new AuthError(401, "Войдите в аккаунт.");
    const [row] = await getDb().select({ favorites: accounts.favorites }).from(accounts).where(eq(accounts.id, user.id));
    return authJson({ accountId: user.id, favorites: readFavorites(row?.favorites) });
  });
}
export function PUT(request: NextRequest) {
  return authHandler(async () => {
    const origin = requireSameOrigin(request);
    const user = await accountFor(request, origin);
    if (!user) throw new AuthError(401, "Войдите в аккаунт.");
    const body = await readAuthJson(request);
    if (body.expectedAccount !== user.id) throw new AuthError(409, "Аккаунт изменился.");
    const favorites = readFavorites(body.favorites);
    if (!favorites) throw new AuthError(400, "Некорректный список избранного.");
    await getDb().update(accounts).set({ favorites }).where(eq(accounts.id, user.id));
    return authJson({ accountId: user.id, favorites });
  });
}
