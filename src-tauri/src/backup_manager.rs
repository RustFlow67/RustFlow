//! Менеджер резервных копий и полного отката (Backup & Restore).
//!
//! Перед любым изменением конфигурации игры (`client.cfg`, `keys.cfg`), реестра Windows
//! или схемы питания создаёт снимок в `%AppData%/RustFlow/backups/<timestamp>/`:
//! - `manifest.json` — точный мета-манифест состояния до изменений;
//! - `cfg/*.bak` — побайтовая копия `client.cfg` / `keys.cfg`;
//! - `registry/branch_backup.reg` — экспорт затрагиваемых веток и ключей в формате `.reg`.

use crate::steam_locator;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static BACKUP_SEQUENCE: AtomicU64 = AtomicU64::new(1);

/// Корневой раздел реестра Windows, поддерживаемый RustFlow.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "UPPERCASE")]
pub enum RegistryHive {
    Hkcu,
    Hklm,
}

impl RegistryHive {
    /// Возвращает полное имя корневого куста для формата `.reg`.
    pub fn full_name(self) -> &'static str {
        match self {
            RegistryHive::Hkcu => "HKEY_CURRENT_USER",
            RegistryHive::Hklm => "HKEY_LOCAL_MACHINE",
        }
    }
}

/// Адрес конкретного параметра реестра для снимка и изменения.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct RegistryTarget {
    pub hive: RegistryHive,
    pub subkey: String,
    pub value_name: String,
}

/// Снимок файла конфигурации игры (`client.cfg` или `keys.cfg`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CfgFileSnapshot {
    pub target_path: String,
    pub backup_file: String,
    pub existed: bool,
}

/// Точный побайтовый снимок одного параметра реестра до применения твика.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryValueSnapshot {
    pub hive: RegistryHive,
    pub subkey: String,
    pub value_name: String,
    pub existed: bool,
    pub key_existed: bool,
    pub reg_type: Option<String>,
    pub data_hex: Option<String>,
    pub display_value: Option<String>,
}

/// Снимок схемы электропитания Windows до переключения.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PowerPlanSnapshot {
    pub original_guid: String,
    pub created_guid: Option<String>,
}

/// Полный манифест одной транзакции резервного копирования.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupManifest {
    pub backup_id: String,
    pub created_at_unix: u64,
    pub label: String,
    pub cfg_backups: Vec<CfgFileSnapshot>,
    pub registry_backups: Vec<RegistryValueSnapshot>,
    pub power_plan_backup: Option<PowerPlanSnapshot>,
    pub applied_commands: Vec<String>,
    pub restored: bool,
}

/// Краткая сводка снимка для отображения в интерфейсе.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    pub backup_id: String,
    pub created_at_unix: u64,
    pub label: String,
    pub cfg_count: usize,
    pub registry_count: usize,
    pub has_power_plan: bool,
    pub restored: bool,
    pub folder_path: String,
}

/// Отчёт о выполнении полного или частичного отката.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreReport {
    pub backup_id: String,
    pub restored_cfg_files: usize,
    pub restored_registry_values: usize,
    pub restored_power_plan: bool,
    pub message: String,
}

/// Центральный менеджер резервных копий в `%AppData%/RustFlow/backups/<timestamp>`.
#[derive(Debug, Clone)]
pub struct BackupManager {
    base_dir: PathBuf,
}

impl BackupManager {
    /// Создаёт менеджер со стандартной директорией `%AppData%/RustFlow/backups`.
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            base_dir: default_backup_root()?,
        })
    }

    /// Создаёт менеджер с явно заданной базовой директорией (удобно для модульных тестов).
    pub fn with_base_dir(base_dir: PathBuf) -> Self {
        Self { base_dir }
    }

    /// Возвращает путь к корневой папке всех бэкапов.
    pub fn base_dir(&self) -> &Path {
        &self.base_dir
    }

    /// Возвращает путь к конкретной папке снимка по его идентификатору.
    pub fn session_dir(&self, backup_id: &str) -> Result<PathBuf, String> {
        validate_backup_id(backup_id)?;
        Ok(self.base_dir.join(backup_id))
    }

    /// Создаёт новую сессию резервного копирования `%AppData%/RustFlow/backups/<timestamp>`.
    pub fn create_session(&self, label: &str) -> Result<String, String> {
        fs::create_dir_all(&self.base_dir)
            .map_err(|e| format!("Не удалось создать папку резервных копий: {e}"))?;

        let now = unix_seconds_now();
        let seq = BACKUP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let backup_id = format!("{}-{:03}", format_timestamp_utc(now), seq % 1000);
        let session_dir = self.base_dir.join(&backup_id);

        fs::create_dir_all(session_dir.join("cfg"))
            .map_err(|e| format!("Не удалось подготовить папку cfg для бэкапа: {e}"))?;
        fs::create_dir_all(session_dir.join("registry"))
            .map_err(|e| format!("Не удалось подготовить папку registry для бэкапа: {e}"))?;

        let manifest = BackupManifest {
            backup_id: backup_id.clone(),
            created_at_unix: now,
            label: label.trim().chars().take(120).collect(),
            cfg_backups: Vec::new(),
            registry_backups: Vec::new(),
            power_plan_backup: None,
            applied_commands: Vec::new(),
            restored: false,
        };
        self.save_manifest(&manifest)?;
        Ok(backup_id)
    }

    /// Делает обязательную резервную копию `client.cfg` или `keys.cfg` перед изменением.
    pub fn snapshot_cfg_file(
        &self,
        backup_id: &str,
        target_path: &Path,
    ) -> Result<CfgFileSnapshot, String> {
        let mut manifest = self.load_manifest(backup_id)?;
        let target_str = target_path.to_string_lossy().into_owned();

        // Не перезаписываем исходную копию, если файл уже сохранён в рамках этой же сессии.
        if let Some(existing) = manifest
            .cfg_backups
            .iter()
            .find(|item| item.target_path.eq_ignore_ascii_case(&target_str))
        {
            return Ok(existing.clone());
        }

        let session_dir = self.session_dir(backup_id)?;
        let file_name = target_path
            .file_name()
            .and_then(|n| n.to_str())
            .filter(|n| !n.is_empty())
            .unwrap_or("config.cfg");
        let safe_name: String = file_name
            .chars()
            .map(|c| if c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-' { c } else { '_' })
            .collect();
        let rel_backup = format!("cfg/{}.{safe_name}.bak", manifest.cfg_backups.len() + 1);
        let backup_dest = session_dir.join(&rel_backup);

        let existed = target_path.is_file();
        if existed {
            let data = fs::read(target_path)
                .map_err(|e| format!("Не удалось прочитать исходный {}: {e}", target_path.display()))?;
            write_atomic_bytes(&backup_dest, &data)?;
        } else {
            write_atomic_bytes(&backup_dest, b"")?;
        }

        let snapshot = CfgFileSnapshot {
            target_path: target_str,
            backup_file: rel_backup,
            existed,
        };
        manifest.cfg_backups.push(snapshot.clone());
        self.save_manifest(&manifest)?;
        Ok(snapshot)
    }

    /// Делает снимок всех затрагиваемых параметров и веток реестра Windows до их изменения.
    pub fn snapshot_registry_targets(
        &self,
        backup_id: &str,
        targets: &[RegistryTarget],
    ) -> Result<Vec<RegistryValueSnapshot>, String> {
        let mut manifest = self.load_manifest(backup_id)?;
        let mut existing_keys: HashSet<(RegistryHive, String, String)> = manifest
            .registry_backups
            .iter()
            .map(|item| {
                (
                    item.hive,
                    item.subkey.to_ascii_lowercase(),
                    item.value_name.to_ascii_lowercase(),
                )
            })
            .collect();

        let mut added = Vec::new();
        for target in targets {
            let dedupe = (
                target.hive,
                target.subkey.to_ascii_lowercase(),
                target.value_name.to_ascii_lowercase(),
            );
            if !existing_keys.insert(dedupe) {
                continue;
            }
            let snap = capture_single_registry_value(target)?;
            manifest.registry_backups.push(snap.clone());
            added.push(snap);
        }

        // Сохраняем человекочитаемый `.reg`-снимок веток для аудита и ручного/UAC восстановления.
        let session_dir = self.session_dir(backup_id)?;
        let reg_text = build_reg_file_content(&manifest.registry_backups);
        write_utf16le_reg_file(&session_dir.join("registry").join("branch_backup.reg"), &reg_text)?;

        // Также экспортируем полные затрагиваемые ветки реестра на Windows.
        export_touched_branches(&session_dir.join("registry"), &manifest.registry_backups);

        self.save_manifest(&manifest)?;
        Ok(added)
    }

    /// Записывает данные о предыдущей схеме электропитания Windows в манифест.
    pub fn record_power_plan_backup(
        &self,
        backup_id: &str,
        original_guid: &str,
        created_guid: Option<&str>,
    ) -> Result<(), String> {
        let mut manifest = self.load_manifest(backup_id)?;
        if manifest.power_plan_backup.is_none() {
            manifest.power_plan_backup = Some(PowerPlanSnapshot {
                original_guid: original_guid.to_string(),
                created_guid: created_guid.map(|s| s.to_string()),
            });
        } else if let Some(ref mut prev) = manifest.power_plan_backup {
            if prev.created_guid.is_none() {
                prev.created_guid = created_guid.map(|s| s.to_string());
            }
        }
        self.save_manifest(&manifest)
    }

    /// Регистрирует применённую команду в манифесте текущей сессии бэкапа.
    pub fn append_applied_command(&self, backup_id: &str, command_id: &str) -> Result<(), String> {
        let mut manifest = self.load_manifest(backup_id)?;
        if !manifest.applied_commands.iter().any(|c| c == command_id) {
            manifest.applied_commands.push(command_id.to_string());
            self.save_manifest(&manifest)?;
        }
        Ok(())
    }

    /// Загружает манифест указанного бэкапа.
    pub fn load_manifest(&self, backup_id: &str) -> Result<BackupManifest, String> {
        let path = self.session_dir(backup_id)?.join("manifest.json");
        let raw = fs::read_to_string(&path)
            .map_err(|e| format!("Резервная копия «{backup_id}» не найдена: {e}"))?;
        serde_json::from_str(&raw)
            .map_err(|e| format!("Повреждённый манифест бэкапа «{backup_id}»: {e}"))
    }

    /// Возвращает список всех доступных резервных копий (от новых к старым).
    pub fn list_backups(&self) -> Result<Vec<BackupSummary>, String> {
        if !self.base_dir.is_dir() {
            return Ok(Vec::new());
        }
        let entries = fs::read_dir(&self.base_dir)
            .map_err(|e| format!("Не удалось прочитать папку резервных копий: {e}"))?;
        let mut items = Vec::new();
        for entry in entries.flatten() {
            let dir = entry.path();
            if !dir.is_dir() {
                continue;
            }
            let manifest_path = dir.join("manifest.json");
            if !manifest_path.is_file() {
                continue;
            }
            if let Ok(raw) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) = serde_json::from_str::<BackupManifest>(&raw) {
                    items.push(BackupSummary {
                        backup_id: manifest.backup_id,
                        created_at_unix: manifest.created_at_unix,
                        label: manifest.label,
                        cfg_count: manifest.cfg_backups.len(),
                        registry_count: manifest.registry_backups.len(),
                        has_power_plan: manifest.power_plan_backup.is_some(),
                        restored: manifest.restored,
                        folder_path: dir.to_string_lossy().into_owned(),
                    });
                }
            }
        }
        items.sort_by(|a, b| b.backup_id.cmp(&a.backup_id));
        Ok(items)
    }

    /// Находит идентификатор последнего не откатанного снимка (либо самого свежего, если требуется).
    pub fn latest_active_backup_id(&self) -> Result<Option<String>, String> {
        let list = self.list_backups()?;
        Ok(list
            .into_iter()
            .find(|item| !item.restored)
            .map(|item| item.backup_id))
    }

    /// Восстанавливает только файлы конфигурации (`client.cfg` / `keys.cfg`) из снимка.
    pub fn restore_cfg_only(&self, backup_id: &str) -> Result<usize, String> {
        let manifest = self.load_manifest(backup_id)?;
        if !manifest.cfg_backups.is_empty() && steam_locator::is_rust_running() {
            return Err("Закройте Rust (RustClient.exe) перед восстановлением конфигурации.".into());
        }
        let session_dir = self.session_dir(backup_id)?;
        restore_cfg_list(&session_dir, &manifest.cfg_backups)
    }

    /// Восстанавливает только конкретные параметры реестра из снимка (используется в `RegistryCommand::rollback`).
    pub fn restore_registry_for_targets(
        &self,
        backup_id: &str,
        targets: &[RegistryTarget],
    ) -> Result<usize, String> {
        let manifest = self.load_manifest(backup_id)?;
        let selected: Vec<RegistryValueSnapshot> = manifest
            .registry_backups
            .iter()
            .filter(|snap| {
                targets.iter().any(|t| {
                    t.hive == snap.hive
                        && t.subkey.eq_ignore_ascii_case(&snap.subkey)
                        && t.value_name.eq_ignore_ascii_case(&snap.value_name)
                })
            })
            .cloned()
            .collect();
        restore_registry_snapshots(&selected)
    }

    /// Выполняет полный откат снимка (конфигурация Rust + реестр Windows + схема питания).
    pub fn restore_backup(&self, backup_id: Option<&str>) -> Result<RestoreReport, String> {
        let target_id = match backup_id {
            Some(id) if !id.trim().is_empty() => id.trim().to_string(),
            _ => self
                .latest_active_backup_id()?
                .ok_or_else(|| "Активных резервных копий RustFlow для отката не найдено.".to_string())?,
        };

        let mut manifest = self.load_manifest(&target_id)?;
        if !manifest.cfg_backups.is_empty() && steam_locator::is_rust_running() {
            return Err("Закройте Rust (RustClient.exe) перед откатом изменений.".into());
        }

        let session_dir = self.session_dir(&target_id)?;
        let restored_cfg_files = restore_cfg_list(&session_dir, &manifest.cfg_backups)?;
        let restored_registry_values = restore_registry_snapshots(&manifest.registry_backups)?;
        let restored_power_plan = match &manifest.power_plan_backup {
            Some(plan) => restore_power_plan_snapshot(plan)?,
            None => false,
        };

        manifest.restored = true;
        self.save_manifest(&manifest)?;

        Ok(RestoreReport {
            backup_id: target_id.clone(),
            restored_cfg_files,
            restored_registry_values,
            restored_power_plan,
            message: format!(
                "Откат снимка {target_id} выполнен (файлов: {restored_cfg_files}, ключей реестра: {restored_registry_values})."
            ),
        })
    }

    fn save_manifest(&self, manifest: &BackupManifest) -> Result<(), String> {
        let session_dir = self.session_dir(&manifest.backup_id)?;
        let path = session_dir.join("manifest.json");
        let json = serde_json::to_vec_pretty(manifest)
            .map_err(|e| format!("Не удалось сериализовать манифест: {e}"))?;
        write_atomic_bytes(&path, &json)
    }
}

/// Определяет стандартный каталог `%AppData%/RustFlow/backups`.
fn default_backup_root() -> Result<PathBuf, String> {
    if let Some(appdata) = std::env::var_os("APPDATA") {
        let p = PathBuf::from(appdata);
        if !p.as_os_str().is_empty() {
            return Ok(p.join("RustFlow").join("backups"));
        }
    }
    if let Some(home) = std::env::var_os("HOME") {
        let p = PathBuf::from(home);
        if !p.as_os_str().is_empty() {
            return Ok(p.join(".config").join("RustFlow").join("backups"));
        }
    }
    Ok(std::env::temp_dir().join("RustFlow").join("backups"))
}

fn validate_backup_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 80
        || !id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Некорректный идентификатор резервной копии.".into());
    }
    Ok(())
}

fn unix_seconds_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

/// Переводит Unix-время в компактную отметку `YYYYMMDD-HHMMSS` (UTC) без внешних зависимостей.
pub fn format_timestamp_utc(unix_secs: u64) -> String {
    let days = (unix_secs / 86_400) as i64;
    let rem = unix_secs % 86_400;
    let hour = rem / 3_600;
    let minute = (rem % 3_600) / 60;
    let second = rem % 60;

    // Алгоритм Ховарда Хиннанта для перевода дней от Unix-эпохи в (год, месяц, день).
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1_460 + doe / 36_524 - doe / 146_096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = y + if m <= 2 { 1 } else { 0 };

    format!("{year:04}{m:02}{d:02}-{hour:02}{minute:02}{second:02}")
}

/// Атомарная запись файла (через временный файл и `sync_all`).
pub fn write_atomic_bytes(path: &Path, bytes: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Не удалось создать папку «{}»: {e}", parent.display()))?;
    }
    let tmp_name = format!(
        ".{}.tmp-{}",
        path.file_name().and_then(|n| n.to_str()).unwrap_or("file"),
        std::process::id()
    );
    let tmp_path = path.with_file_name(tmp_name);
    {
        let mut f = OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(&tmp_path)
            .map_err(|e| format!("Не удалось открыть временный файл {}: {e}", tmp_path.display()))?;
        f.write_all(bytes)
            .and_then(|_| f.sync_all())
            .map_err(|e| format!("Ошибка записи файла {}: {e}", tmp_path.display()))?;
    }
    if path.exists() {
        fs::remove_file(path)
            .map_err(|e| format!("Не удалось обновить файл {}: {e}", path.display()))?;
    }
    fs::rename(&tmp_path, path)
        .map_err(|e| format!("Не удалось завершить сохранение {}: {e}", path.display()))?;
    Ok(())
}

fn restore_cfg_list(session_dir: &Path, cfg_backups: &[CfgFileSnapshot]) -> Result<usize, String> {
    let mut restored = 0usize;
    for snap in cfg_backups {
        let target = PathBuf::from(&snap.target_path);
        if snap.existed {
            let backup_file = session_dir.join(&snap.backup_file);
            if !backup_file.is_file() {
                return Err(format!(
                    "Файл резервной копии {} отсутствует.",
                    backup_file.display()
                ));
            }
            let bytes = fs::read(&backup_file)
                .map_err(|e| format!("Ошибка чтения бэкапа {}: {e}", backup_file.display()))?;
            write_atomic_bytes(&target, &bytes)?;
        } else if target.exists() {
            fs::remove_file(&target)
                .map_err(|e| format!("Не удалось удалить созданный файл {}: {e}", target.display()))?;
        }
        restored += 1;
    }
    Ok(restored)
}

pub fn encode_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for &b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

pub fn decode_hex(hex: &str) -> Result<Vec<u8>, String> {
    let clean = hex.trim();
    if clean.len() % 2 != 0 {
        return Err("Некорректная длина hex-строки.".into());
    }
    let mut out = Vec::with_capacity(clean.len() / 2);
    for chunk in clean.as_bytes().chunks_exact(2) {
        let pair = std::str::from_utf8(chunk).map_err(|_| "Некорректный hex.".to_string())?;
        let byte = u8::from_str_radix(pair, 16)
            .map_err(|_| format!("Некорректный hex-байт «{pair}»."))?;
        out.push(byte);
    }
    Ok(out)
}

#[cfg(target_os = "windows")]
fn open_hive(hive: RegistryHive) -> winreg::RegKey {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    match hive {
        RegistryHive::Hkcu => winreg::RegKey::predef(HKEY_CURRENT_USER),
        RegistryHive::Hklm => winreg::RegKey::predef(HKEY_LOCAL_MACHINE),
    }
}

#[cfg(target_os = "windows")]
fn reg_type_to_string(rt: &winreg::enums::RegType) -> &'static str {
    use winreg::enums::RegType::*;
    match rt {
        REG_NONE => "REG_NONE",
        REG_SZ => "REG_SZ",
        REG_EXPAND_SZ => "REG_EXPAND_SZ",
        REG_BINARY => "REG_BINARY",
        REG_DWORD => "REG_DWORD",
        REG_DWORD_BIG_ENDIAN => "REG_DWORD_BIG_ENDIAN",
        REG_LINK => "REG_LINK",
        REG_MULTI_SZ => "REG_MULTI_SZ",
        REG_RESOURCE_LIST => "REG_RESOURCE_LIST",
        REG_FULL_RESOURCE_DESCRIPTOR => "REG_FULL_RESOURCE_DESCRIPTOR",
        REG_RESOURCE_REQUIREMENTS_LIST => "REG_RESOURCE_REQUIREMENTS_LIST",
        REG_QWORD => "REG_QWORD",
    }
}

#[cfg(target_os = "windows")]
fn string_to_reg_type(name: &str) -> Result<winreg::enums::RegType, String> {
    use winreg::enums::RegType::*;
    match name {
        "REG_NONE" => Ok(REG_NONE),
        "REG_SZ" => Ok(REG_SZ),
        "REG_EXPAND_SZ" => Ok(REG_EXPAND_SZ),
        "REG_BINARY" => Ok(REG_BINARY),
        "REG_DWORD" => Ok(REG_DWORD),
        "REG_DWORD_BIG_ENDIAN" => Ok(REG_DWORD_BIG_ENDIAN),
        "REG_LINK" => Ok(REG_LINK),
        "REG_MULTI_SZ" => Ok(REG_MULTI_SZ),
        "REG_RESOURCE_LIST" => Ok(REG_RESOURCE_LIST),
        "REG_FULL_RESOURCE_DESCRIPTOR" => Ok(REG_FULL_RESOURCE_DESCRIPTOR),
        "REG_RESOURCE_REQUIREMENTS_LIST" => Ok(REG_RESOURCE_REQUIREMENTS_LIST),
        "REG_QWORD" => Ok(REG_QWORD),
        other => Err(format!("Неизвестный тип реестра: {other}")),
    }
}

#[cfg(target_os = "windows")]
fn format_display_reg_value(rt: &winreg::enums::RegType, bytes: &[u8]) -> Option<String> {
    use winreg::enums::RegType::*;
    match rt {
        REG_DWORD if bytes.len() >= 4 => {
            Some(u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]).to_string())
        }
        REG_QWORD if bytes.len() >= 8 => Some(
            u64::from_le_bytes([
                bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
            ])
            .to_string(),
        ),
        REG_SZ | REG_EXPAND_SZ => {
            let units: Vec<u16> = bytes
                .chunks_exact(2)
                .map(|c| u16::from_le_bytes([c[0], c[1]]))
                .take_while(|&u| u != 0)
                .collect();
            Some(String::from_utf16_lossy(&units))
        }
        _ => Some(format!("hex:{}", encode_hex(bytes))),
    }
}

#[cfg(target_os = "windows")]
fn capture_single_registry_value(target: &RegistryTarget) -> Result<RegistryValueSnapshot, String> {
    use winreg::enums::KEY_READ;

    let root = open_hive(target.hive);
    match root.open_subkey_with_flags(&target.subkey, KEY_READ) {
        Ok(key) => match key.get_raw_value(&target.value_name) {
            Ok(raw) => {
                let type_name = reg_type_to_string(&raw.vtype).to_string();
                let hex = encode_hex(&raw.bytes);
                let display = format_display_reg_value(&raw.vtype, &raw.bytes);
                Ok(RegistryValueSnapshot {
                    hive: target.hive,
                    subkey: target.subkey.clone(),
                    value_name: target.value_name.clone(),
                    existed: true,
                    key_existed: true,
                    reg_type: Some(type_name),
                    data_hex: Some(hex),
                    display_value: display,
                })
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(RegistryValueSnapshot {
                hive: target.hive,
                subkey: target.subkey.clone(),
                value_name: target.value_name.clone(),
                existed: false,
                key_existed: true,
                reg_type: None,
                data_hex: None,
                display_value: None,
            }),
            Err(e) => Err(format!(
                "Не удалось прочитать ключ реестра {}\\{}\\{}: {e}",
                target.hive.full_name(),
                target.subkey,
                target.value_name
            )),
        },
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(RegistryValueSnapshot {
            hive: target.hive,
            subkey: target.subkey.clone(),
            value_name: target.value_name.clone(),
            existed: false,
            key_existed: false,
            reg_type: None,
            data_hex: None,
            display_value: None,
        }),
        Err(e) => Err(format!(
            "Не удалось открыть ветку реестра {}\\{}: {e}",
            target.hive.full_name(),
            target.subkey
        )),
    }
}

#[cfg(not(target_os = "windows"))]
fn capture_single_registry_value(target: &RegistryTarget) -> Result<RegistryValueSnapshot, String> {
    Ok(RegistryValueSnapshot {
        hive: target.hive,
        subkey: target.subkey.clone(),
        value_name: target.value_name.clone(),
        existed: false,
        key_existed: false,
        reg_type: None,
        data_hex: None,
        display_value: None,
    })
}

/// Формирует содержимое файла `.reg` (Windows Registry Editor Version 5.00) для отката.
pub fn build_reg_file_content(snapshots: &[RegistryValueSnapshot]) -> String {
    use std::collections::BTreeMap;

    let mut by_key: BTreeMap<(u8, String), Vec<&RegistryValueSnapshot>> = BTreeMap::new();
    for snap in snapshots {
        let order = match snap.hive {
            RegistryHive::Hkcu => 0,
            RegistryHive::Hklm => 1,
        };
        by_key
            .entry((order, format!("{}\\{}", snap.hive.full_name(), snap.subkey)))
            .or_default()
            .push(snap);
    }

    let mut out = String::from("Windows Registry Editor Version 5.00\r\n\r\n");
    for ((_, full_key), values) in by_key {
        out.push('[');
        out.push_str(&full_key);
        out.push_str("]\r\n");

        for snap in values {
            let escaped_name = snap.value_name.replace('\\', "\\\\").replace('"', "\\\"");
            if !snap.existed {
                out.push_str(&format!("\"{escaped_name}\"=-\r\n"));
                continue;
            }
            let rt = snap.reg_type.as_deref().unwrap_or("REG_BINARY");
            let bytes = snap
                .data_hex
                .as_deref()
                .and_then(|h| decode_hex(h).ok())
                .unwrap_or_default();
            match rt {
                "REG_DWORD" if bytes.len() >= 4 => {
                    let v = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
                    out.push_str(&format!("\"{escaped_name}\"=dword:{v:08x}\r\n"));
                }
                "REG_SZ" => {
                    let text = snap.display_value.as_deref().unwrap_or("");
                    let esc = text.replace('\\', "\\\\").replace('"', "\\\"");
                    out.push_str(&format!("\"{escaped_name}\"=\"{esc}\"\r\n"));
                }
                _ => {
                    let type_prefix = match rt {
                        "REG_QWORD" => "hex(b):",
                        "REG_EXPAND_SZ" => "hex(2):",
                        "REG_MULTI_SZ" => "hex(7):",
                        _ => "hex:",
                    };
                    let comma_bytes: Vec<String> =
                        bytes.iter().map(|b| format!("{b:02x}")).collect();
                    out.push_str(&format!(
                        "\"{escaped_name}\"={type_prefix}{}\r\n",
                        comma_bytes.join(",")
                    ));
                }
            }
        }
        out.push_str("\r\n");
    }
    out
}

/// Записывает `.reg` файл в UTF-16LE с BOM (`0xFF 0xFE`), как требует `reg.exe import`.
fn write_utf16le_reg_file(path: &Path, content: &str) -> Result<(), String> {
    let mut bytes = Vec::with_capacity(2 + content.len() * 2);
    bytes.push(0xFF);
    bytes.push(0xFE);
    for unit in content.encode_utf16() {
        bytes.extend_from_slice(&unit.to_le_bytes());
    }
    write_atomic_bytes(path, &bytes)
}

#[cfg(target_os = "windows")]
fn export_touched_branches(registry_dir: &Path, snapshots: &[RegistryValueSnapshot]) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let mut seen = HashSet::new();
    for (idx, snap) in snapshots.iter().enumerate() {
        if !snap.key_existed {
            continue;
        }
        let full_path = format!("{}\\{}", snap.hive.full_name(), snap.subkey);
        if !seen.insert(full_path.to_ascii_lowercase()) {
            continue;
        }
        let export_path = registry_dir.join(format!("branch_{:02}.reg", idx + 1));
        let _ = std::process::Command::new("reg.exe")
            .args(["export", &full_path, &export_path.to_string_lossy(), "/y"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();
    }
}

#[cfg(not(target_os = "windows"))]
fn export_touched_branches(_registry_dir: &Path, _snapshots: &[RegistryValueSnapshot]) {}

#[cfg(target_os = "windows")]
fn restore_registry_snapshots(snapshots: &[RegistryValueSnapshot]) -> Result<usize, String> {
    use std::borrow::Cow;
    use winreg::enums::{KEY_READ, KEY_WRITE};
    use winreg::RegValue;

    if snapshots.is_empty() {
        return Ok(0);
    }

    let mut restored = 0usize;
    let mut needs_elevation: Vec<RegistryValueSnapshot> = Vec::new();

    for snap in snapshots.iter().rev() {
        let root = open_hive(snap.hive);
        if snap.existed {
            let Some(rt_name) = snap.reg_type.as_deref() else {
                continue;
            };
            let Some(hex) = snap.data_hex.as_deref() else {
                continue;
            };
            let bytes = decode_hex(hex)?;
            let vtype = string_to_reg_type(rt_name)?;
            match root.create_subkey(&snap.subkey) {
                Ok((key, _)) => {
                    let value = RegValue {
                        bytes: Cow::Owned(bytes),
                        vtype,
                    };
                    match key.set_raw_value(&snap.value_name, &value) {
                        Ok(()) => restored += 1,
                        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                            needs_elevation.push(snap.clone());
                        }
                        Err(e) => {
                            return Err(format!(
                                "Ошибка восстановления ключа {}\\{}\\{}: {e}",
                                snap.hive.full_name(),
                                snap.subkey,
                                snap.value_name
                            ));
                        }
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                    needs_elevation.push(snap.clone());
                }
                Err(e) => {
                    return Err(format!(
                        "Ошибка доступа к ветке {}\\{}: {e}",
                        snap.hive.full_name(),
                        snap.subkey
                    ));
                }
            }
        } else {
            match root.open_subkey_with_flags(&snap.subkey, KEY_READ | KEY_WRITE) {
                Ok(key) => match key.delete_value(&snap.value_name) {
                    Ok(()) => restored += 1,
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => restored += 1,
                    Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                        needs_elevation.push(snap.clone());
                    }
                    Err(e) => {
                        return Err(format!(
                            "Не удалось удалить добавленный параметр {}\\{}\\{}: {e}",
                            snap.hive.full_name(),
                            snap.subkey,
                            snap.value_name
                        ));
                    }
                },
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                    restored += 1;
                }
                Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                    needs_elevation.push(snap.clone());
                }
                Err(e) => {
                    return Err(format!(
                        "Не удалось открыть ветку {}\\{} при откате: {e}",
                        snap.hive.full_name(),
                        snap.subkey
                    ));
                }
            }
        }
    }

    if !needs_elevation.is_empty() {
        let reg_content = build_reg_file_content(&needs_elevation);
        let temp_reg = std::env::temp_dir().join(format!(
            "rustflow-restore-{}-{}.reg",
            std::process::id(),
            unix_seconds_now()
        ));
        write_utf16le_reg_file(&temp_reg, &reg_content)?;
        let res = run_elevated_reg_import(&temp_reg);
        let _ = fs::remove_file(&temp_reg);
        res?;
        restored += needs_elevation.len();
    }

    Ok(restored)
}

#[cfg(not(target_os = "windows"))]
fn restore_registry_snapshots(snapshots: &[RegistryValueSnapshot]) -> Result<usize, String> {
    Ok(snapshots.len())
}

/// Запускает `reg.exe import` с повышением прав (UAC) для восстановления веток `HKLM`.
#[cfg(target_os = "windows")]
pub fn run_elevated_reg_import(reg_file_path: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = std::process::Command::new("powershell.exe")
        .env("RUSTFLOW_REG_FILE", reg_file_path)
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "$p = Start-Process -FilePath 'reg.exe' -ArgumentList @('import', $env:RUSTFLOW_REG_FILE) -Verb RunAs -Wait -WindowStyle Hidden -PassThru; exit $p.ExitCode",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|e| format!("Не удалось запустить повышение прав UAC для реестра: {e}"))?;

    if !output.status.success() {
        return Err("Операция с веткой HKLM отменена в окне UAC или завершилась ошибкой.".into());
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn restore_power_plan_snapshot(plan: &PowerPlanSnapshot) -> Result<bool, String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let valid_guid = |s: &str| {
        s.len() == 36
            && s.bytes()
                .all(|b| b.is_ascii_hexdigit() || b == b'-')
    };
    if !valid_guid(&plan.original_guid) {
        return Err("Некорректный GUID исходной схемы питания.".into());
    }

    let status = std::process::Command::new("powercfg.exe")
        .args(["/setactive", &plan.original_guid])
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("Ошибка запуска powercfg: {e}"))?;
    if !status.success() {
        return Err("Не удалось вернуть исходную схему электропитания Windows.".into());
    }

    if let Some(created) = &plan.created_guid {
        if valid_guid(created) && !created.eq_ignore_ascii_case(&plan.original_guid) {
            let _ = std::process::Command::new("powercfg.exe")
                .args(["/delete", created])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }
    }

    Ok(true)
}

#[cfg(not(target_os = "windows"))]
fn restore_power_plan_snapshot(_plan: &PowerPlanSnapshot) -> Result<bool, String> {
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn timestamp_formats_valid_utc_date() {
        // 2026-11-22 00:00:00 UTC = 1795305600
        assert_eq!(format_timestamp_utc(0), "19700101-000000");
        assert_eq!(format_timestamp_utc(1_700_000_000), "20231114-221320");
    }

    #[test]
    fn hex_roundtrip_works() {
        let original = vec![0x01, 0x00, 0xfe, 0xff, 0x2a];
        let hex = encode_hex(&original);
        assert_eq!(hex, "0100feff2a");
        assert_eq!(decode_hex(&hex).unwrap(), original);
    }

    #[test]
    fn cfg_snapshot_and_full_restore_existing_and_absent_files() {
        let base = std::env::temp_dir().join(format!("rustflow_backup_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let backups_root = base.join("backups");
        let game_cfg = base.join("Rust").join("cfg");
        fs::create_dir_all(&game_cfg).unwrap();

        let existing_cfg = game_cfg.join("client.cfg");
        let new_cfg = game_cfg.join("keys.cfg");
        fs::write(&existing_cfg, b"gc.buffer \"256\"\n").unwrap();

        let manager = BackupManager::with_base_dir(backups_root);
        let id = manager.create_session("test-session").unwrap();

        manager.snapshot_cfg_file(&id, &existing_cfg).unwrap();
        manager.snapshot_cfg_file(&id, &new_cfg).unwrap();

        // Повторный вызов в той же сессии не должен перезатирать исходный снимок.
        fs::write(&existing_cfg, b"gc.buffer \"4096\"\n").unwrap();
        fs::write(&new_cfg, b"bind f1 consoletoggle\n").unwrap();
        manager.snapshot_cfg_file(&id, &existing_cfg).unwrap();

        let report = manager.restore_backup(Some(&id)).unwrap();
        assert_eq!(report.restored_cfg_files, 2);
        assert_eq!(
            fs::read_to_string(&existing_cfg).unwrap(),
            "gc.buffer \"256\"\n"
        );
        assert!(!new_cfg.exists());
        assert!(manager.load_manifest(&id).unwrap().restored);

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn generates_valid_reg_file_for_existing_and_new_entries() {
        let snaps = vec![
            RegistryValueSnapshot {
                hive: RegistryHive::Hkcu,
                subkey: r"Software\Microsoft\GameBar".into(),
                value_name: "AutoGameModeEnabled".into(),
                existed: true,
                key_existed: true,
                reg_type: Some("REG_DWORD".into()),
                data_hex: Some("00000000".into()),
                display_value: Some("0".into()),
            },
            RegistryValueSnapshot {
                hive: RegistryHive::Hklm,
                subkey: r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers".into(),
                value_name: "HwSchMode".into(),
                existed: false,
                key_existed: true,
                reg_type: None,
                data_hex: None,
                display_value: None,
            },
        ];
        let text = build_reg_file_content(&snaps);
        assert!(text.starts_with("Windows Registry Editor Version 5.00"));
        assert!(text.contains(r"[HKEY_CURRENT_USER\Software\Microsoft\GameBar]"));
        assert!(text.contains("\"AutoGameModeEnabled\"=dword:00000000"));
        assert!(text.contains("\"HwSchMode\"=-"));
    }
}
