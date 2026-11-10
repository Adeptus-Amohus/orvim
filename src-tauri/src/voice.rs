#[cfg(target_os = "windows")]
mod windows {
    use serde_json::{json, Value};
    use std::{
        io::Write,
        os::windows::process::CommandExt,
        path::PathBuf,
        process::{Child, Command, Stdio},
        sync::Mutex,
        time::Duration,
    };
    use tauri::Manager;
    #[derive(Default)]
    pub struct Voice(pub Mutex<Option<Session>>);
    pub struct Session {
        child: Child,
        root: PathBuf,
    }
    impl Drop for Session {
        fn drop(&mut self) {
            let _ = self.child.kill();
            let _ = self.child.wait();
            if let Ok(root) = std::fs::canonicalize(&self.root) {
                let parent = std::env::temp_dir();
                if root.parent() == std::fs::canonicalize(parent).ok().as_deref()
                    && root
                        .file_name()
                        .is_some_and(|name| name.to_string_lossy().starts_with("lifeos-voice-"))
                {
                    let _ = std::fs::remove_dir_all(root);
                }
            }
        }
    }
    fn read(session: &mut Session) -> Result<Value, String> {
        let mut value = std::fs::read(session.root.join("state.json"))
            .ok()
            .and_then(|data| serde_json::from_slice::<Value>(&data).ok())
            .unwrap_or(json!({"text":"","partial":"","listening":false}));
        value["mode"] = json!("local");
        value["engine"] = json!("Windows · System.Speech");
        if session
            .child
            .try_wait()
            .map_err(|e| e.to_string())?
            .is_some()
            && value["error"].as_str().unwrap_or_default().is_empty()
        {
            value["error"] = json!("Движок Windows остановился. Распознанный текст сохранён.");
        }
        Ok(value)
    }
    pub fn call(app: &tauri::AppHandle, operation: &str, args: Value) -> Result<Value, String> {
        let binding = app.state::<Voice>();
        let mut state = binding.0.lock().map_err(|_| "Микрофон занят.")?;
        match operation {
            "speechStart" => {
                if state.is_some() {
                    return Err("Диктовка уже запущена.".into());
                }
                let root =
                    std::env::temp_dir().join(format!("lifeos-voice-{}", uuid::Uuid::new_v4()));
                std::fs::create_dir(&root).map_err(|e| e.to_string())?;
                use base64::Engine;
                let script = include_str!("voice-windows.ps1");
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
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
                    .map_err(|e| e.to_string())?;
                let config = json!({"root":root.to_string_lossy(),"language":args["language"]});
                child
                    .stdin
                    .take()
                    .ok_or("Не удалось включить микрофон.")?
                    .write_all(config.to_string().as_bytes())
                    .map_err(|e| e.to_string())?;
                let mut session = Session { child, root };
                for _ in 0..80 {
                    if session.root.join("state.json").exists() {
                        break;
                    }
                    if session
                        .child
                        .try_wait()
                        .map_err(|e| e.to_string())?
                        .is_some()
                    {
                        return Err("Движок распознавания Windows недоступен. Установите речевой пакет выбранного языка.".into());
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                let result = read(&mut session)?;
                if let Some(error) = result["error"].as_str().filter(|s| !s.is_empty()) {
                    return Err(error.into());
                }
                *state = Some(session);
                Ok(result)
            }
            "speechPoll" => read(state.as_mut().ok_or("Диктовка не запущена.")?),
            "speechStop" => {
                let Some(mut session) = state.take() else {
                    return Ok(json!({"text":"","partial":"","listening":false}));
                };
                std::fs::write(session.root.join("stop"), b"stop").map_err(|e| e.to_string())?;
                for _ in 0..30 {
                    if session
                        .child
                        .try_wait()
                        .map_err(|e| e.to_string())?
                        .is_some()
                    {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                let mut result = read(&mut session)?;
                result["error"] = Value::Null;
                result["listening"] = json!(false);
                Ok(result)
            }
            _ => Err("Неизвестное действие диктовки.".into()),
        }
    }
}
#[cfg(target_os = "windows")]
pub use windows::*;
