!include "MUI2.nsh"
!include "LogicLib.nsh"

!ifndef BUILD_UNINSTALLER
Var PcRole
!endif

!macro customInit
  !ifndef BUILD_UNINSTALLER
  StrCpy $PcRole "client"
  MessageBox MB_ICONQUESTION|MB_YESNO "Este computador sera configurado como Servidor?$\r$\n$\r$\nSim = Servidor$\r$\nNao = Cliente" IDYES setServer
  Goto setClient
  setServer:
    StrCpy $PcRole "server"
    Goto done
  setClient:
    StrCpy $PcRole "client"
  done:
  !endif
!macroend

!macro customInstall
  !ifndef BUILD_UNINSTALLER
  WriteRegStr HKCU "Software\LanHouseManagement" "InstallMode" "$PcRole"
  ${If} $PcRole == "client"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "LanHouseClient" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}"'
  ${Else}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "LanHouseClient"
  ${EndIf}
  !endif
!macroend
