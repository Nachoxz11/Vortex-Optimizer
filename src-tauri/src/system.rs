//! Lectura de información del sistema.
//!
//! Las consultas de hardware/SO viven en `crate::info` (CPU, GPU, RAM, discos, red, Windows) y
//! llegan acá ya resueltas — nada en este archivo dispara PowerShell para esos datos. Lo que todavía
//! no se migró (apps instaladas, inicio automático, System Restore) sigue apoyado en
//! `crate::powershell` hasta la Fase 2 descrita en el plan de arquitectura.

use std::path::{Path, PathBuf};
use std::time::Duration;

use serde_json::Value;

use crate::info::providers::{cpu, disk, gpu, memory, network, process, windows_info};
use crate::powershell::{as_array, cache, run_elevated, run_json};

fn to_value<T: serde::Serialize>(value: T) -> Value {
    serde_json::to_value(value).unwrap_or(Value::Null)
}

/// Normaliza una letra de unidad a la forma `C:`, descartando cualquier otro carácter.
fn normalize_drive(letter: &str) -> String {
    let cleaned: String = letter
        .chars()
        .filter(|c| c.is_ascii_alphabetic() || *c == ':')
        .collect::<String>()
        .to_uppercase();
    let trimmed = cleaned.trim_end_matches(':');
    if trimmed.is_empty() {
        "C:".into()
    } else {
        format!("{}:", &trimmed[..1])
    }
}

fn current_user() -> String {
    std::env::var("USERNAME")
        .or_else(|_| {
            std::env::var("USERPROFILE").map(|path| {
                PathBuf::from(path)
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "Unknown user".into())
            })
        })
        .unwrap_or_else(|_| "Unknown user".into())
}

/// Specs del equipo (CPU, GPU, RAM, disco). Todo estático: cada proveedor lo calcula una sola vez
/// por apertura de la app (ver `StaticCache` en `crate::info::cache`), así que ya no hace falta el
/// TTL de 5s que existía para absorber los pedidos simultáneos de Sidebar/Dashboard/Monitor.
pub fn info() -> Result<Value, String> {
    let sys = crate::info::one_shot_system();

    let win = windows_info::static_info()?;
    let cpu_static = cpu::static_info(&sys)?;
    let gpu_static = gpu::static_info()?;
    let mem = memory::snapshot()?;
    let ram_modules = memory::module_layout().unwrap_or_default();
    let board = crate::info::providers::motherboard::static_info()?;
    let primary_disk = disk::primary_disk()?;
    let volumes = disk::volumes()?;

    let storage_free_gb: u64 = volumes.iter().map(|d| d.total - d.used).sum();
    let storage_total_gb: u64 = volumes.iter().map(|d| d.total).sum();
    let storage_score = if storage_total_gb > 0 {
        (100.0_f64).min((storage_free_gb as f64 / storage_total_gb as f64) * 100.0 + 20.0)
    } else {
        70.0
    };
    let health = (100.0_f64)
        .min((40.0_f64).max((100.0 - mem.used_percent) * 0.3 + storage_score * 0.4 + 30.0))
        .round();

    Ok(serde_json::json!({
        "device": win.device,
        "user": current_user(),
        "userProfile": user_profile().to_string_lossy(),
        "edition": win.edition,
        "version": win.version,
        "build": win.build,
        "install": win.install,
        "cpu": cpu_static.name,
        "cpuDetail": format!("{}C / {}T / {} GHz max", cpu_static.cores, cpu_static.threads, cpu_static.max_ghz),
        "gpu": gpu_static.name,
        "gpuDetail": if gpu_static.has_dedicated_gpu { format!("{} GB VRAM", gpu_static.vram_gb) } else { String::new() },
        "ram": format!("{} GB", mem.total_gb),
        "ramDetail": if ram_modules.is_empty() {
            format!("{} GB", mem.total_gb)
        } else {
            format!("{ram_modules} GB / {} / {} GB in use", mem.used_gb, mem.total_gb)
        },
        "board": board.board,
        "disk": if primary_disk.size_gb > 0 {
            format!("{} {} GB", primary_disk.model, primary_disk.size_gb)
        } else {
            primary_disk.model
        },
        "uptime": windows_info::uptime_label(),
        "health": health,
        "ramUsedGB": mem.used_gb,
        "ramTotalGB": mem.total_gb,
        "storageFreeGB": storage_free_gb,
        "storageTotalGB": storage_total_gb,
    }))
}

/// Métricas en vivo (Dashboard/Monitor, polling cada 1.5s). CPU/RAM/GPU llegan del Background
/// Monitor casi gratis (ya están en cache); disco y red se miden con PDH en el momento porque no
/// forman parte del tier de 1s todavía.
pub fn metrics() -> Result<Value, String> {
    let mem = memory::snapshot()?;
    Ok(serde_json::json!({
        "cpu": cpu::usage_percent()?,
        "ram": mem.used_percent,
        "gpu": gpu::usage_percent().unwrap_or(0.0),
        "disk": disk::busy_percent(),
        "net": network::download_mbps(),
        "ramUsedGB": mem.used_gb,
        "ramTotalGB": mem.total_gb,
    }))
}

/// `net` is always `0`: atribuir tráfico de red a un PID puntual requeriría una sesión ETW/WFP con
/// correlación de conexiones, que necesita privilegios elevados — igual límite que tenía la versión
/// PowerShell. CPU, RAM y disco sí se miden de verdad, ahora vía `sysinfo` en vez de
/// `Get-Counter`/`Get-Process`.
pub fn processes(limit: u32) -> Result<Vec<Value>, String> {
    let list = process::top(limit as usize)?;
    Ok(list.into_iter().map(to_value).collect())
}

/// Lee el primer byte del valor binario de `StartupApproved\<location>` para un nombre dado.
/// `0x02` = habilitado, cualquier otro valor (típicamente `0x03`) = deshabilitado por el usuario o
/// una política. La ausencia del valor cuenta como habilitado (comportamiento por defecto).
// FASE 2: `startup_items`/`set_startup_state` sólo leen/escriben Registro (`Run` keys y el binario
// de `StartupApproved`) — son candidatos directos a `winreg`, igual que `tweaks::registry`. No se
// migraron en esta pasada por no ser un hot path (una sola carga por apertura de la pantalla de
// Inicio), pero el patrón ya está resuelto en `tweaks/registry.rs` para copiarlo acá.
const STARTUP_APPROVED_SCRIPT: &str = r#"
function Get-ApprovedState([string]$hive, [string]$location, [string]$name) {
  $path = "Registry::${hive}\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\$location"
  if (-not (Test-Path $path)) { return $true }
  $bytes = (Get-ItemProperty -Path $path -Name $name -ErrorAction SilentlyContinue).$name
  if (-not $bytes -or $bytes.Length -lt 1) { return $true }
  return ($bytes[0] -eq 2)
}
"#;

pub fn startup_items() -> Result<Vec<Value>, String> {
    let script = format!(
        r#"
$ErrorActionPreference = 'SilentlyContinue'
{STARTUP_APPROVED_SCRIPT}
$items = @()
$idx = 0
$runKeys = @(
  @{{ Hive = 'HKCU'; Path = 'Registry::HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Run'; Type = 'Registry' }},
  @{{ Hive = 'HKLM'; Path = 'Registry::HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Run'; Type = 'Registry' }},
  @{{ Hive = 'HKLM'; Path = 'Registry::HKEY_LOCAL_MACHINE\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Run'; Type = 'Registry' }}
)
foreach ($key in $runKeys) {{
  if (-not (Test-Path $key.Path)) {{ continue }}
  $props = Get-ItemProperty -Path $key.Path
  foreach ($prop in $props.PSObject.Properties) {{
    if ($prop.Name -in @('PSPath','PSParentPath','PSChildName','PSDrive','PSProvider')) {{ continue }}
    $idx++
    $name = $prop.Name
    $cmd = [string]$prop.Value
    $publisher = if ($cmd -match '\\([^\\]+)\\') {{ $matches[1] }} else {{ 'Unknown publisher' }}
    $enabled = Get-ApprovedState $key.Hive 'Run' $name
    $items += @{{
      id = 'st' + $idx
      name = $name
      publisher = $publisher
      impact = 'Medium'
      status = if ($enabled) {{ 'Enabled' }} else {{ 'Disabled' }}
      delay = '—'
      type = $key.Type
      defaultOn = [bool]$enabled
      command = $cmd
      hive = $key.Hive
      location = 'Run'
      approvedName = $name
    }}
  }}
}}
$startupFolder = [Environment]::GetFolderPath('Startup')
if (Test-Path $startupFolder) {{
  Get-ChildItem $startupFolder -File | ForEach-Object {{
    $idx++
    $enabled = Get-ApprovedState 'HKCU' 'StartupFolder' $_.Name
    $items += @{{
      id = 'st' + $idx
      name = $_.BaseName
      publisher = 'Startup folder'
      impact = 'Low'
      status = if ($enabled) {{ 'Enabled' }} else {{ 'Disabled' }}
      delay = '—'
      type = 'Startup folder'
      defaultOn = [bool]$enabled
      command = $_.FullName
      hive = 'HKCU'
      location = 'StartupFolder'
      approvedName = $_.Name
    }}
  }}
}}
@($items) | ConvertTo-Json -Compress
"#
    );
    Ok(as_array(run_json(&script)?))
}

/// Habilita o deshabilita una entrada de inicio escribiendo el valor binario que usa el propio
/// Administrador de tareas de Windows en `StartupApproved\<location>`. La entrada del Registro
/// (o el acceso directo en la carpeta de inicio) nunca se toca, así que la operación es reversible
/// con sólo invertir el flag.
pub fn set_startup_state(
    hive: &str,
    location: &str,
    approved_name: &str,
    enabled: bool,
) -> Result<Value, String> {
    let hive_upper = hive.to_uppercase();
    if hive_upper != "HKCU" && hive_upper != "HKLM" {
        return Err("Hive de Registro no válido.".into());
    }
    if location != "Run" && location != "StartupFolder" {
        return Err("Ubicación de inicio no válida.".into());
    }
    if approved_name.is_empty() {
        return Err("Nombre de entrada de inicio no válido.".into());
    }

    let payload = serde_json::json!({
        "hive": hive_upper,
        "location": location,
        "name": approved_name,
        "flag": if enabled { 2 } else { 3 },
    });
    let script = format!(
        r#"
$p = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('{payload}')) | ConvertFrom-Json
$path = "Registry::$($p.hive)\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\$($p.location)"
if (-not (Test-Path $path)) {{ New-Item -Path $path -Force | Out-Null }}
$bytes = [byte[]](New-Object byte[] 12)
$bytes[0] = [byte]$p.flag
New-ItemProperty -Path $path -Name $p.name -PropertyType Binary -Value $bytes -Force | Out-Null
@{{ ok = $true }} | ConvertTo-Json -Compress
"#,
        payload = crate::powershell::encode_json_payload(&payload)
    );

    if hive_upper == "HKLM" {
        crate::powershell::run_elevated(&script)?;
    } else {
        crate::powershell::run(&script)?;
    }
    Ok(serde_json::json!({ "ok": true }))
}

/// Programas Win32 instalados, leídos directo de las claves `Uninstall` del Registro (sin
/// PowerShell). Además de lo que ya mostraba la UI, se capturan `uninstallString`,
/// `quietUninstallString`, `productCode` (MSI) e `isMsi` — datos que antes se descartaban y que
/// ahora usan `uninstall_app`/`repair_app` para actuar de verdad sobre el programa.
fn win32_apps() -> Vec<Value> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    const ROOTS: [(winreg::HKEY, &str, &str); 3] = [
        (
            HKEY_LOCAL_MACHINE,
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKLM",
        ),
        (
            HKEY_LOCAL_MACHINE,
            r"Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKLM",
        ),
        (
            HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\CurrentVersion\Uninstall",
            "HKCU",
        ),
    ];

    let mut seen = std::collections::HashSet::new();
    let mut apps = Vec::new();
    let mut idx = 0u32;

    for (root, base, hive_name) in ROOTS {
        let Ok(base_key) = RegKey::predef(root).open_subkey(base) else {
            continue;
        };
        for subkey_name in base_key.enum_keys().flatten() {
            let Ok(entry) = base_key.open_subkey(&subkey_name) else {
                continue;
            };
            let display_name: String = match entry.get_value("DisplayName") {
                Ok(v) => v,
                Err(_) => continue,
            };
            let dedup_key = display_name.to_lowercase();
            if !seen.insert(dedup_key) {
                continue;
            }
            idx += 1;

            let publisher: String = entry
                .get_value("Publisher")
                .unwrap_or_else(|_| "Unknown".into());
            let version: String = entry
                .get_value("DisplayVersion")
                .unwrap_or_else(|_| "—".into());
            let estimated_size_kb: u32 = entry.get_value("EstimatedSize").unwrap_or(0);
            let install_date: String = entry.get_value("InstallDate").unwrap_or_default();
            let install_location: String = entry.get_value("InstallLocation").unwrap_or_default();
            let uninstall_string: Option<String> = entry.get_value("UninstallString").ok();
            let quiet_uninstall_string: Option<String> =
                entry.get_value("QuietUninstallString").ok();
            let windows_installer: u32 = entry.get_value("WindowsInstaller").unwrap_or(0);
            let is_msi = windows_installer == 1;
            let product_code =
                (is_msi && subkey_name.starts_with('{')).then(|| subkey_name.clone());

            let installed = if install_date.len() >= 8 {
                format!(
                    "{}-{}-{}",
                    &install_date[0..4],
                    &install_date[4..6],
                    &install_date[6..8]
                )
            } else {
                String::new()
            };

            apps.push(serde_json::json!({
                "id": format!("app{idx}"),
                "name": display_name,
                "publisher": publisher,
                "version": version,
                "size": (estimated_size_kb as f64 / 1_048_576.0 * 100.0).round() / 100.0,
                "installed": installed,
                "source": "Win32",
                "updatable": false,
                "installLocation": install_location,
                "uninstallString": uninstall_string,
                "quietUninstallString": quiet_uninstall_string,
                "isMsi": is_msi,
                "productCode": product_code,
                "hive": hive_name,
                "registryKey": subkey_name,
                "packageFullName": Value::Null,
            }));
        }
    }
    apps
}

/// Apps de la Microsoft Store, vía `Get-AppxPackage` (ver nota de Fase 2: no hay equivalente
/// simple sin WinRT). Se capturan `PackageFullName` para poder desinstalarlas de verdad con
/// `Remove-AppxPackage`.
fn store_apps(start_idx: u32) -> Vec<Value> {
    let script = r#"
$ErrorActionPreference = 'SilentlyContinue'
Get-AppxPackage -ErrorAction SilentlyContinue | ForEach-Object {
  @{
    name = if ($_.DisplayName) { $_.DisplayName } else { $_.Name }
    publisher = if ($_.Publisher) { ($_.Publisher -split ':')[1] } else { 'Microsoft Store' }
    version = $_.Version
    installed = if ($_.InstallDate) { $_.InstallDate.DateTime.ToString('yyyy-MM-dd') } else { '' }
    installLocation = $_.InstallLocation
    packageFullName = $_.PackageFullName
  }
} | ConvertTo-Json -Compress
"#;
    let Ok(raw) = run_json(script) else {
        return Vec::new();
    };
    as_array(raw)
        .into_iter()
        .enumerate()
        .map(|(offset, entry)| {
            serde_json::json!({
                "id": format!("app{}", start_idx + offset as u32 + 1),
                "name": entry.get("name").cloned().unwrap_or(Value::Null),
                "publisher": entry.get("publisher").cloned().unwrap_or(Value::Null),
                "version": entry.get("version").cloned().unwrap_or(Value::Null),
                "size": 0,
                "installed": entry.get("installed").cloned().unwrap_or(Value::Null),
                "source": "Store",
                "updatable": false,
                "installLocation": entry.get("installLocation").cloned().unwrap_or(Value::Null),
                "uninstallString": Value::Null,
                "quietUninstallString": Value::Null,
                "isMsi": false,
                "productCode": Value::Null,
                "hive": Value::Null,
                "registryKey": Value::Null,
                "packageFullName": entry.get("packageFullName").cloned().unwrap_or(Value::Null),
            })
        })
        .collect()
}

pub fn installed_apps() -> Result<Vec<Value>, String> {
    let mut apps = win32_apps();
    let mut store = store_apps(apps.len() as u32);
    apps.append(&mut store);
    apps.sort_by(|a, b| {
        let name_a = a.get("name").and_then(Value::as_str).unwrap_or_default();
        let name_b = b.get("name").and_then(Value::as_str).unwrap_or_default();
        name_a.cmp(name_b)
    });
    Ok(apps)
}

/// Lee la carpeta de instalación de Steam desde el Registro (32 o 64 bits).
fn steam_install_path() -> Option<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    if let Ok(key) = RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"Software\Valve\Steam") {
        if let Ok(path) = key.get_value::<String, _>("SteamPath") {
            return Some(PathBuf::from(path));
        }
    }
    for sub in [r"SOFTWARE\WOW6432Node\Valve\Steam", r"SOFTWARE\Valve\Steam"] {
        if let Ok(key) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(sub) {
            if let Ok(path) = key.get_value::<String, _>("InstallPath") {
                return Some(PathBuf::from(path));
            }
        }
    }
    None
}

/// Extrae `"clave"  "valor"` de un bloque VDF plano (formato de Valve), sin anidar secciones.
fn vdf_value<'a>(text: &'a str, key: &str) -> Option<&'a str> {
    let needle = format!("\"{key}\"");
    let start = text.find(&needle)?;
    let rest = &text[start + needle.len()..];
    let quote_start = rest.find('"')? + 1;
    let quote_end = rest[quote_start..].find('"')? + quote_start;
    Some(&rest[quote_start..quote_end])
}

/// Todas las bibliotecas de Steam (la de instalación más las adicionales de `libraryfolders.vdf`).
fn steam_library_paths(steam_path: &std::path::Path) -> Vec<PathBuf> {
    let mut libraries = vec![steam_path.to_path_buf()];
    let vdf_path = steam_path.join("steamapps").join("libraryfolders.vdf");
    if let Ok(text) = std::fs::read_to_string(&vdf_path) {
        for line in text.lines() {
            let trimmed = line.trim();
            if !trimmed.starts_with("\"path\"") {
                continue;
            }
            if let Some(path) = vdf_value(trimmed, "path") {
                libraries.push(PathBuf::from(path.replace("\\\\", "\\")));
            }
        }
    }
    libraries
}

/// Juegos de Steam instalados, leídos de los `appmanifest_*.acf` de cada biblioteca.
pub fn steam_games() -> Result<Vec<Value>, String> {
    let Some(steam_path) = steam_install_path() else {
        return Ok(Vec::new());
    };

    let mut games = Vec::new();
    for library in steam_library_paths(&steam_path) {
        let apps_dir = library.join("steamapps");
        let entries = match std::fs::read_dir(&apps_dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("acf") {
                continue;
            }
            let Ok(text) = std::fs::read_to_string(&path) else {
                continue;
            };
            let Some(name) = vdf_value(&text, "name") else {
                continue;
            };
            let app_id = vdf_value(&text, "appid").unwrap_or_default();
            let size_on_disk: f64 = vdf_value(&text, "SizeOnDisk")
                .and_then(|s| s.parse::<u64>().ok())
                .map(|bytes| bytes as f64 / 1_073_741_824.0)
                .unwrap_or(0.0);
            games.push(serde_json::json!({
                "appId": app_id,
                "name": name,
                "sizeGB": (size_on_disk * 10.0).round() / 10.0,
            }));
        }
    }
    games.sort_by(|a, b| {
        a.get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .cmp(b.get("name").and_then(Value::as_str).unwrap_or_default())
    });
    Ok(games)
}

pub fn drives() -> Result<Vec<Value>, String> {
    let volumes = disk::volumes()?;
    Ok(volumes.into_iter().map(to_value).collect())
}

pub fn network_adapters() -> Result<Vec<Value>, String> {
    let adapters = network::adapters()?;
    Ok(adapters.into_iter().map(to_value).collect())
}

pub fn network_metrics() -> Result<Value, String> {
    Ok(to_value(network::metrics()?))
}

/// Aplica el proveedor DNS seleccionado al adaptador indicado. `auto` restaura DHCP.
pub fn set_dns_servers(
    adapter: &str,
    primary: &str,
    secondary: Option<&str>,
) -> Result<Value, String> {
    if adapter.trim().is_empty() {
        return Err("No se seleccionó ningún adaptador de red.".into());
    }
    let safe_adapter = adapter.replace('\'', "''");
    let valid_ip = |value: &str| value.parse::<std::net::IpAddr>().is_ok();
    if !valid_ip(primary) || secondary.is_some_and(|value| !valid_ip(value)) {
        return Err("El servidor DNS no es una dirección IP válida.".into());
    }
    let addresses = match secondary {
        Some(value) => format!("'{}','{}'", primary, value),
        None => format!("'{}'", primary),
    };
    let secondary_text = secondary.unwrap_or("");
    let script = format!(
        r#"$ErrorActionPreference='Stop'; Set-DnsClientServerAddress -InterfaceAlias '{safe_adapter}' -ServerAddresses @({addresses}); [pscustomobject]@{{ adapter='{safe_adapter}'; primary='{primary}'; secondary='{secondary_text}' }} | ConvertTo-Json -Compress"#
    );
    run_json(&script)
}

pub fn reset_dns_servers(adapter: &str) -> Result<Value, String> {
    if adapter.trim().is_empty() {
        return Err("No se seleccionó ningún adaptador de red.".into());
    }
    let safe_adapter = adapter.replace('\'', "''");
    let script = format!(
        r#"$ErrorActionPreference='Stop'; Set-DnsClientServerAddress -InterfaceAlias '{safe_adapter}' -ResetServerAddresses; [pscustomobject]@{{ adapter='{safe_adapter}'; dhcp=$true }} | ConvertTo-Json -Compress"#
    );
    run_json(&script)
}

/// Aplica MTU al adaptador y la reserva QoS global de Windows.
pub fn set_network_settings(adapter: &str, mtu: u32, qos_percent: u32) -> Result<Value, String> {
    if adapter.trim().is_empty() {
        return Err("No se seleccionó ningún adaptador de red.".into());
    }
    if !(576..=9000).contains(&mtu) {
        return Err("El MTU debe estar entre 576 y 9000 bytes.".into());
    }
    if qos_percent > 80 {
        return Err("La reserva QoS debe estar entre 0 y 80%.".into());
    }
    let safe_adapter = adapter.replace('\'', "''");
    let script = format!(
        r#"$ErrorActionPreference='Stop'; Set-NetIPInterface -InterfaceAlias '{safe_adapter}' -NlMtuBytes {mtu}; New-Item -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Psched' -Force | Out-Null; New-ItemProperty -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Psched' -Name 'NonBestEffortLimit' -PropertyType DWord -Value {qos_percent} -Force | Out-Null; [pscustomobject]@{{ adapter='{safe_adapter}'; mtu={mtu}; qosPercent={qos_percent}; restartNeeded=$true }} | ConvertTo-Json -Compress"#
    );
    run_json(&script)
}

const BYTES_PER_GB: f64 = 1_073_741_824.0;

fn gb(bytes: u64) -> f64 {
    (bytes as f64 / BYTES_PER_GB * 10.0).round() / 10.0
}

fn user_profile() -> PathBuf {
    std::env::var("USERPROFILE")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(r"C:\Users\Default"))
}

/// Carpetas medidas por `storage_breakdown`, en el mismo orden que el desglose original.
fn storage_folders(root: &str) -> Vec<(&'static str, &'static str, PathBuf)> {
    let root = PathBuf::from(format!(r"{root}\"));
    let user = user_profile();
    vec![
        (
            "games",
            "Games",
            root.join(r"Program Files\Steam\steamapps\common"),
        ),
        ("apps", "Apps and programs", root.join("Program Files")),
        ("system", "System and reserved", root.join("Windows")),
        ("downloads", "Downloads", user.join("Downloads")),
        ("documents", "Documents", user.join("Documents")),
        ("media", "Pictures and video", user.join("Pictures")),
        ("desktop", "Desktop", user.join("Desktop")),
        ("temp", "Temporary", root.join(r"Windows\Temp")),
    ]
}

/// Tamaño de las carpetas grandes de una unidad. Se cachea por unidad: es un recorrido de disco
/// completo (incluye `Windows`, que solo en WinSxS puede tener cientos de miles de archivos), así
/// que no tiene sentido repetirlo cada vez que se vuelve a montar la pantalla de Almacenamiento.
/// Ahora es Rust puro (`crate::fs_walk`, paralelizado con `rayon`) en vez de un script de
/// PowerShell: mismo criterio de "no relanzar el recorrido completo", sin arrancar ningún proceso.
pub fn storage_breakdown(drive: &str) -> Result<Vec<Value>, String> {
    let root = normalize_drive(drive);
    let key = format!("storage_breakdown:{root}");
    let value = cache::get_or_compute(&key, Duration::from_secs(30), || {
        let result: Vec<Value> = storage_folders(&root)
            .into_iter()
            .filter(|(_, _, path)| path.exists())
            .map(|(id, name, path)| {
                let size = gb(crate::fs_walk::measure_size_bytes(&path));
                (id, name, path, size)
            })
            .filter(|(_, _, _, size)| *size > 0.0)
            .map(|(id, name, path, size)| {
                serde_json::json!({
                    "id": id,
                    "name": name,
                    "path": path.to_string_lossy(),
                    "size": size,
                })
            })
            .collect();
        Ok(Value::Array(result))
    })?;
    Ok(as_array(value))
}

/// Archivos grandes de una unidad. Igual que `storage_breakdown`, es un barrido completo de disco
/// (`Users`, `Program Files`, `Program Files (x86)`), así que también se cachea por unidad + umbral.
pub fn large_files(drive: &str, min_size_gb: f64, limit: u32) -> Result<Vec<Value>, String> {
    let root = normalize_drive(drive);
    let key = format!("large_files:{root}:{min_size_gb}:{limit}");
    let value = cache::get_or_compute(&key, Duration::from_secs(30), || {
        let min_bytes = (min_size_gb * BYTES_PER_GB) as u64;
        let roots = ["Users", "Program Files", "Program Files (x86)"]
            .map(|name| PathBuf::from(format!(r"{root}\")).join(name));

        let mut found: Vec<crate::fs_walk::FoundFile> = roots
            .iter()
            .filter(|path| path.exists())
            .flat_map(|path| crate::fs_walk::find_large_files(path, min_bytes))
            .collect();
        found.sort_by_key(|f| std::cmp::Reverse(f.size_bytes));
        found.truncate(limit as usize);

        let result: Vec<Value> = found
            .into_iter()
            .map(|f| {
                let days = f
                    .modified
                    .and_then(|m| m.elapsed().ok())
                    .map(|d| d.as_secs() / 86_400)
                    .unwrap_or(0);
                serde_json::json!({
                    "name": f.path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
                    "size": (f.size_bytes as f64 / BYTES_PER_GB * 100.0).round() / 100.0,
                    "path": f.path.parent().map(|p| p.to_string_lossy().into_owned()).unwrap_or_default(),
                    "days": days,
                })
            })
            .collect();
        Ok(Value::Array(result))
    })?;
    Ok(as_array(value))
}

struct CleanerCategory {
    id: &'static str,
    name: &'static str,
    detail: &'static str,
    paths: Vec<PathBuf>,
    default_on: bool,
    is_recycle_bin: bool,
}

/// Definiciones de categorías compartidas entre `cleaner_scan` y `cleaner_clean`, para que ambas
/// midan y borren exactamente las mismas rutas.
fn cleaner_categories() -> Vec<CleanerCategory> {
    let user = user_profile();
    let local = std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| user.join(r"AppData\Local"));
    let temp = std::env::var("TEMP")
        .map(PathBuf::from)
        .unwrap_or_else(|_| local.join("Temp"));

    vec![
        CleanerCategory {
            id: "c.temp",
            name: "Temporary files",
            detail: "User and system scratch folders",
            paths: vec![temp, PathBuf::from(r"C:\Windows\Temp")],
            default_on: true,
            is_recycle_bin: false,
        },
        CleanerCategory {
            id: "c.logs",
            name: "Logs and dumps",
            detail: "CBS, DISM, crash and setup logs",
            paths: vec![
                PathBuf::from(r"C:\Windows\Logs\CBS"),
                PathBuf::from(r"C:\Windows\Panther"),
            ],
            default_on: true,
            is_recycle_bin: false,
        },
        CleanerCategory {
            id: "c.cache",
            name: "Application cache",
            detail: "Browsers, launchers and Electron apps",
            paths: vec![
                local.join(r"Google\Chrome\User Data\Default\Cache"),
                local.join(r"Google\Chrome\User Data\Default\Code Cache"),
                local.join(r"Microsoft\Edge\User Data\Default\Cache"),
                local.join(r"Discord\Cache"),
            ],
            default_on: true,
            is_recycle_bin: false,
        },
        CleanerCategory {
            id: "c.update",
            name: "Windows Update cache",
            detail: "Downloaded packages already installed",
            paths: vec![PathBuf::from(r"C:\Windows\SoftwareDistribution\Download")],
            default_on: false,
            is_recycle_bin: false,
        },
        CleanerCategory {
            id: "c.bin",
            name: "Recycle Bin",
            detail: "Items in the Recycle Bin",
            paths: vec![],
            default_on: false,
            is_recycle_bin: true,
        },
        CleanerCategory {
            id: "c.thumbs",
            name: "Thumbnails",
            detail: "Explorer preview database",
            paths: vec![local.join(r"Microsoft\Windows\Explorer")],
            default_on: true,
            is_recycle_bin: false,
        },
        CleanerCategory {
            id: "c.delivery",
            name: "Delivery Optimization",
            detail: "Peer-shared update fragments",
            paths: vec![PathBuf::from(
                r"C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization\Cache",
            )],
            default_on: true,
            is_recycle_bin: false,
        },
        CleanerCategory {
            id: "c.prefetch",
            name: "Prefetch data",
            detail: "Application launch traces",
            paths: vec![PathBuf::from(r"C:\Windows\Prefetch")],
            default_on: false,
            is_recycle_bin: false,
        },
    ]
}

pub fn cleaner_scan() -> Result<Vec<Value>, String> {
    let result: Vec<Value> = cleaner_categories()
        .into_iter()
        .map(|cat| {
            let (size_bytes, files) = if cat.is_recycle_bin {
                let info = crate::recycle_bin::query();
                (info.size_bytes.max(0) as u64, info.item_count.max(0) as u64)
            } else {
                cat.paths
                    .iter()
                    .filter(|p| p.exists())
                    .map(|p| crate::fs_walk::measure_size_and_count(p))
                    .fold((0u64, 0u64), |(size, count), (s, c)| (size + s, count + c))
            };
            serde_json::json!({
                "id": cat.id,
                "name": cat.name,
                "detail": cat.detail,
                "size": (size_bytes as f64 / BYTES_PER_GB * 100.0).round() / 100.0,
                "files": files,
                "defaultOn": cat.default_on,
            })
        })
        .collect();
    Ok(result)
}

/// Borra de verdad los archivos de las categorías elegidas. Cada categoría se procesa de forma
/// independiente: un error en una (por ejemplo, un archivo bloqueado) no interrumpe a las demás.
pub fn cleaner_clean(ids: &[String]) -> Result<Value, String> {
    let cleaned: Vec<Value> = cleaner_categories()
        .into_iter()
        .filter(|cat| ids.iter().any(|id| id == cat.id))
        .map(|cat| {
            let (freed_bytes, removed, errors) = if cat.is_recycle_bin {
                match crate::recycle_bin::empty() {
                    Ok((size, count)) => (size.max(0) as u64, count.max(0) as u64, 0u64),
                    Err(_) => (0, 0, 1),
                }
            } else {
                cat.paths
                    .iter()
                    .filter(|p| p.exists())
                    .map(|p| crate::fs_walk::remove_all_files(p))
                    .fold((0u64, 0u64, 0u64), |(freed, removed, errors), stats| {
                        (
                            freed + stats.freed_bytes,
                            removed + stats.removed,
                            errors + stats.errors,
                        )
                    })
            };
            serde_json::json!({
                "id": cat.id,
                "freedGB": (freed_bytes as f64 / BYTES_PER_GB * 100.0).round() / 100.0,
                "filesRemoved": removed,
                "errors": errors,
            })
        })
        .collect();

    let freed_gb: f64 = cleaned
        .iter()
        .filter_map(|c| c.get("freedGB").and_then(Value::as_f64))
        .sum();
    let files_removed: i64 = cleaned
        .iter()
        .filter_map(|c| c.get("filesRemoved").and_then(Value::as_i64))
        .sum();

    Ok(serde_json::json!({
        "cleaned": cleaned,
        "freedGB": (freed_gb * 100.0).round() / 100.0,
        "filesRemoved": files_removed,
    }))
}

/// Borra un único archivo (usado por la pantalla de Almacenamiento para eliminar un archivo grande
/// puntual). Es un borrado permanente, no a la Papelera — mismo criterio que ya usa `cleaner_clean`
/// para el resto de las categorías. El frontend es responsable de confirmar con el usuario antes
/// de llamar a esto; acá sólo se valida que la ruta exista y sea realmente un archivo.
pub fn delete_file(path: &str) -> Result<Value, String> {
    let path = PathBuf::from(path);
    if path.as_os_str().is_empty() {
        return Err("Ruta de archivo no válida.".into());
    }
    let metadata = std::fs::symlink_metadata(&path)
        .map_err(|e| format!("No se pudo acceder a {}: {e}", path.display()))?;
    if !metadata.is_file() {
        return Err(format!("{} no es un archivo.", path.display()));
    }
    let freed_bytes = metadata.len();
    std::fs::remove_file(&path)
        .map_err(|e| format!("No se pudo eliminar {}: {e}", path.display()))?;
    Ok(serde_json::json!({
        "ok": true,
        "freedGB": (freed_bytes as f64 / BYTES_PER_GB * 100.0).round() / 100.0,
    }))
}

/// Termina un proceso por PID (usado por el menú contextual de la lista de procesos en Monitor).
/// Vía `sysinfo`, igual mecanismo que ya usa `quick_actions::restart_explorer` para matar
/// `explorer.exe` — sin PowerShell ni `taskkill.exe`.
pub fn kill_process(pid: u32) -> Result<Value, String> {
    use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System};

    let target = Pid::from_u32(pid);
    let mut sys = System::new();
    sys.refresh_processes_specifics(
        ProcessesToUpdate::Some(&[target]),
        true,
        ProcessRefreshKind::everything(),
    );

    let process = sys
        .process(target)
        .ok_or_else(|| format!("El proceso con PID {pid} ya no existe."))?;
    let name = process.name().to_string_lossy().into_owned();

    if !process.kill() {
        return Err(format!("No se pudo terminar {name} (PID {pid})."));
    }
    Ok(serde_json::json!({ "ok": true, "pid": pid, "name": name }))
}

/// Cambia la clase de prioridad de un proceso (menú contextual "Establecer prioridad" en Monitor).
/// Vía `SetPriorityClass` directo — mismo mecanismo que usa el Administrador de tareas.
pub fn set_process_priority(pid: u32, priority: &str) -> Result<Value, String> {
    use windows::Win32::System::Threading::{
        OpenProcess, SetPriorityClass, ABOVE_NORMAL_PRIORITY_CLASS, BELOW_NORMAL_PRIORITY_CLASS,
        HIGH_PRIORITY_CLASS, IDLE_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS, PROCESS_ACCESS_RIGHTS,
        PROCESS_QUERY_INFORMATION, PROCESS_SET_INFORMATION, REALTIME_PRIORITY_CLASS,
    };

    let class = match priority {
        "realtime" => REALTIME_PRIORITY_CLASS,
        "high" => HIGH_PRIORITY_CLASS,
        "above_normal" => ABOVE_NORMAL_PRIORITY_CLASS,
        "normal" => NORMAL_PRIORITY_CLASS,
        "below_normal" => BELOW_NORMAL_PRIORITY_CLASS,
        "idle" => IDLE_PRIORITY_CLASS,
        other => return Err(format!("Prioridad desconocida: {other}")),
    };

    unsafe {
        let access: PROCESS_ACCESS_RIGHTS = PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION;
        let handle = OpenProcess(access, false, pid)
            .map_err(|e| format!("No se pudo abrir el proceso {pid}: {e}"))?;
        let result = SetPriorityClass(handle, class);
        let _ = windows::Win32::Foundation::CloseHandle(handle);
        result.map_err(|e| {
            format!("No se pudo cambiar la prioridad (¿requiere ejecutar como administrador?): {e}")
        })?;
    }

    Ok(serde_json::json!({ "ok": true, "pid": pid, "priority": priority }))
}

/// Fija la afinidad de CPU de un proceso a los núcleos lógicos indicados (índices base 0).
pub fn set_process_affinity(pid: u32, cores: &[u32]) -> Result<Value, String> {
    use windows::Win32::System::Threading::{
        OpenProcess, SetProcessAffinityMask, PROCESS_ACCESS_RIGHTS, PROCESS_QUERY_INFORMATION,
        PROCESS_SET_INFORMATION,
    };

    if cores.is_empty() {
        return Err("Seleccioná al menos un núcleo.".into());
    }
    let mut mask: usize = 0;
    for &core in cores {
        if core >= usize::BITS {
            return Err(format!("Índice de núcleo fuera de rango: {core}"));
        }
        mask |= 1usize << core;
    }

    unsafe {
        let access: PROCESS_ACCESS_RIGHTS = PROCESS_SET_INFORMATION | PROCESS_QUERY_INFORMATION;
        let handle = OpenProcess(access, false, pid)
            .map_err(|e| format!("No se pudo abrir el proceso {pid}: {e}"))?;
        let result = SetProcessAffinityMask(handle, mask);
        let _ = windows::Win32::Foundation::CloseHandle(handle);
        result.map_err(|e| {
            format!("No se pudo cambiar la afinidad (¿requiere ejecutar como administrador?): {e}")
        })?;
    }

    Ok(serde_json::json!({ "ok": true, "pid": pid, "cores": cores }))
}

/// Abre Explorer con el archivo o carpeta seleccionado/a. Usa `explorer /select,<path>` cuando la
/// ruta apunta a un archivo, o `explorer <path>` para una carpeta — igual que el menú contextual
/// del propio explorador.
pub fn open_file_location(path: &str) -> Result<Value, String> {
    let p = std::path::Path::new(path);
    let args: Vec<std::ffi::OsString> = if p.is_file() {
        vec!["/select,".into(), p.as_os_str().into()]
    } else {
        vec![p.as_os_str().into()]
    };
    std::process::Command::new("explorer.exe")
        .args(&args)
        .spawn()
        .map_err(|e| format!("No se pudo abrir la ubicación: {e}"))?;
    Ok(serde_json::json!({ "ok": true }))
}

/// Mide la latencia de un conjunto fijo de resolvedores DNS enviando una consulta UDP real a
/// `one.one.one.one` (1.1.1.1) desde cada servidor. Sin dependencias externas — sólo sockets
/// UDP estándar de la std. Cada sonda tiene un timeout de 2 s.
pub fn dns_benchmark() -> Result<Value, String> {
    use std::time::Duration;

    // Consulta DNS mínima: `one.one.one.one` (QTYPE=A, QCLASS=IN)
    const QUERY: &[u8] = &[
        0x00, 0x01, // ID
        0x01, 0x00, // Flags: RD
        0x00, 0x01, // QDCOUNT
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // one.one.one.one
        0x03, b'o', b'n', b'e', 0x03, b'o', b'n', b'e', 0x03, b'o', b'n', b'e', 0x03, b'o', b'n',
        b'e', 0x00, 0x00, 0x01, // QTYPE A
        0x00, 0x01, // QCLASS IN
    ];

    let servers: &[(&str, &str)] = &[
        ("Cloudflare", "1.1.1.1:53"),
        ("Google", "8.8.8.8:53"),
        ("Quad9", "9.9.9.9:53"),
        ("OpenDNS", "208.67.222.222:53"),
        ("Comodo", "8.26.56.26:53"),
    ];

    let results: Vec<Value> = servers
        .iter()
        .map(|(name, addr)| {
            let latency_ms = probe_dns(QUERY, addr, Duration::from_secs(2));
            serde_json::json!({ "name": name, "server": addr, "latencyMs": latency_ms })
        })
        .collect();

    Ok(serde_json::json!({ "results": results }))
}

fn probe_dns(query: &[u8], addr: &str, timeout: std::time::Duration) -> Option<f64> {
    use std::net::{SocketAddr, UdpSocket};
    use std::str::FromStr;
    use std::time::Instant;

    let target: SocketAddr = SocketAddr::from_str(addr).ok()?;
    let bind: SocketAddr = "0.0.0.0:0".parse().ok()?;
    let socket = UdpSocket::bind(bind).ok()?;
    socket.set_read_timeout(Some(timeout)).ok()?;
    let t0 = Instant::now();
    socket.send_to(query, target).ok()?;
    let mut buf = [0u8; 512];
    socket.recv_from(&mut buf).ok()?;
    Some((t0.elapsed().as_secs_f64() * 1000.0 * 10.0).round() / 10.0)
}

/// Elimina una entrada de inicio del Registro (Run key). Sólo borra el valor de aprobación y el
/// valor `Run` — la ubicación de la carpeta de inicio se elimina con el archivo de acceso directo,
/// que tiene otra ruta y no se toca acá.
pub fn startup_remove_entry(
    hive: &str,
    location: &str,
    name: &str,
    command: Option<&str>,
) -> Result<Value, String> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_SET_VALUE};
    use winreg::RegKey;

    let hive_upper = hive.to_uppercase();
    let root = match hive_upper.as_str() {
        "HKCU" => RegKey::predef(HKEY_CURRENT_USER),
        "HKLM" => RegKey::predef(HKEY_LOCAL_MACHINE),
        _ => return Err("Hive de Registro no válido.".into()),
    };

    // 1. Eliminar el valor de StartupApproved (flag de habilitación)
    let approved_path = format!(
        r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\{}",
        location
    );
    if let Ok(key) = root.open_subkey_with_flags(&approved_path, KEY_SET_VALUE) {
        let _ = key.delete_value(name);
    }

    // 2. Eliminar el valor de la clave Run si es una entrada Run
    if location == "Run" {
        let run_path = r"Software\Microsoft\Windows\CurrentVersion\Run";
        // Preferir la ruta de Registro real si viene del frontend, o el nombre como fallback
        let value_name = command.unwrap_or(name);
        let _ = value_name; // El nombre del valor en Run = `name` (campo approvedName)
        if let Ok(key) = root.open_subkey_with_flags(run_path, KEY_SET_VALUE) {
            let _ = key.delete_value(name);
        }
    }

    Ok(serde_json::json!({ "ok": true }))
}

// -------------------------------------------------------------- installed apps

/// Identifica cómo desinstalar/reparar una app, con los datos que ya devuelve `installed_apps`.
/// El frontend nos pasa de vuelta el objeto tal cual lo recibió — evita una segunda vuelta al
/// Registro sólo para reconfirmar lo que ya se leyó.
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUninstallInfo {
    #[serde(default)]
    pub is_msi: bool,
    #[serde(default)]
    pub product_code: Option<String>,
    #[serde(default)]
    pub uninstall_string: Option<String>,
    #[serde(default)]
    pub quiet_uninstall_string: Option<String>,
    #[serde(default)]
    pub package_full_name: Option<String>,
}

/// Desinstala de verdad. Apps de la Store van por `Remove-AppxPackage` (no hay equivalente sin
/// PowerShell); MSI van por `msiexec /x {productCode}` (sin `/qn`, así el usuario ve y puede
/// cancelar el asistente nativo); el resto usa el `UninstallString` tal cual lo guardó el propio
/// instalador, ejecutado vía `cmd.exe /c` para que se resuelva el quoting igual que lo hace el
/// Panel de control.
pub fn uninstall_app(app: &AppUninstallInfo) -> Result<Value, String> {
    if let Some(package) = &app.package_full_name {
        let script = format!(
            "Remove-AppxPackage -Package '{}' -ErrorAction Stop",
            crate::powershell::escape_single_quotes(package)
        );
        run_elevated(&script)?;
        return Ok(serde_json::json!({ "ok": true }));
    }

    if app.is_msi {
        let code = app
            .product_code
            .as_deref()
            .ok_or("Falta el código de producto MSI para desinstalar.")?;
        crate::powershell::run_elevated_exe("msiexec.exe", &["/x".to_string(), code.to_string()])?;
        return Ok(serde_json::json!({ "ok": true }));
    }

    let command = app
        .quiet_uninstall_string
        .clone()
        .or_else(|| app.uninstall_string.clone())
        .ok_or("Esta aplicación no tiene un desinstalador registrado en el sistema.")?;
    crate::powershell::run_elevated_exe("cmd.exe", &["/c".to_string(), command])?;
    Ok(serde_json::json!({ "ok": true }))
}

/// Repara de verdad, sólo disponible para instalaciones MSI (`msiexec /fa` reinstala todos los
/// archivos/registro/atajos desde la caché local del paquete). Las apps Win32 sin MSI no tienen un
/// verbo de "reparar" genérico en Windows — se informa así en vez de simular un resultado.
pub fn repair_app(app: &AppUninstallInfo) -> Result<Value, String> {
    if !app.is_msi {
        return Err(
            "Reparar sólo está disponible para aplicaciones instaladas con Windows Installer (MSI)."
                .into(),
        );
    }
    let code = app
        .product_code
        .as_deref()
        .ok_or("Falta el código de producto MSI para reparar.")?;
    crate::powershell::run_elevated_exe("msiexec.exe", &["/fa".to_string(), code.to_string()])?;
    Ok(serde_json::json!({ "ok": true }))
}

/// Vacía las carpetas de caché de shaders de DirectX y de los tres fabricantes de GPU más comunes.
/// Windows y los drivers las regeneran solos la próxima vez que cada juego compila sus shaders, así
/// que es una operación segura — el mismo criterio que ya usa `cleaner_clean` para otras cachés,
/// reutilizando el walker de `crate::fs_walk`.
pub fn rebuild_shader_cache() -> Result<Value, String> {
    let local =
        std::env::var("LOCALAPPDATA").map_err(|_| "No se encontró %LOCALAPPDATA%.".to_string())?;
    let local = PathBuf::from(local);
    let dirs = [
        local.join("D3DSCache"),
        local.join(r"NVIDIA\DXCache"),
        local.join(r"NVIDIA\GLCache"),
        local.join(r"AMD\DxCache"),
        local.join(r"AMD\DxcCache"),
        local.join(r"Intel\ShaderCache"),
    ];

    let stats = dirs
        .iter()
        .filter(|p| p.exists())
        .map(|p| crate::fs_walk::remove_all_files(p))
        .fold(crate::fs_walk::RemovalStats::default(), |acc, s| {
            crate::fs_walk::RemovalStats {
                freed_bytes: acc.freed_bytes + s.freed_bytes,
                removed: acc.removed + s.removed,
                errors: acc.errors + s.errors,
            }
        });

    Ok(serde_json::json!({
        "ok": true,
        "filesRemoved": stats.removed,
        "freedGB": (stats.freed_bytes as f64 / BYTES_PER_GB * 100.0).round() / 100.0,
        "errors": stats.errors,
    }))
}

/// Ejecuta la limpieza profunda oficial de Windows. Es intencionalmente separada de la
/// limpieza reversible: DISM elimina componentes reemplazados y Windows no ofrece rollback.
fn optional_feature_name(id: &str) -> Option<&'static str> {
    match id {
        "f.wsl" => Some("Microsoft-Windows-Subsystem-Linux"),
        "f.hyperv" => Some("Microsoft-Hyper-V-All"),
        "f.sandbox" => Some("Containers-DisposableClientVM"),
        "f.vmp" => Some("VirtualMachinePlatform"),
        "f.net35" => Some("NetFx3"),
        "f.net48" => Some("NetFx4-AdvSrvs"),
        "f.smb1" => Some("SMB1Protocol"),
        "f.smbdirect" => Some("SMBDirect"),
        "f.telnet" => Some("TelnetClient"),
        "f.tftp" => Some("TFTP"),
        "f.wcf" => Some("WCF-Services45"),
        "f.printvirt" => Some("Printing-Foundation-InternetPrinting-Client"),
        "f.mediafeat" => Some("MediaPlayback"),
        _ => None,
    }
}

/// Lee el estado real de las características opcionales mediante DISM/PowerShell.
/// Se devuelve el identificador estable de la UI junto con el nombre interno de Windows.
pub fn optional_features() -> Result<Value, String> {
    let names = [
        "Microsoft-Windows-Subsystem-Linux",
        "Microsoft-Hyper-V-All",
        "Containers-DisposableClientVM",
        "VirtualMachinePlatform",
        "NetFx3",
        "NetFx4-AdvSrvs",
        "SMB1Protocol",
        "SMBDirect",
        "TelnetClient",
        "TFTP",
        "WCF-Services45",
        "Printing-Foundation-InternetPrinting-Client",
        "MediaPlayback",
    ];
    let list = names
        .iter()
        .map(|name| format!("'{}'", name))
        .collect::<Vec<_>>()
        .join(",");
    let script = format!(
        r#"$names=@({list}); Get-WindowsOptionalFeature -Online | Where-Object {{ $names -contains $_.FeatureName }} | Select-Object FeatureName,State | ConvertTo-Json -Compress"#
    );
    let value = run_json(&script)?;
    let items = match value {
        Value::Array(items) => items,
        Value::Object(item) => vec![Value::Object(item)],
        _ => Vec::new(),
    };
    let states = items
        .into_iter()
        .filter_map(|item| {
            let name = item.get("FeatureName")?.as_str()?;
            let state = item.get("State")?.as_str()?;
            Some(serde_json::json!({ "featureName": name, "state": state }))
        })
        .collect::<Vec<_>>();
    Ok(Value::Array(states))
}

/// Activa o desactiva una característica opcional sin reiniciar automáticamente.
/// Windows devuelve `RestartNeeded`, que la UI usa para informar al usuario.
pub fn optional_feature_change(id: &str, enabled: bool) -> Result<Value, String> {
    let feature =
        optional_feature_name(id).ok_or_else(|| format!("Característica desconocida: {id}"))?;
    let command = if enabled {
        "Enable-WindowsOptionalFeature"
    } else {
        "Disable-WindowsOptionalFeature"
    };
    let script = format!(
        r#"$result = {command} -Online -FeatureName '{feature}' -NoRestart -ErrorAction Stop; [pscustomobject]@{{ featureName='{feature}'; enabled={enabled}; restartNeeded=[bool]$result.RestartNeeded }} | ConvertTo-Json -Compress"#
    );
    run_json(&script)
}

/// Busca archivos duplicados en carpetas comunes del usuario. Es de solo lectura.
pub fn duplicate_candidates(max_groups: usize) -> Result<Value, String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    use std::io::Read;

    let profile = user_profile();
    let roots = [
        profile.join("Desktop"),
        profile.join("Documents"),
        profile.join("Downloads"),
        profile.join("Pictures"),
    ];
    let mut files: Vec<(PathBuf, u64)> = Vec::new();
    fn collect_files(root: &Path, files: &mut Vec<(PathBuf, u64)>) {
        let Ok(entries) = std::fs::read_dir(root) else {
            return;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                collect_files(&path, files);
            } else if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() && metadata.len() >= 1_048_576 {
                    files.push((path, metadata.len()));
                }
            }
        }
    }
    for root in roots.iter().filter(|root| root.exists()) {
        collect_files(root, &mut files);
    }

    let scanned_files = files.len();
    let mut by_size: std::collections::HashMap<u64, Vec<PathBuf>> =
        std::collections::HashMap::new();
    for (path, size) in files {
        by_size.entry(size).or_default().push(path);
    }
    let mut groups = Vec::new();
    for (size, paths) in by_size.into_iter().filter(|(_, paths)| paths.len() > 1) {
        let mut hashes: std::collections::HashMap<u64, Vec<String>> =
            std::collections::HashMap::new();
        for path in paths {
            let Ok(mut file) = std::fs::File::open(&path) else {
                continue;
            };
            let mut hasher = DefaultHasher::new();
            let mut buffer = [0u8; 64 * 1024];
            let mut ok = true;
            loop {
                match file.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(count) => buffer[..count].hash(&mut hasher),
                    Err(_) => {
                        ok = false;
                        break;
                    }
                }
            }
            if ok {
                hashes
                    .entry(hasher.finish())
                    .or_default()
                    .push(path.to_string_lossy().into_owned());
            }
        }
        for (hash, paths) in hashes.into_iter().filter(|(_, paths)| paths.len() > 1) {
            groups.push(serde_json::json!({ "sizeBytes": size, "hash": format!("{hash:x}"), "files": paths }));
            if groups.len() >= max_groups {
                break;
            }
        }
        if groups.len() >= max_groups {
            break;
        }
    }
    Ok(serde_json::json!({ "groups": groups, "scannedFiles": scanned_files }))
}

pub fn deep_clean(mode: &str) -> Result<Value, String> {
    match mode {
        "component_store" => {
            crate::powershell::run_elevated_exe(
                "dism.exe",
                &[
                    "/Online".into(),
                    "/Cleanup-Image".into(),
                    "/StartComponentCleanup".into(),
                ],
            )?;
            Ok(serde_json::json!({ "ok": true, "mode": mode, "reversible": false }))
        }
        "upgrade_leftovers" => {
            crate::powershell::run_elevated_exe("cleanmgr.exe", &["/autoclean".into()])?;
            Ok(serde_json::json!({ "ok": true, "mode": mode, "reversible": false }))
        }
        _ => Err("Modo de limpieza profunda no permitido.".into()),
    }
}

/// Detecta dispositivos PCI con la propiedad MSI expuesta por Windows. Sólo lee: la aplicación
/// no modifica claves de dispositivos directamente, porque su formato depende del driver.
pub fn msi_devices() -> Result<Value, String> {
    let script = r#"
$rows = @(Get-PnpDevice -PresentOnly -ErrorAction Stop | Where-Object { $_.InstanceId -like 'PCI\*' } | ForEach-Object {
  $key = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($_.InstanceId)\Device Parameters\Interrupt Management\MessageSignaledInterruptProperties"
  $p = Get-ItemProperty -LiteralPath $key -Name MSISupported -ErrorAction SilentlyContinue
  [PSCustomObject]@{ name=$_.FriendlyName; instanceId=$_.InstanceId; status=$_.Status; msiSupported=if($null -eq $p){$null}else{[int]$p.MSISupported}; registryPath=$key }
})
@($rows) | ConvertTo-Json -Compress -Depth 4
"#;
    let rows = crate::powershell::run_json(script)?;
    Ok(
        serde_json::json!({ "devices": if rows.is_array() { rows } else { serde_json::json!([rows]) } }),
    )
}

// ------------------------------------------------------------------- restore
//
// FASE 2: la clase WMI `SystemRestore` (namespace `ROOT\default`) expone `Enable`, un método
// `Restore(SequenceNumber)` y permite enumerar puntos existentes — migraría `restore_list`
// completo y `restore_apply` a `wmi` (misma conexión persistente por hilo de `crate::info::wmi_conn`,
// aunque con un `with_connection_at` a `ROOT\default`). `restore_create` seguiría necesitando
// `Checkpoint-Computer`de PowerShell (no hay equivalente WMI directo documentado para crear un
// punto con el mismo nivel de integración que usa el propio Panel de Control). No se migró en esta
// pasada por ser una acción manual del usuario, no un hot path.

pub fn restore_list() -> Result<Vec<Value>, String> {
    Ok(as_array(run_json(
        r#"
$ErrorActionPreference = 'SilentlyContinue'
$points = @(Get-ComputerRestorePoint -ErrorAction SilentlyContinue)
$result = foreach ($p in ($points | Sort-Object SequenceNumber -Descending)) {
  $created = [Management.ManagementDateTimeConverter]::ToDateTime($p.CreationTime)
  @{
    sequenceNumber = $p.SequenceNumber
    description = $p.Description
    creationTime = $created.ToString('o')
    type = $p.RestorePointType
  }
}
@($result) | ConvertTo-Json -Compress
"#,
    )?))
}

pub fn restore_create(description: &str) -> Result<Value, String> {
    let escaped = crate::powershell::escape_single_quotes(description);
    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
Enable-ComputerRestore -Drive "$($env:SystemDrive)\" -ErrorAction SilentlyContinue
Checkpoint-Computer -Description '{escaped}' -RestorePointType 'MODIFY_SETTINGS'
@{{ ok = $true }} | ConvertTo-Json -Compress
"#
    );
    run_elevated(&script)?;
    Ok(serde_json::json!({ "ok": true }))
}

pub fn restore_apply(sequence_number: i64) -> Result<Value, String> {
    if sequence_number <= 0 {
        return Err("Número de secuencia de restauración no válido.".into());
    }
    let script = format!(
        r#"
$ErrorActionPreference = 'Stop'
Restore-Computer -RestorePoint {sequence_number} -Confirm:$false
"#
    );
    run_elevated(&script)?;
    Ok(serde_json::json!({ "ok": true }))
}

// ------------------------------------------------------ timer resolution

#[cfg(windows)]
#[link(name = "ntdll")]
extern "system" {
    fn NtQueryTimerResolution(
        minimum_resolution: *mut u32,
        maximum_resolution: *mut u32,
        current_resolution: *mut u32,
    ) -> i32;
    fn NtSetTimerResolution(
        desired_resolution: u32,
        set_resolution: u8,
        actual_resolution: *mut u32,
    ) -> i32;
}

#[cfg(windows)]
fn timer_resolution_query() -> Result<(u32, u32, u32), String> {
    let mut minimum = 0;
    let mut maximum = 0;
    let mut current = 0;
    let status = unsafe { NtQueryTimerResolution(&mut minimum, &mut maximum, &mut current) };
    if status < 0 {
        return Err(format!(
            "No se pudo consultar la resolución del temporizador (NTSTATUS 0x{status:08X})."
        ));
    }
    Ok((minimum, maximum, current))
}

#[cfg(windows)]
fn timer_units_to_ms(units: u32) -> f64 {
    units as f64 / 10_000.0
}

#[cfg(windows)]
pub fn timer_resolution_get() -> Result<Value, String> {
    let (minimum, maximum, current) = timer_resolution_query()?;
    Ok(serde_json::json!({
        "minimumMs": timer_units_to_ms(minimum),
        "maximumMs": timer_units_to_ms(maximum),
        "currentMs": timer_units_to_ms(current),
        "enabled": current <= 5_000,
    }))
}

#[cfg(windows)]
pub fn timer_resolution_set(enabled: bool) -> Result<Value, String> {
    // 5,000 units = 0.5 ms. Windows may report a nearby achievable value,
    // so the UI displays the value returned by the kernel instead of guessing.
    let target = 5_000;
    let mut actual = 0;
    let status = unsafe { NtSetTimerResolution(target, u8::from(enabled), &mut actual) };
    if status < 0 {
        return Err(format!(
            "No se pudo cambiar la resolución del temporizador (NTSTATUS 0x{status:08X})."
        ));
    }
    let (_, _, current) = timer_resolution_query()?;
    Ok(serde_json::json!({
        "minimumMs": timer_units_to_ms(target),
        "currentMs": timer_units_to_ms(current),
        "enabled": enabled,
    }))
}

#[cfg(not(windows))]
pub fn timer_resolution_get() -> Result<Value, String> {
    Err("La resolución del temporizador solo está disponible en Windows.".into())
}

#[cfg(not(windows))]
pub fn timer_resolution_set(_enabled: bool) -> Result<Value, String> {
    Err("La resolución del temporizador solo está disponible en Windows.".into())
}

// ----------------------------------------------------- start with Windows

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const RUN_VALUE_NAME: &str = "Vortex-Optimizer";
const STARTUP_TASK_NAME: &str = "Vortex-Optimizer";

fn startup_task_exists() -> bool {
    std::process::Command::new("schtasks.exe")
        .args(["/Query", "/TN", STARTUP_TASK_NAME])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn startup_task_set(enabled: bool) -> Result<(), String> {
    if enabled {
        let exe = std::env::current_exe()
            .map_err(|e| format!("No se pudo determinar la ruta del ejecutable: {e}"))?;
        let task_command = format!("\"{}\"", exe.to_string_lossy());
        let output = std::process::Command::new("schtasks.exe")
            .args([
                "/Create",
                "/TN",
                STARTUP_TASK_NAME,
                "/SC",
                "ONLOGON",
                "/TR",
                &task_command,
                "/RL",
                "HIGHEST",
                "/F",
            ])
            .output()
            .map_err(|e| format!("No se pudo crear la tarea de inicio automático: {e}"))?;
        if !output.status.success() {
            return Err(format!(
                "No se pudo crear la tarea de inicio automático: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    } else {
        let output = std::process::Command::new("schtasks.exe")
            .args(["/Delete", "/TN", STARTUP_TASK_NAME, "/F"])
            .output()
            .map_err(|e| format!("No se pudo quitar la tarea de inicio automático: {e}"))?;
        if !output.status.success() && startup_task_exists() {
            return Err(format!(
                "No se pudo quitar la tarea de inicio automático: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            ));
        }
    }
    Ok(())
}

pub fn start_with_windows_get() -> Result<Value, String> {
    Ok(serde_json::json!({ "enabled": startup_task_exists() }))
}

pub fn start_with_windows_set(enabled: bool) -> Result<Value, String> {
    startup_task_set(enabled)?;

    // Limpia la entrada antigua para evitar dos lanzamientos al iniciar sesión.
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey_with_flags(RUN_KEY, winreg::enums::KEY_SET_VALUE) {
        let _ = key.delete_value(RUN_VALUE_NAME);
    }
    Ok(serde_json::json!({ "ok": true }))
}

// --------------------------------------------------------------- speed test

const SPEED_TEST_UPLOAD_BYTES: usize = 6_000_000;
/// Sent on every request — some CDNs/proxies quietly reject or throttle UA-less clients.
const SPEED_TEST_USER_AGENT: &str =
    "Vortex-Optimizer/1.0 (+https://github.com/Nachoxz11/Vortex-Optimizer)";

struct SpeedTestProvider {
    id: &'static str,
    latency_url: &'static str,
    download_url: &'static str,
    /// `None` when the provider has no public write endpoint to benchmark upload against.
    upload_url: Option<&'static str>,
}

fn provider_config(provider: &str) -> SpeedTestProvider {
    match provider {
        "google" => SpeedTestProvider {
            id: "google",
            latency_url: "https://www.google.com/generate_204",
            // Go's official Windows installer, hosted on Google's own CDN (dl.google.com) —
            // large, stable and publicly reachable without auth, but write-only endpoints
            // aren't published, so upload isn't measurable for this provider.
            download_url: "https://dl.google.com/go/go1.23.4.windows-amd64.msi",
            upload_url: None,
        },
        _ => SpeedTestProvider {
            id: "cloudflare",
            latency_url: "https://speed.cloudflare.com/__down?bytes=0",
            download_url: "https://speed.cloudflare.com/__down?bytes=25000000",
            upload_url: Some("https://speed.cloudflare.com/__up"),
        },
    }
}

/// Benchmark real de descarga/subida/latencia contra un proveedor público (`cloudflare` o
/// `google`). El tiempo se mide desde justo antes de enviar el request hasta que el cuerpo
/// termina de leerse, así conexión + TTFB + transferencia cuentan igual en las tres métricas.
pub fn speed_test(provider: &str) -> Result<Value, String> {
    let cfg = provider_config(provider);

    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(25))
        .user_agent(SPEED_TEST_USER_AGENT)
        .build()
        .map_err(|e| format!("No se pudo crear el cliente HTTP: {e}"))?;

    let mut latency_ms = 0.0_f64;
    let mut jitter_ms = 0.0_f64;
    let mut error: Option<String> = None;

    let mut samples = Vec::new();
    for _ in 0..4 {
        let start = std::time::Instant::now();
        match client.get(cfg.latency_url).send() {
            Ok(_) => samples.push(start.elapsed().as_secs_f64() * 1000.0),
            Err(e) => error = Some(e.to_string()),
        }
    }
    if !samples.is_empty() {
        latency_ms = round1(samples.iter().sum::<f64>() / samples.len() as f64);
        if samples.len() > 1 {
            jitter_ms = round1(
                samples.iter().cloned().fold(f64::MIN, f64::max)
                    - samples.iter().cloned().fold(f64::MAX, f64::min),
            );
        }
    }

    let download_start = std::time::Instant::now();
    let download_mbps = match client.get(cfg.download_url).send().and_then(|r| r.bytes()) {
        Ok(bytes) if !bytes.is_empty() => {
            let seconds = download_start.elapsed().as_secs_f64().max(0.05);
            round1((bytes.len() as f64 * 8.0 / 1_048_576.0) / seconds)
        }
        Ok(_) => {
            error = Some("El servidor devolvió una respuesta vacía".into());
            0.0
        }
        Err(e) => {
            error = Some(e.to_string());
            0.0
        }
    };

    let upload_mbps = match cfg.upload_url {
        Some(upload_url) => {
            let payload: Vec<u8> = (0..SPEED_TEST_UPLOAD_BYTES).map(|_| rand_byte()).collect();
            let upload_start = std::time::Instant::now();
            match client
                .post(upload_url)
                .header("Content-Type", "application/octet-stream")
                .body(payload.clone())
                .send()
            {
                Ok(_) => {
                    let seconds = upload_start.elapsed().as_secs_f64().max(0.05);
                    Some(round1((payload.len() as f64 * 8.0 / 1_048_576.0) / seconds))
                }
                Err(e) => {
                    error = Some(e.to_string());
                    Some(0.0)
                }
            }
        }
        None => None,
    };

    Ok(serde_json::json!({
        "provider": cfg.id,
        "downloadMbps": download_mbps,
        "uploadMbps": upload_mbps,
        "uploadSupported": cfg.upload_url.is_some(),
        "latencyMs": latency_ms,
        "jitterMs": jitter_ms,
        "error": error,
    }))
}

/// Ejecuta el cliente oficial de Ookla Speedtest CLI instalado en el equipo.
/// No embebe una página web y devuelve el servidor que Ookla seleccionó.
pub fn ookla_speed_test(resource_dir: &Path) -> Result<Value, String> {
    let mut candidates = vec![
        PathBuf::from("speedtest.exe"),
        resource_dir.join("tools").join("speedtest.exe"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tools")
            .join("speedtest.exe"),
    ];
    if let Ok(program_files) = std::env::var("ProgramFiles") {
        candidates.push(
            PathBuf::from(program_files)
                .join("Ookla Speedtest")
                .join("speedtest.exe"),
        );
    }
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        candidates
            .push(PathBuf::from(local_app_data).join(r"Programs\Ookla Speedtest\speedtest.exe"));
    }
    let mut last_error = String::new();
    for executable in candidates {
        let output = match std::process::Command::new(executable)
            .args(["--accept-license", "--accept-gdpr", "-f", "json"])
            .output()
        {
            Ok(output) => output,
            Err(error) => {
                last_error = error.to_string();
                continue;
            }
        };
        if !output.status.success() {
            let message = String::from_utf8_lossy(&output.stderr).trim().to_owned();
            return Err(if message.is_empty() {
                format!("Speedtest CLI terminó con código {}", output.status)
            } else {
                message
            });
        }
        let payload: Value = serde_json::from_slice(&output.stdout)
            .map_err(|error| format!("Speedtest CLI devolvió JSON inválido: {error}"))?;
        let download = payload
            .get("download")
            .and_then(|v| v.get("bandwidth"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0)
            * 8.0
            / 1_000_000.0;
        let upload = payload
            .get("upload")
            .and_then(|v| v.get("bandwidth"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0)
            * 8.0
            / 1_000_000.0;
        let latency = payload
            .get("ping")
            .and_then(|v| v.get("latency"))
            .and_then(Value::as_f64)
            .unwrap_or(0.0);
        let server = payload
            .get("server")
            .map(|server| {
                serde_json::json!({
                    "id": server.get("id").and_then(Value::as_i64),
                    "name": server.get("name").and_then(Value::as_str).unwrap_or("Ookla server"),
                    "location": server.get("location").and_then(Value::as_str).unwrap_or(""),
                    "sponsor": server.get("sponsor").and_then(Value::as_str).unwrap_or(""),
                })
            })
            .unwrap_or(Value::Null);
        return Ok(serde_json::json!({
            "provider": "ookla",
            "downloadMbps": round1(download),
            "uploadMbps": round1(upload),
            "latencyMs": round1(latency),
            "server": server,
        }));
    }
    Err(format!("No se encontró Ookla Speedtest CLI en PATH ({last_error}). Instalalo desde speedtest.net/apps/cli.") )
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}

/// Byte "aleatorio" liviano para el payload de subida del speed test: no hace falta un RNG
/// criptográfico acá, sólo bytes no compresibles de forma trivial.
fn rand_byte() -> u8 {
    use std::time::{SystemTime, UNIX_EPOCH};
    static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let n = COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    (n ^ t as u64) as u8
}

// ---------------------------------------------------------- third-party tools

/// Lanza una herramienta registrada en `tools/manifest.json`.
/// La carpeta se incluye mediante `bundle.resources` y no se descarga nada en runtime.
pub fn open_tool(resource_dir: &Path, file_name: &str) -> Result<Value, String> {
    let manifest_paths = [
        resource_dir.join("tools").join("manifest.json"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("tools")
            .join("manifest.json"),
    ];
    let manifest_path = manifest_paths
        .iter()
        .find(|path| path.exists())
        .ok_or_else(|| "No se encontró el manifiesto de herramientas integrado.".to_string())?;
    let manifest: Value = serde_json::from_str(
        &std::fs::read_to_string(manifest_path)
            .map_err(|e| format!("No se pudo leer el manifiesto de herramientas: {e}"))?,
    )
    .map_err(|e| format!("Manifiesto de herramientas inválido: {e}"))?;
    let entry = manifest
        .get("tools")
        .and_then(Value::as_array)
        .and_then(|tools| {
            tools
                .iter()
                .find(|tool| tool.get("file").and_then(Value::as_str) == Some(file_name))
        });
    let Some(entry) = entry else {
        return Err(format!(
            "La herramienta '{file_name}' no está registrada en tools/manifest.json."
        ));
    };
    if file_name.is_empty()
        || Path::new(file_name)
            .file_name()
            .and_then(|name| name.to_str())
            != Some(file_name)
    {
        return Err("Nombre de herramienta no válido.".into());
    }

    let packaged_path = resource_dir.join("tools").join(file_name);
    let source_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("tools")
        .join(file_name);
    let tool_path = if packaged_path.is_file() {
        packaged_path
    } else {
        source_path
    };
    if !tool_path.is_file() {
        return Ok(serde_json::json!({
            "ok": false,
            "included": false,
            "file": file_name,
            "label": entry.get("label").and_then(Value::as_str).unwrap_or(file_name),
            "path": tool_path.to_string_lossy(),
            "source": entry.get("source").and_then(Value::as_str),
        }));
    }

    let mut command = std::process::Command::new(&tool_path);
    if let Some(parent) = tool_path.parent() {
        command.current_dir(parent);
    }
    command
        .spawn()
        .map_err(|e| format!("No se pudo iniciar {file_name}: {e}"))?;

    Ok(
        serde_json::json!({ "ok": true, "included": true, "file": file_name, "path": tool_path.to_string_lossy() }),
    )
}
