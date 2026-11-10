use serde_json::{json, Value};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Default)]
pub struct ReminderCache(pub Mutex<String>);
#[cfg(target_os = "android")]
pub struct MobileLife(pub tauri::plugin::PluginHandle<tauri::Wry>);

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    tauri::plugin::Builder::new("life-native")
        .setup(|app, _api| {
            #[cfg(target_os = "android")]
            app.manage(MobileLife(
                _api.register_android_plugin("local.lifeos.client", "OrvimPlugin")?,
            ));
            app.manage(ReminderCache::default());
            Ok(())
        })
        .build()
}
pub fn call(app: &tauri::AppHandle, operation: &str, args: Value) -> Result<Value, String> {
    #[cfg(target_os = "android")]
    {
        app.state::<MobileLife>()
            .0
            .run_mobile_plugin("action", json!({"operation":operation,"payload":args}))
            .map_err(|_| "Не удалось выполнить действие Android.".into())
    }
    #[cfg(target_os = "windows")]
    {
        windows_call(app, operation, args)
    }
    #[cfg(not(any(target_os = "android", target_os = "windows")))]
    {
        let _ = (app, operation, args);
        Err("Платформа пока не поддерживается.".into())
    }
}
#[tauri::command]
pub async fn platform_action(
    app: tauri::AppHandle,
    operation: String,
    args: Value,
) -> Result<Value, String> {
    #[cfg(target_os = "windows")]
    if ["traySettings", "trayClose"].contains(&operation.as_str()) {
        return crate::tray::call(&app, &operation, args);
    }
    #[cfg(target_os = "windows")]
    if ["speechStart", "speechPoll", "speechStop"].contains(&operation.as_str()) {
        return tauri::async_runtime::spawn_blocking(move || {
            crate::voice::call(&app, &operation, args)
        })
        .await
        .map_err(|_| "Диктовка прервана.".to_string())?;
    }
    if operation == "openUrl" {
        use tauri_plugin_opener::OpenerExt;
        let url = args["url"].as_str().ok_or("Не указана ссылка.")?;
        let parsed = reqwest::Url::parse(url).map_err(|_| "Некорректная ссылка.")?;
        if !["http", "https"].contains(&parsed.scheme())
            || !parsed.username().is_empty()
            || parsed.password().is_some()
        {
            return Err("Некорректная ссылка.".into());
        }
        app.opener()
            .open_url(parsed.as_str(), None::<&str>)
            .map_err(|_| "Не удалось открыть браузер.")?;
        return Ok(json!({"opened": true}));
    }
    // The WebView cannot request arbitrary native commands or read credentials.
    if ![
        "speech",
        "speechStart",
        "speechPoll",
        "speechDownload",
        "speechStop",
        "notificationPermission",
        "calendarPermission",
        "calendarList",
        "calendarRead",
        "calendarWrite",
        "notificationClick",
        "widgetUpdate",
        "widgetAction",
        "widgetPending",
        "widgetAck",
        "pairingLink",
        "scanPairingCode",
        "lanFirewallStatus",
        "lanFirewallRepair",
        "backupFolder",
        "backupFolderStatus",
        "backupExternalList",
        "backupExternalRead",
        "backupExternalDelete",
        "healthStatus",
        "healthPermission",
        "healthRead",
        "healthInstall",
        "healthSettings",
    ]
    .contains(&operation.as_str())
    {
        return Err("Неизвестное действие.".into());
    }
    tauri::async_runtime::spawn_blocking(move || call(&app, &operation, args))
        .await
        .map_err(|_| "Действие прервано.".to_string())?
}
#[tauri::command]
pub async fn sync_reminders(app: tauri::AppHandle, plan: Value) -> Result<Value, String> {
    if !plan.is_object()
        || plan["items"]
            .as_array()
            .is_none_or(|items| items.len() > 100_000)
    {
        return Err("Некорректный план напоминаний.".into());
    }
    let encoded = plan.to_string();
    if app
        .state::<ReminderCache>()
        .0
        .lock()
        .map_err(|_| "План занят.")?
        .as_str()
        == encoded
    {
        return Ok(json!({"message":"Напоминания обновлены."}));
    }
    let cloned = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || call(&cloned, "reminders", plan))
        .await
        .map_err(|_| "Действие прервано.".to_string())??;
    *app.state::<ReminderCache>()
        .0
        .lock()
        .map_err(|_| "План занят.")? = encoded;
    Ok(result)
}

#[cfg(target_os = "windows")]
pub fn powershell(script: &str, input: &Value) -> Result<Value, String> {
    use base64::Engine;
    use std::{
        io::{Read, Write},
        os::windows::process::CommandExt,
        process::{Command, Stdio},
        time::{Duration, Instant},
    };
    let bytes: Vec<u8> = script.encode_utf16().flat_map(u16::to_le_bytes).collect();
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    let mut child = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-EncodedCommand",
            &encoded,
        ])
        .creation_flags(0x08000000)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|_| "Не удалось открыть службу Windows.".to_string())?;
    child
        .stdin
        .take()
        .unwrap()
        .write_all(input.to_string().as_bytes())
        .map_err(|_| "Не удалось передать данные Windows.".to_string())?;
    let mut stdout = child.stdout.take().unwrap();
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = stdout.read_to_end(&mut bytes);
        bytes
    });
    let mut stderr = child.stderr.take().unwrap();
    let errors = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let _ = stderr.read_to_end(&mut bytes);
        bytes
    });
    let deadline = Instant::now() + Duration::from_secs(90);
    loop {
        if child
            .try_wait()
            .map_err(|_| "Служба Windows недоступна.")?
            .is_some()
        {
            break;
        }
        if Instant::now() > deadline {
            let _ = child.kill();
            let _ = child.wait();
            return Err("Windows не завершил действие за 90 секунд.".into());
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    let bytes = reader.join().unwrap_or_default();
    let _ = errors.join();
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| {
        "Служба Windows не вернула результат. Проверьте разрешения и компоненты Windows."
            .to_string()
    })?;
    if let Some(message) = value["error"].as_str() {
        return Err(message.into());
    }
    Ok(value)
}
#[cfg(target_os = "windows")]
fn windows_call(app: &tauri::AppHandle, operation: &str, mut args: Value) -> Result<Value, String> {
    if operation.starts_with("health") {
        return Ok(
            json!({"status":"unsupported","granted":[],"message":"Health Connect подключается на Android. На ПК доступна синхронизированная история сна, шагов и тренировок."}),
        );
    }
    if operation == "notificationClick" {
        return Ok(
            json!({"kind":notification_kind(&std::env::args().collect::<Vec<_>>()).unwrap_or_default()}),
        );
    }
    let path = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "Не найдена папка приложения.")?;
    std::fs::create_dir_all(&path).map_err(|_| "Не удалось открыть папку приложения.")?;
    args["operation"] = json!(operation);
    args["directory"] = json!(path);
    args["executable"] = json!(std::env::current_exe().map_err(|_| "Не найдено приложение.")?);
    if ["lanFirewallStatus", "lanFirewallRepair"].contains(&operation) {
        return powershell(include_str!("lan/firewall.ps1"), &args);
    }
    if operation == "reminders" {
        prepare_reminder_sounds(&path, &mut args)?;
    }
    powershell(include_str!("windows.ps1"), &args)
}
#[cfg(target_os = "windows")]
fn prepare_reminder_sounds(directory: &std::path::Path, plan: &mut Value) -> Result<(), String> {
    // Embed the selected WAVs so scheduled toasts can play them after the app exits.
    let sounds = directory.join("notification-sounds");
    std::fs::create_dir_all(&sounds).map_err(|_| "Не удалось сохранить звуки уведомлений.")?;
    for (field, name, bytes) in [
        (
            "wellbeingSound",
            "wellbeing-compact.wav",
            include_bytes!("../../public/sounds/notifications/wellbeing-compact.wav").as_slice(),
        ),
        (
            "scheduleSound",
            "schedule-warm.wav",
            include_bytes!("../../public/sounds/notifications/schedule-warm.wav").as_slice(),
        ),
    ] {
        let path = sounds.join(name);
        if std::fs::read(&path).ok().as_deref() != Some(bytes) {
            std::fs::write(&path, bytes).map_err(|_| "Не удалось сохранить звук уведомления.")?;
        }
        let uri = reqwest::Url::from_file_path(path)
            .map_err(|_| "Не удалось открыть звук уведомления.")?;
        plan[field] = json!(uri.as_str());
    }
    Ok(())
}
#[cfg(target_os = "windows")]
pub fn notification_kind(args: &[String]) -> Option<&'static str> {
    args.iter().find_map(|value| {
        if value.starts_with("lifeos-notification://wellbeing") {
            Some("wellbeing")
        } else if value.starts_with("lifeos-notification://event") {
            Some("event")
        } else {
            None
        }
    })
}

#[cfg(all(test, target_os = "windows"))]
mod tests {
    use super::*;
    #[test]
    fn windows_credentials_roundtrip_without_plaintext_at_rest() {
        let clear = "life-os-test-key-not-real";
        let encrypted = powershell(
            include_str!("windows.ps1"),
            &json!({"operation":"credential","mode":"protect","value":clear}),
        )
        .unwrap();
        assert!(!encrypted.to_string().contains(clear));
        let decrypted = powershell(
            include_str!("windows.ps1"),
            &json!({"operation":"credential","mode":"unprotect","value":encrypted["value"]}),
        )
        .unwrap();
        assert_eq!(decrypted["value"], clear);
    }
    #[test]
    fn notification_routes_accept_only_our_protocol() {
        assert_eq!(
            notification_kind(&["lifeos-notification://wellbeing/".into()]),
            Some("wellbeing")
        );
        assert_eq!(
            notification_kind(&["https://example.com/wellbeing".into()]),
            None
        );
    }
}
#[cfg(target_os = "windows")]
pub fn refresh_background_reminders() -> bool {
    if !std::env::args().any(|a| a == "--refresh-reminders") {
        return false;
    }
    if let Some(directory) = std::env::args().nth(2) {
        let path = std::path::PathBuf::from(directory);
        let data = if path.join("reminders.dpapi").exists() {
            std::fs::read_to_string(path.join("reminders.dpapi"))
                .ok()
                .and_then(|value| {
                    powershell(
                        include_str!("windows.ps1"),
                        &json!({"operation":"credential","mode":"unprotect","value":value}),
                    )
                    .ok()
                    .and_then(|v| v["value"].as_str().map(|s| s.as_bytes().to_vec()))
                })
        } else {
            std::fs::read(path.join("reminders.json")).ok()
        };
        if let Some(data) = data {
            if let Ok(mut plan) = serde_json::from_slice::<Value>(&data) {
                plan["operation"] = json!("reminders");
                plan["directory"] = json!(path);
                plan["executable"] = json!(std::env::current_exe().ok());
                plan["background"] = json!(true);
                if prepare_reminder_sounds(&path, &mut plan).is_ok() {
                    let _ = powershell(include_str!("windows.ps1"), &plan);
                }
            }
        }
    }
    true
}
