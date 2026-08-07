//! Adaptadores de red (enumeración vía `sysinfo`) y métricas en vivo (throughput vía PDH, latencia
//! vía un connect TCP directo, DNS vía Registro) — sin WMI ni PowerShell.

use serde::Serialize;
use std::net::TcpStream;
use std::time::{Duration, Instant};
use sysinfo::Networks;
use winreg::enums::HKEY_LOCAL_MACHINE;
use winreg::RegKey;

use crate::info::pdh;
use crate::info::provider::{timed, ProviderResult};

#[derive(Debug, Clone, Serialize)]
pub struct NetworkAdapter {
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub status: String,
    pub speed: String,
    pub ip: String,
    pub mac: String,
    pub primary: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct NetworkMetrics {
    pub latency: f64,
    pub download: f64,
    pub loss: f64,
    pub jitter: f64,
    #[serde(rename = "dnsPrimary")]
    pub dns_primary: String,
    #[serde(rename = "dnsSecondary")]
    pub dns_secondary: String,
}

/// Enumeración de interfaces con IP/MAC. `sysinfo` no expone velocidad de enlace ni si el
/// adaptador está deshabilitado (eso requeriría la API IP Helper, prevista como próximo proveedor);
/// se reporta `"—"` para velocidad y se infiere el estado a partir de si tiene una IP asignada.
pub fn adapters() -> ProviderResult<Vec<NetworkAdapter>> {
    timed("network::adapters", Duration::from_millis(150), || {
        let networks = Networks::new_with_refreshed_list();
        let mut result: Vec<NetworkAdapter> = networks
            .iter()
            .filter(|(name, _)| !is_virtual(name))
            .map(|(name, data)| {
                let ip = data
                    .ip_networks()
                    .iter()
                    .find(|net| net.addr.is_ipv4())
                    .map(|net| net.addr.to_string())
                    .unwrap_or_else(|| "—".into());
                let connected = ip != "—";
                NetworkAdapter {
                    name: name.clone(),
                    kind: if is_wireless(name) { "Wireless".into() } else { "Ethernet".into() },
                    status: if connected { "Connected".into() } else { "Disabled".into() },
                    speed: "—".into(),
                    ip,
                    mac: data.mac_address().to_string(),
                    primary: connected,
                }
            })
            .collect();

        if !result.iter().any(|a| a.primary) {
            if let Some(first) = result.first_mut() {
                first.primary = true;
            }
        }
        Ok(result)
    })
}

fn is_virtual(name: &str) -> bool {
    let lower = name.to_lowercase();
    ["vethernet", "loopback", "virtual", "hyper-v", "wsl", "tap", "isatap", "teredo"]
        .iter()
        .any(|needle| lower.contains(needle))
}

fn is_wireless(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.contains("wi-fi") || lower.contains("wifi") || lower.contains("wireless") || lower.contains("802.11")
}

/// Métricas en vivo para la pantalla de Network (polling cada 2s del frontend). Se calcula
/// sincrónicamente en cada llamada porque es, por naturaleza, una medición puntual — igual que
/// hacía el script de PowerShell original — pero ahora sin arrancar ningún intérprete.
pub fn metrics() -> ProviderResult<NetworkMetrics> {
    timed("network::metrics", Duration::from_millis(500), || {
        let (latency, jitter, loss) = measure_latency();
        let download = download_mbps();
        let (dns_primary, dns_secondary) = dns_servers();
        Ok(NetworkMetrics {
            latency,
            download,
            loss,
            jitter,
            dns_primary,
            dns_secondary,
        })
    })
}

/// Cuatro connects TCP cortos al puerto 443 de un host bien conocido, igual de liviano que el
/// `Test-Connection` original pero sin depender de ICMP (que en Windows requiere privilegios que
/// esta app no tiene por defecto).
fn measure_latency() -> (f64, f64, f64) {
    const ATTEMPTS: u32 = 4;
    let mut samples = Vec::with_capacity(ATTEMPTS as usize);
    for _ in 0..ATTEMPTS {
        let start = Instant::now();
        if TcpStream::connect_timeout(&"1.1.1.1:443".parse().unwrap(), Duration::from_secs(1)).is_ok() {
            samples.push(start.elapsed().as_secs_f64() * 1000.0);
        }
    }
    if samples.is_empty() {
        return (0.0, 0.0, 100.0);
    }
    let avg = samples.iter().sum::<f64>() / samples.len() as f64;
    let jitter = samples.iter().cloned().fold(f64::MIN, f64::max)
        - samples.iter().cloned().fold(f64::MAX, f64::min);
    let loss = (1.0 - samples.len() as f64 / ATTEMPTS as f64) * 100.0;
    (round1(avg), round1(jitter), round1(loss))
}

pub fn download_mbps() -> f64 {
    let values = pdh::query_wildcard("\\Network Interface(*)\\Bytes Total/sec", 200).unwrap_or_default();
    let total_bytes_per_sec: f64 = values
        .iter()
        .filter(|(name, _)| !is_virtual(name))
        .map(|(_, value)| *value)
        .sum();
    round1(total_bytes_per_sec * 8.0 / 1_048_576.0)
}

fn dns_servers() -> (String, String) {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let Ok(interfaces) = hklm.open_subkey(
        r"SYSTEM\CurrentControlSet\Services\Tcpip\Parameters\Interfaces",
    ) else {
        return ("Automatic".into(), "—".into());
    };

    for name in interfaces.enum_keys().flatten() {
        let Ok(iface) = interfaces.open_subkey(&name) else { continue };
        let raw: Option<String> = iface
            .get_value("NameServer")
            .ok()
            .filter(|v: &String| !v.is_empty())
            .or_else(|| iface.get_value("DhcpNameServer").ok().filter(|v: &String| !v.is_empty()));
        if let Some(raw) = raw {
            let mut servers = raw.split([',', ' ']).filter(|s| !s.is_empty());
            let primary = servers.next().unwrap_or("Automatic").to_string();
            let secondary = servers.next().unwrap_or("—").to_string();
            return (primary, secondary);
        }
    }
    ("Automatic".into(), "—".into())
}

fn round1(value: f64) -> f64 {
    (value * 10.0).round() / 10.0
}
