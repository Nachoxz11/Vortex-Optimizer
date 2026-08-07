//! Diagnóstico puntual: qué tweaks quedaron activados en esta máquina tras las pruebas.
//! Sólo lee — no escribe nada.
use serde_json::Value;
use xtweaks_lib::tweaks::TweakManager;

#[test]
#[ignore]
fn estado_de_los_tocados_en_testing() {
    let mgr = TweakManager::new(&std::env::temp_dir().join("xtweaks-check")).unwrap();
    let ids = [
        "p.edgepreload",
        "p.tips",
        "p.deliveryopt",
        "p.errorreport",
        "p.wsearchweb",
        "p.menushow",
        "pr.advertising",
        "pr.tailored",
        "p.pciexpress",
        "p.usbsuspend",
        "p.corepark",
        "p.reserved",
    ];
    for id in ids {
        match mgr.check(id) {
            Ok(status) => println!(
                "{id}: applied={}",
                status.get("applied").and_then(Value::as_bool).unwrap_or(false)
            ),
            Err(e) => println!("{id}: ERROR {e}"),
        }
    }
}
