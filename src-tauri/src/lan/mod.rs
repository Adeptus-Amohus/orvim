mod discovery;
mod file;
mod model;
#[cfg(test)]
mod tests;

mod wire;
use crate::storage::{validate_workspace, WorkspaceDocument, COLLECTIONS};
use base64::{engine::general_purpose::STANDARD as B64, Engine};
use chacha20poly1305::{aead::OsRng, KeyInit, XChaCha20Poly1305};
use model::{Client, Hub, Patch, Result, Stamp};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    net::TcpListener,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc, Mutex,
    },
    thread,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::State;
use uuid::Uuid;
use wire::{Peer, Profile};

const PROTOCOL: u64 = 4;
fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
fn store<T: DeserializeOwned + Default>(path: &Path, key: &str) -> Result<T> {
    let connection = db(path)?;
    let value: Option<String> = connection
        .query_row("SELECT payload FROM state WHERE name=?1", [key], |row| {
            row.get(0)
        })
        .optional()
        .map_err(|e| e.to_string())?;
    match value {
        Some(value) => serde_json::from_str(&value)
            .map_err(|_| "Повреждены данные локальной синхронизации.".into()),
        None => Ok(T::default()),
    }
}
fn db(path: &Path) -> Result<Connection> {
    let connection = crate::encryption::open(path)?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|e| e.to_string())?;
    connection.execute_batch("PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS state(name TEXT PRIMARY KEY,payload TEXT NOT NULL);").map_err(|e|e.to_string())?;
    Ok(connection)
}
fn save(path: &Path, key: &str, value: &impl Serialize) -> Result<()> {
    db(path)?.execute("INSERT INTO state(name,payload) VALUES(?1,?2) ON CONFLICT(name) DO UPDATE SET payload=excluded.payload",params![key,serde_json::to_string(value).map_err(|e|e.to_string())?]).map_err(|e|e.to_string())?;
    Ok(())
}
fn credential<T: DeserializeOwned>(app: &tauri::AppHandle, name: &str) -> Result<Option<T>> {
    crate::connections::secure(app, "get", name, None)?
        .map(|raw| {
            serde_json::from_str(&raw)
                .map_err(|_| "Повреждено сопряжение. Подключите устройство заново.".into())
        })
        .transpose()
}
fn put_credential(app: &tauri::AppHandle, name: &str, value: &impl Serialize) -> Result<()> {
    crate::connections::secure(
        app,
        "set",
        name,
        Some(&serde_json::to_string(value).map_err(|e| e.to_string())?),
    )?;
    Ok(())
}
#[derive(Clone, Serialize, Deserialize)]
struct HostProfile {
    enabled: bool,
    id: String,
    name: String,
    peers: Vec<Peer>,
    local: Peer,
}
impl Default for HostProfile {
    fn default() -> Self {
        let id = Uuid::new_v4().to_string();
        Self {
            enabled: false,
            name: "Orvim · ПК".into(),
            local: Peer {
                id: id.clone(),
                name: "ПК".into(),
                key: B64.encode(XChaCha20Poly1305::generate_key(&mut OsRng)),
                last_seen: 0,
            },
            id,
            peers: vec![],
        }
    }
}
type PersistHost = Arc<dyn Fn(&HostProfile) -> Result<()> + Send + Sync>;
struct HostData {
    profile: HostProfile,
    code: Option<String>,
    expires: i64,
    attempts: u8,
    hub: Hub,
}
struct Host {
    data: Arc<Mutex<HostData>>,
    stop: Arc<AtomicBool>,
}
impl Drop for Host {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}
struct Inner {
    root: PathBuf,
    operation: Mutex<()>,
    host: Mutex<Option<Host>>,
}
#[derive(Clone)]
pub struct Lan(Arc<Inner>);
impl Lan {
    pub fn wipe(&self, app: &tauri::AppHandle) -> Result<()> {
        let _guard = self
            .0
            .operation
            .lock()
            .map_err(|_| "Синхронизация занята.")?;
        let host = self
            .0
            .host
            .lock()
            .map_err(|_| "Синхронизация занята.")?
            .take();
        if let Some(host) = host {
            host.stop.store(true, Ordering::SeqCst);
            // Wait for an in-flight writer before removing its managed journal.
            drop(host.data.lock().map_err(|_| "Синхронизация занята.")?);
        }
        for name in ["lan-peer", "lan-host"] {
            crate::connections::secure(app, "delete", name, None)?;
        }
        for name in [
            "lan-client.sqlite3",
            "lan-client.sqlite3-wal",
            "lan-client.sqlite3-shm",
            "file-client.sqlite3",
            "file-client.sqlite3-wal",
            "file-client.sqlite3-shm",
            "lan-hub.sqlite3",
            "lan-hub.sqlite3-wal",
            "lan-hub.sqlite3-shm",
            "webdav-client.sqlite3",
            "webdav-client.sqlite3-wal",
            "webdav-client.sqlite3-shm",
        ] {
            let path = self.0.root.join(name);
            if path.exists() {
                std::fs::remove_file(path).map_err(|e| e.to_string())?;
            }
        }
        let copies = self.0.root.join("sync-backups");
        for item in crate::backups::list(&copies)? {
            std::fs::remove_file(crate::backups::selected(
                &copies,
                item["name"].as_str().unwrap(),
            )?)
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }
    pub fn new(root: PathBuf) -> Self {
        Self(Arc::new(Inner {
            root,
            operation: Mutex::new(()),
            host: Mutex::new(None),
        }))
    }
    fn client_path(&self) -> PathBuf {
        self.0.root.join("lan-client.sqlite3")
    }
    fn hub_path(&self) -> PathBuf {
        self.0.root.join("lan-hub.sqlite3")
    }
    fn resume(&self, app: &tauri::AppHandle) -> Result<()> {
        #[cfg(target_os = "windows")]
        let needs_resume = self
            .0
            .host
            .lock()
            .map_err(|_| "Недоступен сервер синхронизации.")?
            .is_none();
        #[cfg(target_os = "windows")]
        if needs_resume {
            if let Some(profile) = credential::<HostProfile>(app, "lan-host")? {
                if profile.enabled {
                    self.start(app, profile, false)?;
                }
            }
        }
        let _ = app;
        Ok(())
    }
    fn start(&self, app: &tauri::AppHandle, mut profile: HostProfile, pairing: bool) -> Result<()> {
        if !cfg!(target_os = "windows") {
            return Err("Создайте подключение в Orvim на ПК.".into());
        }
        let mut slot = self
            .0
            .host
            .lock()
            .map_err(|_| "Недоступен сервер синхронизации.")?;
        if let Some(host) = slot.as_ref() {
            if pairing {
                let mut data = host.data.lock().map_err(|_| "Недоступна синхронизация.")?;
                data.code = Some(pair_code());
                data.expires = now() + 300_000;
                data.attempts = 0;
            }
            return Ok(());
        }
        let listener = TcpListener::bind(("0.0.0.0", wire::PORT)).map_err(|_| {
            "Не удалось открыть порт 42673. Он может быть занят другим приложением."
        })?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        profile.enabled = true;
        put_credential(app, "lan-host", &profile)?;
        let hub: Hub = store(&self.hub_path(), "hub")?;
        let data = Arc::new(Mutex::new(HostData {
            profile,
            code: pairing.then(pair_code),
            expires: if pairing { now() + 300_000 } else { 0 },
            attempts: 0,
            hub,
        }));
        let stop = Arc::new(AtomicBool::new(false));
        {
            let d = data.lock().map_err(|_| "Недоступна синхронизация.")?;
            discovery::serve(d.profile.id.clone(), d.profile.name.clone(), stop.clone())?;
        }
        let persist_app = app.clone();
        let persist: PersistHost =
            Arc::new(move |profile| put_credential(&persist_app, "lan-host", profile));
        spawn_server(
            listener,
            data.clone(),
            stop.clone(),
            self.hub_path(),
            persist,
        );
        *slot = Some(Host { data, stop });
        Ok(())
    }
    fn status(&self, app: &tauri::AppHandle) -> Result<Value> {
        let profile = credential::<Profile>(app, "lan-peer")?;
        let slot = self
            .0
            .host
            .lock()
            .map_err(|_| "Недоступна синхронизация.")?;
        let client: Client = store(&self.client_path(), "client")?;
        if let Some(host) = slot.as_ref() {
            let data = host.data.lock().map_err(|_| "Недоступна синхронизация.")?;
            return Ok(
                json!({"mode":"host","connected":true,"id":data.profile.id,"name":data.profile.name,"qr":data.code.as_ref().filter(|_|data.expires>now()).map(|code|discovery::qr(&data.profile.id,&discovery::addresses(),code)),"addresses":discovery::addresses(),"port":wire::PORT,"code":if data.expires>now() {data.code.clone()}else{None},"expires":data.expires,"peers":data.profile.peers.iter().map(|p|json!({"id":p.id,"name":p.name,"lastSeen":p.last_seen})).collect::<Vec<_>>(),"conflicts":data.hub.conflicts.iter().filter(|c|!c.resolved).count(),"lastSync":client.last_sync}),
            );
        }
        Ok(match profile {
            Some(profile) => {
                json!({"mode":"client","connected":true,"address":profile.address,"hostName":profile.host_name,"lastSync":profile.peer.last_seen,"conflicts":client.received.conflicts.iter().filter(|c|!c.resolved).count()})
            }
            None => json!({"mode":"off","connected":false,"conflicts":0}),
        })
    }
    fn exchange(
        &self,
        app: &tauri::AppHandle,
        document: WorkspaceDocument,
        resolve: Option<(String, bool)>,
    ) -> Result<Value> {
        validate_workspace(&document).map_err(|e| e.to_string())?;
        let path = self.client_path();
        let mut client: Client = store(&path, "client")?;
        if !client.backed_up {
            crate::backups::write_snapshot(
                &self.0.root.join("sync-backups"),
                &document,
                "before-lan",
            )?;
            client.backed_up = true;
        }
        let slot = self
            .0
            .host
            .lock()
            .map_err(|_| "Недоступна синхронизация.")?;
        let mut profile = credential::<Profile>(app, "lan-peer")?;
        let hub = if let Some(host) = slot.as_ref() {
            let mut data = host.data.lock().map_err(|_| "Недоступна синхронизация.")?;
            client.device = data.profile.local.id.clone();
            let patches = client.export(&document)?;
            save(&path, "client", &client)?;
            apply_hub(
                &self.hub_path(),
                &mut data.hub,
                &patches,
                &client.device,
                resolve,
            )?;
            data.hub.clone()
        } else {
            let peer = profile.as_mut().ok_or("Сначала подключите телефон к ПК.")?;
            client.device = peer.peer.id.clone();
            let patches = client.export(&document)?;
            save(&path, "client", &client)?;
            let result = wire::exchange(peer, &client.device, client.generation, patches, resolve)?;
            peer.peer.last_seen = now();
            put_credential(app, "lan-peer", peer)?;
            result.hub.unwrap_or_else(|| client.received.clone())
        };
        drop(slot);
        let conflicts = hub
            .conflicts
            .iter()
            .filter(|c| !c.resolved)
            .cloned()
            .collect::<Vec<_>>();
        let (merged, receipt) = client.stage(hub, &document)?;
        let comparison = client.comparison(&document)?;
        save(&path, "client", &client)?;
        Ok(
            json!({"document":merged,"receipt":receipt,"comparison":comparison,"conflicts":conflicts,"syncedAt":now()}),
        )
    }
    fn action(
        &self,
        app: &tauri::AppHandle,
        operation: &str,
        args: Value,
        document: Option<WorkspaceDocument>,
    ) -> Result<Value> {
        let _guard = self
            .0
            .operation
            .lock()
            .map_err(|_| "Синхронизация занята.")?;
        std::fs::create_dir_all(&self.0.root).map_err(|e| e.to_string())?;
        if operation.starts_with("file") {
            return file::action(&self.0.root, operation, &args, document.as_ref());
        }
        if operation != "stop" {
            self.resume(app)?;
        }
        match operation {
            "status" => self.status(app),
            "discover" => discovery::discover(),
            "review" => {
                let mut client: Client = store(&self.client_path(), "client")?;
                let rejected: Vec<String> = serde_json::from_value(args["rejected"].clone())
                    .map_err(|_| "Некорректный выбор сравнения.")?;
                let both: Vec<String> =
                    serde_json::from_value(args.get("both").cloned().unwrap_or(json!([])))
                        .map_err(|_| "Некорректный выбор версий.")?;
                let (merged, receipt) = client.review_with_both(
                    args["receipt"].as_str().unwrap_or(""),
                    &rejected,
                    &both,
                    document.as_ref().ok_or("Нет локальных данных.")?,
                )?;
                save(&self.client_path(), "client", &client)?;
                Ok(json!({"document":merged,"receipt":receipt}))
            }
            "host" => {
                let profile = credential::<HostProfile>(app, "lan-host")?.unwrap_or_default();
                let client: Client = store(&self.client_path(), "client")?;
                if client.device != profile.local.id {
                    save(
                        &self.client_path(),
                        "client",
                        &Client {
                            device: profile.local.id.clone(),
                            ..Client::default()
                        },
                    )?;
                }
                self.start(app, profile, true)?;
                self.status(app)
            }
            "address" => {
                let mut profile =
                    credential::<Profile>(app, "lan-peer")?.ok_or("Сначала подключитесь к ПК.")?;
                profile.address =
                    wire::address(args["address"].as_str().unwrap_or(""))?.to_string();
                put_credential(app, "lan-peer", &profile)?;
                self.status(app)
            }
            "pair" => {
                if self
                    .0
                    .host
                    .lock()
                    .map_err(|_| "Недоступна синхронизация.")?
                    .is_some()
                {
                    return Err("Сначала выключите подключение ПК.".into());
                }
                let address = wire::address(args["address"].as_str().unwrap_or(""))?;
                let profile = wire::pair_client(
                    address,
                    args["code"].as_str().unwrap_or(""),
                    args["name"].as_str().unwrap_or("Телефон"),
                )?;
                if args["expectedId"]
                    .as_str()
                    .is_some_and(|id| !id.is_empty() && id != profile.host_id)
                {
                    return Err("Идентификатор ПК не совпал. Не сохраняем подключение; повторите обнаружение.".into());
                }
                let old = credential::<Profile>(app, "lan-peer")?;
                let mut client: Client = store(&self.client_path(), "client")?;
                if old.as_ref().is_none_or(|p| p.host_id != profile.host_id) {
                    client = Client::default();
                }
                client.device = profile.peer.id.clone();
                client.pending.clear();
                client.staged = None;
                save(&self.client_path(), "client", &client)?;
                put_credential(app, "lan-peer", &profile)?;
                self.status(app)
            }
            "exchange" | "resolve" => self.exchange(
                app,
                document.ok_or("Нет данных для обмена.")?,
                if operation == "resolve" {
                    Some((
                        args["id"].as_str().unwrap_or("").into(),
                        args["alternative"].as_bool().unwrap_or(false),
                    ))
                } else {
                    None
                },
            ),
            "ack" => {
                let mut client: Client = store(&self.client_path(), "client")?;
                client.acknowledge(args["receipt"].as_str().unwrap_or(""))?;
                client.last_sync = now();
                save(&self.client_path(), "client", &client)?;
                Ok(json!({"saved":true}))
            }
            "revoke" => {
                let slot = self
                    .0
                    .host
                    .lock()
                    .map_err(|_| "Недоступна синхронизация.")?;
                let host = slot.as_ref().ok_or("Подключение ПК выключено.")?;
                let mut data = host.data.lock().map_err(|_| "Недоступна синхронизация.")?;
                let mut profile = data.profile.clone();
                profile
                    .peers
                    .retain(|p| Some(p.id.as_str()) != args["id"].as_str());
                put_credential(app, "lan-host", &profile)?;
                data.profile = profile;
                drop(data);
                drop(slot);
                self.status(app)
            }
            "stop" => {
                if let Some(host) = self
                    .0
                    .host
                    .lock()
                    .map_err(|_| "Недоступна синхронизация.")?
                    .take()
                {
                    let mut profile = host
                        .data
                        .lock()
                        .map_err(|_| "Недоступна синхронизация.")?
                        .profile
                        .clone();
                    profile.enabled = false;
                    put_credential(app, "lan-host", &profile)?;
                    drop(host);
                }
                crate::connections::secure(app, "delete", "lan-peer", None)?;
                Ok(json!({"mode":"off","connected":false}))
            }
            _ => Err("Неизвестное действие синхронизации.".into()),
        }
    }
}
#[tauri::command]
pub async fn lan_sync(
    app: tauri::AppHandle,
    service: State<'_, Lan>,
    operation: String,
    args: Value,
    document: Option<WorkspaceDocument>,
) -> Result<Value> {
    let service = service.inner().clone();
    tauri::async_runtime::spawn_blocking(move || service.action(&app, &operation, args, document))
        .await
        .map_err(|e| e.to_string())?
}
fn pair_code() -> String {
    let bytes = Uuid::new_v4();
    let raw = u64::from_le_bytes(bytes.as_bytes()[..8].try_into().unwrap());
    format!("{:08}", raw % 100_000_000)
}
fn seed() -> WorkspaceDocument {
    let mut data = json!({"version":32,"nextId":1,"archiveCategories":[],"waterTarget":2000,"foodTarget":0,"uiPreferences":{}});
    for c in COLLECTIONS {
        data[c] = json!([]);
    }
    WorkspaceDocument {
        revision: 0,
        data,
        covers: vec![],
    }
}
fn apply_hub(
    path: &Path,
    hub: &mut Hub,
    patches: &[Patch],
    device: &str,
    resolve: Option<(String, bool)>,
) -> Result<()> {
    let mut next = hub.clone();
    let mut changes = patches.to_vec();
    if let Some((id, alternative)) = resolve {
        let conflict = next
            .conflicts
            .iter()
            .find(|c| c.id == id && !c.resolved)
            .cloned()
            .ok_or("Конфликт уже разобран.")?;
        let entity = next
            .entities
            .get(&format!("{}/{}", conflict.collection, conflict.uid))
            .ok_or("Запись не найдена.")?;
        changes.push(Patch {
            collection: conflict.collection.clone(),
            uid: conflict.uid.clone(),
            field: conflict.field.clone(),
            value: if alternative {
                conflict.alternative
            } else {
                conflict.kept
            },
            stamp: Stamp {
                clock: next
                    .clock
                    .max(patches.iter().map(|p| p.stamp.clock).max().unwrap_or(0))
                    + 1,
                device: device.into(),
            },
            observed: next.clock,
            base: entity.fields.get(&conflict.field).map(|c| c.stamp.clone()),
        });
        next.conflicts
            .iter_mut()
            .filter(|c| c.id == id)
            .for_each(|c| c.resolved = true);
        next.generation += 1;
    }
    let changed = next.merge(&changes, device)?;
    next.document(&seed())?;
    if changed || next.generation != hub.generation {
        save(path, "hub", &next)?;
        *hub = next;
    }
    Ok(())
}
fn spawn_server(
    listener: TcpListener,
    data: Arc<Mutex<HostData>>,
    stop: Arc<AtomicBool>,
    path: PathBuf,
    persist: PersistHost,
) {
    let active = Arc::new(AtomicUsize::new(0));
    thread::spawn(move || {
        while !stop.load(Ordering::SeqCst) {
            match listener.accept() {
                Ok((mut stream, address)) => {
                    if !wire::private(address.ip()) || active.load(Ordering::SeqCst) >= 4 {
                        continue;
                    }
                    active.fetch_add(1, Ordering::SeqCst);
                    let (data, path, persist, active, stop) = (
                        data.clone(),
                        path.clone(),
                        persist.clone(),
                        active.clone(),
                        stop.clone(),
                    );
                    thread::spawn(move || {
                        let result = (|| -> Result<()> {
                            wire::timeouts(&stream)?;
                            let hello = wire::read_small(&mut stream)?;
                            if hello["protocol"].as_u64() != Some(PROTOCOL) {
                                return Err(
                                    "Нужна одинаковая версия Orvim на обоих устройствах.".into()
                                );
                            }
                            if hello["operation"] == "pair" {
                                let (code, host_id, host_name) = {
                                    let mut d =
                                        data.lock().map_err(|_| "Недоступна синхронизация.")?;
                                    if d.expires < now()
                                        || d.attempts >= 5
                                        || d.profile.peers.len() >= 8
                                    {
                                        return Err(
                                            "Код истёк. На ПК нажмите «Добавить устройство»."
                                                .into(),
                                        );
                                    }
                                    d.attempts += 1;
                                    (
                                        d.code.clone().ok_or("Сопряжение закрыто.")?,
                                        d.profile.id.clone(),
                                        d.profile.name.clone(),
                                    )
                                };
                                let (peer, challenge) =
                                    wire::pair_host(&mut stream, &hello, &code)?;
                                let mut d = data.lock().map_err(|_| "Недоступна синхронизация.")?;
                                if stop.load(Ordering::SeqCst)
                                    || d.code.as_ref() != Some(&code)
                                    || d.expires < now()
                                {
                                    return Err("Код истёк.".into());
                                }
                                let mut profile = d.profile.clone();
                                profile.peers.push(peer.clone());
                                persist(&profile)?;
                                d.profile = profile;
                                d.code = None;
                                d.expires = 0;
                                wire::confirm_pair(
                                    &mut stream,
                                    &peer,
                                    &challenge,
                                    &host_id,
                                    &host_name,
                                )?;
                            } else if hello["operation"] == "sync" {
                                let peer = {
                                    let d = data.lock().map_err(|_| "Недоступна синхронизация.")?;
                                    d.profile
                                        .peers
                                        .iter()
                                        .find(|p| Some(p.id.as_str()) == hello["peer"].as_str())
                                        .cloned()
                                        .ok_or(
                                            "Устройство отключено. Выполните сопряжение заново.",
                                        )?
                                };
                                let challenge = Uuid::new_v4().to_string();
                                wire::write(&mut stream, &json!({"challenge":challenge}))?;
                                let request: wire::Request = wire::unseal(
                                    &peer.key,
                                    &format!("LifeOS LAN request v1 {}", peer.id),
                                    wire::read(&mut stream)?,
                                )?;
                                if request.challenge != challenge || request.device != peer.id {
                                    return Err("Неверное подтверждение устройства.".into());
                                }
                                let mut d = data.lock().map_err(|_| "Недоступна синхронизация.")?;
                                if stop.load(Ordering::SeqCst)
                                    || !d.profile.peers.iter().any(|p| p.id == peer.id)
                                {
                                    return Err("Устройство отключено.".into());
                                }
                                apply_hub(
                                    &path,
                                    &mut d.hub,
                                    &request.patches,
                                    &request.device,
                                    request.resolve,
                                )?;
                                if let Some(p) =
                                    d.profile.peers.iter_mut().find(|p| p.id == peer.id)
                                {
                                    p.last_seen = now();
                                }
                                let response = wire::Response {
                                    challenge,
                                    hub: (request.generation != d.hub.generation)
                                        .then(|| d.hub.clone()),
                                    generation: d.hub.generation,
                                    conflicts: d
                                        .hub
                                        .conflicts
                                        .iter()
                                        .filter(|c| !c.resolved)
                                        .count(),
                                };
                                wire::write(
                                    &mut stream,
                                    &wire::seal(
                                        &peer.key,
                                        &format!("LifeOS LAN response v1 {}", peer.id),
                                        &response,
                                    )?,
                                )?;
                            } else {
                                return Err("Неизвестный запрос.".into());
                            }
                            Ok(())
                        })();
                        if let Err(error) = result {
                            #[cfg(test)]
                            eprintln!("LAN test server: {error}");
                            let _ = wire::write(&mut stream, &json!({"error":error}));
                        }
                        active.fetch_sub(1, Ordering::SeqCst);
                    });
                }
                Err(error) if error.kind() == std::io::ErrorKind::WouldBlock => {
                    thread::sleep(Duration::from_millis(100))
                }
                Err(_) => break,
            }
        }
    });
}
