# SHIFT web showcase

The public site has one route and four client-side scenes. Onboarding completion
and the locale are stored locally in the browser; if storage is unavailable,
onboarding can recur on the next visit.

There is no checked-in Windows installer or published GitHub release. Download
buttons stay disabled until `NEXT_PUBLIC_SHIFT_WINDOWS_DOWNLOAD_URL` is set at
build time to the HTTPS URL of a real, verified Windows installer. Do not point it
to a ZIP of configuration files or invent a version number. Desktop Tauri sources
remain separate from the web routes. `npm run build:desktop` stages the desktop UI
from `desktop-src/` and exports it into `out/`; Windows packaging and its behaviour
still require Windows verification. The staged development tree is refreshed when
`node scripts/desktop-dev.mjs`/the Tauri development command starts and should be restarted
after source changes.
