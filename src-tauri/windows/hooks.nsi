!macro NSIS_HOOK_POSTINSTALL
  ; Activar el inicio con Windows para instalaciones nuevas.
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Vortex-Optimizer" '"$INSTDIR\Vortex-Optimizer.exe"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Limpiar la entrada creada por el instalador al desinstalar.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Vortex-Optimizer"
!macroend
