import { integer, pgTable, serial, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

/** Real download counters per tweak (and for the ZIP pack under the "_pack" slug). */
export const tweakStats = pgTable("tweak_stats", {
  slug: varchar("slug", { length: 64 }).primaryKey(),
  downloads: integer("downloads").notNull().default(0),
});

/** "Helped me" votes. One vote per anonymous visitor id per tweak. */
export const tweakVotes = pgTable(
  "tweak_votes",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 64 }).notNull(),
    voter: varchar("voter", { length: 64 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("tweak_votes_slug_voter_idx").on(t.slug, t.voter)],
);

/** Saved PC ratings from the benchmark page. */
export const benchmarks = pgTable("benchmarks", {
  id: serial("id").primaryKey(),
  cpuId: varchar("cpu_id", { length: 64 }).notNull(),
  gpuId: varchar("gpu_id", { length: 64 }).notNull(),
  ramGb: integer("ram_gb").notNull(),
  storage: varchar("storage", { length: 16 }).notNull(),
  resolution: varchar("resolution", { length: 16 }).notNull(),
  score: integer("score").notNull(),
  tier: varchar("tier", { length: 4 }).notNull(),
  fpsAvg: integer("fps_avg").notNull(),
  fpsLow: integer("fps_low").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
