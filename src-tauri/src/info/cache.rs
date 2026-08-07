//! Cache en dos niveles para datos de sistema.
//!
//! `StaticCache<T>` es para datos que no cambian mientras la app está abierta (CPU, motherboard,
//! BIOS...): se calculan una vez y no se vuelve a golpear al proveedor salvo invalidación explícita.
//! `DynamicCache<T>` es para datos que cambian con el tiempo (uso de CPU, procesos...): el
//! [`super::monitor::BackgroundMonitor`] los actualiza en su propio tick y los comandos de Tauri sólo
//! leen el último valor — nunca disparan un refresh por su cuenta.

use std::sync::Mutex;
use std::time::{Duration, Instant};

pub struct StaticCache<T: Clone> {
    slot: Mutex<Option<T>>,
}

impl<T: Clone> StaticCache<T> {
    pub const fn new() -> Self {
        Self {
            slot: Mutex::new(None),
        }
    }

    /// Devuelve el valor cacheado, o lo calcula con `compute` la primera vez que se pide.
    pub fn get_or_compute(&self, compute: impl FnOnce() -> Result<T, String>) -> Result<T, String> {
        if let Some(value) = self.slot.lock().unwrap().as_ref() {
            return Ok(value.clone());
        }
        let value = compute()?;
        *self.slot.lock().unwrap() = Some(value.clone());
        Ok(value)
    }

    /// Fuerza a recalcular en el próximo `get_or_compute` (p. ej. tras aplicar un tweak que cambia
    /// algo que este proveedor reporta).
    pub fn invalidate(&self) {
        *self.slot.lock().unwrap() = None;
    }
}

impl<T: Clone> Default for StaticCache<T> {
    fn default() -> Self {
        Self::new()
    }
}

pub struct DynamicCache<T: Clone> {
    slot: Mutex<Option<(Instant, T)>>,
}

impl<T: Clone> DynamicCache<T> {
    pub const fn new() -> Self {
        Self {
            slot: Mutex::new(None),
        }
    }

    /// Escribe el valor más reciente. La llama el Background Monitor en cada tick.
    pub fn set(&self, value: T) {
        *self.slot.lock().unwrap() = Some((Instant::now(), value));
    }

    pub fn get(&self) -> Option<T> {
        self.slot.lock().unwrap().as_ref().map(|(_, v)| v.clone())
    }

    /// Devuelve el valor cacheado si es más nuevo que `max_age`. Si no hay valor todavía (el
    /// monitor no corrió su primer tick) o está vencido, lo calcula sincrónicamente como respaldo:
    /// así el primer request tras abrir la app no espera al próximo tick del monitor.
    pub fn get_fresh_or_compute(
        &self,
        max_age: Duration,
        compute: impl FnOnce() -> Result<T, String>,
    ) -> Result<T, String> {
        if let Some((at, value)) = self.slot.lock().unwrap().as_ref() {
            if at.elapsed() < max_age {
                return Ok(value.clone());
            }
        }
        let value = compute()?;
        self.set(value.clone());
        Ok(value)
    }
}

impl<T: Clone> Default for DynamicCache<T> {
    fn default() -> Self {
        Self::new()
    }
}
