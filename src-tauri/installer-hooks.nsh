; Tauri's built-in helper creates/updates the shortcut for the current user.
; The standard uninstaller removes the shortcut only if it points at this app.
!macro NSIS_HOOK_POSTINSTALL
  Call CreateOrUpdateDesktopShortcut
!macroend
