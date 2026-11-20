import { IS_DESKTOP_APP } from "./config";
import type { BuildInput } from "./models/build";
import type { WindowsVersion } from "./models/build-settings";

/** The host will supply its edition. Until then, never guess 10 or 11. */
export function planWindows(edition?: WindowsVersion) {
  return edition ? `Windows ${edition}` : IS_DESKTOP_APP ? null : "Версия Windows не указана";
}

/** Never overwrite an explicit edition (including another PC in a preview). */
export function withHostWindows(input: BuildInput, hostWindows?: WindowsVersion): BuildInput {
  return !input.windowsVersion && hostWindows ? { ...input, windowsVersion: hostWindows } : input;
}
