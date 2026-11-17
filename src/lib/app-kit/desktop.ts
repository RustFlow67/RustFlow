export type AppKitGroup = "tauri" | "electron" | "cloud" | "deploy" | "guide";

export interface AppKitFile {
  /** Путь внутри архива (например, app-kit/tauri/src-tauri/src/lib.rs). */
  path: string;
  /** Короткое понятное название в интерфейсе. */
  title: string;
  /** Что делает этот файл и куда его положить. */
  description: string;
  group: AppKitGroup;
  language: string;
  content: string;
}

export const DESKTOP_KIT_FILES: AppKitFile[] = [
  {
    path: "app-kit/tauri/src-tauri/Cargo.toml",
    title: "Cargo.toml (Tauri v2 + Rust)",
    description:
      "Конфигурация Rust-проекта для нативного Windows-приложения (~8 МБ установщик). Скопируйте папку src-tauri в корень проекта сайта.",
    group: "tauri",
    language: "toml",
    content: `[package]
name = "rustflow"
version = "1.0.0"
description = "RustFlow — твикер, бенчмарк /10 и настройка системы для Rust"
authors = ["RustFlow"]
edition = "2021"
rust-version = "1.77.2"

[lib]
name = "rustflow_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
sysinfo = "0.32"

[profile.release]
panic = "abort"
codegen-units = 1
lto = true
opt-level = "s"
strip = true
`,
  },
  {
    path: "app-kit/tauri/src-tauri/build.rs",
    title: "build.rs",
    description: "Стандартный сборочный скрипт Tauri v2 (подключает манифест, иконку и ресурсы Windows).",
    group: "tauri",
    language: "rust",
    content: `fn main() {
    tauri_build::build()
}
`,
  },
  {
    path: "app-kit/tauri/src-tauri/tauri.conf.json",
    title: "tauri.conf.json",
    description:
      "Настройки окна Liquid Glass (1380x880), безопасности CSP и сборщика установщиков Windows NSIS (.exe) и MSI.",
    group: "tauri",
    language: "json",
    content: `{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "RustFlow",
  "version": "1.0.0",
  "identifier": "app.rustflow.desktop",
  "build": {
    "beforeDevCommand": "npm run dev",
    "devUrl": "http://localhost:3000",
    "beforeBuildCommand": "npm run build:desktop",
    "frontendDist": "../out"
  },
  "app": {
    "windows": [
      {
        "title": "RustFlow — Твикер и Бенчмарк для Rust",
        "width": 1380,
        "height": 880,
        "minWidth": 960,
        "minHeight": 640,
        "resizable": true,
        "center": true,
        "backgroundColor": "#050609"
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https:;"
    }
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico"
    ],
    "windows": {
      "webviewInstallMode": {
        "type": "downloadBootstrapper"
      },
      "nsis": {
        "installMode": "currentUser",
        "languages": ["Russian", "English"],
        "displayLanguageSelector": false
      }
    }
  }
}
`,
  },
  {
    path: "app-kit/tauri/src-tauri/capabilities/default.json",
    title: "capabilities/default.json",
    description: "Минимальный набор разрешений безопасности Tauri v2 для главного окна.",
    group: "tauri",
    language: "json",
    content: `{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Базовые права главного окна RustFlow",
  "windows": ["main"],
  "permissions": ["core:default"]
}
`,
  },
  {
    path: "app-kit/tauri/src-tauri/src/main.rs",
    title: "src/main.rs",
    description: "Точка входа Windows-приложения без всплывающего консольного окна в release-сборке.",
    group: "tauri",
    language: "rust",
    content: `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    rustflow_lib::run();
}
`,
  },
  {
    path: "app-kit/tauri/src-tauri/src/lib.rs",
    title: "src/lib.rs — нативное ядро твикера (EAC-safe)",
    description:
      "Все нативные команды приложения: автоопределение CPU/GPU/RAM/SSD, поиск Rust в библиотеках Steam, бэкап/запись/откат client.cfg, точка восстановления Windows, запуск .reg/.bat с UAC и сохранение профиля в %APPDATA%. Не трогает память RustClient.exe.",
    group: "tauri",
    language: "rust",
    content: `use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use sysinfo::System;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HardwareInfo {
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub cpu_threads: usize,
    pub ram_gb: u64,
    pub ram_mhz: Option<u32>,
    pub gpu_name: String,
    pub vram_gb: Option<u32>,
    pub storage_kind: String, // "nvme" | "sata" | "hdd"
    pub os_version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RustInstallInfo {
    pub found: bool,
    pub rust_dir: Option<String>,
    pub cfg_path: Option<String>,
    pub has_backup: bool,
    pub is_running: bool,
}

#[derive(Deserialize)]
pub struct CfgEntry {
    pub key: String,
    pub value: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyResult {
    pub ok: bool,
    pub message: String,
    pub backup_path: Option<String>,
    pub changed_count: usize,
}

#[cfg(target_os = "windows")]
fn run_ps(script: &str) -> Option<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    let output = Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", script])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() { None } else { Some(text) }
}

#[cfg(not(target_os = "windows"))]
fn run_ps(_script: &str) -> Option<String> {
    None
}

/// 1. Автоопределение реального железа ПК (CPU, RAM + МТ/с, GPU + VRAM, NVMe/SATA/HDD).
#[tauri::command]
fn detect_hardware() -> HardwareInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());
    let cpu_cores = sys.physical_core_count().unwrap_or(1);
    let cpu_threads = sys.cpus().len().max(1);
    let ram_gb = ((sys.total_memory() as f64) / 1_073_741_824.0).round() as u64;

    let ram_mhz = run_ps(
        "(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property ConfiguredClockSpeed -Maximum).Maximum",
    )
    .and_then(|s| s.parse::<u32>().ok());

    let gpu_raw = run_ps(
        "$g = Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1; \
         if ($g) { \"$($g.Name)|$([math]::Round($g.AdapterRAM / 1GB))\" }",
    )
    .unwrap_or_else(|| "Unknown GPU|0".to_string());
    let mut parts = gpu_raw.splitn(2, '|');
    let gpu_name = parts.next().unwrap_or("Unknown GPU").to_string();
    let vram_gb = parts.next().and_then(|v| v.parse::<u32>().ok()).filter(|&v| v > 0);

    let storage_kind = run_ps(
        "$d = Get-PhysicalDisk | Select-Object -First 1; \
         if ($d.BusType -eq 'NVMe') { 'nvme' } \
         elseif ($d.MediaType -eq 'SSD') { 'sata' } \
         else { 'hdd' }",
    )
    .unwrap_or_else(|| "nvme".to_string());

    let os_version = format!(
        "{} {}",
        System::name().unwrap_or_else(|| "Windows".into()),
        System::os_version().unwrap_or_default()
    )
    .trim()
    .to_string();

    HardwareInfo {
        cpu_name,
        cpu_cores,
        cpu_threads,
        ram_gb,
        ram_mhz,
        gpu_name,
        vram_gb,
        storage_kind,
        os_version,
    }
}

fn is_rust_running() -> bool {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    sys.processes().values().any(|p| {
        p.name()
            .to_string_lossy()
            .eq_ignore_ascii_case("RustClient.exe")
    })
}

fn locate_rust_dir(custom_dir: Option<String>) -> Option<PathBuf> {
    if let Some(dir) = custom_dir {
        let p = PathBuf::from(dir.trim().trim_matches('"'));
        if p.join("RustClient.exe").is_file() {
            return Some(p);
        }
    }

    let mut steam_roots: Vec<PathBuf> = vec![
        PathBuf::from(r"C:\Program Files (x86)\Steam"),
        PathBuf::from(r"C:\Program Files\Steam"),
        PathBuf::from(r"D:\Steam"),
        PathBuf::from(r"D:\SteamLibrary"),
    ];

    if let Some(reg_path) =
        run_ps("(Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam' -ErrorAction SilentlyContinue).SteamPath")
    {
        steam_roots.insert(0, PathBuf::from(reg_path.replace('/', r"\")));
    }

    let mut libraries: Vec<PathBuf> = Vec::new();
    for root in steam_roots {
        let vdf = root.join("steamapps").join("libraryfolders.vdf");
        libraries.push(root);
        if let Ok(text) = fs::read_to_string(&vdf) {
            for line in text.lines() {
                let trimmed = line.trim();
                if let Some(rest) = trimmed.strip_prefix("\"path\"") {
                    let val = rest.trim().trim_matches('"').replace(r"\\", r"\");
                    if !val.is_empty() {
                        libraries.push(PathBuf::from(val));
                    }
                }
            }
        }
    }

    for lib in libraries {
        let candidate = lib.join("steamapps").join("common").join("Rust");
        if candidate.join("RustClient.exe").is_file() {
            return Some(candidate);
        }
        let direct = lib.join("common").join("Rust");
        if direct.join("RustClient.exe").is_file() {
            return Some(direct);
        }
    }
    None
}

/// 2. Поиск папки Rust и проверка статуса игры (строго read-only, без доступа к процессу).
#[tauri::command]
fn find_rust_install(custom_dir: Option<String>) -> RustInstallInfo {
    let running = is_rust_running();
    match locate_rust_dir(custom_dir) {
        Some(dir) => {
            let cfg = dir.join("cfg").join("client.cfg");
            let backup = dir.join("cfg").join("client.cfg.rustflow-backup");
            RustInstallInfo {
                found: true,
                rust_dir: Some(dir.to_string_lossy().into_owned()),
                cfg_path: Some(cfg.to_string_lossy().into_owned()),
                has_backup: backup.is_file(),
                is_running: running,
            }
        }
        None => RustInstallInfo {
            found: false,
            rust_dir: None,
            cfg_path: None,
            has_backup: false,
            is_running: running,
        },
    }
}

/// 3. Безопасное применение настроек в cfg/client.cfg с автоматическим бэкапом.
#[tauri::command]
fn apply_client_cfg(entries: Vec<CfgEntry>, custom_dir: Option<String>) -> Result<ApplyResult, String> {
    if is_rust_running() {
        return Err("Закройте Rust перед изменением client.cfg, чтобы игра не перезаписала файл.".into());
    }
    let rust_dir = locate_rust_dir(custom_dir)
        .ok_or_else(|| "Папка Rust не найдена. Укажите путь вручную (Steam -> Rust -> Просмотреть локальные файлы).".to_string())?;
    let cfg_dir = rust_dir.join("cfg");
    fs::create_dir_all(&cfg_dir).map_err(|e| format!("Не удалось создать папку cfg: {e}"))?;

    let cfg_path = cfg_dir.join("client.cfg");
    let backup_path = cfg_dir.join("client.cfg.rustflow-backup");

    let existing = if cfg_path.is_file() {
        if !backup_path.is_file() {
            fs::copy(&cfg_path, &backup_path)
                .map_err(|e| format!("Не удалось сохранить резервную копию: {e}"))?;
        }
        fs::read_to_string(&cfg_path).map_err(|e| format!("Ошибка чтения client.cfg: {e}"))?
    } else {
        String::new()
    };

    // Разрешаем только безопасные имена ключей вида graphics.shadowquality
    let mut map: BTreeMap<String, String> = BTreeMap::new();
    for item in entries {
        let k = item.key.trim().to_string();
        if k.is_empty()
            || !k.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_')
        {
            continue;
        }
        let v = item.value.replace(['"', '\r', '\n'], "");
        map.insert(k, v);
    }

    let mut out_lines: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut changed = 0usize;

    for line in existing.lines() {
        let key = line.split_whitespace().next().unwrap_or("");
        if let Some(val) = map.get(key) {
            if seen.insert(key.to_string()) {
                let formatted = format!("{key} \"{val}\"");
                if formatted != line.trim() {
                    changed += 1;
                }
                out_lines.push(formatted);
            }
        } else {
            out_lines.push(line.to_string());
        }
    }

    for (key, val) in &map {
        if !seen.contains(key) {
            out_lines.push(format!("{key} \"{val}\""));
            changed += 1;
        }
    }

    let body = out_lines.join("\r\n") + "\r\n";
    fs::write(&cfg_path, body).map_err(|e| format!("Ошибка записи client.cfg: {e}"))?;

    Ok(ApplyResult {
        ok: true,
        message: format!("Обновлено параметров: {changed}. Запустите Rust для применения."),
        backup_path: backup_path.is_file().then(|| backup_path.to_string_lossy().into_owned()),
        changed_count: changed,
    })
}

/// 4. Откат client.cfg из сохранённой резервной копии в один клик.
#[tauri::command]
fn restore_client_cfg(custom_dir: Option<String>) -> Result<String, String> {
    if is_rust_running() {
        return Err("Закройте Rust перед восстановлением client.cfg.".into());
    }
    let rust_dir = locate_rust_dir(custom_dir).ok_or_else(|| "Папка Rust не найдена.".to_string())?;
    let cfg_path = rust_dir.join("cfg").join("client.cfg");
    let backup_path = rust_dir.join("cfg").join("client.cfg.rustflow-backup");
    if !backup_path.is_file() {
        return Err("Резервная копия client.cfg.rustflow-backup не найдена.".into());
    }
    fs::copy(&backup_path, &cfg_path).map_err(|e| format!("Ошибка восстановления: {e}"))?;
    Ok("Оригинальный client.cfg успешно восстановлен.".into())
}

/// 5. Создание точки восстановления Windows с запросом прав администратора (UAC).
#[tauri::command]
fn create_restore_point(label: String) -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = label;
        return Err("Точки восстановления доступны только в Windows 10/11.".into());
    }
    #[cfg(target_os = "windows")]
    {
        let clean: String = label
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
            .take(48)
            .collect();
        let desc = if clean.is_empty() { "RustFlow Restore Point" } else { &clean };
        let cmd = format!(
            "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-Command',\"Checkpoint-Computer -Description '{desc}' -RestorePointType MODIFY_SETTINGS\""
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &cmd])
            .status()
            .map_err(|e| format!("Не удалось вызвать PowerShell: {e}"))?;
        if status.success() {
            Ok(format!("Точка восстановления «{desc}» создана."))
        } else {
            Err("Операция отменена или защита системы отключена.".into())
        }
    }
}

/// 6. Запуск проверенного .reg или .bat твика из библиотеки RustFlow с запросом UAC.
#[tauri::command]
fn apply_tweak_script(filename: String, kind: String, content: String, require_admin: bool) -> Result<String, String> {
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (filename, kind, content, require_admin);
        return Err("Применение .reg и .bat доступно только на Windows.".into());
    }
    #[cfg(target_os = "windows")]
    {
        let ext = match kind.as_str() {
            "reg" => "reg",
            "bat" => "bat",
            _ => return Err("Разрешены только текстовые файлы .reg и .bat.".into()),
        };
        let safe_stem: String = Path::new(&filename)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("rustflow-tweak")
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
            .take(48)
            .collect();

        let dir = std::env::temp_dir().join("RustFlow");
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let file_path = dir.join(format!("{safe_stem}.{ext}"));
        let crlf = content.replace("\r\n", "\n").replace('\n', "\r\n");
        fs::write(&file_path, crlf).map_err(|e| format!("Не удалось записать временный файл: {e}"))?;

        let path_str = file_path.to_string_lossy().replace('\'', "''");
        let ps = if ext == "reg" {
            format!("Start-Process regedit.exe -Verb RunAs -Wait -ArgumentList '{path_str}'")
        } else if require_admin {
            format!("Start-Process cmd.exe -Verb RunAs -Wait -ArgumentList '/c','\"{path_str}\"'")
        } else {
            format!("Start-Process cmd.exe -Wait -ArgumentList '/c','\"{path_str}\"'")
        };

        let status = Command::new("powershell")
            .args(["-NoProfile", "-Command", &ps])
            .status()
            .map_err(|e| format!("Ошибка запуска: {e}"))?;

        if status.success() {
            Ok(format!("Файл {}.{} выполнен.", safe_stem, ext))
        } else {
            Err("Выполнение отменено пользователем или завершилось с ошибкой.".into())
        }
    }
}

fn profile_file_path() -> Result<PathBuf, String> {
    let base = std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .ok_or_else(|| "Не удалось определить папку профиля пользователя.".to_string())?;
    let dir = base.join("RustFlow");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("profile-v1.json"))
}

/// 7. Чтение/сохранение профиля (сборка, твики, журнал) на диск в %APPDATA%/RustFlow.
#[tauri::command]
fn save_local_profile(json: String) -> Result<String, String> {
    serde_json::from_str::<serde_json::Value>(&json)
        .map_err(|_| "Некорректный JSON профиля.".to_string())?;
    let path = profile_file_path()?;
    fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().into_owned())
}

#[tauri::command]
fn load_local_profile() -> Result<Option<String>, String> {
    let path = profile_file_path()?;
    if !path.is_file() {
        return Ok(None);
    }
    fs::read_to_string(&path).map(Some).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            detect_hardware,
            find_rust_install,
            apply_client_cfg,
            restore_client_cfg,
            create_restore_point,
            apply_tweak_script,
            save_local_profile,
            load_local_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RustFlow desktop application");
}
`,
  },
  {
    path: "app-kit/tauri/desktop-bridge.ts",
    title: "desktop-bridge.ts — мост Сайт ↔ Desktop (.exe)",
    description:
      "Положите в src/lib/desktop-bridge.ts. Автоматически определяет среду (Tauri v2, Electron или обычный браузер) и даёт единый API применения твиков, детекта железа и правки client.cfg.",
    group: "tauri",
    language: "typescript",
    content: `/**
 * Универсальный клиентский мост RustFlow:
 * - в Tauri v2 вызывает нативные Rust-команды через window.__TAURI_INTERNALS__;
 * - в Electron вызывает безопасный preload-мост window.rustflowDesktop;
 * - в обычном браузере возвращает runtime = "web" и использует штатное скачивание файлов.
 */

export type RuntimeKind = "tauri" | "electron" | "web";

export interface NativeHardwareInfo {
  cpuName: string;
  cpuCores: number;
  cpuThreads: number;
  ramGb: number;
  ramMhz: number | null;
  gpuName: string;
  vramGb: number | null;
  storageKind: "nvme" | "sata" | "hdd";
  osVersion: string;
}

export interface NativeRustInstall {
  found: boolean;
  rustDir: string | null;
  cfgPath: string | null;
  hasBackup: boolean;
  isRunning: boolean;
}

export interface NativeApplyResult {
  ok: boolean;
  message: string;
  backupPath: string | null;
  changedCount: number;
}

interface ElectronApi {
  detectHardware: () => Promise<NativeHardwareInfo>;
  findRustInstall: (customDir?: string) => Promise<NativeRustInstall>;
  applyClientCfg: (
    entries: { key: string; value: string }[],
    customDir?: string,
  ) => Promise<NativeApplyResult>;
  restoreClientCfg: (customDir?: string) => Promise<string>;
  createRestorePoint: (label: string) => Promise<string>;
  applyTweakScript: (payload: {
    filename: string;
    kind: "reg" | "bat";
    content: string;
    requireAdmin: boolean;
  }) => Promise<string>;
}

declare global {
  interface Window {
    __TAURI_INTERNALS__?: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
    rustflowDesktop?: ElectronApi;
  }
}

export function getRuntime(): RuntimeKind {
  if (typeof window === "undefined") return "web";
  if (window.__TAURI_INTERNALS__?.invoke) return "tauri";
  if (window.rustflowDesktop) return "electron";
  return "web";
}

export function isDesktopApp(): boolean {
  return getRuntime() !== "web";
}

export async function nativeDetectHardware(): Promise<NativeHardwareInfo | null> {
  const rt = getRuntime();
  if (rt === "tauri") return window.__TAURI_INTERNALS__!.invoke<NativeHardwareInfo>("detect_hardware");
  if (rt === "electron") return window.rustflowDesktop!.detectHardware();
  return null;
}

export async function nativeFindRust(customDir?: string): Promise<NativeRustInstall | null> {
  const rt = getRuntime();
  if (rt === "tauri") {
    return window.__TAURI_INTERNALS__!.invoke<NativeRustInstall>("find_rust_install", { customDir });
  }
  if (rt === "electron") return window.rustflowDesktop!.findRustInstall(customDir);
  return null;
}

export async function nativeApplyClientCfg(
  entries: { key: string; value: string }[],
  customDir?: string,
): Promise<NativeApplyResult> {
  const rt = getRuntime();
  if (rt === "tauri") {
    return window.__TAURI_INTERNALS__!.invoke<NativeApplyResult>("apply_client_cfg", {
      entries,
      customDir,
    });
  }
  if (rt === "electron") return window.rustflowDesktop!.applyClientCfg(entries, customDir);
  throw new Error("Прямая запись client.cfg доступна только в десктоп-приложении RustFlow.");
}

export async function nativeRestoreClientCfg(customDir?: string): Promise<string> {
  const rt = getRuntime();
  if (rt === "tauri") {
    return window.__TAURI_INTERNALS__!.invoke<string>("restore_client_cfg", { customDir });
  }
  if (rt === "electron") return window.rustflowDesktop!.restoreClientCfg(customDir);
  throw new Error("Автооткат доступен только в десктоп-приложении RustFlow.");
}

export async function nativeCreateRestorePoint(label = "RustFlow - before tweaks"): Promise<string> {
  const rt = getRuntime();
  if (rt === "tauri") {
    return window.__TAURI_INTERNALS__!.invoke<string>("create_restore_point", { label });
  }
  if (rt === "electron") return window.rustflowDesktop!.createRestorePoint(label);
  throw new Error("Создание точки восстановления доступно только в Windows-приложении.");
}

export async function nativeApplyTweak(
  filename: string,
  kind: "reg" | "bat",
  content: string,
  requireAdmin: boolean,
): Promise<string> {
  const rt = getRuntime();
  if (rt === "tauri") {
    return window.__TAURI_INTERNALS__!.invoke<string>("apply_tweak_script", {
      filename,
      kind,
      content,
      requireAdmin,
    });
  }
  if (rt === "electron") {
    return window.rustflowDesktop!.applyTweakScript({ filename, kind, content, requireAdmin });
  }
  throw new Error("В веб-версии скачайте файл и запустите его вручную.");
}
`,
  },
  {
    path: "app-kit/tauri/next.desktop.config.ts",
    title: "next.desktop.config.ts — статический экспорт UI для .exe",
    description:
      "Конфиг сборки фронтенда в папку out/ для упаковки внутрь Tauri v2 или Electron без внешнего сервера.",
    group: "tauri",
    language: "typescript",
    content: `import type { NextConfig } from "next";

/**
 * Используется при сборке автономного Windows-приложения (.exe):
 * временно удалите или исключите папку src/app/api (все функции уже работают через
 * localStorage и desktop-bridge.ts) и соберите статический бандл в out/.
 */
const desktopConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default desktopConfig;
`,
  },
  {
    path: "app-kit/tauri/package.desktop-scripts.json",
    title: "package.desktop-scripts.json — скрипты сборки .exe",
    description: "Добавьте эти scripts и devDependencies в ваш package.json для сборки Tauri v2 или Electron.",
    group: "tauri",
    language: "json",
    content: `{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:icon": "tauri icon src/app/icon.svg",
    "tauri:build": "tauri build",
    "electron:dev": "electron electron/main.cjs",
    "electron:build": "electron-builder --config electron/electron-builder.yml --win"
  },
  "devDependencies_for_tauri": {
    "@tauri-apps/cli": "^2.2.0"
  },
  "devDependencies_for_electron": {
    "electron": "^34.0.0",
    "electron-builder": "^25.1.8"
  }
}
`,
  },
  /* ----------------------------- ELECTRON ----------------------------- */
  {
    path: "app-kit/electron/main.cjs",
    title: "electron/main.cjs — главный процесс Electron",
    description:
      "Полноценная альтернатива Tauri без установки Rust: безопасное окно (contextIsolation, sandbox) + те же IPC-команды детекта железа, client.cfg и запуска .reg/.bat.",
    group: "electron",
    language: "javascript",
    content: `const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { execFile } = require("node:child_process");

const DEV_URL = process.env.RUSTFLOW_APP_URL || "http://localhost:3000";

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    if (process.platform !== "win32") {
      return reject(new Error("Команда доступна только в Windows 10/11."));
    }
    execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      { windowsHide: true, timeout: 60_000 },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || err.message).trim()));
        resolve(String(stdout || "").trim());
      },
    );
  });
}

function locateRustDir(customDir) {
  const candidates = [];
  if (customDir) candidates.push(customDir.trim().replace(/^"|"$/g, ""));
  const steamRoots = [
    "C:\\\\Program Files (x86)\\\\Steam",
    "C:\\\\Program Files\\\\Steam",
    "D:\\\\Steam",
    "D:\\\\SteamLibrary",
  ];
  for (const root of steamRoots) {
    candidates.push(path.join(root, "steamapps", "common", "Rust"));
    candidates.push(path.join(root, "common", "Rust"));
    const vdf = path.join(root, "steamapps", "libraryfolders.vdf");
    if (fs.existsSync(vdf)) {
      const lines = fs.readFileSync(vdf, "utf8").split(/\\r?\\n/);
      for (const line of lines) {
        const m = line.match(/"path"\\s+"([^"]+)"/);
        if (m) {
          const lib = m[1].replace(/\\\\\\\\/g, "\\\\");
          candidates.push(path.join(lib, "steamapps", "common", "Rust"));
        }
      }
    }
  }
  return candidates.find((dir) => fs.existsSync(path.join(dir, "RustClient.exe"))) || null;
}

ipcMain.handle("rf:detect-hardware", async () => {
  const cpus = os.cpus();
  const cpuName = cpus[0]?.model?.trim() || "Unknown CPU";
  const ramGb = Math.round(os.totalmem() / 1024 ** 3);
  let ramMhz = null;
  let gpuName = "Unknown GPU";
  let vramGb = null;
  let storageKind = "nvme";

  if (process.platform === "win32") {
    try {
      const raw = await runPowerShell(
        "$m = (Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property ConfiguredClockSpeed -Maximum).Maximum; " +
          "$g = Get-CimInstance Win32_VideoController | Sort-Object AdapterRAM -Descending | Select-Object -First 1; " +
          "$d = Get-PhysicalDisk | Select-Object -First 1; " +
          "$st = if ($d.BusType -eq 'NVMe') { 'nvme' } elseif ($d.MediaType -eq 'SSD') { 'sata' } else { 'hdd' }; " +
          "[PSCustomObject]@{ ramMhz=$m; gpu=$g.Name; vram=[math]::Round($g.AdapterRAM/1GB); storage=$st } | ConvertTo-Json -Compress",
      );
      const parsed = JSON.parse(raw);
      ramMhz = Number(parsed.ramMhz) || null;
      gpuName = parsed.gpu || gpuName;
      vramGb = Number(parsed.vram) || null;
      storageKind = parsed.storage || "nvme";
    } catch {
      /* fallback to os module values */
    }
  }

  return {
    cpuName,
    cpuCores: Math.max(1, Math.floor(cpus.length / 2)),
    cpuThreads: cpus.length,
    ramGb,
    ramMhz,
    gpuName,
    vramGb,
    storageKind,
    osVersion: \`\${os.type()} \${os.release()}\`,
  };
});

ipcMain.handle("rf:find-rust", async (_e, customDir) => {
  const rustDir = locateRustDir(customDir);
  let isRunning = false;
  if (process.platform === "win32") {
    try {
      const out = await runPowerShell(
        "if (Get-Process -Name 'RustClient' -ErrorAction SilentlyContinue) { '1' } else { '0' }",
      );
      isRunning = out === "1";
    } catch {
      isRunning = false;
    }
  }
  if (!rustDir) {
    return { found: false, rustDir: null, cfgPath: null, hasBackup: false, isRunning };
  }
  const cfgPath = path.join(rustDir, "cfg", "client.cfg");
  const backupPath = path.join(rustDir, "cfg", "client.cfg.rustflow-backup");
  return {
    found: true,
    rustDir,
    cfgPath,
    hasBackup: fs.existsSync(backupPath),
    isRunning,
  };
});

ipcMain.handle("rf:apply-cfg", async (_e, entries, customDir) => {
  const rustDir = locateRustDir(customDir);
  if (!rustDir) throw new Error("Папка Rust не найдена. Укажите путь вручную.");
  const cfgDir = path.join(rustDir, "cfg");
  fs.mkdirSync(cfgDir, { recursive: true });
  const cfgPath = path.join(cfgDir, "client.cfg");
  const backupPath = path.join(cfgDir, "client.cfg.rustflow-backup");

  let lines = [];
  if (fs.existsSync(cfgPath)) {
    if (!fs.existsSync(backupPath)) fs.copyFileSync(cfgPath, backupPath);
    lines = fs.readFileSync(cfgPath, "utf8").split(/\\r?\\n/);
  }

  const map = new Map();
  for (const item of Array.isArray(entries) ? entries : []) {
    const key = String(item.key || "").trim();
    if (/^[a-zA-Z0-9._]+$/.test(key)) {
      map.set(key, String(item.value ?? "").replace(/["\\r\\n]/g, ""));
    }
  }

  const seen = new Set();
  const out = [];
  let changed = 0;
  for (const line of lines) {
    const key = line.trim().split(/\\s+/, 1)[0];
    if (key && map.has(key)) {
      if (!seen.has(key)) {
        const next = \`\${key} "\${map.get(key)}"\`;
        if (next !== line.trim()) changed += 1;
        out.push(next);
        seen.add(key);
      }
    } else {
      out.push(line);
    }
  }
  for (const [key, val] of map.entries()) {
    if (!seen.has(key)) {
      out.push(\`\${key} "\${val}"\`);
      changed += 1;
    }
  }
  fs.writeFileSync(cfgPath, out.join("\\r\\n") + "\\r\\n", "utf8");
  return {
    ok: true,
    message: \`Обновлено параметров: \${changed}.\`,
    backupPath: fs.existsSync(backupPath) ? backupPath : null,
    changedCount: changed,
  };
});

ipcMain.handle("rf:restore-cfg", async (_e, customDir) => {
  const rustDir = locateRustDir(customDir);
  if (!rustDir) throw new Error("Папка Rust не найдена.");
  const cfgPath = path.join(rustDir, "cfg", "client.cfg");
  const backupPath = path.join(rustDir, "cfg", "client.cfg.rustflow-backup");
  if (!fs.existsSync(backupPath)) throw new Error("Резервная копия не найдена.");
  fs.copyFileSync(backupPath, cfgPath);
  return "Оригинальный client.cfg восстановлен.";
});

ipcMain.handle("rf:restore-point", async (_e, label) => {
  const clean = String(label || "RustFlow")
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .slice(0, 48);
  await runPowerShell(
    \`Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile','-Command',"Checkpoint-Computer -Description '\${clean}' -RestorePointType MODIFY_SETTINGS"\`,
  );
  return \`Точка восстановления «\${clean}» создана.\`;
});

ipcMain.handle("rf:apply-tweak", async (_e, payload) => {
  const ext = payload?.kind === "reg" ? "reg" : payload?.kind === "bat" ? "bat" : null;
  if (!ext) throw new Error("Разрешены только .reg и .bat.");
  const stem =
    String(payload.filename || "tweak")
      .replace(/\\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 48) || "tweak";
  const dir = path.join(os.tmpdir(), "RustFlow");
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, \`\${stem}.\${ext}\`);
  const body = String(payload.content || "").replace(/\\r?\\n/g, "\\r\\n");
  fs.writeFileSync(filePath, body, "utf8");
  const safe = filePath.replace(/'/g, "''");
  const cmd =
    ext === "reg"
      ? \`Start-Process regedit.exe -Verb RunAs -Wait -ArgumentList '\${safe}'\`
      : payload.requireAdmin
        ? \`Start-Process cmd.exe -Verb RunAs -Wait -ArgumentList '/c','"\${safe}"'\`
        : \`Start-Process cmd.exe -Wait -ArgumentList '/c','"\${safe}"'\`;
  await runPowerShell(cmd);
  return \`Файл \${stem}.\${ext} выполнен.\`;
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#050609",
    title: "RustFlow — Твикер и Бенчмарк для Rust",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const staticIndex = path.join(__dirname, "..", "out", "index.html");
  if (app.isPackaged && fs.existsSync(staticIndex)) {
    win.loadFile(staticIndex);
  } else {
    win.loadURL(DEV_URL);
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) shell.openExternal(url);
    return { action: "deny" };
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
`,
  },
  {
    path: "app-kit/electron/preload.cjs",
    title: "electron/preload.cjs — изолированный contextBridge",
    description:
      "Безопасно пробрасывает window.rustflowDesktop в интерфейс сайта без раскрытия Node.js (совместим с desktop-bridge.ts).",
    group: "electron",
    language: "javascript",
    content: `const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("rustflowDesktop", {
  detectHardware: () => ipcRenderer.invoke("rf:detect-hardware"),
  findRustInstall: (customDir) => ipcRenderer.invoke("rf:find-rust", customDir),
  applyClientCfg: (entries, customDir) => ipcRenderer.invoke("rf:apply-cfg", entries, customDir),
  restoreClientCfg: (customDir) => ipcRenderer.invoke("rf:restore-cfg", customDir),
  createRestorePoint: (label) => ipcRenderer.invoke("rf:restore-point", label),
  applyTweakScript: (payload) => ipcRenderer.invoke("rf:apply-tweak", payload),
});
`,
  },
  {
    path: "app-kit/electron/electron-builder.yml",
    title: "electron/electron-builder.yml — сборка Setup.exe и Portable",
    description: "Конфиг electron-builder для создания установщика NSIS и портативного RustFlow-Portable.exe.",
    group: "electron",
    language: "yaml",
    content: `appId: app.rustflow.desktop
productName: RustFlow
directories:
  output: dist-desktop
files:
  - out/**/*
  - electron/**/*
  - package.json
win:
  target:
    - nsis
    - portable
  artifactName: \${productName}-\${version}-\${arch}.\${ext}
nsis:
  oneClick: false
  perMachine: false
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
portable:
  artifactName: \${productName}-Portable-\${version}.\${ext}
`,
  },
];
