import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { profileBuild } from "@/lib/auth/profile-build";
import { accountFor, AuthError, authHandler, authJson, readAuthJson, requireSameOrigin, sessionView } from "@/lib/auth/server";

export function PUT(request: NextRequest) {
  return authHandler(async () => {
    const origin = requireSameOrigin(request);
    const user = await accountFor(request, origin);
    if (!user) throw new AuthError(401, "Для облачного сохранения войдите в аккаунт.");
    const body = await readAuthJson(request);
    // The submitted id is a stale-tab guard, never the owner for the write.
    if (body.expectedAccount !== user.id) throw new AuthError(409, "Аккаунт изменился. Снова откройте профиль.");
    const build = profileBuild(body.build);
    if (!build) throw new AuthError(400, "Проверьте параметры сборки.");
    await getDb().update(accounts).set({ activeBuild: build }).where(eq(accounts.id, user.id));
    return authJson(await sessionView({ ...user, build }, origin));
  });
}
