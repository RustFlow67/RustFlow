import type { NextRequest } from "next/server";
import { accountFor, authHandler, authJson, authOrigin, sessionView } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return authHandler(async () => {
    const origin = authOrigin(request);
    return authJson(await sessionView(await accountFor(request, origin), origin));
  });
}
