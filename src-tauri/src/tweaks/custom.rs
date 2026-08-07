//! Tweaks con lógica propia, que no encajan en las tres factories declarativas.
//!
//! Port de `core-parking.cjs`, `hibernation.cjs`, `reserved-storage.cjs`, `telemetry.cjs` y
//! `classic-context-menu.cjs`. Los scripts de PowerShell se conservan literales.
//!
//! FASE 2 (no migrado en esta pasada): son 8 tweaks heterogéneos, cada uno con su API nativa
//! recomendada — no comparten un único reemplazo como sí lo tenían los 71 tweaks de `registry.rs`:
//! - Telemetría / Defender realtime: WMI `ROOT\Microsoft\Windows\Defender`
//!   (`MSFT_MpPreference`/`MSFT_MpComputerStatus`) vía la crate `wmi` (misma conexión persistente
//!   por hilo que ya usan los proveedores de `crate::info`).
//! - Tareas programadas (telemetría): Task Scheduler COM (`ITaskService`, módulo
//!   `Win32_System_TaskScheduler` de `windows`) en vez de `Get-ScheduledTask`/`Disable-ScheduledTask`;
//!   como paso intermedio de bajo riesgo, también serviría invocar `schtasks.exe` directo por
//!   `Command` (sin PowerShell) igual que se hizo con `reg.exe` en `registry.rs`.
//! - Reserved Storage: no tiene API pública estable fuera de `dism.exe /Online
//!   /Get-ReservedStorageState`; migrar sólo el *transporte* (invocar `dism.exe` directo por
//!   `Command`, sin PowerShell de por medio) es el paso de bajo riesgo disponible hoy.
//! - Hibernación / menú clásico: ya son lecturas/escrituras de Registro simples — se migran igual
//!   que `registry.rs`, con `winreg` directo.
//! - Core parking / platform clock timer / kernel debug: `powercfg.exe`/`bcdedit.exe` invocados
//!   directo por `Command` (sin PowerShell), siguiendo el mismo patrón que
//!   `powercfg::apply_indices` (elevación única vía `run_elevated_exe`, encadenando con `cmd.exe
//!   /c` si hace falta más de un comando).

use serde_json::{json, Value};

use crate::powershell::{
    as_array, encode_json_payload, restore_point_script, run, run_elevated, run_json,
};
use crate::snapshots::SnapshotStore;

/// Metadatos de los tweaks custom, en el mismo orden en que aparecen en `manager.cjs`.
pub struct CustomMeta {
    pub id: &'static str,
    pub name: &'static str,
    pub category: &'static str,
    pub risk: &'static str,
    pub description: &'static str,
    pub requires_restart: bool,
}

pub const CUSTOM_TWEAKS: [CustomMeta; 24] = [
    CustomMeta {
        id: "p.telemetry",
        name: "Disable Telemetry",
        category: "Performance",
        risk: "Moderate",
        description: "Disables DiagTrack and selected Windows telemetry collector tasks.",
        requires_restart: true,
    },
    CustomMeta {
        id: "p.hibernate",
        name: "Disable hibernation",
        category: "Performance",
        risk: "Moderate",
        description: "Disables hibernation and releases the hibernation file. Fast Startup also becomes unavailable.",
        requires_restart: true,
    },
    CustomMeta {
        id: "p.reserved",
        name: "Reserved storage",
        category: "Performance",
        risk: "Moderate",
        description: "Disables Windows Reserved Storage to reclaim update-reserved disk space. Re-enable it before a major feature update.",
        requires_restart: true,
    },
    CustomMeta {
        id: "p.corepark",
        name: "Disable core parking",
        category: "Performance",
        risk: "Moderate",
        description: "Keeps all processor cores available by setting Core Parking minimum and maximum to 100%.",
        requires_restart: true,
    },
    CustomMeta {
        id: "w.cx.classic",
        name: "Classic context menu",
        category: "Windows",
        risk: "Safe",
        description: "Restores the full Windows 10-style right-click menu in Explorer.",
        requires_restart: true,
    },
    CustomMeta {
        id: "a.defender",
        name: "Suspend real-time protection",
        category: "Advanced",
        risk: "Advanced",
        description: "Pauses Microsoft Defender real-time monitoring via Set-MpPreference.",
        requires_restart: false,
    },
    CustomMeta {
        id: "a.timer",
        name: "Force platform clock timer",
        category: "Advanced",
        risk: "Advanced",
        description: "Pins the scheduler to the platform (HPET) clock instead of the TSC.",
        requires_restart: true,
    },
    CustomMeta {
        id: "a.debug",
        name: "Kernel debug mode",
        category: "Advanced",
        risk: "Advanced",
        description: "Enables the boot debugger transport via bcdedit.",
        requires_restart: true,
    },
    // ---------------------------------------------------------------- Network
    CustomMeta {
        id: "n.nagle",
        name: "Disable Nagle algorithm",
        category: "Network",
        risk: "Safe",
        description: "Sets TcpNoDelay=1 on all adapters so small packets are sent immediately.",
        requires_restart: false,
    },
    CustomMeta {
        id: "n.autotune",
        name: "TCP window auto-tuning",
        category: "Network",
        risk: "Safe",
        description: "Controls whether Windows scales the TCP receive window dynamically.",
        requires_restart: false,
    },
    CustomMeta {
        id: "n.rss",
        name: "Receive Side Scaling",
        category: "Network",
        risk: "Safe",
        description: "Spreads NIC interrupts across multiple CPU cores for throughput.",
        requires_restart: false,
    },
    CustomMeta {
        id: "n.ecn",
        name: "Explicit Congestion Notification",
        category: "Network",
        risk: "Safe",
        description: "Signals congestion without dropping packets via TCP ECN.",
        requires_restart: false,
    },
    CustomMeta {
        id: "n.qos",
        name: "QoS packet scheduler reserve",
        category: "Network",
        risk: "Safe",
        description: "Sets NonBestEffortLimit=0 so Windows no longer reserves 20% of bandwidth for QoS.",
        requires_restart: false,
    },
    CustomMeta {
        id: "n.netbios",
        name: "NetBIOS over TCP/IP",
        category: "Network",
        risk: "Moderate",
        description: "Disables NetBIOS over TCP/IP on all adapters (safe for modern networks).",
        requires_restart: false,
    },
    CustomMeta {
        id: "n.llmnr",
        name: "LLMNR and mDNS",
        category: "Network",
        risk: "Moderate",
        description: "Disables LLMNR multicast name resolution via group policy key.",
        requires_restart: false,
    },
    CustomMeta {
        id: "n.dnscache",
        name: "Aggressive DNS caching",
        category: "Network",
        risk: "Safe",
        description: "Caps the DNS cache TTL to 3600 s and clears negative cache immediately.",
        requires_restart: false,
    },
    // -------------------------------------------------------------- Performance
    CustomMeta {
        id: "p.compact",
        name: "CompactOS compression",
        category: "Performance",
        risk: "Moderate",
        description: "Compresses system binaries on disk via compact.exe /CompactOS.",
        requires_restart: false,
    },
    CustomMeta {
        id: "p.trim",
        name: "Aggressive SSD TRIM",
        category: "Performance",
        risk: "Safe",
        description: "Ensures TRIM (delete notify) is enabled via fsutil behavior.",
        requires_restart: false,
    },
    CustomMeta {
        id: "p.onedrive",
        name: "OneDrive auto-start",
        category: "Performance",
        risk: "Safe",
        description: "Removes OneDrive from the sign-in Run key so it no longer launches automatically.",
        requires_restart: false,
    },
    CustomMeta {
        id: "p.timer",
        name: "High precision event timer",
        category: "Performance",
        risk: "Advanced",
        description: "Pins the scheduler to the platform (HPET) clock instead of the TSC.",
        requires_restart: true,
    },
    CustomMeta {
        id: "p.schedtasks",
        name: "Cleanup Scheduled Tasks",
        category: "Performance",
        risk: "Safe",
        description: "Registers Windows cleanup tasks for SoftwareDistribution and Temp folders.",
        requires_restart: false,
    },
    CustomMeta {
        id: "s.dohtls",
        name: "DNS over HTTPS",
        category: "Security",
        risk: "Moderate",
        description: "Configures DNS-over-HTTPS with Cloudflare on active network adapters.",
        requires_restart: false,
    },
    CustomMeta { id: "g.amdtelemetry", name: "AMD Driver Telemetry", category: "Gaming", risk: "Moderate", description: "Disables AMD driver analytics and release notifications when an AMD GPU is detected.", requires_restart: true },
    CustomMeta { id: "g.mpo", name: "MPO Compatibility Fix", category: "Gaming", risk: "Moderate", description: "Disables Multiplane Overlay to reduce display flicker and overlay stuttering.", requires_restart: true },
];

pub fn is_custom(id: &str) -> bool {
    CUSTOM_TWEAKS.iter().any(|t| t.id == id)
}

pub fn check(id: &str) -> Result<Value, String> {
    match id {
        "p.telemetry" => telemetry_check(),
        "p.hibernate" => hibernate_check(),
        "p.reserved" => reserved_check(),
        "p.corepark" => corepark_check(),
        "w.cx.classic" => classic_menu_check(),
        "a.defender" => defender_check(),
        "a.timer" => timer_check(),
        "a.debug" => debug_check(),
        "n.nagle" => nagle_check(),
        "n.autotune" => autotune_check(),
        "n.rss" => rss_check(),
        "n.ecn" => ecn_check(),
        "n.qos" => qos_check(),
        "n.netbios" => netbios_check(),
        "n.llmnr" => llmnr_check(),
        "n.dnscache" => dnscache_check(),
        "p.compact" => compact_check(),
        "p.trim" => trim_check(),
        "p.onedrive" => onedrive_check(),
        "p.timer" => ptimer_check(),
        "p.schedtasks" => schedtasks_check(),
        "s.dohtls" => dohtls_check(),
        "g.amdtelemetry" => amdtelemetry_check(),
        "g.mpo" => mpo_check(),
        _ => Err(format!("Tweak custom desconocido: {id}")),
    }
}

pub fn apply(id: &str, snapshots: &SnapshotStore) -> Result<(), String> {
    match id {
        "p.telemetry" => telemetry_apply(snapshots),
        "p.hibernate" => hibernate_apply(snapshots),
        "p.reserved" => reserved_apply(snapshots),
        "p.corepark" => corepark_apply(snapshots),
        "w.cx.classic" => classic_menu_apply(snapshots),
        "a.defender" => defender_apply(snapshots),
        "a.timer" => timer_apply(snapshots),
        "a.debug" => debug_apply(snapshots),
        "n.nagle" => nagle_apply(snapshots),
        "n.autotune" => autotune_apply(snapshots),
        "n.rss" => rss_apply(snapshots),
        "n.ecn" => ecn_apply(snapshots),
        "n.qos" => qos_apply(snapshots),
        "n.netbios" => netbios_apply(snapshots),
        "n.llmnr" => llmnr_apply(snapshots),
        "n.dnscache" => dnscache_apply(snapshots),
        "p.compact" => compact_apply(snapshots),
        "p.trim" => trim_apply(snapshots),
        "p.onedrive" => onedrive_apply(snapshots),
        "p.timer" => ptimer_apply(snapshots),
        "p.schedtasks" => schedtasks_apply(snapshots),
        "s.dohtls" => dohtls_apply(snapshots),
        "g.amdtelemetry" => amdtelemetry_apply(snapshots),
        "g.mpo" => mpo_apply(snapshots),
        _ => Err(format!("Tweak custom desconocido: {id}")),
    }
}

pub fn revert(id: &str, snapshot: &Value) -> Result<(), String> {
    match id {
        "p.telemetry" => telemetry_revert(snapshot),
        "p.hibernate" => hibernate_revert(snapshot),
        "p.reserved" => reserved_revert(snapshot),
        "p.corepark" => corepark_revert(snapshot),
        "w.cx.classic" => classic_menu_revert(snapshot),
        "a.defender" => defender_revert(snapshot),
        "a.timer" => timer_revert(snapshot),
        "a.debug" => debug_revert(snapshot),
        "n.nagle" => nagle_revert(snapshot),
        "n.autotune" => autotune_revert(snapshot),
        "n.rss" => rss_revert(snapshot),
        "n.ecn" => ecn_revert(snapshot),
        "n.qos" => qos_revert(snapshot),
        "n.netbios" => netbios_revert(snapshot),
        "n.llmnr" => llmnr_revert(snapshot),
        "n.dnscache" => dnscache_revert(snapshot),
        "p.compact" => compact_revert(snapshot),
        "p.trim" => trim_revert(snapshot),
        "p.onedrive" => onedrive_revert(snapshot),
        "p.timer" => ptimer_revert(snapshot),
        "p.schedtasks" => schedtasks_revert(snapshot),
        "s.dohtls" => dohtls_revert(snapshot),
        "g.amdtelemetry" => amdtelemetry_revert(snapshot),
        "g.mpo" => mpo_revert(snapshot),
        _ => Err(format!("Tweak custom desconocido: {id}")),
    }
}

// ---------------------------------------------------------------- p.telemetry

const TELEMETRY_SERVICE: &str = "DiagTrack";

const TELEMETRY_TASKS: [&str; 7] = [
    r"\Microsoft\Windows\Application Experience\Microsoft Compatibility Appraiser",
    r"\Microsoft\Windows\Application Experience\ProgramDataUpdater",
    r"\Microsoft\Windows\Customer Experience Improvement Program\Consolidator",
    r"\Microsoft\Windows\Customer Experience Improvement Program\UsbCeip",
    r"\Microsoft\Windows\DiskDiagnostic\Microsoft-Windows-DiskDiagnosticDataCollector",
    r"\Microsoft\Windows\Feedback\Siuf\DmClient",
    r"\Microsoft\Windows\Feedback\Siuf\DmClientOnScenarioDownload",
];

fn task_descriptors() -> Value {
    Value::Array(
        TELEMETRY_TASKS
            .iter()
            .map(|full_path| {
                let index = full_path.rfind('\\').unwrap_or(0);
                json!({
                    "fullPath": full_path,
                    "folder": &full_path[..index + 1],
                    "name": &full_path[index + 1..],
                })
            })
            .collect(),
    )
}

fn telemetry_status_script() -> String {
    format!(
        r#"
$targets = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
$service = Get-CimInstance -ClassName Win32_Service -Filter "Name='{TELEMETRY_SERVICE}'"
$tasks = foreach ($target in $targets) {{
  $task = Get-ScheduledTask -TaskPath $target.folder -TaskName $target.name -ErrorAction SilentlyContinue
  [PSCustomObject]@{{ path = $target.fullPath; exists = $null -ne $task; enabled = if ($task) {{ [bool]$task.Settings.Enabled }} else {{ $false }} }}
}}
[PSCustomObject]@{{ service = [PSCustomObject]@{{ exists = $null -ne $service; startMode = $service.StartMode; state = $service.State }}; tasks = @($tasks) }} | ConvertTo-Json -Compress -Depth 5
"#,
        payload = encode_json_payload(&task_descriptors())
    )
}

fn telemetry_check() -> Result<Value, String> {
    let status = run_json(&telemetry_status_script())?;
    let service = status.get("service").cloned().unwrap_or(Value::Null);
    let tasks = as_array(status.get("tasks").cloned().unwrap_or(Value::Null));

    let applied = service.get("exists").and_then(Value::as_bool).unwrap_or(false)
        && service.get("startMode").and_then(Value::as_str) == Some("Disabled")
        && tasks.iter().all(|task| {
            !task.get("exists").and_then(Value::as_bool).unwrap_or(false)
                || !task.get("enabled").and_then(Value::as_bool).unwrap_or(false)
        });

    Ok(json!({ "id": "p.telemetry", "applied": applied, "service": service, "tasks": tasks }))
}

fn telemetry_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    let snapshot = run_json(&telemetry_status_script())?;
    let exists = snapshot
        .get("service")
        .and_then(|s| s.get("exists"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    if !exists {
        return Err("El servicio DiagTrack no existe en esta instalación de Windows.".into());
    }
    snapshots.set("p.telemetry", snapshot)?;

    let script = format!(
        r#"{restore}
$targets = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
Stop-Service -Name '{TELEMETRY_SERVICE}' -Force -ErrorAction SilentlyContinue
Set-Service -Name '{TELEMETRY_SERVICE}' -StartupType Disabled -ErrorAction Stop
foreach ($target in $targets) {{
  $task = Get-ScheduledTask -TaskPath $target.folder -TaskName $target.name -ErrorAction SilentlyContinue
  if ($task) {{ Disable-ScheduledTask -InputObject $task -ErrorAction Stop | Out-Null }}
}}
"#,
        restore = restore_point_script("Vortex-Optimizer - Disable Telemetry"),
        payload = encode_json_payload(&task_descriptors())
    );
    run_elevated(&script)?;
    Ok(())
}

fn telemetry_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(
        r#"
$snapshot = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
$modes = @{{ Auto = 'Automatic'; Manual = 'Manual'; Disabled = 'Disabled' }}
if (-not $modes.ContainsKey($snapshot.service.startMode)) {{ throw 'No se puede restaurar el modo de inicio del servicio.' }}
Set-Service -Name '{TELEMETRY_SERVICE}' -StartupType $modes[$snapshot.service.startMode] -ErrorAction Stop
foreach ($entry in $snapshot.tasks) {{
  if (-not $entry.exists) {{ continue }}
  $last = $entry.path.LastIndexOf('\')
  $folder = $entry.path.Substring(0, $last + 1)
  $name = $entry.path.Substring($last + 1)
  $task = Get-ScheduledTask -TaskPath $folder -TaskName $name -ErrorAction SilentlyContinue
  if ($task) {{
    if ($entry.enabled) {{ Enable-ScheduledTask -InputObject $task -ErrorAction Stop | Out-Null }}
    else {{ Disable-ScheduledTask -InputObject $task -ErrorAction Stop | Out-Null }}
  }}
}}
if ($snapshot.service.state -eq 'Running') {{ Start-Service -Name '{TELEMETRY_SERVICE}' -ErrorAction Stop }}
"#,
        payload = encode_json_payload(snapshot)
    );
    run_elevated(&script)?;
    Ok(())
}

// ---------------------------------------------------------------- p.hibernate

const POWER_PATH: &str = r"HKLM:\SYSTEM\CurrentControlSet\Control\Power";
const FLYOUT_PATH: &str =
    r"HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\FlyoutMenuSettings";

fn hibernate_targets() -> Value {
    json!([
        { "path": POWER_PATH, "name": "HibernateEnabled" },
        { "path": POWER_PATH, "name": "HiberbootEnabled" },
        { "path": POWER_PATH, "name": "HiberFileType" },
        { "path": FLYOUT_PATH, "name": "ShowHibernateOption" },
    ])
}

fn hibernate_state_script() -> String {
    format!(
        r#"
$targets = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
$result = foreach ($target in $targets) {{
  $key = if (Test-Path -LiteralPath $target.path) {{ Get-Item -LiteralPath $target.path }} else {{ $null }}
  $exists = $null -ne $key -and $key.GetValueNames() -contains $target.name
  [PSCustomObject]@{{ path = $target.path; name = $target.name; exists = $exists; value = if ($exists) {{ $key.GetValue($target.name, $null, 'DoNotExpandEnvironmentNames') }} else {{ $null }}; kind = if ($exists) {{ $key.GetValueKind($target.name).ToString() }} else {{ $null }} }}
}}
@($result) | ConvertTo-Json -Compress -Depth 4
"#,
        payload = encode_json_payload(&hibernate_targets())
    )
}

fn hibernate_check() -> Result<Value, String> {
    let entries = as_array(run_json(&hibernate_state_script())?);
    let applied = entries
        .iter()
        .find(|e| e.get("name").and_then(Value::as_str) == Some("HibernateEnabled"))
        .map(|e| {
            e.get("exists").and_then(Value::as_bool).unwrap_or(false)
                && e.get("value").and_then(Value::as_i64) == Some(0)
        })
        .unwrap_or(false);
    Ok(json!({ "id": "p.hibernate", "applied": applied, "targets": entries }))
}

fn hibernate_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("p.hibernate", run_json(&hibernate_state_script())?)?;

    let script = format!(
        r#"
{restore}
& powercfg.exe /hibernate off
if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
if (-not (Test-Path -LiteralPath '{FLYOUT_PATH}')) {{ New-Item -Path '{FLYOUT_PATH}' -Force | Out-Null }}
New-ItemProperty -LiteralPath '{FLYOUT_PATH}' -Name 'ShowHibernateOption' -PropertyType DWord -Value 0 -Force | Out-Null
"#,
        restore = restore_point_script("Vortex-Optimizer - Disable hibernation")
    );
    run_elevated(&script)?;
    Ok(())
}

fn hibernate_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(
        r#"
$snapshot = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
$hibernate = $snapshot | Where-Object {{ $_.name -eq 'HibernateEnabled' }} | Select-Object -First 1
if ($hibernate.exists -and [int]$hibernate.value -ne 0) {{
  & powercfg.exe /hibernate on
  if ($LASTEXITCODE -ne 0) {{ exit $LASTEXITCODE }}
}}
foreach ($entry in $snapshot) {{
  if ($entry.exists) {{
    if (-not (Test-Path -LiteralPath $entry.path)) {{ New-Item -Path $entry.path -Force | Out-Null }}
    New-ItemProperty -LiteralPath $entry.path -Name $entry.name -PropertyType $entry.kind -Value $entry.value -Force | Out-Null
  }} elseif (Test-Path -LiteralPath $entry.path) {{
    Remove-ItemProperty -LiteralPath $entry.path -Name $entry.name -ErrorAction SilentlyContinue
  }}
}}
"#,
        payload = encode_json_payload(snapshot)
    );
    run_elevated(&script)?;
    Ok(())
}

// ----------------------------------------------------------------- p.reserved

const RESERVED_STATE_SCRIPT: &str = r#"
$output = & dism.exe /Online /Get-ReservedStorageState /English 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw $output }
$match = [regex]::Match($output, '(?im)Reserved storage state\s*:\s*(Enabled|Disabled)')
if (-not $match.Success) { throw 'No se pudo determinar el estado de Reserved Storage.' }
[PSCustomObject]@{ state = $match.Groups[1].Value } | ConvertTo-Json -Compress
"#;

fn reserved_set_script(state: &str) -> String {
    format!(
        "& dism.exe /Online /Set-ReservedStorageState /State:{state} /English; if ($LASTEXITCODE -ne 0) {{ throw 'DISM no pudo cambiar Reserved Storage.' }}"
    )
}

fn reserved_check() -> Result<Value, String> {
    let status = run_json(RESERVED_STATE_SCRIPT)?;
    let state = status.get("state").and_then(Value::as_str).unwrap_or("");
    Ok(json!({ "id": "p.reserved", "applied": state == "Disabled", "state": state }))
}

fn reserved_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("p.reserved", run_json(RESERVED_STATE_SCRIPT)?)?;
    let script = format!(
        "{}\n{}",
        restore_point_script("Vortex-Optimizer - Reserved storage"),
        reserved_set_script("Disabled")
    );
    run_elevated(&script)?;
    Ok(())
}

fn reserved_revert(snapshot: &Value) -> Result<(), String> {
    let state = snapshot.get("state").and_then(Value::as_str).unwrap_or("");
    if state != "Enabled" && state != "Disabled" {
        return Err("No hay una copia válida del estado anterior para este tweak.".into());
    }
    run_elevated(&reserved_set_script(state))?;
    Ok(())
}

// ----------------------------------------------------------------- p.corepark

const COREPARK_SUBGROUP: &str = "54533251-82be-4824-96c1-47b60b740d00";
const COREPARK_SETTINGS: [&str; 2] = [
    "0cc5b647-c1df-4637-891a-dec35c318583",
    "ea062031-0e34-4ff1-9b6d-eb1059334028",
];

/// Lee AC/DC de los dos ajustes de Core Parking vía `powercfg /q`, no por registro.
///
/// Además de que el override por-plan puede no existir (ver el comentario de
/// `powercfg.rs::state_script`), estos dos ajustes vienen **ocultos** por Windows — `powercfg /q`
/// no los devuelve hasta que se marcan visibles una vez, algo que se controla con el DWORD
/// `Attributes` bajo `HKLM:\...\Control\Power\PowerSettings\<subgroup>\<setting>` (0 = visible,
/// 1 = oculto). `powercfg -attributes <subgroup> <setting> -ATTRIB_HIDE` cambia ese valor a 0
/// pese a su nombre — es el comando que usa el propio panel de Windows para estas casillas, así
/// que no requiere elevación aunque escriba en HKLM. Es idempotente, se ejecuta en cada lectura.
fn corepark_state_script() -> String {
    format!(
        r#"
$ErrorActionPreference = 'Stop'
$active=(& powercfg.exe /getactivescheme|Out-String);$m=[regex]::Match($active,'[0-9a-fA-F]{{8}}-(?:[0-9a-fA-F]{{4}}-){{3}}[0-9a-fA-F]{{12}}');if(-not $m.Success){{throw 'No se pudo identificar el plan de energía activo.'}};$scheme=$m.Value
$settings=@('{s0}','{s1}')
$items=foreach($setting in $settings){{
  & powercfg.exe -attributes {subgroup} $setting -ATTRIB_HIDE | Out-Null
  $output = & powercfg.exe /q $scheme {subgroup} $setting 2>&1 | Out-String
  $hexMatches = [regex]::Matches($output, '0x[0-9a-fA-F]{{8}}')
  if ($hexMatches.Count -lt 2) {{ throw 'Core Parking no está disponible en este plan.' }}
  [PSCustomObject]@{{setting=$setting;ac=[Convert]::ToUInt32($hexMatches[0].Value,16);dc=[Convert]::ToUInt32($hexMatches[1].Value,16)}}
}}
@($items)|ConvertTo-Json -Compress
"#,
        s0 = COREPARK_SETTINGS[0],
        s1 = COREPARK_SETTINGS[1],
        subgroup = COREPARK_SUBGROUP
    )
}

/// Arma el script que fija cada par AC/DC y reactiva el plan.
fn corepark_set_script(entries: &[(String, i64, i64)]) -> String {
    let mut script = entries
        .iter()
        .map(|(setting, ac, dc)| {
            format!(
                "& powercfg.exe /setacvalueindex scheme_current {COREPARK_SUBGROUP} {setting} {ac};if($LASTEXITCODE -ne 0){{throw 'No se pudo actualizar Core Parking en CA.'}}\n\
                 & powercfg.exe /setdcvalueindex scheme_current {COREPARK_SUBGROUP} {setting} {dc};if($LASTEXITCODE -ne 0){{throw 'No se pudo actualizar Core Parking en CC.'}}"
            )
        })
        .collect::<Vec<_>>()
        .join("\n");
    script.push_str(
        "\n& powercfg.exe /setactive scheme_current;if($LASTEXITCODE -ne 0){throw 'No se pudo activar el plan actualizado.'}",
    );
    script
}

fn corepark_entries(value: Value) -> Vec<(String, i64, i64)> {
    as_array(value)
        .into_iter()
        .filter_map(|entry| {
            Some((
                entry.get("setting")?.as_str()?.to_string(),
                entry.get("ac")?.as_i64()?,
                entry.get("dc")?.as_i64()?,
            ))
        })
        .collect()
}

fn corepark_check() -> Result<Value, String> {
    let raw = run_json(&corepark_state_script())?;
    let entries = corepark_entries(raw.clone());
    let applied = entries.len() == 2 && entries.iter().all(|(_, ac, dc)| *ac == 100 && *dc == 100);
    Ok(json!({ "id": "p.corepark", "applied": applied, "entries": as_array(raw) }))
}

fn corepark_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    let raw = run_json(&corepark_state_script())?;
    snapshots.set("p.corepark", Value::Array(as_array(raw.clone())))?;

    let desired: Vec<(String, i64, i64)> = corepark_entries(raw)
        .into_iter()
        .map(|(setting, _, _)| (setting, 100, 100))
        .collect();

    let script = format!(
        "{}\n{}",
        restore_point_script("Vortex-Optimizer - Disable core parking"),
        corepark_set_script(&desired)
    );
    run_elevated(&script)?;
    Ok(())
}

fn corepark_revert(snapshot: &Value) -> Result<(), String> {
    let entries = corepark_entries(snapshot.clone());
    let valid = entries.len() == 2
        && entries
            .iter()
            .all(|(setting, _, _)| COREPARK_SETTINGS.contains(&setting.as_str()));
    if !valid {
        return Err("No hay una copia válida del estado anterior para este tweak.".into());
    }
    run_elevated(&corepark_set_script(&entries))?;
    Ok(())
}

// --------------------------------------------------------------- w.cx.classic

const CLASSIC_KEY: &str =
    r"HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32";
const CLASSIC_ROOT: &str = r"HKCU:\Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}";

fn classic_state_script() -> String {
    format!(
        r#"
$keyPath='{CLASSIC_KEY}'
$exists=Test-Path -LiteralPath $keyPath
$valueExists=$false; $value=$null; $kind=$null
if($exists){{$key=Get-Item -LiteralPath $keyPath;if($key.GetValueNames() -contains ''){{$valueExists=$true;$value=$key.GetValue('', $null, 'DoNotExpandEnvironmentNames');$kind=$key.GetValueKind('').ToString()}}}}
[PSCustomObject]@{{keyExists=$exists;valueExists=$valueExists;value=$value;kind=$kind}}|ConvertTo-Json -Compress
"#
    )
}

fn classic_menu_check() -> Result<Value, String> {
    let state = run_json(&classic_state_script())?;
    let applied = state.get("keyExists").and_then(Value::as_bool).unwrap_or(false)
        && state
            .get("valueExists")
            .and_then(Value::as_bool)
            .unwrap_or(false)
        && state.get("value").and_then(Value::as_str) == Some("");
    Ok(json!({ "id": "w.cx.classic", "applied": applied, "state": state }))
}

fn classic_menu_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("w.cx.classic", run_json(&classic_state_script())?)?;
    run(&format!(
        "if(-not(Test-Path -LiteralPath '{CLASSIC_KEY}')){{New-Item -Path '{CLASSIC_KEY}' -Force|Out-Null}}; Set-Item -LiteralPath '{CLASSIC_KEY}' -Value ''"
    ))?;
    Ok(())
}

fn classic_menu_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(
        "$s=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}'))|ConvertFrom-Json;\
         if(-not $s.keyExists){{Remove-Item -LiteralPath '{CLASSIC_ROOT}' -Recurse -Force -ErrorAction SilentlyContinue}}\
         elseif($s.valueExists){{if(-not(Test-Path -LiteralPath '{CLASSIC_KEY}')){{New-Item -Path '{CLASSIC_KEY}' -Force|Out-Null}};$k=Get-Item -LiteralPath '{CLASSIC_KEY}';$k.SetValue('', $s.value, [Microsoft.Win32.RegistryValueKind]::$($s.kind))}}\
         elseif(Test-Path -LiteralPath '{CLASSIC_KEY}'){{Remove-ItemProperty -LiteralPath '{CLASSIC_KEY}' -Name '' -ErrorAction SilentlyContinue}}",
        payload = encode_json_payload(snapshot)
    );
    run(&script)?;
    Ok(())
}

// ---------------------------------------------------------------- a.defender

const DEFENDER_STATE_SCRIPT: &str = r#"
$pref = Get-MpPreference -ErrorAction Stop
[PSCustomObject]@{ disabled = [bool]$pref.DisableRealtimeMonitoring } | ConvertTo-Json -Compress
"#;

fn defender_check() -> Result<Value, String> {
    let status = run_json(DEFENDER_STATE_SCRIPT)?;
    let applied = status.get("disabled").and_then(Value::as_bool).unwrap_or(false);
    Ok(json!({ "id": "a.defender", "applied": applied, "state": status }))
}

fn defender_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("a.defender", run_json(DEFENDER_STATE_SCRIPT)?)?;
    run_elevated(&format!(
        "{}\nSet-MpPreference -DisableRealtimeMonitoring $true -ErrorAction Stop",
        restore_point_script("Vortex-Optimizer - Suspend real-time protection")
    ))?;
    Ok(())
}

fn defender_revert(snapshot: &Value) -> Result<(), String> {
    let disabled = snapshot.get("disabled").and_then(Value::as_bool).unwrap_or(false);
    run_elevated(&format!(
        "Set-MpPreference -DisableRealtimeMonitoring ${disabled} -ErrorAction Stop"
    ))?;
    Ok(())
}

// ------------------------------------------------------------------- a.timer

const TIMER_STATE_SCRIPT: &str = r#"
$output = & bcdedit.exe /enum '{current}' 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw $output }
$enabled = $output -match '(?im)^\s*useplatformclock\s+Yes\s*$'
[PSCustomObject]@{ enabled = [bool]$enabled } | ConvertTo-Json -Compress
"#;

fn timer_check() -> Result<Value, String> {
    let status = run_json(TIMER_STATE_SCRIPT)?;
    let applied = status.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    Ok(json!({ "id": "a.timer", "applied": applied, "state": status }))
}

fn timer_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("a.timer", run_json(TIMER_STATE_SCRIPT)?)?;
    let script = format!(
        r#"{restore}
& bcdedit.exe /set '{{current}}' useplatformclock true
if ($LASTEXITCODE -ne 0) {{ throw 'bcdedit no pudo fijar useplatformclock.' }}
"#,
        restore = restore_point_script("Vortex-Optimizer - Force platform clock timer")
    );
    run_elevated(&script)?;
    Ok(())
}

fn timer_revert(snapshot: &Value) -> Result<(), String> {
    let was_enabled = snapshot.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    let script = if was_enabled {
        "& bcdedit.exe /set '{current}' useplatformclock true".to_string()
    } else {
        "& bcdedit.exe /deletevalue '{current}' useplatformclock".to_string()
    };
    run_elevated(&format!(
        "{script}\nif ($LASTEXITCODE -ne 0) {{ throw 'bcdedit no pudo revertir useplatformclock.' }}"
    ))?;
    Ok(())
}

// ------------------------------------------------------------------- a.debug

const DEBUG_STATE_SCRIPT: &str = r#"
$output = & bcdedit.exe /enum '{current}' 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw $output }
$enabled = $output -match '(?im)^\s*debug\s+Yes\s*$'
[PSCustomObject]@{ enabled = [bool]$enabled } | ConvertTo-Json -Compress
"#;

fn debug_check() -> Result<Value, String> {
    let status = run_json(DEBUG_STATE_SCRIPT)?;
    let applied = status.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    Ok(json!({ "id": "a.debug", "applied": applied, "state": status }))
}

fn debug_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("a.debug", run_json(DEBUG_STATE_SCRIPT)?)?;
    let script = format!(
        r#"{restore}
& bcdedit.exe /debug '{{current}}' on
if ($LASTEXITCODE -ne 0) {{ throw 'bcdedit no pudo activar el modo debug.' }}
"#,
        restore = restore_point_script("Vortex-Optimizer - Kernel debug mode")
    );
    run_elevated(&script)?;
    Ok(())
}

fn debug_revert(snapshot: &Value) -> Result<(), String> {
    let was_enabled = snapshot.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    let state = if was_enabled { "on" } else { "off" };
    run_elevated(&format!(
        "& bcdedit.exe /debug '{{current}}' {state}\nif ($LASTEXITCODE -ne 0) {{ throw 'bcdedit no pudo revertir el modo debug.' }}"
    ))?;
    Ok(())
}
// ------------------------------------------------------------------- n.nagle

const NAGLE_STATE_SCRIPT: &str = r#"
$base = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces'
$result = foreach ($a in Get-ChildItem -LiteralPath $base -ErrorAction SilentlyContinue) {
  $exists = $a.GetValueNames() -contains 'TcpNoDelay'
  $value  = if ($exists) { $a.GetValue('TcpNoDelay', $null, 'DoNotExpandEnvironmentNames') } else { $null }
  [PSCustomObject]@{ path = $a.PSPath; exists = $exists; value = $value }
}
@($result) | ConvertTo-Json -Compress -Depth 3
"#;

fn nagle_check() -> Result<Value, String> {
    let entries = as_array(run_json(NAGLE_STATE_SCRIPT)?);
    let applied = !entries.is_empty()
        && entries.iter().all(|e| {
            e.get("exists").and_then(Value::as_bool).unwrap_or(false)
                && e.get("value").and_then(Value::as_i64) == Some(1)
        });
    Ok(json!({ "id": "n.nagle", "applied": applied, "entries": entries }))
}

fn nagle_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("n.nagle", run_json(NAGLE_STATE_SCRIPT)?)?;
    let script = format!(
        r#"{restore}
$base = 'HKLM:\SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces'
foreach ($a in Get-ChildItem -LiteralPath $base -ErrorAction SilentlyContinue) {{
  Set-ItemProperty -LiteralPath $a.PSPath -Name TcpNoDelay -Value 1 -Type DWord -Force
}}
"#,
        restore = restore_point_script("Vortex-Optimizer - Disable Nagle algorithm")
    );
    run_elevated(&script)?;
    Ok(())
}

fn nagle_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(
        r#"
$entries = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
foreach ($e in $entries) {{
  if ($e.exists) {{
    Set-ItemProperty -LiteralPath $e.path -Name TcpNoDelay -Value ([int]$e.value) -Type DWord -Force
  }} else {{
    Remove-ItemProperty -LiteralPath $e.path -Name TcpNoDelay -ErrorAction SilentlyContinue
  }}
}}
"#,
        payload = encode_json_payload(snapshot)
    );
    run_elevated(&script)?;
    Ok(())
}

// ----------------------------------------------------------------- n.autotune

const AUTOTUNE_STATE_SCRIPT: &str = r#"
$out = & netsh.exe int tcp show global 2>&1 | Out-String
$m = [regex]::Match($out, '(?im)Receive Window Auto-Tuning Level\s*:\s*(\S+)')
$level = if ($m.Success) { $m.Groups[1].Value.ToLower() } else { 'unknown' }
[PSCustomObject]@{ level = $level } | ConvertTo-Json -Compress
"#;

fn autotune_check() -> Result<Value, String> {
    let state = run_json(AUTOTUNE_STATE_SCRIPT)?;
    let level = state.get("level").and_then(Value::as_str).unwrap_or("");
    let applied = level == "normal";
    Ok(json!({ "id": "n.autotune", "applied": applied, "level": level }))
}

fn autotune_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("n.autotune", run_json(AUTOTUNE_STATE_SCRIPT)?)?;
    run_elevated("& netsh.exe int tcp set global autotuninglevel=normal; if ($LASTEXITCODE -ne 0) { throw 'netsh autotune failed.' }")?;
    Ok(())
}

fn autotune_revert(snapshot: &Value) -> Result<(), String> {
    let level = snapshot.get("level").and_then(Value::as_str).unwrap_or("normal");
    let target = match level {
        "disabled" | "highlyrestricted" | "restricted" | "experimental" => level,
        _ => "normal",
    };
    run_elevated(&format!(
        "& netsh.exe int tcp set global autotuninglevel={target}; if ($LASTEXITCODE -ne 0) {{ throw 'netsh autotune revert failed.' }}"
    ))?;
    Ok(())
}

// --------------------------------------------------------------------- n.rss

const RSS_STATE_SCRIPT: &str = r#"
$out = & netsh.exe int tcp show global 2>&1 | Out-String
$m = [regex]::Match($out, '(?im)Receive-Side Scaling State\s*:\s*(\S+)')
$state = if ($m.Success) { $m.Groups[1].Value.ToLower() } else { 'unknown' }
[PSCustomObject]@{ state = $state } | ConvertTo-Json -Compress
"#;

fn rss_check() -> Result<Value, String> {
    let status = run_json(RSS_STATE_SCRIPT)?;
    let state = status.get("state").and_then(Value::as_str).unwrap_or("");
    let applied = state == "enabled";
    Ok(json!({ "id": "n.rss", "applied": applied, "state": state }))
}

fn rss_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("n.rss", run_json(RSS_STATE_SCRIPT)?)?;
    run_elevated("& netsh.exe int tcp set global rss=enabled; if ($LASTEXITCODE -ne 0) { throw 'netsh rss failed.' }")?;
    Ok(())
}

fn rss_revert(snapshot: &Value) -> Result<(), String> {
    let was = snapshot.get("state").and_then(Value::as_str).unwrap_or("enabled");
    let target = if was == "disabled" { "disabled" } else { "enabled" };
    run_elevated(&format!(
        "& netsh.exe int tcp set global rss={target}; if ($LASTEXITCODE -ne 0) {{ throw 'netsh rss revert failed.' }}"
    ))?;
    Ok(())
}

// --------------------------------------------------------------------- n.ecn

const ECN_STATE_SCRIPT: &str = r#"
$out = & netsh.exe int tcp show global 2>&1 | Out-String
$m = [regex]::Match($out, '(?im)ECN Capability\s*:\s*(\S+)')
$state = if ($m.Success) { $m.Groups[1].Value.ToLower() } else { 'unknown' }
[PSCustomObject]@{ state = $state } | ConvertTo-Json -Compress
"#;

fn ecn_check() -> Result<Value, String> {
    let status = run_json(ECN_STATE_SCRIPT)?;
    let state = status.get("state").and_then(Value::as_str).unwrap_or("");
    let applied = state == "enabled";
    Ok(json!({ "id": "n.ecn", "applied": applied, "state": state }))
}

fn ecn_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("n.ecn", run_json(ECN_STATE_SCRIPT)?)?;
    run_elevated("& netsh.exe int tcp set global ecncapability=enabled; if ($LASTEXITCODE -ne 0) { throw 'netsh ecn failed.' }")?;
    Ok(())
}

fn ecn_revert(snapshot: &Value) -> Result<(), String> {
    let was = snapshot.get("state").and_then(Value::as_str).unwrap_or("disabled");
    let target = if was == "enabled" { "enabled" } else { "disabled" };
    run_elevated(&format!(
        "& netsh.exe int tcp set global ecncapability={target}; if ($LASTEXITCODE -ne 0) {{ throw 'netsh ecn revert failed.' }}"
    ))?;
    Ok(())
}

// --------------------------------------------------------------------- n.qos

const QOS_PATH: &str = r"HKLM:\SOFTWARE\Policies\Microsoft\Windows\Psched";
const QOS_VALUE: &str = "NonBestEffortLimit";

const QOS_STATE_SCRIPT: &str = r#"
$path  = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Psched'
$vname = 'NonBestEffortLimit'
$keyExists = Test-Path -LiteralPath $path
$valExists = $false; $value = $null
if ($keyExists) {
  $key = Get-Item -LiteralPath $path
  $valExists = $key.GetValueNames() -contains $vname
  if ($valExists) { $value = $key.GetValue($vname, $null, 'DoNotExpandEnvironmentNames') }
}
[PSCustomObject]@{ keyExists = $keyExists; valExists = $valExists; value = $value } | ConvertTo-Json -Compress
"#;

fn qos_check() -> Result<Value, String> {
    let state = run_json(QOS_STATE_SCRIPT)?;
    let val_exists = state.get("valExists").and_then(Value::as_bool).unwrap_or(false);
    let value = state.get("value").and_then(Value::as_i64).unwrap_or(20);
    let applied = val_exists && value == 0;
    Ok(json!({ "id": "n.qos", "applied": applied, "state": state }))
}

fn qos_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("n.qos", run_json(QOS_STATE_SCRIPT)?)?;
    let script = format!(
        r#"{restore}
if (-not (Test-Path -LiteralPath '{QOS_PATH}')) {{ New-Item -Path '{QOS_PATH}' -Force | Out-Null }}
Set-ItemProperty -LiteralPath '{QOS_PATH}' -Name '{QOS_VALUE}' -Value 0 -Type DWord -Force
"#,
        restore = restore_point_script("Vortex-Optimizer - QoS bandwidth reserve")
    );
    run_elevated(&script)?;
    Ok(())
}

fn qos_revert(snapshot: &Value) -> Result<(), String> {
    let state = snapshot.get("state").cloned().unwrap_or(Value::Null);
    let val_exists = state.get("valExists").and_then(Value::as_bool).unwrap_or(false);
    let key_exists = state.get("keyExists").and_then(Value::as_bool).unwrap_or(false);
    let value = state.get("value").and_then(Value::as_i64).unwrap_or(20);
    let script = if val_exists {
        format!(
            "if (-not (Test-Path -LiteralPath '{QOS_PATH}')) {{ New-Item -Path '{QOS_PATH}' -Force | Out-Null }}\n\
             Set-ItemProperty -LiteralPath '{QOS_PATH}' -Name '{QOS_VALUE}' -Value {value} -Type DWord -Force"
        )
    } else if key_exists {
        format!("Remove-ItemProperty -LiteralPath '{QOS_PATH}' -Name '{QOS_VALUE}' -ErrorAction SilentlyContinue")
    } else {
        format!("Remove-Item -LiteralPath '{QOS_PATH}' -Recurse -Force -ErrorAction SilentlyContinue")
    };
    run_elevated(&script)?;
    Ok(())
}

// ----------------------------------------------------------------- n.netbios

const NETBIOS_STATE_SCRIPT: &str = r#"
$base = 'HKLM:\SYSTEM\CurrentControlSet\Services\NetBT\Parameters\Interfaces'
$result = foreach ($a in Get-ChildItem -LiteralPath $base -ErrorAction SilentlyContinue) {
  $exists = $a.GetValueNames() -contains 'NetbiosOptions'
  $value  = if ($exists) { $a.GetValue('NetbiosOptions', $null, 'DoNotExpandEnvironmentNames') } else { $null }
  [PSCustomObject]@{ path = $a.PSPath; exists = $exists; value = $value }
}
@($result) | ConvertTo-Json -Compress -Depth 3
"#;

fn netbios_check() -> Result<Value, String> {
    let entries = as_array(run_json(NETBIOS_STATE_SCRIPT)?);
    let applied = !entries.is_empty()
        && entries.iter().all(|e| {
            e.get("exists").and_then(Value::as_bool).unwrap_or(false)
                && e.get("value").and_then(Value::as_i64) == Some(2)
        });
    Ok(json!({ "id": "n.netbios", "applied": applied, "entries": entries }))
}

fn netbios_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("n.netbios", run_json(NETBIOS_STATE_SCRIPT)?)?;
    let script = format!(
        r#"{restore}
$base = 'HKLM:\SYSTEM\CurrentControlSet\Services\NetBT\Parameters\Interfaces'
foreach ($a in Get-ChildItem -LiteralPath $base -ErrorAction SilentlyContinue) {{
  Set-ItemProperty -LiteralPath $a.PSPath -Name NetbiosOptions -Value 2 -Type DWord -Force
}}
"#,
        restore = restore_point_script("Vortex-Optimizer - Disable NetBIOS over TCP/IP")
    );
    run_elevated(&script)?;
    Ok(())
}

fn netbios_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(
        r#"
$entries = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
foreach ($e in $entries) {{
  if ($e.exists) {{
    Set-ItemProperty -LiteralPath $e.path -Name NetbiosOptions -Value ([int]$e.value) -Type DWord -Force
  }} else {{
    Remove-ItemProperty -LiteralPath $e.path -Name NetbiosOptions -ErrorAction SilentlyContinue
  }}
}}
"#,
        payload = encode_json_payload(snapshot)
    );
    run_elevated(&script)?;
    Ok(())
}

// ------------------------------------------------------------------ n.llmnr

const LLMNR_PATH: &str = r"HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient";
const LLMNR_VALUE: &str = "EnableMulticast";

const LLMNR_STATE_SCRIPT: &str = r#"
$path  = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient'
$vname = 'EnableMulticast'
$keyExists = Test-Path -LiteralPath $path
$valExists = $false; $value = $null
if ($keyExists) {
  $key = Get-Item -LiteralPath $path
  $valExists = $key.GetValueNames() -contains $vname
  if ($valExists) { $value = $key.GetValue($vname, $null, 'DoNotExpandEnvironmentNames') }
}
[PSCustomObject]@{ keyExists = $keyExists; valExists = $valExists; value = $value } | ConvertTo-Json -Compress
"#;

fn llmnr_check() -> Result<Value, String> {
    let state = run_json(LLMNR_STATE_SCRIPT)?;
    let val_exists = state.get("valExists").and_then(Value::as_bool).unwrap_or(false);
    let value = state.get("value").and_then(Value::as_i64).unwrap_or(1);
    let applied = val_exists && value == 0;
    Ok(json!({ "id": "n.llmnr", "applied": applied, "state": state }))
}

fn llmnr_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("n.llmnr", run_json(LLMNR_STATE_SCRIPT)?)?;
    let script = format!(
        r#"{restore}
if (-not (Test-Path -LiteralPath '{LLMNR_PATH}')) {{ New-Item -Path '{LLMNR_PATH}' -Force | Out-Null }}
Set-ItemProperty -LiteralPath '{LLMNR_PATH}' -Name '{LLMNR_VALUE}' -Value 0 -Type DWord -Force
"#,
        restore = restore_point_script("Vortex-Optimizer - Disable LLMNR")
    );
    run_elevated(&script)?;
    Ok(())
}

fn llmnr_revert(snapshot: &Value) -> Result<(), String> {
    let state = snapshot.get("state").cloned().unwrap_or(Value::Null);
    let val_exists = state.get("valExists").and_then(Value::as_bool).unwrap_or(false);
    let value = state.get("value").and_then(Value::as_i64).unwrap_or(1);
    let script = if val_exists {
        format!(
            "if (-not (Test-Path -LiteralPath '{LLMNR_PATH}')) {{ New-Item -Path '{LLMNR_PATH}' -Force | Out-Null }}\n\
             Set-ItemProperty -LiteralPath '{LLMNR_PATH}' -Name '{LLMNR_VALUE}' -Value {value} -Type DWord -Force"
        )
    } else {
        format!("Remove-ItemProperty -LiteralPath '{LLMNR_PATH}' -Name '{LLMNR_VALUE}' -ErrorAction SilentlyContinue")
    };
    run_elevated(&script)?;
    Ok(())
}

// --------------------------------------------------------------- n.dnscache

const DNSCACHE_PATH: &str = r"HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters";

const DNSCACHE_STATE_SCRIPT: &str = r#"
$path = 'HKLM:\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters'
$keyExists = Test-Path -LiteralPath $path
$read = @('MaxCacheTtl','MaxNegativeCacheTtl')
$result = foreach ($vname in $read) {
  $exists = $false; $value = $null
  if ($keyExists) {
    $key = Get-Item -LiteralPath $path
    $exists = $key.GetValueNames() -contains $vname
    if ($exists) { $value = $key.GetValue($vname, $null, 'DoNotExpandEnvironmentNames') }
  }
  [PSCustomObject]@{ name = $vname; exists = $exists; value = $value }
}
@($result) | ConvertTo-Json -Compress -Depth 3
"#;

fn dnscache_check() -> Result<Value, String> {
    let entries = as_array(run_json(DNSCACHE_STATE_SCRIPT)?);
    let max_ttl = entries
        .iter()
        .find(|e| e.get("name").and_then(Value::as_str) == Some("MaxCacheTtl"));
    let neg_ttl = entries
        .iter()
        .find(|e| e.get("name").and_then(Value::as_str) == Some("MaxNegativeCacheTtl"));
    let applied = max_ttl.map_or(false, |e| {
        e.get("exists").and_then(Value::as_bool).unwrap_or(false)
            && e.get("value").and_then(Value::as_i64) == Some(3600)
    }) && neg_ttl.map_or(false, |e| {
        e.get("exists").and_then(Value::as_bool).unwrap_or(false)
            && e.get("value").and_then(Value::as_i64) == Some(0)
    });
    Ok(json!({ "id": "n.dnscache", "applied": applied, "entries": entries }))
}

fn dnscache_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("n.dnscache", run_json(DNSCACHE_STATE_SCRIPT)?)?;
    let script = format!(
        r#"{restore}
if (-not (Test-Path -LiteralPath '{DNSCACHE_PATH}')) {{ New-Item -Path '{DNSCACHE_PATH}' -Force | Out-Null }}
Set-ItemProperty -LiteralPath '{DNSCACHE_PATH}' -Name MaxCacheTtl         -Value 3600 -Type DWord -Force
Set-ItemProperty -LiteralPath '{DNSCACHE_PATH}' -Name MaxNegativeCacheTtl -Value 0    -Type DWord -Force
"#,
        restore = restore_point_script("Vortex-Optimizer - Aggressive DNS caching")
    );
    run_elevated(&script)?;
    Ok(())
}

fn dnscache_revert(snapshot: &Value) -> Result<(), String> {
    let entries = as_array(snapshot.clone());
    let script = format!(
        r#"
$entries = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
$path = '{DNSCACHE_PATH}'
foreach ($e in $entries) {{
  if ($e.exists) {{
    if (-not (Test-Path -LiteralPath $path)) {{ New-Item -Path $path -Force | Out-Null }}
    Set-ItemProperty -LiteralPath $path -Name $e.name -Value ([int]$e.value) -Type DWord -Force
  }} else {{
    Remove-ItemProperty -LiteralPath $path -Name $e.name -ErrorAction SilentlyContinue
  }}
}}
"#,
        payload = encode_json_payload(&Value::Array(entries))
    );
    run_elevated(&script)?;
    Ok(())
}

// ----------------------------------------------------------------- p.compact

const COMPACT_STATE_SCRIPT: &str = r#"
$output = & compact.exe /CompactOS:query 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw $output }
$enabled = $output -match '(?im)is\s+in\s+the\s+compact\s+state'
[PSCustomObject]@{ enabled = [bool]$enabled } | ConvertTo-Json -Compress
"#;

fn compact_set_script(state: &str) -> String {
    format!("& compact.exe /CompactOS:{state}; if ($LASTEXITCODE -ne 0) {{ throw 'compact.exe no pudo cambiar CompactOS.' }}")
}

fn compact_check() -> Result<Value, String> {
    let status = run_json(COMPACT_STATE_SCRIPT)?;
    let applied = status.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    Ok(json!({ "id": "p.compact", "applied": applied, "state": status }))
}

fn compact_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("p.compact", run_json(COMPACT_STATE_SCRIPT)?)?;
    let script = format!(
        "{}\n{}",
        restore_point_script("Vortex-Optimizer - CompactOS compression"),
        compact_set_script("always")
    );
    run_elevated(&script)?;
    Ok(())
}

fn compact_revert(snapshot: &Value) -> Result<(), String> {
    let was_enabled = snapshot.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    let state = if was_enabled { "always" } else { "never" };
    run_elevated(&compact_set_script(state))?;
    Ok(())
}

// -------------------------------------------------------------------- p.trim

const TRIM_STATE_SCRIPT: &str = r#"
$output = & fsutil.exe behavior query DisableDeleteNotify 2>&1 | Out-String
if ($LASTEXITCODE -ne 0) { throw $output }
$m = [regex]::Match($output, '(?im)DisableDeleteNotify\s*=\s*(\d)')
if (-not $m.Success) { throw 'No se pudo leer el estado de TRIM.' }
[PSCustomObject]@{ disabled = [int]$m.Groups[1].Value } | ConvertTo-Json -Compress
"#;

fn trim_set_script(disabled: i64) -> String {
    format!("& fsutil.exe behavior set DisableDeleteNotify {disabled}; if ($LASTEXITCODE -ne 0) {{ throw 'fsutil no pudo cambiar TRIM.' }}")
}

fn trim_check() -> Result<Value, String> {
    let status = run_json(TRIM_STATE_SCRIPT)?;
    let applied = status.get("disabled").and_then(Value::as_i64) == Some(0);
    Ok(json!({ "id": "p.trim", "applied": applied, "state": status }))
}

fn trim_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("p.trim", run_json(TRIM_STATE_SCRIPT)?)?;
    let script = format!(
        "{}\n{}",
        restore_point_script("Vortex-Optimizer - Aggressive SSD TRIM"),
        trim_set_script(0)
    );
    run_elevated(&script)?;
    Ok(())
}

fn trim_revert(snapshot: &Value) -> Result<(), String> {
    let disabled = snapshot.get("disabled").and_then(Value::as_i64).unwrap_or(0);
    run_elevated(&trim_set_script(disabled))?;
    Ok(())
}

// --------------------------------------------------------------- p.onedrive

const ONEDRIVE_RUN_PATH: &str = r"HKCU:\Software\Microsoft\Windows\CurrentVersion\Run";
const ONEDRIVE_RUN_NAME: &str = "OneDrive";

fn onedrive_state_script() -> String {
    format!(
        r#"
$exists=Test-Path -LiteralPath '{ONEDRIVE_RUN_PATH}'
$valueExists=$false; $value=$null
if($exists){{$key=Get-Item -LiteralPath '{ONEDRIVE_RUN_PATH}';if($key.GetValueNames() -contains '{ONEDRIVE_RUN_NAME}'){{$valueExists=$true;$value=$key.GetValue('{ONEDRIVE_RUN_NAME}', $null, 'DoNotExpandEnvironmentNames')}}}}
[PSCustomObject]@{{valueExists=$valueExists;value=$value}}|ConvertTo-Json -Compress
"#
    )
}

fn onedrive_check() -> Result<Value, String> {
    let state = run_json(&onedrive_state_script())?;
    let applied = !state.get("valueExists").and_then(Value::as_bool).unwrap_or(false);
    Ok(json!({ "id": "p.onedrive", "applied": applied, "state": state }))
}

fn onedrive_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("p.onedrive", run_json(&onedrive_state_script())?)?;
    run(&format!(
        "Remove-ItemProperty -LiteralPath '{ONEDRIVE_RUN_PATH}' -Name '{ONEDRIVE_RUN_NAME}' -ErrorAction SilentlyContinue"
    ))?;
    Ok(())
}

fn onedrive_revert(snapshot: &Value) -> Result<(), String> {
    let value_exists = snapshot.get("valueExists").and_then(Value::as_bool).unwrap_or(false);
    if !value_exists {
        return Ok(());
    }
    let value = snapshot.get("value").and_then(Value::as_str).unwrap_or_default();
    let script = format!(
        "if (-not (Test-Path -LiteralPath '{ONEDRIVE_RUN_PATH}')) {{ New-Item -Path '{ONEDRIVE_RUN_PATH}' -Force | Out-Null }}\n\
         Set-ItemProperty -LiteralPath '{ONEDRIVE_RUN_PATH}' -Name '{ONEDRIVE_RUN_NAME}' -Value '{value}' -Type ExpandString -Force"
    );
    run(&script)?;
    Ok(())
}

// ----------------------------------------------------------------- p.timer

const PTIMER_STATE_SCRIPT: &str = TIMER_STATE_SCRIPT;

fn ptimer_check() -> Result<Value, String> {
    let status = run_json(PTIMER_STATE_SCRIPT)?;
    let applied = status.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    Ok(json!({ "id": "p.timer", "applied": applied, "state": status }))
}

fn ptimer_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("p.timer", run_json(PTIMER_STATE_SCRIPT)?)?;
    let script = format!(
        r#"{restore}
& bcdedit.exe /set '{{current}}' useplatformclock true
if ($LASTEXITCODE -ne 0) {{ throw 'bcdedit no pudo fijar useplatformclock.' }}
"#,
        restore = restore_point_script("Vortex-Optimizer - High precision event timer")
    );
    run_elevated(&script)?;
    Ok(())
}

fn ptimer_revert(snapshot: &Value) -> Result<(), String> {
    let was_enabled = snapshot.get("enabled").and_then(Value::as_bool).unwrap_or(false);
    let script = if was_enabled {
        "& bcdedit.exe /set '{current}' useplatformclock true".to_string()
    } else {
        "& bcdedit.exe /deletevalue '{current}' useplatformclock".to_string()
    };
    run_elevated(&format!(
        "{script}\nif ($LASTEXITCODE -ne 0) {{ throw 'bcdedit no pudo revertir useplatformclock.' }}"
    ))?;
    Ok(())
}

// --------------------------------------------------------- p.schedtasks

const CLEANUP_TASKS: [&str; 3] = ["CleanupTask", "SoftwareDistributionTask", "TempTask"];

fn schedtasks_script() -> String {
    let names = CLEANUP_TASKS.iter().map(|n| format!("'{n}'")).collect::<Vec<_>>().join(",");
    format!(
        r#"$names=@({names}); @($names | ForEach-Object {{ $t=Get-ScheduledTask -TaskName $_ -ErrorAction SilentlyContinue; [PSCustomObject]@{{name=$_;exists=$null -ne $t;enabled=if($t){{$t.Settings.Enabled}}else{{$false}}}} }}) | ConvertTo-Json -Compress"#
    )
}

fn schedtasks_check() -> Result<Value, String> {
    let state = as_array(run_json(&schedtasks_script())?);
    let applied = state.iter().all(|t| t.get("exists").and_then(Value::as_bool).unwrap_or(false));
    Ok(json!({ "id": "p.schedtasks", "applied": applied, "tasks": state }))
}

fn schedtasks_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("p.schedtasks", run_json(&schedtasks_script())?)?;
    let script = format!(r#"
{restore}
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -Command "Remove-Item -LiteralPath $env:windir\SoftwareDistribution\Download\* -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $env:TEMP\* -Recurse -Force -ErrorAction SilentlyContinue"'
$trigger = New-ScheduledTaskTrigger -Daily -At 03:00
foreach ($name in @('CleanupTask','SoftwareDistributionTask','TempTask')) {{
  if (-not (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue)) {{ Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -RunLevel Limited -Force | Out-Null }}
}}
"#, restore = restore_point_script("Vortex-Optimizer - Cleanup Scheduled Tasks"));
    run_elevated(&script)?;
    Ok(())
}

fn schedtasks_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(r#"$snapshot=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}'))|ConvertFrom-Json
foreach($entry in @($snapshot)) {{ if(-not $entry.exists) {{ Unregister-ScheduledTask -TaskName $entry.name -Confirm:$false -ErrorAction SilentlyContinue }} }}"#, payload = encode_json_payload(snapshot));
    run_elevated(&script)?;
    Ok(())
}

// --------------------------------------------------------------- s.dohtls

const DOH_STATE_SCRIPT: &str = r#"$adapters=Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up' | ForEach-Object { $a=$_.ifIndex; $dns=(Get-DnsClientServerAddress -InterfaceIndex $a -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses; [PSCustomObject]@{ifIndex=$a;name=$_.Name;dns=@($dns)} }; @($adapters)|ConvertTo-Json -Compress -Depth 4"#;

fn dohtls_check() -> Result<Value, String> {
    let state = run_json(DOH_STATE_SCRIPT)?;
    let applied = as_array(state.clone()).iter().all(|a| a.get("dns").and_then(Value::as_array).map(|d| d.iter().any(|v| v.as_str() == Some("1.1.1.1"))).unwrap_or(false));
    Ok(json!({ "id": "s.dohtls", "applied": applied, "adapters": state }))
}

fn dohtls_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("s.dohtls", run_json(DOH_STATE_SCRIPT)?)?;
    run_elevated(r#"$servers=@('1.1.1.1','1.0.0.1'); Get-NetAdapter -Physical -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up' | ForEach-Object { Set-DnsClientServerAddress -InterfaceIndex $_.ifIndex -ServerAddresses $servers; Set-DnsClientDohServerAddress -ServerAddress '1.1.1.1' -DohTemplate 'https://cloudflare-dns.com/dns-query' -AllowFallbackToUdp $false -AutoUpgrade $true -ErrorAction SilentlyContinue; Set-DnsClientDohServerAddress -ServerAddress '1.0.0.1' -DohTemplate 'https://cloudflare-dns.com/dns-query' -AllowFallbackToUdp $false -AutoUpgrade $true -ErrorAction SilentlyContinue }"#)?;
    Ok(())
}

fn dohtls_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(r#"$snapshot=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}'))|ConvertFrom-Json
foreach($a in @($snapshot)) {{ if(@($a.dns).Count -gt 0) {{ Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses @($a.dns) -ErrorAction SilentlyContinue }} else {{ Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ResetServerAddresses -ErrorAction SilentlyContinue }} }}"#, payload = encode_json_payload(snapshot));
    run_elevated(&script)?;
    Ok(())
}

// ------------------------------------------------------- g.amdtelemetry

const AMD_STATE_SCRIPT: &str = r#"$base='HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; $key=Get-ChildItem $base -ErrorAction SilentlyContinue | Where-Object { (Get-ItemProperty $_.PSPath -Name ProviderName -ErrorAction SilentlyContinue).ProviderName -match 'Advanced Micro Devices' } | Select-Object -First 1; if(-not $key){ throw 'No se detectó un adaptador AMD.' }; $names=@('ReportAnalytics','NotifySubscription','AllowSubscription','ShowReleaseNotes'); @($names|ForEach-Object { $p=Get-ItemProperty $key.PSPath -Name $_ -ErrorAction SilentlyContinue; [PSCustomObject]@{path=$key.PSPath;name=$_;exists=$null -ne $p;value=if($p){$p.$_}else{$null}} })|ConvertTo-Json -Compress"#;

fn amdtelemetry_check() -> Result<Value, String> {
    let state = as_array(run_json(AMD_STATE_SCRIPT)?);
    let applied = !state.is_empty() && state.iter().all(|e| e.get("value").and_then(Value::as_i64) == Some(0));
    Ok(json!({ "id": "g.amdtelemetry", "applied": applied, "targets": state }))
}

fn amdtelemetry_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    let state = run_json(AMD_STATE_SCRIPT)?;
    if as_array(state.clone()).is_empty() { return Err("No se detectó un adaptador AMD compatible.".into()); }
    snapshots.set("g.amdtelemetry", state)?;
    run_elevated(r#"$base='HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}'; $key=Get-ChildItem $base|Where-Object{(Get-ItemProperty $_.PSPath -Name ProviderName -ErrorAction SilentlyContinue).ProviderName -match 'Advanced Micro Devices'}|Select-Object -First 1; foreach($n in @('ReportAnalytics','NotifySubscription','AllowSubscription','ShowReleaseNotes')){New-ItemProperty $key.PSPath -Name $n -PropertyType DWord -Value 0 -Force|Out-Null}"#)?;
    Ok(())
}

fn amdtelemetry_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(r#"$snapshot=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}'))|ConvertFrom-Json; foreach($e in @($snapshot)){{if($e.exists){{Set-ItemProperty -LiteralPath $e.path -Name $e.name -Value ([int]$e.value) -Type DWord -Force}}else{{Remove-ItemProperty -LiteralPath $e.path -Name $e.name -ErrorAction SilentlyContinue}}}}"#, payload=encode_json_payload(snapshot));
    run_elevated(&script)?;
    Ok(())
}

// ---------------------------------------------------------------- g.mpo

const MPO_PATH: &str = r"HKLM:\SOFTWARE\Microsoft\Windows\Dwm";
const MPO_STATE_SCRIPT: &str = r#"$p='HKLM:\SOFTWARE\Microsoft\Windows\Dwm'; $v=Get-ItemProperty -LiteralPath $p -Name OverlayTestMode -ErrorAction SilentlyContinue; [PSCustomObject]@{path=$p;exists=$null -ne $v;value=if($v){$v.OverlayTestMode}else{$null}}|ConvertTo-Json -Compress"#;

fn mpo_check() -> Result<Value, String> {
    let state = run_json(MPO_STATE_SCRIPT)?;
    Ok(json!({ "id": "g.mpo", "applied": state.get("value").and_then(Value::as_i64) == Some(5), "state": state }))
}

fn mpo_apply(snapshots: &SnapshotStore) -> Result<(), String> {
    snapshots.set("g.mpo", run_json(MPO_STATE_SCRIPT)?)?;
    run_elevated(&format!("New-Item -Path '{MPO_PATH}' -Force | Out-Null; New-ItemProperty -LiteralPath '{MPO_PATH}' -Name OverlayTestMode -PropertyType DWord -Value 5 -Force | Out-Null"))?;
    Ok(())
}

fn mpo_revert(snapshot: &Value) -> Result<(), String> {
    let script = format!(r#"$s=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}'))|ConvertFrom-Json; if($s.exists){{Set-ItemProperty -LiteralPath '{MPO_PATH}' -Name OverlayTestMode -Value ([int]$s.value) -Type DWord -Force}}else{{Remove-ItemProperty -LiteralPath '{MPO_PATH}' -Name OverlayTestMode -ErrorAction SilentlyContinue}}"#, payload=encode_json_payload(snapshot));
    run_elevated(&script)?;
    Ok(())
}
