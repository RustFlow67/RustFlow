import { getCpu, getGpu } from "./hardware";
import type { BenchmarkRow } from "./stats";

/** Client-safe shape of a saved rating for the "recent ratings" list. */
export interface RecentItem {
  id: number;
  cpu: string;
  gpu: string;
  ramGb: number;
  resolution: string;
  score: number;
  tier: string;
  fpsAvg: number;
  createdAt: string;
}

export interface Standing {
  total: number;
  below: number;
  average: number;
}

export function toRecentItem(row: BenchmarkRow): RecentItem {
  return {
    id: row.id,
    cpu: getCpu(row.cpuId)?.name ?? row.cpuId,
    gpu: getGpu(row.gpuId)?.name ?? row.gpuId,
    ramGb: row.ramGb,
    resolution: row.resolution,
    score: row.score,
    tier: row.tier,
    fpsAvg: row.fpsAvg,
    createdAt: row.createdAt,
  };
}

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return "только что";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} дн назад`;
  return new Date(iso).toLocaleDateString("ru-RU");
}
