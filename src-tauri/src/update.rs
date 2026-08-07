use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Serialize)]
pub struct UpdateCheckResult {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub notes: Option<String>,
    pub downloaded: bool,
    pub message: String,
    pub installer_path: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UpdateManifest {
    version: String,
    #[serde(default)]
    url: String,
    #[serde(default)]
    notes: Option<String>,
}

const DEFAULT_UPDATE_MANIFEST_URL: &str = "https://xtweaks-update.vercel.app/api/manifest";

fn manifest_source() -> Option<String> {
    std::env::var("XTWEAKS_UPDATE_MANIFEST_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            std::env::var("XTWEAKS_UPDATE_MANIFEST_PATH")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
        .or_else(|| {
            std::env::var("VITE_UPDATE_MANIFEST_URL")
                .ok()
                .filter(|value| !value.trim().is_empty())
        })
        .or_else(|| Some(DEFAULT_UPDATE_MANIFEST_URL.to_string()))
}

fn compare_versions(current: &str, latest: &str) -> Option<std::cmp::Ordering> {
    let current_parts = parse_version(current)?;
    let latest_parts = parse_version(latest)?;

    let max_len = current_parts.len().max(latest_parts.len());
    for index in 0..max_len {
        let current_value = current_parts.get(index).copied().unwrap_or(0);
        let latest_value = latest_parts.get(index).copied().unwrap_or(0);
        match current_value.cmp(&latest_value) {
            std::cmp::Ordering::Equal => continue,
            other => return Some(other),
        }
    }

    Some(std::cmp::Ordering::Equal)
}

fn parse_version(version: &str) -> Option<Vec<u64>> {
    version
        .split('.')
        .map(|part| part.trim().parse::<u64>().ok())
        .collect()
}

fn download_to_temp(installer_source: &str) -> Result<PathBuf, String> {
    let source_path = if let Some(path) = installer_source.strip_prefix("file://") {
        PathBuf::from(path)
    } else {
        PathBuf::from(installer_source)
    };

    if source_path.exists() {
        let file_name = source_path
            .file_name()
            .and_then(|name| name.to_str())
            .filter(|value| !value.is_empty())
            .unwrap_or("xtweaks-installer.exe");

        let temp_dir = std::env::temp_dir().join("xtweaks-updates");
        fs::create_dir_all(&temp_dir)
            .map_err(|error| format!("No se pudo crear la carpeta temporal: {error}"))?;

        let destination = temp_dir.join(file_name);
        fs::copy(&source_path, &destination)
            .map_err(|error| format!("No se pudo copiar el instalador local: {error}"))?;
        return Ok(destination);
    }

    let response = reqwest::blocking::Client::new()
        .get(installer_source)
        .send()
        .map_err(|error| format!("No se pudo descargar el instalador: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "El servidor devolvió un estado inesperado: {}",
            response.status()
        ));
    }

    let file_name = installer_source
        .rsplit('/')
        .next()
        .filter(|value| !value.is_empty())
        .unwrap_or("xtweaks-installer.exe");

    let temp_dir = std::env::temp_dir().join("xtweaks-updates");
    fs::create_dir_all(&temp_dir)
        .map_err(|error| format!("No se pudo crear la carpeta temporal: {error}"))?;

    let destination = temp_dir.join(file_name);
    let bytes = response
        .bytes()
        .map_err(|error| format!("No se pudieron leer los bytes del instalador: {error}"))?;
    fs::write(&destination, bytes)
        .map_err(|error| format!("No se pudo guardar el instalador en disco: {error}"))?;
    Ok(destination)
}

fn launch_installer(path: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;

        let application = std::env::current_exe()
            .map_err(|error| format!("No se pudo resolver el ejecutable actual: {error}"))?;
        let installer = powershell_literal(path);
        let application = powershell_literal(&application);
        let parent_pid = std::process::id();
        let script = format!(
            "$parent = Get-Process -Id {parent_pid} -ErrorAction SilentlyContinue; if ($parent) {{ $parent.WaitForExit() }}; $setup = Start-Process -FilePath '{installer}' -ArgumentList '/S' -PassThru -Wait; if ($setup.ExitCode -eq 0) {{ Start-Process -FilePath '{application}' }}",
            parent_pid = parent_pid,
            installer = installer,
            application = application,
        );

        Command::new("powershell.exe")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &script])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|error| format!("No se pudo preparar el reinicio automático: {error}"))?;
        Ok(())
    }

    #[cfg(not(windows))]
    {
        Command::new(path)
            .spawn()
            .map_err(|error| format!("No se pudo lanzar el instalador: {error}"))?;
        Ok(())
    }
}

#[cfg(windows)]
fn powershell_literal(path: &Path) -> String {
    path.to_string_lossy().replace('\'', "''")
}

pub fn check_for_updates() -> Result<UpdateCheckResult, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let manifest_source = manifest_source().ok_or_else(|| {
        "No hay un endpoint de actualizaciones configurado. Define XTWEAKS_UPDATE_MANIFEST_URL, XTWEAKS_UPDATE_MANIFEST_PATH o VITE_UPDATE_MANIFEST_URL.".to_string()
    })?;

    let manifest: UpdateManifest = if Path::new(&manifest_source).exists() {
        let text = fs::read_to_string(&manifest_source)
            .map_err(|error| format!("No se pudo leer el manifiesto local: {error}"))?;
        serde_json::from_str(&text)
            .map_err(|error| format!("El manifiesto de actualización no es válido: {error}"))?
    } else if let Some(path) = manifest_source.strip_prefix("file://") {
        let text = fs::read_to_string(path)
            .map_err(|error| format!("No se pudo leer el manifiesto local: {error}"))?;
        serde_json::from_str(&text)
            .map_err(|error| format!("El manifiesto de actualización no es válido: {error}"))?
    } else {
        let response = reqwest::blocking::Client::new()
            .get(&manifest_source)
            .send()
            .map_err(|error| {
                format!("No se pudo contactar al endpoint de actualizaciones: {error}")
            })?;

        if !response.status().is_success() {
            return Err(format!(
                "El endpoint devolvió un error {}.",
                response.status()
            ));
        }

        let text = response
            .text()
            .map_err(|error| format!("No se pudo leer el manifiesto de actualización: {error}"))?;
        serde_json::from_str(&text)
            .map_err(|error| format!("El manifiesto de actualización no es válido: {error}"))?
    };

    if manifest.url.trim().is_empty() {
        return Err("El manifiesto no incluye una URL de descarga válida.".to_string());
    }

    let comparison =
        compare_versions(&current_version, &manifest.version).unwrap_or(std::cmp::Ordering::Equal);

    match comparison {
        std::cmp::Ordering::Greater | std::cmp::Ordering::Equal => Ok(UpdateCheckResult {
            available: false,
            current_version: current_version.clone(),
            latest_version: Some(manifest.version),
            notes: manifest.notes,
            downloaded: false,
            message: "Ya tienes instalada la versión más reciente o una superior.".to_string(),
            installer_path: None,
        }),
        std::cmp::Ordering::Less => {
            let installer_path = download_to_temp(&manifest.url)?;
            launch_installer(&installer_path)?;
            Ok(UpdateCheckResult {
                available: true,
                current_version,
                latest_version: Some(manifest.version),
                notes: manifest.notes,
                downloaded: true,
                message: "Se encontró una actualización nueva y se inició el instalador."
                    .to_string(),
                installer_path: Some(installer_path.to_string_lossy().into_owned()),
            })
        }
    }
}
