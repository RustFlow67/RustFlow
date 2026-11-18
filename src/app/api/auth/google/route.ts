import type { NextRequest } from "next/server";
import { startGoogle } from "@/lib/auth/google";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return startGoogle(request);
}
