import type { NextRequest } from "next/server";
import { startSteam } from "@/lib/auth/steam";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return startSteam(request); }
