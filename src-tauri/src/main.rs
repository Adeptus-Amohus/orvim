// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if orvim_lib::run_background() {
        return;
    }
    orvim_lib::run()
}
