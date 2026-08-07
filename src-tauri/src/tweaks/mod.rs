//! Motor de tweaks.
//!
//! Port de `electron/tweaks/manager.cjs`. Las definiciones declarativas se generan desde el
//! código original con `scripts/extract-tweaks.cjs` y se embeben en el binario; los cinco tweaks
//! con lógica propia viven en [`custom`].

pub mod custom;
pub mod feature;
pub mod powercfg;
pub mod registry;
pub mod service;

use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::snapshots::{append_history, SnapshotStore};

const TWEAKS_JSON: &str = include_str!("../../tweaks.json");

#[derive(Debug, Clone, Deserialize)]
pub struct RegistryTarget {
    pub path: String,
    pub name: String,
    #[serde(default = "default_kind")]
    pub kind: String,
    pub value: Value,
}

fn default_kind() -> String {
    "DWord".into()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TweakKind {
    Registry,
    Service,
    Powercfg,
    Feature,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TweakDefinition {
    pub kind: TweakKind,
    pub id: String,
    pub name: String,
    pub category: String,
    pub risk: String,
    pub description: String,
    #[serde(default)]
    pub requires_elevation: bool,
    #[serde(default)]
    pub requires_restore_point: bool,
    #[serde(default)]
    pub requires_restart: bool,
    #[serde(default)]
    pub targets: Option<Vec<RegistryTarget>>,
    #[serde(default)]
    pub service_name: Option<String>,
    #[serde(default)]
    pub subgroup: Option<String>,
    #[serde(default)]
    pub setting: Option<String>,
    #[serde(default)]
    pub ac: Option<i64>,
    #[serde(default)]
    pub dc: Option<i64>,
    #[serde(default)]
    pub feature_name: Option<String>,
}

impl TweakDefinition {
    pub fn registry_targets(&self) -> Result<&[RegistryTarget], String> {
        self.targets
            .as_deref()
            .ok_or_else(|| format!("El tweak {} no define valores de Registro.", self.id))
    }

    pub fn service_name(&self) -> Result<&str, String> {
        self.service_name
            .as_deref()
            .ok_or_else(|| format!("El tweak {} no define un servicio.", self.id))
    }

    pub fn powercfg_parts(&self) -> Result<(&str, &str, i64, i64), String> {
        match (
            self.subgroup.as_deref(),
            self.setting.as_deref(),
            self.ac,
            self.dc,
        ) {
            (Some(subgroup), Some(setting), Some(ac), Some(dc)) => Ok((subgroup, setting, ac, dc)),
            _ => Err(format!(
                "El tweak {} no define un ajuste de energía completo.",
                self.id
            )),
        }
    }

    pub fn feature_name(&self) -> Result<&str, String> {
        self.feature_name
            .as_deref()
            .ok_or_else(|| format!("El tweak {} no define un componente de Windows.", self.id))
    }
}

#[derive(Debug, Deserialize)]
struct TweakFile {
    declarative: Vec<TweakDefinition>,
    order: Vec<String>,
}

/// Convierte un escalar JSON a texto sin comillas, replicando `String(value)` de JS.
pub fn scalar_to_string(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Null => "null".into(),
        other => other.to_string(),
    }
}

pub struct TweakManager {
    declarative: HashMap<String, TweakDefinition>,
    order: Vec<String>,
    snapshots: SnapshotStore,
    user_data: PathBuf,
}

impl TweakManager {
    pub fn new(user_data: &Path) -> Result<Self, String> {
        let parsed: TweakFile = serde_json::from_str(TWEAKS_JSON)
            .map_err(|e| format!("No se pudieron leer las definiciones de tweaks: {e}"))?;

        let declarative = parsed
            .declarative
            .into_iter()
            .map(|def| (def.id.clone(), def))
            .collect();

        Ok(Self {
            declarative,
            order: parsed.order,
            snapshots: SnapshotStore::new(user_data),
            user_data: user_data.to_path_buf(),
        })
    }

    fn exists(&self, id: &str) -> bool {
        self.declarative.contains_key(id) || custom::is_custom(id)
    }

    /// Metadatos que acompañan a cada estado en `list`.
    fn meta(&self, id: &str) -> Option<Value> {
        if let Some(def) = self.declarative.get(id) {
            return Some(json!({
                "id": def.id,
                "name": def.name,
                "category": def.category,
                "risk": def.risk,
                "description": def.description,
                "requiresRestart": def.requires_restart,
            }));
        }
        custom::CUSTOM_TWEAKS.iter().find(|t| t.id == id).map(|t| {
            json!({
                "id": t.id,
                "name": t.name,
                "category": t.category,
                "risk": t.risk,
                "description": t.description,
                "requiresRestart": t.requires_restart,
            })
        })
    }

    pub fn check(&self, id: &str) -> Result<Value, String> {
        if let Some(def) = self.declarative.get(id) {
            return match def.kind {
                TweakKind::Registry => registry::check(def),
                TweakKind::Service => service::check(def),
                TweakKind::Powercfg => powercfg::check(def),
                TweakKind::Feature => feature::check(def),
            };
        }
        if custom::is_custom(id) {
            return custom::check(id);
        }
        Err("Tweak no disponible en esta versión de Vortex-Optimizer.".into())
    }

    /// Estado de todos los tweaks, en el orden que espera la UI.
    ///
    /// Cada consulta lanza un proceso de PowerShell, así que se ejecutan en tandas paralelas.
    /// En serie los 64 tweaks tardan cerca de dos minutos; en paralelo bajan a ~20 s.
    pub fn list(&self) -> Vec<Value> {
        // El costo lo domina el arranque de powershell.exe, no la CPU. Medido sobre los 64
        // tweaks, 8 y 16 en paralelo dan prácticamente lo mismo (~21 s y ~19 s), así que el
        // límite está sobre todo para no llenar la máquina de procesos.
        const MAX_CONCURRENT: usize = 16;

        self.order
            .chunks(MAX_CONCURRENT)
            .flat_map(|chunk| {
                std::thread::scope(|scope| {
                    let handles: Vec<_> = chunk
                        .iter()
                        .map(|id| scope.spawn(move || self.entry(id)))
                        .collect();
                    handles
                        .into_iter()
                        .filter_map(|handle| handle.join().ok().flatten())
                        .collect::<Vec<_>>()
                })
            })
            .collect()
    }

    /// Metadatos + estado de un tweak. Un fallo al consultarlo se reporta en `error`, sin
    /// interrumpir al resto del listado.
    fn entry(&self, id: &str) -> Option<Value> {
        let mut entry = self.meta(id)?;
        match self.check(id) {
            Ok(status) => {
                entry["applied"] = status.get("applied").cloned().unwrap_or(json!(false));
            }
            Err(error) => {
                entry["applied"] = json!(false);
                entry["error"] = json!(error);
            }
        }
        Some(entry)
    }

    pub fn change(&self, id: &str, action: &str) -> Result<Value, String> {
        if action != "apply" && action != "revert" {
            return Err("Acción de tweak no válida.".into());
        }
        if !self.exists(id) {
            return Err("Tweak no disponible en esta versión de Vortex-Optimizer.".into());
        }

        let outcome = if action == "apply" {
            self.run_apply(id)
        } else {
            self.run_revert(id)
        };

        self.write_log(id, action, &outcome);

        let status = outcome?;
        let mut result = json!({ "id": id, "action": action });
        if let Some(obj) = status.as_object() {
            for (key, value) in obj {
                result[key] = value.clone();
            }
        }
        Ok(result)
    }

    fn run_apply(&self, id: &str) -> Result<Value, String> {
        // Cada módulo guarda el estado previo antes de escribir, de modo que una aplicación
        // parcial (script que falla a mitad) siga siendo reversible.
        if let Some(def) = self.declarative.get(id) {
            match def.kind {
                TweakKind::Registry => registry::apply(def, &self.snapshots)?,
                TweakKind::Service => service::apply(def, &self.snapshots)?,
                TweakKind::Powercfg => powercfg::apply(def, &self.snapshots)?,
                TweakKind::Feature => feature::apply(def, &self.snapshots)?,
            }
        } else {
            custom::apply(id, &self.snapshots)?;
        }
        self.check(id)
    }

    fn run_revert(&self, id: &str) -> Result<Value, String> {
        let snapshot = self
            .snapshots
            .get(id)
            .ok_or("No hay una copia del estado anterior para este tweak.")?;

        if let Some(def) = self.declarative.get(id) {
            match def.kind {
                TweakKind::Registry => registry::revert(def, &snapshot)?,
                TweakKind::Service => service::revert(def, &snapshot)?,
                TweakKind::Powercfg => powercfg::revert(def, &snapshot)?,
                TweakKind::Feature => feature::revert(def, &snapshot)?,
            }
        } else {
            custom::revert(id, &snapshot)?;
        }

        self.snapshots.delete(id)?;
        self.check(id)
    }

    /// Últimas entradas del historial de apply/revert, para el timeline del Dashboard.
    pub fn history(&self, limit: usize) -> Vec<Value> {
        crate::snapshots::read_history(&self.user_data, limit)
    }

    fn write_log(&self, id: &str, action: &str, outcome: &Result<Value, String>) {
        let name = self
            .meta(id)
            .and_then(|m| m.get("name").and_then(Value::as_str).map(str::to_string))
            .unwrap_or_default();

        let entry = json!({
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "event": action,
            "id": id,
            "name": name,
            "applied": outcome.as_ref().ok().and_then(|s| s.get("applied").and_then(Value::as_bool)),
            "error": outcome.as_ref().err(),
        });
        append_history(&self.user_data, &entry);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// `tweaks.json` se edita a mano (o con scripts puntuales, como cuando se agregaron los 16
    /// tweaks de `feature`) — este test evita que un error de tipeo en un campo rompa el arranque
    /// de la app recién al abrirla.
    #[test]
    fn tweaks_json_parses_and_every_order_id_resolves() {
        let parsed: TweakFile =
            serde_json::from_str(TWEAKS_JSON).expect("tweaks.json debe deserializar sin errores");

        let declarative: HashMap<String, TweakDefinition> = parsed
            .declarative
            .into_iter()
            .map(|def| (def.id.clone(), def))
            .collect();

        for id in &parsed.order {
            let is_declarative = declarative.contains_key(id);
            let is_custom = custom::is_custom(id);
            assert!(
                is_declarative || is_custom,
                "el id '{id}' está en `order` pero no existe ni como tweak declarativo ni como custom"
            );
        }

        for def in declarative.values() {
            match def.kind {
                TweakKind::Registry => {
                    def.registry_targets()
                        .unwrap_or_else(|e| panic!("{}: {e}", def.id));
                }
                TweakKind::Service => {
                    def.service_name().unwrap_or_else(|e| panic!("{}: {e}", def.id));
                }
                TweakKind::Powercfg => {
                    def.powercfg_parts().unwrap_or_else(|e| panic!("{}: {e}", def.id));
                }
                TweakKind::Feature => {
                    def.feature_name().unwrap_or_else(|e| panic!("{}: {e}", def.id));
                }
            }
        }
    }
}
