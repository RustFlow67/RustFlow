import type { NextRequest } from "next/server";
import { getTweak } from "@/lib/tweaks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tweak = getTweak(slug);
  const isRevert = request.nextUrl.searchParams.get("v") === "revert";
  const file = tweak ? (isRevert ? tweak.revert : tweak.file) : undefined;

  if (!tweak || !file) {
    return Response.json({ error: "Файл не найден" }, { status: 404 });
  }

  const normalized = file.content.replace(/\r?\n/g, "\r\n");
  const body = new TextEncoder().encode(normalized);

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "Content-Length": String(body.length),
      "Cache-Control": "no-store",
    },
  });
}

