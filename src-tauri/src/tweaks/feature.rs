//! Componentes opcionales de Windows ("Activar o desactivar las características de Windows"),
//! vía `dism.exe` directo — sin PowerShell. `Get-WindowsOptionalFeature`/`Enable-WindowsOptionalFeature`
//! son wrappers de PowerShell sobre el mismo DISM, así que llamar al binario nativo evita el
//! intérprete sin perder nada de fidelidad. Un nombre de componente equivocado o no disponible en
//! esta edición de Windows simplemente hace que DISM devuelva un error legible — no hay forma de
//! que esto deje el sistema en un estado peor que "no se pudo cambiar".

use serde_json::{json, Value};

use super::TweakDefinition;
use crate::powershell::run_elevated_exe;
use crate::snapshots::SnapshotStore;

/// Corre `DISM /Online /Get-FeatureInfo` y devuelve el estado crudo ("Enabled", "Disabled",
/// "Enable Pending", "Disable Pending", ...). Es de lectura, no requiere elevación.
fn query_state(feature_name: &str) -> Result<String, String> {
    let output = std::process::Command::new("dism.exe")
        .args([
            "/Online",
            "/Get-FeatureInfo",
            &format!("/FeatureName:{feature_name}"),
            "/English",
        ])
        .creation_flags_no_window()
        .output()
        .map_err(|e| format!("No se pudo ejecutar DISM: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout
        .lines()
        .find_map(|line| line.trim().strip_prefix("State :").map(|s| s.trim().to_string()))
        .ok_or_else(|| {
            format!(
                "DISM no reconoce el componente '{feature_name}' en esta edición de Windows."
            )
        })
}

fn is_applied(state: &str) -> bool {
    state.eq_ignore_ascii_case("Enabled") || state.eq_ignore_ascii_case("Enable Pending")
}

pub fn check(def: &TweakDefinition) -> Result<Value, String> {
    let name = def.feature_name()?;
    let state = query_state(name)?;
    Ok(json!({ "id": def.id, "applied": is_applied(&state), "state": state }))
}

fn set_state(feature_name: &str, enable: bool) -> Result<(), String> {
    let verb = if enable { "/Enable-Feature" } else { "/Disable-Feature" };
    let mut args = vec!["/Online".to_string(), verb.to_string()];
    if enable {
        args.push(format!("/FeatureName:{feature_name}"));
        args.push("/All".to_string());
    } else {
        args.push(format!("/FeatureName:{feature_name}"));
    }
    args.push("/NoRestart".to_string());
    args.push("/English".to_string());
    run_elevated_exe("dism.exe", &args)
}

pub fn apply(def: &TweakDefinition, snapshots: &SnapshotStore) -> Result<(), String> {
    let name = def.feature_name()?;
    let prior_state = query_state(name)?;
    snapshots.set(&def.id, json!({ "state": prior_state }))?;
    set_state(name, true)
}

pub fn revert(def: &TweakDefinition, snapshot: &Value) -> Result<(), String> {
    let name = def.feature_name()?;
    let prior_state = snapshot
        .get("state")
        .and_then(Value::as_str)
        .ok_or("No hay una copia válida del estado anterior para este componente.")?;
    set_state(name, is_applied(prior_state))
}

/// Extensión mínima para no arrancar `dism.exe` con una consola visible (mismo criterio que
/// `powershell::CREATE_NO_WINDOW`, pero para un `std::process::Command` genérico).
trait NoWindow {
    fn creation_flags_no_window(&mut self) -> &mut Self;
}

impl NoWindow for std::process::Command {
    fn creation_flags_no_window(&mut self) -> &mut Self {
        use std::os::windows::process::CommandExt;
        self.creation_flags(0x0800_0000)
    }
}
