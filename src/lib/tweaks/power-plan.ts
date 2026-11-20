import { adminBat } from "./helpers";

// Never modify the user's original plan. Keep its exact GUID (which may be an
// OEM plan), refuse collisions, and only adjust AC values in our own clone.
const setup = `$ErrorActionPreference='Stop'; $id='7c76f423-91b5-41f5-a06c-0c23a55252e2'; $file=Join-Path $env:LOCALAPPDATA 'RustFlow\\original-plan.txt'; function Plan { $out=& powercfg.exe @args; if($LASTEXITCODE -ne 0){throw ('powercfg failed: '+$args[0])}; $out };`;
const run = (body: string) =>
  `powershell -NoProfile -Command "${setup} ${body}"\nif errorlevel 1 (echo Operation failed. Read the error above. & pause & exit /b 1)`;
export const applyPlan = adminBat(
  "Test AC power plan",
  run(
    [
      `if(Test-Path -LiteralPath $file){throw 'A saved plan exists. Restore it before starting a new test.'};`,
      `$active=[regex]::Match((Plan /getactivescheme | Out-String),'(?i)[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}').Value; if(!$active -or $active -eq $id){throw 'No original plan found'};`,
      `if((Plan /list | Out-String).Contains($id)){throw 'Plan ID is already in use; nothing changed'};`,
      `[IO.Directory]::CreateDirectory((Split-Path $file)) | Out-Null; Set-Content -LiteralPath $file -Value $active -Encoding Ascii;`,
      `try{try{Plan /duplicatescheme e9a42b02-d5df-448d-aa00-03f14749eb61 $id}catch{Plan /duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c $id};`,
      `Plan /changename $id 'RustFlow Performance'; Plan /setacvalueindex $id SUB_PROCESSOR PROCTHROTTLEMIN 100; Plan /setacvalueindex $id SUB_PROCESSOR PROCTHROTTLEMAX 100;`,
      `Plan /setacvalueindex $id SUB_PROCESSOR CPMINCORES 100; Plan /setacvalueindex $id 2a737441-1930-4402-8d77-b2bebba308a3 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0; Plan /setacvalueindex $id SUB_PCIEXPRESS ASPM 0; Plan /setactive $id}`,
      `catch{Write-Warning 'The plan may be unsupported. Run REVERT to restore the original.'; throw}; Plan /getactivescheme`,
    ].join(" "),
  ),
  "Compare temperatures and frame times on AC power.",
);
export const revertPlan = adminBat(
  "Restore original power plan",
  run(
    [
      `$active=([guid](Get-Content -Raw -LiteralPath $file).Trim()).ToString(); if($active -eq $id){throw 'Invalid original plan'};`,
      `Plan /setactive $active; if((Plan /list | Out-String).Contains($id)){Plan /delete $id}; Remove-Item -LiteralPath $file; Plan /getactivescheme`,
    ].join(" "),
  ),
  "Original plan restored.",
);
