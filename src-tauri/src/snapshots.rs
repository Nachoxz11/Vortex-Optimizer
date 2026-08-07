//! Persistencia del estado previo de cada tweak.
//!
//! Port de `electron/tweaks/snapshot-store.cjs`. Guarda en `tweak-snapshots.json` dentro del
//! directorio de datos de la app, con escritura atómica (temp + rename) para no corromper el
//! archivo si el proceso muere a mitad de camino.

use serde_json::{Map, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub struct SnapshotStore {
    file: PathBuf,
    data: Mutex<Map<String, Value>>,
}

impl SnapshotStore {
    pub fn new(user_data: &Path) -> Self {
        let file = user_data.join("tweak-snapshots.json");
        let data = fs::read_to_string(&file)
            .ok()
            .and_then(|raw| serde_json::from_str::<Map<String, Value>>(&raw).ok())
            .unwrap_or_default();
        Self {
            file,
            data: Mutex::new(data),
        }
    }

    fn persist(&self, data: &Map<String, Value>) -> Result<(), String> {
        if let Some(dir) = self.file.parent() {
            fs::create_dir_all(dir).map_err(|e| format!("No se pudo crear {dir:?}: {e}"))?;
        }
        let temp = self.file.with_extension("json.tmp");
        let body = serde_json::to_string_pretty(data)
            .map_err(|e| format!("No se pudo serializar las copias de estado: {e}"))?;
        fs::write(&temp, body).map_err(|e| format!("No se pudo escribir {temp:?}: {e}"))?;
        fs::rename(&temp, &self.file).map_err(|e| format!("No se pudo guardar {:?}: {e}", self.file))
    }

    pub fn get(&self, id: &str) -> Option<Value> {
        self.data.lock().ok()?.get(id).cloned()
    }

    pub fn set(&self, id: &str, snapshot: Value) -> Result<(), String> {
        let mut data = self
            .data
            .lock()
            .map_err(|_| "El almacén de copias de estado quedó en un estado inválido.".to_string())?;
        data.insert(id.to_string(), snapshot);
        self.persist(&data)
    }

    pub fn delete(&self, id: &str) -> Result<(), String> {
        let mut data = self
            .data
            .lock()
            .map_err(|_| "El almacén de copias de estado quedó en un estado inválido.".to_string())?;
        data.remove(id);
        self.persist(&data)
    }
}

/// Registra cada apply/revert en un NDJSON, igual que `writeLog` de `manager.cjs`.
pub fn append_history(user_data: &Path, entry: &Value) {
    let file = user_data.join("tweak-history.ndjson");
    if let Some(dir) = file.parent() {
        if fs::create_dir_all(dir).is_err() {
            return;
        }
    }
    use std::io::Write;
    if let Ok(mut handle) = fs::OpenOptions::new().create(true).append(true).open(&file) {
        let _ = writeln!(handle, "{entry}");
    }
}

/// Lee las últimas `limit` entradas del historial de tweaks, más recientes primero.
pub fn read_history(user_data: &Path, limit: usize) -> Vec<Value> {
    let file = user_data.join("tweak-history.ndjson");
    let raw = match fs::read_to_string(&file) {
        Ok(raw) => raw,
        Err(_) => return Vec::new(),
    };
    let mut entries: Vec<Value> = raw
        .lines()
        .filter_map(|line| serde_json::from_str(line).ok())
        .collect();
    entries.reverse();
    entries.truncate(limit);
    entries
}
