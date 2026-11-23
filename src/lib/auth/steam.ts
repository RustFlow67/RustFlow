import "server-only";
import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { accounts } from "@/db/schema";
import { steamOrigin } from "./steam-config";
import { authJson, authOrigin, issueSession, NO_STORE, putCookie, secureCookieName } from "./server";

const STEAM = "https://steamcommunity.com/openid/login";
const OPENID = "http://specs.openid.net/auth/2.0";
const cookie = (origin: URL) => secureCookieName("rustflow-steam", origin);
const result = (origin: URL, status: string) => NextResponse.redirect(new URL(`/#profile=steam-${status}`, origin), { status: 303, headers: NO_STORE });


export function startSteam(request: NextRequest) {
  const origin = steamOrigin(authOrigin(request));
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return authJson({ error: "Steam не настроен или адрес сайта не совпадает с NEXT_PUBLIC_SITE_URL." }, 503);
  const state = randomBytes(32).toString("hex");
  const callback = new URL("/api/auth/steam/callback", origin);
  callback.searchParams.set("state", state);
  const url = new URL(STEAM);
  url.search = new URLSearchParams({ "openid.ns": OPENID, "openid.mode": "checkid_setup",
    "openid.return_to": callback.href, "openid.realm": `${origin.origin}/`,
    "openid.identity": `${OPENID}/identifier_select`, "openid.claimed_id": `${OPENID}/identifier_select` }).toString();
  const response = NextResponse.redirect(url, { status: 302, headers: NO_STORE });
  putCookie(response, cookie(origin), state, origin, 600);
  return response;
}

export async function finishSteam(request: NextRequest) {
  const origin = steamOrigin(authOrigin(request));
  if (!origin) return authJson({ error: "Steam не настроен." }, 503);
  const failure = result(origin, "error");
  putCookie(failure, cookie(origin), "", origin, 0);
  const q = request.nextUrl.searchParams;
  const state = request.cookies.get(cookie(origin))?.value;
  // Reject duplicated parameters, oversized responses and unsigned critical fields.
  if (request.nextUrl.search.length > 8192 || [...q.keys()].some((k) => q.getAll(k).length !== 1) ||
      !state || !/^[a-f0-9]{64}$/.test(state) || q.get("state") !== state || q.get("openid.mode") !== "id_res" ||
      q.get("openid.ns") !== OPENID || q.get("openid.op_endpoint") !== STEAM) return failure;
  const callback = new URL("/api/auth/steam/callback", origin);
  callback.searchParams.set("state", state);
  const signed = new Set((q.get("openid.signed") || "").split(","));
  if (!["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce"].every((v) => signed.has(v)) || q.get("openid.return_to") !== callback.href) return failure;
  const claimed = q.get("openid.claimed_id") || "";
  const match = /^https:\/\/steamcommunity\.com\/openid\/id\/(7656119\d{10})$/.exec(claimed);
  if (!match || q.get("openid.identity") !== claimed) return failure;
  const nonce = q.get("openid.response_nonce") || "";
  const nonceTime = Date.parse(nonce.slice(0, 20));
  if (!Number.isFinite(nonceTime) || Math.abs(Date.now() - nonceTime) > 10 * 60_000) return failure;
  try {
    const body = new URLSearchParams();
    for (const [key, value] of q) if (key.startsWith("openid.")) body.set(key, value);
    body.set("openid.mode", "check_authentication");
    const verify = await fetch(STEAM, { method: "POST", body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!verify.ok || !(await verify.text()).split(/\r?\n/).includes("is_valid:true")) return failure;
    let displayName = `Steam ${match[1].slice(-6)}`;
    // Display data is optional; only the verified OpenID subject is an identity.
    try {
      const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
      url.search = new URLSearchParams({ key: process.env.STEAM_API_KEY!, steamids: match[1] }).toString();
      const r = await fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const data = await r.json() as { response?: { players?: { steamid?: string; personaname?: string }[] } };
        const player = data.response?.players?.[0];
        if (player?.steamid === match[1] && typeof player.personaname === "string") displayName = Array.from(player.personaname.replace(/[\p{C}]/gu, "").trim()).slice(0, 36).join("") || displayName;
      }
    } catch { /* Login remains possible if optional profile lookup fails. */ }
    const [user] = await getDb().insert(accounts).values({ steamSub: match[1], displayName })
      .onConflictDoUpdate({ target: accounts.steamSub, set: { displayName } }).returning({ id: accounts.id });
    const response = result(origin, "ok");
    putCookie(response, cookie(origin), "", origin, 0);
    return await issueSession(request, response, origin, user.id);
  } catch { return failure; }
}
