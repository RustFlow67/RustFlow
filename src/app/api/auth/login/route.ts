import type { NextRequest } from "next/server";
import { authHandler } from "@/lib/auth/server";
import { passwordSignIn } from "@/lib/auth/password";

export function POST(request: NextRequest) {
  return authHandler(() => passwordSignIn(request, "login"));
}
