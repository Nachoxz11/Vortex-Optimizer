//! Tweaks de plan de energía (`powercfg`).
//!
//! La lectura (`check`) es 100% nativa vía `powrprof.dll` (`PowerGetActiveScheme` +
//! `PowerReadACValueIndex`/`PowerReadDCValueIndex`, expuestas por la crate `windows`), sin spawnear
//! `powercfg.exe` ni PowerShell. Esa API resuelve el valor vigente incluso en planes personalizados
//! o duplicados (p. ej. "Ultimate Performance") donde la clave de override por-plan
//! (`PowerSchemes\<scheme>\<subgroup>\<setting>`) no existe en el Registro — es el mismo motivo por
//! el que la versión anterior evitaba leer el Registro directo y parseaba `powercfg /q`.
//!
//! Escribir SÍ requiere privilegios de administrador (frontera real de Windows, no una limitación
//! de la API), así que `apply`/`revert` siguen elevando un proceso — pero ahora es `powercfg.exe`
//! encadenado por `cmd.exe /c` en una única elevación UAC, no un script de PowerShell.

use serde_json::{json, Value};
use windows::core::GUID;
use windows::Win32::Foundation::HLOCAL;
use windows::Win32::System::Power::{PowerGetActiveScheme, PowerReadACValueIndex, PowerReadDCValueIndex};

use super::TweakDefinition;
use crate::powershell::{restore_point_script, run_elevated, run_elevated_exe};
use crate::snapshots::SnapshotStore;

fn parse_guid(value: &str) -> Result<GUID, String> {
    GUID::try_from(value).map_err(|_| format!("GUID de energía no válido: {value}"))
}

fn active_scheme_guid() -> Result<GUID, String> {
    unsafe {
        let mut ptr: *mut GUID = std::ptr::null_mut();
        let err = PowerGetActiveScheme(None, &mut ptr);
        if err.0 != 0 || ptr.is_null() {
            return Err(format!("No se pudo obtener el plan de energía activo (código {}).", err.0));
        }
        let guid = *ptr;
        let _ = windows::Win32::Foundation::LocalFree(Some(HLOCAL(ptr as *mut core::ffi::c_void)));
        Ok(guid)
    }
}

fn read_indices(subgroup: &GUID, setting: &GUID) -> Result<(String, u32, u32), String> {
    let scheme = active_scheme_guid()?;
    let mut ac = 0u32;
    let mut dc = 0u32;
    unsafe {
        let err = PowerReadACValueIndex(None, Some(&scheme), Some(subgroup), Some(setting), &mut ac);
        if err.0 != 0 {
            return Err("Este ajuste de energía no está disponible en el plan activo.".into());
        }
        let err2 = PowerReadDCValueIndex(None, Some(&scheme), Some(subgroup), Some(setting), &mut dc);
        if err2 != 0 {
            return Err("Este ajuste de energía no está disponible en el plan activo.".into());
        }
    }
    Ok((format!("{scheme:?}"), ac, dc))
}

fn read_state(def: &TweakDefinition) -> Result<Value, String> {
    let (subgroup, setting, _, _) = def.powercfg_parts()?;
    let (scheme, ac, dc) = read_indices(&parse_guid(subgroup)?, &parse_guid(setting)?)?;
    Ok(json!({ "scheme": scheme, "ac": ac, "dc": dc }))
}

pub fn check(def: &TweakDefinition) -> Result<Value, String> {
    let (_, _, ac, dc) = def.powercfg_parts()?;
    let state = read_state(def)?;
    let applied = state.get("ac").and_then(Value::as_i64) == Some(ac)
        && state.get("dc").and_then(Value::as_i64) == Some(dc);

    let mut result = json!({ "id": def.id, "applied": applied });
    if let Some(obj) = state.as_object() {
        for (key, value) in obj {
            result[key] = value.clone();
        }
    }
    Ok(result)
}

/// Encadena las tres llamadas a `powercfg.exe` en un único `cmd.exe /c`, para elevar sólo una vez
/// con UAC en vez de una vez por comando.
fn apply_indices(subgroup: &str, setting: &str, ac: i64, dc: i64) -> Result<(), String> {
    let command = format!(
        "powercfg /setacvalueindex scheme_current {subgroup} {setting} {ac} && \
         powercfg /setdcvalueindex scheme_current {subgroup} {setting} {dc} && \
         powercfg /setactive scheme_current"
    );
    run_elevated_exe("cmd.exe", &["/c".to_string(), command])
}

pub fn apply(def: &TweakDefinition, snapshots: &SnapshotStore) -> Result<(), String> {
    let (subgroup, setting, ac, dc) = def.powercfg_parts()?;
    snapshots.set(&def.id, read_state(def)?)?;

    // Poco frecuente (apply de un tweak puntual): se mantiene sobre PowerShell, ver nota de Fase 2
    // en el plan de arquitectura sobre System Restore.
    let _ = run_elevated(&restore_point_script(&format!("Vortex-Optimizer - {}", def.name)));

    apply_indices(subgroup, setting, ac, dc)
}

pub fn revert(def: &TweakDefinition, snapshot: &Value) -> Result<(), String> {
    let (subgroup, setting, _, _) = def.powercfg_parts()?;

    let ac = snapshot.get("ac").and_then(Value::as_i64);
    let dc = snapshot.get("dc").and_then(Value::as_i64);
    let (Some(ac), Some(dc)) = (ac, dc) else {
        return Err("No hay una copia válida del estado anterior para este tweak.".into());
    };

    apply_indices(subgroup, setting, ac, dc)
}
