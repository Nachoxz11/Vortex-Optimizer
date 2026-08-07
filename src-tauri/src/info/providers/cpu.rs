//! CPU: nombre/núcleos (estático) y % de uso (dinámico), ambos vía `sysinfo`.

use serde::Serialize;
use std::time::Duration;
use sysinfo::System;

use crate::info::cache::{DynamicCache, StaticCache};
use crate::info::provider::{timed, ProviderResult};

#[derive(Debug, Clone, Serialize)]
pub struct CpuStatic {
    pub name: String,
    pub cores: usize,
    pub threads: usize,
    pub max_ghz: f64,
}

static STATIC: StaticCache<CpuStatic> = StaticCache::new();
static USAGE: DynamicCache<f32> = DynamicCache::new();

/// `sys` debe venir de una instancia ya refrescada con datos de CPU (el Background Monitor la
/// mantiene viva); se calcula una sola vez porque el nombre/núcleos no cambian en la sesión.
pub fn static_info(sys: &System) -> ProviderResult<CpuStatic> {
    STATIC.get_or_compute(|| {
        let name = sys
            .cpus()
            .first()
            .map(|cpu| cpu.brand().trim().to_string())
            .filter(|n| !n.is_empty())
            .unwrap_or_else(|| "Unknown CPU".into());
        let max_mhz = sys.cpus().iter().map(|cpu| cpu.frequency()).max().unwrap_or(0);
        Ok(CpuStatic {
            name,
            cores: sys.physical_core_count().unwrap_or_else(|| sys.cpus().len()),
            threads: sys.cpus().len(),
            max_ghz: round1(max_mhz as f64 / 1000.0),
        })
    })
}

/// Llamado por el Background Monitor en el tier de 1s, tras `sys.refresh_cpu_usage()`.
pub fn record_usage(sys: &System) {
    USAGE.set(sys.global_cpu_usage());
}

/// Lectura para los comandos de Tauri. Si el monitor todavía no corrió su primer tick, calcula un
/// valor una sola vez como respaldo (dos muestras separadas 200ms, igual que exige PDH/`sysinfo`
/// para tener una tasa real en la primera lectura).
pub fn usage_percent() -> ProviderResult<f32> {
    USAGE.get_fresh_or_compute(Duration::from_secs(3), || {
        timed("cpu::usage_percent (cold start)", Duration::from_millis(400), || {
            let mut sys = System::new_all();
            sys.refresh_cpu_usage();
            std::thread::sleep(Duration::from_millis(200));
            sys.refresh_cpu_usage();
            Ok(sys.global_cpu_usage())
        })
    })
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}
