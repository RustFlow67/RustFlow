#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde_json::Value;

// The script is fixed in the executable: no frontend input is interpreted as code.
#[tauri::command]
fn read_windows_info() -> Result<Value, String> {
    #[cfg(not(target_os = "windows"))]
    return Err("Windows only".into());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let script = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$os = Get-CimInstance Win32_OperatingSystem
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpus = @(Get-CimInstance Win32_VideoController)
$dedicated = @($gpus | Where-Object { $_.Name -match 'NVIDIA|Radeon RX|Intel.*Arc' })
$gpu = if ($dedicated.Count -eq 1) { $dedicated[0] } elseif ($gpus.Count -eq 1) { $gpus[0] } else { $null }
$memory = @(Get-CimInstance Win32_PhysicalMemory)
$build = [int]$os.BuildNumber
$storage = $null
# Resolve the physical device backing the Rust installation, not an arbitrary disk.
# Volumes with multiple physical disks or unknown media are deliberately omitted.
if ($env:RUSTFLOW_GAME_DRIVE -match '^[A-Za-z]$') {
  try {
    $parts = @(Get-Partition -DriveLetter $env:RUSTFLOW_GAME_DRIVE -ErrorAction Stop)
    if ($parts.Count -eq 1) {
      $disk = $parts[0] | Get-Disk -ErrorAction Stop
      $physical = @($disk | Get-PhysicalDisk -ErrorAction Stop)
      if ($physical.Count -eq 1) {
        if ([string]$physical[0].MediaType -eq 'HDD') { $storage = 'hdd' }
        elseif ([string]$physical[0].MediaType -eq 'SSD' -and [string]$physical[0].BusType -eq 'NVMe') { $storage = 'nvme' }
        elseif ([string]$physical[0].MediaType -eq 'SSD' -and [string]$physical[0].BusType -eq 'SATA') { $storage = 'sata' }
      }
    }
  } catch { $storage = $null }
}
@{ cpu = [string]$cpu.Name; gpu = [string]$gpu.Name;
   ramGb = [math]::Round(($memory | Measure-Object -Property Capacity -Sum).Sum / 1GB);
   ramMhz = [int]($memory | Select-Object -First 1).ConfiguredClockSpeed;
   storage = $storage;
   name = "$($os.Caption) ($($os.Version), build $build)";
   windowsVersion = $(if ($build -ge 22000) {'11'} else {'10'}) } | ConvertTo-Json -Compress
"#;
        let drive = rust_directory().ok().and_then(|p| {
            let text = p.to_string_lossy().into_owned();
            let bytes = text.as_bytes();
            if bytes.len() >= 3 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':' { Some(text[..1].to_owned()) } else { None }
        }).unwrap_or_default();
        let output = std::process::Command::new("powershell.exe")
            .env("RUSTFLOW_GAME_DRIVE", drive)
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .creation_flags(0x08000000).output().map_err(|e| e.to_string())?;
        if !output.status.success() { return Err("Windows hardware query failed".into()); }
        serde_json::from_slice(&output.stdout).map_err(|e| e.to_string())
    }
}

#[cfg(target_os = "windows")]
fn rust_directory() -> Result<std::path::PathBuf, String> {
    use std::os::windows::process::CommandExt;
    // Steam's VDF lists libraries outside the installation drive. Test all
    // candidates for RustClient.exe; never accept a path supplied by the UI.
    let script = r#"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$paths = [System.Collections.Generic.List[string]]::new()
foreach ($key in @('HKCU:\Software\Valve\Steam','HKLM:\SOFTWARE\WOW6432Node\Valve\Steam','HKLM:\SOFTWARE\Valve\Steam')) {
  $v = Get-ItemProperty -Path $key -ErrorAction SilentlyContinue
  if ($v.SteamPath) { $paths.Add([string]$v.SteamPath) }
  if ($v.InstallPath) { $paths.Add([string]$v.InstallPath) }
}
foreach ($letter in [char[]](67..90)) {
  foreach ($suffix in @('Steam','Program Files (x86)\Steam','Program Files\Steam','SteamLibrary')) { $paths.Add("${letter}:\$suffix") }
}
$libraries = [System.Collections.Generic.List[string]]::new()
foreach ($base in $paths) {
  $libraries.Add($base)
  $vdf = Join-Path $base 'steamapps\libraryfolders.vdf'
  if (Test-Path -LiteralPath $vdf -PathType Leaf) {
    foreach ($line in (Get-Content -LiteralPath $vdf)) {
      if ($line -match '"path"\s*"([^"]+)"') { $libraries.Add($Matches[1].Replace('\\','\')) }
    }
  }
}
foreach ($library in $libraries) {
  $rust = Join-Path $library 'steamapps\common\Rust'
  if (Test-Path -LiteralPath (Join-Path $rust 'RustClient.exe') -PathType Leaf) { [Console]::Write($rust); exit 0 }
}
exit 1
"#;
    let output = std::process::Command::new("powershell.exe").args(["-NoProfile", "-NonInteractive", "-Command", script]).creation_flags(0x08000000).output().map_err(|e| e.to_string())?;
    if !output.status.success() { return Err("Rust installation not found".into()); }
    let dir = std::path::PathBuf::from(String::from_utf8(output.stdout).map_err(|e| e.to_string())?);
    if !dir.join("RustClient.exe").is_file() { return Err("Invalid Rust installation".into()); }
    Ok(dir)
}

#[tauri::command]
fn find_rust_directory() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    { return Ok(rust_directory()?.to_string_lossy().into_owned()); }
    #[cfg(not(target_os = "windows"))]
    { Err("Windows only".into()) }
}

// A single pending backup is retained until it is restored. Refusing another
// write prevents a second apply from silently destroying the rollback state.
#[tauri::command]
fn write_client_cfg(cfg: String) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    { let _ = cfg; return Err("Windows only".into()); }
    #[cfg(target_os = "windows")]
    {
        use std::io::Write;
        if cfg.len() > 128 * 1024 || cfg.contains('\0') { return Err("Invalid config".into()); }
        let dir = rust_directory()?.join("cfg");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let target = dir.join("client.cfg");
        let backup = dir.join("client.cfg.backup");
        let missing = dir.join("client.cfg.backup.absent");
        let marker = dir.join("client.cfg.backup.rustflow");
        if backup.exists() || missing.exists() || marker.exists() { return Err("A backup already exists; restore it before applying again".into()); }
        let existed = target.exists();
        if existed {
            let mut source = std::fs::File::open(&target).map_err(|e| e.to_string())?;
            let mut copy = std::fs::OpenOptions::new().write(true).create_new(true).open(&backup).map_err(|e| e.to_string())?;
            if let Err(e) = std::io::copy(&mut source, &mut copy).and_then(|_| copy.sync_all()) {
                drop(copy); let _ = std::fs::remove_file(&backup); return Err(e.to_string());
            }
        } else {
            std::fs::OpenOptions::new().write(true).create_new(true).open(&backup).and_then(|f| f.sync_all()).map_err(|e| e.to_string())?;
            std::fs::OpenOptions::new().write(true).create_new(true).open(&missing).and_then(|f| f.sync_all()).map_err(|e| e.to_string())?;
        }
        std::fs::OpenOptions::new().write(true).create_new(true).open(&marker).and_then(|f| f.sync_all()).map_err(|e| e.to_string())?;
        let mut file = std::fs::OpenOptions::new().write(true).create(true).truncate(true).open(&target).map_err(|e| e.to_string())?;
        file.write_all(cfg.as_bytes()).and_then(|_| file.sync_all()).map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
fn restore_client_cfg() -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    { return Err("Windows only".into()); }
    #[cfg(target_os = "windows")]
    {
        let dir = rust_directory()?.join("cfg");
        let target = dir.join("client.cfg");
        let backup = dir.join("client.cfg.backup");
        let missing = dir.join("client.cfg.backup.absent");
        let marker = dir.join("client.cfg.backup.rustflow");
        if !backup.is_file() || !marker.is_file() { return Err("No RustFlow backup found".into()); }
        if missing.exists() {
            if target.exists() { std::fs::remove_file(&target).map_err(|e| e.to_string())?; }
            std::fs::remove_file(&missing).map_err(|e| e.to_string())?;
        } else { std::fs::copy(&backup, &target).map_err(|e| e.to_string())?; }
        std::fs::remove_file(&marker).map_err(|e| e.to_string())?;
        std::fs::remove_file(&backup).map_err(|e| e.to_string())?;
        Ok(())
    }
}

// The renderer cannot provide a URL or executable. These are support pages,
// not direct installers; downloading and running an unverified binary is not safe.
#[tauri::command]
fn open_official_support(kind: String) -> Result<(), String> {
    #[cfg(not(target_os = "windows"))]
    { let _ = kind; return Err("Windows only".into()); }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let url = match kind.as_str() {
            "ddu" => "https://www.wagnardsoft.com/display-driver-uninstaller-ddu",
            "nvcleanstall" => "https://www.techpowerup.com/download/techpowerup-nvcleanstall/",
            "nvidia" => "https://www.nvidia.com/en-us/drivers/",
            "radeon" => "https://www.amd.com/en/support/download/drivers.html",
            "arc" => "https://www.intel.com/content/www/us/en/download/785597/intel-arc-graphics-windows.html",
            _ => return Err("Unsupported publisher".into()),
        };
        let command = format!("Start-Process -FilePath '{}' -ErrorAction Stop", url);
        let status = std::process::Command::new("powershell.exe")
            .args(["-NoProfile", "-NonInteractive", "-Command", &command])
            .creation_flags(0x08000000).status().map_err(|e| e.to_string())?;
        if !status.success() { return Err("Could not open support page".into()); }
        Ok(())
    }
}

#[derive(serde::Deserialize)]
struct PackFile { name: String, data: Vec<u8> }

// Treat every IPC argument as untrusted. No caller can supply a destination,
// absolute path, executable extension, alternate stream, or overwrite a file.
fn validate_pack(files: &[PackFile]) -> Result<(), String> {
    use std::collections::HashSet;
    if files.is_empty() || files.len() > 512 { return Err("Invalid file count".into()); }
    let mut names = HashSet::new();
    let mut total = 0usize;
    for file in files {
        total = total.checked_add(file.data.len()).ok_or("Pack too large")?;
        if file.data.len() > 2 * 1024 * 1024 || total > 16 * 1024 * 1024 { return Err("Pack too large".into()); }
        let parts: Vec<_> = file.name.split('/').collect();
        if parts.len() < 2 || parts.len() > 4 || parts[0] != "RustFlow-Pack" || file.name.len() > 200 {
            return Err("Invalid package path".into());
        }
        for part in &parts {
            if part.is_empty() || part.ends_with('.') || !part.bytes().all(|c| c.is_ascii_alphanumeric() || b"-_.".contains(&c)) {
                return Err("Invalid package name".into());
            }
            let stem = part.split('.').next().unwrap_or("").to_ascii_uppercase();
            if ["CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"].contains(&stem.as_str()) {
                return Err("Reserved package name".into());
            }
        }
        let lower = file.name.to_ascii_lowercase();
        if !(lower.ends_with(".txt") || lower.ends_with(".reg") || lower.ends_with(".bat") || lower.ends_with(".cfg")) || !names.insert(lower) {
            return Err("Invalid or duplicate package file".into());
        }
    }
    Ok(())
}

#[derive(serde::Serialize)]
struct SavedPack { opened: bool }

#[tauri::command]
fn save_tweak_pack(app: tauri::AppHandle, files: Vec<PackFile>) -> Result<SavedPack, String> {
    validate_pack(&files)?;
    #[cfg(not(target_os = "windows"))]
    { let _ = app; return Err("Windows only".into()); }
    #[cfg(target_os = "windows")]
    {
        use std::io::Write;
        use tauri::Manager;
        let display_desktop = app.path().desktop_dir().map_err(|e| e.to_string())?;
        let desktop = std::fs::canonicalize(&display_desktop).map_err(|e| e.to_string())?;
        let root = desktop.join("RustFlow_Tweaks");
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let root = std::fs::canonicalize(&root).map_err(|e| e.to_string())?;
        if root.parent() != Some(desktop.as_path()) { return Err("Invalid desktop folder".into()); }
        // Each export gets a new directory; previous exports are never overwritten.
        let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_err(|e| e.to_string())?.as_nanos();
        let directory_name = format!("pack-{}-{}", timestamp, std::process::id());
        let output = root.join(&directory_name);
        std::fs::create_dir(&output).map_err(|e| e.to_string())?;
        for file in files {
            let path = file.name.split('/').fold(output.clone(), |p, part| p.join(part));
            let parent = path.parent().ok_or("Invalid path")?;
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            let mut dest = std::fs::OpenOptions::new().write(true).create_new(true).open(path).map_err(|e| e.to_string())?;
            dest.write_all(&file.data).and_then(|_| dest.sync_all()).map_err(|e| e.to_string())?;
        }
        // Open the instructions rather than claiming there is a consolidated
        // apply script: the pack contains manual and non-registry steps too.
        let readme = display_desktop.join("RustFlow_Tweaks").join(directory_name).join("RustFlow-Pack").join("README.txt");
        let opened = readme.is_file() && std::process::Command::new("explorer.exe").arg("/select,").arg(readme).spawn().is_ok();
        Ok(SavedPack { opened })
    }
}

#[cfg(test)]
mod pack_tests {
    use super::*;
    fn file(name: &str) -> PackFile { PackFile { name: name.into(), data: vec![1] } }
    #[test]
    fn accepts_pack_and_rejects_unsafe_paths() {
        assert!(validate_pack(&[file("RustFlow-Pack/README.txt"), file("RustFlow-Pack/Otkat/test.bat")]).is_ok());
        for path in ["../evil.bat", "RustFlow-Pack/../evil.reg", "RustFlow-Pack/C:/evil.bat", "RustFlow-Pack/evil.exe", "RustFlow-Pack/NUL.txt", "RustFlow-Pack/a\\evil.reg"] {
            assert!(validate_pack(&[file(path)]).is_err(), "{path}");
        }
        assert!(validate_pack(&[file("RustFlow-Pack/a.txt"), file("RustFlow-Pack/A.TXT")]).is_err());
    }
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![read_windows_info, find_rust_directory, write_client_cfg, restore_client_cfg, open_official_support, save_tweak_pack])
        .run(tauri::generate_context!())
        .expect("failed to run RustFlow");
}
