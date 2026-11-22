//! Чтение реальных характеристик ПК (CPU, GPU, RAM, SSD/NVMe/HDD, версия Windows 10/11)
//! через WMI, реестр Windows (`winreg`) и `sysinfo` для автозаполнения калькулятора сборки.

use serde::{Deserialize, Serialize};

/// Сводка аппаратных характеристик и версии ОС, передаваемая на фронтенд RustFlow.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WindowsHardwareInfo {
    /// Модель процессора (например, `AMD Ryzen 7 7800X3D 8-Core Processor`).
    pub cpu: String,
    /// Количество физических ядер CPU.
    pub cpu_cores: usize,
    /// Количество логических потоков CPU.
    pub cpu_threads: usize,
    /// Модель основной дискретной (или единственной) видеокарты.
    pub gpu: String,
    /// Объём видеопамяти в ГБ (при наличии точных данных).
    pub vram_gb: Option<u32>,
    /// Объём оперативной памяти в ГБ.
    pub ram_gb: u64,
    /// Эффективная частота оперативной памяти в МТ/с (МГц).
    pub ram_mhz: Option<u32>,
    /// Тип накопителя с игрой (`"nvme"`, `"sata"`, `"hdd"` или `null`, если определить нельзя).
    pub storage: Option<String>,
    /// Полное название ОС (например, `Microsoft Windows 11 Pro (10.0.26100, build 26100)`).
    pub name: String,
    /// Основная версия Windows: `"10"` или `"11"`.
    pub windows_version: String,
    /// Путь к установленной папке Rust, если игра найдена.
    pub rust_dir: Option<String>,
    /// Установлен ли клиент Rust на данном ПК.
    pub rust_installed: bool,
}

/// Промежуточное описание видеоадаптера для выбора основной игровой видеокарты.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GpuCandidate {
    pub name: String,
    pub vram_bytes: Option<u64>,
}

/// Переводит байты в округлённые гигабайты (GiB), возвращая `None` для нулевых значений.
pub fn bytes_to_gb_rounded(bytes: u64) -> Option<u32> {
    if bytes == 0 {
        return None;
    }
    let gb = (bytes as f64 / 1_073_741_824.0).round();
    if gb < 1.0 {
        None
    } else {
        Some(gb as u32)
    }
}

/// Проверяет, является ли видеоадаптер программным/виртуальным экраном.
fn is_virtual_display_adapter(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    [
        "microsoft basic display",
        "microsoft remote display",
        "virtual",
        "citrix",
        "parsec",
        "spacedesk",
        "iddcx",
        "vnc",
    ]
    .iter()
    .any(|marker| lower.contains(marker))
}

/// Проверяет, относится ли адаптер к дискретным игровым видеокартам.
fn is_dedicated_gaming_gpu(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("nvidia")
        || lower.contains("geforce")
        || lower.contains("radeon rx")
        || lower.contains("radeon pro")
        || (lower.contains("intel") && lower.contains("arc"))
}

/// Выбирает основную видеокарту среди найденных видеоадаптеров.
/// Предпочитает единственную дискретную GPU; при нескольких дискретных берёт с наибольшим VRAM.
pub fn select_primary_gpu(candidates: &[GpuCandidate]) -> Option<GpuCandidate> {
    let physical: Vec<GpuCandidate> = candidates
        .iter()
        .filter(|item| !item.name.trim().is_empty() && !is_virtual_display_adapter(&item.name))
        .cloned()
        .collect();

    let pool = if physical.is_empty() {
        candidates
            .iter()
            .filter(|item| !item.name.trim().is_empty())
            .cloned()
            .collect::<Vec<_>>()
    } else {
        physical
    };

    if pool.is_empty() {
        return None;
    }

    let dedicated: Vec<GpuCandidate> = pool
        .iter()
        .filter(|item| is_dedicated_gaming_gpu(&item.name))
        .cloned()
        .collect();

    if dedicated.len() == 1 {
        return dedicated.into_iter().next();
    }
    if !dedicated.is_empty() {
        return dedicated
            .into_iter()
            .max_by_key(|item| item.vram_bytes.unwrap_or(0));
    }

    if pool.len() == 1 {
        return pool.into_iter().next();
    }

    pool.into_iter()
        .max_by_key(|item| item.vram_bytes.unwrap_or(0))
}

/// Определяет `"10"` или `"11"` по номеру сборки Windows и нормализует отображаемое имя ОС.
pub fn classify_windows_version(
    build_number: u32,
    caption: &str,
    version: &str,
) -> (&'static str, String) {
    let major = if build_number >= 22000 { "11" } else { "10" };
    let clean_caption = caption.trim();
    let normalized_caption = if clean_caption.is_empty() {
        format!("Microsoft Windows {major}")
    } else if build_number >= 22000 && clean_caption.contains("Windows 10") {
        // В реестре Windows 11 ProductName исторически может содержать "Windows 10".
        clean_caption.replace("Windows 10", "Windows 11")
    } else {
        clean_caption.to_string()
    };

    let display = if version.trim().is_empty() {
        if build_number > 0 {
            format!("{normalized_caption} (build {build_number})")
        } else {
            normalized_caption
        }
    } else if build_number > 0 {
        format!("{normalized_caption} ({}, build {build_number})", version.trim())
    } else {
        format!("{normalized_caption} ({})", version.trim())
    };

    (major, display)
}

/// Классифицирует физический накопитель по кодам `MediaType` и `BusType` из WMI `MSFT_PhysicalDisk`.
/// Значения WMI: `MediaType` (3 = HDD, 4 = SSD), `BusType` (11 = SATA, 17 = NVMe).
pub fn classify_storage_kind(media_type: u64, bus_type: u64) -> Option<String> {
    if bus_type == 17 && (media_type == 4 || media_type == 0) {
        return Some("nvme".to_string());
    }
    if media_type == 4 && bus_type == 11 {
        return Some("sata".to_string());
    }
    if media_type == 3 {
        return Some("hdd".to_string());
    }
    None
}

/// Читает реальные характеристики ПК на Windows (WMI + WinReg + Sysinfo).
pub fn read_windows_hardware() -> Result<WindowsHardwareInfo, String> {
    #[cfg(not(target_os = "windows"))]
    {
        Err("Сбор характеристик через WMI/WinAPI доступен только на Windows 10/11.".into())
    }

    #[cfg(target_os = "windows")]
    {
        // Запускаем WMI-запросы в выделенном рабочем потоке, чтобы COM (MTA)
        // не конфликтовал с STA-потоком WebView2 главного окна Tauri.
        let handle = std::thread::spawn(collect_windows_hardware_on_worker);
        handle
            .join()
            .map_err(|_| "Поток опроса оборудования завершился аварийно.".to_string())?
    }
}

#[cfg(target_os = "windows")]
fn collect_windows_hardware_on_worker() -> Result<WindowsHardwareInfo, String> {
    use crate::steam_locator;
    use std::collections::HashMap;
    use sysinfo::{CpuRefreshKind, DiskKind, Disks, MemoryRefreshKind, RefreshKind, System};
    use winreg::enums::{HKEY_LOCAL_MACHINE, KEY_READ};
    use winreg::RegKey;
    use wmi::{Variant, WMIConnection};

    fn var_str(map: &HashMap<String, Variant>, key: &str) -> Option<String> {
        match map.get(key)? {
            Variant::String(s) => {
                let t = s.trim();
                (!t.is_empty()).then(|| t.to_string())
            }
            Variant::UI1(v) => Some(v.to_string()),
            Variant::UI2(v) => Some(v.to_string()),
            Variant::UI4(v) => Some(v.to_string()),
            Variant::UI8(v) => Some(v.to_string()),
            Variant::I4(v) => Some(v.to_string()),
            Variant::I8(v) => Some(v.to_string()),
            _ => None,
        }
    }

    fn var_u64(map: &HashMap<String, Variant>, key: &str) -> Option<u64> {
        match map.get(key)? {
            Variant::UI1(v) => Some(u64::from(*v)),
            Variant::UI2(v) => Some(u64::from(*v)),
            Variant::UI4(v) => Some(u64::from(*v)),
            Variant::UI8(v) => Some(*v),
            Variant::I1(v) => u64::try_from(*v).ok(),
            Variant::I2(v) => u64::try_from(*v).ok(),
            Variant::I4(v) => u64::try_from(*v).ok(),
            Variant::I8(v) => u64::try_from(*v).ok(),
            Variant::String(s) => s.trim().parse::<u64>().ok(),
            _ => None,
        }
    }

    fn read_registry_gpu_vram(gpu_name: &str) -> Option<u64> {
        let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
        let class_key = hklm
            .open_subkey_with_flags(
                r"SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}",
                KEY_READ,
            )
            .ok()?;

        let target_lower = gpu_name.trim().to_ascii_lowercase();
        for subkey_name in class_key.enum_keys().flatten() {
            if !subkey_name.bytes().all(|b| b.is_ascii_digit()) {
                continue;
            }
            let Ok(adapter) = class_key.open_subkey_with_flags(&subkey_name, KEY_READ) else {
                continue;
            };
            let desc = adapter
                .get_value::<String, _>("DriverDesc")
                .or_else(|_| adapter.get_value::<String, _>("HardwareInformation.AdapterString"))
                .unwrap_or_default();
            if desc.trim().is_empty() {
                continue;
            }
            let desc_lower = desc.trim().to_ascii_lowercase();
            if !desc_lower.contains(&target_lower) && !target_lower.contains(&desc_lower) {
                continue;
            }
            if let Ok(raw) = adapter.get_raw_value("HardwareInformation.qwMemorySize") {
                if raw.bytes.len() >= 8 {
                    let bytes = u64::from_le_bytes([
                        raw.bytes[0],
                        raw.bytes[1],
                        raw.bytes[2],
                        raw.bytes[3],
                        raw.bytes[4],
                        raw.bytes[5],
                        raw.bytes[6],
                        raw.bytes[7],
                    ]);
                    if bytes > 0 {
                        return Some(bytes);
                    }
                } else if raw.bytes.len() >= 4 {
                    let bytes = u32::from_le_bytes([
                        raw.bytes[0],
                        raw.bytes[1],
                        raw.bytes[2],
                        raw.bytes[3],
                    ]);
                    if bytes > 0 {
                        return Some(u64::from(bytes));
                    }
                }
            }
        }
        None
    }

    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );
    sys.refresh_cpu_all();
    sys.refresh_memory();

    let cpu_cores = sys.physical_core_count().unwrap_or(1);
    let cpu_threads = sys.cpus().len().max(1);
    let mut cpu_name = sys
        .cpus()
        .first()
        .map(|c| c.brand().trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    let mut ram_gb = ((sys.total_memory() as f64) / 1_073_741_824.0).round() as u64;
    let mut ram_mhz: Option<u32> = None;

    let mut gpu_candidates: Vec<GpuCandidate> = Vec::new();
    let mut os_caption = String::new();
    let mut os_version = String::new();
    let mut os_build: u32 = 0;

    // Сначала читаем сведения о сборке ОС из реестра Windows как быстрый и надёжный базовый источник.
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    if let Ok(nt) = hklm.open_subkey_with_flags(
        r"SOFTWARE\Microsoft\Windows NT\CurrentVersion",
        KEY_READ,
    ) {
        if let Ok(prod) = nt.get_value::<String, _>("ProductName") {
            os_caption = prod;
        }
        if let Ok(build_str) = nt.get_value::<String, _>("CurrentBuildNumber") {
            os_build = build_str.trim().parse::<u32>().unwrap_or(0);
        }
        if let Ok(disp) = nt.get_value::<String, _>("DisplayVersion") {
            os_version = disp;
        }
    }

    // Затем уточняем точные спецификации через WMI ROOT\CIMV2.
    if let Ok(wmi_con) = WMIConnection::new() {
        if let Ok(rows) = wmi_con.raw_query::<HashMap<String, Variant>>(
            "SELECT Name FROM Win32_Processor",
        ) {
            if let Some(first) = rows.first() {
                if let Some(name) = var_str(first, "Name") {
                    cpu_name = name;
                }
            }
        }

        if let Ok(rows) = wmi_con.raw_query::<HashMap<String, Variant>>(
            "SELECT Name, AdapterRAM FROM Win32_VideoController",
        ) {
            for row in rows {
                if let Some(name) = var_str(&row, "Name") {
                    let wmi_vram = var_u64(&row, "AdapterRAM");
                    let reg_vram = read_registry_gpu_vram(&name);
                    gpu_candidates.push(GpuCandidate {
                        name,
                        vram_bytes: reg_vram.or(wmi_vram),
                    });
                }
            }
        }

        if let Ok(rows) = wmi_con.raw_query::<HashMap<String, Variant>>(
            "SELECT Capacity, ConfiguredClockSpeed, Speed FROM Win32_PhysicalMemory",
        ) {
            let mut total_bytes: u64 = 0;
            let mut best_mhz: Option<u32> = None;
            for row in rows {
                if let Some(cap) = var_u64(&row, "Capacity") {
                    total_bytes = total_bytes.saturating_add(cap);
                }
                let mhz = var_u64(&row, "ConfiguredClockSpeed")
                    .filter(|&v| v > 0)
                    .or_else(|| var_u64(&row, "Speed").filter(|&v| v > 0));
                if let Some(val) = mhz.and_then(|v| u32::try_from(v).ok()) {
                    best_mhz = Some(best_mhz.map_or(val, |prev| prev.max(val)));
                }
            }
            if total_bytes > 0 {
                ram_gb = ((total_bytes as f64) / 1_073_741_824.0).round() as u64;
            }
            ram_mhz = best_mhz;
        }

        if let Ok(rows) = wmi_con.raw_query::<HashMap<String, Variant>>(
            "SELECT Caption, Version, BuildNumber FROM Win32_OperatingSystem",
        ) {
            if let Some(row) = rows.first() {
                if let Some(caption) = var_str(row, "Caption") {
                    os_caption = caption;
                }
                if let Some(version) = var_str(row, "Version") {
                    os_version = version;
                }
                if let Some(build) = var_u64(row, "BuildNumber").and_then(|b| u32::try_from(b).ok())
                {
                    os_build = build;
                }
            }
        }
    }

    let selected_gpu = select_primary_gpu(&gpu_candidates);
    let gpu = selected_gpu
        .as_ref()
        .map(|g| g.name.clone())
        .unwrap_or_else(|| "Unknown GPU".to_string());
    let vram_gb = selected_gpu
        .as_ref()
        .and_then(|g| g.vram_bytes)
        .and_then(bytes_to_gb_rounded);

    let (windows_version, os_display_name) =
        classify_windows_version(os_build, &os_caption, &os_version);

    let rust_install = steam_locator::locate_rust_installation(None).ok();
    let target_drive = steam_locator::rust_drive_letter().unwrap_or_else(|| "C".to_string());

    // Определяем тип физического накопителя (NVMe / SATA / HDD) через WMI Storage.
    let mut storage: Option<String> = None;
    if let Ok(storage_wmi) = WMIConnection::with_namespace_path(r"ROOT\Microsoft\Windows\Storage")
    {
        if let Ok(parts) = storage_wmi.raw_query::<HashMap<String, Variant>>(
            "SELECT DiskNumber, DriveLetter FROM MSFT_Partition",
        ) {
            let matching_disks: Vec<u64> = parts
                .iter()
                .filter_map(|row| {
                    let letter = match row.get("DriveLetter")? {
                        Variant::String(s) => s.trim().chars().next().map(|c| c.to_ascii_uppercase()),
                        Variant::UI2(code) => char::from_u32(u32::from(*code))
                            .map(|c| c.to_ascii_uppercase()),
                        Variant::UI4(code) => char::from_u32(*code).map(|c| c.to_ascii_uppercase()),
                        _ => None,
                    }?;
                    if letter.to_string().eq_ignore_ascii_case(&target_drive) {
                        var_u64(row, "DiskNumber")
                    } else {
                        None
                    }
                })
                .collect();

            if matching_disks.len() == 1 {
                let disk_num = matching_disks[0].to_string();
                if let Ok(phys_disks) = storage_wmi.raw_query::<HashMap<String, Variant>>(
                    "SELECT DeviceId, MediaType, BusType FROM MSFT_PhysicalDisk",
                ) {
                    let matching_phys: Vec<_> = phys_disks
                        .iter()
                        .filter(|row| var_str(row, "DeviceId").as_deref() == Some(disk_num.as_str()))
                        .collect();
                    if matching_phys.len() == 1 {
                        let media = var_u64(matching_phys[0], "MediaType").unwrap_or(0);
                        let bus = var_u64(matching_phys[0], "BusType").unwrap_or(0);
                        storage = classify_storage_kind(media, bus);
                    }
                }
            }
        }
    }

    // Резервное определение только HDD через sysinfo, если Storage WMI недоступен.
    if storage.is_none() {
        let disks = Disks::new_with_refreshed_list();
        let mount_prefix = format!("{target_drive}:");
        for disk in disks.list() {
            let mp = disk.mount_point().to_string_lossy();
            if mp.to_ascii_uppercase().starts_with(&mount_prefix)
                && disk.kind() == DiskKind::HDD
            {
                storage = Some("hdd".to_string());
                break;
            }
        }
    }

    Ok(WindowsHardwareInfo {
        cpu: cpu_name,
        cpu_cores,
        cpu_threads,
        gpu,
        vram_gb,
        ram_gb,
        ram_mhz,
        storage,
        name: os_display_name,
        windows_version: windows_version.to_string(),
        rust_dir: rust_install.as_ref().map(|r| r.rust_dir.clone()),
        rust_installed: rust_install.is_some(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selects_dedicated_gpu_over_integrated_and_virtual() {
        let gpus = vec![
            GpuCandidate {
                name: "Microsoft Basic Display Adapter".into(),
                vram_bytes: Some(0),
            },
            GpuCandidate {
                name: "AMD Radeon(TM) Graphics".into(),
                vram_bytes: Some(512 * 1024 * 1024),
            },
            GpuCandidate {
                name: "NVIDIA GeForce RTX 4070 Ti".into(),
                vram_bytes: Some(12 * 1024 * 1024 * 1024),
            },
        ];
        let picked = select_primary_gpu(&gpus).unwrap();
        assert_eq!(picked.name, "NVIDIA GeForce RTX 4070 Ti");
        assert_eq!(bytes_to_gb_rounded(picked.vram_bytes.unwrap()), Some(12));
    }

    #[test]
    fn classifies_windows_10_and_11_by_build() {
        let (v11, name11) =
            classify_windows_version(26100, "Microsoft Windows 10 Pro", "10.0.26100");
        assert_eq!(v11, "11");
        assert!(name11.contains("Windows 11 Pro"));
        assert!(name11.contains("build 26100"));

        let (v10, name10) =
            classify_windows_version(19045, "Microsoft Windows 10 Home", "10.0.19045");
        assert_eq!(v10, "10");
        assert!(name10.contains("Windows 10 Home"));
    }

    #[test]
    fn classifies_storage_bus_and_media() {
        assert_eq!(classify_storage_kind(4, 17).as_deref(), Some("nvme"));
        assert_eq!(classify_storage_kind(0, 17).as_deref(), Some("nvme"));
        assert_eq!(classify_storage_kind(4, 11).as_deref(), Some("sata"));
        assert_eq!(classify_storage_kind(3, 11).as_deref(), Some("hdd"));
        assert_eq!(classify_storage_kind(4, 7), None); // USB SSD
        assert_eq!(classify_storage_kind(0, 0), None);
    }
}
