//! Recorrido de árboles de directorios en Rust puro, paralelizado con `rayon`.
//!
//! Reemplaza tanto el `Get-ChildItem -Recurse` original (lento: arma un `PSObject` completo por
//! archivo) como el walker manual en PowerShell que lo sustituyó (`FAST_WALK_SCRIPT` /
//! `CLEANER_CATEGORY_DEFS` en versiones previas de este archivo) — acá el costo por archivo es sólo
//! el `stat` nativo de `std::fs`, sin arrancar ningún intérprete, y cada subcarpeta se procesa en
//! paralelo en vez de con una pila secuencial. Errores de acceso por carpeta (permisos, symlinks
//! rotos) se ignoran igual que hacía `-ErrorAction SilentlyContinue`: una carpeta protegida no
//! corta el resto del recorrido.

use rayon::prelude::*;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

fn split(root: &Path) -> (Vec<fs::DirEntry>, Vec<PathBuf>) {
    let Ok(read) = fs::read_dir(root) else {
        return (Vec::new(), Vec::new());
    };
    let mut files = Vec::new();
    let mut dirs = Vec::new();
    for entry in read.flatten() {
        match entry.file_type() {
            Ok(ft) if ft.is_dir() => dirs.push(entry.path()),
            Ok(ft) if ft.is_file() => files.push(entry),
            _ => {}
        }
    }
    (files, dirs)
}

/// Suma en bytes de todos los archivos bajo `root`.
pub fn measure_size_bytes(root: &Path) -> u64 {
    measure_size_and_count(root).0
}

/// Igual que [`measure_size_bytes`] pero además cuenta los archivos, en un solo recorrido (usado
/// por el limpiador, que necesita ambos números).
pub fn measure_size_and_count(root: &Path) -> (u64, u64) {
    let (files, dirs) = split(root);
    let (files_size, files_count) = files.iter().filter_map(|f| f.metadata().ok()).fold((0u64, 0u64), |(size, count), m| {
        (size + m.len(), count + 1)
    });
    let (subdirs_size, subdirs_count) = dirs
        .par_iter()
        .map(|dir| measure_size_and_count(dir))
        .reduce(|| (0u64, 0u64), |(sa, ca), (sb, cb)| (sa + sb, ca + cb));
    (files_size + subdirs_size, files_count + subdirs_count)
}

#[derive(Debug, Clone)]
pub struct FoundFile {
    pub path: PathBuf,
    pub size_bytes: u64,
    pub modified: Option<SystemTime>,
}

/// Todos los archivos bajo `root` con tamaño >= `min_bytes`.
pub fn find_large_files(root: &Path, min_bytes: u64) -> Vec<FoundFile> {
    let (files, dirs) = split(root);
    let mut found: Vec<FoundFile> = files
        .iter()
        .filter_map(|f| {
            let meta = f.metadata().ok()?;
            (meta.len() >= min_bytes).then(|| FoundFile {
                path: f.path(),
                size_bytes: meta.len(),
                modified: meta.modified().ok(),
            })
        })
        .collect();
    let mut nested: Vec<FoundFile> = dirs.par_iter().flat_map(|dir| find_large_files(dir, min_bytes)).collect();
    found.append(&mut nested);
    found
}

#[derive(Debug, Clone, Copy, Default)]
pub struct RemovalStats {
    pub freed_bytes: u64,
    pub removed: u64,
    pub errors: u64,
}

impl RemovalStats {
    fn merge(mut self, other: Self) -> Self {
        self.freed_bytes += other.freed_bytes;
        self.removed += other.removed;
        self.errors += other.errors;
        self
    }
}

/// Borra todos los archivos bajo `root` (no borra las carpetas vacías que quedan atrás, igual que
/// la versión PowerShell original).
pub fn remove_all_files(root: &Path) -> RemovalStats {
    let (files, dirs) = split(root);
    let direct = files.iter().fold(RemovalStats::default(), |mut stats, f| {
        let len = f.metadata().map(|m| m.len()).unwrap_or(0);
        match fs::remove_file(f.path()) {
            Ok(()) => {
                stats.freed_bytes += len;
                stats.removed += 1;
            }
            Err(_) => stats.errors += 1,
        }
        stats
    });
    dirs.par_iter()
        .map(|dir| remove_all_files(dir))
        .reduce(RemovalStats::default, RemovalStats::merge)
        .merge(direct)
}
