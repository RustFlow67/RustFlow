import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// No DB is a supported mode for the calculator and browser-only profiles.
const shared = globalThis as typeof globalThis & { __rustFlowPgPool?: Pool };
let instance: ReturnType<typeof drizzle> | undefined;

export function getDb() {
  if (instance) return instance;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("Database not configured");
  const pool = shared.__rustFlowPgPool ??= new Pool({ connectionString, connectionTimeoutMillis: 2200, statement_timeout: 4000 });
  // Idle sockets can close when Postgres restarts. A request can retry without restarting Next.
  if (!pool.listenerCount("error")) pool.on("error", () => {});
  return instance = drizzle(pool);
}
