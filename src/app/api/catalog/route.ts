import { eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { catalogViews } from "@/db/schema";
import { clientAddress } from "@/lib/client-address";
import { guideGroups, faqGroups } from "@/lib/catalog/reading";
import { HARDWARE_PRESETS } from "@/lib/models/preset";
import type { Collection } from "@/lib/catalog/keys";

export const dynamic = "force-dynamic";
const keys = {
  presets: new Set(HARDWARE_PRESETS.map((p) => p.slug)),
  guide: new Set(guideGroups.flatMap((g) => g.entries.map((e) => e.key))),
  faq: new Set(faqGroups.flatMap((g) => g.entries.map((e) => e.key))),
};
// With no configured DB the live demo counts real opens for this server run.
const memory: Record<Collection, Map<string, number>> = { presets: new Map(), guide: new Map(), faq: new Map() };
const rate = new Map<string, number>();
let reset = 0;
function collection(req: Request) {
  const s = new URL(req.url).searchParams.get("section");
  return s && Object.hasOwn(keys, s) ? (s as Collection) : null;
}
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(req: Request) {
  const scope = collection(req);
  if (!scope) return json({}, 400);
  if (!process.env.DATABASE_URL) return json({ counts: Object.fromEntries(memory[scope]), period: "instance" });
  try {
    const rows = await getDb().select().from(catalogViews).where(eq(catalogViews.section, scope));
    return json({ counts: Object.fromEntries(rows.map((r) => [r.item, r.opens])), period: "all" });
  } catch {
    return json({}, 503);
  }
}
export async function POST(req: Request) {
  const scope = collection(req),
    item = new URL(req.url).searchParams.get("item");
  if (!scope || !item || !keys[scope].has(item)) return json({}, 400);
  if (req.headers.get("x-rustflow-open") !== "1" || req.headers.get("sec-fetch-site") === "cross-site")
    return json({}, 403);
  const now = Date.now();
  if (now >= reset) {
    rate.clear();
    reset = now + 60_000;
  }
  const address = clientAddress(req.headers),
    n = rate.get(address) ?? 0;
  if (n >= 120 || (!n && rate.size >= 4096)) return json({}, 429);
  rate.set(address, n + 1);
  if (!process.env.DATABASE_URL) {
    const opens = (memory[scope].get(item) ?? 0) + 1;
    memory[scope].set(item, opens);
    return json({ opens });
  }
  try {
    const [row] = await getDb()
      .insert(catalogViews)
      .values({ section: scope, item, opens: 1 })
      .onConflictDoUpdate({
        target: [catalogViews.section, catalogViews.item],
        set: { opens: sql`${catalogViews.opens} + 1` },
      })
      .returning({ opens: catalogViews.opens });
    return json(row);
  } catch {
    return json({}, 503);
  }
}
