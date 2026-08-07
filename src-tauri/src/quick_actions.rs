//! Acciones rápidas del Dashboard.
//!
//! Port de `electron/system/quick-actions.cjs`. Corrige de paso un bug del original: `runGameMode`
//! llamaba a `this.execPs`, un método que no existía en la clase, así que "Game Mode" siempre
//! fallaba con `execPs is not a function`.

use serde_json::{json, Value};

use crate::powershell::{run_json_lenient, PsResult};
use crate::system;
use crate::tweaks::TweakManager;

// `DnsFlushResolverCache` no está en los bindings de la crate `windows` (no forma parte del
// win32metadata oficial), así que se declara a mano — es la única función de este archivo que se
// vincula por FFI directa en vez de pasar por la crate.
#[link(name = "dnsapi")]
extern "system" {
    fn DnsFlushResolverCache() -> u32;
}

const OPTIMIZE_TWEAKS: [&str; 8] = [
    "p.edgepreload",
    "p.tips",
    "p.deliveryopt",
    "p.errorreport",
    "p.wsearchweb",
    "p.menushow",
    "pr.advertising",
    "pr.tailored",
];

const GAME_TWEAKS: [&str; 3] = ["p.superfetchgame", "n.throttle", "p.animations"];

/// Pluralización simple en español: sufijo `s` cuando la cuenta no es 1.
fn plural(count: usize) -> &'static str {
    if count == 1 {
        ""
    } else {
        "s"
    }
}

pub fn run(id: &str, manager: &TweakManager) -> PsResult<Value> {
    match id {
        "optimize" => Ok(apply_tweaks(
            &OPTIMIZE_TWEAKS,
            "Perfil recomendado aplicado",
            manager,
        )),
        "game" => game_mode(manager),
        "repair" => repair(),
        "explorer" => restart_explorer(),
        "dns" => flush_dns(),
        "temp" => clear_temp(),
        "ultimate" => ultimate_performance(),
        "scan" => scan(),
        _ => Err(format!("Acción rápida desconocida: {id}")),
    }
}

/// Aplica una lista de tweaks salteando los que ya están activos o no existen.
fn apply_tweaks(ids: &[&str], label: &str, manager: &TweakManager) -> Value {
    let mut applied: Vec<&str> = Vec::new();
    let mut skipped: Vec<&str> = Vec::new();
    let mut failed: Vec<Value> = Vec::new();

    for id in ids {
        match manager.check(id) {
            Err(error) => failed.push(json!({ "id": id, "error": error })),
            Ok(status) => {
                if status.get("applied").and_then(Value::as_bool).unwrap_or(false) {
                    skipped.push(id);
                } else if let Err(error) = manager.change(id, "apply") {
                    failed.push(json!({ "id": id, "error": error }));
                } else {
                    applied.push(id);
                }
            }
        }
    }

    let mut detail = format!(
        "{} tweak{} aplicado{}",
        applied.len(),
        plural(applied.len()),
        plural(applied.len())
    );
    if !skipped.is_empty() {
        detail.push_str(&format!(
            ", {} ya activo{}",
            skipped.len(),
            plural(skipped.len())
        ));
    }
    if !failed.is_empty() {
        detail.push_str(&format!(
            ", {} fallido{}",
            failed.len(),
            plural(failed.len())
        ));
    }
    detail.push('.');

    json!({
        "ok": failed.is_empty(),
        "message": label,
        "detail": detail,
        "stats": { "applied": applied, "skipped": skipped, "failed": failed },
    })
}

/// Activa el Game Mode de Windows escribiendo directo en `HKCU\Software\Microsoft\GameBar` vía
/// `winreg` — no hace falta elevación (es una clave de usuario), así que no hay ningún proceso de
/// por medio.
fn enable_game_bar() -> Result<bool, String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (key, _) = hkcu
        .create_subkey(r"Software\Microsoft\GameBar")
        .map_err(|e| format!("No se pudo abrir GameBar: {e}"))?;
    key.set_value("AutoGameModeEnabled", &1u32).map_err(|e| e.to_string())?;
    key.set_value("AllowAutoGameMode", &1u32).map_err(|e| e.to_string())?;
    Ok(true)
}

fn game_mode(manager: &TweakManager) -> PsResult<Value> {
    let tweak_result = apply_tweaks(&GAME_TWEAKS, "Modo juego configurado", manager);
    let game_bar_enabled = enable_game_bar().unwrap_or(false);

    let detail = format!(
        "{} Game Mode de Windows activado.",
        tweak_result
            .get("detail")
            .and_then(Value::as_str)
            .unwrap_or_default()
    );
    let mut stats = tweak_result.get("stats").cloned().unwrap_or(json!({}));
    stats["gameMode"] = json!(game_bar_enabled);

    Ok(json!({
        "ok": tweak_result.get("ok").cloned().unwrap_or(json!(false)),
        "message": "Modo juego activado",
        "detail": detail,
        "stats": stats,
    }))
}

// FASE 2: acá sólo hace falta invocar `dism.exe` directo por `Command` (sin el wrapper de
// PowerShell) y parsear su stdout en Rust — no existe una API pública estable para
// `/Cleanup-Image /CheckHealth` fuera del propio ejecutable.
fn repair() -> PsResult<Value> {
    let result = run_json_lenient(
        r#"
$ErrorActionPreference = 'SilentlyContinue'
$health = 'unknown'
$dism = ''
try {
  $dismOut = & dism.exe /Online /Cleanup-Image /CheckHealth 2>&1 | Out-String
  if ($dismOut -match 'No component store corruption') { $health = 'healthy' }
  elseif ($dismOut -match 'repairable') { $health = 'repairable' }
  elseif ($dismOut -match 'corruption') { $health = 'corrupted' }
  else { $health = 'checked' }
  $dism = ($dismOut -replace '\s+', ' ').Trim().Substring(0, [Math]::Min(240, ($dismOut -replace '\s+', ' ').Trim().Length))
} catch {
  $health = 'error'
  $dism = $_.Exception.Message
}
@{
  health = $health
  summary = $dism
} | ConvertTo-Json -Compress
"#,
    )?;

    let health = result.get("health").and_then(Value::as_str).unwrap_or("");
    let detail = if health == "healthy" {
        "El almacén de componentes no reporta corrupción."
    } else {
        "Revisión completada. Consultá el detalle para más información."
    };

    Ok(json!({
        "ok": health != "corrupted",
        "message": "Integridad del sistema verificada",
        "detail": detail,
        "stats": result,
    }))
}

/// Mata y relanza `explorer.exe` con `sysinfo` (ya usado por el resto del backend para procesos) +
/// `std::process::Command`, sin PowerShell.
fn restart_explorer() -> PsResult<Value> {
    use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::everything());
    for process in sys.processes_by_exact_name("explorer.exe".as_ref()) {
        process.kill();
    }

    std::thread::sleep(std::time::Duration::from_millis(400));
    std::process::Command::new("explorer.exe")
        .spawn()
        .map_err(|e| format!("No se pudo relanzar Explorer: {e}"))?;

    Ok(json!({
        "ok": true,
        "message": "Explorer reiniciado",
        "detail": "El shell de Windows se recargó correctamente.",
    }))
}

/// `DnsFlushResolverCache` de `dnsapi.dll` directo — el mismo efecto que `Clear-DnsClientCache`,
/// sin proceso ni intérprete de por medio.
fn flush_dns() -> PsResult<Value> {
    let ok = unsafe { DnsFlushResolverCache() } != 0;
    if !ok {
        return Err("No se pudo vaciar la caché de DNS.".into());
    }

    Ok(json!({
        "ok": true,
        "message": "Caché DNS vaciada",
        "detail": "Se llamó a DnsFlushResolverCache en este equipo.",
    }))
}

/// Reusa el walker paralelo de `crate::fs_walk` (mismo que usa el Cleaner) en vez de un script de
/// PowerShell — un único recorrido en Rust puro de `%TEMP%` y `C:\Windows\Temp`.
fn clear_temp() -> PsResult<Value> {
    let paths = [
        std::env::var("TEMP").map(std::path::PathBuf::from).ok(),
        Some(std::path::PathBuf::from(r"C:\Windows\Temp")),
    ];

    let stats = paths
        .into_iter()
        .flatten()
        .filter(|p| p.exists())
        .map(|p| crate::fs_walk::remove_all_files(&p))
        .fold(crate::fs_walk::RemovalStats::default(), |acc, s| crate::fs_walk::RemovalStats {
            freed_bytes: acc.freed_bytes + s.freed_bytes,
            removed: acc.removed + s.removed,
            errors: acc.errors + s.errors,
        });

    let freed_gb = (stats.freed_bytes as f64 / 1_073_741_824.0 * 100.0).round() / 100.0;
    let mut detail = format!("{freed_gb} GB liberados en {} elemento{}", stats.removed, plural(stats.removed as usize));
    if stats.errors > 0 {
        detail.push_str(&format!(" ({} omitidos por permisos)", stats.errors));
    }
    detail.push('.');

    Ok(json!({
        "ok": true,
        "message": "Archivos temporales eliminados",
        "detail": detail,
        "stats": {
            "removed": stats.removed,
            "freedGB": freed_gb,
            "errors": stats.errors,
        },
    }))
}

// FASE 2: la lógica de parseo de `/list` y `-duplicatescheme` se puede portar a Rust puro y
// ejecutar `powercfg.exe` directo por `Command` (como ya hace `tweaks::powercfg`), evitando
// PowerShell acá también — no se migró en esta pasada por ser una acción puntual, no un hot path.
fn ultimate_performance() -> PsResult<Value> {
    let result = run_json_lenient(
        r#"
$ErrorActionPreference = 'SilentlyContinue'
$ultimate = 'e9a42b02-d5df-448d-aa00-03f14749eb61'
$active = $null
$list = & powercfg.exe /list 2>&1 | Out-String
if ($list -match 'Ultimate Performance.*?(\{[0-9a-fA-F-]{36}\})') {
  $active = $Matches[1]
} else {
  $dup = & powercfg.exe -duplicatescheme $ultimate 2>&1 | Out-String
  if ($dup -match '(\{[0-9a-fA-F-]{36}\})') { $active = $Matches[1] }
}
if (-not $active) { throw 'No se pudo crear ni encontrar el plan Ultimate Performance.' }
& powercfg.exe /setactive $active | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'No se pudo activar Ultimate Performance.' }
@{ plan = 'Ultimate Performance'; guid = $active } | ConvertTo-Json -Compress
"#,
    )?;

    Ok(json!({
        "ok": true,
        "message": "Ultimate Performance activado",
        "detail": "El plan de energía oculto quedó seleccionado como activo.",
        "stats": result,
    }))
}

fn scan() -> PsResult<Value> {
    let info = system::info()?;
    let cleaner = system::cleaner_scan()?;

    let reclaimable: f64 = cleaner
        .iter()
        .filter_map(|c| c.get("size").and_then(Value::as_f64))
        .sum();

    let health = info.get("health").and_then(Value::as_i64).unwrap_or(0);
    let free = info
        .get("storageFreeGB")
        .and_then(Value::as_f64)
        .unwrap_or(0.0);

    Ok(json!({
        "ok": true,
        "message": "Escaneo del sistema completado",
        "detail": format!("Salud {health}/100 · {free} GB libres · {reclaimable:.1} GB recuperables en Cleaner."),
        "stats": {
            "health": health,
            "storageFreeGB": free,
            "reclaimableGB": reclaimable,
            "categories": cleaner.len(),
        },
    }))
}
