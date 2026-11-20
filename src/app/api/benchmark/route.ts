import { defaultMemoryKit, requiredMemory } from "@/lib/models/build-settings";
import { readPlaySettings } from "@/lib/models/play-settings";
import { toRecentItem } from "@/lib/benchmark-view";
import { RAM_OPTIONS, type StorageId, type TierId } from "@/lib/hardware";
import { evaluateBuild10, type BuildInput, type BreakdownKey } from "@/lib/models/build";
import { getRecentBenchmarks, getStanding, saveBenchmark } from "@/lib/stats";

export const dynamic = "force-dynamic";

export async function GET() {
  const recent = await getRecentBenchmarks(8);
  return Response.json({ recent: recent.map(toRecentItem) });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Некорректный запрос" }, { status: 400 });
  }

  // The score is always recomputed on the server from hardware ids.
  const play = readPlaySettings(key => payload?.[key]);
  if (!play) return Response.json({ error: "Некорректные параметры игры" }, { status: 400 });
  const kit = defaultMemoryKit(requiredMemory(String(payload?.cpuId)) ?? (payload?.memoryType === "DDR5" ? "DDR5" : "DDR4"));
  const input = {
    ...play, graphicsProfile: payload?.graphicsProfile as BuildInput["graphicsProfile"],
    cpuId: String(payload?.cpuId ?? ""),
    gpuId: String(payload?.gpuId ?? ""),
    ram: Number(payload?.ram),
    storage: String(payload?.storage ?? "") as StorageId,
    nvmeGen: payload?.nvmeGen as BuildInput["nvmeGen"], diskCache: payload?.diskCache as BuildInput["diskCache"], diskFill: payload?.diskFill as BuildInput["diskFill"],
    resolution: String(payload?.resolution ?? "") as BuildInput["resolution"],
    customResolution: payload?.customResolution as BuildInput["customResolution"],
    ramMhz: (payload?.ramMhz ?? kit.ramMhz) as number,
    ramCl: (payload?.ramCl ?? kit.ramCl) as number,
    memoryType: payload?.memoryType as BuildInput["memoryType"],
    windowsVersion: payload?.windowsVersion as BuildInput["windowsVersion"],
    biosProfile: payload?.biosProfile as BuildInput["biosProfile"],
    monitorHz: payload?.monitorHz as BuildInput["monitorHz"],
    connection: payload?.connection as BuildInput["connection"],
  };

  const estimate = (RAM_OPTIONS as readonly number[]).includes(input.ram) && Number.isInteger(input.ramMhz) && Number.isInteger(input.ramCl)
    && evaluateBuild10({ ...input, name: "Сборка", ramGb: input.ram });
  if (!estimate) return Response.json({ error: "Проверьте конфигурацию сборки" }, { status: 400 });
  const score = Math.round(estimate.score10 * 10);
  const tier: TierId = score >= 85 ? "S" : score >= 70 ? "A" : score >= 55 ? "B" : score >= 40 ? "C" : "D";
  const points = (key: BreakdownKey) => Math.round((estimate.breakdown.find((x) => x.key === key)?.score ?? 0) * 10);
  const result = {
    score, tier, parts: { cpu: points("cpuSingle"), gpu: points("gpuTier"), ram: points("ramLatency"), storage: points("ssdRandom") },
    fps: estimate.fpsByPreset, bottleneck: estimate.bottleneck, preset: estimate.recommendedPreset, vendor: estimate.vendor,
    tweaks: estimate.recommendations.map((t) => t.slug), notes: estimate.notes, cpuName: estimate.cpuName, gpuName: estimate.gpuName,
  };

  let id: number | null = null;
  try {
    id = await saveBenchmark({
      cpuId: input.cpuId,
      gpuId: input.gpuId,
      ramGb: input.ram,
      storage: input.storage,
      resolution: input.resolution,
      score: result.score,
      tier: result.tier,
      fpsAvg: result.fps[result.preset].avg,
      fpsLow: result.fps[result.preset].low,
    });
  } catch (error) {
    console.error("saveBenchmark failed", error);
  }

  const [standing, recent] = await Promise.all([getStanding(result.score), getRecentBenchmarks(8)]);

  return Response.json({
    id,
    saved: id !== null,
    result,
    standing,
    recent: recent.map(toRecentItem),
  });
}
