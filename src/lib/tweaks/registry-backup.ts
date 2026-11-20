import { adminBat, userBat } from "./helpers";
import type { Tweak, TweakFile } from "./types";

/** Generate a pair for the shipped, static REG dialect (no user-supplied
 * paths). Snapshot only the individual values the step writes. Unlike a whole
 * branch import this preserves unrelated edits and handles absent values. */
export function registryBackup(t: Tweak): { save: TweakFile; restore: TweakFile } | null {
  if (t.file.kind !== "reg") return null;
  const pairs: string[] = [];
  let hive = "",
    path = "";
  for (const line of t.file.content.split(/\r?\n/)) {
    const key = line.match(/^\[HKEY_(CURRENT_USER|LOCAL_MACHINE)\\([\w .\\-]+)\]$/);
    if (key) {
      hive = key[1] === "CURRENT_USER" ? "CurrentUser" : "LocalMachine";
      path = key[2];
      continue;
    }
    if (!line.trim() || line.startsWith(";") || line.startsWith("Windows Registry Editor")) continue;
    const value = line.match(/^"([\w .-]+)"=(?:dword:[\da-fA-F]{8}|"[^"\r\n]*")$/);
    if (!path || !value) return null;
    pairs.push(
      `@{h=[Microsoft.Win32.Registry]::${hive};p='${path}';n='${value[1]}';id='${hive}\\${path}::${value[1]}'}`,
    );
  }
  if (!pairs.length) return null;
  const base = `$ErrorActionPreference='Stop'; $pairs=@(${pairs.join(",")}); $file=Join-Path $env:LOCALAPPDATA 'RustFlow\\Registry\\${t.slug}.xml';`;
  const save = `if(Test-Path -LiteralPath $file){throw 'Snapshot already exists. Keep the first backup.'}; $state=@(); foreach($p in $pairs){$k=$p.h.OpenSubKey($p.p); $exists=$null -ne $k -and $k.GetValueNames() -contains $p.n; $v=@{id=$p.id;exists=$exists}; if($exists){$v.kind=$k.GetValueKind($p.n).ToString(); $v.data=$k.GetValue($p.n,$null,'DoNotExpandEnvironmentNames')}; if($k){$k.Close()}; $state+=$v}; [IO.Directory]::CreateDirectory((Split-Path $file)) | Out-Null; Export-Clixml -InputObject @{version=1;slug='${t.slug}';rows=$state} -LiteralPath $file -NoClobber`;
  const restore = `$backup=Import-Clixml -LiteralPath $file; $state=@($backup.rows); if($backup.version -ne 1 -or $backup.slug -ne '${t.slug}' -or $state.Count -ne $pairs.Count){throw 'Wrong snapshot'}; for($i=0;$i -lt $pairs.Count;$i++){if($state[$i].id -ne $pairs[$i].id -or $state[$i].exists -isnot [bool]){throw 'Wrong registry value list'}}; for($i=0;$i -lt $pairs.Count;$i++){$p=$pairs[$i]; $v=$state[$i]; if($v.exists){$k=$p.h.CreateSubKey($p.p); $data=$v.data; if($v.kind -eq 'Binary'){$data=[byte[]]$data}; if($v.kind -eq 'MultiString'){$data=[string[]]$data}; $k.SetValue($p.n,$data,$v.kind)}else{$k=$p.h.OpenSubKey($p.p,$true); if($k){$k.DeleteValue($p.n,$false)}}; if($k){$k.Close()}}; Remove-Item -LiteralPath $file`;
  const bat = t.admin ? adminBat : userBat;
  const make = (verb: string, body: string): TweakFile => ({
    kind: "bat",
    name: `${t.slug}-${verb}.bat`,
    content: bat(
      `${verb} ${t.slug}`,
      `powershell -NoProfile -Command "${base} ${body}"\nif errorlevel 1 (echo Operation failed. Check the error before continuing. & pause & exit /b 1)`,
      `${verb} complete.`,
    ),
  });
  return { save: make("snapshot", save), restore: make("restore-snapshot", restore) };
}
