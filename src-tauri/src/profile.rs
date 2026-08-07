//! Exportar/importar el estado de los tweaks y abrir el asistente nativo de reseteo de Windows.
//!
//! No hay un picker de archivos nativo acá (evitamos sumar el plugin `tauri-plugin-dialog` sólo
//! para esto): exportar escribe siempre a `Documentos\Vortex-Optimizer\`, e importar recibe el contenido ya
//! leído por el frontend vía un `<input type="file">` normal del navegador — el propio webview de
//! Tauri soporta el picker nativo del sistema operativo para ese elemento sin plugins extra.

use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;

use crate::tweaks::TweakManager;

fn export_dir() -> Result<PathBuf, String> {
    let base = std::env::var("USERPROFILE")
        .map_err(|_| "No se pudo determinar la carpeta de perfil del usuario.".to_string())?;
    let dir = PathBuf::from(base).join("Documents").join("Vortex-Optimizer");
    std::fs::create_dir_all(&dir).map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
    Ok(dir)
}

/// Vuelca `applied` de cada tweak (declarativo + custom) a un `.json` en `Documentos\Vortex-Optimizer\`.
pub fn export_profile(manager: &TweakManager) -> Result<Value, String> {
    let entries: Vec<Value> = manager
        .list()
        .into_iter()
        .map(|status| {
            json!({
                "id": status.get("id").cloned().unwrap_or(Value::Null),
                "applied": status.get("applied").cloned().unwrap_or(Value::Bool(false)),
            })
        })
        .collect();

    let dir = export_dir()?;
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let path = dir.join(format!("xtweaks-profile-{timestamp}.json"));
    let contents = serde_json::to_string_pretty(&json!({ "tweaks": entries }))
        .map_err(|e| format!("No se pudo serializar el perfil: {e}"))?;
    std::fs::write(&path, contents)
        .map_err(|e| format!("No se pudo escribir {}: {e}", path.display()))?;

    Ok(json!({ "path": path.to_string_lossy(), "count": entries.len() }))
}

#[derive(Debug, Deserialize)]
pub struct ProfileEntry {
    pub id: String,
    pub applied: bool,
}

/// Reaplica cada entrada del perfil importado, saltando las que ya están en el estado deseado.
/// Un tweak individual que falle (por ejemplo, ya no disponible en esta instalación de Windows) no
/// interrumpe al resto — se junta en `failed` para que el frontend lo muestre.
pub fn import_profile(manager: &TweakManager, entries: &[ProfileEntry]) -> Value {
    let mut applied_count = 0u32;
    let mut skipped_count = 0u32;
    let mut failed: Vec<Value> = Vec::new();

    for entry in entries {
        let current_applied = manager
            .check(&entry.id)
            .ok()
            .and_then(|status| status.get("applied").and_then(Value::as_bool))
            .unwrap_or(false);

        if current_applied == entry.applied {
            skipped_count += 1;
            continue;
        }

        let action = if entry.applied { "apply" } else { "revert" };
        match manager.change(&entry.id, action) {
            Ok(_) => applied_count += 1,
            Err(error) => failed.push(json!({ "id": entry.id, "error": error })),
        }
    }

    json!({ "applied": applied_count, "skipped": skipped_count, "failed": failed })
}

/// Abre el asistente nativo "Restablecer esta PC" de Windows (`systemreset.exe`, el mismo binario
/// que usa Configuración > Recuperación). No borra nada por sí mismo: sólo lanza la UI del propio
/// Windows, que exige sus confirmaciones. Vortex-Optimizer nunca ejecuta el reseteo directamente — sería
/// demasiado destructivo para hacerlo con un solo clic sin el flujo completo de Windows detrás.
pub fn open_reset_wizard() -> Result<(), String> {
    std::process::Command::new("systemreset.exe")
        .spawn()
        .map_err(|e| format!("No se pudo abrir el asistente de restablecimiento de Windows: {e}"))?;
    Ok(())
}
