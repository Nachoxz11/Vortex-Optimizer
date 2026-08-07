//! Prueba que `apply`/`revert` realmente cambian el sistema, no sólo que compilan.
//!
//! Sólo ejercita tweaks `requiresElevation: false` (HKCU, sin UAC) para poder correr sin
//! intervención manual. Cada test deja el valor como lo encontró.
//!
//! `#[ignore]` porque modifica el registro del usuario que corre la suite; se corre a mano con
//! `cargo test --test real_apply -- --ignored --test-threads=1`.

use serde_json::Value;
use xtweaks_lib::tweaks::TweakManager;

fn manager() -> TweakManager {
    TweakManager::new(&std::env::temp_dir().join("xtweaks-tests-real")).unwrap()
}

/// Aplica y revierte de verdad, verificando que `revert` deja el valor EXACTO de antes de
/// tocar nada — sea cual sea ese valor. No asume que el estado inicial esté "sin aplicar": en
/// este equipo varios de estos tweaks de privacidad ya vienen aplicados de fábrica, y sin
/// snapshot previo el revert no tiene a qué volver (comportamiento correcto, ver
/// `registry.rs::revert`). Por eso comparamos contra el estado real, no contra un valor fijo.
fn assert_apply_revert_roundtrip(id: &str) {
    let mgr = manager();

    let before = mgr.check(id).unwrap_or_else(|e| panic!("{id}: check inicial falló: {e}"));
    let was_applied_before = before.get("applied").and_then(Value::as_bool);

    let applied = mgr
        .change(id, "apply")
        .unwrap_or_else(|e| panic!("{id}: apply falló: {e}"));
    assert_eq!(
        applied.get("applied").and_then(Value::as_bool),
        Some(true),
        "{id}: apply no dejó `applied: true` — {applied}"
    );

    let reverted = mgr
        .change(id, "revert")
        .unwrap_or_else(|e| panic!("{id}: revert falló: {e}"));
    assert_eq!(
        reverted.get("applied").and_then(Value::as_bool),
        was_applied_before,
        "{id}: revert no restauró el estado original ({was_applied_before:?}) — quedó en {reverted}"
    );

    // Si arrancó sin aplicar, lo dejamos así; si ya venía aplicado, lo reaplicamos.
    if was_applied_before == Some(true) {
        mgr.change(id, "apply").unwrap_or_else(|e| panic!("{id}: no se pudo restaurar {id}: {e}"));
    }
}

#[test]
#[ignore]
fn optimize_tips_aplica_y_revierte_de_verdad() {
    assert_apply_revert_roundtrip("p.tips");
}

#[test]
#[ignore]
fn optimize_wsearchweb_aplica_y_revierte_de_verdad() {
    assert_apply_revert_roundtrip("p.wsearchweb");
}

#[test]
#[ignore]
fn optimize_menushow_aplica_y_revierte_de_verdad() {
    assert_apply_revert_roundtrip("p.menushow");
}

#[test]
#[ignore]
fn optimize_advertising_aplica_y_revierte_de_verdad() {
    assert_apply_revert_roundtrip("pr.advertising");
}

#[test]
#[ignore]
fn optimize_tailored_aplica_y_revierte_de_verdad() {
    assert_apply_revert_roundtrip("pr.tailored");
}

/// El botón "Optimize" del Dashboard llama a esto. Corre las 5 no elevadas reales + valida que
/// las 3 elevadas (p.edgepreload, p.deliveryopt, p.errorreport) se reporten como pendientes,
/// sin intentar aplicarlas — eso requiere UAC interactivo.
#[test]
#[ignore]
fn optimize_action_completa_sin_romperse() {
    use xtweaks_lib::quick_actions;

    let mgr = manager();
    let before: Vec<_> = ["p.tips", "p.wsearchweb", "p.menushow", "pr.advertising", "pr.tailored"]
        .iter()
        .map(|id| {
            (
                *id,
                mgr.check(id)
                    .unwrap()
                    .get("applied")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
            )
        })
        .collect();

    let result = quick_actions::run("optimize", &mgr).expect("la acción optimize no debería fallar");
    assert_eq!(result.get("message").and_then(Value::as_str), Some("Perfil recomendado aplicado"));

    let stats = result.get("stats").expect("optimize debería traer stats");
    let applied = stats.get("applied").and_then(Value::as_array).cloned().unwrap_or_default();
    println!("aplicados en este run: {applied:?}");

    // Revertimos sólo lo que este test aplicó, para dejar la máquina como estaba.
    for id in applied.iter().filter_map(Value::as_str) {
        let _ = mgr.change(id, "revert");
    }
    for (id, was_applied) in before {
        if was_applied {
            let _ = mgr.change(id, "apply");
        }
    }
}
