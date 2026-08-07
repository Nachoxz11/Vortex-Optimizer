//! Ejecución de PowerShell.
//!
//! Port de `electron/system/run-powershell.cjs` y de los helpers `runPowerShell` /
//! `runPowerShellElevated` de `electron/tweaks/registry-module.cjs`. Los scripts se pasan
//! codificados en UTF-16LE + base64 (`-EncodedCommand`) para no depender del quoting del shell.

use base64::engine::general_purpose::STANDARD;
use base64::Engine;
use std::io::{BufRead, BufReader, Write};
use std::os::windows::process::CommandExt;
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, OnceLock};

/// Evita que aparezca una ventana de consola al lanzar powershell.exe.
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub type PsResult<T> = Result<T, String>;

fn encode_command(script: &str) -> String {
    let utf16: Vec<u8> = script
        .encode_utf16()
        .flat_map(|unit| unit.to_le_bytes())
        .collect();
    STANDARD.encode(utf16)
}

struct PowerShellWorker {
    child: Child,
    stdin: ChildStdin,
    stdout: BufReader<ChildStdout>,
}

enum ExecutionError {
    Script(String),
    Transport(String),
}

impl PowerShellWorker {
    fn spawn() -> PsResult<Self> {
        let mut child = Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                "-",
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            // Los errores de cada script viajan por el protocolo de stdout. No mantener un pipe
            // de stderr evita bloquear el worker si PowerShell escribe diagnósticos adicionales.
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("No se pudo iniciar PowerShell: {e}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "PowerShell no expuso su entrada estándar".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "PowerShell no expuso su salida estándar".to_string())?;

        Ok(Self {
            child,
            stdin,
            stdout: BufReader::new(stdout),
        })
    }

    fn is_running(&mut self) -> PsResult<bool> {
        self.child
            .try_wait()
            .map(|status| status.is_none())
            .map_err(|e| format!("No se pudo consultar el estado de PowerShell: {e}"))
    }

    fn execute(&mut self, script: &str, marker: &str) -> Result<String, ExecutionError> {
        let encoded = encode_command(script);
        let command = format!(
            "$ErrorActionPreference='Stop';try{{$s=[Text.Encoding]::Unicode.GetString([Convert]::FromBase64String('{encoded}'));& ([ScriptBlock]::Create($s));[Console]::Out.WriteLine();[Console]::Out.WriteLine('{marker}|OK|')}}catch{{$m=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.Message));[Console]::Out.WriteLine();[Console]::Out.WriteLine('{marker}|ERR|'+$m)}}\n"
        );

        self.stdin
            .write_all(command.as_bytes())
            .and_then(|_| self.stdin.flush())
            .map_err(|e| {
                ExecutionError::Transport(format!(
                    "No se pudo enviar el script a PowerShell: {e}"
                ))
            })?;

        let mut output = String::new();
        let control_prefix = format!("{marker}|");
        loop {
            let mut line = String::new();
            let bytes = self.stdout.read_line(&mut line).map_err(|e| {
                ExecutionError::Transport(format!(
                    "No se pudo leer la salida de PowerShell: {e}"
                ))
            })?;
            if bytes == 0 {
                return Err(ExecutionError::Transport(
                    "PowerShell terminó antes de completar el script".into(),
                ));
            }

            let trimmed = line.trim_end_matches(['\r', '\n']);
            if let Some(control) = trimmed.strip_prefix(&control_prefix) {
                if control == "OK|" {
                    return Ok(output.trim().to_string());
                }
                if let Some(message) = control.strip_prefix("ERR|") {
                    let decoded = STANDARD
                        .decode(message)
                        .ok()
                        .and_then(|bytes| String::from_utf8(bytes).ok())
                        .filter(|message| !message.trim().is_empty())
                        .unwrap_or_else(|| "PowerShell devolvió un error sin descripción.".into());
                    return Err(ExecutionError::Script(clean_error(decoded.trim())));
                }
            }

            output.push_str(&line);
        }
    }

    fn stop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

static WORKER: OnceLock<Mutex<Option<PowerShellWorker>>> = OnceLock::new();
static REQUEST_ID: AtomicU64 = AtomicU64::new(1);

fn worker() -> &'static Mutex<Option<PowerShellWorker>> {
    WORKER.get_or_init(|| Mutex::new(None))
}

/// Ejecuta un script y devuelve su stdout recortado. Bloquea el hilo actual.
pub fn run(script: &str) -> PsResult<String> {
    let mut worker_slot = worker()
        .lock()
        .map_err(|_| "El worker de PowerShell quedó en un estado inválido".to_string())?;

    let running = match worker_slot.as_mut() {
        Some(worker) => match worker.is_running() {
            Ok(running) => Some(running),
            Err(message) => {
                if let Some(mut broken_worker) = worker_slot.take() {
                    broken_worker.stop();
                }
                return Err(message);
            }
        },
        None => None,
    };
    let must_spawn = !running.unwrap_or(false);
    if must_spawn {
        if let Some(mut stale_worker) = worker_slot.take() {
            stale_worker.stop();
        }
        *worker_slot = Some(PowerShellWorker::spawn()?);
    }

    let marker = format!(
        "__XTWEAKS_PS_{}_{}__",
        std::process::id(),
        REQUEST_ID.fetch_add(1, Ordering::Relaxed)
    );
    let result = worker_slot
        .as_mut()
        .expect("el worker se inicializó antes de ejecutar")
        .execute(script, &marker);

    match result {
        Ok(output) => Ok(output),
        Err(ExecutionError::Script(message)) => Err(message),
        Err(ExecutionError::Transport(message)) => {
            if let Some(mut broken_worker) = worker_slot.take() {
                broken_worker.stop();
            }
            Err(message)
        }
    }
}

/// Extrae el mensaje legible de un stderr de PowerShell.
///
/// Con `-EncodedCommand`, PowerShell serializa los errores como CLIXML; volcarlo crudo en la UI
/// es ilegible. Nos quedamos con los nodos `<S S="Error">` y descartamos el rastro de la pila.
fn clean_error(stderr: &str) -> String {
    if !stderr.starts_with("#< CLIXML") {
        return stderr.to_string();
    }

    let mut parts = Vec::new();
    for segment in stderr.split(r#"<S S="Error">"#).skip(1) {
        let Some(end) = segment.find("</S>") else {
            continue;
        };
        let text = segment[..end]
            .replace("_x000D_", "")
            .replace("_x000A_", "")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .replace("&amp;", "&");
        let text = text.trim();

        // A partir del eco del script (`+ ...`) sólo viene ruido de diagnóstico.
        if text.starts_with('+') || text.starts_with("En línea:") || text.is_empty() {
            break;
        }
        parts.push(text.to_string());
    }

    if parts.is_empty() {
        "PowerShell devolvió un error sin descripción.".into()
    } else {
        parts.join(" ")
    }
}

/// Relanza el script con UAC (`Start-Process -Verb RunAs`) y espera a que termine.
pub fn run_elevated(script: &str) -> PsResult<String> {
    let encoded = encode_command(script);
    let launcher = format!(
        r#"
$process = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -Verb RunAs -Wait -PassThru -ArgumentList @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', '{encoded}')
if ($process.ExitCode -ne 0) {{ exit $process.ExitCode }}
"#
    );
    run(&launcher)
}

/// Eleva un ejecutable nativo directo (`reg.exe`, `powercfg.exe`, ...) con UAC, sin pasar por un
/// PowerShell elevado intermedio. La app sigue sin necesitar un manifiesto de administrador: el
/// worker persistente (no elevado) sólo actúa como lanzador de `Start-Process -Verb RunAs`, y lo
/// único que corre elevado es el binario nativo en sí, no un intérprete de scripts.
pub fn run_elevated_exe(exe: &str, args: &[String]) -> PsResult<()> {
    let arg_list = args
        .iter()
        .map(|a| format!("'{}'", escape_single_quotes(a)))
        .collect::<Vec<_>>()
        .join(", ");
    let launcher = format!(
        r#"
$process = Start-Process -FilePath '{exe}' -WindowStyle Hidden -Verb RunAs -Wait -PassThru -ArgumentList @({arg_list})
if ($process.ExitCode -ne 0) {{ exit $process.ExitCode }}
"#,
        exe = escape_single_quotes(exe)
    );
    run(&launcher)?;
    Ok(())
}

/// Extrae el primer objeto o arreglo JSON del stdout, ignorando ruido previo (warnings, etc.).
pub fn parse_json(stdout: &str) -> PsResult<serde_json::Value> {
    let obj = stdout.find('{');
    let arr = stdout.find('[');
    let start = match (obj, arr) {
        (None, None) => return Err("PowerShell no devolvió una salida JSON".into()),
        (Some(o), None) => o,
        (None, Some(a)) => a,
        (Some(o), Some(a)) => o.min(a),
    };
    serde_json::from_str(&stdout[start..])
        .map_err(|e| format!("No se pudo interpretar la salida de PowerShell: {e}"))
}

/// Ejecuta un script y parsea su salida como JSON.
pub fn run_json(script: &str) -> PsResult<serde_json::Value> {
    parse_json(&run(script)?)
}

/// Igual que [`run_json`], pero devuelve `{}` cuando no hay JSON en la salida.
///
/// Replica el `runScript` de `quick-actions.cjs`, que tolera scripts sin salida.
pub fn run_json_lenient(script: &str) -> PsResult<serde_json::Value> {
    let stdout = run(script)?;
    Ok(parse_json(&stdout).unwrap_or_else(|_| serde_json::json!({})))
}

/// Normaliza a arreglo: `ConvertTo-Json` colapsa las listas de un solo elemento en un objeto.
pub fn as_array(value: serde_json::Value) -> Vec<serde_json::Value> {
    match value {
        serde_json::Value::Array(items) => items,
        serde_json::Value::Null => Vec::new(),
        other => vec![other],
    }
}

/// Escapa comillas simples para interpolar dentro de un literal de PowerShell.
pub fn escape_single_quotes(value: &str) -> String {
    value.replace('\'', "''")
}

/// Script que crea un punto de restauración antes de un cambio con riesgo.
pub fn restore_point_script(description: &str) -> String {
    format!(
        "try {{ Checkpoint-Computer -Description '{}' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop }} catch {{ Write-Warning $_.Exception.Message }}",
        escape_single_quotes(description)
    )
}

/// Codifica un valor JSON para reinyectarlo en un script vía base64 (evita problemas de quoting).
pub fn encode_json_payload(value: &serde_json::Value) -> String {
    STANDARD.encode(value.to_string().as_bytes())
}

/// Cache en memoria con expiración, para no relanzar `powershell.exe` (y sus consultas CIM o
/// recorridos de disco) cuando varias pantallas piden el mismo dato casi al mismo tiempo, o cuando
/// se vuelve a montar una pantalla que ya se consultó hace unos segundos.
pub mod cache {
    use serde_json::Value;
    use std::collections::HashMap;
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant};

    static STORE: OnceLock<Mutex<HashMap<String, (Instant, Value)>>> = OnceLock::new();

    fn store() -> &'static Mutex<HashMap<String, (Instant, Value)>> {
        STORE.get_or_init(|| Mutex::new(HashMap::new()))
    }

    /// Devuelve el valor cacheado para `key` si todavía no expiró, o lo calcula con `compute`,
    /// lo guarda y lo devuelve.
    pub fn get_or_compute<F>(key: &str, ttl: Duration, compute: F) -> Result<Value, String>
    where
        F: FnOnce() -> Result<Value, String>,
    {
        if let Some(value) = store()
            .lock()
            .unwrap()
            .get(key)
            .filter(|(t, _)| t.elapsed() < ttl)
            .map(|(_, v)| v.clone())
        {
            return Ok(value);
        }

        let value = compute()?;
        store()
            .lock()
            .unwrap()
            .insert(key.to_string(), (Instant::now(), value.clone()));
        Ok(value)
    }
}
