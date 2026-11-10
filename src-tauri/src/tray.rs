use serde_json::{json, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

pub struct TrayState {
    enabled: AtomicBool,
    exit_requested: AtomicBool,
    open: MenuItem<tauri::Wry>,
    exit: MenuItem<tauri::Wry>,
}

pub fn show(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

pub fn setup(app: &tauri::AppHandle) -> tauri::Result<()> {
    let enabled = app
        .path()
        .app_local_data_dir()
        .ok()
        .and_then(|dir| std::fs::read(dir.join("desktop-preferences.json")).ok())
        .and_then(|bytes| serde_json::from_slice::<Value>(&bytes).ok())
        .and_then(|value| value["closeToTray"].as_bool())
        .unwrap_or(true);
    let open = MenuItem::with_id(app, "open", "Открыть Orvim", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "Выйти", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &exit])?;
    app.manage(TrayState {
        enabled: AtomicBool::new(enabled),
        exit_requested: AtomicBool::new(false),
        open,
        exit,
    });
    TrayIconBuilder::with_id("orvim")
        .icon(tauri::include_image!("icons/tray.png"))
        .tooltip("Orvim")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(|tray, event| {
            if matches!(
                event,
                TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                }
            ) {
                show(tray.app_handle());
            }
        })
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show(app),
            "exit" => {
                // Use the normal close event so the frontend flushes pending edits.
                app.state::<TrayState>()
                    .exit_requested
                    .store(true, Ordering::SeqCst);
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.close();
                }
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}

pub fn call(app: &tauri::AppHandle, operation: &str, args: Value) -> Result<Value, String> {
    let Some(state) = app.try_state::<TrayState>() else {
        return Ok(json!({"hidden":false,"enabled":false,"available":false}));
    };
    let available = app.tray_by_id("orvim").is_some();
    match operation {
        "traySettings" => {
            if let Some(language) = args["language"].as_str() {
                state
                    .open
                    .set_text(if language == "en" {
                        "Open Orvim"
                    } else {
                        "Открыть Orvim"
                    })
                    .map_err(|e| e.to_string())?;
                state
                    .exit
                    .set_text(if language == "en" {
                        "Exit"
                    } else {
                        "Выйти"
                    })
                    .map_err(|e| e.to_string())?;
            }
            if let Some(enabled) = args.get("enabled") {
                let enabled = enabled.as_bool().ok_or("Некорректная настройка трея.")?;
                let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
                std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
                std::fs::write(
                    dir.join("desktop-preferences.json"),
                    json!({"closeToTray":enabled}).to_string(),
                )
                .map_err(|_| "Не удалось сохранить настройку трея.")?;
                state.enabled.store(enabled, Ordering::SeqCst);
            }
            Ok(json!({"enabled":state.enabled.load(Ordering::SeqCst),"available":available}))
        }
        "trayClose" => {
            let exit = state.exit_requested.swap(false, Ordering::SeqCst);
            let hide = available && state.enabled.load(Ordering::SeqCst) && !exit;
            if hide {
                app.get_webview_window("main")
                    .ok_or("Окно недоступно.")?
                    .hide()
                    .map_err(|e| e.to_string())?;
            }
            Ok(json!({"hidden":hide}))
        }
        _ => Err("Неизвестное действие трея.".into()),
    }
}
