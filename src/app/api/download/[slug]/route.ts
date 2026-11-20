import type { NextRequest } from "next/server";
import { registryBackup } from "@/lib/tweaks/registry-backup";
import { getTweak, encodeFile } from "@/lib/tweaks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tweak = getTweak(slug);
  const variant = request.nextUrl.searchParams.get("v");
  const snapshot =
    tweak && (variant === "snapshot" || variant === "restore-snapshot") ? registryBackup(tweak) : null;
  const file =
    variant === null
      ? tweak?.file
      : variant === "revert"
        ? tweak?.revert
        : variant === "snapshot"
          ? snapshot?.save
          : variant === "restore-snapshot"
            ? snapshot?.restore
            : null;

  if (!tweak || !file) {
    return Response.json({ error: "Файл не найден" }, { status: 404 });
  }

  const body = encodeFile(file);

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.name}"`,
      "Content-Length": String(body.length),
      "Cache-Control": "no-store",
    },
  });
}
