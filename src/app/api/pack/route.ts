import type { NextRequest } from "next/server";
import { buildPack } from "@/lib/pack";
import { addDownload, PACK_SLUG } from "@/lib/stats";
import { PRESETS, PROFILES, type GpuVendor, type PresetId, type ProfileId } from "@/lib/tweaks/meta";

export const dynamic = "force-dynamic";

const VENDORS: GpuVendor[] = ["nvidia", "amd", "all"];

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const profile = (PROFILES.find((p) => p.id === q.get("profile"))?.id ?? "recommended") as ProfileId;
  const preset = (PRESETS.find((p) => p.id === q.get("preset"))?.id ?? "balanced") as PresetId;
  const gpu = (VENDORS.find((v) => v === q.get("gpu")) ?? "all") as GpuVendor;

  const { zip } = buildPack({ profile, preset, gpu });

  try {
    await addDownload(PACK_SLUG);
  } catch (error) {
    console.error("pack counter failed", error);
  }

  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="RustFlow-Pack-${profile}-${preset}.zip"`,
      "Content-Length": String(zip.length),
      "Cache-Control": "no-store",
    },
  });
}
