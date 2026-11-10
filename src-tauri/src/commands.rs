use crate::storage::WorkspaceDocument;
use crate::{domain::*, storage::Repository};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tauri::Manager;
use tauri::State;

#[tauri::command]
pub async fn load_workspace(
    app: tauri::AppHandle,
) -> std::result::Result<WorkspaceDocument, String> {
    // Android can load the WebView while setup is still opening the Keystore
    // and migrating SQLite. Do not expose a missing-state error on first launch.
    let started = std::time::Instant::now();
    loop {
        if let Some(database) = app.try_state::<Database>() {
            return database.run(|repository| repository.load_workspace()).await;
        }
        if started.elapsed() >= std::time::Duration::from_secs(120) {
            return Err(
                "Хранилище ещё не готово. Подождите и повторите открытие; данные не удалены."
                    .into(),
            );
        }
        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
    }
}

#[tauri::command]
pub async fn save_workspace(
    app: tauri::AppHandle,
    database: State<'_, Database>,
    document: WorkspaceDocument,
) -> std::result::Result<u64, String> {
    let revision = database
        .run(move |repository| repository.save_workspace(&document))
        .await?;
    mirror_backup(&app, &database).await;
    Ok(revision)
}

pub struct Database(Arc<Mutex<std::result::Result<Repository, String>>>);
impl Database {
    pub fn open_with_backups(path: std::result::Result<PathBuf, String>, backups: PathBuf) -> Self {
        Self(Arc::new(Mutex::new(path.and_then(|p| {
            Repository::open_with_backups(&p, &backups).map_err(|e| e.to_string())
        }))))
    }
    pub(crate) async fn run<T, F>(&self, operation: F) -> std::result::Result<T, String>
    where
        T: Send + 'static,
        F: FnOnce(&mut Repository) -> Result<T> + Send + 'static,
    {
        let database = Arc::clone(&self.0);
        tauri::async_runtime::spawn_blocking(move || {
            let mut state = database
                .lock()
                .map_err(|_| "Local storage is unavailable. Restart Orvim.".to_string())?;
            let repo = state.as_mut().map_err(|e| e.clone())?;
            operation(repo).map_err(|error| error.to_string())
        })
        .await
        .map_err(|e| format!("Local storage operation failed: {e}"))?
    }
}

#[tauri::command]
pub async fn backup_action(
    app: tauri::AppHandle,
    database: State<'_, Database>,
    operation: String,
    name: Option<String>,
    password: Option<String>,
    content: Option<String>,
) -> std::result::Result<serde_json::Value, String> {
    let password = zeroize::Zeroizing::new(password.unwrap_or_default());
    if operation == "recoverEncrypted" {
        let database = Arc::clone(&database.0);
        return tauri::async_runtime::spawn_blocking(move || {
            let document = crate::backups::decode_portable(
                content.as_deref().ok_or("Выберите копию.")?,
                &password,
            )?;
            let mut state = database.lock().map_err(|_| "Хранилище занято.")?;
            if state.is_ok() {
                return Err("База доступна. Используйте восстановление в настройках.".into());
            }
            crate::encryption::initialize_recovery(&app)?;
            let root = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
            let temporary = root.join(format!("recovery-{}.sqlite3", uuid::Uuid::new_v4()));
            let backups = root.join("automatic-backups");
            let mut repo =
                Repository::open_with_backups(&temporary, &backups).map_err(|e| e.to_string())?;
            let mut current = repo.load_workspace().map_err(|e| e.to_string())?;
            current.data = document.data;
            current.covers = document.covers;
            repo.save_workspace(&current).map_err(|e| e.to_string())?;
            drop(repo);
            // Retain unreadable data for manual recovery; never discard it.
            let retained = root.join(format!("before-recovery-{}", uuid::Uuid::new_v4()));
            std::fs::create_dir_all(&retained).map_err(|e| e.to_string())?;
            for name in [
                "orvim.sqlite3",
                "orvim.sqlite3-wal",
                "orvim.sqlite3-shm",
                "life-os.sqlite3",
                "life-os.sqlite3-wal",
                "life-os.sqlite3-shm",
                "local-sync",
            ] {
                let path = root.join(name);
                if path.exists() {
                    std::fs::rename(path, retained.join(name)).map_err(|e| e.to_string())?;
                }
            }
            let path = root.join("orvim.sqlite3");
            std::fs::rename(temporary, &path).map_err(|e| e.to_string())?;
            *state = Repository::open_with_backups(&path, &backups).map_err(|e| e.to_string());
            state.as_ref().map_err(|e| e.clone())?;
            Ok(serde_json::json!({"restored":true}))
        })
        .await
        .map_err(|e| e.to_string())?;
    }
    if operation == "wipe" {
        if !matches!(name.as_deref(), Some("Orvim" | "Life OS")) {
            return Err("Подтвердите полное удаление личных данных.".into());
        }
        app.state::<crate::lan::Lan>().wipe(&app)?;
        #[cfg(target_os = "android")]
        crate::platform::call(&app, "widgetReset", serde_json::json!({}))?;
        for provider in [
            "openai",
            "deepseek",
            "gemini",
            "notion",
            "json",
            "google",
            "google-refresh",
            "google-client",
            "lan-peer",
            "lan-host",
            "webdav",
        ] {
            crate::connections::secure(&app, "delete", provider, None)?;
        }
        crate::platform::call(
            &app,
            "reminders",
            serde_json::json!({"enabled":false,"items":[]}),
        )?;
        return database
            .run(|repo| {
                repo.wipe_personal_data()?;
                Ok(serde_json::json!({"deleted":true}))
            })
            .await;
    }
    let result=database.run(move |repo| {
        let fail = crate::domain::Error::Validation;
        match operation.as_str() {
            "list" => Ok(serde_json::json!({"folder":repo.backup_root.to_string_lossy(),"copies":crate::backups::list(&repo.backup_root).map_err(fail)?,"error":repo.backup_error,"keep":crate::backups::KEEP,"intervalHours":1,"encrypted":crate::encryption::active()})),
            "exportEncrypted" => {
                let document=crate::backups::sanitized(&repo.load_workspace()?);
                let bytes=serde_json::to_vec(&serde_json::json!({"format":"life-os-backup","schemaVersion":1,"data":document.data,"covers":document.covers})).map_err(|e|fail(e.to_string()))?;
                let protected=crate::encryption::seal(&bytes,Some(&password)).map_err(fail)?;
                Ok(serde_json::json!({"content":String::from_utf8(protected).map_err(|e|fail(e.to_string()))?}))
            },
            "importEncrypted" => {
                let restored=crate::backups::decode_portable(content.as_deref().ok_or_else(||fail("Выберите копию.".into()))?,&password).map_err(fail)?;
                repo.backup_now("before-protected-restore")?;
                Ok(serde_json::to_value(restored).map_err(|e|fail(e.to_string()))?)
            },
            "decodeLocal" => {
                let bytes=crate::encryption::unseal(content.as_deref().ok_or_else(||fail("Выберите копию.".into()))?.as_bytes(),None).map_err(fail)?;
                Ok(serde_json::json!({"content":String::from_utf8(bytes.to_vec()).map_err(|e|fail(e.to_string()))?}))
            },
            "create" => { repo.backup_now(name.as_deref().unwrap_or("manual"))?; Ok(serde_json::json!({"created":true})) },
            "prepareRestore" => {
                let document = crate::backups::read_snapshot(&repo.backup_root,name.as_deref().ok_or_else(||fail("Выберите копию.".into()))?).map_err(fail)?;
                repo.backup_now("before-restore")?;
                Ok(serde_json::to_value(document).map_err(|e|fail(e.to_string()))?)
            },
            "delete" => {
                let path = crate::backups::selected(&repo.backup_root,name.as_deref().ok_or_else(||fail("Выберите копию.".into()))?).map_err(fail)?;
                std::fs::remove_file(path)?; Ok(serde_json::json!({"deleted":true}))
            },
            _ => Err(fail("Неизвестное действие с резервными копиями.".into()))
        }
    }).await;
    if result.is_ok() {
        mirror_backup(&app, &database).await;
    }
    result
}
pub(crate) async fn mirror_backup(app: &tauri::AppHandle, database: &Database) {
    // Device-bound snapshots are not recovery copies after reinstall. Do not
    // silently mirror them to external storage; use password export instead.
    if crate::encryption::active() {
        return;
    }
    #[cfg(target_os = "android")]
    {
        let mobile = app.clone();
        let _ = database
            .run(move |repo| {
                if let Some(copy) = crate::backups::list(&repo.backup_root)
                    .map_err(crate::domain::Error::Validation)?
                    .into_iter()
                    .find(|v| v["kind"] == "json")
                {
                    let status =
                        crate::platform::call(&mobile, "backupFolderStatus", serde_json::json!({}))
                            .map_err(crate::domain::Error::Validation)?;
                    if status["configured"] != true || status["lastMirrored"] == copy["name"] {
                        return Ok(());
                    }
                    let name = copy["name"].as_str().unwrap();
                    let path = crate::backups::selected(&repo.backup_root, name)
                        .map_err(crate::domain::Error::Validation)?;
                    let payload =
                        serde_json::json!({"name":name,"content":std::fs::read_to_string(path)?});
                    if let Err(error) = crate::platform::call(&mobile, "backupMirror", payload) {
                        repo.backup_error = Some(format!(
                            "Внутренняя копия сохранена; внешняя копия не записана: {error}"
                        ));
                    }
                }
                Ok(())
            })
            .await;
    }
    let _ = (app, database);
}
#[tauri::command]
pub async fn get_snapshot(database: State<'_, Database>) -> std::result::Result<Snapshot, String> {
    database.run(|r| r.snapshot()).await
}

#[tauri::command]
pub async fn validate_assistant_actions(
    database: State<'_, Database>,
    changes: serde_json::Value,
) -> std::result::Result<serde_json::Value, String> {
    database
        .run(move |repo| {
            let document = repo.load_workspace()?;
            crate::assistant::validate(&changes, Some(&document))
                .map_err(crate::domain::Error::Validation)?;
            Ok(serde_json::json!({"valid":true}))
        })
        .await
}
#[tauri::command]
pub async fn add_inbox(
    database: State<'_, Database>,
    content: String,
) -> std::result::Result<String, String> {
    database.run(move |r| r.add_inbox(content)).await
}
#[tauri::command]
pub async fn process_inbox(
    database: State<'_, Database>,
    id: String,
    processed: bool,
) -> std::result::Result<(), String> {
    database.run(move |r| r.process_inbox(id, processed)).await
}
#[tauri::command]
pub async fn delete_inbox(
    database: State<'_, Database>,
    id: String,
) -> std::result::Result<(), String> {
    database.run(move |r| r.delete_inbox(id)).await
}
#[tauri::command]
pub async fn save_project(
    database: State<'_, Database>,
    input: ProjectInput,
) -> std::result::Result<String, String> {
    database.run(move |r| r.save_project(input)).await
}
#[tauri::command]
pub async fn set_project_status(
    database: State<'_, Database>,
    id: String,
    status: ProjectStatus,
) -> std::result::Result<(), String> {
    database
        .run(move |r| r.set_project_status(id, status))
        .await
}
#[tauri::command]
pub async fn save_task(
    database: State<'_, Database>,
    input: TaskInput,
) -> std::result::Result<String, String> {
    database.run(move |r| r.save_task(input)).await
}
#[tauri::command]
pub async fn set_task_status(
    database: State<'_, Database>,
    id: String,
    status: TaskStatus,
) -> std::result::Result<(), String> {
    database.run(move |r| r.set_task_status(id, status)).await
}
#[tauri::command]
pub async fn add_win(
    database: State<'_, Database>,
    input: WinInput,
) -> std::result::Result<String, String> {
    database.run(move |r| r.add_win(input)).await
}
#[tauri::command]
pub async fn delete_win(
    database: State<'_, Database>,
    id: String,
) -> std::result::Result<(), String> {
    database.run(move |r| r.delete_win(id)).await
}
#[tauri::command]
pub async fn save_checkin(
    database: State<'_, Database>,
    input: CheckinInput,
) -> std::result::Result<(), String> {
    database.run(move |r| r.save_checkin(input)).await
}
#[tauri::command]
pub async fn start_review(
    database: State<'_, Database>,
    period_start: String,
) -> std::result::Result<String, String> {
    database.run(move |r| r.start_review(period_start)).await
}
#[tauri::command]
pub async fn save_review(
    database: State<'_, Database>,
    input: ReviewInput,
) -> std::result::Result<(), String> {
    database.run(move |r| r.save_review(input)).await
}
