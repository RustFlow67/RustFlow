import { invoke, isTauri } from "@tauri-apps/api/core";
import { IS_DESKTOP_APP } from "../lib/config";
import type { GraphicsProfileId } from "../lib/graphics-profiles";
import type { FamilyId } from "../lib/drivers";
import type { ConfigTuning, WindowsVersion } from "../lib/models/build-settings";
import type { TweakerVendor } from "../lib/tweaker";

/** Данные для применения твиков без передачи произвольных команд или путей. */
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
      execution?: "export" | "native";
    };

export type DriverSelection = {
  family: FamilyId;
  model: string;
  installerPath?: string;
};

export type SupportLinkKind =
  | "ddu"
  | "nvidia"
  | "radeon"
  | "arc"
  | "nvcleanstall"
  | "realtek"
  | "ethernet"
  | "am4am5"
  | "intelboard";

/** Строгий типизированный результат вызова нативного моста. */
export type SystemResult<T = void> =
  | { status: "ok"; value: T }
  | { status: "error"; message: string; code?: string }
  | { status: "unavailable" }
  | { status: "cancelled" }
  | { status: "failed" };

export interface RustInstallPaths {
  steamDir: string;
  rustDir: string;
  cfgDir: string;
  clientCfgPath: string;
  keysCfgPath: string;
  clientCfgExists: boolean;
  keysCfgExists: boolean;
  isRustRunning: boolean;
}

export interface CommandOutcome {
  commandId: string;
  title: string;
  applied: boolean;
  changedCount: number;
  message: string;
  backupId?: string | null;
  requiresReboot: boolean;
}

export interface BatchExecutionReport {
  backupId: string;
  outcomes: CommandOutcome[];
  totalChanged: number;
  requiresReboot: boolean;
  message: string;
}

export interface RestoreReport {
  backupId: string;
  restoredCfgFiles: number;
  restoredRegistryValues: number;
  restoredPowerPlan: boolean;
  message: string;
}

export interface BackupSummary {
  backupId: string;
  createdAtUnix: number;
  label: string;
  cfgCount: number;
  registryCount: number;
  hasPowerPlan: boolean;
  restored: boolean;
  folderPath: string;
}

export interface DetectedInstaller {
  fileName: string;
  fullPath: string;
  sizeBytes: number;
  kind: string;
}

export type HardwareProfile = {
  cpu: string;
  cpuCores?: number;
  cpuThreads?: number;
  gpu: string;
  ramGb: number;
  ramMhz?: number;
  storage?: "nvme" | "sata" | "hdd" | null;
  vramGb?: number;
};

export type OsProfile = {
  name: string;
  windowsVersion?: WindowsVersion;
};

/** Узкий контракт взаимодействия фронтенда с нативным Rust-бэкендом. */
export interface SystemBridge {
  findRustDirectory(): Promise<SystemResult<string>>;
  backupClientCfg(): Promise<SystemResult<{ backupId: string }>>;
  readHardware(): Promise<SystemResult<HardwareProfile>>;
  readOperatingSystem(): Promise<SystemResult<OsProfile>>;
  applyTweaks(plan: TweakPlan): Promise<SystemResult<CommandOutcome | BatchExecutionReport | void>>;
  rollbackChanges(backupId?: string): Promise<SystemResult<RestoreReport | void>>;
  installCleanDriver(device: DriverSelection): Promise<SystemResult<CommandOutcome | void>>;
  openOfficialSupport?(kind: SupportLinkKind): Promise<SystemResult<CommandOutcome | void>>;
  executeTweakPlan?(plan: Extract<TweakPlan, { kind: "pack" }>): Promise<SystemResult<BatchExecutionReport>>;
  locateSteamRust?(customDir?: string): Promise<SystemResult<RustInstallPaths>>;
  listBackups?(): Promise<SystemResult<BackupSummary[]>>;
  findDriverInstallers?(family?: FamilyId): Promise<SystemResult<DetectedInstaller[]>>;
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

function normalizeInvokeError(err: unknown): SystemResult<never> {
  const raw =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : "Неизвестная ошибка системного модуля.";
  if (raw.startsWith("UAC_CANCELLED:")) {
    return { status: "cancelled" };
  }
  return { status: "error", message: raw };
}

type WindowsInfo = HardwareProfile & {
  name: string;
  windowsVersion: WindowsVersion;
};

/**
 * `readHardware` and `readOperatingSystem` share one native command. Components
 * mount together (calculator + plan strip) and used to fire the identical
 * `invoke()` twice per mount. Deduplicate in-flight calls and cache the
 * settled result briefly so a remount within the window costs no IPC.
 */
let windowsInfoInflight: Promise<SystemResult<WindowsInfo>> | null = null;
let windowsInfoCache: { at: number; result: SystemResult<WindowsInfo> } | null = null;
const WINDOWS_INFO_TTL_MS = 30_000;

function windowsInfo(): Promise<SystemResult<WindowsInfo>> {
  const now = Date.now();
  if (windowsInfoCache && now - windowsInfoCache.at < WINDOWS_INFO_TTL_MS) {
    return Promise.resolve(windowsInfoCache.result);
  }
  if (windowsInfoInflight) return windowsInfoInflight;
  windowsInfoInflight = (async (): Promise<SystemResult<WindowsInfo>> => {
    try {
      return { status: "ok", value: await invoke<WindowsInfo>("read_windows_info") };
    } catch {
      return { status: "unavailable" };
    }
  })().then((result) => {
    windowsInfoCache = { at: Date.now(), result };
    windowsInfoInflight = null;
    return result;
  });
  return windowsInfoInflight;
}

async function runNativePack(
  plan: Extract<TweakPlan, { kind: "pack" }>,
): Promise<SystemResult<BatchExecutionReport>> {
  if (
    !window.confirm(
      "Применить выбранные настройки в игру и Windows? Перед изменением будет создан снимок client.cfg и веток реестра в %AppData%/RustFlow/backups.",
    )
  ) {
    return { status: "cancelled" };
  }
  try {
    const report = await invoke<BatchExecutionReport>("execute_tweak_plan", {
      plan: {
        cfg: plan.cfg,
        slugs: [...plan.slugs],
        windowsVersion: plan.tuning.windowsVersion,
      },
    });
    return { status: "ok", value: report };
  } catch (err) {
    return normalizeInvokeError(err);
  }
}

const tauriBridge: SystemBridge = {
  findRustDirectory: async () => {
    try {
      return { status: "ok", value: await invoke<string>("find_rust_directory") };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
  backupClientCfg: async () => {
    try {
      const created = await invoke<{ backupId: string; folderPath: string }>("backup_client_cfg");
      return { status: "ok", value: { backupId: created.backupId } };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
  readHardware: windowsInfo,
  readOperatingSystem: windowsInfo,
  applyTweaks: async (plan) => {
    if (plan.kind === "pack") {
      if (plan.execution === "native") {
        return runNativePack(plan);
      }
      if (
        !window.confirm(
          "Сохранить пакет скриптов и инструкции на Рабочем столе? Твики не будут запущены автоматически.",
        )
      ) {
        return { status: "cancelled" };
      }
      try {
        const { packEntries } = await import("@/lib/pack-entries");
        const entries = packEntries(plan);
        if (!entries) {
          return { status: "error", message: "Не удалось сформировать файлы пакета." };
        }
        const files = entries.map(({ name, data }) => ({ name, data: Array.from(data) }));
        const result = await invoke<{ opened: boolean }>("save_tweak_pack", { files });
        return result.opened
          ? { status: "ok", value: undefined }
          : {
              status: "error",
              message: "Пакет создан, но не удалось автоматически открыть Проводник.",
            };
      } catch (err) {
        return normalizeInvokeError(err);
      }
    }

    if (
      !window.confirm(
        "Обновить Rust/cfg/client.cfg? Перед записью будет создан снимок в %AppData%/RustFlow/backups. Закройте Rust перед продолжением.",
      )
    ) {
      return { status: "cancelled" };
    }
    try {
      const outcome = await invoke<CommandOutcome>("apply_client_cfg", { cfg: plan.cfg });
      return { status: "ok", value: outcome };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
  executeTweakPlan: runNativePack,
  rollbackChanges: async (backupId) => {
    if (
      !window.confirm(
        "Откатить изменения из резервной копии %AppData%/RustFlow/backups (client.cfg, реестр, схема питания)?",
      )
    ) {
      return { status: "cancelled" };
    }
    try {
      const report = await invoke<RestoreReport>("rollback_changes", {
        backupId: backupId ?? null,
      });
      return { status: "ok", value: report };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
  installCleanDriver: async (device) => {
    const prompt = device.installerPath
      ? `Запустить скачанный установщик «${device.installerPath}» от имени администратора (UAC)?`
      : `Открыть официальную страницу загрузки драйвера для ${device.model}?`;
    if (!window.confirm(prompt)) {
      return { status: "cancelled" };
    }
    try {
      const outcome = await invoke<CommandOutcome>("run_driver_action", {
        family: device.family,
        installerPath: device.installerPath ?? null,
      });
      return { status: "ok", value: outcome };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
  openOfficialSupport: async (kind) => {
    try {
      const outcome = await invoke<CommandOutcome>("open_official_support", { kind });
      return { status: "ok", value: outcome };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
  locateSteamRust: async (customDir) => {
    try {
      const paths = await invoke<RustInstallPaths>("locate_steam_rust", {
        customDir: customDir ?? null,
      });
      return { status: "ok", value: paths };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
  listBackups: async () => {
    try {
      const items = await invoke<BackupSummary[]>("list_backups");
      return { status: "ok", value: items };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
  findDriverInstallers: async (family) => {
    try {
      const items = await invoke<DetectedInstaller[]>("find_driver_installers", {
        family: family ?? null,
      });
      return { status: "ok", value: items };
    } catch (err) {
      return normalizeInvokeError(err);
    }
  },
};

/**
 * Инициализирует `window.rustflowSystem` поверх Tauri `@tauri-apps/api/core` (`invoke`),
 * не перезаписывая внешний предзагруженный мост (например, Electron или Playwright-мок)
 * и не затрагивая обычный веб-режим.
 */
export function initSystemBridge(): SystemBridge {
  if (!IS_DESKTOP_APP || typeof window === "undefined") {
    return stub;
  }
  if (window.rustflowSystem) {
    return window.rustflowSystem;
  }
  if (isTauri()) {
    window.rustflowSystem = tauriBridge;
    return tauriBridge;
  }
  return stub;
}

/** Возвращает активный нативный мост для текущей среды (Tauri / внешний хост / веб-заглушка). */
export function getSystemBridge(): SystemBridge {
  if (!IS_DESKTOP_APP || typeof window === "undefined") {
    return stub;
  }
  return initSystemBridge();
}
