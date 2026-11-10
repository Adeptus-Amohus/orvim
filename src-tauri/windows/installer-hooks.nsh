; The resource name matches tauri.conf.json and is independent of app version.
; Preserve shortcut targets, arguments and AppUserModelID; fall back to the EXE.
!macro OrvimRefreshShortcut shortcut
  Push $0
  Push $1
  !insertmacro IsShortcutTarget "${shortcut}" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $1
  ${If} $1 != 1
    !insertmacro IsShortcutTarget "${shortcut}" "$INSTDIR\life-os.exe"
    Pop $1
  ${EndIf}
  ${If} $1 = 1
  !insertmacro ComHlpr_CreateInProcInstance ${CLSID_ShellLink} ${IID_IShellLink} r0 ""
  ${If} $0 P<> 0
    ${IUnknown::QueryInterface} $0 '("${IID_IPersistFile}",.r1)'
    ${If} $1 P<> 0
      ${IPersistFile::Load} $1 '("${shortcut}", ${STGM_READWRITE})'
      ${IShellLink::SetPath} $0 '(w "$INSTDIR\${MAINBINARYNAME}.exe")'
      ${If} ${FileExists} "$INSTDIR\orvim-launcher.ico"
        ${IShellLink::SetIconLocation} $0 '(w "$INSTDIR\orvim-launcher.ico", 0)'
      ${Else}
        ${IShellLink::SetIconLocation} $0 '(w "$INSTDIR\${MAINBINARYNAME}.exe", 0)'
      ${EndIf}
      ${IPersistFile::Save} $1 '("${shortcut}",1)'
      ${IUnknown::Release} $1 ""
    ${EndIf}
    ${IUnknown::Release} $0 ""
  ${EndIf}
  ${EndIf}
  Pop $1
  Pop $0
!macroend

; Migrate only shortcuts that point to this installation, keeping their stored
; shell properties and pinned identity. An unrelated shortcut is never changed.
!macro OrvimMigrateShortcut oldShortcut newShortcut
  Push $0
  Push $1
  !insertmacro IsShortcutTarget "${oldShortcut}" "$INSTDIR\${MAINBINARYNAME}.exe"
  Pop $0
  ${If} $0 = 1
    ${If} ${FileExists} "${newShortcut}"
      !insertmacro IsShortcutTarget "${newShortcut}" "$INSTDIR\${MAINBINARYNAME}.exe"
      Pop $1
      ${If} $1 = 1
        Delete "${newShortcut}"
        Rename "${oldShortcut}" "${newShortcut}"
      ${EndIf}
    ${Else}
      Rename "${oldShortcut}" "${newShortcut}"
    ${EndIf}
  ${EndIf}
  Pop $1
  Pop $0
!macroend

!macro NSIS_HOOK_POSTINSTALL
  !insertmacro OrvimMigrateShortcut "$DESKTOP\Life OS.lnk" "$DESKTOP\${PRODUCTNAME}.lnk"
  !insertmacro OrvimMigrateShortcut "$SMPROGRAMS\Life OS.lnk" "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  !insertmacro OrvimMigrateShortcut "$SMPROGRAMS\$AppStartMenuFolder\Life OS.lnk" "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
  !insertmacro OrvimRefreshShortcut "$DESKTOP\${PRODUCTNAME}.lnk"
  !insertmacro OrvimRefreshShortcut "$SMPROGRAMS\${PRODUCTNAME}.lnk"
  !insertmacro OrvimRefreshShortcut "$SMPROGRAMS\$AppStartMenuFolder\${PRODUCTNAME}.lnk"
  ; Repair pinned shortcuts only when they target this exact installation.
  Push $2
  Push $3
  ClearErrors
  FindFirst $2 $3 "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\*.lnk"
  ${DoUntil} ${Errors}
    !insertmacro OrvimRefreshShortcut "$APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\$3"
    ClearErrors
    FindNext $2 $3
  ${Loop}
  FindClose $2
  Pop $3
  Pop $2
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend
