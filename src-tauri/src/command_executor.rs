//! Единый диспетчер выполнения твиков на базе паттерна «Команда» (Command Pattern).
//!
//! Связывает шаги из каталога `src/lib/tweaks/` с нативным исполнением в Windows:
//! - [`ClientCfgCommand`] — безопасное обновление параметров в `Rust/cfg/client.cfg` и `keys.cfg`;
//! - [`RegistryCommand`] — чтение и запись ключей реестра через `winreg` с предварительным снимком;
//! - [`DriverActionCommand`] — открытие официальных страниц драйверов/DDU или запуск скачанного
//!   установщика (`.exe` / `.msi`) с запросом прав администратора (UAC);
//! - [`PowerPlanCommand`] — клонирование и активация схемы питания «Максимальная производительность»;
//! - [`RestorePointCommand`] — создание точки восстановления системы Windows;
//! - [`ManualAdvisoryCommand`] — фиксация ручных инструкций/чек-листов из пакета твиков.

use crate::backup_manager::{
    write_atomic_bytes, BackupManager, RegistryHive, RegistryTarget, RestoreReport,
};
use crate::steam_locator;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// Целевой файл конфигурации игры Rust.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum CfgTarget {
    Client,
    Keys,
}

/// Пара ключ-значение для файла конфигурации Rust (`client.cfg` / `keys.cfg`).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CfgKeyValue {
    pub key: String,
    pub value: String,
}

/// Целевой тип и значение параметра реестра Windows для записи.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", content = "value", rename_all = "camelCase")]
pub enum RegistryDesiredValue {
    Dword(u32),
    Sz(String),
    ExpandSz(String),
    Qword(u64),
    Binary(Vec<u8>),
}

/// Описание одной операции записи в реестр Windows.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RegistryWriteOp {
    pub hive: RegistryHive,
    pub subkey: String,
    pub value_name: String,
    pub desired: RegistryDesiredValue,
    pub requires_reboot: bool,
}

/// Варианты действий с драйверами и утилитами очистки (DDU / NVCleanstall).
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DriverActionKind {
    /// Открыть официальную страницу загрузки драйвера или DDU в браузере по умолчанию.
    OpenSupportUrl { vendor_key: String },
    /// Запустить скачанный локальный установщик драйвера или DDU с запросом прав UAC.
    LaunchInstaller { installer_path: String },
}

/// Найденный в папке «Загрузки» установщик драйвера или DDU.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct DetectedInstaller {
    pub file_name: String,
    pub full_path: String,
    pub size_bytes: u64,
    pub kind: String,
}

/// Входной план выполнения твиков, передаваемый с фронтенда (`src/lib/tweaks/`).
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TweakExecutionPlan {
    pub cfg: Option<String>,
    #[serde(default)]
    pub cfg_entries: Vec<CfgKeyValue>,
    #[serde(default)]
    pub slugs: Vec<String>,
    pub windows_version: Option<String>,
    pub custom_rust_dir: Option<String>,
}

/// Результат выполнения или отката одной команды паттерна Command.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandOutcome {
    pub command_id: String,
    pub title: String,
    pub applied: bool,
    pub changed_count: usize,
    pub message: String,
    pub backup_id: Option<String>,
    pub requires_reboot: bool,
}

/// Сводный отчёт о пакетном выполнении списка команд.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchExecutionReport {
    pub backup_id: String,
    pub outcomes: Vec<CommandOutcome>,
    pub total_changed: usize,
    pub requires_reboot: bool,
    pub message: String,
}

/// Базовый трейт паттерна «Команда» (Command Pattern).
///
/// Каждая системная операция инкапсулирует все параметры и ссылку на `BackupManager`,
/// гарантируя предварительный снимок состояния до любых изменений и корректный откат.
pub trait TweakCommand: Send + Sync {
    /// Уникальный идентификатор команды (например, `"client-cfg"`, `"tweak:hags"`).
    fn id(&self) -> &str;
    /// Человекочитаемое название шага на русском языке.
    fn title(&self) -> &str;
    /// Применяет изменение после обязательного резервного копирования.
    fn apply(&self) -> Result<CommandOutcome, String>;
    /// Откатывает изменение к состоянию, сохранённому в резервной копии.
    fn rollback(&self) -> Result<CommandOutcome, String>;
}

/// Проверяет допустимость имени консольной переменной Rust (`gc.buffer`, `lerp.smoothing`, `graphics.quality` и т.д.).
pub fn is_valid_cfg_key(key: &str) -> bool {
    !key.is_empty()
        && key.len() <= 64
        && key
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'_')
}

/// Разбирает текстовое содержимое `client.cfg` в список валидированных пар `(ключ, значение)`.
pub fn parse_cfg_entries(raw: &str) -> Result<Vec<CfgKeyValue>, String> {
    if raw.len() > 128 * 1024 || raw.contains('\0') {
        return Err("Размер конфигурации превышает 128 КБ или содержит недопустимые символы.".into());
    }

    let mut entries = Vec::new();
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("//") || trimmed.starts_with('#') {
            continue;
        }
        let mut parts = trimmed.splitn(2, char::is_whitespace);
        let key = parts.next().unwrap_or("").trim();
        if !is_valid_cfg_key(key) {
            continue;
        }
        let value = parts
            .next()
            .unwrap_or("")
            .trim()
            .trim_matches('"')
            .replace(['"', '\r', '\n', '\0'], "");
        entries.push(CfgKeyValue {
            key: key.to_string(),
            value,
        });
    }
    Ok(entries)
}

/// Безопасно обновляет заданные параметры внутри существующего `client.cfg`,
/// не удаляя остальные пользовательские настройки и привязки клавиш.
pub fn merge_cfg_content(existing: &str, updates: &[CfgKeyValue]) -> (String, usize) {
    let mut map: BTreeMap<String, String> = BTreeMap::new();
    for item in updates {
        let k = item.key.trim();
        if !is_valid_cfg_key(k) {
            continue;
        }
        let v = item.value.replace(['"', '\r', '\n', '\0'], "");
        map.insert(k.to_string(), v);
    }

    let mut out_lines: Vec<String> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();
    let mut changed = 0usize;

    for line in existing.lines() {
        let key = line.split_whitespace().next().unwrap_or("");
        if let Some(new_val) = map.get(key) {
            if seen.insert(key.to_string()) {
                let formatted = format!("{key} \"{new_val}\"");
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

    let body = if out_lines.is_empty() {
        String::new()
    } else {
        format!("{}\r\n", out_lines.join("\r\n"))
    };
    (body, changed)
}

/// Команда безопасного обновления параметров в `client.cfg` или `keys.cfg`.
pub struct ClientCfgCommand {
    id: String,
    title: String,
    target: CfgTarget,
    entries: Vec<CfgKeyValue>,
    custom_rust_dir: Option<String>,
    explicit_path: Option<PathBuf>,
    backup_id: String,
    backup_manager: Arc<BackupManager>,
}

impl ClientCfgCommand {
    /// Создаёт команду обновления `client.cfg` / `keys.cfg` с привязкой к сессии бэкапа.
    pub fn new(
        target: CfgTarget,
        entries: Vec<CfgKeyValue>,
        custom_rust_dir: Option<String>,
        backup_id: String,
        backup_manager: Arc<BackupManager>,
    ) -> Result<Self, String> {
        let valid: Vec<CfgKeyValue> = entries
            .into_iter()
            .filter(|e| is_valid_cfg_key(e.key.trim()))
            .collect();
        if valid.is_empty() {
            return Err("Список корректных параметров конфигурации пуст.".into());
        }
        let (id, title) = match target {
            CfgTarget::Client => ("client-cfg".to_string(), "Обновление Rust/cfg/client.cfg".to_string()),
            CfgTarget::Keys => ("keys-cfg".to_string(), "Обновление Rust/cfg/keys.cfg".to_string()),
        };
        Ok(Self {
            id,
            title,
            target,
            entries: valid,
            custom_rust_dir,
            explicit_path: None,
            backup_id,
            backup_manager,
        })
    }

    /// Создаёт команду из сырого текста `.cfg` (например, из калькулятора или пресетов).
    pub fn from_raw_cfg(
        raw_cfg: &str,
        custom_rust_dir: Option<String>,
        backup_id: String,
        backup_manager: Arc<BackupManager>,
    ) -> Result<Self, String> {
        let parsed = parse_cfg_entries(raw_cfg)?;
        Self::new(
            CfgTarget::Client,
            parsed,
            custom_rust_dir,
            backup_id,
            backup_manager,
        )
    }

    /// Конструктор с явным путём к файлу (используется для модульных тестов без Steam).
    #[cfg(test)]
    pub fn with_explicit_path(
        explicit_path: PathBuf,
        entries: Vec<CfgKeyValue>,
        backup_id: String,
        backup_manager: Arc<BackupManager>,
    ) -> Result<Self, String> {
        let mut cmd = Self::new(CfgTarget::Client, entries, None, backup_id, backup_manager)?;
        cmd.explicit_path = Some(explicit_path);
        Ok(cmd)
    }

    fn resolve_target_path(&self) -> Result<PathBuf, String> {
        if let Some(ref p) = self.explicit_path {
            return Ok(p.clone());
        }
        if steam_locator::is_rust_running() {
            return Err("Закройте Rust (RustClient.exe) перед изменением конфигурации игры.".into());
        }
        let install = steam_locator::locate_rust_installation(self.custom_rust_dir.as_deref())?;
        Ok(match self.target {
            CfgTarget::Client => PathBuf::from(install.client_cfg_path),
            CfgTarget::Keys => PathBuf::from(install.keys_cfg_path),
        })
    }
}

impl TweakCommand for ClientCfgCommand {
    fn id(&self) -> &str {
        &self.id
    }

    fn title(&self) -> &str {
        &self.title
    }

    fn apply(&self) -> Result<CommandOutcome, String> {
        let target_path = self.resolve_target_path()?;

        // Обязательный снимок оригинального файла до любых изменений.
        self.backup_manager
            .snapshot_cfg_file(&self.backup_id, &target_path)?;

        let existing = if target_path.is_file() {
            fs::read_to_string(&target_path)
                .map_err(|e| format!("Не удалось прочитать {}: {e}", target_path.display()))?
        } else {
            String::new()
        };

        let (merged, changed_count) = merge_cfg_content(&existing, &self.entries);
        write_atomic_bytes(&target_path, merged.as_bytes())?;
        self.backup_manager
            .append_applied_command(&self.backup_id, &self.id)?;

        Ok(CommandOutcome {
            command_id: self.id.clone(),
            title: self.title.clone(),
            applied: true,
            changed_count,
            message: format!(
                "Файл {} обновлён (изменено параметров: {changed_count}). Снимок сохранён.",
                target_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("client.cfg")
            ),
            backup_id: Some(self.backup_id.clone()),
            requires_reboot: false,
        })
    }

    fn rollback(&self) -> Result<CommandOutcome, String> {
        let restored = self.backup_manager.restore_cfg_only(&self.backup_id)?;
        Ok(CommandOutcome {
            command_id: self.id.clone(),
            title: self.title.clone(),
            applied: false,
            changed_count: restored,
            message: format!("Конфигурация восстановлена из снимка {}.", self.backup_id),
            backup_id: Some(self.backup_id.clone()),
            requires_reboot: false,
        })
    }
}

/// Команда чтения и записи параметров реестра Windows через крейт `winreg`
/// с обязательным предварительным экспортом старого состояния.
pub struct RegistryCommand {
    id: String,
    title: String,
    operations: Vec<RegistryWriteOp>,
    backup_id: String,
    backup_manager: Arc<BackupManager>,
}

impl RegistryCommand {
    /// Строит команду реестра из slug-идентификатора твика в `src/lib/tweaks/`.
    pub fn from_tweak_slug(
        slug: &str,
        windows_version: Option<&str>,
        backup_id: String,
        backup_manager: Arc<BackupManager>,
    ) -> Option<Self> {
        let win11 = windows_version == Some("11");
        let (title, ops): (&str, Vec<RegistryWriteOp>) = match slug {
            "game-mode-dvr" => (
                "Игровой режим включён, Game DVR и Game Bar отключены",
                vec![
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Software\Microsoft\GameBar".into(),
                        value_name: "AutoGameModeEnabled".into(),
                        desired: RegistryDesiredValue::Dword(1),
                        requires_reboot: false,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Software\Microsoft\GameBar".into(),
                        value_name: "AllowAutoGameMode".into(),
                        desired: RegistryDesiredValue::Dword(1),
                        requires_reboot: false,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"System\GameConfigStore".into(),
                        value_name: "GameDVR_Enabled".into(),
                        desired: RegistryDesiredValue::Dword(0),
                        requires_reboot: false,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Software\Microsoft\Windows\CurrentVersion\GameDVR".into(),
                        value_name: "AppCaptureEnabled".into(),
                        desired: RegistryDesiredValue::Dword(0),
                        requires_reboot: false,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Software\Microsoft\Windows\CurrentVersion\GameDVR".into(),
                        value_name: "HistoricalCaptureEnabled".into(),
                        desired: RegistryDesiredValue::Dword(0),
                        requires_reboot: false,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hklm,
                        subkey: r"SOFTWARE\Policies\Microsoft\Windows\GameDVR".into(),
                        value_name: "AllowGameDVR".into(),
                        desired: RegistryDesiredValue::Dword(0),
                        requires_reboot: false,
                    },
                ],
            ),
            "hags" => (
                "Аппаратное планирование GPU (HAGS)",
                vec![RegistryWriteOp {
                    hive: RegistryHive::Hklm,
                    subkey: r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers".into(),
                    value_name: "HwSchMode".into(),
                    desired: RegistryDesiredValue::Dword(2),
                    requires_reboot: true,
                }],
            ),
            "background-apps" if !win11 => (
                "Запрет фоновых UWP-приложений (Windows 10)",
                vec![
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications".into(),
                        value_name: "GlobalUserDisabled".into(),
                        desired: RegistryDesiredValue::Dword(1),
                        requires_reboot: false,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Software\Microsoft\Windows\CurrentVersion\Search".into(),
                        value_name: "BackgroundAppGlobalToggle".into(),
                        desired: RegistryDesiredValue::Dword(0),
                        requires_reboot: false,
                    },
                ],
            ),
            "mouse-accel-off" => (
                "Отключение акселерации мыши (EPP)",
                vec![
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Control Panel\Mouse".into(),
                        value_name: "MouseSpeed".into(),
                        desired: RegistryDesiredValue::Sz("0".into()),
                        requires_reboot: true,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Control Panel\Mouse".into(),
                        value_name: "MouseThreshold1".into(),
                        desired: RegistryDesiredValue::Sz("0".into()),
                        requires_reboot: true,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Control Panel\Mouse".into(),
                        value_name: "MouseThreshold2".into(),
                        desired: RegistryDesiredValue::Sz("0".into()),
                        requires_reboot: true,
                    },
                ],
            ),
            "visual-effects" => (
                "Упрощение визуальных эффектов и прозрачности Windows",
                vec![
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize".into(),
                        value_name: "EnableTransparency".into(),
                        desired: RegistryDesiredValue::Dword(0),
                        requires_reboot: false,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Control Panel\Desktop\WindowMetrics".into(),
                        value_name: "MinAnimate".into(),
                        desired: RegistryDesiredValue::Sz("0".into()),
                        requires_reboot: true,
                    },
                    RegistryWriteOp {
                        hive: RegistryHive::Hkcu,
                        subkey: r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced".into(),
                        value_name: "TaskbarAnimations".into(),
                        desired: RegistryDesiredValue::Dword(0),
                        requires_reboot: false,
                    },
                ],
            ),
            "rust-priority" => (
                "Высокий приоритет планировщика CPU для RustClient.exe (IFEO)",
                vec![RegistryWriteOp {
                    hive: RegistryHive::Hklm,
                    subkey: r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\RustClient.exe\PerfOptions".into(),
                    value_name: "CpuPriorityClass".into(),
                    desired: RegistryDesiredValue::Dword(3),
                    requires_reboot: false,
                }],
            ),
            "shell-transparency" => (
                "Отключение прозрачности панели задач и меню Windows",
                vec![RegistryWriteOp {
                    hive: RegistryHive::Hkcu,
                    subkey: r"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize".into(),
                    value_name: "EnableTransparency".into(),
                    desired: RegistryDesiredValue::Dword(0),
                    requires_reboot: false,
                }],
            ),
            "menu-delay" => (
                "Ускорение открытия контекстных меню (MenuShowDelay = 250)",
                vec![RegistryWriteOp {
                    hive: RegistryHive::Hkcu,
                    subkey: r"Control Panel\Desktop".into(),
                    value_name: "MenuShowDelay".into(),
                    desired: RegistryDesiredValue::Sz("250".into()),
                    requires_reboot: true,
                }],
            ),
            "end-task" if win11 => (
                "Пункт «Завершить задачу» в контекстном меню панели задач (Win 11)",
                vec![RegistryWriteOp {
                    hive: RegistryHive::Hkcu,
                    subkey: r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced\TaskbarDeveloperSettings".into(),
                    value_name: "TaskbarEndTask".into(),
                    desired: RegistryDesiredValue::Dword(1),
                    requires_reboot: false,
                }],
            ),
            _ => return None,
        };

        Some(Self {
            id: format!("registry:{slug}"),
            title: title.to_string(),
            operations: ops,
            backup_id,
            backup_manager,
        })
    }

    fn targets(&self) -> Vec<RegistryTarget> {
        self.operations
            .iter()
            .map(|op| RegistryTarget {
                hive: op.hive,
                subkey: op.subkey.clone(),
                value_name: op.value_name.clone(),
            })
            .collect()
    }
}

impl TweakCommand for RegistryCommand {
    fn id(&self) -> &str {
        &self.id
    }

    fn title(&self) -> &str {
        &self.title
    }

    fn apply(&self) -> Result<CommandOutcome, String> {
        #[cfg(not(target_os = "windows"))]
        {
            Err("Изменение реестра Windows доступно только на Windows 10/11.".into())
        }

        #[cfg(target_os = "windows")]
        {
            let targets = self.targets();
            // Обязательный предварительный экспорт текущих значений и веток реестра.
            self.backup_manager
                .snapshot_registry_targets(&self.backup_id, &targets)?;

            let changed = apply_registry_operations(&self.operations)?;
            let requires_reboot = self.operations.iter().any(|op| op.requires_reboot);
            self.backup_manager
                .append_applied_command(&self.backup_id, &self.id)?;

            Ok(CommandOutcome {
                command_id: self.id.clone(),
                title: self.title.clone(),
                applied: true,
                changed_count: changed,
                message: format!("{}: применено параметров — {changed}.", self.title),
                backup_id: Some(self.backup_id.clone()),
                requires_reboot,
            })
        }
    }

    fn rollback(&self) -> Result<CommandOutcome, String> {
        let targets = self.targets();
        let restored = self
            .backup_manager
            .restore_registry_for_targets(&self.backup_id, &targets)?;
        let requires_reboot = self.operations.iter().any(|op| op.requires_reboot);

        Ok(CommandOutcome {
            command_id: self.id.clone(),
            title: self.title.clone(),
            applied: false,
            changed_count: restored,
            message: format!("{}: откат параметров выполнен ({restored}).", self.title),
            backup_id: Some(self.backup_id.clone()),
            requires_reboot,
        })
    }
}

#[cfg(target_os = "windows")]
fn desired_to_reg_value(desired: &RegistryDesiredValue) -> winreg::RegValue<'static> {
    use std::borrow::Cow;
    use winreg::enums::RegType::*;
    use winreg::RegValue;

    fn encode_utf16_sz(text: &str) -> Vec<u8> {
        text.encode_utf16()
            .chain(std::iter::once(0))
            .flat_map(|u| u.to_le_bytes())
            .collect()
    }

    match desired {
        RegistryDesiredValue::Dword(v) => RegValue {
            bytes: Cow::Owned(v.to_le_bytes().to_vec()),
            vtype: REG_DWORD,
        },
        RegistryDesiredValue::Qword(v) => RegValue {
            bytes: Cow::Owned(v.to_le_bytes().to_vec()),
            vtype: REG_QWORD,
        },
        RegistryDesiredValue::Sz(s) => RegValue {
            bytes: Cow::Owned(encode_utf16_sz(s)),
            vtype: REG_SZ,
        },
        RegistryDesiredValue::ExpandSz(s) => RegValue {
            bytes: Cow::Owned(encode_utf16_sz(s)),
            vtype: REG_EXPAND_SZ,
        },
        RegistryDesiredValue::Binary(b) => RegValue {
            bytes: Cow::Owned(b.clone()),
            vtype: REG_BINARY,
        },
    }
}

#[cfg(target_os = "windows")]
fn apply_registry_operations(operations: &[RegistryWriteOp]) -> Result<usize, String> {
    use crate::backup_manager::{
        build_reg_file_content, encode_hex, run_elevated_reg_import, RegistryValueSnapshot,
    };
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    let mut applied = 0usize;
    let mut needs_elevation: Vec<&RegistryWriteOp> = Vec::new();

    for op in operations {
        let root = match op.hive {
            RegistryHive::Hkcu => RegKey::predef(HKEY_CURRENT_USER),
            RegistryHive::Hklm => RegKey::predef(HKEY_LOCAL_MACHINE),
        };
        let raw = desired_to_reg_value(&op.desired);
        match root.create_subkey(&op.subkey) {
            Ok((key, _)) => match key.set_raw_value(&op.value_name, &raw) {
                Ok(()) => applied += 1,
                Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                    needs_elevation.push(op);
                }
                Err(e) => {
                    return Err(format!(
                        "Ошибка записи в реестр {}\\{}\\{}: {e}",
                        op.hive.full_name(),
                        op.subkey,
                        op.value_name
                    ));
                }
            },
            Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
                needs_elevation.push(op);
            }
            Err(e) => {
                return Err(format!(
                    "Ошибка открытия ветки реестра {}\\{}: {e}",
                    op.hive.full_name(),
                    op.subkey
                ));
            }
        }
    }

    if !needs_elevation.is_empty() {
        let snaps: Vec<RegistryValueSnapshot> = needs_elevation
            .iter()
            .map(|op| {
                let raw = desired_to_reg_value(&op.desired);
                let (rt, disp) = match &op.desired {
                    RegistryDesiredValue::Dword(v) => ("REG_DWORD", Some(v.to_string())),
                    RegistryDesiredValue::Qword(v) => ("REG_QWORD", Some(v.to_string())),
                    RegistryDesiredValue::Sz(s) => ("REG_SZ", Some(s.clone())),
                    RegistryDesiredValue::ExpandSz(s) => ("REG_EXPAND_SZ", Some(s.clone())),
                    RegistryDesiredValue::Binary(_) => ("REG_BINARY", None),
                };
                RegistryValueSnapshot {
                    hive: op.hive,
                    subkey: op.subkey.clone(),
                    value_name: op.value_name.clone(),
                    existed: true,
                    key_existed: true,
                    reg_type: Some(rt.to_string()),
                    data_hex: Some(encode_hex(&raw.bytes)),
                    display_value: disp,
                }
            })
            .collect();

        let reg_text = build_reg_file_content(&snaps);
        let temp_reg = std::env::temp_dir().join(format!(
            "rustflow-apply-{}.reg",
            std::process::id()
        ));
        let mut utf16 = Vec::with_capacity(2 + reg_text.len() * 2);
        utf16.push(0xFF);
        utf16.push(0xFE);
        for u in reg_text.encode_utf16() {
            utf16.extend_from_slice(&u.to_le_bytes());
        }
        write_atomic_bytes(&temp_reg, &utf16)?;
        let res = run_elevated_reg_import(&temp_reg);
        let _ = fs::remove_file(&temp_reg);
        res?;

        // Проверяем через winreg, что значения HKLM действительно применились.
        for op in &needs_elevation {
            let root = match op.hive {
                RegistryHive::Hkcu => RegKey::predef(HKEY_CURRENT_USER),
                RegistryHive::Hklm => RegKey::predef(HKEY_LOCAL_MACHINE),
            };
            let key = root
                .open_subkey_with_flags(&op.subkey, KEY_READ)
                .map_err(|_| format!("Не удалось подтвердить запись в HKLM\\{}.", op.subkey))?;
            let actual = key
                .get_raw_value(&op.value_name)
                .map_err(|_| format!("Параметр HKLM\\{}\\{} не был записан.", op.subkey, op.value_name))?;
            let expected = desired_to_reg_value(&op.desired);
            if actual.bytes.as_ref() != expected.bytes.as_ref() {
                return Err(format!(
                    "Значение {}\\{} не изменилось после UAC.",
                    op.subkey, op.value_name
                ));
            }
            applied += 1;
        }
    }

    Ok(applied)
}

/// Возвращает официальную безопасную ссылку на страницу драйвера или утилиты (DDU / NVCleanstall).
pub fn official_support_url(vendor_key: &str) -> Result<&'static str, String> {
    match vendor_key.trim().to_ascii_lowercase().as_str() {
        "ddu" => Ok("https://www.wagnardsoft.com/display-driver-uninstaller-ddu"),
        "nvcleanstall" => Ok("https://www.techpowerup.com/download/techpowerup-nvcleanstall/"),
        "nvidia" => Ok("https://www.nvidia.com/en-us/drivers/"),
        "radeon" | "amd" => Ok("https://www.amd.com/en/support/download/drivers.html"),
        "arc" | "intel" => Ok("https://www.intel.com/content/www/us/en/download/785597/intel-arc-graphics-windows.html"),
        "realtek" => Ok("https://www.realtek.com/Download/List?cate_id=593"),
        "ethernet" => Ok("https://www.realtek.com/Download/List?cate_id=584"),
        "am4am5" => Ok("https://www.amd.com/en/support/download/drivers.html"),
        "intelboard" => Ok("https://www.intel.com/content/www/us/en/download/19347/chipset-inf-utility.html"),
        other => Err(format!("Неизвестный источник драйвера: «{other}».")),
    }
}

/// Проверяет локальный путь к скачанному установщику драйвера или DDU перед запуском с UAC.
pub fn validate_installer_path(raw_path: &str) -> Result<PathBuf, String> {
    let trimmed = raw_path.trim().trim_matches('"');
    if trimmed.is_empty() || trimmed.contains('\0') {
        return Err("Путь к установщику пуст или содержит недопустимые символы.".into());
    }
    if trimmed.starts_with(r"\\") || trimmed.starts_with("//") {
        return Err("Запуск сетевых UNC-путей запрещён из соображений безопасности.".into());
    }
    let path = PathBuf::from(trimmed);
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("Относительные переходы '..' в пути к установщику запрещены.".into());
    }
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();
    if ext != "exe" && ext != "msi" {
        return Err("Разрешён запуск только локальных файлов .exe или .msi.".into());
    }
    if !path.is_file() {
        return Err(format!("Файл установщика не найден: {}", path.display()));
    }

    let canonical = fs::canonicalize(&path)
        .map_err(|e| format!("Не удалось проверить путь к файлу: {e}"))?;
    let canonical_lower = canonical.to_string_lossy().to_ascii_lowercase();
    if canonical_lower.starts_with(r"\\?\unc\") {
        return Err("Запуск сетевых UNC-путей запрещён.".into());
    }

    let file_name_lower = canonical
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_ascii_lowercase())
        .unwrap_or_default();
    for forbidden_shell in ["cmd.exe", "powershell.exe", "pwsh.exe", "wscript.exe", "cscript.exe", "mshta.exe", "regedit.exe"] {
        if file_name_lower == forbidden_shell {
            return Err("Прямой запуск системных интерпретаторов запрещён.".into());
        }
    }
    if let Some(windir) = std::env::var_os("WINDIR").or_else(|| std::env::var_os("SystemRoot")) {
        let windir_lower = windir.to_string_lossy().to_ascii_lowercase();
        let stripped = canonical_lower.strip_prefix(r"\\?\").unwrap_or(&canonical_lower);
        if !windir_lower.is_empty() && stripped.starts_with(&windir_lower) {
            return Err("Нельзя указывать системные файлы Windows как установщик драйвера.".into());
        }
    }

    Ok(canonical)
}

#[cfg(target_os = "windows")]
fn winapi_shell_execute(
    operation: &str,
    file: &str,
    params: Option<&str>,
    work_dir: Option<&str>,
) -> Result<(), String> {
    use windows_sys::Win32::Foundation::{GetLastError, ERROR_ACCESS_DENIED, ERROR_CANCELLED};
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    fn to_wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    let op_w = to_wide(operation);
    let file_w = to_wide(file);
    let params_w = params.map(to_wide);
    let dir_w = work_dir.map(to_wide);

    let hinst = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            op_w.as_ptr(),
            file_w.as_ptr(),
            params_w.as_ref().map_or(std::ptr::null(), |v| v.as_ptr()),
            dir_w.as_ref().map_or(std::ptr::null(), |v| v.as_ptr()),
            SW_SHOWNORMAL,
        )
    };

    let code = hinst as isize;
    if code <= 32 {
        let win_err = unsafe { GetLastError() };
        if win_err == ERROR_CANCELLED || code == ERROR_ACCESS_DENIED as isize {
            return Err("UAC_CANCELLED: Запрос прав администратора (UAC) отменён пользователем.".into());
        }
        return Err(format!(
            "Не удалось выполнить действие оболочки Windows (код ShellExecute: {code}, Win32: {win_err})."
        ));
    }

    Ok(())
}

/// Команда действий с драйверами: открытие официальных страниц или запуск установщика/DDU с UAC.
pub struct DriverActionCommand {
    id: String,
    title: String,
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    action: DriverActionKind,
}

impl DriverActionCommand {
    /// Создаёт команду открытия официальной страницы поддержки/загрузки.
    pub fn open_support(vendor_key: &str) -> Result<Self, String> {
        let _ = official_support_url(vendor_key)?;
        Ok(Self {
            id: format!("driver-url:{vendor_key}"),
            title: format!("Открытие официального источника драйвера ({vendor_key})"),
            action: DriverActionKind::OpenSupportUrl {
                vendor_key: vendor_key.trim().to_ascii_lowercase(),
            },
        })
    }

    /// Создаёт команду запуска локально скачанного установщика драйвера или DDU с UAC.
    pub fn launch_installer(installer_path: &str) -> Result<Self, String> {
        let validated = validate_installer_path(installer_path)?;
        Ok(Self {
            id: "driver-installer".to_string(),
            title: format!(
                "Запуск установщика {} (UAC)",
                validated
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("driver")
            ),
            action: DriverActionKind::LaunchInstaller {
                installer_path: validated.to_string_lossy().into_owned(),
            },
        })
    }
}

impl TweakCommand for DriverActionCommand {
    fn id(&self) -> &str {
        &self.id
    }

    fn title(&self) -> &str {
        &self.title
    }

    fn apply(&self) -> Result<CommandOutcome, String> {
        #[cfg(not(target_os = "windows"))]
        {
            Err("Действия с драйверами Windows доступны только на Windows 10/11.".into())
        }

        #[cfg(target_os = "windows")]
        {
            match &self.action {
                DriverActionKind::OpenSupportUrl { vendor_key } => {
                    let url = official_support_url(vendor_key)?;
                    winapi_shell_execute("open", url, None, None)?;
                    Ok(CommandOutcome {
                        command_id: self.id.clone(),
                        title: self.title.clone(),
                        applied: true,
                        changed_count: 1,
                        message: format!("Открыта официальная страница загрузки: {url}"),
                        backup_id: None,
                        requires_reboot: false,
                    })
                }
                DriverActionKind::LaunchInstaller { installer_path } => {
                    let validated = validate_installer_path(installer_path)?;
                    let clean_str = validated.to_string_lossy();
                    let clean_path = clean_str.strip_prefix(r"\\?\").unwrap_or(&clean_str);
                    let work_dir = Path::new(clean_path)
                        .parent()
                        .map(|p| p.to_string_lossy().into_owned());
                    let is_msi = Path::new(clean_path)
                        .extension()
                        .and_then(|e| e.to_str())
                        .is_some_and(|e| e.eq_ignore_ascii_case("msi"));

                    if is_msi {
                        let args = format!("/i \"{clean_path}\"");
                        winapi_shell_execute(
                            "runas",
                            "msiexec.exe",
                            Some(&args),
                            work_dir.as_deref(),
                        )?;
                    } else {
                        winapi_shell_execute(
                            "runas",
                            clean_path,
                            None,
                            work_dir.as_deref(),
                        )?;
                    }

                    Ok(CommandOutcome {
                        command_id: self.id.clone(),
                        title: self.title.clone(),
                        applied: true,
                        changed_count: 1,
                        message: format!(
                            "Установщик «{}» запущен с правами администратора (UAC).",
                            Path::new(clean_path)
                                .file_name()
                                .and_then(|n| n.to_str())
                                .unwrap_or("installer")
                        ),
                        backup_id: None,
                        requires_reboot: true,
                    })
                }
            }
        }
    }

    fn rollback(&self) -> Result<CommandOutcome, String> {
        #[cfg(target_os = "windows")]
        if matches!(self.action, DriverActionKind::LaunchInstaller { .. }) {
            let _ = winapi_shell_execute("open", "devmgmt.msc", None, None);
            return Ok(CommandOutcome {
                command_id: self.id.clone(),
                title: self.title.clone(),
                applied: false,
                changed_count: 0,
                message: "Открыт Диспетчер устройств Windows (Видеоадаптеры → Свойства → Откатить драйвер).".into(),
                backup_id: None,
                requires_reboot: false,
            });
        }

        Ok(CommandOutcome {
            command_id: self.id.clone(),
            title: self.title.clone(),
            applied: false,
            changed_count: 0,
            message: "Открытие официальной ссылки не изменяло систему — откат не требуется.".into(),
            backup_id: None,
            requires_reboot: false,
        })
    }
}

/// Сканирует `%USERPROFILE%\Downloads` на наличие скачанных установщиков драйверов и DDU.
pub fn find_downloaded_installers(family: Option<&str>) -> Result<Vec<DetectedInstaller>, String> {
    let profile = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
        .ok_or_else(|| "Не удалось определить домашнюю папку пользователя.".to_string())?;
    let downloads = profile.join("Downloads");
    if !downloads.is_dir() {
        return Ok(Vec::new());
    }

    let family_filter = family.map(|f| f.trim().to_ascii_lowercase());
    let mut found = Vec::new();
    let entries = fs::read_dir(&downloads)
        .map_err(|e| format!("Не удалось прочитать папку «Загрузки»: {e}"))?;

    for entry in entries.flatten().take(200) {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_ascii_lowercase())
            .unwrap_or_default();
        if ext != "exe" && ext != "msi" {
            continue;
        }
        let name = path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        let lower = name.to_ascii_lowercase();

        let kind = if lower.contains("ddu") || lower.contains("display driver uninstaller") {
            "ddu"
        } else if lower.contains("nvcleanstall") {
            "nvcleanstall"
        } else if lower.contains("nvidia") || lower.contains("geforce") || lower.contains("dch-whql") {
            "nvidia"
        } else if lower.contains("adrenalin") || lower.contains("radeon") || lower.contains("whql-amd") {
            "amd"
        } else if lower.contains("gfx_win") || lower.contains("intel") {
            "intel"
        } else {
            continue;
        };

        if let Some(ref fam) = family_filter {
            if !fam.is_empty() && kind != fam && kind != "ddu" && !(fam == "nvidia" && kind == "nvcleanstall") {
                continue;
            }
        }

        let size_bytes = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        found.push(DetectedInstaller {
            file_name: name,
            full_path: path.to_string_lossy().into_owned(),
            size_bytes,
            kind: kind.to_string(),
        });
    }

    found.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(found)
}

/// Команда клонирования и активации схемы питания «Максимальная производительность».
pub struct PowerPlanCommand {
    id: String,
    title: String,
    backup_id: String,
    backup_manager: Arc<BackupManager>,
}

impl PowerPlanCommand {
    pub fn new(backup_id: String, backup_manager: Arc<BackupManager>) -> Self {
        Self {
            id: "tweak:ultimate-power-plan".to_string(),
            title: "Схема электропитания RustFlow Performance".to_string(),
            backup_id,
            backup_manager,
        }
    }
}

/// Извлекает первый GUID вида `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` из вывода `powercfg`.
pub fn extract_guid(text: &str) -> Option<String> {
    for token in text.split(|c: char| !c.is_ascii_hexdigit() && c != '-') {
        if token.len() == 36
            && token.as_bytes().get(8) == Some(&b'-')
            && token.as_bytes().get(13) == Some(&b'-')
            && token.as_bytes().get(18) == Some(&b'-')
            && token.as_bytes().get(23) == Some(&b'-')
        {
            return Some(token.to_string());
        }
    }
    None
}

impl TweakCommand for PowerPlanCommand {
    fn id(&self) -> &str {
        &self.id
    }

    fn title(&self) -> &str {
        &self.title
    }

    fn apply(&self) -> Result<CommandOutcome, String> {
        #[cfg(not(target_os = "windows"))]
        {
            Err("Настройка схемы питания доступна только на Windows 10/11.".into())
        }

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            let active_out = std::process::Command::new("powercfg.exe")
                .args(["/getactivescheme"])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| format!("Не удалось опросить powercfg: {e}"))?;
            let original_guid = extract_guid(&String::from_utf8_lossy(&active_out.stdout))
                .ok_or_else(|| "Не удалось определить активный GUID схемы питания.".to_string())?;

            self.backup_manager
                .record_power_plan_backup(&self.backup_id, &original_guid, None)?;

            // Сначала пробуем клонировать Ultimate Performance, при отсутствии — High Performance.
            let mut created_guid: Option<String> = None;
            for template_guid in [
                "e9a42b02-d5df-448d-aa00-03f14749eb61",
                "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c",
            ] {
                if let Ok(dup) = std::process::Command::new("powercfg.exe")
                    .args(["/duplicatescheme", template_guid])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output()
                {
                    if dup.status.success() {
                        if let Some(guid) = extract_guid(&String::from_utf8_lossy(&dup.stdout)) {
                            created_guid = Some(guid);
                            break;
                        }
                    }
                }
            }

            let target_guid = created_guid
                .as_deref()
                .unwrap_or("8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c")
                .to_string();

            if created_guid.is_some() {
                self.backup_manager.record_power_plan_backup(
                    &self.backup_id,
                    &original_guid,
                    Some(&target_guid),
                )?;
                let _ = std::process::Command::new("powercfg.exe")
                    .args(["/changename", &target_guid, "RustFlow Performance"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .status();
            }

            let act = std::process::Command::new("powercfg.exe")
                .args(["/setactive", &target_guid])
                .creation_flags(CREATE_NO_WINDOW)
                .status()
                .map_err(|e| format!("Не удалось активировать схему питания: {e}"))?;
            if !act.success() {
                return Err("Не удалось переключить активную схему электропитания.".into());
            }

            self.backup_manager
                .append_applied_command(&self.backup_id, &self.id)?;

            Ok(CommandOutcome {
                command_id: self.id.clone(),
                title: self.title.clone(),
                applied: true,
                changed_count: 1,
                message: format!(
                    "Активирована схема питания RustFlow Performance (исходная {original_guid} сохранена)."
                ),
                backup_id: Some(self.backup_id.clone()),
                requires_reboot: false,
            })
        }
    }

    fn rollback(&self) -> Result<CommandOutcome, String> {
        let report = self.backup_manager.restore_backup(Some(&self.backup_id))?;
        Ok(CommandOutcome {
            command_id: self.id.clone(),
            title: self.title.clone(),
            applied: false,
            changed_count: usize::from(report.restored_power_plan),
            message: "Исходная схема электропитания Windows восстановлена.".into(),
            backup_id: Some(self.backup_id.clone()),
            requires_reboot: false,
        })
    }
}

/// Команда создания точки восстановления системы Windows (требует UAC).
pub struct RestorePointCommand {
    id: String,
    title: String,
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    description: String,
}

impl RestorePointCommand {
    pub fn new(description: &str) -> Self {
        let clean: String = description
            .chars()
            .filter(|c| c.is_ascii_alphanumeric() || *c == ' ' || *c == '-' || *c == '_')
            .take(48)
            .collect();
        Self {
            id: "tweak:restore-point".to_string(),
            title: "Создание точки восстановления Windows".to_string(),
            description: if clean.is_empty() {
                "RustFlow - before tweaks".to_string()
            } else {
                clean
            },
        }
    }
}

impl TweakCommand for RestorePointCommand {
    fn id(&self) -> &str {
        &self.id
    }

    fn title(&self) -> &str {
        &self.title
    }

    fn apply(&self) -> Result<CommandOutcome, String> {
        #[cfg(not(target_os = "windows"))]
        {
            Err("Точки восстановления доступны только в Windows 10/11.".into())
        }

        #[cfg(target_os = "windows")]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;

            let output = std::process::Command::new("powershell.exe")
                .env("RUSTFLOW_RP_DESC", &self.description)
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "$p = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile','-NonInteractive','-Command',\"Checkpoint-Computer -Description '$($env:RUSTFLOW_RP_DESC)' -RestorePointType MODIFY_SETTINGS\") -Verb RunAs -Wait -WindowStyle Hidden -PassThru; exit $p.ExitCode",
                ])
                .creation_flags(CREATE_NO_WINDOW)
                .output()
                .map_err(|e| format!("Не удалось запустить создание точки восстановления: {e}"))?;

            if !output.status.success() {
                return Err(
                    "Не удалось создать точку восстановления (UAC отменён или Защита системы отключена на диске C:).".into(),
                );
            }

            Ok(CommandOutcome {
                command_id: self.id.clone(),
                title: self.title.clone(),
                applied: true,
                changed_count: 1,
                message: format!("Точка восстановления «{}» создана.", self.description),
                backup_id: None,
                requires_reboot: false,
            })
        }
    }

    fn rollback(&self) -> Result<CommandOutcome, String> {
        Ok(CommandOutcome {
            command_id: self.id.clone(),
            title: self.title.clone(),
            applied: false,
            changed_count: 0,
            message: "Точка восстановления остаётся доступной через rstrui.exe.".into(),
            backup_id: None,
            requires_reboot: false,
        })
    }
}

/// Информационный шаг (чек-лист, параметры запуска Steam, панель видеокарты) без вмешательства в реестр.
pub struct ManualAdvisoryCommand {
    id: String,
    title: String,
}

impl ManualAdvisoryCommand {
    pub fn new(slug: &str) -> Self {
        let title = match slug {
            "steam-checklist" => "Чек-лист Steam (отключение оверлея и предзагрузки)",
            "nvidia-panel" => "Профиль 3D в Панели управления NVIDIA",
            "amd-adrenalin" => "Профиль игры в AMD Software: Adrenalin Edition",
            "launch-options" => "Параметры запуска Rust в свойствах Steam",
            "binds" => "Полезные бинды консоли Rust (keys.cfg)",
            "windows-10-graphics" => "Настройки графики Windows 10 для RustClient.exe",
            "windows-11-graphics" => "Настройки графики Windows 11 для RustClient.exe",
            "rust-library-ssd" => "Проверка установки Rust на SSD/NVMe",
            "pagefile-auto" => "Проверка автоматического файла подкачки Windows",
            "ssd-trim-free-space" => "Проверка TRIM и свободного места на SSD",
            _ => "Рекомендация из каталога твиков RustFlow",
        };
        Self {
            id: format!("advisory:{slug}"),
            title: title.to_string(),
        }
    }
}

impl TweakCommand for ManualAdvisoryCommand {
    fn id(&self) -> &str {
        &self.id
    }

    fn title(&self) -> &str {
        &self.title
    }

    fn apply(&self) -> Result<CommandOutcome, String> {
        Ok(CommandOutcome {
            command_id: self.id.clone(),
            title: self.title.clone(),
            applied: true,
            changed_count: 0,
            message: format!("{}: инструкция зафиксирована в отчёте (ручная настройка в клиенте/панели).", self.title),
            backup_id: None,
            requires_reboot: false,
        })
    }

    fn rollback(&self) -> Result<CommandOutcome, String> {
        Ok(CommandOutcome {
            command_id: self.id.clone(),
            title: self.title.clone(),
            applied: false,
            changed_count: 0,
            message: "Информационный шаг не изменял файлы или реестр.".into(),
            backup_id: None,
            requires_reboot: false,
        })
    }
}

/// Единый диспетчер паттерна «Команда»: формирует очередь команд из `src/lib/tweaks/`,
/// создаёт обязательный снимок до начала работы и откатывает при сбое.
pub struct CommandExecutor {
    backup_manager: Arc<BackupManager>,
}

impl CommandExecutor {
    /// Создаёт диспетчер со стандартным каталогом `%AppData%/RustFlow/backups`.
    pub fn new() -> Result<Self, String> {
        Ok(Self {
            backup_manager: Arc::new(BackupManager::new()?),
        })
    }

    /// Создаёт диспетчер поверх переданного экземпляра `BackupManager`.
    pub fn with_backup_manager(backup_manager: Arc<BackupManager>) -> Self {
        Self { backup_manager }
    }

    /// Возвращает ссылку на используемый менеджер резервных копий.
    pub fn backup_manager(&self) -> &Arc<BackupManager> {
        &self.backup_manager
    }

    /// Создаёт резервную копию текущего `client.cfg` (и `keys.cfg` при наличии).
    pub fn backup_game_configs(&self, custom_rust_dir: Option<&str>) -> Result<String, String> {
        let install = steam_locator::locate_rust_installation(custom_rust_dir)?;
        let backup_id = self.backup_manager.create_session("manual-cfg-backup")?;
        self.backup_manager
            .snapshot_cfg_file(&backup_id, Path::new(&install.client_cfg_path))?;
        if install.keys_cfg_exists {
            self.backup_manager
                .snapshot_cfg_file(&backup_id, Path::new(&install.keys_cfg_path))?;
        }
        Ok(backup_id)
    }

    /// Применяет только обновление `client.cfg` через `ClientCfgCommand` с обязательным бэкапом.
    pub fn apply_client_cfg_only(
        &self,
        raw_cfg: &str,
        custom_rust_dir: Option<&str>,
    ) -> Result<CommandOutcome, String> {
        let backup_id = self.backup_manager.create_session("client-cfg")?;
        let cmd = ClientCfgCommand::from_raw_cfg(
            raw_cfg,
            custom_rust_dir.map(|s| s.to_string()),
            backup_id.clone(),
            Arc::clone(&self.backup_manager),
        )?;
        match cmd.apply() {
            Ok(outcome) => Ok(outcome),
            Err(err) => {
                let _ = self.backup_manager.restore_backup(Some(&backup_id));
                Err(err)
            }
        }
    }

    /// Строит упорядоченный список команд из входного плана `TweakExecutionPlan`.
    pub fn build_commands(
        &self,
        plan: &TweakExecutionPlan,
        backup_id: &str,
    ) -> Result<Vec<Box<dyn TweakCommand>>, String> {
        let mut commands: Vec<Box<dyn TweakCommand>> = Vec::new();
        let win_ver = plan.windows_version.as_deref();

        // 1. Сначала создаём точку восстановления, если пользователь выбрал этот шаг.
        if plan.slugs.iter().any(|s| s == "restore-point") {
            commands.push(Box::new(RestorePointCommand::new("RustFlow - before tweaks")));
        }

        // 2. Обновляем параметры Rust/cfg/client.cfg (если передан cfg или entries).
        if !plan.cfg_entries.is_empty() {
            commands.push(Box::new(ClientCfgCommand::new(
                CfgTarget::Client,
                plan.cfg_entries.clone(),
                plan.custom_rust_dir.clone(),
                backup_id.to_string(),
                Arc::clone(&self.backup_manager),
            )?));
        } else if let Some(ref cfg_text) = plan.cfg {
            if !cfg_text.trim().is_empty() {
                commands.push(Box::new(ClientCfgCommand::from_raw_cfg(
                    cfg_text,
                    plan.custom_rust_dir.clone(),
                    backup_id.to_string(),
                    Arc::clone(&self.backup_manager),
                )?));
            }
        }

        // 3. Далее обрабатываем шаги из каталога `src/lib/tweaks/` (без дублирования).
        let mut seen_slugs = HashSet::new();
        for slug in &plan.slugs {
            if slug == "restore-point" || !seen_slugs.insert(slug.clone()) {
                continue;
            }
            if let Some(reg_cmd) = RegistryCommand::from_tweak_slug(
                slug,
                win_ver,
                backup_id.to_string(),
                Arc::clone(&self.backup_manager),
            ) {
                commands.push(Box::new(reg_cmd));
            } else if slug == "ultimate-power-plan" {
                commands.push(Box::new(PowerPlanCommand::new(
                    backup_id.to_string(),
                    Arc::clone(&self.backup_manager),
                )));
            } else {
                commands.push(Box::new(ManualAdvisoryCommand::new(slug)));
            }
        }

        if commands.is_empty() {
            return Err("В плане выполнения не выбрано ни одного шага.".into());
        }
        Ok(commands)
    }

    /// Выполняет очередь команд транзакционно: при сбое автоматически откатывает уже применённые шаги.
    pub fn execute_commands(
        &self,
        commands: &[Box<dyn TweakCommand>],
        backup_id: &str,
    ) -> Result<BatchExecutionReport, String> {
        let mut applied_indices: Vec<usize> = Vec::new();
        let mut outcomes: Vec<CommandOutcome> = Vec::with_capacity(commands.len());

        for (idx, cmd) in commands.iter().enumerate() {
            match cmd.apply() {
                Ok(outcome) => {
                    applied_indices.push(idx);
                    outcomes.push(outcome);
                }
                Err(err) => {
                    // Транзакционный откат уже выполненных команд в обратном порядке.
                    for &done_idx in applied_indices.iter().rev() {
                        let _ = commands[done_idx].rollback();
                    }
                    let _ = self.backup_manager.restore_backup(Some(backup_id));
                    return Err(format!(
                        "Ошибка на шаге «{}»: {err}. Предыдущие изменения автоматически откачены.",
                        cmd.title()
                    ));
                }
            }
        }

        let total_changed: usize = outcomes.iter().map(|o| o.changed_count).sum();
        let requires_reboot = outcomes.iter().any(|o| o.requires_reboot);

        Ok(BatchExecutionReport {
            backup_id: backup_id.to_string(),
            outcomes,
            total_changed,
            requires_reboot,
            message: format!(
                "Выполнено шагов: {}, изменено параметров: {total_changed}. Резервная копия: {backup_id}.",
                commands.len()
            ),
        })
    }

    /// Выполняет весь план твиков из фронтенда с созданием сессии снимка.
    pub fn execute_tweak_plan(
        &self,
        plan: &TweakExecutionPlan,
    ) -> Result<BatchExecutionReport, String> {
        let label = if plan.slugs.is_empty() {
            "client-cfg-plan".to_string()
        } else {
            format!("tweak-pack:{}", plan.slugs.join(","))
        };
        let backup_id = self.backup_manager.create_session(&label)?;
        let commands = match self.build_commands(plan, &backup_id) {
            Ok(list) => list,
            Err(err) => {
                let _ = self.backup_manager.restore_backup(Some(&backup_id));
                return Err(err);
            }
        };
        self.execute_commands(&commands, &backup_id)
    }

    /// Выполняет полный откат последнего активного (или указанного) снимка.
    pub fn rollback_changes(&self, backup_id: Option<&str>) -> Result<RestoreReport, String> {
        self.backup_manager.restore_backup(backup_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};

    struct FailingTestCommand {
        id: String,
    }

    impl TweakCommand for FailingTestCommand {
        fn id(&self) -> &str {
            &self.id
        }
        fn title(&self) -> &str {
            "Тестовый сбойный шаг"
        }
        fn apply(&self) -> Result<CommandOutcome, String> {
            Err("Имитация отказа".into())
        }
        fn rollback(&self) -> Result<CommandOutcome, String> {
            Ok(CommandOutcome {
                command_id: self.id.clone(),
                title: self.title().into(),
                applied: false,
                changed_count: 0,
                message: "Откат".into(),
                backup_id: None,
                requires_reboot: false,
            })
        }
    }

    struct FlagCommand {
        applied: Arc<AtomicBool>,
    }

    impl TweakCommand for FlagCommand {
        fn id(&self) -> &str {
            "flag"
        }
        fn title(&self) -> &str {
            "Флаговая команда"
        }
        fn apply(&self) -> Result<CommandOutcome, String> {
            self.applied.store(true, Ordering::SeqCst);
            Ok(CommandOutcome {
                command_id: "flag".into(),
                title: "Флаговая команда".into(),
                applied: true,
                changed_count: 1,
                message: "ok".into(),
                backup_id: None,
                requires_reboot: false,
            })
        }
        fn rollback(&self) -> Result<CommandOutcome, String> {
            self.applied.store(false, Ordering::SeqCst);
            Ok(CommandOutcome {
                command_id: "flag".into(),
                title: "Флаговая команда".into(),
                applied: false,
                changed_count: 1,
                message: "rolled back".into(),
                backup_id: None,
                requires_reboot: false,
            })
        }
    }

    #[test]
    fn merges_client_cfg_preserving_existing_settings_and_binds() {
        let original = "graphics.quality \"3\"\r\ngc.buffer \"256\"\r\ninput.sensitivity \"0.5\"\r\n";
        let updates = vec![
            CfgKeyValue {
                key: "gc.buffer".into(),
                value: "2048".into(),
            },
            CfgKeyValue {
                key: "lerp.smoothing".into(),
                value: "0.2".into(),
            },
        ];
        let (merged, changed) = merge_cfg_content(original, &updates);
        assert_eq!(changed, 2);
        assert!(merged.contains("graphics.quality \"3\""));
        assert!(merged.contains("gc.buffer \"2048\""));
        assert!(merged.contains("input.sensitivity \"0.5\""));
        assert!(merged.contains("lerp.smoothing \"0.2\""));
    }

    #[test]
    fn client_cfg_command_applies_and_rolls_back_via_backup_manager() {
        let base = std::env::temp_dir().join(format!("rustflow_cmd_cfg_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let cfg_path = base.join("Rust").join("cfg").join("client.cfg");
        fs::create_dir_all(cfg_path.parent().unwrap()).unwrap();
        fs::write(&cfg_path, b"gc.buffer \"256\"\r\ncustom.bind \"x\"\r\n").unwrap();

        let mgr = Arc::new(BackupManager::with_base_dir(base.join("backups")));
        let backup_id = mgr.create_session("unit-cfg").unwrap();
        let cmd = ClientCfgCommand::with_explicit_path(
            cfg_path.clone(),
            vec![CfgKeyValue {
                key: "gc.buffer".into(),
                value: "4096".into(),
            }],
            backup_id.clone(),
            Arc::clone(&mgr),
        )
        .unwrap();

        let applied = cmd.apply().unwrap();
        assert_eq!(applied.changed_count, 1);
        let after = fs::read_to_string(&cfg_path).unwrap();
        assert!(after.contains("gc.buffer \"4096\""));
        assert!(after.contains("custom.bind \"x\""));

        cmd.rollback().unwrap();
        let restored = fs::read_to_string(&cfg_path).unwrap();
        assert_eq!(restored, "gc.buffer \"256\"\r\ncustom.bind \"x\"\r\n");

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn executor_rolls_back_prior_commands_on_mid_batch_failure() {
        let base = std::env::temp_dir().join(format!("rustflow_exec_rb_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let mgr = Arc::new(BackupManager::with_base_dir(base.join("backups")));
        let executor = CommandExecutor::with_backup_manager(Arc::clone(&mgr));
        let backup_id = mgr.create_session("rollback-test").unwrap();

        let flag = Arc::new(AtomicBool::new(false));
        let commands: Vec<Box<dyn TweakCommand>> = vec![
            Box::new(FlagCommand {
                applied: Arc::clone(&flag),
            }),
            Box::new(FailingTestCommand { id: "fail".into() }),
        ];

        let err = executor.execute_commands(&commands, &backup_id).unwrap_err();
        assert!(err.contains("автоматически откачены"));
        assert!(!flag.load(Ordering::SeqCst));

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn maps_registry_tweak_slugs_for_windows_10_and_11() {
        let mgr = Arc::new(BackupManager::with_base_dir(
            std::env::temp_dir().join("rustflow_reg_map_unused"),
        ));
        assert!(RegistryCommand::from_tweak_slug("hags", Some("11"), "b1".into(), Arc::clone(&mgr)).is_some());
        assert!(RegistryCommand::from_tweak_slug("game-mode-dvr", Some("10"), "b1".into(), Arc::clone(&mgr)).is_some());
        assert!(RegistryCommand::from_tweak_slug("end-task", Some("11"), "b1".into(), Arc::clone(&mgr)).is_some());
        assert!(RegistryCommand::from_tweak_slug("end-task", Some("10"), "b1".into(), Arc::clone(&mgr)).is_none());
        assert!(RegistryCommand::from_tweak_slug("background-apps", Some("10"), "b1".into(), Arc::clone(&mgr)).is_some());
        assert!(RegistryCommand::from_tweak_slug("background-apps", Some("11"), "b1".into(), mgr).is_none());
    }

    #[test]
    fn extracts_powercfg_guid_and_rejects_unsafe_installers() {
        let line = "Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)";
        assert_eq!(
            extract_guid(line).as_deref(),
            Some("381b4222-f694-41f0-9685-ff5bb260df2e")
        );
        assert!(validate_installer_path(r"\\evil-server\share\setup.exe").is_err());
        assert!(validate_installer_path(r"C:\Temp\..\setup.exe").is_err());
        assert!(validate_installer_path(r"C:\Temp\script.bat").is_err());
    }
}
