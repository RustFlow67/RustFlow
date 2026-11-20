import { invoke, isTauri } from "@tauri-apps/api/core";
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
  readHardware(): Promise<SystemResult<{ cpu: string; gpu: string; ramGb: number; ramMhz?: number; storage?: "nvme" | "sata" | "hdd" | null; vramGb?: number }>>;
  readOperatingSystem(): Promise<SystemResult<{ name: string; windowsVersion?: WindowsVersion }>>;
  applyTweaks(plan: TweakPlan): Promise<SystemResult>;
  rollbackChanges(): Promise<SystemResult>; // Restore the last applied transaction on this machine.
  installCleanDriver(device: DriverSelection): Promise<SystemResult>;
  openOfficialSupport?(kind: "ddu" | "nvidia" | "radeon" | "arc"): Promise<SystemResult>;
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

type WindowsInfo = { cpu: string; gpu: string; ramGb: number; ramMhz?: number; storage?: "nvme" | "sata" | "hdd" | null; name: string; windowsVersion: WindowsVersion };
async function windowsInfo(): Promise<SystemResult<WindowsInfo>> {
  try { return { status: "ok", value: await invoke<WindowsInfo>("read_windows_info") }; }
  catch { return { status: "unavailable" }; }
}
const tauriBridge: SystemBridge = {
  ...stub,
  findRustDirectory: async () => {
    try { return { status: "ok", value: await invoke<string>("find_rust_directory") }; }
    catch { return { status: "failed" }; }
  },
  applyTweaks: async (plan) => {
    if (plan.kind === "pack") {
      if (!window.confirm("Сохранить пакет скриптов и инструкции на Рабочем столе? Твики не будут запущены автоматически.")) return { status: "cancelled" };
      try {
        const { packEntries } = await import("@/lib/pack-entries");
        const entries = packEntries(plan);
        if (!entries) return { status: "failed" };
        const files = entries.map(({ name, data }) => ({ name, data: Array.from(data) }));
        const result = await invoke<{ opened: boolean }>("save_tweak_pack", { files });
        // The files can be saved even if Windows cannot open Explorer.
        return result.opened ? { status: "ok", value: undefined } : { status: "failed" };
      } catch { return { status: "failed" }; }
    }
    if (!window.confirm("Записать client.cfg? Перед изменением будет создана резервная копия. Закройте Rust перед продолжением.")) return { status: "cancelled" };
    try { await invoke("write_client_cfg", { cfg: plan.cfg }); return { status: "ok", value: undefined }; }
    catch { return { status: "failed" }; }
  },
  rollbackChanges: async () => {
    if (!window.confirm("Восстановить client.cfg из резервной копии?")) return { status: "cancelled" };
    try { await invoke("restore_client_cfg"); return { status: "ok", value: undefined }; }
    catch { return { status: "failed" }; }
  },
  openOfficialSupport: async (kind) => {
    try { await invoke("open_official_support", { kind }); return { status: "ok", value: undefined }; }
    catch { return { status: "failed" }; }
  },
  readHardware: windowsInfo,
  readOperatingSystem: windowsInfo,
};

/** SSR, web and desktop without a host are all side-effect free. */
export function getSystemBridge(): SystemBridge {
  return IS_DESKTOP_APP && typeof window !== "undefined" ? (window.rustflowSystem ?? (isTauri() ? tauriBridge : stub)) : stub;
}
