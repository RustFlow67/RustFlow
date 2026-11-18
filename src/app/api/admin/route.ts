import { isAdminSession } from "@/lib/admin-session";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ admin: await isAdminSession() }, { headers: { "Cache-Control": "private, no-store" } });
}
