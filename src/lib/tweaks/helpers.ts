/**
 * Builders for downloadable tweak files.
 *
 * Every generated file is plain ASCII text so that Windows reads it correctly
 * regardless of the system code page. Line endings are converted to CRLF at
 * download time.
 */

const ADMIN_HEAD = String.raw`@echo off
setlocal
title RustFlow - __TITLE__
fltmc >nul 2>&1
if errorlevel 1 (
  echo Requesting administrator rights...
  set "RF_BAT=%~f0"
  powershell -NoProfile -Command "Start-Process -FilePath $env:RF_BAT -Verb RunAs"
  exit /b
)
echo.
echo  RustFlow ^| __TITLE__
echo.`;

const USER_HEAD = String.raw`@echo off
setlocal
title RustFlow - __TITLE__
echo.
echo  RustFlow ^| __TITLE__
echo.`;

const BAT_TAIL = String.raw`echo.
echo  __DONE__
echo.
pause`;

function fill(template: string, values: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(values)) {
    out = out.split(`__${key}__`).join(value);
  }
  return out;
}

/** Batch file that elevates itself through UAC before running the body. */
export function adminBat(title: string, body: string, done: string): string {
  return `${fill(ADMIN_HEAD, { TITLE: title })}\n${body.trim()}\n${fill(BAT_TAIL, { DONE: done })}\n`;
}

/** Batch file that runs with the current user's rights (HKCU / user folders only). */
export function userBat(title: string, body: string, done: string): string {
  return `${fill(USER_HEAD, { TITLE: title })}\n${body.trim()}\n${fill(BAT_TAIL, { DONE: done })}\n`;
}

/** Registry file. `body` must contain only ASCII characters. */
export function reg(title: string, body: string): string {
  return `Windows Registry Editor Version 5.00\n\n; RustFlow - ${title}\n\n${body.trim()}\n`;
}

/* ------------------------------------------------------------------ */
/* Hybrid .bat + PowerShell installers for Rust client.cfg             */
/* ------------------------------------------------------------------ */

const HYBRID_HEAD = String.raw`<# : batch portion
@echo off
setlocal
title RustFlow - __TITLE__
set "RF_BAT=%~f0"
powershell -NoProfile -Command "Invoke-Expression (Get-Content -LiteralPath $env:RF_BAT -Raw)"
echo.
pause
exit /b
#>

$ErrorActionPreference = 'Stop'
`;

const PS_FIND_RUST = String.raw`function Find-Rust {
  if ($env:RUSTFLOW_RUST_DIR) { return $env:RUSTFLOW_RUST_DIR }
  $roots = New-Object System.Collections.Generic.List[string]
  foreach ($key in 'HKCU:\Software\Valve\Steam', 'HKLM:\SOFTWARE\WOW6432Node\Valve\Steam') {
    try {
      $p = Get-ItemProperty -Path $key -ErrorAction Stop
      foreach ($name in 'SteamPath', 'InstallPath') {
        if ($p.$name) { $roots.Add(($p.$name -replace '/', '\')) }
      }
    } catch { }
  }
  $libs = New-Object System.Collections.Generic.List[string]
  foreach ($r in $roots) {
    $libs.Add($r)
    $vdf = Join-Path $r 'steamapps\libraryfolders.vdf'
    if (Test-Path -LiteralPath $vdf) {
      foreach ($line in Get-Content -LiteralPath $vdf) {
        if ($line -match '"path"\s+"(.+)"') { $libs.Add(($Matches[1] -replace '\\\\', '\')) }
      }
    }
  }
  foreach ($l in $libs) {
    $dir = Join-Path $l 'steamapps\common\Rust'
    if (Test-Path -LiteralPath (Join-Path $dir 'RustClient.exe')) { return $dir }
  }
  return $null
}

function Get-RustCfg {
  if (Get-Process -Name 'RustClient' -ErrorAction SilentlyContinue) {
    Write-Host '  Rust is running. Close the game and run this file again.' -ForegroundColor Red
    return $null
  }
  $rust = Find-Rust
  if (-not $rust) {
    Write-Host '  Rust folder was not found automatically.'
    Write-Host '  Steam - Rust - Manage - Browse local files, then paste the folder path below.'
    $rust = (Read-Host '  Rust folder').Trim().Trim('"')
  }
  if (-not $rust -or -not (Test-Path -LiteralPath $rust)) {
    Write-Host '  Folder not found. Nothing was changed.' -ForegroundColor Red
    return $null
  }
  $cfgDir = Join-Path $rust 'cfg'
  if (-not (Test-Path -LiteralPath $cfgDir)) { New-Item -ItemType Directory -Path $cfgDir | Out-Null }
  return (Join-Path $cfgDir 'client.cfg')
}
`;

const PS_APPLY = String.raw`function Main {
  Write-Host ''
  Write-Host ('  RustFlow | ' + $PresetName) -ForegroundColor Yellow
  Write-Host ''
  $cfg = Get-RustCfg
  if (-not $cfg) { return }
  Write-Host '  This changes client.cfg. Close Rust and keep a backup before proceeding.' -ForegroundColor Yellow
  if ((Read-Host '  Type YES to continue') -cne 'YES') { Write-Host '  Cancelled. Nothing was changed.'; return }
  $content = ''
  $hasBom = $false
  if (Test-Path -LiteralPath $cfg) {
    $backup = $cfg + '.rustflow-backup'
    if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $cfg -Destination $backup }
    $bak = $cfg + '.bak'
    if (-not (Test-Path -LiteralPath $bak)) { Copy-Item -LiteralPath $cfg -Destination $bak }
    $bytes = [System.IO.File]::ReadAllBytes($cfg)
    $hasBom = $bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
    $offset = if ($hasBom) { 3 } else { 0 }
    $utf8 = New-Object System.Text.UTF8Encoding($false, $true)
    $content = $utf8.GetString($bytes, $offset, $bytes.Length - $offset)
    if ($content.Contains([char]0)) { throw 'Config contains NUL bytes; nothing changed.' }
  }
  $newline = if ($content.Contains(([string][char]13 + [char]10))) { ([string][char]13 + [char]10) } else { ([string][char]10) }
  $seen = @{}
  $changed = [int[]]@(0)
  $pattern = '(?m)^([ \t]*)([a-zA-Z0-9_.]+)([ \t]+)("[^"\r\n]*"|[^\s\r\n]+)([^\r\n]*)'
  $content = [regex]::Replace($content, $pattern, [System.Text.RegularExpressions.MatchEvaluator]{
    param($m)
    $key = $m.Groups[2].Value
    if (-not $Settings.Contains($key)) { return $m.Value }
    $seen[$key] = $true
    $newValue = '"' + $Settings[$key] + '"'
    if ($m.Groups[4].Value -ne $newValue) { $changed[0]++ }
    return $m.Groups[1].Value + $key + $m.Groups[3].Value + $newValue + $m.Groups[5].Value
  })
  foreach ($key in $Settings.Keys) {
    if (-not $seen.ContainsKey($key)) {
      if ($content.Length -gt 0 -and -not $content.EndsWith(([string][char]10)) -and -not $content.EndsWith(([string][char]13))) { $content += $newline }
      $content += $key + ' "' + $Settings[$key] + '"' + $newline
      $changed[0]++
    }
  }
  $encoding = New-Object System.Text.UTF8Encoding($hasBom, $true)
  [System.IO.File]::WriteAllText($cfg, $content, $encoding)
  Write-Host ('  File: ' + $cfg)
  Write-Host ('  Settings in preset: ' + $Settings.Count + ', changed: ' + $changed[0]) -ForegroundColor Green
  Write-Host '  Done. Start Rust - the new settings are loaded on launch.' -ForegroundColor Green
}

try { Main } catch { Write-Host ('  Error: ' + $_.Exception.Message) -ForegroundColor Red }
`;

const PS_RESTORE = String.raw`function Main {
  Write-Host ''
  Write-Host '  RustFlow | Restore client.cfg from backup' -ForegroundColor Yellow
  Write-Host ''
  $cfg = Get-RustCfg
  if (-not $cfg) { return }
  $backup = $cfg + '.rustflow-backup'
  if (-not (Test-Path -LiteralPath $backup)) {
    Write-Host '  Backup file was not found. Nothing was changed.' -ForegroundColor Red
    return
  }
  Copy-Item -LiteralPath $backup -Destination $cfg -Force
  Write-Host ('  Restored: ' + $cfg) -ForegroundColor Green
  Write-Host '  The backup file was kept next to client.cfg.'
}

try { Main } catch { Write-Host ('  Error: ' + $_.Exception.Message) -ForegroundColor Red }
`;

function settingsBlock(settings: Record<string, string>): string {
  const width = Math.max(...Object.keys(settings).map((k) => k.length)) + 2;
  const rows = Object.entries(settings).map(
    ([key, value]) => `  ${`'${key}'`.padEnd(width + 1)}= '${value}'`,
  );
  return `$Settings = [ordered]@{\n${rows.join("\n")}\n}\n`;
}

/**
 * One-click installer: finds the Rust folder, backs up cfg\client.cfg once and
 * merges the given convars into it (existing lines are replaced, new appended).
 */
export function cfgInstaller(title: string, settings: Record<string, string>): string {
  return [
    fill(HYBRID_HEAD, { TITLE: title }),
    `$PresetName = '${title}'\n`,
    settingsBlock(settings),
    PS_FIND_RUST,
    PS_APPLY,
  ].join("\n");
}

/** Same installer, but the settings table is produced by custom PowerShell code. */
export function cfgInstallerDynamic(title: string, settingsCode: string): string {
  return [
    fill(HYBRID_HEAD, { TITLE: title }),
    `$PresetName = '${title}'\n`,
    `${settingsCode.trim()}\n`,
    PS_FIND_RUST,
    PS_APPLY,
  ].join("\n");
}

/** Restores cfg\client.cfg from the backup created by the installers. */
export function cfgRestore(): string {
  return [fill(HYBRID_HEAD, { TITLE: "Restore client.cfg" }), PS_FIND_RUST, PS_RESTORE].join("\n");
}

/** Human-readable list for manual entry in the F1 console. */
export function consoleList(settings: Record<string, string>): string {
  return Object.entries(settings)
    .map(([k, v]) => `${k} ${v}`)
    .join("\n");
}
