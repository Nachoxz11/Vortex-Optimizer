//! Motherboard y BIOS: sólo WMI tiene esta información sin parsear tablas SMBIOS a mano
//! (`Win32_BaseBoard`, `Win32_BIOS`). Estático, se cachea para toda la sesión.

use serde::Serialize;
use std::time::Duration;

use crate::info::cache::StaticCache;
use crate::info::provider::{timed, ProviderResult};
use crate::info::wmi_conn;

#[derive(Debug, Clone, Serialize)]
pub struct MotherboardInfo {
    pub board: String,
}

static STATIC: StaticCache<MotherboardInfo> = StaticCache::new();

#[allow(non_camel_case_types, non_snake_case)]
#[derive(serde::Deserialize)]
struct Win32_BaseBoard {
    Manufacturer: Option<String>,
    Product: Option<String>,
}

pub fn static_info() -> ProviderResult<MotherboardInfo> {
    STATIC.get_or_compute(|| {
        timed("motherboard::static_info", Duration::from_millis(200), || {
            wmi_conn::with_connection(|conn| {
                let boards: Vec<Win32_BaseBoard> = conn
                    .raw_query("SELECT Manufacturer, Product FROM Win32_BaseBoard")
                    .map_err(|e| format!("No se pudo consultar Win32_BaseBoard: {e}"))?;
                let board = boards.into_iter().next().and_then(|b| match (b.Manufacturer, b.Product) {
                    (Some(m), Some(p)) if !m.trim().is_empty() && !p.trim().is_empty() => {
                        Some(format!("{} {}", m.trim(), p.trim()))
                    }
                    _ => None,
                });
                Ok(MotherboardInfo {
                    board: board.unwrap_or_else(|| "Unknown motherboard".into()),
                })
            })
        })
    })
}
