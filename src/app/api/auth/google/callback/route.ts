import type { NextRequest } from "next/server";
import { finishGoogle } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return finishGoogle(request);
}
