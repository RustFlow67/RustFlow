#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Точка входа бинарного файла RustFlow для Windows.

fn main() {
    rustflow_lib::run();
}
