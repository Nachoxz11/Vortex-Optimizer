//! Discos: volúmenes lógicos (letra, uso, tipo) vía `sysinfo`; modelo y tamaño del disco físico
//! principal vía WMI `Win32_DiskDrive` (dato estático, se consulta una sola vez).

use serde::Serialize;
use std::time::Duration;
use sysinfo::{Disks, DiskKind};

use crate::info::cache::StaticCache;
use crate::info::pdh;
use crate::info::provider::{timed, ProviderResult};
use crate::info::wmi_conn;

const BYTES_PER_GB: f64 = 1_073_741_824.0;

#[derive(Debug, Clone, Serialize)]
pub struct DriveInfo {
    pub letter: String,
    pub label: String,
    pub model: String,
    pub total: u64,
    pub used: u64,
    #[serde(rename = "type")]
    pub kind: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PrimaryDisk {
    pub model: String,
    pub size_gb: u64,
}

static PRIMARY: StaticCache<PrimaryDisk> = StaticCache::new();

/// Volúmenes locales (unidad `C:`, `D:`...) con su uso. No intenta emparejar cada volumen con el
/// disco físico que lo respalda (algo que la versión PowerShell hacía cruzando `Win32_DiskPartition`)
/// porque `sysinfo` ya resuelve `kind()` (HDD/SSD) por volumen sin ese cruce.
pub fn volumes() -> ProviderResult<Vec<DriveInfo>> {
    timed("disk::volumes", Duration::from_millis(150), || {
        let disks = Disks::new_with_refreshed_list();
        let list = disks
            .list()
            .iter()
            .map(|disk| {
                let total = disk.total_space();
                let used = total.saturating_sub(disk.available_space());
                let letter = disk
                    .mount_point()
                    .to_string_lossy()
                    .trim_end_matches(['\\', '/'])
                    .to_string();
                let label = disk.name().to_string_lossy().into_owned();
                DriveInfo {
                    letter,
                    label: if label.is_empty() { "Local disk".into() } else { label },
                    model: "Local disk".into(),
                    total: (total as f64 / BYTES_PER_GB).round() as u64,
                    used: (used as f64 / BYTES_PER_GB).round() as u64,
                    kind: match disk.kind() {
                        DiskKind::HDD => "HDD",
                        DiskKind::SSD => "SSD",
                        DiskKind::Unknown(_) => "SSD",
                    }
                    .to_string(),
                }
            })
            .collect();
        Ok(list)
    })
}

#[allow(non_camel_case_types, non_snake_case)]
#[derive(serde::Deserialize)]
struct Win32_DiskDrive {
    Model: Option<String>,
    Size: Option<u64>,
}

pub fn primary_disk() -> ProviderResult<PrimaryDisk> {
    PRIMARY.get_or_compute(|| {
        timed("disk::primary_disk", Duration::from_millis(200), || {
            wmi_conn::with_connection(|conn| {
                let drives: Vec<Win32_DiskDrive> = conn
                    .raw_query(
                        "SELECT Model, Size FROM Win32_DiskDrive WHERE Size IS NOT NULL",
                    )
                    .map_err(|e| format!("No se pudo consultar Win32_DiskDrive: {e}"))?;
                let biggest = drives.into_iter().max_by_key(|d| d.Size.unwrap_or(0));
                Ok(match biggest {
                    Some(d) => PrimaryDisk {
                        model: d
                            .Model
                            .map(|m| m.split_whitespace().collect::<Vec<_>>().join(" "))
                            .unwrap_or_else(|| "Unknown drive".into()),
                        size_gb: d.Size.unwrap_or(0) / 1_000_000_000,
                    },
                    None => PrimaryDisk {
                        model: "Unknown drive".into(),
                        size_gb: 0,
                    },
                })
            })
        })
    })
}

/// % de actividad del disco físico, vía el contador PDH `\PhysicalDisk(_Total)\% Disk Time`.
pub fn busy_percent() -> f64 {
    pdh::query_wildcard("\\PhysicalDisk(_Total)\\% Disk Time", 50)
        .ok()
        .and_then(|values| values.first().map(|(_, value)| *value))
        .map(|value| (value * 10.0).round() / 10.0)
        .unwrap_or(0.0)
}
