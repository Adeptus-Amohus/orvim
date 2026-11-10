//! A release is installable only after verification with the compiled trust key.
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use ed25519_dalek::{Signature, VerifyingKey};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};
use tauri::{Emitter, Manager};
type Result<T> = std::result::Result<T, String>;
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Package {
    url: String,
    sha256: String,
    size: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Release {
    version: String,
    notes: String,
    schema_min: u64,
    schema_max: u64,
    workspace_max: u64,
    platforms: BTreeMap<String, Package>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Manifest {
    manifest_version: u64,
    releases: Vec<Release>,
}
#[derive(Default)]
pub struct Updates {
    verified: Mutex<Option<Manifest>>,
    busy: Mutex<()>,
}
fn repository() -> &'static str {
    option_env!("ORVIM_UPDATE_REPOSITORY")
        .filter(|value| {
            value.split('/').count() == 2
                && value
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b"-._/".contains(&b))
        })
        .unwrap_or("Adeptus-Amohus/life-os")
}
fn release_url() -> String {
    format!("https://github.com/{}/releases/latest", repository())
}
fn public_key() -> Result<String> {
    Ok(option_env!("ORVIM_UPDATE_PUBLIC_KEY")
        .or(option_env!("LIFE_OS_UPDATE_PUBLIC_KEY"))
        .filter(|key| !key.is_empty())
        .unwrap_or(include_str!("../update-public-key.txt").trim())
        .to_owned())
}

fn verify(bytes: &[u8], key: &str) -> Result<Manifest> {
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("Манифест обновления слишком большой.".into());
    }
    let envelope: Value =
        serde_json::from_slice(bytes).map_err(|_| "Некорректный манифест обновления.")?;
    let payload = B64
        .decode(
            envelope["payload"]
                .as_str()
                .ok_or("Нет подписанного содержимого.")?,
        )
        .map_err(|_| "Повреждён манифест.")?;
    let signature = B64
        .decode(
            envelope["signature"]
                .as_str()
                .ok_or("Нет подписи обновления.")?,
        )
        .map_err(|_| "Повреждена подпись.")?;
    let key: [u8; 32] = B64
        .decode(key)
        .map_err(|_| "Некорректный ключ обновлений.")?
        .try_into()
        .map_err(|_| "Некорректный ключ обновлений.")?;
    let verifier = VerifyingKey::from_bytes(&key).map_err(|_| "Некорректный ключ обновлений.")?;
    verifier
        .verify_strict(
            &payload,
            &Signature::from_slice(&signature).map_err(|_| "Некорректная подпись.")?,
        )
        .map_err(|_| "Подлинность обновления не подтверждена. Установка запрещена.")?;
    let manifest: Manifest =
        serde_json::from_slice(&payload).map_err(|_| "Неподдерживаемый формат обновления.")?;
    if manifest.manifest_version != 1 || manifest.releases.len() > 100 {
        return Err("Неподдерживаемый манифест.".into());
    }
    let mut versions = std::collections::BTreeSet::new();
    for release in &manifest.releases {
        semver::Version::parse(&release.version).map_err(|_| "Некорректная версия.")?;
        if !versions.insert(&release.version) || release.schema_min > release.schema_max {
            return Err("Повторная версия или некорректная схема.".into());
        }
        for package in release.platforms.values() {
            let url =
                reqwest::Url::parse(&package.url).map_err(|_| "Некорректная ссылка пакета.")?;
            if url.scheme() != "https"
                || !url.username().is_empty()
                || url.password().is_some()
                || package.size == 0
                || package.size > 500 * 1024 * 1024
                || package.sha256.len() != 64
                || !package.sha256.bytes().all(|b| b.is_ascii_hexdigit())
            {
                return Err("Некорректный пакет обновления.".into());
            }
        }
    }
    Ok(manifest)
}
fn target() -> String {
    format!("{}-{}", std::env::consts::OS, std::env::consts::ARCH)
}
fn root(app: &tauri::AppHandle) -> Result<PathBuf> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|e| e.to_string())?
        .join("updates"))
}
fn manifest(app: &tauri::AppHandle, service: &Updates) -> Result<Manifest> {
    if let Some(value) = service
        .verified
        .lock()
        .map_err(|_| "Обновление занято.")?
        .clone()
    {
        return Ok(value);
    }
    let bytes = std::fs::read(root(app)?.join("manifest.json"))
        .map_err(|_| "Сначала проверьте обновления.")?;
    verify(&bytes, &public_key()?)
}
fn selected(manifest: &Manifest, version: &str) -> Result<Release> {
    manifest
        .releases
        .iter()
        .find(|r| r.version == version && r.platforms.contains_key(&target()))
        .cloned()
        .ok_or("Для этой платформы нет подписанного пакета выбранной версии.".into())
}
fn package_path(app: &tauri::AppHandle, release: &Release) -> Result<PathBuf> {
    Ok(root(app)?.join(format!(
        "orvim-{}-{}.{}",
        release.version,
        target(),
        if cfg!(target_os = "android") {
            "apk"
        } else {
            "exe"
        }
    )))
}
fn checked_file(path: &Path, package: &Package) -> Result<()> {
    let metadata = std::fs::symlink_metadata(path).map_err(|_| "Пакет ещё не загружен.")?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() != package.size {
        return Err("Пакет повреждён. Загрузите снова.".into());
    }
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new();
    let mut buffer = [0; 65536];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        hash.update(&buffer[..n]);
    }
    if format!("{:x}", hash.finalize()) != package.sha256.to_lowercase() {
        return Err("Хеш пакета не совпал с подписанным манифестом. Установка запрещена.".into());
    }
    Ok(())
}
fn check(app: &tauri::AppHandle, service: &Updates) -> Result<Value> {
    let key = match public_key() {
        Ok(key) => key,
        Err(_) => return check_public_release(),
    };
    let default_endpoint = format!("{}/download/orvim-updates.json", release_url());
    let endpoint = option_env!("ORVIM_UPDATE_MANIFEST_URL")
        .or(option_env!("LIFE_OS_UPDATE_MANIFEST_URL"))
        .filter(|url| !url.is_empty())
        .unwrap_or(&default_endpoint);
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let mut endpoints = vec![endpoint.to_owned()];
    if option_env!("ORVIM_UPDATE_REPOSITORY").is_none()
        && option_env!("ORVIM_UPDATE_MANIFEST_URL").is_none()
    {
        endpoints.push("https://github.com/Adeptus-Amohus/orvim-updates/releases/latest/download/orvim-updates.json".into());
    }
    let mut found = None;
    for endpoint in endpoints {
        let url = reqwest::Url::parse(&endpoint).map_err(|_| "Некорректный адрес обновлений.")?;
        if url.scheme() != "https" {
            return Err("Манифест должен загружаться по HTTPS.".into());
        }
        let response = client
            .get(url)
            .send()
            .map_err(|_| "Не удалось проверить обновления. Проверьте сеть.")?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            continue;
        }
        found = Some(response);
        break;
    }
    let Some(response) = found else {
        return check_public_release();
    };
    let response = response
        .error_for_status()
        .map_err(|_| "Подписанный манифест не опубликован в GitHub Releases.")?;
    let mut bytes = Vec::new();
    response
        .take(2 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| e.to_string())?;
    let manifest = verify(&bytes, &key)?;
    std::fs::create_dir_all(root(app)?).map_err(|e| e.to_string())?;
    std::fs::write(root(app)?.join("manifest.json"), bytes).map_err(|e| e.to_string())?;
    *service.verified.lock().map_err(|_| "Обновление занято.")? = Some(manifest.clone());
    let mut releases = manifest
        .releases
        .into_iter()
        .filter(|r| r.platforms.contains_key(&target()))
        .collect::<Vec<_>>();
    releases.sort_by(|a, b| {
        semver::Version::parse(&b.version)
            .unwrap()
            .cmp(&semver::Version::parse(&a.version).unwrap())
    });
    let current = semver::Version::parse(env!("CARGO_PKG_VERSION")).unwrap();
    let newer = releases
        .iter()
        .any(|r| semver::Version::parse(&r.version).is_ok_and(|v| v > current));
    let releases = releases
        .iter()
        .map(|release| {
            let mut value = serde_json::to_value(release).unwrap();
            value["newer"] =
                json!(semver::Version::parse(&release.version).is_ok_and(|v| v > current));
            value
        })
        .collect::<Vec<_>>();
    Ok(
        json!({"configured":true,"installed":env!("CARGO_PKG_VERSION"),"platform":target(),"releases":releases,"updateAvailable":newer,"checkedAt":chrono::Utc::now().to_rfc3339(),"message":if newer {"Доступна новая версия."} else {"Новых опубликованных версий для этого устройства нет."}}),
    )
}

// Public release metadata is informational only. It never authorizes downloads
// or execution; those still require the separately signed manifest above.
fn check_public_release() -> Result<Value> {
    let client = reqwest::blocking::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .user_agent("Orvim update checker")
        .build()
        .map_err(|e| e.to_string())?;
    let mut sources = vec![repository()];
    if !sources.contains(&"Adeptus-Amohus/orvim-updates") {
        sources.push("Adeptus-Amohus/orvim-updates");
    }
    for release_repository in sources {
        let response = client
            .get(format!(
                "https://api.github.com/repos/{release_repository}/releases/latest"
            ))
            .send()
            .map_err(|_| "Не удалось связаться с GitHub. Проверьте интернет.")?;
        if response.status() == reqwest::StatusCode::NOT_FOUND {
            continue;
        }
        if response.status() == reqwest::StatusCode::FORBIDDEN
            || response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS
        {
            return Err("Сервер временно ограничил проверки. Попробуйте позже.".into());
        }
        let response = response
            .error_for_status()
            .map_err(|_| "Сервер обновлений временно недоступен.")?;
        let mut bytes = Vec::new();
        response
            .take(1024 * 1024 + 1)
            .read_to_end(&mut bytes)
            .map_err(|_| "Не удалось прочитать ответ сервера.")?;
        if bytes.len() > 1024 * 1024 {
            return Err("Ответ сервера обновлений слишком большой.".into());
        }
        let release: Value =
            serde_json::from_slice(&bytes).map_err(|_| "Некорректный ответ сервера обновлений.")?;
        let tag = release["tag_name"]
            .as_str()
            .unwrap_or_default()
            .trim_start_matches('v');
        let version = semver::Version::parse(tag)
            .map_err(|_| "В опубликованном выпуске не указан корректный номер версии.")?;
        let newer = version > semver::Version::parse(env!("CARGO_PKG_VERSION")).unwrap();
        return Ok(
            json!({"configured":false,"installed":env!("CARGO_PKG_VERSION"),"latest":version.to_string(),"updateAvailable":newer,"manualUrl":format!("https://github.com/{release_repository}/releases/latest"),"checkedAt":chrono::Utc::now().to_rfc3339(),"message":if newer {format!("Доступна версия {version}. Откройте страницу выпуска для ручной установки. Автоматический канал ещё не подключён.")} else {"Новых публичных выпусков нет. Автоматический канал установки ещё не подключён.".into()}}),
        );
    }
    Ok(
        json!({"configured":false,"installed":env!("CARGO_PKG_VERSION"),"message":"GitHub вернул 404: официальный канал закрыт или выпуски ещё не опубликованы. Это не означает, что установлена последняя версия."}),
    )
}

fn download(app: &tauri::AppHandle, service: &Updates, version: &str) -> Result<Value> {
    let release = selected(&manifest(app, service)?, version)?;
    let package = &release.platforms[&target()];
    let path = package_path(app, &release)?;
    if checked_file(&path, package).is_ok() {
        return Ok(json!({"downloaded":true,"version":version}));
    }
    std::fs::create_dir_all(root(app)?).map_err(|e| e.to_string())?;
    let partial = path.with_extension("partial");
    let result = (|| {
        let client = reqwest::blocking::Client::builder()
            .timeout(std::time::Duration::from_secs(180))
            .build()
            .map_err(|e| e.to_string())?;
        let mut response = client
            .get(&package.url)
            .send()
            .map_err(|_| "Не удалось загрузить обновление.")?
            .error_for_status()
            .map_err(|_| "Пакет недоступен.")?;
        let mut file = std::fs::File::create(&partial).map_err(|e| e.to_string())?;
        let mut received = 0;
        let mut buffer = [0; 65536];
        let mut emitted = 0;
        loop {
            let n = response
                .read(&mut buffer)
                .map_err(|_| "Загрузка прервана. Можно повторить.")?;
            if n == 0 {
                break;
            }
            received += n as u64;
            if received > package.size {
                return Err("Размер пакета не совпал.".into());
            }
            file.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
            if received - emitted > 1024 * 1024 {
                let _ = app.emit(
                    "life-os:update-progress",
                    json!({"version":version,"received":received,"total":package.size}),
                );
                emitted = received;
            }
        }
        file.sync_all().map_err(|e| e.to_string())?;
        drop(file);
        checked_file(&partial, package)?;
        std::fs::rename(&partial, &path).map_err(|e| e.to_string())?;
        let _ = app.emit(
            "life-os:update-progress",
            json!({"version":version,"received":received,"total":package.size}),
        );
        Ok(json!({"downloaded":true,"version":version}))
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(partial);
    }
    result
}
#[tauri::command]
pub async fn update_action(
    app: tauri::AppHandle,
    service: tauri::State<'_, Updates>,
    database: tauri::State<'_, crate::commands::Database>,
    operation: String,
    version: Option<String>,
) -> Result<Value> {
    if operation == "status" {
        return Ok(
            json!({"installed":env!("CARGO_PKG_VERSION"),"configured":public_key().is_ok()}),
        );
    }
    if operation == "install" {
        let release = selected(
            &manifest(&app, &service)?,
            version.as_deref().ok_or("Выберите версию.")?,
        )?;
        // Installed schema is 3 / document format 31. No old binary may be
        // launched against a schema it does not declare support for.
        if release.schema_min > 3 || release.schema_max < 3 || release.workspace_max < 32 {
            return Err("Эта версия несовместима с текущей базой. Автоматический откат запрещён; сначала восстановите совместимую копию и подтвердите потерю более поздних изменений.".into());
        }
        let path = package_path(&app, &release)?;
        checked_file(&path, &release.platforms[&target()])?;
        let rollback = semver::Version::parse(&release.version).unwrap()
            < semver::Version::parse(env!("CARGO_PKG_VERSION")).unwrap();
        database
            .run(move |repo| {
                repo.backup_now(if rollback {
                    "before-rollback"
                } else {
                    "before-update"
                })?;
                Ok(())
            })
            .await?;
        crate::commands::mirror_backup(&app, &database).await;
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new(&path)
                .arg("/UPDATE")
                .spawn()
                .map_err(|_| {
                    "Не удалось запустить установщик. Разрешите системное подтверждение."
                })?;
            app.exit(0);
            return Ok(json!({"installerOpened":true}));
        }
        #[cfg(target_os = "android")]
        {
            return crate::platform::call(
                &app,
                "installPackage",
                json!({"path":path.to_string_lossy(),"rollback":rollback}),
            );
        }
        #[cfg(not(any(target_os = "windows", target_os = "android")))]
        return Err("Эта платформа не поддерживается.".into());
    }
    let app_copy = app.clone();
    let operation_copy = operation.clone();
    let version_copy = version.clone();
    // Run network/file work off the UI thread; serialize check/download only.
    tauri::async_runtime::spawn_blocking(move || {
        let service = app_copy.state::<Updates>();
        let _guard = service.busy.lock().map_err(|_| "Обновление занято.")?;
        match operation_copy.as_str() {
            "check" => check(&app_copy, &service),
            "download" => download(
                &app_copy,
                &service,
                version_copy.as_deref().ok_or("Выберите версию.")?,
            ),
            _ => Err("Неизвестное действие обновления.".into()),
        }
    })
    .await
    .map_err(|e| e.to_string())?
}
#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::{Signer, SigningKey};
    #[test]
    fn only_authentic_manifest_and_matching_package_are_accepted() {
        let signer = SigningKey::from_bytes(&[7; 32]);
        let key = B64.encode(signer.verifying_key().as_bytes());
        let manifest = json!({"manifest_version":1,"releases":[{"version":"0.4.0","notes":"test","schema_min":3,"schema_max":3,"workspace_max":30,"platforms":{"windows-x86_64":{"url":"https://example.org/app.exe","sha256":format!("{:x}",Sha256::digest(b"test")),"size":4}}}]});
        let payload = serde_json::to_vec(&manifest).unwrap();
        let signature = signer.sign(&payload);
        let envelope = serde_json::to_vec(
            &json!({"payload":B64.encode(&payload),"signature":B64.encode(signature.to_bytes())}),
        )
        .unwrap();
        assert!(verify(&envelope, &key).is_ok());
        assert!(verify(
            &envelope,
            &B64.encode(SigningKey::from_bytes(&[8; 32]).verifying_key().as_bytes())
        )
        .is_err());
        let mut changed = envelope.clone();
        changed[30] ^= 1;
        assert!(verify(&changed, &key).is_err());
        let path =
            std::env::temp_dir().join(format!("lifeos-update-test-{}", uuid::Uuid::new_v4()));
        std::fs::write(&path, b"test").unwrap();
        let package: Package =
            serde_json::from_value(manifest["releases"][0]["platforms"]["windows-x86_64"].clone())
                .unwrap();
        assert!(checked_file(&path, &package).is_ok());
        std::fs::write(&path, b"evil").unwrap();
        assert!(checked_file(&path, &package).is_err());
        std::fs::remove_file(path).unwrap();
    }
}
