import { index, integer, jsonb, pgTable, serial, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import type { BuildInput } from "../lib/models/build";

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

/** Account identities are private, independent of public benchmark records. */
export const accounts = pgTable("rf_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  login: varchar("login", { length: 254 }).unique(),
  displayName: varchar("display_name", { length: 40 }).notNull(),
  passwordHash: varchar("password_hash", { length: 160 }),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  googleSub: varchar("google_sub", { length: 255 }).unique(),
  steamSub: varchar("steam_sub", { length: 20 }).unique(),
  activeBuild: jsonb("active_build").$type<BuildInput>(),
  favorites: jsonb("favorites").$type<{ tweak: string[]; preset: string[] }>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountSessions = pgTable("rf_account_sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  accountId: uuid("account_id").notNull().references(() => accounts.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [index("rf_account_sessions_account_idx").on(t.accountId)]);

/** Aggregate explicit opens only: no search strings, identities or PC details. */
export const catalogViews = pgTable("rf_catalog_views", {
  section: varchar("section", {length:16}).notNull(), item: varchar("item", {length:100}).notNull(), opens: integer("opens").notNull().default(0),
}, t => [uniqueIndex("rf_catalog_views_item_idx").on(t.section,t.item)]);
