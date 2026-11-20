import { IS_DESKTOP_APP } from "../lib/config";
import type { GraphicsProfileId } from "../lib/graphics-profiles";
import type { FamilyId } from "../lib/drivers";
import type { ConfigTuning, WindowsVersion } from "../lib/models/build-settings";
import type { TweakerVendor } from "../lib/tweaker";

/** Data only: no caller-supplied executable, path to overwrite, command or download URL. */
export type TweakPlan =
  | { kind: "cfg"; cfg: string }
  | {
      kind: "pack";
      cfg: string;
      slugs: readonly string[];
      mode: GraphicsProfileId;
      gpu: TweakerVendor;
      ram: number;
      vram?: number;
      tuning: ConfigTuning;
    };
export type DriverSelection = { family: FamilyId; model: string };
export type SystemResult<T = void> =
  | { status: "ok"; value: T }
  | { status: "unavailable" | "cancelled" | "failed" };

/** A future Tauri adapter or isolated Electron preload implements this narrow
 * contract. The host verifies the actual OS/device, allowed steps and cfg,
 * asks for any necessary consent and records a restorable backup BEFORE
 * applying. Return ok only after completion, never on dispatch to the host. */
export interface SystemBridge {
  findRustDirectory(): Promise<SystemResult<string>>;
  backupClientCfg(): Promise<SystemResult<{ backupId: string }>>;
  readHardware(): Promise<SystemResult<{ cpu: string; gpu: string; ramGb: number; vramGb?: number }>>;
  readOperatingSystem(): Promise<SystemResult<{ name: string; windowsVersion?: WindowsVersion }>>;
  applyTweaks(plan: TweakPlan): Promise<SystemResult>;
  rollbackChanges(): Promise<SystemResult>; // Restore the last applied transaction on this machine.
  installCleanDriver(device: DriverSelection): Promise<SystemResult>;
}

declare global {
  interface Window {
    rustflowSystem?: SystemBridge;
  }
}
const unavailable = async () => ({ status: "unavailable" }) as const;
const stub: SystemBridge = {
  findRustDirectory: unavailable,
  backupClientCfg: unavailable,
  readHardware: unavailable,
  readOperatingSystem: unavailable,
  applyTweaks: unavailable,
  rollbackChanges: unavailable,
  installCleanDriver: unavailable,
};

/** SSR, web and desktop without a host are all side-effect free. */
export function getSystemBridge(): SystemBridge {
  return IS_DESKTOP_APP && typeof window !== "undefined" ? (window.rustflowSystem ?? stub) : stub;
}
