//! Verifica el port contra el sistema real.
//!
//! Todo lo que se ejercita acá es de solo lectura: se consulta el estado, nunca se aplica ni se
//! revierte un tweak. El objetivo es detectar scripts de PowerShell mal transcriptos, que es el
//! riesgo principal de la migración desde Electron.

use serde_json::Value;
use xtweaks_lib::{system, tweaks::TweakManager};

fn manager() -> TweakManager {
    TweakManager::new(&std::env::temp_dir().join("xtweaks-tests"))
        .expect("las definiciones embebidas deberían cargar")
}

#[test]
fn carga_todas_las_definiciones() {
    let entries = manager().list();
    assert_eq!(entries.len(), 87, "se esperaban 87 tweaks");

    let ids: std::collections::HashSet<_> = entries
        .iter()
        .filter_map(|e| e.get("id").and_then(Value::as_str))
        .collect();
    assert_eq!(ids.len(), 87, "hay ids duplicados");
}

#[test]
fn cada_tweak_reporta_estado_sin_romperse() {
    let entries = manager().list();

    // Cada entrada debe traer metadatos completos y un `applied` booleano.
    for entry in &entries {
        let id = entry.get("id").and_then(Value::as_str).unwrap_or("?");
        for field in ["id", "name", "category", "risk", "description"] {
            assert!(
                entry.get(field).and_then(Value::as_str).is_some(),
                "{id}: falta el campo {field}"
            );
        }
        assert!(
            entry.get("applied").and_then(Value::as_bool).is_some(),
            "{id}: `applied` no es booleano"
        );
    }

    // Un script mal transcripto se manifiesta como `error` en la entrada. Toleramos fallos
    // puntuales por permisos, pero no una caída generalizada.
    let failed: Vec<_> = entries
        .iter()
        .filter_map(|e| {
            e.get("error")
                .and_then(Value::as_str)
                .map(|err| format!("{}: {err}", e.get("id").and_then(Value::as_str).unwrap_or("?")))
        })
        .collect();

    assert!(
        failed.len() < 10,
        "demasiados tweaks fallaron al consultarse ({}):\n{}",
        failed.len(),
        failed.join("\n")
    );

    if !failed.is_empty() {
        eprintln!("tweaks con error ({}):\n{}", failed.len(), failed.join("\n"));
    }
}

#[test]
fn system_info_devuelve_datos_reales() {
    let info = system::info().expect("system::info falló");

    for field in ["device", "user", "userProfile", "edition", "version", "build", "cpu", "uptime"] {
        let value = info.get(field).and_then(Value::as_str).unwrap_or("");
        assert!(!value.is_empty(), "info.{field} vino vacío");
    }

    let health = info.get("health").and_then(Value::as_i64).unwrap_or(0);
    assert!((40..=100).contains(&health), "health fuera de rango: {health}");

    let total_ram = info.get("ramTotalGB").and_then(Value::as_f64).unwrap_or(0.0);
    assert!(total_ram > 0.0, "ramTotalGB debería ser > 0");
}

#[test]
fn system_metrics_devuelve_porcentajes_validos() {
    let metrics = system::metrics().expect("system::metrics falló");

    for field in ["cpu", "ram", "gpu", "disk"] {
        let value = metrics.get(field).and_then(Value::as_f64);
        let value = value.unwrap_or_else(|| panic!("metrics.{field} no es numérico"));
        assert!(
            (0.0..=100.0).contains(&value),
            "metrics.{field} fuera de 0-100: {value}"
        );
    }
}

#[test]
fn listados_del_sistema_responden() {
    let processes = system::processes(10).expect("processes falló");
    assert!(!processes.is_empty(), "no se listó ningún proceso");
    assert!(processes.len() <= 10, "se ignoró el límite");
    assert!(
        processes[0].get("pid").and_then(Value::as_i64).is_some(),
        "los procesos deberían traer pid"
    );

    let drives = system::drives().expect("drives falló");
    assert!(!drives.is_empty(), "no se listó ninguna unidad");

    let apps = system::installed_apps().expect("installed_apps falló");
    assert!(!apps.is_empty(), "no se listó ninguna app instalada");

    // `startup` puede estar legítimamente vacío en un equipo limpio: sólo debe no fallar.
    system::startup_items().expect("startup_items falló");
}

#[test]
fn red_y_limpieza_responden() {
    system::network_adapters().expect("network_adapters falló");
    system::network_metrics().expect("network_metrics falló");

    let categories = system::cleaner_scan().expect("cleaner_scan falló");
    assert_eq!(categories.len(), 8, "se esperaban 8 categorías de limpieza");
    for category in &categories {
        assert!(
            category.get("size").and_then(Value::as_f64).is_some(),
            "cada categoría debería traer un tamaño"
        );
    }
}
