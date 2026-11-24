//! Корневой модуль нативного бэкенда RustFlow для Windows 10/11 (Tauri v2).
//!
//! Объединяет модули поиска Steam/Rust, чтения характеристик ПК через WMI/WinAPI,
//! резервного копирования в `%AppData%/RustFlow/backups/<timestamp>` и диспетчер
//! паттерна «Команда» для безопасного применения и отката оптимизаций.

pub mod backup_manager;
pub mod command_executor;
pub mod hardware_info;
pub mod steam_locator;

use backup_manager::{BackupManager, BackupSummary, RestoreReport};
use command_executor::{
    BatchExecutionReport, CommandExecutor, CommandOutcome, DetectedInstaller, DriverActionCommand,
    TweakCommand, TweakExecutionPlan,
};
use hardware_info::WindowsHardwareInfo;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;
use std::time::{Duration, Instant};
use sysinfo::System;
use steam_locator::RustInstallPaths;

/// Shared sampler: CPU load needs two readings separated in time.
struct TelemetrySampler {
    system: System,
    previous: Option<Instant>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TelemetrySample {
    cpu_load: Option<f32>,
    #[serde(rename = "cpuMHz")]
    cpu_m_hz: Option<u64>,
    #[serde(rename = "ramUsedGB")]
    ram_used_g_b: Option<f64>,
    #[serde(rename = "ramTotalGB")]
    ram_total_g_b: Option<f64>,
}

#[tauri::command]
fn read_telemetry(state: tauri::State<'_, Mutex<TelemetrySampler>>) -> Result<TelemetrySample, String> {
    let mut sampler = state.lock().map_err(|_| "Датчик системы недоступен".to_string())?;
    let now = Instant::now();
    let valid_cpu = sampler.previous.map(|t| now.duration_since(t) >= Duration::from_millis(200)).unwrap_or(false);
    sampler.system.refresh_cpu_all();
    sampler.system.refresh_memory();
    sampler.previous = Some(now);
    let system = &sampler.system;
    let total = system.total_memory();
    Ok(TelemetrySample {
        cpu_load: if valid_cpu && !system.cpus().is_empty() { Some(system.global_cpu_usage()) } else { None },
        cpu_m_hz: system.cpus().first().map(|cpu| cpu.frequency()).filter(|value| *value > 0),
        ram_used_g_b: if total > 0 { Some(system.used_memory() as f64 / 1_073_741_824.0) } else { None },
        ram_total_g_b: if total > 0 { Some(total as f64 / 1_073_741_824.0) } else { None },
    })
}

/// Сведения о созданном снимке конфигурации.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupCreated {
    pub backup_id: String,
    pub folder_path: String,
}

/// Читает реальные характеристики ПК (CPU, GPU, RAM, NVMe/SATA/HDD, Windows 10/11).
#[tauri::command]
fn read_windows_info() -> Result<WindowsHardwareInfo, String> {
    hardware_info::read_windows_hardware()
}

/// Находит папку установки игры Rust через реестр Steam и `libraryfolders.vdf`.
#[tauri::command]
fn find_rust_directory(custom_dir: Option<String>) -> Result<String, String> {
    let info = steam_locator::locate_rust_installation(custom_dir.as_deref())?;
    Ok(info.rust_dir)
}

/// Возвращает подробные пути к Steam, Rust, `client.cfg` и `keys.cfg` + статус процесса игры.
#[tauri::command]
fn locate_steam_rust(custom_dir: Option<String>) -> Result<RustInstallPaths, String> {
    steam_locator::locate_rust_installation(custom_dir.as_deref())
}

/// Создаёт обязательный снимок `client.cfg` (и `keys.cfg` при наличии) в `%AppData%/RustFlow/backups/<timestamp>`.
#[tauri::command]
fn backup_client_cfg(custom_dir: Option<String>) -> Result<BackupCreated, String> {
    let executor = CommandExecutor::new()?;
    let backup_id = executor.backup_game_configs(custom_dir.as_deref())?;
    let folder = executor.backup_manager().session_dir(&backup_id)?;
    Ok(BackupCreated {
        backup_id,
        folder_path: folder.to_string_lossy().into_owned(),
    })
}

/// Безопасно обновляет `Rust/cfg/client.cfg` через `ClientCfgCommand` с предварительным снимком.
#[tauri::command]
fn apply_client_cfg(cfg: String, custom_dir: Option<String>) -> Result<CommandOutcome, String> {
    let executor = CommandExecutor::new()?;
    executor.apply_client_cfg_only(&cfg, custom_dir.as_deref())
}

/// Обратно совместимая обёртка над `apply_client_cfg` для старых вызовов `write_client_cfg`.
#[tauri::command]
fn write_client_cfg(cfg: String) -> Result<(), String> {
    let executor = CommandExecutor::new()?;
    executor.apply_client_cfg_only(&cfg, None)?;
    Ok(())
}

/// Восстанавливает последний снимок конфигурации игры и изменений реестра.
#[tauri::command]
fn restore_client_cfg() -> Result<RestoreReport, String> {
    let executor = CommandExecutor::new()?;
    executor.rollback_changes(None)
}

/// Выполняет пакетный план шагов из `src/lib/tweaks/` через диспетчер Command Pattern.
#[tauri::command]
fn execute_tweak_plan(plan: TweakExecutionPlan) -> Result<BatchExecutionReport, String> {
    let executor = CommandExecutor::new()?;
    executor.execute_tweak_plan(&plan)
}

/// Откатывает изменения по идентификатору снимка (или последний активный снимок).
#[tauri::command]
fn rollback_changes(backup_id: Option<String>) -> Result<RestoreReport, String> {
    let executor = CommandExecutor::new()?;
    executor.rollback_changes(backup_id.as_deref())
}

/// Возвращает список всех доступных резервных копий из `%AppData%/RustFlow/backups`.
#[tauri::command]
fn list_backups() -> Result<Vec<BackupSummary>, String> {
    let manager = BackupManager::new()?;
    manager.list_backups()
}

/// Открывает официальную страницу производителя драйвера / DDU через `DriverActionCommand`.
#[tauri::command]
fn open_official_support(kind: String) -> Result<CommandOutcome, String> {
    let cmd = DriverActionCommand::open_support(&kind)?;
    cmd.apply()
}

/// Выполняет действие с драйвером: запускает скачанный установщик с UAC либо открывает официальную загрузку.
#[tauri::command]
fn run_driver_action(
    family: String,
    installer_path: Option<String>,
) -> Result<CommandOutcome, String> {
    let cmd = match installer_path
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(path) => DriverActionCommand::launch_installer(path)?,
        None => DriverActionCommand::open_support(&family)?,
    };
    cmd.apply()
}

/// Ищет уже скачанные установщики драйверов и DDU в папке `%USERPROFILE%\Downloads`.
#[tauri::command]
fn find_driver_installers(family: Option<String>) -> Result<Vec<DetectedInstaller>, String> {
    command_executor::find_downloaded_installers(family.as_deref())
}

/// Файл внутри экспортируемого пакета `SHIFT-Pack`.
#[derive(Deserialize)]
struct PackFile {
    name: String,
    data: Vec<u8>,
}

/// Результат экспорта пакета на рабочий стол.
#[derive(Serialize)]
struct SavedPack {
    opened: bool,
}

/// Строгая валидация файлов экспортируемого пакета твиков против path traversal и опасных расширений.
fn validate_pack(files: &[PackFile]) -> Result<(), String> {
    if files.is_empty() || files.len() > 512 {
        return Err("Некорректное количество файлов в пакете.".into());
    }
    let mut names = HashSet::new();
    let mut total = 0usize;
    for file in files {
        total = total
            .checked_add(file.data.len())
            .ok_or("Размер пакета превышает допустимый лимит.")?;
        if file.data.len() > 2 * 1024 * 1024 || total > 16 * 1024 * 1024 {
            return Err("Размер пакета превышает допустимый лимит.".into());
        }
        let parts: Vec<_> = file.name.split('/').collect();
        if parts.len() < 2
            || parts.len() > 4
            || parts[0] != "SHIFT-Pack"
            || file.name.len() > 200
        {
            return Err("Недопустимый путь внутри пакета.".into());
        }
        for part in &parts {
            if part.is_empty()
                || part.ends_with('.')
                || !part
                    .bytes()
                    .all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c))
            {
                return Err("Недопустимое имя файла внутри пакета.".into());
            }
            let stem = part.split('.').next().unwrap_or("").to_ascii_uppercase();
            if [
                "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
                "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8",
                "LPT9",
            ]
            .contains(&stem.as_str())
            {
                return Err("Зарезервированное системное имя файла.".into());
            }
        }
        let lower = file.name.to_ascii_lowercase();
        if !(lower.ends_with(".txt")
            || lower.ends_with(".reg")
            || lower.ends_with(".bat")
            || lower.ends_with(".cfg"))
            || !names.insert(lower)
        {
            return Err("Неразрешённое расширение или дубликат файла в пакете.".into());
        }
    }
    Ok(())
}

/// Сохраняет пакет `SHIFT-Pack` (включая `README.txt` и `Otkat/`) на рабочий стол без автозапуска.
#[tauri::command]
fn save_tweak_pack(app: tauri::AppHandle, files: Vec<PackFile>) -> Result<SavedPack, String> {
    validate_pack(&files)?;
    #[cfg(not(target_os = "windows"))]
    {
        let _ = app;
        Err("Экспорт пакета на рабочий стол доступен только в Windows.".into())
    }
    #[cfg(target_os = "windows")]
    {
        use std::io::Write;
        use tauri::Manager;

        let display_desktop = app.path().desktop_dir().map_err(|e| e.to_string())?;
        let desktop = std::fs::canonicalize(&display_desktop).map_err(|e| e.to_string())?;
        let root = desktop.join("SHIFT_Tweaks");
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let root = std::fs::canonicalize(&root).map_err(|e| e.to_string())?;
        if root.parent() != Some(desktop.as_path()) {
            return Err("Некорректная папка рабочего стола.".into());
        }

        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();
        let directory_name = format!("pack-{}-{}", timestamp, std::process::id());
        let output = root.join(&directory_name);
        std::fs::create_dir(&output).map_err(|e| e.to_string())?;

        for file in files {
            let path = file
                .name
                .split('/')
                .fold(output.clone(), |p, part| p.join(part));
            let parent = path.parent().ok_or("Некорректный путь.")?;
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            let mut dest = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .map_err(|e| e.to_string())?;
            dest.write_all(&file.data)
                .and_then(|_| dest.sync_all())
                .map_err(|e| e.to_string())?;
        }

        let readme = display_desktop
            .join("SHIFT_Tweaks")
            .join(directory_name)
            .join("SHIFT-Pack")
            .join("README.txt");
        let opened = readme.is_file()
            && std::process::Command::new("explorer.exe")
                .arg("/select,")
                .arg(readme)
                .spawn()
                .is_ok();
        Ok(SavedPack { opened })
    }
}

/// Запускает Tauri-приложение RustFlow с регистрацией всех системных команд.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(TelemetrySampler { system: System::new(), previous: None }))
        .invoke_handler(tauri::generate_handler![
            read_windows_info,
            read_telemetry,
            find_rust_directory,
            locate_steam_rust,
            backup_client_cfg,
            apply_client_cfg,
            write_client_cfg,
            restore_client_cfg,
            execute_tweak_plan,
            rollback_changes,
            list_backups,
            open_official_support,
            run_driver_action,
            find_driver_installers,
            save_tweak_pack,
        ])
        .run(tauri::generate_context!())
        .expect("Не удалось запустить десктопное приложение RustFlow");
}

#[cfg(test)]
mod pack_tests {
    use super::*;

    fn file(name: &str) -> PackFile {
        PackFile {
            name: name.into(),
            data: vec![1],
        }
    }

    #[test]
    fn accepts_pack_and_rejects_unsafe_paths() {
        assert!(validate_pack(&[
            file("SHIFT-Pack/README.txt"),
            file("SHIFT-Pack/Otkat/test.bat"),
        ])
        .is_ok());

        for path in [
            "../evil.bat",
            "SHIFT-Pack/../evil.reg",
            "SHIFT-Pack/C:/evil.bat",
            "SHIFT-Pack/evil.exe",
            "SHIFT-Pack/NUL.txt",
            "SHIFT-Pack/a\\evil.reg",
        ] {
            assert!(validate_pack(&[file(path)]).is_err(), "{path}");
        }

        assert!(validate_pack(&[
            file("SHIFT-Pack/a.txt"),
            file("SHIFT-Pack/A.TXT"),
        ])
        .is_err());
    }
}
