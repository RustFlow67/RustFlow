import type { NextRequest } from "next/server";
import { finishSteam } from "@/lib/auth/steam";
export const dynamic = "force-dynamic";
export function GET(request: NextRequest) { return finishSteam(request); }
