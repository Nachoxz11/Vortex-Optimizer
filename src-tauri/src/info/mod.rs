//! Servicio central de información del sistema.
//!
//! Punto único por el que pasa cualquier dato de hardware/SO que la UI necesita. Nada en `system.rs`
//! ni en los comandos de Tauri debería volver a lanzar un script o abrir una conexión WMI por su
//! cuenta: todo pasa por los proveedores de este módulo, cada uno con su propia cache (ver
//! [`cache`]) y, cuando el dato cambia con el tiempo, refrescado por el [`monitor::BackgroundMonitor`]
//! en vez de por el hilo que atiende el comando de Tauri.
//!
//! Agregar un proveedor nuevo es agregar un archivo en `providers/` con sus propias funciones
//! públicas (`static_info()` / `snapshot()` / etc.) y, si su dato es dinámico, sumarlo al tick que
//! corresponda en [`monitor`] — el resto del sistema no se toca (ver nota de diseño en
//! [`provider`] sobre por qué no se fuerza un trait genérico único).

pub mod cache;
pub mod monitor;
pub mod pdh;
pub mod provider;
pub mod providers;
pub mod wmi_conn;

use sysinfo::System;

/// Instancia de una sola vez para leer datos estáticos (CPU/nombre de host) fuera del hilo del
/// Background Monitor. Sólo la usan los `StaticCache` de cada proveedor, así que el costo (uno de
/// los `refresh` más caros de `sysinfo`) se paga una única vez por proceso.
pub fn one_shot_system() -> System {
    System::new_all()
}

/// Arranca el Background Monitor. Se llama una sola vez desde `main.rs`/`setup` de Tauri.
pub fn start_background_monitor() {
    monitor::start();
}
