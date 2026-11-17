import { toRecentItem } from "@/lib/benchmark-view";
import { evaluate, type EvalInput, type ResolutionId, type StorageId } from "@/lib/hardware";
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
  const input: EvalInput = {
    cpuId: String(payload?.cpuId ?? ""),
    gpuId: String(payload?.gpuId ?? ""),
    ram: Number(payload?.ram),
    storage: String(payload?.storage ?? "") as StorageId,
    resolution: String(payload?.resolution ?? "") as ResolutionId,
  };

  const result = evaluate(input);
  if (!result) {
    return Response.json({ error: "Выберите процессор и видеокарту из списка" }, { status: 400 });
  }

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
