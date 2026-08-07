// Oculta la consola en la build de release de Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    xtweaks_lib::run()
}
