//! Vortex-Optimizer — proceso principal.
//!
//! Port de `electron/main.cjs`: crea la ventana y expone los mismos canales IPC que tenía el
//! preload de Electron, ahora como comandos de Tauri.

pub mod fs_walk;
pub mod info;
pub mod powershell;
pub mod presentmon;
pub mod profile;
pub mod quick_actions;
pub mod recycle_bin;
pub mod snapshots;
pub mod system;
pub mod tweaks;
pub mod update;

use serde_json::Value;
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State, WebviewWindow,
};

use tweaks::TweakManager;

struct AppState {
    tweaks: Arc<TweakManager>,
    presentmon: presentmon::PresentMonState,
}

/// Ejecuta trabajo bloqueante (PowerShell) fuera del hilo del runtime.
async fn blocking<T, F>(task: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|e| format!("La tarea no pudo completarse: {e}"))?
}

// ------------------------------------------------------------------ ventana

#[tauri::command]
fn window_minimize(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_toggle_maximize(window: WebviewWindow) -> Result<bool, String> {
    let maximized = window.is_maximized().map_err(|e| e.to_string())?;
    if maximized {
        window.unmaximize().map_err(|e| e.to_string())?;
    } else {
        window.maximize().map_err(|e| e.to_string())?;
    }
    window.is_maximized().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_close(window: WebviewWindow) -> Result<(), String> {
    // Cerrar la ventana la deja ejecutándose en segundo plano.
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
fn window_is_maximized(window: WebviewWindow) -> Result<bool, String> {
    window.is_maximized().map_err(|e| e.to_string())
}

// ------------------------------------------------------------------- tweaks

#[tauri::command]
async fn tweaks_list(state: State<'_, AppState>) -> Result<Vec<Value>, String> {
    let manager = state.tweaks.clone();
    blocking(move || Ok(manager.list())).await
}

#[tauri::command]
async fn tweaks_change(
    state: State<'_, AppState>,
    id: String,
    action: String,
) -> Result<Value, String> {
    let manager = state.tweaks.clone();
    blocking(move || manager.change(&id, &action)).await
}

// ------------------------------------------------------------------ sistema

#[tauri::command]
async fn system_info() -> Result<Value, String> {
    blocking(system::info).await
}

#[tauri::command]
async fn system_metrics() -> Result<Value, String> {
    blocking(system::metrics).await
}

#[tauri::command]
async fn system_processes(limit: Option<u32>) -> Result<Vec<Value>, String> {
    blocking(move || system::processes(limit.unwrap_or(20))).await
}

#[tauri::command]
async fn system_startup() -> Result<Vec<Value>, String> {
    blocking(system::startup_items).await
}

#[tauri::command]
async fn system_startup_set(
    hive: String,
    location: String,
    approved_name: String,
    enabled: bool,
) -> Result<Value, String> {
    blocking(move || system::set_startup_state(&hive, &location, &approved_name, enabled)).await
}

#[tauri::command]
async fn system_apps() -> Result<Vec<Value>, String> {
    blocking(system::installed_apps).await
}

#[tauri::command]
async fn system_uninstall_app(app: system::AppUninstallInfo) -> Result<Value, String> {
    blocking(move || system::uninstall_app(&app)).await
}

#[tauri::command]
async fn system_repair_app(app: system::AppUninstallInfo) -> Result<Value, String> {
    blocking(move || system::repair_app(&app)).await
}

#[tauri::command]
async fn system_drives() -> Result<Vec<Value>, String> {
    blocking(system::drives).await
}

#[tauri::command]
async fn system_network_adapters() -> Result<Vec<Value>, String> {
    blocking(system::network_adapters).await
}

#[tauri::command]
async fn system_network_metrics() -> Result<Value, String> {
    blocking(system::network_metrics).await
}

#[tauri::command]
async fn system_set_dns_servers(
    adapter: String,
    primary: String,
    secondary: Option<String>,
) -> Result<Value, String> {
    blocking(move || system::set_dns_servers(&adapter, &primary, secondary.as_deref())).await
}

#[tauri::command]
async fn system_reset_dns_servers(adapter: String) -> Result<Value, String> {
    blocking(move || system::reset_dns_servers(&adapter)).await
}

#[tauri::command]
async fn system_set_network_settings(
    adapter: String,
    mtu: u32,
    qos_percent: u32,
) -> Result<Value, String> {
    blocking(move || system::set_network_settings(&adapter, mtu, qos_percent)).await
}

#[tauri::command]
async fn system_storage_breakdown(drive: Option<String>) -> Result<Vec<Value>, String> {
    blocking(move || system::storage_breakdown(drive.as_deref().unwrap_or("C:"))).await
}

#[tauri::command]
async fn system_large_files(
    drive: Option<String>,
    min_size_gb: Option<f64>,
    limit: Option<u32>,
) -> Result<Vec<Value>, String> {
    blocking(move || {
        system::large_files(
            drive.as_deref().unwrap_or("C:"),
            min_size_gb.unwrap_or(1.0),
            limit.unwrap_or(15),
        )
    })
    .await
}

#[tauri::command]
async fn system_cleaner_scan() -> Result<Vec<Value>, String> {
    blocking(system::cleaner_scan).await
}

#[tauri::command]
async fn system_cleaner_clean(ids: Vec<String>) -> Result<Value, String> {
    blocking(move || system::cleaner_clean(&ids)).await
}

#[tauri::command]
async fn system_delete_file(path: String) -> Result<Value, String> {
    blocking(move || system::delete_file(&path)).await
}

#[tauri::command]
async fn system_kill_process(pid: u32) -> Result<Value, String> {
    blocking(move || system::kill_process(pid)).await
}

#[tauri::command]
async fn system_open_file_location(path: String) -> Result<Value, String> {
    blocking(move || system::open_file_location(&path)).await
}

#[tauri::command]
async fn system_set_process_priority(pid: u32, priority: String) -> Result<Value, String> {
    blocking(move || system::set_process_priority(pid, &priority)).await
}

#[tauri::command]
async fn system_set_process_affinity(pid: u32, cores: Vec<u32>) -> Result<Value, String> {
    blocking(move || system::set_process_affinity(pid, &cores)).await
}

#[tauri::command]
async fn system_history(
    state: State<'_, AppState>,
    limit: Option<u32>,
) -> Result<Vec<Value>, String> {
    let manager = state.tweaks.clone();
    blocking(move || Ok(manager.history(limit.unwrap_or(40) as usize))).await
}

#[tauri::command]
async fn system_dns_benchmark() -> Result<Value, String> {
    blocking(system::dns_benchmark).await
}

#[tauri::command]
async fn system_startup_remove_entry(
    hive: String,
    location: String,
    name: String,
    command: Option<String>,
) -> Result<Value, String> {
    blocking(move || system::startup_remove_entry(&hive, &location, &name, command.as_deref()))
        .await
}

#[tauri::command]
async fn system_restore_list() -> Result<Vec<Value>, String> {
    blocking(system::restore_list).await
}

#[tauri::command]
async fn system_restore_create(description: String) -> Result<Value, String> {
    blocking(move || system::restore_create(&description)).await
}

#[tauri::command]
async fn system_restore_apply(sequence_number: i64) -> Result<Value, String> {
    blocking(move || system::restore_apply(sequence_number)).await
}

#[tauri::command]
async fn system_export_profile(state: State<'_, AppState>) -> Result<Value, String> {
    let manager = state.tweaks.clone();
    blocking(move || profile::export_profile(&manager)).await
}

#[tauri::command]
async fn system_import_profile(
    state: State<'_, AppState>,
    entries: Vec<profile::ProfileEntry>,
) -> Result<Value, String> {
    let manager = state.tweaks.clone();
    blocking(move || Ok(profile::import_profile(&manager, &entries))).await
}

#[tauri::command]
async fn system_open_reset_wizard() -> Result<(), String> {
    blocking(profile::open_reset_wizard).await
}

#[tauri::command]
async fn system_rebuild_shader_cache() -> Result<Value, String> {
    blocking(system::rebuild_shader_cache).await
}

#[tauri::command]
async fn system_duplicate_candidates(max_groups: Option<u32>) -> Result<Value, String> {
    blocking(move || system::duplicate_candidates(max_groups.unwrap_or(50) as usize)).await
}

#[tauri::command]
async fn system_deep_clean(mode: String) -> Result<Value, String> {
    blocking(move || system::deep_clean(&mode)).await
}

#[tauri::command]
async fn system_optional_features() -> Result<Value, String> {
    blocking(system::optional_features).await
}

#[tauri::command]
async fn system_optional_feature_change(id: String, enabled: bool) -> Result<Value, String> {
    blocking(move || system::optional_feature_change(&id, enabled)).await
}

#[tauri::command]
async fn system_msi_devices() -> Result<Value, String> {
    blocking(system::msi_devices).await
}

#[tauri::command]
async fn system_timer_resolution_get() -> Result<Value, String> {
    blocking(system::timer_resolution_get).await
}

#[tauri::command]
async fn system_timer_resolution_set(enabled: bool) -> Result<Value, String> {
    blocking(move || system::timer_resolution_set(enabled)).await
}

#[tauri::command]
async fn system_start_with_windows_get() -> Result<Value, String> {
    blocking(system::start_with_windows_get).await
}

#[tauri::command]
async fn system_start_with_windows_set(enabled: bool) -> Result<Value, String> {
    blocking(move || system::start_with_windows_set(enabled)).await
}

#[tauri::command]
async fn system_steam_games() -> Result<Vec<Value>, String> {
    blocking(system::steam_games).await
}

#[tauri::command]
async fn system_speed_test(provider: Option<String>) -> Result<Value, String> {
    blocking(move || system::speed_test(provider.as_deref().unwrap_or("cloudflare"))).await
}

#[tauri::command]
async fn system_presentmon_start(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    application: Option<String>,
) -> Result<Value, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| error.to_string())?;
    let monitor = state.presentmon.clone();
    blocking(move || {
        monitor.start(&resource_dir, application.as_deref())?;
        Ok(serde_json::json!({ "running": true }))
    })
    .await
}

#[tauri::command]
async fn system_presentmon_stop(state: State<'_, AppState>) -> Result<Value, String> {
    let monitor = state.presentmon.clone();
    blocking(move || {
        monitor.stop()?;
        Ok(serde_json::json!({ "running": false }))
    })
    .await
}

#[tauri::command]
async fn system_presentmon_stats(state: State<'_, AppState>) -> Result<Value, String> {
    let monitor = state.presentmon.clone();
    blocking(move || serde_json::to_value(monitor.stats()?).map_err(|error| error.to_string()))
        .await
}

#[tauri::command]
async fn system_ookla_speed_test(app: tauri::AppHandle) -> Result<Value, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|error| format!("No se pudo resolver la carpeta de recursos: {error}"))?;
    blocking(move || system::ookla_speed_test(&resource_dir)).await
}

#[tauri::command]
async fn tools_open(app: tauri::AppHandle, file_name: String) -> Result<Value, String> {
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("No se pudo resolver la carpeta de recursos: {e}"))?;
    blocking(move || system::open_tool(&resource_dir, &file_name)).await
}

#[tauri::command]
async fn app_check_for_updates() -> Result<update::UpdateCheckResult, String> {
    blocking(update::check_for_updates).await
}

#[tauri::command]
fn open_in_browser(url: String) -> Result<(), String> {
    #[cfg(windows)]
    {
        use windows::core::PCWSTR;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

        // ShellExecute delegates http/https URLs to the user's default browser
        // without letting cmd.exe or Explorer parse query-string separators.
        let wide_url: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
        let result = unsafe {
            ShellExecuteW(
                None,
                PCWSTR::null(),
                PCWSTR(wide_url.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };
        if result.0 as usize <= 32 {
            return Err(format!(
                "No se pudo abrir la URL en el navegador (código {})",
                result.0 as usize
            ));
        }
    }
    #[cfg(not(windows))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .or_else(|_| std::process::Command::new("open").arg(&url).spawn())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ----------------------------------------------------------------- oauth

/// Creates the PayPal order through the native client so the packaged WebView
/// does not depend on browser CORS rules.
#[tauri::command]
fn paypal_create_order(access_token: String) -> Result<String, String> {
    let response = reqwest::blocking::Client::new()
        .post("https://xtweaks-update.vercel.app/api/paypal/createOrder")
        .bearer_auth(access_token)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body("{}")
        .send()
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let body = response.text().map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(body);
    }
    let payload: serde_json::Value =
        serde_json::from_str(&body).map_err(|error| error.to_string())?;
    payload
        .get("approvalUrl")
        .and_then(serde_json::Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| "PayPal no devolvió una URL de aprobación".to_owned())
}

/// Levanta un servidor HTTP local que recibe el redirect de Supabase tras el login OAuth
/// (Google, Discord, ...) en el navegador del sistema y reenvía el fragmento de la URL
/// (con los tokens de sesión) al frontend vía el evento `oauth-session`.
#[tauri::command]
async fn start_auth_server(app: tauri::AppHandle) -> Result<(), String> {
    use std::io::{Read, Write};
    use std::net::TcpListener;

    std::thread::spawn(move || {
        let listener = match TcpListener::bind("127.0.0.1:14251") {
            Ok(l) => l,
            Err(_) => return,
        };

        for stream in listener.incoming() {
            let mut stream = match stream {
                Ok(s) => s,
                Err(_) => continue,
            };

            let mut buffer = [0; 4096];
            let bytes_read = match stream.read(&mut buffer) {
                Ok(b) => b,
                Err(_) => continue,
            };

            let request = String::from_utf8_lossy(&buffer[..bytes_read]);

            if request.starts_with("GET / ") || request.starts_with("GET /?") {
                let html = r#"<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vortex-Optimizer · Autenticación</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    background: radial-gradient(circle at 50% -10%, rgba(126, 255, 0, .12), transparent 36%), #080a09;
    color: #f4f4f5;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; margin: 0; padding: 24px;
  }
  .card {
    width: min(440px, 100%);
    background: linear-gradient(145deg, rgba(25, 31, 25, .94), rgba(14, 17, 15, .98));
    border: 1px solid rgba(160, 255, 70, .22);
    padding: 42px 36px 34px;
    border-radius: 24px;
    text-align: center;
    box-shadow: 0 28px 90px -24px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,.025) inset;
    animation: pop 0.35s cubic-bezier(.16,1,.3,1);
  }
  @keyframes pop { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: none; } }
  .mark {
    width: 72px; height: 72px; margin: 0 auto 22px;
    border-radius: 20px;
    background: radial-gradient(circle at 40% 35%, #d8ff72, #7cff00 35%, #285400 75%);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 10px 30px -6px rgba(126,255,0,.48);
    position: relative; overflow: hidden;
  }
  .mark::before, .mark::after { content: ''; position: absolute; border: 5px solid rgba(238,255,210,.9); border-left-color: transparent; border-bottom-color: transparent; border-radius: 50%; transform: rotate(35deg); }
  .mark::before { width: 44px; height: 44px; }
  .mark::after { width: 27px; height: 27px; transform: rotate(215deg); border-width: 4px; }
  .status { width: 46px; height: 46px; margin: 0 auto 20px; position: relative; }
  .spinner {
    width: 100%; height: 100%; border-radius: 50%;
    border: 3px solid rgba(255,255,255,0.1);
    border-top-color: #60a5fa;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .icon-circle {
    width: 100%; height: 100%; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    animation: pop 0.3s cubic-bezier(.16,1,.3,1);
  }
  .icon-circle.success { background: rgba(34,197,122,0.15); color: #22c07a; }
  .icon-circle.error { background: rgba(239,68,68,0.15); color: #ef4444; }
  .icon-circle svg { width: 20px; height: 20px; }
  h2 { margin: 0 0 8px; font-size: 22px; font-weight: 700; letter-spacing: -0.03em; }
  p { margin: 0 auto; max-width: 300px; font-size: 14px; line-height: 1.6; color: #a9b1a6; }
  .brand { margin-top: 28px; font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: #6f8067; }
  .hint { margin-top: 18px; font-size: 11px; color: #697565; }
</style>
</head>
<body>
  <div class="card">
    <div class="mark" aria-label="Vortex Optimizer"></div>
    <div class="status" id="status"><div class="spinner"></div></div>
    <h2 id="title">Autenticando con Vortex-Optimizer…</h2>
    <p id="message">Esperá un momento mientras conectamos con la app.</p>
    <p class="hint" id="hint">La pestaña se cerrará automáticamente.</p>
    <div class="brand">Vortex-Optimizer</div>
  </div>
  <script>
    const statusEl = document.getElementById('status');
    const titleEl = document.getElementById('title');
    const messageEl = document.getElementById('message');

    function setState(kind, title, message) {
      titleEl.textContent = title;
      messageEl.textContent = message;
      if (kind === 'success') {
        statusEl.innerHTML = '<div class="icon-circle success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></div>';
      } else if (kind === 'error') {
        statusEl.innerHTML = '<div class="icon-circle error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg></div>';
      }
    }

    const hash = window.location.hash;
    if (hash) {
      fetch('/token?hash=' + encodeURIComponent(hash))
        .then(() => {
          setState('success', '¡Sesión iniciada!', 'Tu cuenta fue verificada correctamente. Ya podés volver a Vortex Optimizer.');
          setTimeout(() => window.close(), 1200);
        })
        .catch((err) => {
          setState('error', 'No se pudo iniciar sesión', err.message || 'Ocurrió un error inesperado. Volvé a intentarlo desde la app.');
        });
    } else {
      setState('error', 'Enlace no válido', 'Este enlace de autenticación no tiene la información esperada.');
    }
  </script>
</body>
</html>"#;
                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    html.len(),
                    html
                );
                let _ = stream.write_all(response.as_bytes());
            } else if request.contains("GET /token?hash=") {
                if let Some(start) = request.find("GET /token?hash=") {
                    let rest = &request[start + 16..];
                    if let Some(end) = rest.find(' ') {
                        let encoded_hash = &rest[..end];
                        let decoded = encoded_hash
                            .replace("%23", "#")
                            .replace("%3D", "=")
                            .replace("%26", "&");
                        let _ = app.emit("oauth-session", decoded);
                    }
                }
                let response = "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n";
                let _ = stream.write_all(response.as_bytes());
                break;
            }
        }
    });
    Ok(())
}

// ---------------------------------------------------------- acciones rápidas

#[tauri::command]
async fn actions_run(state: State<'_, AppState>, id: String) -> Result<Value, String> {
    let manager = state.tweaks.clone();
    blocking(move || quick_actions::run(&id, &manager)).await
}

// --------------------------------------------------------------------- setup

/// Aplica el material Mica de Windows 11 para que el fondo del sistema se vea a través del shell.
fn apply_backdrop(window: &WebviewWindow) {
    #[cfg(windows)]
    if let Err(error) = window_vibrancy::apply_mica(window, None) {
        // Mica sólo existe en Windows 11: en versiones previas queda el fondo opaco del tema.
        eprintln!("No se pudo aplicar Mica: {error}");
    }
    #[cfg(not(windows))]
    let _ = window;
}

/// Reenvía maximize/unmaximize al frontend, igual que el canal `window:state` de Electron.
fn forward_window_state(window: &WebviewWindow) {
    let handle = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::Resized(_) = event {
            if let Ok(maximized) = handle.is_maximized() {
                let _ = handle.emit("window:state", maximized);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .setup(|app| {
            info::start_background_monitor();
            let user_data = app.path().app_data_dir()?;
            let manager = TweakManager::new(&user_data)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
            app.manage(AppState {
                tweaks: Arc::new(manager),
                presentmon: presentmon::PresentMonState::default(),
            });

            if let Some(window) = app.get_webview_window("main") {
                apply_backdrop(&window);
                forward_window_state(&window);
                let close_window = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = close_window.hide();
                    }
                });

                window.show()?;
            }

            let open =
                MenuItem::with_id(app, "open", "Abrir Vortex Optimizer", true, None::<&str>)?;
            let exit = MenuItem::with_id(app, "exit", "Salir completamente", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &exit])?;
            let icon = app.default_window_icon().cloned().ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "No se encontró el icono de Vortex",
                )
            })?;
            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "exit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window_minimize,
            window_toggle_maximize,
            window_close,
            window_is_maximized,
            paypal_create_order,
            tweaks_list,
            tweaks_change,
            system_info,
            system_metrics,
            system_processes,
            system_startup,
            system_startup_set,
            system_apps,
            system_uninstall_app,
            system_repair_app,
            system_drives,
            system_network_adapters,
            system_network_metrics,
            system_set_dns_servers,
            system_reset_dns_servers,
            system_set_network_settings,
            system_storage_breakdown,
            system_large_files,
            system_cleaner_scan,
            system_cleaner_clean,
            system_history,
            system_delete_file,
            system_kill_process,
            system_open_file_location,
            system_set_process_priority,
            system_set_process_affinity,
            system_dns_benchmark,
            system_startup_remove_entry,
            system_restore_list,
            system_restore_create,
            system_restore_apply,
            system_export_profile,
            system_import_profile,
            system_open_reset_wizard,
            system_rebuild_shader_cache,
            system_duplicate_candidates,
            system_deep_clean,
            system_optional_features,
            system_optional_feature_change,
            system_msi_devices,
            system_timer_resolution_get,
            system_timer_resolution_set,
            system_start_with_windows_get,
            system_start_with_windows_set,
            system_speed_test,
            system_ookla_speed_test,
            system_presentmon_start,
            system_presentmon_stop,
            system_presentmon_stats,
            tools_open,
            system_steam_games,
            app_check_for_updates,
            open_in_browser,
            start_auth_server,
            actions_run,
        ])
        .run(tauri::generate_context!())
        .expect("Vortex-Optimizer no pudo iniciarse");
}
