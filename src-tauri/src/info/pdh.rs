//! Helper compartido para leer contadores de rendimiento de Windows (PDH) con paths de comodín
//! (`\Objeto(*)\Contador`), usado por el proveedor de GPU (uso%) y el de red (throughput). Cada
//! llamada abre una consulta PDH, toma dos muestras separadas por `settle_ms` (PDH necesita dos
//! puntos para calcular una tasa) y la cierra — no hay conexión persistente porque estas consultas
//! son ocasionales (llamadas desde el Background Monitor en su propio tier, no por request de UI).

use std::time::Duration;
use windows::core::PCWSTR;
use windows::Win32::System::Performance::{
    PdhAddEnglishCounterW, PdhCloseQuery, PdhCollectQueryData, PdhGetFormattedCounterArrayW,
    PdhOpenQueryW, PDH_FMT_COUNTERVALUE_ITEM_W, PDH_FMT_DOUBLE, PDH_HCOUNTER, PDH_HQUERY,
};

use crate::info::provider::ProviderResult;

/// Devuelve `(nombre_de_instancia, valor)` para cada instancia que resuelve el path de comodín.
/// Si el contador no existe en este sistema (driver viejo, feature deshabilitada), devuelve una
/// lista vacía en vez de error: el llamador decide el valor por defecto.
pub fn query_wildcard(path: &str, settle_ms: u64) -> ProviderResult<Vec<(String, f64)>> {
    unsafe {
        let mut query = PDH_HQUERY::default();
        check(PdhOpenQueryW(PCWSTR::null(), 0, &mut query), "PdhOpenQueryW")?;

        let wide_path = wide(path);
        let mut counter = PDH_HCOUNTER::default();
        let add_status = PdhAddEnglishCounterW(query, PCWSTR(wide_path.as_ptr()), 0, &mut counter);
        if add_status != 0 {
            let _ = PdhCloseQuery(query);
            return Ok(Vec::new());
        }

        PdhCollectQueryData(query);
        std::thread::sleep(Duration::from_millis(settle_ms));
        if let Err(e) = check(PdhCollectQueryData(query), "PdhCollectQueryData") {
            let _ = PdhCloseQuery(query);
            return Err(e);
        }

        let mut buffer_size = 0u32;
        let mut item_count = 0u32;
        let _ = PdhGetFormattedCounterArrayW(
            counter,
            PDH_FMT_DOUBLE,
            &mut buffer_size,
            &mut item_count,
            None,
        );
        if buffer_size == 0 {
            let _ = PdhCloseQuery(query);
            return Ok(Vec::new());
        }

        let mut buffer: Vec<u8> = vec![0; buffer_size as usize];
        let status = PdhGetFormattedCounterArrayW(
            counter,
            PDH_FMT_DOUBLE,
            &mut buffer_size,
            &mut item_count,
            Some(buffer.as_mut_ptr() as *mut PDH_FMT_COUNTERVALUE_ITEM_W),
        );
        let _ = PdhCloseQuery(query);
        check(status, "PdhGetFormattedCounterArrayW")?;

        let items = std::slice::from_raw_parts(
            buffer.as_ptr() as *const PDH_FMT_COUNTERVALUE_ITEM_W,
            item_count as usize,
        );
        Ok(items
            .iter()
            .map(|item| {
                let name = if item.szName.is_null() {
                    String::new()
                } else {
                    item.szName.to_string().unwrap_or_default()
                };
                (name, item.FmtValue.Anonymous.doubleValue)
            })
            .collect())
    }
}

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

fn check(status: u32, call: &str) -> ProviderResult<()> {
    if status == 0 {
        Ok(())
    } else {
        Err(format!("{call} devolvió el código PDH 0x{status:08X}"))
    }
}
