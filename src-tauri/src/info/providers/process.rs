//! Lista de procesos con CPU/RAM, vía `sysinfo`. Reemplaza el `Get-Counter '\Process(*)\%
//! Processor Time'` + `Get-Process` de `system::processes` original.

use serde::Serialize;
use std::time::Duration;
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System};

use crate::info::cache::DynamicCache;
use crate::info::provider::ProviderResult;

#[derive(Debug, Clone, Serialize)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
    pub cpu: f32,
    pub ram: u64,
    /// KB leídos + escritos desde el último refresh. `sysinfo` no expone throughput de red por
    /// proceso en Windows sin una sesión ETW propia (mismo límite que tenía la versión PowerShell).
    pub disk: f64,
    /// Siempre `0`: ver la nota de `system::processes` sobre por qué no se atribuye tráfico de red
    /// a un PID puntual sin una sesión ETW/WFP elevada.
    pub net: f64,
    /// Ruta al ejecutable, cuando el proceso lo expone (procesos del sistema o sin permisos
    /// suficientes devuelven `None`). Usado por "Abrir ubicación del archivo" en el menú contextual.
    pub path: Option<String>,
}

static LIST: DynamicCache<Vec<ProcessInfo>> = DynamicCache::new();

fn snapshot_from(sys: &System) -> Vec<ProcessInfo> {
    let mut list: Vec<ProcessInfo> = sys
        .processes()
        .values()
        .filter(|p| p.pid().as_u32() > 0)
        .map(|p| {
            let disk = p.disk_usage();
            ProcessInfo {
                name: p.name().to_string_lossy().into_owned(),
                pid: p.pid().as_u32(),
                cpu: round1(p.cpu_usage()),
                ram: p.memory() / 1_048_576,
                disk: round1_f64((disk.read_bytes + disk.written_bytes) as f64 / 1_048_576.0),
                net: 0.0,
                path: p.exe().map(|path| path.to_string_lossy().into_owned()),
            }
        })
        .collect();
    list.sort_by(|a, b| b.cpu.partial_cmp(&a.cpu).unwrap_or(std::cmp::Ordering::Equal));
    list
}

/// Llamado por el Background Monitor en el tier de 5s.
pub fn record(sys: &System) {
    LIST.set(snapshot_from(sys));
}

pub fn top(limit: usize) -> ProviderResult<Vec<ProcessInfo>> {
    let list = LIST.get_fresh_or_compute(Duration::from_secs(8), || {
        let mut sys = System::new();
        let kind = ProcessRefreshKind::everything();
        sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
        std::thread::sleep(Duration::from_millis(200));
        sys.refresh_processes_specifics(ProcessesToUpdate::All, true, kind);
        Ok(snapshot_from(&sys))
    })?;
    Ok(list.into_iter().take(limit).collect())
}

fn round1(value: f32) -> f32 {
    (value * 10.0).round() / 10.0
}

fn round1_f64(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}
