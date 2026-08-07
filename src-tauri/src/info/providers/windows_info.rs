//! Edición/versión/build de Windows y nombre de equipo: todo esto vive en el Registro o lo expone
//! `sysinfo`, sin necesidad de WMI ni PowerShell.

use serde::Serialize;
use std::time::Duration;
use sysinfo::System;
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;

use crate::info::cache::StaticCache;
use crate::info::provider::{timed, ProviderResult};

const CURRENT_VERSION_KEY: &str = r"SOFTWARE\Microsoft\Windows NT\CurrentVersion";

#[derive(Debug, Clone, Serialize)]
pub struct WindowsInfo {
    pub device: String,
    pub edition: String,
    pub version: String,
    pub build: String,
    pub install: String,
}

static STATIC: StaticCache<WindowsInfo> = StaticCache::new();

pub fn static_info() -> ProviderResult<WindowsInfo> {
    STATIC.get_or_compute(|| {
        timed("windows_info::static_info", Duration::from_millis(50), || {
            let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
            let key = hklm
                .open_subkey(CURRENT_VERSION_KEY)
                .map_err(|e| format!("No se pudo leer {CURRENT_VERSION_KEY}: {e}"))?;

            let product_name: String = key.get_value("ProductName").unwrap_or_else(|_| "Windows".into());
            let display_version: Option<String> = key.get_value("DisplayVersion").ok();
            let release_id: Option<String> = key.get_value("ReleaseId").ok();
            let build: String = key
                .get_value("CurrentBuildNumber")
                .unwrap_or_else(|_| "0".into());
            let edition = windows_edition(&product_name, &build);
            let install = key
                .get_value::<u32, _>("InstallDate")
                .ok()
                .and_then(format_install_date)
                .unwrap_or_default();

            Ok(WindowsInfo {
                device: System::host_name().unwrap_or_else(|| "This PC".into()),
                edition,
                version: display_version.or(release_id).unwrap_or_else(|| "Unknown".into()),
                build,
                install,
            })
        })
    })
}

/// Windows 11 conserva en algunas instalaciones un `ProductName` heredado de
/// Windows 10. El build es la señal estable para distinguir ambas versiones.
fn windows_edition(product_name: &str, build: &str) -> String {
    let is_windows_11 = build.parse::<u32>().map(|value| value >= 22_000).unwrap_or(false);
    if is_windows_11 {
        product_name.replace("Windows 10", "Windows 11")
    } else {
        product_name.to_owned()
    }
}

pub fn uptime_label() -> String {
    let seconds = System::uptime();
    let days = seconds / 86_400;
    let hours = (seconds % 86_400) / 3_600;
    let minutes = (seconds % 3_600) / 60;
    if days > 0 {
        format!("{days} d {hours:02} h {minutes:02} m")
    } else {
        format!("{hours:02} h {minutes:02} m")
    }
}

fn format_install_date(epoch_seconds: u32) -> Option<String> {
    chrono::DateTime::from_timestamp(epoch_seconds as i64, 0).map(|dt| dt.format("%B %-d, %Y").to_string())
}
