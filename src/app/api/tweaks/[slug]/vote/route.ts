import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { toggleVote } from "@/lib/stats";
import { getTweak } from "@/lib/tweaks";

export const dynamic = "force-dynamic";

const COOKIE = "rf_uid";

export async function POST(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (!getTweak(slug)) {
    return Response.json({ error: "Твик не найден" }, { status: 404 });
  }

  const jar = await cookies();
  let voter = jar.get(COOKIE)?.value;
  if (!voter || !/^[a-f0-9-]{36}$/.test(voter)) {
    voter = randomUUID();
    jar.set(COOKIE, voter, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  try {
    const data = await toggleVote(slug, voter);
    return Response.json(data);
  } catch (error) {
    console.error("toggleVote failed", error);
    return Response.json({ error: "Не удалось сохранить голос" }, { status: 500 });
  }
}
