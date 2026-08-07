//! Contrato y utilidades comunes a todos los proveedores de [`super::InformationService`].
//!
//! No se fuerza un trait genérico único (`dyn Provider<Output = ...>`) porque cada proveedor
//! devuelve una forma de dato completamente distinta (CPU, GPU, discos...) y en Rust eso obliga a
//! elegir entre "object safety" con `Any`/downcasting o generics que igual terminan resueltos a
//! mano en `InformationService`. Con un puñado fijo de proveedores conocidos, cada uno como un
//! módulo con su propia cache y funciones públicas (`static_info()`, `usage()`, ...) da el mismo
//! desacople real — `InformationService` sólo depende de esa firma pública — sin la ceremonia de
//! un registro dinámico que nadie va a llenar en runtime.

use std::time::{Duration, Instant};

pub type ProviderResult<T> = Result<T, String>;

/// Con qué frecuencia tiene sentido recalcular el dato de un proveedor.
#[derive(Debug, Clone, Copy)]
pub enum Tier {
    /// Se calcula una vez por apertura de la app.
    Static,
    /// Se recalcula en el tick del Background Monitor con este intervalo.
    Dynamic(Duration),
}

/// Ejecuta `compute`, mide cuánto tarda y deja un registro estructurado (nivel según resultado y
/// duración). `slow_after` es el umbral a partir del cual una llamada se marca como lenta.
pub fn timed<T>(
    provider: &str,
    slow_after: Duration,
    compute: impl FnOnce() -> ProviderResult<T>,
) -> ProviderResult<T> {
    let start = Instant::now();
    let result = compute();
    let elapsed = start.elapsed();
    match &result {
        Ok(_) if elapsed > slow_after => {
            tracing::warn!(provider, ?elapsed, "refresh más lento de lo esperado");
        }
        Ok(_) => {
            tracing::debug!(provider, ?elapsed, "refresh ok");
        }
        Err(error) => {
            tracing::error!(provider, ?elapsed, %error, "refresh falló");
        }
    }
    result
}
