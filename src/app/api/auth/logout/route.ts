import type { NextRequest } from "next/server";
import { endAdminSession } from "@/lib/admin-session";
import { authHandler, authJson, requireSameOrigin, revokeSession, sessionView } from "@/lib/auth/server";

export function POST(request: NextRequest) {
  return authHandler(async () => {
    const origin = requireSameOrigin(request);
    const response = authJson({ ...await sessionView(null, origin), admin: false });
    await revokeSession(request, response, origin);
    await endAdminSession();
    return response;
  });
}
