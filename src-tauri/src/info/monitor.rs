//! Background Monitor: un hilo dedicado que refresca los datos dinámicos en segundo plano, en vez
//! de que cada comando de Tauri dispare su propio cálculo. Los comandos sólo leen las
//! `DynamicCache` que este monitor va llenando — ver [`super::provider`] y [`super::cache`].
//!
//! Tiers (igual a lo pedido): 1s para CPU/RAM/GPU, 5s para procesos, 5 min para apps instaladas.
//! La temperatura queda como hook documentado (ver `temperature_tier`): Windows no expone un
//! sensor de temperatura confiable sin WMI de terceros (LibreHardwareMonitor/OpenHardwareMonitor)
//! o acceso directo a SMBus, así que por ahora no se inventa un valor — se deja para Fase 2.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Once;
use std::time::{Duration, Instant};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, ProcessRefreshKind, ProcessesToUpdate, RefreshKind, System};

use super::providers::{cpu, gpu, memory, process};

static STARTED: Once = Once::new();
static RUNNING: AtomicBool = AtomicBool::new(true);

/// Arranca el monitor una sola vez por proceso (llamado desde `main`/`setup` de Tauri). Es
/// idempotente: una segunda llamada no crea un segundo hilo.
pub fn start() {
    STARTED.call_once(|| {
        std::thread::Builder::new()
            .name("xtweaks-background-monitor".into())
            .spawn(run)
            .expect("no se pudo iniciar el Background Monitor");
    });
}

#[allow(dead_code)]
pub fn stop() {
    RUNNING.store(false, Ordering::Relaxed);
}

fn run() {
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::everything())
            .with_memory(MemoryRefreshKind::everything()),
    );

    let mut last_fast_tick = Instant::now() - Duration::from_secs(1);
    let mut last_process_tick = Instant::now() - Duration::from_secs(5);

    while RUNNING.load(Ordering::Relaxed) {
        let now = Instant::now();

        if now.duration_since(last_fast_tick) >= Duration::from_secs(1) {
            last_fast_tick = now;
            fast_tick(&mut sys);
        }

        if now.duration_since(last_process_tick) >= Duration::from_secs(5) {
            last_process_tick = now;
            process_tick();
        }

        std::thread::sleep(Duration::from_millis(200));
    }
}

/// Tier de 1s: CPU%, RAM, GPU%. Todo lo que las pantallas Dashboard/Monitor piden con polling de
/// 1.5s en el frontend — con esto ya está fresco antes de que lo pidan.
fn fast_tick(sys: &mut System) {
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    cpu::record_usage(sys);
    memory::record(sys);
    gpu::record_usage();
}

/// Tier de 5s: lista de procesos (Monitor.tsx).
fn process_tick() {
    let mut sys = System::new();
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::everything());
    // Igual que antes: dos muestras separadas dan un % de CPU por proceso real, no siempre 0.
    std::thread::sleep(Duration::from_millis(150));
    sys.refresh_processes_specifics(ProcessesToUpdate::All, true, ProcessRefreshKind::everything());
    process::record(&sys);
}
