import "server-only";

import { isIP } from "node:net";

/** Use only the address supplied by the trusted ingress. Unknown peers share a bucket. */
export function clientAddress(headers: Pick<Headers, "get">) {
  const address = headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ?? "";
  if (isIP(address) === 4) return address;
  if (isIP(address) === 6 && !address.includes("%")) {
    // Canonicalize alternate representations of the same IPv6 address.
    const canonical = new URL(`http://[${address}]/`).hostname;
    const mapped = /^\[::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})\]$/.exec(canonical);
    if (mapped) {
      const [a, b] = mapped.slice(1).map((part) => parseInt(part, 16));
      return [a >> 8, a & 255, b >> 8, b & 255].join(".");
    }
    return canonical;
  }
  return "unknown";
}
