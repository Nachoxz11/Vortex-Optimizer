!macro NSIS_HOOK_POSTINSTALL
  ; La app requiereAdministrator; una tarea elevada es más fiable que HKCU\Run al iniciar sesión.
  nsExec::ExecToLog 'schtasks.exe /Create /TN "Vortex-Optimizer" /SC ONLOGON /TR "\"$INSTDIR\Vortex-Optimizer.exe\"" /RL HIGHEST /F'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  ; Limpiar la tarea y cualquier entrada antigua creada por versiones anteriores.
  nsExec::ExecToLog 'schtasks.exe /Delete /TN "Vortex-Optimizer" /F'
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Vortex-Optimizer"
!macroend
