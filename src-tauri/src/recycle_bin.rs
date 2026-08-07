//! Papelera de reciclaje vía Shell API nativa (`SHQueryRecycleBinW`/`SHEmptyRecycleBinW`), en vez
//! de automatizar `Shell.Application` por COM desde PowerShell. `SHQueryRecycleBinW` ya devuelve el
//! tamaño total y la cantidad de elementos en una sola llamada — no hace falta enumerar item por
//! item como hacía el script original.

use windows::core::PCWSTR;
use windows::Win32::UI::Shell::{SHEmptyRecycleBinW, SHQueryRecycleBinW, SHERB_NOCONFIRMATION, SHERB_NOSOUND, SHQUERYRBINFO};

pub struct RecycleBinInfo {
    pub size_bytes: i64,
    pub item_count: i64,
}

pub fn query() -> RecycleBinInfo {
    let mut info = SHQUERYRBINFO {
        cbSize: std::mem::size_of::<SHQUERYRBINFO>() as u32,
        ..Default::default()
    };
    // `None` como root path consulta todas las papeleras (una por unidad).
    let ok = unsafe { SHQueryRecycleBinW(PCWSTR::null(), &mut info) }.is_ok();
    if ok {
        RecycleBinInfo {
            size_bytes: info.i64Size,
            item_count: info.i64NumItems,
        }
    } else {
        RecycleBinInfo { size_bytes: 0, item_count: 0 }
    }
}

/// Vacía la papelera de todas las unidades. Devuelve `(bytes_liberados, items_borrados)` medidos
/// antes de vaciar (después de vaciar ya no se puede leer el tamaño anterior).
pub fn empty() -> Result<(i64, i64), String> {
    let before = query();
    unsafe {
        SHEmptyRecycleBinW(None, PCWSTR::null(), SHERB_NOCONFIRMATION | SHERB_NOSOUND)
            .map_err(|e| format!("No se pudo vaciar la papelera de reciclaje: {e}"))?;
    }
    Ok((before.size_bytes, before.item_count))
}
