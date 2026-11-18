import type { NextRequest } from "next/server";
import { buildPack } from "@/lib/pack";
import { getGraphicsProfile } from "@/lib/graphics-profiles";
import { isPackRam, isPlanVram, isRecommendedTweak, isTweakerVendor } from "@/lib/tweaker";
import { getConnectionProfile, parseMonitorHz } from "@/lib/models/build-settings";
import { accountFor, AuthError, authHandler, authOrigin, authJson, NO_STORE } from "@/lib/auth/server";
import { TWEAKS_LITE } from "@/lib/tweaks";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return authHandler(async () => {
    if (!await accountFor(request, authOrigin(request))) {
      throw new AuthError(401, "Доступно после входа в профиль.");
    }
    return respondWithPack(request);
  });
}

function respondWithPack(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const raw = q.get("tweaks");
  const hasSelection = raw !== null;
  const mode = getGraphicsProfile(q.get("mode") ?? q.get("preset") ?? "balanced");
  const gpu = q.get("gpu") ?? (hasSelection ? "" : "nvidia");
  const ram = Number(q.get("ram") ?? 16);
  const vram = q.has("vram") ? Number(q.get("vram")) : undefined;
  const monitorHz = parseMonitorHz(q.get("hz"));
  const connection = getConnectionProfile(q.get("net"));
  if ((q.has("hz") && !monitorHz) || (q.has("net") && !connection)) {
    return authJson({ error: "Проверьте герцовку монитора и профиль сети." }, 400);
  }
  const tuning = { monitorHz, connection: connection?.value };
  if ((vram !== undefined && !isPlanVram(vram)) || !mode || !isTweakerVendor(gpu) || !isPackRam(ram) || (raw?.length ?? 0) > 2400) {
    return authJson({ error: "Некорректные параметры пакета." }, 400);
  }
  const slugs = hasSelection ? (raw ? raw.split(",") : []) : TWEAKS_LITE.filter((t) => isRecommendedTweak(t, gpu)).map((t) => t.slug);
  if (slugs.length > TWEAKS_LITE.length || slugs.some((slug) => !/^[a-z0-9-]{1,64}$/.test(slug))) {
    return authJson({ error: "Некорректный список твиков." }, 400);
  }
  const zip = buildPack({ slugs, mode: mode.id, gpu, ram, vram, tuning });
  if (!zip) return authJson({ error: "Некоторые твики недоступны для этого пакета." }, 400);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="RustFlow-Pack-${mode.id}.zip"`,
      "Content-Length": String(zip.length),
      ...NO_STORE,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
