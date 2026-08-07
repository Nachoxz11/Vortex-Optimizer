//! GPU: nombre + VRAM dedicada por DXGI (estático, prioridad #6 de la lista de APIs), uso% por PDH
//! (dinámico, prioridad #7). Ninguna de las dos consultas pasa por WMI ni PowerShell.

use serde::Serialize;
use std::time::Duration;
use windows::Win32::Graphics::Dxgi::{
    CreateDXGIFactory1, IDXGIFactory1, DXGI_ADAPTER_FLAG_SOFTWARE,
};

use crate::info::cache::{DynamicCache, StaticCache};
use crate::info::pdh;
use crate::info::provider::{timed, ProviderResult};

#[derive(Debug, Clone, Serialize)]
pub struct GpuInfo {
    pub name: String,
    pub vram_gb: f64,
    pub has_dedicated_gpu: bool,
}

static STATIC: StaticCache<GpuInfo> = StaticCache::new();
static USAGE: DynamicCache<f32> = DynamicCache::new();

pub fn static_info() -> ProviderResult<GpuInfo> {
    STATIC.get_or_compute(|| timed("gpu::static_info", Duration::from_millis(200), detect))
}

/// Enumera adaptadores DXGI y se queda con el primero que no sea de software (equivalente al
/// filtro `-notmatch 'Microsoft Basic|Remote'` del script de PowerShell original).
fn detect() -> ProviderResult<GpuInfo> {
    unsafe {
        let factory: IDXGIFactory1 =
            CreateDXGIFactory1().map_err(|e| format!("No se pudo crear el factory de DXGI: {e}"))?;

        let mut index = 0u32;
        loop {
            let adapter = match factory.EnumAdapters1(index) {
                Ok(adapter) => adapter,
                Err(_) => break,
            };
            index += 1;

            let desc = adapter
                .GetDesc1()
                .map_err(|e| format!("No se pudo leer la descripción del adaptador: {e}"))?;
            if (desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE.0 as u32) != 0 {
                continue;
            }

            let end = desc
                .Description
                .iter()
                .position(|&c| c == 0)
                .unwrap_or(desc.Description.len());
            let name = String::from_utf16_lossy(&desc.Description[..end]);
            if name.trim().is_empty() {
                continue;
            }

            return Ok(GpuInfo {
                name,
                vram_gb: (desc.DedicatedVideoMemory as f64 / 1_073_741_824.0 * 10.0).round() / 10.0,
                has_dedicated_gpu: true,
            });
        }

        Ok(GpuInfo {
            name: "No dedicated GPU detected".into(),
            vram_gb: 0.0,
            has_dedicated_gpu: false,
        })
    }
}

fn measure_usage() -> ProviderResult<f32> {
    let values = pdh::query_wildcard("\\GPU Engine(*)\\Utilization Percentage", 50)?;
    let max = values.iter().map(|(_, value)| *value).fold(0.0_f64, f64::max);
    Ok(((max * 10.0).round() / 10.0) as f32)
}

/// Llamado por el Background Monitor en el tier de 1s. Usa el contador PDH
/// `\GPU Engine(*)\Utilization Percentage`, tomando el máximo entre todas las instancias (motor
/// 3D, copy, video decode...) — igual criterio que usaba `Measure-Object -Maximum` en la versión
/// PowerShell. Si el sistema no expone el contador (drivers WDDM viejos), guarda `0.0`.
pub fn record_usage() {
    match timed("gpu::usage_percent", Duration::from_millis(300), measure_usage) {
        Ok(value) => USAGE.set(value),
        Err(error) => tracing::debug!(%error, "no se pudo medir el uso de GPU"),
    }
}

pub fn usage_percent() -> ProviderResult<f32> {
    USAGE.get_fresh_or_compute(Duration::from_secs(3), measure_usage)
}
