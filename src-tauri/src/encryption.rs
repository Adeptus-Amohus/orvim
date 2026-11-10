//! Encryption at rest. No keys or passwords are exposed to the WebView.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chacha20poly1305::{
    aead::{rand_core::RngCore, Aead, OsRng, Payload},
    KeyInit, XChaCha20Poly1305,
};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::Path,
    sync::{Mutex, OnceLock},
};
use tauri::Manager;
use zeroize::Zeroizing;

static KEY: OnceLock<Zeroizing<[u8; 32]>> = OnceLock::new();
static MIGRATION: Mutex<()> = Mutex::new(());
const AAD: &[u8] = b"orvim-encrypted-backup-v1";
const LIMIT: usize = 160 * 1024 * 1024;
type Result<T> = std::result::Result<T, String>;

pub fn initialize(app: &tauri::AppHandle) -> Result<()> {
    let stored = crate::connections::secure(app, "get", "storage-key", None)?;
    let key: [u8; 32] = if let Some(encoded) = stored {
        B64.decode(encoded)
            .map_err(|_| "Повреждён ключ базы.")?
            .try_into()
            .map_err(|_| "Повреждён ключ базы.")?
    } else {
        let root = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
        for name in ["orvim.sqlite3", "life-os.sqlite3"] {
            let path = root.join(name);
            if path.exists()
                && fs::metadata(&path).map_err(|e| e.to_string())?.len() > 0
                && !plain(&path)
            {
                return Err("Ключ зашифрованной базы отсутствует. Восстановите копию с паролем; исходные файлы не изменены.".into());
            }
        }
        let mut key = [0; 32];
        OsRng.fill_bytes(&mut key);
        crate::connections::secure(app, "set", "storage-key", Some(&B64.encode(key)))?;
        key
    };
    KEY.set(Zeroizing::new(key))
        .map_err(|_| "Хранилище уже открыто.".to_string())
}
pub fn initialize_recovery(app: &tauri::AppHandle) -> Result<()> {
    if active() {
        return Ok(());
    }
    let mut key = [0; 32];
    OsRng.fill_bytes(&mut key);
    crate::connections::secure(app, "set", "storage-key", Some(&B64.encode(key)))?;
    KEY.set(Zeroizing::new(key))
        .map_err(|_| "Хранилище уже открыто.".into())
}
pub fn active() -> bool {
    KEY.get().is_some()
}
fn key() -> Result<&'static [u8; 32]> {
    KEY.get()
        .map(|k| &**k)
        .ok_or_else(|| "Защищённое хранилище недоступно. Данные не изменены.".into())
}

fn keyed(path: &Path, key: &[u8; 32]) -> Result<Connection> {
    let connection = Connection::open(path).map_err(|e| e.to_string())?;
    let hex = Zeroizing::new(key.iter().map(|b| format!("{b:02x}")).collect::<String>());
    connection
        .pragma_update(None, "key", format!("x'{}'", *hex))
        .map_err(|e| e.to_string())?;
    connection
        // SQLCipher 4.14 bundled by rusqlite has a Windows allocator/logging
        // recursion when VirtualLock quota is exhausted (upstream #619).
        // Keep the default memory allocator; on-disk encryption is unchanged.
        .execute_batch("PRAGMA temp_store=MEMORY;")
        .map_err(|e| e.to_string())?;
    connection.query_row("SELECT count(*) FROM sqlite_master", [], |r|r.get::<_,i64>(0))
        .map_err(|_| "Не удалось расшифровать базу. Не удаляйте файлы: восстановите защищённую копию с паролем.".to_string())?;
    Ok(connection)
}
pub fn plain(path: &Path) -> bool {
    use std::io::Read;
    let mut head = [0; 16];
    fs::File::open(path)
        .and_then(|mut f| f.read_exact(&mut head))
        .is_ok()
        && head == *b"SQLite format 3\0"
}
pub fn open(path: &Path) -> Result<Connection> {
    #[cfg(test)]
    if !active() {
        return Connection::open(path).map_err(|e| e.to_string());
    }
    open_with_key(path, key()?)
}
pub fn open_with_key(path: &Path, key: &[u8; 32]) -> Result<Connection> {
    let _guard = MIGRATION.lock().map_err(|_| "Миграция занята.")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let source = path.with_extension("plaintext-migration");
    let target = path.with_extension("encrypting");
    // Recover an interrupted rename before touching either copy.
    if !path.exists() && source.exists() {
        fs::rename(&source, path).map_err(|e| e.to_string())?;
    }
    if plain(path) {
        if target.exists() {
            fs::remove_file(&target).map_err(|e| e.to_string())?;
        }
        let original = Connection::open(path).map_err(|e| e.to_string())?;
        // Refuse a newer workspace before changing its physical format.
        let has_table = |name: &str| -> Result<bool> {
            original
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name=?1)",
                    [name],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())
        };
        if has_table("schema_migrations")? {
            let version: i64 = original
                .query_row(
                    "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
                    [],
                    |r| r.get(0),
                )
                .map_err(|e| e.to_string())?;
            if version > 3 {
                return Err("База создана более новой версией Orvim. Она не изменена.".into());
            }
        }
        if has_table("workspace_document")? {
            let version: Option<i64> = original
                .query_row(
                    "SELECT json_extract(settings,'$.version') FROM workspace_document WHERE id=1",
                    [],
                    |r| r.get(0),
                )
                .ok();
            if version.is_some_and(|v| v > 31) {
                return Err("Данные созданы более новой версией Orvim. Они не изменены.".into());
            }
        }
        original
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE); PRAGMA journal_mode=DELETE;")
            .map_err(|e| e.to_string())?;
        let hex = Zeroizing::new(key.iter().map(|b| format!("{b:02x}")).collect::<String>());
        original
            .execute(
                "ATTACH DATABASE ?1 AS encrypted KEY ?2",
                rusqlite::params![target.to_string_lossy(), format!("x'{}'", &*hex)],
            )
            .map_err(|e| e.to_string())?;
        original
            .query_row("SELECT sqlcipher_export('encrypted')", [], |_| Ok(()))
            .map_err(|e| e.to_string())?;
        original
            .execute_batch("DETACH DATABASE encrypted;")
            .map_err(|e| e.to_string())?;
        let checked = keyed(&target, key)?;
        let integrity: String = checked
            .query_row("PRAGMA integrity_check", [], |r| r.get(0))
            .map_err(|e| e.to_string())?;
        if integrity != "ok" {
            return Err(
                "Не пройдена проверка зашифрованной копии. Исходная база сохранена.".into(),
            );
        }
        drop(checked);
        drop(original);
        fs::OpenOptions::new()
            .write(true)
            .open(&target)
            .and_then(|f| f.sync_all())
            .map_err(|e| e.to_string())?;
        fs::rename(path, &source).map_err(|e| e.to_string())?;
        fs::rename(&target, path).map_err(|e| e.to_string())?;
    }
    let connection = keyed(path, key)?;
    if source.exists() {
        fs::remove_file(source).map_err(|e| e.to_string())?;
    }
    Ok(connection)
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Envelope {
    format: String,
    version: u8,
    mode: String,
    salt: String,
    nonce: String,
    ciphertext: String,
}
fn password_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>> {
    if password.len() < 12 || password.len() > 1024 {
        return Err(
            "Пароль копии: от 12 до 1024 байт. Используйте длинную парольную фразу.".into(),
        );
    }
    let params = argon2::Params::new(65536, 3, 1, Some(32)).map_err(|e| e.to_string())?;
    let mut key = Zeroizing::new([0; 32]);
    argon2::Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, &mut *key)
        .map_err(|_| "Не удалось подготовить ключ копии.")?;
    Ok(key)
}
pub fn seal(bytes: &[u8], password: Option<&str>) -> Result<Vec<u8>> {
    let mut salt = [0; 16];
    let mut nonce = [0; 24];
    OsRng.fill_bytes(&mut salt);
    OsRng.fill_bytes(&mut nonce);
    let derived;
    let selected = if let Some(password) = password {
        derived = password_key(password, &salt)?;
        &*derived
    } else {
        key()?
    };
    seal_with_key(
        bytes,
        selected,
        if password.is_some() {
            "password"
        } else {
            "device"
        },
        &salt,
        &nonce,
    )
}
fn seal_with_key(
    bytes: &[u8],
    key: &[u8; 32],
    mode: &str,
    salt: &[u8],
    nonce: &[u8; 24],
) -> Result<Vec<u8>> {
    let ciphertext = XChaCha20Poly1305::new(key.into())
        .encrypt(
            nonce.into(),
            Payload {
                msg: bytes,
                aad: AAD,
            },
        )
        .map_err(|_| "Не удалось зашифровать копию.")?;
    serde_json::to_vec(&Envelope {
        format: "orvim-encrypted-backup".into(),
        version: 1,
        mode: mode.into(),
        salt: B64.encode(salt),
        nonce: B64.encode(nonce),
        ciphertext: B64.encode(ciphertext),
    })
    .map_err(|e| e.to_string())
}
pub fn unseal(bytes: &[u8], password: Option<&str>) -> Result<Zeroizing<Vec<u8>>> {
    if bytes.len() > LIMIT {
        return Err("Копия слишком большая.".into());
    }
    let envelope: Envelope =
        serde_json::from_slice(bytes).map_err(|_| "Неверный формат защищённой копии.")?;
    if envelope.format != "orvim-encrypted-backup" || envelope.version != 1 {
        return Err("Неподдерживаемая версия копии.".into());
    }
    let salt = B64
        .decode(&envelope.salt)
        .map_err(|_| "Повреждена копия.")?;
    let nonce: [u8; 24] = B64
        .decode(&envelope.nonce)
        .map_err(|_| "Повреждена копия.")?
        .try_into()
        .map_err(|_| "Повреждена копия.")?;
    if salt.len() != 16 {
        return Err("Повреждена копия.".into());
    }
    let derived;
    let selected = match envelope.mode.as_str() {
        "password" => {
            derived = password_key(password.ok_or("Введите пароль копии.")?, &salt)?;
            &*derived
        }
        "device" => key()?,
        _ => return Err("Неизвестный способ защиты.".into()),
    };
    let ciphertext = B64
        .decode(&envelope.ciphertext)
        .map_err(|_| "Повреждена копия.")?;
    XChaCha20Poly1305::new(selected.into())
        .decrypt(
            (&nonce).into(),
            Payload {
                msg: &ciphertext,
                aad: AAD,
            },
        )
        .map(Zeroizing::new)
        .map_err(|_| {
            "Неверный пароль, другое устройство или повреждённая копия. Данные не изменены.".into()
        })
}
pub fn is_encrypted(bytes: &[u8]) -> bool {
    serde_json::from_slice::<serde_json::Value>(bytes)
        .is_ok_and(|v| v["format"] == "orvim-encrypted-backup")
}
pub fn write_new(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn production_storage_in_isolated_process() {
        if std::env::var_os("ORVIM_ENCRYPTION_TEST_CHILD").is_none() {
            let status = std::process::Command::new(std::env::current_exe().unwrap())
                .args([
                    "encryption::tests::production_storage_in_isolated_process",
                    "--exact",
                    "--nocapture",
                ])
                .env("ORVIM_ENCRYPTION_TEST_CHILD", "1")
                .status()
                .unwrap();
            assert!(status.success());
            return;
        }
        KEY.set(Zeroizing::new([42; 32])).unwrap();
        let root =
            std::env::temp_dir().join(format!("orvim-production-crypto-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("main.sqlite3");
        let copies = root.join("copies");
        let mut repo = crate::storage::Repository::open_with_backups(&path, &copies).unwrap();
        // Prepare a complete fixture before taking any snapshots. load_workspace
        // seeds a new database and normally creates an initial empty hourly copy.
        repo.last_backup = Some(std::time::Instant::now());
        let mut document = repo.load_workspace().unwrap();
        document.data["thoughts"] = serde_json::json!([{"id":1,"title":"private-repository-sentinel","body":"secret","date":"2026-10-26","context":"Личное"}]);
        document.data["nextId"] = serde_json::json!(2);
        repo.save_workspace(&document).unwrap();
        let copy = repo.backup_now("test").unwrap();
        let restored =
            crate::backups::read_snapshot(&copies, copy.file_name().unwrap().to_str().unwrap())
                .unwrap();
        assert_eq!(restored.data["thoughts"], document.data["thoughts"]);
        drop(repo);
        fs::write(path.with_extension("app-version"), "0.1.0").unwrap();
        let mut reopened = crate::storage::Repository::open_with_backups(&path, &copies).unwrap();
        assert_eq!(
            reopened.load_workspace().unwrap().data["thoughts"],
            document.data["thoughts"]
        );
        drop(reopened);
        for item in crate::backups::list(&copies).unwrap() {
            let name = item["name"].as_str().unwrap();
            let content = fs::read(copies.join(name)).unwrap();
            assert!(!String::from_utf8_lossy(&content).contains("private-repository-sentinel"));
            assert_eq!(
                crate::backups::read_snapshot(&copies, name).unwrap().data["thoughts"],
                document.data["thoughts"]
            );
        }
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn migrates_plain_database_and_reopens_without_plaintext_or_wrong_key() {
        let root = std::env::temp_dir().join(format!("orvim-crypto-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("test.sqlite3");
        let old = Connection::open(&path).unwrap();
        old.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE notes(body TEXT); INSERT INTO notes VALUES('private-test-sentinel');").unwrap();
        drop(old);
        let encrypted = open_with_key(&path, &[7; 32]).unwrap();
        assert_eq!(
            encrypted
                .query_row("SELECT body FROM notes", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "private-test-sentinel"
        );
        encrypted
            .execute_batch(
                "PRAGMA journal_mode=WAL; INSERT INTO notes VALUES('private-wal-sentinel');",
            )
            .unwrap();
        for file in fs::read_dir(&root).unwrap() {
            let bytes = fs::read(file.unwrap().path()).unwrap();
            assert!(!String::from_utf8_lossy(&bytes).contains("private-"));
        }
        drop(encrypted);
        assert!(open_with_key(&path, &[8; 32]).is_err());
        assert!(open_with_key(&path, &[7; 32]).is_ok());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn future_plain_database_is_unchanged_and_interrupted_rename_recovers() {
        let root = std::env::temp_dir().join(format!("orvim-crypto-{}", uuid::Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let path = root.join("test.sqlite3");
        let old = Connection::open(&path).unwrap();
        old.execute_batch("CREATE TABLE schema_migrations(version INTEGER); INSERT INTO schema_migrations VALUES(999);").unwrap();
        drop(old);
        let before = fs::read(&path).unwrap();
        assert!(open_with_key(&path, &[7; 32]).is_err());
        assert_eq!(fs::read(&path).unwrap(), before);
        let old = Connection::open(&path).unwrap();
        old.execute_batch("UPDATE schema_migrations SET version=3; CREATE TABLE notes(body TEXT); INSERT INTO notes VALUES('recovered');").unwrap();
        drop(old);
        fs::rename(&path, path.with_extension("plaintext-migration")).unwrap();
        let recovered = open_with_key(&path, &[7; 32]).unwrap();
        assert_eq!(
            recovered
                .query_row("SELECT body FROM notes", [], |r| r.get::<_, String>(0))
                .unwrap(),
            "recovered"
        );
        drop(recovered);
        assert!(!plain(&path));
        assert!(!path.with_extension("plaintext-migration").exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn portable_backup_checks_password_integrity_and_randomness() {
        let a = seal(b"private-backup", Some("synthetic-password-123")).unwrap();
        let b = seal(b"private-backup", Some("synthetic-password-123")).unwrap();
        assert_ne!(a, b);
        assert!(!String::from_utf8_lossy(&a).contains("private-backup"));
        assert_eq!(
            &*unseal(&a, Some("synthetic-password-123")).unwrap(),
            b"private-backup"
        );
        assert!(unseal(&a, Some("wrong-password-123")).is_err());
        let mut bad: serde_json::Value = serde_json::from_slice(&a).unwrap();
        bad["nonce"] = serde_json::json!(B64.encode([0; 24]));
        assert!(unseal(
            &serde_json::to_vec(&bad).unwrap(),
            Some("synthetic-password-123")
        )
        .is_err());
    }
}
