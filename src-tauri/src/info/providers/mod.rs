//! Un módulo por fuente de datos. Ver la nota de diseño en [`super::provider`] sobre por qué cada
//! uno es un conjunto de funciones públicas propias en vez de una implementación de un trait común.

pub mod cpu;
pub mod disk;
pub mod gpu;
pub mod memory;
pub mod motherboard;
pub mod network;
pub mod process;
pub mod windows_info;
