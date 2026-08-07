//! Captura de frame pacing mediante PresentMon.
//! PresentMon consume eventos ETW de presentación de Windows y emite CSV por stdout.

use serde::Serialize;
use std::collections::VecDeque;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;

const MAX_SAMPLES: usize = 2400;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameSample {
    pub timestamp_ms: f64,
    pub frame_time_ms: f64,
    pub fps: f64,
    pub application: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameStats {
    pub running: bool,
    pub application: Option<String>,
    pub samples: Vec<FrameSample>,
    pub average_fps: Option<f64>,
    pub average_frame_time_ms: Option<f64>,
    pub p95_frame_time_ms: Option<f64>,
}

struct Session {
    child: Child,
    samples: Arc<Mutex<VecDeque<FrameSample>>>,
    application: Option<String>,
}

#[derive(Clone, Default)]
pub struct PresentMonState {
    session: Arc<Mutex<Option<Session>>>,
}

impl PresentMonState {
    pub fn start(&self, resource_dir: &Path, application: Option<&str>) -> Result<(), String> {
        self.stop()?;
        let executable = resource_dir.join("tools").join("PresentMon-2.5.1-x64.exe");
        if !executable.is_file() {
            return Err(format!(
                "No se encontró PresentMon en {}",
                executable.display()
            ));
        }

        let mut command = Command::new(&executable);
        command
            .current_dir(executable.parent().unwrap_or(resource_dir))
            .arg("--output_stdout")
            .arg("--no_console_stats")
            .arg("--v2_metrics")
            .arg("--exclude_dropped")
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        if let Some(name) = application.map(str::trim).filter(|name| !name.is_empty()) {
            command.arg("--process_name").arg(name);
        }

        let mut child = command
            .spawn()
            .map_err(|error| format!("No se pudo iniciar PresentMon: {error}"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "PresentMon no abrió su salida CSV".to_owned())?;
        let samples = Arc::new(Mutex::new(VecDeque::with_capacity(MAX_SAMPLES)));
        let sink = Arc::clone(&samples);
        thread::Builder::new()
            .name("presentmon-csv-reader".into())
            .spawn(move || {
                let mut headers: Vec<String> = Vec::new();
                for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                    if line.trim().is_empty() {
                        continue;
                    }
                    if headers.is_empty() {
                        headers = parse_csv_line(&line)
                            .into_iter()
                            .map(|header| header.trim().to_ascii_lowercase())
                            .collect();
                        continue;
                    }
                    if let Some(sample) = parse_sample(&headers, &line) {
                        if let Ok(mut buffer) = sink.lock() {
                            if buffer.len() == MAX_SAMPLES {
                                buffer.pop_front();
                            }
                            buffer.push_back(sample);
                        }
                    }
                }
            })
            .map_err(|error| format!("No se pudo iniciar el lector de PresentMon: {error}"))?;

        let mut guard = self
            .session
            .lock()
            .map_err(|_| "Estado de PresentMon bloqueado".to_owned())?;
        *guard = Some(Session {
            child,
            samples,
            application: application.map(str::to_owned),
        });
        Ok(())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut guard = self
            .session
            .lock()
            .map_err(|_| "Estado de PresentMon bloqueado".to_owned())?;
        if let Some(mut session) = guard.take() {
            let _ = session.child.kill();
            let _ = session.child.wait();
        }
        Ok(())
    }

    pub fn stats(&self) -> Result<FrameStats, String> {
        let guard = self
            .session
            .lock()
            .map_err(|_| "Estado de PresentMon bloqueado".to_owned())?;
        let Some(session) = guard.as_ref() else {
            return Ok(FrameStats {
                running: false,
                application: None,
                samples: Vec::new(),
                average_fps: None,
                average_frame_time_ms: None,
                p95_frame_time_ms: None,
            });
        };
        let samples: Vec<FrameSample> = session
            .samples
            .lock()
            .map_err(|_| "Muestras de PresentMon bloqueadas".to_owned())?
            .iter()
            .cloned()
            .collect();
        let mut frame_times: Vec<f64> = samples
            .iter()
            .map(|sample| sample.frame_time_ms)
            .filter(|value| value.is_finite() && *value > 0.0)
            .collect();
        frame_times.sort_by(f64::total_cmp);
        let average_frame_time_ms = average(&frame_times);
        let average_fps = average_frame_time_ms.map(|value| 1000.0 / value);
        let p95_frame_time_ms = frame_times
            .get((frame_times.len().saturating_sub(1) * 95) / 100)
            .copied();
        Ok(FrameStats {
            running: true,
            application: session.application.clone(),
            samples,
            average_fps,
            average_frame_time_ms,
            p95_frame_time_ms,
        })
    }
}

fn average(values: &[f64]) -> Option<f64> {
    (!values.is_empty()).then(|| values.iter().sum::<f64>() / values.len() as f64)
}

fn parse_sample(headers: &[String], line: &str) -> Option<FrameSample> {
    let fields = parse_csv_line(line);
    let get = |names: &[&str]| {
        names.iter().find_map(|name| {
            headers
                .iter()
                .position(|header| header == *name)
                .and_then(|index| fields.get(index))
                .cloned()
        })
    };
    let timestamp_ms = get(&["timeinseconds", "qpc_time_ms", "cpu_start_time"])?
        .parse::<f64>()
        .ok()
        .map(|value| {
            if value < 100000.0 {
                value * 1000.0
            } else {
                value
            }
        })?;
    let frame_time_ms = get(&[
        "msbetweenpresents",
        "msbetweendisplaychange",
        "msbetween_display_change",
    ])?
    .parse::<f64>()
    .ok()?;
    if frame_time_ms <= 0.0 || !frame_time_ms.is_finite() {
        return None;
    }
    let application = get(&["application", "process_name"]).unwrap_or_else(|| "Unknown".into());
    Some(FrameSample {
        timestamp_ms,
        frame_time_ms,
        fps: 1000.0 / frame_time_ms,
        application,
    })
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut current = String::new();
    let mut quoted = false;
    for character in line.chars() {
        match character {
            '"' => quoted = !quoted,
            ',' if !quoted => {
                values.push(current.trim().to_owned());
                current.clear();
            }
            _ => current.push(character),
        }
    }
    values.push(current.trim().to_owned());
    values
}
