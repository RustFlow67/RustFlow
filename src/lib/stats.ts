import { db } from "@/db";
import { benchmarks, tweakStats, tweakVotes } from "@/db/schema";
import { and, count, desc, eq, lt, sql } from "drizzle-orm";

let ready: Promise<void> | null = null;

/**
 * Safety net: creates the tables if a fresh database has not been pushed yet.
 * The DDL mirrors src/db/schema.ts exactly.
 */
export function ensureTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await db.execute(sql`
        create table if not exists tweak_stats (
          slug varchar(64) primary key,
          downloads integer not null default 0
        )`);
      await db.execute(sql`
        create table if not exists tweak_votes (
          id serial primary key,
          slug varchar(64) not null,
          voter varchar(64) not null,
          created_at timestamp with time zone not null default now()
        )`);
      await db.execute(sql`
        create unique index if not exists tweak_votes_slug_voter_idx
        on tweak_votes (slug, voter)`);
      await db.execute(sql`
        create table if not exists benchmarks (
          id serial primary key,
          cpu_id varchar(64) not null,
          gpu_id varchar(64) not null,
          ram_gb integer not null,
          storage varchar(16) not null,
          resolution varchar(16) not null,
          score integer not null,
          tier varchar(4) not null,
          fps_avg integer not null,
          fps_low integer not null,
          created_at timestamp with time zone not null default now()
        )`);
    })().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

export interface TweakCounters {
  downloads: number;
  likes: number;
}

export const PACK_SLUG = "_pack";

/** Counters for every tweak. Never throws: the catalogue must render without the DB. */
export async function getAllCounters(): Promise<Record<string, TweakCounters>> {
  const result: Record<string, TweakCounters> = {};
  try {
    await ensureTables();
    const [downloads, likes] = await Promise.all([
      db.select().from(tweakStats),
      db.select({ slug: tweakVotes.slug, likes: count() }).from(tweakVotes).groupBy(tweakVotes.slug),
    ]);
    for (const row of downloads) result[row.slug] = { downloads: row.downloads, likes: 0 };
    for (const row of likes) {
      result[row.slug] = { downloads: result[row.slug]?.downloads ?? 0, likes: Number(row.likes) };
    }
  } catch (error) {
    console.error("getAllCounters failed", error);
  }
  return result;
}

export async function getCounters(
  slug: string,
  voter?: string,
): Promise<TweakCounters & { liked: boolean }> {
  try {
    await ensureTables();
    const [stat] = await db.select().from(tweakStats).where(eq(tweakStats.slug, slug));
    const [votes] = await db.select({ n: count() }).from(tweakVotes).where(eq(tweakVotes.slug, slug));
    let liked = false;
    if (voter) {
      const mine = await db
        .select({ id: tweakVotes.id })
        .from(tweakVotes)
        .where(and(eq(tweakVotes.slug, slug), eq(tweakVotes.voter, voter)))
        .limit(1);
      liked = mine.length > 0;
    }
    return { downloads: stat?.downloads ?? 0, likes: Number(votes?.n ?? 0), liked };
  } catch (error) {
    console.error("getCounters failed", error);
    return { downloads: 0, likes: 0, liked: false };
  }
}

export async function addDownload(slug: string): Promise<void> {
  await ensureTables();
  await db
    .insert(tweakStats)
    .values({ slug, downloads: 1 })
    .onConflictDoUpdate({
      target: tweakStats.slug,
      set: { downloads: sql`${tweakStats.downloads} + 1` },
    });
}

export async function toggleVote(slug: string, voter: string): Promise<{ likes: number; liked: boolean }> {
  await ensureTables();
  const removed = await db
    .delete(tweakVotes)
    .where(and(eq(tweakVotes.slug, slug), eq(tweakVotes.voter, voter)))
    .returning({ id: tweakVotes.id });
  let liked = false;
  if (removed.length === 0) {
    await db.insert(tweakVotes).values({ slug, voter }).onConflictDoNothing();
    liked = true;
  }
  const [votes] = await db.select({ n: count() }).from(tweakVotes).where(eq(tweakVotes.slug, slug));
  return { likes: Number(votes?.n ?? 0), liked };
}

export interface Totals {
  downloads: number;
  benchmarks: number;
  likes: number;
}

export async function getTotals(): Promise<Totals> {
  try {
    await ensureTables();
    const [[d], [b], [l]] = await Promise.all([
      db.select({ n: sql<number>`coalesce(sum(${tweakStats.downloads}), 0)` }).from(tweakStats),
      db.select({ n: count() }).from(benchmarks),
      db.select({ n: count() }).from(tweakVotes),
    ]);
    return { downloads: Number(d?.n ?? 0), benchmarks: Number(b?.n ?? 0), likes: Number(l?.n ?? 0) };
  } catch (error) {
    console.error("getTotals failed", error);
    return { downloads: 0, benchmarks: 0, likes: 0 };
  }
}

export interface BenchmarkRow {
  id: number;
  cpuId: string;
  gpuId: string;
  ramGb: number;
  storage: string;
  resolution: string;
  score: number;
  tier: string;
  fpsAvg: number;
  fpsLow: number;
  createdAt: string;
}

export async function saveBenchmark(row: Omit<BenchmarkRow, "id" | "createdAt">): Promise<number> {
  await ensureTables();
  const [saved] = await db.insert(benchmarks).values(row).returning({ id: benchmarks.id });
  return saved.id;
}

export async function getRecentBenchmarks(limit = 8): Promise<BenchmarkRow[]> {
  try {
    await ensureTables();
    const rows = await db.select().from(benchmarks).orderBy(desc(benchmarks.id)).limit(limit);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  } catch (error) {
    console.error("getRecentBenchmarks failed", error);
    return [];
  }
}

/** Share of saved ratings with a lower score, plus the total number of ratings. */
export async function getStanding(score: number): Promise<{ total: number; below: number; average: number }> {
  try {
    await ensureTables();
    const [[all], [below]] = await Promise.all([
      db
        .select({ n: count(), avg: sql<number>`coalesce(avg(${benchmarks.score}), 0)` })
        .from(benchmarks),
      db.select({ n: count() }).from(benchmarks).where(lt(benchmarks.score, score)),
    ]);
    return {
      total: Number(all?.n ?? 0),
      below: Number(below?.n ?? 0),
      average: Math.round(Number(all?.avg ?? 0)),
    };
  } catch (error) {
    console.error("getStanding failed", error);
    return { total: 0, below: 0, average: 0 };
  }
}
