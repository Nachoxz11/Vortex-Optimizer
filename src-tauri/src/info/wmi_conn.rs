//! Conexión WMI persistente, una por hilo.
//!
//! COM se inicializa por hilo (`COMLibrary` es explícitamente `!Send` en la crate `wmi`), así que
//! no existe una única conexión global válida para toda la app. En cambio, cada hilo del pool de
//! `spawn_blocking` de Tauri abre su conexión WMI una sola vez y la reutiliza mientras ese hilo
//! siga vivo — sigue cumpliendo el objetivo de "nunca una conexión nueva por consulta": el costo de
//! `CoInitializeEx` + conectar al proveedor CIM se paga una vez por hilo, no una vez por llamada.

use std::cell::RefCell;
use std::collections::HashMap;
use wmi::{COMLibrary, WMIConnection};

thread_local! {
    static DEFAULT: RefCell<Option<WMIConnection>> = const { RefCell::new(None) };
    static NAMESPACED: RefCell<HashMap<String, WMIConnection>> = RefCell::new(HashMap::new());
}

fn open(com: COMLibrary, namespace: Option<&str>) -> Result<WMIConnection, String> {
    match namespace {
        Some(ns) => WMIConnection::with_namespace_path(ns, com)
            .map_err(|e| format!("No se pudo conectar a WMI en {ns}: {e}")),
        None => WMIConnection::new(com).map_err(|e| format!("No se pudo conectar a WMI: {e}")),
    }
}

/// Ejecuta `f` con la conexión WMI del hilo actual al namespace por defecto (`ROOT\CIMV2`).
pub fn with_connection<T>(
    f: impl FnOnce(&WMIConnection) -> Result<T, String>,
) -> Result<T, String> {
    DEFAULT.with(|cell| {
        let mut slot = cell.borrow_mut();
        if slot.is_none() {
            let com = COMLibrary::new().map_err(|e| format!("No se pudo inicializar COM: {e}"))?;
            *slot = Some(open(com, None)?);
        }
        f(slot.as_ref().expect("se acaba de inicializar"))
    })
}

/// Igual que [`with_connection`], pero contra un namespace distinto (p. ej.
/// `ROOT\CIMV2\Security\MicrosoftTpm` o `ROOT\Microsoft\Windows\Defender`). Poco frecuente, así que
/// se cachea aparte por namespace en vez de mezclarse con la conexión por defecto.
pub fn with_connection_at<T>(
    namespace: &str,
    f: impl FnOnce(&WMIConnection) -> Result<T, String>,
) -> Result<T, String> {
    NAMESPACED.with(|cell| {
        let mut map = cell.borrow_mut();
        if !map.contains_key(namespace) {
            let com = COMLibrary::new().map_err(|e| format!("No se pudo inicializar COM: {e}"))?;
            map.insert(namespace.to_string(), open(com, Some(namespace))?);
        }
        f(map.get(namespace).expect("se acaba de insertar"))
    })
}
