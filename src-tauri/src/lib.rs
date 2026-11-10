mod assistant;
mod backups;
mod commands;
mod connections;
mod domain;
mod encryption;
mod integrations;
mod lan;
mod media;
mod platform;
mod storage;
#[cfg(target_os = "windows")]
mod tray;
mod updates;
mod voice;
#[cfg(target_os = "windows")]
mod windows_dpapi;
#[cfg(target_os = "windows")]
mod windows_identity;

#[cfg(target_os = "windows")]
use tauri::Emitter;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    #[cfg(target_os = "windows")]
    windows_identity::initialize(&context.config().identifier);
    let builder = tauri::Builder::default();
    #[cfg(target_os = "windows")]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
        if let Some(kind) = platform::notification_kind(&args) {
            let _ = app.emit("life-notification", serde_json::json!({"kind":kind}));
        }
        tray::show(app);
    }));
    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(platform::plugin())
        .setup(|app| {
            #[cfg(target_os = "windows")]
            {
                app.manage(voice::Voice::default());
                // Failure must not prevent startup or leave an invisible window.
                if let Err(error) = tray::setup(app.handle()) {
                    eprintln!("Could not create Orvim tray: {error}");
                }
                // Supply a full-sized window icon explicitly, rather than the
                // first (16 px) frame decoded from the executable's ICO.
                if let Some(window) = app.get_webview_window("main") {
                    window.set_icon(tauri::include_image!("icons/128x128.png"))?;
                }
            }
            app.manage(connections::Connections::new()?);
            app.manage(updates::Updates::default());
            let path = app
                .path()
                .app_local_data_dir()
                .map(|directory| {
                    let legacy = directory.join("life-os.sqlite3");
                    if legacy.exists() {
                        legacy
                    } else {
                        directory.join("orvim.sqlite3")
                    }
                })
                .map_err(|error| {
                    format!("Could not locate the application data directory: {error}")
                });
            let backups = if cfg!(target_os = "windows") {
                let documents = app.path().document_dir()?;
                let legacy = documents.join("Life OS").join("backups");
                if legacy.exists() {
                    legacy
                } else {
                    documents.join("Orvim").join("backups")
                }
            } else {
                app.path().app_local_data_dir()?.join("automatic-backups")
            };
            let protection = encryption::initialize(app.handle()).and_then(|_| {
                let root = app
                    .path()
                    .app_local_data_dir()
                    .map_err(|e| e.to_string())?
                    .join("local-sync");
                for name in [
                    "lan-client.sqlite3",
                    "lan-hub.sqlite3",
                    "webdav-client.sqlite3",
                ] {
                    let path = root.join(name);
                    if path.exists() {
                        drop(encryption::open(&path)?);
                    }
                }
                Ok(())
            });
            let path = protection.and(path);
            app.manage(commands::Database::open_with_backups(path, backups));
            app.manage(lan::Lan::new(
                app.path().app_local_data_dir()?.join("local-sync"),
            ));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_workspace,
            commands::save_workspace,
            commands::backup_action,
            updates::update_action,
            commands::validate_assistant_actions,
            lan::lan_sync,
            connections::connection_credential,
            connections::connection_request,
            connections::cancel_connection_request,
            connections::google_login,
            platform::platform_action,
            platform::sync_reminders,
            commands::get_snapshot,
            commands::add_inbox,
            commands::process_inbox,
            commands::delete_inbox,
            commands::save_project,
            commands::set_project_status,
            commands::save_task,
            commands::set_task_status,
            commands::add_win,
            commands::delete_win,
            commands::save_checkin,
            commands::start_review,
            commands::save_review,
        ])
        .run(context)
        .expect("error while running Orvim");
}

pub fn run_background() -> bool {
    #[cfg(target_os = "windows")]
    {
        platform::refresh_background_reminders()
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}
