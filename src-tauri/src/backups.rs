//! Independent, bounded snapshots. Credentials never enter the snapshot.
use crate::storage::{validate_workspace, WorkspaceDocument};
use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
};

pub const KEEP: usize = 24;
pub fn sanitized(document: &WorkspaceDocument) -> WorkspaceDocument {
    let mut copy = document.clone();
    if let Some(data) = copy.data.as_object_mut() {
        for key in [
            "connectionSettings",
            "lanSettings",
            "webdavSettings",
            "updateSettings",
        ] {
            data.remove(key);
        }
    }
    copy
}
pub fn write_snapshot(
    root: &Path,
    document: &WorkspaceDocument,
    reason: &str,
) -> Result<PathBuf, String> {
    validate_workspace(document).map_err(|e| e.to_string())?;
    fs::create_dir_all(root).map_err(|e| e.to_string())?;
    let safe_reason: String = reason
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-')
        .take(32)
        .collect();
    let name = format!(
        "orvim-{}-{}-{}.json",
        chrono::Utc::now().format("%Y%m%dT%H%M%S%3f"),
        safe_reason,
        uuid::Uuid::new_v4()
    );
    let path = root.join(name);
    let temporary = path.with_extension("partial");
    let copy = sanitized(document);
    let bytes = serde_json::to_vec(&json!({"format":"life-os-backup","schemaVersion":1,"createdAt":chrono::Utc::now().to_rfc3339(),"reason":reason,"appVersion":env!("CARGO_PKG_VERSION"),"data":copy.data,"covers":copy.covers})).map_err(|e|e.to_string())?;
    let bytes = if crate::encryption::active() {
        crate::encryption::seal(&bytes, None)?
    } else {
        bytes
    };
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&temporary)
        .map_err(|e| e.to_string())?;
    file.write_all(&bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())?;
    fs::rename(&temporary, &path).map_err(|e| e.to_string())?;
    prune(root)?;
    Ok(path)
}
pub fn list(root: &Path) -> Result<Vec<Value>, String> {
    if !root.exists() {
        return Ok(vec![]);
    }
    let mut entries = vec![];
    for entry in fs::read_dir(root).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        if !valid_name(&name) || entry.file_type().map_err(|e| e.to_string())?.is_symlink() {
            continue;
        }
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        if !metadata.is_file() {
            continue;
        }
        let at: chrono::DateTime<chrono::Utc> =
            metadata.modified().map_err(|e| e.to_string())?.into();
        entries.push(json!({"name":name,"at":at.to_rfc3339(),"bytes":metadata.len(),"kind":if name.ends_with(".sqlite3"){"sqlite"}else{"json"}}));
    }
    entries.sort_by(|a, b| b["at"].as_str().cmp(&a["at"].as_str()));
    Ok(entries)
}
pub fn valid_name(name: &str) -> bool {
    (name.starts_with("orvim-") || name.starts_with("lifeos-"))
        && name.len() < 180
        && name
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b"-._".contains(&b))
        && (name.ends_with(".json") || name.ends_with(".sqlite3"))
}
pub fn selected(root: &Path, name: &str) -> Result<PathBuf, String> {
    if !valid_name(name) {
        return Err("Некорректное имя копии.".into());
    }
    let path = root.join(name);
    let meta = fs::symlink_metadata(&path).map_err(|_| "Копия не найдена.")?;
    if !meta.is_file() || meta.file_type().is_symlink() {
        return Err("Некорректная копия.".into());
    }
    Ok(path)
}
pub fn prune(root: &Path) -> Result<(), String> {
    for entry in list(root)?.into_iter().skip(KEEP) {
        fs::remove_file(selected(root, entry["name"].as_str().unwrap())?)
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn read_snapshot(root: &Path, name: &str) -> Result<WorkspaceDocument, String> {
    let path = selected(root, name)?;
    if fs::metadata(&path).map_err(|e| e.to_string())?.len() > 110 * 1024 * 1024 {
        return Err("Копия превышает допустимый размер.".into());
    }
    if name.ends_with(".sqlite3") {
        // A pre-migration snapshot is read through a private working copy; the
        // user's retained snapshot is never migrated or overwritten in place.
        let temporary =
            std::env::temp_dir().join(format!("lifeos-restore-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&temporary).map_err(|e| e.to_string())?;
        let copy = temporary.join("workspace.sqlite3");
        let result = (|| {
            fs::copy(&path, &copy).map_err(|e| e.to_string())?;
            let mut repo = crate::storage::Repository::open(&copy).map_err(|e| e.to_string())?;
            repo.load_workspace().map_err(|e| e.to_string())
        })();
        if let Ok(resolved) = fs::canonicalize(&temporary) {
            if resolved.parent() == fs::canonicalize(std::env::temp_dir()).ok().as_deref()
                && resolved
                    .file_name()
                    .is_some_and(|name| name.to_string_lossy().starts_with("lifeos-restore-"))
            {
                let _ = fs::remove_dir_all(resolved);
            }
        }
        return result;
    }
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let decoded;
    let bytes = if crate::encryption::is_encrypted(&bytes) {
        decoded = crate::encryption::unseal(&bytes, None)?;
        &decoded[..]
    } else {
        &bytes[..]
    };
    let value: Value = serde_json::from_slice(bytes).map_err(|_| "Повреждён файл копии.")?;
    if value["format"] != "life-os-backup" || value["schemaVersion"] != 1 {
        return Err("Неподдерживаемая копия.".into());
    }
    let document = WorkspaceDocument {
        revision: 0,
        data: value["data"].clone(),
        covers: serde_json::from_value(value["covers"].clone())
            .map_err(|_| "Повреждены изображения копии.")?,
    };
    validate_workspace(&document).map_err(|e| e.to_string())?;
    Ok(document)
}

// Upgrade retained snapshots too; never leave new automatic plaintext backups.
pub fn protect_existing(root: &Path) -> Result<(), String> {
    if !crate::encryption::active() {
        return Ok(());
    }
    for item in list(root)? {
        let path = selected(root, item["name"].as_str().ok_or("Некорректная копия.")?)?;
        if path.extension().is_some_and(|e| e == "sqlite3") {
            if crate::encryption::plain(&path) {
                drop(crate::encryption::open(&path)?);
            }
            continue;
        }
        let bytes = fs::read(&path).map_err(|e| e.to_string())?;
        if crate::encryption::is_encrypted(&bytes) {
            continue;
        }
        let sealed = crate::encryption::seal(&bytes, None)?;
        if *crate::encryption::unseal(&sealed, None)? != bytes {
            return Err("Копия не прошла проверку шифрования.".into());
        }
        let temp = path.with_extension("protected-partial");
        if temp.exists() {
            fs::remove_file(&temp).map_err(|e| e.to_string())?;
        }
        crate::encryption::write_new(&temp, &sealed)?;
        fs::rename(temp, path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn decode_portable(content: &str, password: &str) -> Result<WorkspaceDocument, String> {
    let bytes = crate::encryption::unseal(content.as_bytes(), Some(password))?;
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| "Повреждена копия.")?;
    if value["format"] != "life-os-backup" || value["schemaVersion"] != 1 {
        return Err("Неподдерживаемая копия.".into());
    }
    let document = WorkspaceDocument {
        revision: 0,
        data: value["data"].clone(),
        covers: serde_json::from_value(value["covers"].clone())
            .map_err(|_| "Повреждены обложки.")?,
    };
    validate_workspace(&document).map_err(|e| e.to_string())?;
    Ok(sanitized(&document))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn before_version_copy_restores_without_mutating_snapshot_and_strips_secrets() {
        let root = std::env::temp_dir().join(format!(
            "lifeos-before-version-test-{}",
            uuid::Uuid::new_v4()
        ));
        fs::create_dir(&root).unwrap();
        let database = root.join("workspace.sqlite3");
        let copies = root.join("copies");
        let mut repo = crate::storage::Repository::open_with_backups(&database, &copies).unwrap();
        let mut document = repo.load_workspace().unwrap();
        document.data["thoughts"] = json!([{"id":1,"title":"Before update","body":"Preserved","date":"2026-10-08","context":"Личное"}]);
        document.data["nextId"] = json!(2);
        document.data["connectionSettings"] = json!({"apiKey":"synthetic-upgrade-secret"});
        repo.save_workspace(&document).unwrap();
        drop(repo);
        fs::write(database.with_extension("app-version"), "0.3.6").unwrap();
        let repo = crate::storage::Repository::open_with_backups(&database, &copies).unwrap();
        let copy = list(&copies)
            .unwrap()
            .into_iter()
            .find(|v| v["kind"] == "sqlite")
            .unwrap();
        let name = copy["name"].as_str().unwrap();
        let path = selected(&copies, name).unwrap();
        let before = fs::read(&path).unwrap();
        assert!(!String::from_utf8_lossy(&before).contains("synthetic-upgrade-secret"));
        assert_eq!(
            read_snapshot(&copies, name).unwrap().data["thoughts"],
            document.data["thoughts"]
        );
        assert_eq!(before, fs::read(&path).unwrap());
        drop(repo);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn backups_restore_retain_and_exclude_credentials() {
        let root =
            std::env::temp_dir().join(format!("lifeos-backup-test-{}", uuid::Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let copies = root.join("copies");
        let mut repo =
            crate::storage::Repository::open_with_backups(&root.join("workspace.sqlite3"), &copies)
                .unwrap();
        let mut document = repo.load_workspace().unwrap();
        document.data["projects"] = json!([{"id":1,"name":"Сохранить","description":""}]);
        document.data["nextId"] = json!(2);
        document.data["connectionSettings"] = json!({"apiKey":"synthetic-test-secret"});
        repo.save_workspace(&document).unwrap();
        let copy = write_snapshot(&copies, &document, "test").unwrap();
        assert!(!fs::read_to_string(&copy)
            .unwrap()
            .contains("synthetic-test-secret"));
        let restored = read_snapshot(&copies, copy.file_name().unwrap().to_str().unwrap()).unwrap();
        assert_eq!(restored.data["projects"], document.data["projects"]);
        let mut current = repo.load_workspace().unwrap();
        current.data = restored.data;
        current.covers = restored.covers;
        repo.save_workspace(&current).unwrap();
        assert_eq!(
            repo.load_workspace().unwrap().data["projects"],
            document.data["projects"]
        );
        for _ in 0..30 {
            write_snapshot(&copies, &document, "retention").unwrap();
        }
        assert_eq!(list(&copies).unwrap().len(), KEEP);
        assert!(selected(&copies, "../workspace.sqlite3").is_err());
        drop(repo);
        fs::remove_dir_all(root).unwrap();
    }
}
