//! Поиск клиента Steam и установленной игры Rust (EAC-безопасно).
//!
//! Модуль читает ветки реестра Windows (`HKCU\Software\Valve\Steam` и резервные пути `HKLM`),
//! разбирает файл `libraryfolders.vdf` и определяет точные пути к `Rust/cfg/client.cfg` и `keys.cfg`.
//! Проверка запущенного процесса `RustClient.exe` выполняется только через таблицу процессов ОС,
//! без открытия дескрипторов процесса и без доступа к памяти игры.

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use sysinfo::{ProcessesToUpdate, System};

/// Результат поиска установленного клиента Steam и конфигурации Rust.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct RustInstallPaths {
    /// Корневая директория найденной библиотеки или установки Steam.
    pub steam_dir: String,
    /// Папка с установленным клиентом Rust (где лежит `RustClient.exe`).
    pub rust_dir: String,
    /// Папка конфигурации `Rust/cfg`.
    pub cfg_dir: String,
    /// Полный путь к файлу `Rust/cfg/client.cfg`.
    pub client_cfg_path: String,
    /// Полный путь к файлу биндов `Rust/cfg/keys.cfg`.
    pub keys_cfg_path: String,
    /// Существует ли файл `client.cfg` на диске.
    pub client_cfg_exists: bool,
    /// Существует ли файл `keys.cfg` на диске.
    pub keys_cfg_exists: bool,
    /// Запущен ли в данный момент процесс `RustClient.exe`.
    pub is_rust_running: bool,
}

/// Нормализует разделители пути из реестра Steam и VDF под Windows-формат.
pub fn normalize_steam_path(raw: &str) -> String {
    let trimmed = raw.trim().trim_matches('"');
    let unescaped = trimmed.replace("\\\\", "\\");
    if cfg!(windows) {
        unescaped.replace('/', "\\")
    } else {
        unescaped.replace('\\', "/")
    }
}

/// Извлекает строковые токены в кавычках из формата Valve KeyValues (`libraryfolders.vdf`),
/// корректно пропуская комментарии `//` и обрабатывая экранированные кавычки/слэши.
fn tokenize_vdf_strings(content: &str) -> Vec<(String, usize)> {
    let mut tokens = Vec::new();
    let mut chars = content.char_indices().peekable();
    let mut depth = 0usize;

    while let Some((_, ch)) = chars.next() {
        match ch {
            '/' if chars.peek().is_some_and(|(_, next)| *next == '/') => {
                for (_, c) in chars.by_ref() {
                    if c == '\n' {
                        break;
                    }
                }
            }
            '{' => {
                depth += 1;
            }
            '}' => {
                depth = depth.saturating_sub(1);
            }
            '"' => {
                let mut value = String::new();
                while let Some((_, inner)) = chars.next() {
                    if inner == '\\' {
                        if let Some((_, escaped)) = chars.next() {
                            match escaped {
                                '\\' => value.push('\\'),
                                '"' => value.push('"'),
                                'n' => value.push('\n'),
                                't' => value.push('\t'),
                                other => {
                                    value.push('\\');
                                    value.push(other);
                                }
                            }
                        }
                    } else if inner == '"' {
                        break;
                    } else {
                        value.push(inner);
                    }
                }
                tokens.push((value, depth));
            }
            _ => {}
        }
    }

    tokens
}

/// Разбирает содержимое `libraryfolders.vdf` (как современный формат с ключом `"path"`,
/// так и устаревший формат с прямыми строковыми путями под числовыми индексами).
pub fn parse_library_folders_vdf(content: &str) -> Vec<PathBuf> {
    let tokens = tokenize_vdf_strings(content);
    let mut paths = Vec::new();
    let mut seen = HashSet::new();
    let mut idx = 0usize;

    while idx < tokens.len() {
        let (key, depth) = &tokens[idx];
        if key.eq_ignore_ascii_case("path") {
            if let Some((raw_val, val_depth)) = tokens.get(idx + 1) {
                if val_depth == depth {
                    let normalized = normalize_steam_path(raw_val);
                    if !normalized.is_empty() && seen.insert(normalized.to_ascii_lowercase()) {
                        paths.push(PathBuf::from(normalized));
                    }
                    idx += 2;
                    continue;
                }
            }
        } else if *depth == 1 && !key.is_empty() && key.bytes().all(|b| b.is_ascii_digit()) {
            // Устаревший формат libraryfolders.vdf: "1" "D:\\SteamLibrary"
            if let Some((raw_val, val_depth)) = tokens.get(idx + 1) {
                if *val_depth == 1 && (raw_val.contains('\\') || raw_val.contains('/') || raw_val.contains(':')) {
                    let normalized = normalize_steam_path(raw_val);
                    if !normalized.is_empty() && seen.insert(normalized.to_ascii_lowercase()) {
                        paths.push(PathBuf::from(normalized));
                    }
                    idx += 2;
                    continue;
                }
            }
        }
        idx += 1;
    }

    paths
}

/// Читает корневые директории Steam из реестра Windows (`HKCU\Software\Valve\Steam` и `HKLM`).
#[cfg(target_os = "windows")]
fn collect_steam_roots_from_registry() -> Vec<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;

    let mut roots = Vec::new();
    let mut seen = HashSet::new();

    let mut push_path = |raw: String| {
        let norm = normalize_steam_path(&raw);
        if !norm.is_empty() && seen.insert(norm.to_ascii_lowercase()) {
            roots.push(PathBuf::from(norm));
        }
    };

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey_with_flags(r"Software\Valve\Steam", KEY_READ) {
        if let Ok(steam_path) = key.get_value::<String, _>("SteamPath") {
            push_path(steam_path);
        }
        if let Ok(steam_exe) = key.get_value::<String, _>("SteamExe") {
            let exe_norm = normalize_steam_path(&steam_exe);
            if let Some(parent) = Path::new(&exe_norm).parent() {
                push_path(parent.to_string_lossy().into_owned());
            }
        }
    }

    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    for subkey in [r"SOFTWARE\WOW6432Node\Valve\Steam", r"SOFTWARE\Valve\Steam"] {
        if let Ok(key) = hklm.open_subkey_with_flags(subkey, KEY_READ) {
            if let Ok(install_path) = key.get_value::<String, _>("InstallPath") {
                push_path(install_path);
            }
        }
    }

    roots
}

#[cfg(not(target_os = "windows"))]
fn collect_steam_roots_from_registry() -> Vec<PathBuf> {
    Vec::new()
}

/// Собирает стандартные возможные пути расположения библиотек Steam на Windows-дисках.
#[cfg(target_os = "windows")]
fn default_steam_roots() -> Vec<PathBuf> {
    let mut out = Vec::new();
    for letter in b'C'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        if !Path::new(&drive).exists() {
            continue;
        }
        for suffix in [
            r"Program Files (x86)\Steam",
            r"Program Files\Steam",
            "Steam",
            "SteamLibrary",
        ] {
            let candidate = PathBuf::from(&drive).join(suffix);
            if candidate.is_dir() {
                out.push(candidate);
            }
        }
    }
    out
}

#[cfg(not(target_os = "windows"))]
fn default_steam_roots() -> Vec<PathBuf> {
    Vec::new()
}

/// Проверяет, запущен ли процесс `RustClient.exe` (только чтение списка процессов).
pub fn is_rust_running() -> bool {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    sys.processes().values().any(|proc_info| {
        proc_info
            .name()
            .to_string_lossy()
            .eq_ignore_ascii_case("RustClient.exe")
    })
}

/// Проверяет наличие `RustClient.exe` в директории и формирует структуру `RustInstallPaths`.
pub fn build_install_paths(steam_dir: &Path, rust_dir: &Path) -> Result<RustInstallPaths, String> {
    if !rust_dir.join("RustClient.exe").is_file() {
        return Err(format!(
            "В папке «{}» не найден файл RustClient.exe.",
            rust_dir.display()
        ));
    }

    let cfg_dir = rust_dir.join("cfg");
    let client_cfg = cfg_dir.join("client.cfg");
    let keys_cfg = cfg_dir.join("keys.cfg");

    Ok(RustInstallPaths {
        steam_dir: steam_dir.to_string_lossy().into_owned(),
        rust_dir: rust_dir.to_string_lossy().into_owned(),
        cfg_dir: cfg_dir.to_string_lossy().into_owned(),
        client_cfg_path: client_cfg.to_string_lossy().into_owned(),
        keys_cfg_path: keys_cfg.to_string_lossy().into_owned(),
        client_cfg_exists: client_cfg.is_file(),
        keys_cfg_exists: keys_cfg.is_file(),
        is_rust_running: is_rust_running(),
    })
}

/// Находит установленный Steam и папку Rust (при желании проверяет `custom_dir`, переданный пользователем).
pub fn locate_rust_installation(custom_dir: Option<&str>) -> Result<RustInstallPaths, String> {
    if let Some(raw_dir) = custom_dir {
        let trimmed = raw_dir.trim().trim_matches('"');
        if !trimmed.is_empty() {
            if trimmed.contains('\0') {
                return Err("Некорректный путь к папке Rust.".into());
            }
            let manual_path = PathBuf::from(normalize_steam_path(trimmed));
            let steam_parent = manual_path
                .parent()
                .and_then(|p| p.parent())
                .and_then(|p| p.parent())
                .unwrap_or(manual_path.as_path());
            return build_install_paths(steam_parent, &manual_path);
        }
    }

    let mut steam_roots = collect_steam_roots_from_registry();
    steam_roots.extend(default_steam_roots());

    let mut libraries: Vec<(PathBuf, PathBuf)> = Vec::new();
    let mut seen_libs = HashSet::new();

    for root in steam_roots {
        let root_key = root.to_string_lossy().to_ascii_lowercase();
        if seen_libs.insert(root_key) {
            libraries.push((root.clone(), root.clone()));
        }

        for vdf_rel in ["steamapps/libraryfolders.vdf", "config/libraryfolders.vdf"] {
            let vdf_path = root.join(vdf_rel);
            if let Ok(content) = fs::read_to_string(&vdf_path) {
                for lib_path in parse_library_folders_vdf(&content) {
                    let lib_key = lib_path.to_string_lossy().to_ascii_lowercase();
                    if seen_libs.insert(lib_key) {
                        libraries.push((root.clone(), lib_path));
                    }
                }
            }
        }
    }

    for (steam_root, library_root) in libraries {
        for rust_rel in [Path::new("steamapps").join("common").join("Rust"), Path::new("common").join("Rust")] {
            let candidate = library_root.join(rust_rel);
            if candidate.join("RustClient.exe").is_file() {
                return build_install_paths(&steam_root, &candidate);
            }
        }
    }

    Err("Установка Rust через Steam не найдена. Проверьте, что игра установлена, или укажите путь вручную.".into())
}

/// Возвращает букву диска (например, `"D"`), на котором установлен Rust, если удалось определить папку игры.
pub fn rust_drive_letter() -> Option<String> {
    let info = locate_rust_installation(None).ok()?;
    let bytes = info.rust_dir.as_bytes();
    if bytes.len() >= 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' {
        Some((bytes[0] as char).to_ascii_uppercase().to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_modern_library_folders_vdf() {
        let vdf = r#"
// Steam library config
"libraryfolders"
{
    "0"
    {
        "path"        "C:\\Program Files (x86)\\Steam"
        "label"       ""
        "apps"
        {
            "252490"  "25000000000"
        }
    }
    "1"
    {
        "path"        "D:\\Games\\SteamLibrary"
    }
    "2"
    {
        "path"        "E:/SteamGames"
    }
}
"#;
        let parsed = parse_library_folders_vdf(vdf);
        assert_eq!(parsed.len(), 3);
        let texts: Vec<String> = parsed.iter().map(|p| p.to_string_lossy().into_owned()).collect();
        assert!(texts[0].contains("Program Files (x86)"));
        assert!(texts[1].contains("SteamLibrary"));
        assert!(texts[2].contains("SteamGames"));
    }

    #[test]
    fn parses_legacy_library_folders_vdf() {
        let vdf = r#"
"LibraryFolders"
{
    "TimeNextStatsReport" "1610000000"
    "ContentStatsID"      "12345"
    "1"                   "D:\\SteamLibrary"
    "2"                   "F:\\SSD_Steam"
}
"#;
        let parsed = parse_library_folders_vdf(vdf);
        assert_eq!(parsed.len(), 2);
        let joined = parsed
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect::<Vec<_>>()
            .join("|");
        assert!(joined.contains("SteamLibrary"));
        assert!(joined.contains("SSD_Steam"));
    }

    #[test]
    fn build_install_paths_finds_cfg_files() {
        let base = std::env::temp_dir().join(format!("rustflow_steam_test_{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        let rust_dir = base.join("steamapps").join("common").join("Rust");
        let cfg_dir = rust_dir.join("cfg");
        fs::create_dir_all(&cfg_dir).unwrap();
        fs::write(rust_dir.join("RustClient.exe"), b"stub").unwrap();
        fs::write(cfg_dir.join("client.cfg"), b"gc.buffer \"2048\"\n").unwrap();

        let paths = build_install_paths(&base, &rust_dir).unwrap();
        assert!(paths.client_cfg_exists);
        assert!(!paths.keys_cfg_exists);
        assert!(paths.client_cfg_path.ends_with("client.cfg"));
        assert!(paths.keys_cfg_path.ends_with("keys.cfg"));

        let _ = fs::remove_dir_all(&base);
    }
}
