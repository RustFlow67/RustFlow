import { zipSync, type Zippable } from "fflate";
import { packEntries } from "./pack-entries";

/** For device profiles only. Same public files/config as the server ZIP. */
export function localPack(options: Parameters<typeof packEntries>[0]) {
  const entries = packEntries(options);
  if (!entries) return null;
  const files: Zippable = {};
  for (const { name, data } of entries) {
    const parts = name.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = `${parts.slice(0, i).join("/")}/`;
      files[dir] ??= [new Uint8Array(), { level: 0, os: 3, attrs: (0o40755 << 16) | 0x10 }];
    }
    files[name] = [data, { os: 3, attrs: 0o100644 << 16 }];
  }
  return zipSync(files, { level: 3 });
}
