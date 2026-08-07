//! Tweaks que deshabilitan servicios de Windows.
//!
//! Port de `electron/tweaks/service-module.cjs`. Siempre requieren elevación y punto de
//! restauración, igual que en la versión Electron.
//!
//! FASE 2 (no migrado en esta pasada): sólo son 6 de los 87 tweaks, bajo volumen frente a
//! `registry.rs`. La API nativa recomendada es el Service Control Manager vía la crate `windows`
//! (`OpenSCManagerW`/`OpenServiceW`/`QueryServiceStatus`/`ChangeServiceConfigW`/`ControlService`,
//! módulo `Win32_System_Services`), que reemplazaría tanto la lectura (`Get-CimInstance
//! Win32_Service`) como la escritura (`Stop-Service`/`Set-Service`) sin pasar por PowerShell.

use serde_json::{json, Value};

use super::TweakDefinition;
use crate::powershell::{restore_point_script, run_elevated, run_json};
use crate::snapshots::SnapshotStore;

fn assert_service_name(name: &str) -> Result<&str, String> {
    let valid = !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-'));
    if valid {
        Ok(name)
    } else {
        Err("Nombre de servicio inválido.".into())
    }
}

fn state_script(name: &str) -> String {
    format!(
        r#"
$service = Get-CimInstance -ClassName Win32_Service -Filter "Name='{name}'" -ErrorAction Stop
[PSCustomObject]@{{ exists = $null -ne $service; startMode = $service.StartMode; state = $service.State }} | ConvertTo-Json -Compress
"#
    )
}

/// Traduce el `StartMode` de WMI al valor que espera `Set-Service -StartupType`.
fn startup_type(mode: &str) -> Option<&'static str> {
    match mode {
        "Auto" => Some("Automatic"),
        "Manual" => Some("Manual"),
        "Disabled" => Some("Disabled"),
        _ => None,
    }
}

fn read_state(name: &str) -> Result<Value, String> {
    run_json(&state_script(name))
}

pub fn check(def: &TweakDefinition) -> Result<Value, String> {
    let name = assert_service_name(def.service_name()?)?;
    let status = read_state(name)?;
    let applied = status.get("exists").and_then(Value::as_bool).unwrap_or(false)
        && status.get("startMode").and_then(Value::as_str) == Some("Disabled");
    Ok(json!({ "id": def.id, "applied": applied, "service": status }))
}

pub fn apply(def: &TweakDefinition, snapshots: &SnapshotStore) -> Result<(), String> {
    let name = assert_service_name(def.service_name()?)?;
    let before = read_state(name)?;

    if !before.get("exists").and_then(Value::as_bool).unwrap_or(false) {
        return Err(format!(
            "El servicio {name} no existe en esta instalación de Windows."
        ));
    }
    snapshots.set(&def.id, before)?;

    let script = format!(
        "{}\nStop-Service -Name '{name}' -Force -ErrorAction SilentlyContinue\nSet-Service -Name '{name}' -StartupType Disabled -ErrorAction Stop\n",
        restore_point_script(&format!("Vortex-Optimizer - {}", def.name))
    );
    run_elevated(&script)?;
    Ok(())
}

pub fn revert(def: &TweakDefinition, snapshot: &Value) -> Result<(), String> {
    let name = assert_service_name(def.service_name()?)?;

    let mode = snapshot
        .get("startMode")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let start_type = startup_type(mode)
        .ok_or_else(|| format!("No se puede restaurar el modo de inicio '{mode}'."))?;

    let start = if snapshot.get("state").and_then(Value::as_str) == Some("Running") {
        format!("Start-Service -Name '{name}' -ErrorAction Stop")
    } else {
        String::new()
    };

    run_elevated(&format!(
        "Set-Service -Name '{name}' -StartupType {start_type} -ErrorAction Stop\n{start}"
    ))?;
    Ok(())
}
