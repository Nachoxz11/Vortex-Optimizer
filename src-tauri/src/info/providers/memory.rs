//! RAM: total instalada (estático) y uso actual (dinámico), vía `sysinfo`.

use serde::Serialize;
use std::time::Duration;
use sysinfo::System;

use crate::info::cache::{DynamicCache, StaticCache};
use crate::info::provider::{timed, ProviderResult};
use crate::info::wmi_conn;

const BYTES_PER_GB: f64 = 1_073_741_824.0;

#[derive(Debug, Clone, Serialize)]
pub struct MemorySnapshot {
    pub total_gb: f64,
    pub used_gb: f64,
    pub used_percent: f64,
}

static SNAPSHOT: DynamicCache<MemorySnapshot> = DynamicCache::new();

fn build(total: u64, used: u64) -> MemorySnapshot {
    MemorySnapshot {
        total_gb: round1(total as f64 / BYTES_PER_GB),
        used_gb: round1(used as f64 / BYTES_PER_GB),
        used_percent: if total > 0 {
            round1(used as f64 / total as f64 * 100.0)
        } else {
            0.0
        },
    }
}

/// Llamado por el Background Monitor en el tier de 1s, tras `sys.refresh_memory()`.
pub fn record(sys: &System) {
    SNAPSHOT.set(build(sys.total_memory(), sys.used_memory()));
}

pub fn snapshot() -> ProviderResult<MemorySnapshot> {
    SNAPSHOT.get_fresh_or_compute(Duration::from_secs(3), || {
        let mut sys = System::new_all();
        sys.refresh_memory();
        Ok(build(sys.total_memory(), sys.used_memory()))
    })
}

#[allow(non_camel_case_types, non_snake_case)]
#[derive(serde::Deserialize)]
struct Win32_PhysicalMemory {
    Capacity: Option<u64>,
}

static MODULES: StaticCache<String> = StaticCache::new();

/// `"16 + 16"` (GB por módulo instalado). Sólo WMI expone la capacidad por pastilla de RAM; se
/// consulta una única vez porque la configuración física no cambia en la sesión.
pub fn module_layout() -> ProviderResult<String> {
    MODULES.get_or_compute(|| {
        timed("memory::module_layout", Duration::from_millis(200), || {
            wmi_conn::with_connection(|conn| {
                let modules: Vec<Win32_PhysicalMemory> = conn
                    .raw_query("SELECT Capacity FROM Win32_PhysicalMemory")
                    .map_err(|e| format!("No se pudo consultar Win32_PhysicalMemory: {e}"))?;
                let sizes: Vec<String> = modules
                    .into_iter()
                    .filter_map(|m| m.Capacity)
                    .map(|c| (c / 1_073_741_824).to_string())
                    .collect();
                Ok(sizes.join(" + "))
            })
        })
    })
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}
