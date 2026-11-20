# Desktop work in progress

The desktop target is a Next.js static export, separate from the normal web build.
`npm run build:desktop` stages the frontend in `.desktop-build`, excludes the
server API and admin pages, and outputs `out/`. Query-dependent pages use client
query parsing in this export. Account, assistant and other server-backed features
are not provided by this standalone export. `npm run tauri dev` uses the existing
Next dev server; `npm run tauri build` runs the desktop export first. Rust and
Tauri's Windows prerequisites, including WebView2, are required.

**Not ready for release.** Rust and Windows behavior have not been compiled or
verified in this environment. The read-only hardware query tries to identify the
physical disk containing Rust and only auto-fills a build if every required field
is known and CPU/GPU are exact catalogue matches. A saved or explicitly selected
build takes priority. RAM CAS latency and 1080p resolution are estimates, not
read from the machine. Unsupported or ambiguous devices and disks require manual
selection. The cfg-only operation searches Steam libraries, writes a backup before
changing the config, and can restore it; it refuses a subsequent write while the
backup exists. Do not rely on it until tested on Windows with independent backups.

On a push to `main`, or via Actions → Build Windows installer → Run workflow,
GitHub Actions builds an x64 NSIS installer on Windows and uploads the
`RustFlow-Windows-x64-setup` artifact for 30 days. Download and extract the
artifact ZIP to obtain the setup EXE. It is not code-signed; Windows may display
SmartScreen warnings. WebView2 may require a network connection during setup.
The workflow definition must first exist on the repository's default branch.

In desktop mode, saving the tweak package creates a new subfolder under the
current user's Desktop `RustFlow_Tweaks` folder and opens it in Explorer. It
contains the existing pack instructions, tweak files and available rollback
instructions/scripts; no scripts are executed. Existing exports are not
overwritten. The user must read the instructions, make the recommended backups,
and manually choose any actions. If Explorer cannot open, check the Desktop
folder manually. Windows behavior still needs verification.

The driver screen can open fixed official support pages; it does not download,
verify, launch or install binaries. System tweak transactions, restore points,
UAC elevation and driver installation remain unimplemented and return
`unavailable`. No administrator manifest is included: elevating the entire
webview before the IPC and production security model have been audited would
expose the machine to unnecessary risk. Do not ship the shell or point it at a
remote website until these issues are resolved.
