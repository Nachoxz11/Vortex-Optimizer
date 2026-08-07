//! Tweaks basados en el Registro de Windows.
//!
//! Backea 71 de los 87 tweaks de `tweaks.json` (ver conteo en el plan de arquitectura), así que es
//! la migración de mayor impacto sobre `TweakManager::list()`. Lecturas y escrituras en `HKCU` (36
//! de los 71) van directo por `winreg`, en el mismo proceso — cero llamadas a PowerShell. Las que
//! escriben en `HKLM` (35 de 71) siguen necesitando una elevación UAC real (eso es una frontera de
//! seguridad de Windows, no algo que una API pueda evitar), pero en vez de relanzar un PowerShell
//! elevado que corre un script con JSON en base64, se eleva `reg.exe` directo con argumentos planos
//! (`crate::powershell::run_elevated_exe`) — se elimina el intérprete, sólo queda el proceso nativo
//! mínimo indispensable para la elevación.

use serde_json::{json, Value};
use winreg::enums::*;
use winreg::{RegKey, RegValue};

use super::{scalar_to_string, RegistryTarget, TweakDefinition};
use crate::snapshots::SnapshotStore;

const ALLOWED_KINDS: [&str; 6] = [
    "DWord",
    "String",
    "ExpandString",
    "MultiString",
    "QWord",
    "Binary",
];

/// Rechaza rutas fuera de HKCU/HKLM, nombres con separadores y tipos desconocidos.
pub fn validate(targets: &[RegistryTarget]) -> Result<(), String> {
    if targets.is_empty() {
        return Err("Un módulo de Registro requiere al menos un valor.".into());
    }
    for target in targets {
        let upper = target.path.to_uppercase();
        if !upper.starts_with("HKCU:\\") && !upper.starts_with("HKLM:\\") {
            return Err("Ruta de Registro no permitida.".into());
        }
        if target.name.is_empty() || target.name.contains('\\') || target.name.contains('/') {
            return Err("Nombre de valor de Registro no válido.".into());
        }
        if !ALLOWED_KINDS.contains(&target.kind.as_str()) {
            return Err("Tipo de valor de Registro no permitido.".into());
        }
    }
    Ok(())
}

/// Separa `HKCU:\Software\Foo` en el hive (`HKEY_CURRENT_USER`) y la subruta (`Software\Foo`).
fn parse_path(path: &str) -> Result<(winreg::HKEY, &str), String> {
    let (hive, rest) = path.split_once(':').ok_or("Ruta de Registro no válida.")?;
    let sub = rest.trim_start_matches(['\\', '/']);
    match hive.to_uppercase().as_str() {
        "HKCU" => Ok((HKEY_CURRENT_USER, sub)),
        "HKLM" => Ok((HKEY_LOCAL_MACHINE, sub)),
        _ => Err("Ruta de Registro no permitida.".into()),
    }
}

fn is_elevated_path(path: &str) -> bool {
    path.to_uppercase().starts_with("HKLM:\\")
}

fn utf16_nul(s: &str) -> Vec<u8> {
    s.encode_utf16().chain(std::iter::once(0u16)).flat_map(u16::to_le_bytes).collect()
}

fn decode_utf16_nul(bytes: &[u8]) -> String {
    let units: Vec<u16> = bytes.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
    let end = units.iter().position(|&u| u == 0).unwrap_or(units.len());
    String::from_utf16_lossy(&units[..end])
}

fn decode_multi_sz(bytes: &[u8]) -> Vec<String> {
    let units: Vec<u16> = bytes.chunks_exact(2).map(|c| u16::from_le_bytes([c[0], c[1]])).collect();
    let mut result = Vec::new();
    let mut current = Vec::new();
    for u in units {
        if u == 0 {
            if current.is_empty() {
                break;
            }
            result.push(String::from_utf16_lossy(&current));
            current.clear();
        } else {
            current.push(u);
        }
    }
    result
}

fn kind_to_regtype(kind: &str) -> RegType {
    match kind {
        "DWord" => REG_DWORD,
        "QWord" => REG_QWORD,
        "ExpandString" => REG_EXPAND_SZ,
        "MultiString" => REG_MULTI_SZ,
        "Binary" => REG_BINARY,
        _ => REG_SZ,
    }
}

fn regtype_to_kind(vtype: &RegType) -> &'static str {
    match vtype {
        REG_DWORD => "DWord",
        REG_QWORD => "QWord",
        REG_EXPAND_SZ => "ExpandString",
        REG_MULTI_SZ => "MultiString",
        REG_BINARY => "Binary",
        _ => "String",
    }
}

fn value_to_reg_value(kind: &str, value: &Value) -> Result<RegValue, String> {
    let vtype = kind_to_regtype(kind);
    let bytes = match kind {
        "DWord" => {
            let n = value.as_u64().or_else(|| value.as_i64().map(|v| v as u64)).ok_or("Valor DWord inválido.")?;
            (n as u32).to_le_bytes().to_vec()
        }
        "QWord" => {
            let n = value.as_u64().or_else(|| value.as_i64().map(|v| v as u64)).ok_or("Valor QWord inválido.")?;
            n.to_le_bytes().to_vec()
        }
        "String" | "ExpandString" => {
            let s = value.as_str().ok_or("Valor de cadena inválido.")?;
            utf16_nul(s)
        }
        "MultiString" => {
            let items = value.as_array().ok_or("Valor MultiString inválido.")?;
            let mut bytes = Vec::new();
            for item in items {
                bytes.extend(utf16_nul(item.as_str().ok_or("Elemento de MultiString inválido.")?));
            }
            bytes.extend([0u8, 0u8]);
            bytes
        }
        "Binary" => {
            let items = value.as_array().ok_or("Valor binario inválido.")?;
            items
                .iter()
                .map(|v| v.as_u64().map(|n| n as u8).ok_or_else(|| "Byte binario inválido.".to_string()))
                .collect::<Result<Vec<u8>, _>>()?
        }
        _ => return Err("Tipo de valor de Registro no permitido.".into()),
    };
    Ok(RegValue { bytes, vtype })
}

fn reg_value_to_json(reg: &RegValue) -> Value {
    match reg.vtype {
        REG_DWORD if reg.bytes.len() >= 4 => json!(u32::from_le_bytes(reg.bytes[0..4].try_into().unwrap())),
        REG_QWORD if reg.bytes.len() >= 8 => json!(u64::from_le_bytes(reg.bytes[0..8].try_into().unwrap())),
        REG_SZ | REG_EXPAND_SZ => json!(decode_utf16_nul(&reg.bytes)),
        REG_MULTI_SZ => json!(decode_multi_sz(&reg.bytes)),
        REG_BINARY => json!(reg.bytes),
        _ => Value::Null,
    }
}

/// Valor de `/d` para `reg.exe` (usado sólo en el camino elevado a HKLM): decimal para
/// DWord/QWord, la cadena tal cual para String/ExpandString, hex sin separadores para Binary y
/// `\0` literal entre elementos para MultiString (convención propia de `reg.exe`).
fn reg_exe_data_arg(kind: &str, value: &Value) -> Result<String, String> {
    Ok(match kind {
        "DWord" | "QWord" => value
            .as_u64()
            .or_else(|| value.as_i64().map(|v| v as u64))
            .ok_or("Valor numérico inválido.")?
            .to_string(),
        "String" | "ExpandString" => value.as_str().ok_or("Valor de cadena inválido.")?.to_string(),
        "MultiString" => value
            .as_array()
            .ok_or("Valor MultiString inválido.")?
            .iter()
            .map(|v| v.as_str().unwrap_or_default())
            .collect::<Vec<_>>()
            .join(r"\0"),
        "Binary" => value
            .as_array()
            .ok_or("Valor binario inválido.")?
            .iter()
            .map(|v| format!("{:02X}", v.as_u64().unwrap_or(0)))
            .collect::<String>(),
        _ => return Err("Tipo de valor de Registro no permitido.".into()),
    })
}

fn reg_exe_key_path(path: &str) -> String {
    path.replacen(':', "", 1)
}

fn read_target(target: &RegistryTarget) -> Value {
    let read = (|| -> Option<Value> {
        let (hive, sub) = parse_path(&target.path).ok()?;
        let root = RegKey::predef(hive);
        let key = root.open_subkey(sub).ok()?;
        let reg = key.get_raw_value(&target.name).ok()?;
        Some(json!({
            "path": target.path,
            "name": target.name,
            "exists": true,
            "value": reg_value_to_json(&reg),
            "kind": regtype_to_kind(&reg.vtype),
        }))
    })();
    read.unwrap_or_else(|| {
        json!({ "path": target.path, "name": target.name, "exists": false, "value": Value::Null, "kind": Value::Null })
    })
}

fn read_state(targets: &[RegistryTarget]) -> Vec<Value> {
    targets.iter().map(read_target).collect()
}

pub fn check(def: &TweakDefinition) -> Result<Value, String> {
    let targets = def.registry_targets()?;
    validate(targets)?;
    let entries = read_state(targets);

    let applied = entries.iter().zip(targets.iter()).all(|(entry, target)| {
        entry.get("exists").and_then(Value::as_bool).unwrap_or(false)
            && scalar_to_string(entry.get("value").unwrap_or(&Value::Null)) == scalar_to_string(&target.value)
    });

    Ok(json!({ "id": def.id, "applied": applied, "targets": entries }))
}

/// Escribe un valor directo por `winreg` (HKCU, sin elevar).
fn write_direct(target: &RegistryTarget) -> Result<(), String> {
    let (hive, sub) = parse_path(&target.path)?;
    let root = RegKey::predef(hive);
    let (key, _) = root.create_subkey(sub).map_err(|e| format!("No se pudo abrir {}: {e}", target.path))?;
    let reg = value_to_reg_value(&target.kind, &target.value)?;
    key.set_raw_value(&target.name, &reg)
        .map_err(|e| format!("No se pudo escribir {} en {}: {e}", target.name, target.path))
}

/// Elimina un valor directo por `winreg` (usado al revertir una entrada que no existía antes).
fn delete_direct(target: &RegistryTarget) -> Result<(), String> {
    let (hive, sub) = parse_path(&target.path)?;
    let root = RegKey::predef(hive);
    if let Ok(key) = root.open_subkey_with_flags(sub, KEY_SET_VALUE) {
        let _ = key.delete_value(&target.name);
    }
    Ok(())
}

/// Escribe (o borra) un valor en HKLM elevando `reg.exe` directo, sin PowerShell de por medio.
fn write_elevated(target: &RegistryTarget, delete: bool) -> Result<(), String> {
    let key_path = reg_exe_key_path(&target.path);
    let args: Vec<String> = if delete {
        vec!["delete".into(), key_path, "/v".into(), target.name.clone(), "/f".into()]
    } else {
        let data = reg_exe_data_arg(&target.kind, &target.value)?;
        vec![
            "add".into(),
            key_path,
            "/v".into(),
            target.name.clone(),
            "/t".into(),
            format!("REG_{}", reg_exe_type_suffix(&target.kind)),
            "/d".into(),
            data,
            "/f".into(),
        ]
    };
    crate::powershell::run_elevated_exe("reg.exe", &args)
}

fn reg_exe_type_suffix(kind: &str) -> &'static str {
    match kind {
        "DWord" => "DWORD",
        "QWord" => "QWORD",
        "ExpandString" => "EXPAND_SZ",
        "MultiString" => "MULTI_SZ",
        "Binary" => "BINARY",
        _ => "SZ",
    }
}

pub fn apply(def: &TweakDefinition, snapshots: &SnapshotStore) -> Result<(), String> {
    let targets = def.registry_targets()?;
    validate(targets)?;

    // El estado previo se guarda antes de escribir: si un target falla a mitad del bucle, la copia
    // sigue disponible para revertir la aplicación parcial.
    snapshots.set(&def.id, Value::Array(read_state(targets)))?;

    if def.requires_restore_point {
        let script = crate::powershell::restore_point_script(&format!("Vortex-Optimizer - {}", def.name));
        if def.requires_elevation {
            let _ = crate::powershell::run_elevated(&script);
        } else {
            let _ = crate::powershell::run(&script);
        }
    }

    for target in targets {
        if is_elevated_path(&target.path) {
            write_elevated(target, false)?;
        } else {
            write_direct(target)?;
        }
    }
    Ok(())
}

pub fn revert(_def: &TweakDefinition, snapshot: &Value) -> Result<(), String> {
    let entries = snapshot.as_array().ok_or("Copia de seguridad de Registro inválida.")?;
    for entry in entries {
        let path = entry.get("path").and_then(Value::as_str).unwrap_or_default();
        let name = entry.get("name").and_then(Value::as_str).unwrap_or_default();
        let exists = entry.get("exists").and_then(Value::as_bool).unwrap_or(false);
        let kind = entry.get("kind").and_then(Value::as_str).unwrap_or("String");
        let value = entry.get("value").cloned().unwrap_or(Value::Null);

        let target = RegistryTarget {
            path: path.to_string(),
            name: name.to_string(),
            kind: kind.to_string(),
            value,
        };

        if is_elevated_path(path) {
            if exists {
                write_elevated(&target, false)?;
            } else {
                write_elevated(&target, true)?;
            }
        } else if exists {
            write_direct(&target)?;
        } else {
            delete_direct(&target)?;
        }
    }
    Ok(())
}
