import "server-only";
import { packEntries } from "./pack-entries";
import { createZip } from "./zip";

export function buildPack(options: Parameters<typeof packEntries>[0]): Buffer | null {
  const entries = packEntries(options);
  return entries && createZip(entries.map(({ name, data }) => ({ name, data: Buffer.from(data) })), { includeDirs: true });
}
