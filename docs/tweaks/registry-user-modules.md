# Módulos de registro por usuario

Esta primera tanda usa las referencias de `Add/Winhance-26.06.12` y
`Add/winutil-26.07.17` solo para validar el comportamiento. Vortex-Optimizer no carga,
ejecuta ni distribuye archivos de esas carpetas.

Todos los módulos de esta página son por usuario (`HKCU`), no requieren
elevación, no crean punto de restauración y no requieren reinicio. Antes de
`Apply`, Vortex-Optimizer guarda la existencia, tipo y valor de cada entrada en
`%APPDATA%/Vortex-Optimizer/tweak-snapshots.json`. `Revert` restaura exactamente esa
instantánea; si la entrada no existía, la elimina. La auditoría se escribe en
`%APPDATA%/Vortex-Optimizer/tweak-history.ndjson`.

| ID | Claves y valores aplicados | Servicios/tareas/Appx/PowerShell/DISM/BCD |
| --- | --- | --- |
| `pr.tailored` | `HKCU\Software\Microsoft\Windows\CurrentVersion\Privacy\TailoredExperiencesWithDiagnosticDataEnabled = DWORD 0` | Ninguno; PowerShell se limita a leer/escribir el Registro. |
| `pr.advertising` | `HKCU\Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo\Enabled = DWORD 0` | Ninguno; PowerShell se limita a leer/escribir el Registro. |
| `pr.inking` | `HKCU\Software\Microsoft\InputPersonalization\RestrictImplicitInkCollection = DWORD 1`; `RestrictImplicitTextCollection = DWORD 1`; `HKCU\Software\Microsoft\InputPersonalization\TrainedDataStore\HarvestContacts = DWORD 0` | Ninguno; PowerShell se limita a leer/escribir el Registro. |
| `pr.feedback` | `HKCU\Software\Microsoft\Siuf\Rules\NumberOfSIUFInPeriod = DWORD 0` | Ninguno; PowerShell se limita a leer/escribir el Registro. |
| `pr.speech` | `HKCU\Software\Microsoft\Speech_OneCore\Settings\OnlineSpeechPrivacy\HasAccepted = DWORD 0` | Ninguno; PowerShell se limita a leer/escribir el Registro. |
| `p.wsearchweb` | `HKCU\Software\Policies\Microsoft\Windows\Explorer\DisableSearchBoxSuggestions = DWORD 1` | Ninguno; PowerShell se limita a leer/escribir el Registro. |
| `p.transparency` | `HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize\EnableTransparency = DWORD 0` | Ninguno; PowerShell se limita a leer/escribir el Registro. |
| `p.menushow` | `HKCU\Control Panel\Desktop\MenuShowDelay = String "0"` | Ninguno; PowerShell se limita a leer/escribir el Registro. |

El motor no acepta comandos, rutas ni valores enviados por el renderer: el IPC
solo recibe un ID de una lista cerrada y las operaciones están definidas dentro
del proceso principal de Electron.

## Módulo de servicio: SysMain

`p.sysmain` se contrastó con las definiciones de servicio de WinUtil y
Winhance. Ambos configuran el inicio de SysMain como deshabilitado; Vortex-Optimizer
además guarda el modo de inicio y el estado de ejecución para poder recuperar
el estado exacto.

| Área | Operación |
| --- | --- |
| Servicio | `SysMain`: `Stop-Service -Force` y `Set-Service -StartupType Disabled`; al revertir se restaura `Automatic`, `Manual` o `Disabled` y se vuelve a iniciar solo si estaba ejecutándose. |
| Registro | El Service Control Manager actualiza `HKLM\SYSTEM\CurrentControlSet\Services\SysMain\Start`; Vortex-Optimizer no escribe esa clave directamente. |
| Tareas, Appx, DISM, bcdedit | Ninguno. |
| PowerShell | Elevado, con comandos internos de lista cerrada. |
| Restauración/reinicio | Se intenta crear un punto de restauración antes de aplicar; se recomienda reiniciar. |

Los módulos `p.printspool`, `p.fax` y `p.remote` usan el mismo motor elevado,
pero son archivos independientes. Se revisaron las definiciones de servicios
equivalentes de WinUtil y Winhance: no modifican tareas programadas, Appx,
DISM ni bcdedit. Cada uno detiene y deshabilita solo el servicio indicado y,
en `Revert`, recupera su modo de inicio y su estado de ejecución previos.

| ID | Servicio | Consideración |
| --- | --- | --- |
| `p.printspool` | `Spooler` | No aplicar si se usan impresoras físicas o virtuales, incluido PDF. |
| `p.fax` | `Fax` | Servicio de fax heredado; normalmente no se usa. |
| `p.remote` | `RemoteRegistry` | Impide el acceso remoto al Registro; puede afectar la administración remota. |
| `p.search` | `WSearch` | Detiene la indexación; las búsquedas de Outlook, Inicio y Explorador pueden degradarse. |

## Módulos de segundo plano

| ID | Clave y valor aplicados | Servicios/tareas/Appx/DISM/BCD/reinicio |
| --- | --- | --- |
| `p.bgapps` | `HKCU\Software\Microsoft\Windows\CurrentVersion\BackgroundAccessApplications\GlobalUserDisabled = DWORD 1` | Ninguno. Impide ejecución en segundo plano de apps de Microsoft Store; sus notificaciones pueden dejar de llegar. |
| `p.tips` | `HKCU\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager\SoftLandingEnabled = DWORD 0` | Ninguno. Desactiva sugerencias Soft Landing para el usuario actual. |

Ambos se validaron contra las implementaciones equivalentes de WinUtil y
Winhance. No requieren elevación ni punto de restauración; su estado previo se
restaura desde la instantánea local.

## Módulo de telemetría

`p.telemetry` combina el servicio `DiagTrack` que WinUtil deshabilita con la
lista explícita de tareas de recopilación que Winhance expone individualmente.
Antes de escribir código se comprobó que no hay Appx, DISM ni bcdedit
involucrados. Se intenta un punto de restauración y se conserva el estado de
cada componente antes de actuar.

| Tipo | Componentes afectados |
| --- | --- |
| Servicio | `DiagTrack`: se detiene y se establece en `Disabled`; se restaura su modo y estado previos. |
| Tareas programadas | `Microsoft Compatibility Appraiser`, `ProgramDataUpdater`, `Consolidator`, `UsbCeip`, `Microsoft-Windows-DiskDiagnosticDataCollector`, `DmClient` y `DmClientOnScenarioDownload`, en sus rutas estándar de Microsoft. Las inexistentes se omiten para compatibilidad entre versiones. |
| Registro/Appx/DISM/bcdedit | Ninguno escrito directamente por Vortex-Optimizer. |
| Reinicio | Recomendado. |

## Power throttling

`p.throttling` se validó contra `power-throttling` de Winhance. Aplica
`HKLM\SYSTEM\CurrentControlSet\Control\Power\PowerThrottling\PowerThrottlingOff = DWORD 1`.
No modifica servicios, tareas, Appx, DISM o bcdedit. Necesita elevación,
intenta crear un punto de restauración y restaura el valor original al
revertir. Puede aumentar el consumo en portátiles.

## Hibernación

`p.hibernate` combina las dos implementaciones de referencia: usa
`powercfg.exe /hibernate off` como operación efectiva —libera `hiberfil.sys`—
y oculta la opción de hibernar con
`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\FlyoutMenuSettings\ShowHibernateOption = DWORD 0`.
Antes de aplicar guarda `HibernateEnabled`, `HiberbootEnabled`, `HiberFileType`
y `ShowHibernateOption`; al revertir reactiva la hibernación solo si estaba
activa y restaura los cuatro valores. No toca servicios, tareas, Appx, DISM ni
bcdedit. Requiere UAC, intenta un punto de restauración y requiere reinicio.

## Permisos y búsqueda privados

Los módulos siguientes se contrastaron con `PrivacyOptimizations` de Winhance.
No modifican servicios, tareas, Appx, DISM ni bcdedit. `pr.activity` y
`pr.cloudsearch` son por usuario. Los demás escriben una política o consentimiento
de dispositivo, por lo que solicitan UAC, crean un punto de restauración de
mejor esfuerzo y restauran la instantánea exacta.

| ID | Claves y valores aplicados |
| --- | --- |
| `pr.activity` | `HKCU\SOFTWARE\Policies\Microsoft\Windows\System\PublishUserActivities = DWORD 0` |
| `pr.cloudsearch` | `HKCU\Software\Microsoft\Windows\CurrentVersion\SearchSettings\IsMSACloudSearchEnabled = DWORD 0` |
| `pr.cortana` | `HKCU` y `HKLM` `...\Policies\Microsoft\Windows\Windows Search\AllowCortana = DWORD 0` |
| `pr.location` | `HKLM\...\CapabilityAccessManager\ConsentStore\location\Value = "Deny"` |
| `pr.camera` | `HKLM\...\ConsentStore\webcam\Value = "Deny"` |
| `pr.mic` | `HKLM\...\ConsentStore\microphone\Value = "Deny"` |
| `pr.account` | `HKLM\...\ConsentStore\userAccountInformation\Value = "Deny"` |
| `pr.appdiag` | `HKLM\...\ConsentStore\appDiagnostics\Value = "Deny"` |
| `pr.contacts` | `HKLM\...\ConsentStore\contacts\Value = "Deny"` |
| `pr.docs` | `HKLM\...\ConsentStore\documentsLibrary` y `picturesLibrary\Value = "Deny"` |
| `pr.notif` | `HKLM\...\ConsentStore\userNotificationListener\Value = "Deny"` |
| `pr.radios` | `HKLM\...\ConsentStore\radios\Value = "Deny"` |

## Diagnóstico y actividad

`pr.diag` combina las políticas de diagnóstico documentadas por Winhance con
las de WinUtil: establece en `0` `AllowTelemetry` y `MaxTelemetryAllowed` en
las rutas de políticas de HKCU/HKLM y `CurrentVersion\Policies\DataCollection`.
`pr.activity` reúne `EnableActivityFeed`, `PublishUserActivities` y
`UploadUserActivities` de HKLM junto a la política de usuario.
Ambos necesitan UAC y punto de restauración de mejor esfuerzo. No tocan
servicios, tareas, Appx, DISM ni bcdedit; el servicio y las tareas de
telemetría se controlan exclusivamente mediante `p.telemetry`.

## Entrega y errores

`p.deliveryopt` usa el valor `DODownloadMode = 0` en la política de usuario y
de equipo: WinUtil lo utiliza para detener el intercambio P2P y Winhance
documenta los mismos puntos de política. `p.errorreport` aplica
`Disabled = 1` en las políticas de Windows Error Reporting de HKCU/HKLM; no
detiene `WerSvc`, preservando diagnósticos locales. Ambos requieren UAC y
punto de restauración de mejor esfuerzo. No cambian tareas, Appx, DISM ni
bcdedit; `Revert` restaura los valores previos.

`p.autoupdatestore` aplica `AutoDownload = DWORD 2` en
`HKCU` y `HKLM\SOFTWARE\Policies\Microsoft\WindowsStore`, el valor de
actualización manual contrastado en Winhance. No toca servicios, tareas, Appx,
DISM o bcdedit; requiere UAC y guarda una instantánea para revertir.

`p.animations` aplica `HKCU\Control Panel\Desktop\WindowMetrics\MinAnimate = "0"`,
el valor documentado por WinUtil y Winhance para reducir animaciones de
minimizar/maximizar. Es por usuario, no cambia servicios, tareas, Appx, DISM o
bcdedit y requiere volver a iniciar sesión o reiniciar para reflejarse por
completo.

`p.prio` escribe `HKLM\SYSTEM\CurrentControlSet\Control\PriorityControl\Win32PrioritySeparation = DWORD 38`,
el valor **Programs** documentado por Winhance. Es un bitfield (no se asume
que el valor anterior sea el predeterminado), por eso Vortex-Optimizer lo captura y lo
restaura literalmente. Requiere UAC, punto de restauración de mejor esfuerzo
y reinicio; no toca servicios, tareas, Appx, DISM ni bcdedit.

## Fast Startup

`p.faststartup` se validó contra la definición de energía de Winhance. El
módulo usa la ruta activa y estable `CurrentControlSet`, no un `ControlSet001`
fijo: escribe `HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Power\HiberbootEnabled = DWORD 0`.
No ejecuta `powercfg`, no cambia el archivo de hibernación ni toca servicios,
tareas, Appx, DISM o bcdedit. Requiere elevación, intenta crear un punto de
restauración y recomienda reiniciar; `Revert` restaura el valor exacto previo.
bcdedit.

## Shell de Windows

Los siguientes módulos por usuario se verificaron con los valores de
personalización de WinUtil: `TaskbarAl=0`, `TaskbarMn=0`,
`ShowTaskViewButton=0`, `HideFileExt=0`, `LaunchTo=1` y
`SearchboxTaskbarMode=1`. No cambian servicios, tareas, Appx, DISM ni bcdedit;
pueden requerir reiniciar Explorer o Windows y todos conservan el valor anterior
para `Revert`.

`w.ex.hidden` establece `HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced\Hidden = DWORD 1`,
validado en WinUtil. No modifica servicios, tareas, Appx, DISM ni bcdedit;
requiere que Explorer se actualice para reflejarse por completo.

`w.ex.compact`, `w.tb.seconds` y `w.sr.highlight` se contrastaron con los
valores de Winhance `UseCompactMode = 1`, `ShowSecondsInSystemClock = 1` y
`IsDynamicSearchBoxEnabled = 0`, respectivamente. Son valores de HKCU; no
tocan servicios, tareas, Appx, DISM ni bcdedit. Cada módulo conserva el valor
original y puede requerir reiniciar Explorer o cerrar sesión para verse.

`w.ls.spotlight` y `w.ls.tips` escriben los valores por usuario
`RotatingLockScreenEnabled`, `RotatingLockScreenOverlayEnabled` y
`SubscribedContent-338387Enabled` en `ContentDeliveryManager`, todos en `0`,
según Winhance. No modifican servicios, tareas, Appx, DISM ni bcdedit y
restauran la instantánea exacta al deshacer.

`w.cp.copilot` aplica `ShowCopilotButton = 0` en
`HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced`, el
valor de Winhance para ocultar exclusivamente el acceso de la barra de tareas.
No desinstala ni deshabilita Copilot, ni modifica servicios, tareas, Appx,
DISM o bcdedit; requiere actualizar Explorer para reflejarse.

`w.tb.combine` aplica `TaskbarGlomLevel = 2` y `MMTaskbarGlomLevel = 2` en
`HKCU\...\Explorer\Advanced`, los valores **Never** de Winhance para la barra
principal y monitores adicionales. No altera servicios, tareas, Appx, DISM o
bcdedit; conserva ambos valores para poder restaurarlos y requiere reiniciar
Explorer o cerrar sesión.

`w.ex.homeads` establece `ShowRecent = 0` en
`HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer`, conforme a la
personalización de Explorer de Winhance. Oculta elementos recientes y
recomendados de Home sin borrar archivos ni historiales; no cambia servicios,
tareas, Appx, DISM o bcdedit y conserva el valor original.

## Memoria y captura de juegos

`p.paging` habilita `ClearPageFileAtShutdown = DWORD 1` en
`HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Memory Management`.
Fue contrastado con la configuración de seguridad equivalente de Winhance. No
toca servicios, tareas, Appx, DISM ni bcdedit; requiere UAC, punto de
restauración de mejor esfuerzo y reinicio. El apagado puede tardar más y
`Revert` recupera el valor original.

`p.superfetchgame` desactiva la captura en segundo plano de Game DVR mediante
`HKCU\...\CurrentVersion\GameDVR\AppCaptureEnabled = 0` y
`HKCU\System\GameConfigStore\GameDVR_Enabled = 0`. No elimina Xbox Game Bar,
servicios, tareas, Appx, DISM ni bcdedit. Se conserva el estado previo de
ambos valores y puede requerir cerrar sesión o reiniciar.

`p.edgepreload` configura las políticas recomendadas `BackgroundModeEnabled = 0`
y `StartupBoostEnabled = 0` en
`HKLM\SOFTWARE\Policies\Microsoft\Edge\Recommended`, tal como las usa
WinUtil. No elimina Edge ni toca servicios, tareas, Appx, DISM o bcdedit;
requiere UAC, guarda una instantánea recuperable e intenta crear un punto de
restauración. Edge puede abrir un poco más lento tras revertir/aplicar.

`pr.copilot` establece `TurnOffWindowsCopilot = 1` en las políticas de HKCU y
HKLM de `WindowsCopilot`, conforme a Winhance y WinUtil. Solicita UAC, intenta
un punto de restauración y requiere reiniciar/cerrar sesión. No desinstala
Appx ni modifica servicios, tareas, DISM o bcdedit; `Revert` restaura ambos
valores originales.

`pr.store` desactiva para el usuario actual `ContentDeliveryAllowed`,
`SubscribedContentEnabled` y `FeatureManagementEnabled` bajo
`ContentDeliveryManager`, los valores recomendados por Winhance para limitar
contenido personalizado. `pr.edge` escribe la política de equipo
`HubsSidebarEnabled = 0` de Microsoft Edge, compartida por Winhance y WinUtil.
El segundo requiere UAC y punto de restauración; ninguno altera servicios,
tareas, Appx, DISM o bcdedit y ambos conservan su estado anterior.

`n.throttle` se basa en la configuración de rendimiento de Winhance: escribe
`NetworkThrottlingIndex = DWORD 0xffffffff` en
`HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Multimedia\SystemProfile`
para retirar el límite multimedia. Requiere UAC, punto de restauración de mejor
esfuerzo y reinicio; no toca servicios, tareas, Appx, DISM ni bcdedit y
restaura el valor literal anterior.

`p.reserved` usa DISM como WinUtil: consulta `Get-ReservedStorageState` con
`/English`, guarda si estaba `Enabled` o `Disabled` y aplica
`Set-ReservedStorageState /State:Disabled`. No escribe Registro, no toca
servicios, tareas, Appx ni bcdedit. Requiere UAC y punto de restauración de
mejor esfuerzo; puede necesitar reiniciar y conviene revertirlo antes de una
actualización importante de características.

## Energía PCIe y USB

`p.pciexpress` y `p.usbsuspend` usan `powercfg` con el plan activo y los GUID
documentados por Winhance. Vortex-Optimizer lee primero los índices `ACSettingIndex` y
`DCSettingIndex` en la clave del plan activo, los guarda y usa `setacvalueindex`
y `setdcvalueindex` para aplicar y restaurar. PCIe queda en `0/0` (sin ahorro
de enlace); USB queda en `0/1` (sin suspensión selectiva en CA, conservando el
ahorro en batería). No modifican servicios, tareas, Appx, DISM ni bcdedit;
solicitan UAC y punto de restauración de mejor esfuerzo.

`p.corepark` opera dos GUID de `SUB_PROCESSOR` documentados por Winhance:
`CPMINCORES` y `CPMAXCORES`. Captura ambos índices AC/DC del plan activo y los
establece en 100; al revertir recupera los cuatro valores. No cambia servicios,
tareas, Appx, DISM, bcdedit ni los atributos que Windows usa para ocultar los
controles de la interfaz. Requiere UAC, punto de restauración y reinicio.
