use super::*;
use model::numeric_id;
use std::net::TcpStream;

#[test]
fn rejected_remote_record_and_edit_are_durable_and_not_sent_back() {
    let (mut a, mut b, mut hub) = (Client::default(), Client::default(), Hub::default());
    let original = roundtrip(&mut a, &mut hub, &document("Маршрут"));
    let local = roundtrip(&mut b, &mut hub, &original);
    let mut changed = original.clone();
    changed.data["tasks"][0]["title"] = json!("Изменено на ПК");
    changed.data["thoughts"] = json!([{"id":4,"title":"Новая мысль","body":"Содержание","context":"Личное","date":"2026-10-07"}]);
    roundtrip(&mut a, &mut hub, &changed);
    let (_, token) = b.stage(hub.clone(), &local).unwrap();
    let keys = hub
        .entities
        .values()
        .filter(|e| e.collection == "tasks" || e.collection == "thoughts")
        .map(|e| format!("{}/{}", e.collection, e.uid))
        .collect::<Vec<_>>();
    let (retained, token) = b.review(&token, &keys, &local).unwrap();
    b.acknowledge(&token).unwrap();
    assert_eq!(retained.data["tasks"][0]["title"], "Маршрут");
    assert!(retained.data["thoughts"].as_array().unwrap().is_empty());
    let bytes = serde_json::to_vec(&b).unwrap();
    let mut b: Client = serde_json::from_slice(&bytes).unwrap();
    assert!(
        b.export(&retained).unwrap().is_empty(),
        "rejection must not be an outgoing operation"
    );
    let repeated = roundtrip(&mut b, &mut hub, &retained);
    assert_eq!(repeated.data["tasks"], retained.data["tasks"]);
    assert!(repeated.data["thoughts"].as_array().unwrap().is_empty());
    assert_eq!(
        hub.document(&local).unwrap().data["tasks"][0]["title"],
        "Изменено на ПК"
    );
}

pub(super) fn document(title: &str) -> WorkspaceDocument {
    let mut doc = seed();
    doc.data["tasks"] = json!([{ "id":1,"title":title,"description":"","context":"Поездка","date":"2026-10-07","done":false }]);
    doc.data["projects"] = json!([{ "id":2,"name":"Поездка","description":"","tone":"sun" }]);
    doc.data["archiveCategories"] = json!(["Книги"]);
    doc.data["connectionSettings"] = json!({"aiProvider":"openai","aiModel":"local-only"});
    doc.data["palette"] = json!("sun");
    doc
}
#[test]
fn duplicate_names_and_repeat_markers_keep_records_links_and_stable_identities() {
    let (mut client, mut hub) = (Client::default(), Hub::default());
    let mut original = document("Первая задача");
    original.data["projects"]
        .as_array_mut()
        .unwrap()
        .push(json!({
            "id":3,"name":"Поездка","description":"Второй проект","tone":"sun"
        }));
    original.data["tasks"][0]["projectId"] = json!(2);
    original.data["tasks"][0]["repeatInstanceKey"] = json!("repeat:2026-10-07");
    original.data["tasks"].as_array_mut().unwrap().push(json!({
        "id":4,"title":"Вторая задача","context":"Поездка","projectId":3,
        "date":"2026-10-07","done":false,"repeatInstanceKey":"repeat:2026-10-07"
    }));
    let patches = client.export(&original).unwrap();
    let bytes = serde_json::to_vec(&client).unwrap();
    let mut client: Client = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(
        serde_json::to_value(client.export(&original).unwrap()).unwrap(),
        serde_json::to_value(patches).unwrap()
    );
    let merged = roundtrip(&mut client, &mut hub, &original);
    for collection in ["tasks", "projects"] {
        let rows = merged.data[collection].as_array().unwrap();
        assert_eq!(rows.len(), 2);
        assert_ne!(rows[0]["_syncId"], rows[1]["_syncId"]);
        assert_ne!(rows[0]["id"], rows[1]["id"]);
    }
    let tasks = merged.data["tasks"].as_array().unwrap();
    assert_ne!(tasks[0]["projectId"], tasks[1]["projectId"]);
    for task in tasks {
        assert!(merged.data["projects"]
            .as_array()
            .unwrap()
            .iter()
            .any(|p| p["id"] == task["projectId"]));
    }
    let repeated = roundtrip(&mut client, &mut hub, &merged);
    assert_eq!(repeated.data["tasks"], merged.data["tasks"]);
    assert!(client.export(&repeated).unwrap().is_empty());
}
#[test]
fn stale_alias_cannot_replace_canonical_identity_even_when_it_comes_first() {
    let (mut client, mut hub) = (Client::default(), Hub::default());
    let original = roundtrip(&mut client, &mut hub, &document("Оригинал"));
    let uid = original.data["tasks"][0]["_syncId"]
        .as_str()
        .unwrap()
        .to_owned();
    let mut changed = original.clone();
    changed.data["tasks"].as_array_mut().unwrap().insert(
        0,
        json!({
            "id":8,"title":"Отдельная задача","context":"Поездка","date":"2026-10-07","done":false
        }),
    );
    client.aliases.insert("tasks/8".into(), uid.clone());
    let merged = roundtrip(&mut client, &mut hub, &changed);
    let rows = merged.data["tasks"].as_array().unwrap();
    assert_eq!(rows.len(), 2);
    assert_eq!(
        rows.iter().find(|t| t["title"] == "Оригинал").unwrap()["_syncId"],
        uid
    );
    assert_ne!(
        rows.iter()
            .find(|t| t["title"] == "Отдельная задача")
            .unwrap()["_syncId"],
        uid
    );
    assert!(client.export(&merged).unwrap().is_empty());
}
#[test]
fn editing_context_moves_imported_task_even_with_stale_project_id() {
    let (mut client, mut hub) = (Client::default(), Hub::default());
    let mut original = document("Перенос");
    original.data["projects"]
        .as_array_mut()
        .unwrap()
        .push(json!({
            "id":3,"name":"Новый проект","description":"","tone":"sun"
        }));
    original.data["tasks"][0]["projectId"] = json!(2);
    let mut local = roundtrip(&mut client, &mut hub, &original);
    local.data["tasks"][0]["context"] = json!("Новый проект");
    let merged = roundtrip(&mut client, &mut hub, &local);
    assert_eq!(merged.data["tasks"][0]["context"], "Новый проект");
}
#[test]
fn review_both_creates_one_stable_copy_then_repeats_without_duplicates() {
    let (mut a, mut b, mut hub) = (Client::default(), Client::default(), Hub::default());
    let original = roundtrip(&mut a, &mut hub, &document("Локальная версия"));
    let local = roundtrip(&mut b, &mut hub, &original);
    let mut remote = original;
    remote.data["tasks"][0]["title"] = json!("Другая версия");
    roundtrip(&mut a, &mut hub, &remote);
    let (_, receipt) = b.stage(hub.clone(), &local).unwrap();
    let key = format!(
        "tasks/{}",
        local.data["tasks"][0]["_syncId"].as_str().unwrap()
    );
    assert!(b
        .review_with_both(
            &receipt,
            std::slice::from_ref(&key),
            std::slice::from_ref(&key),
            &local
        )
        .is_err());
    let (both, token) = b.review_with_both(&receipt, &[], &[key], &local).unwrap();
    assert_eq!(both.data["tasks"].as_array().unwrap().len(), 2);
    let rows = both.data["tasks"].as_array().unwrap();
    assert_ne!(rows[0]["id"], rows[1]["id"]);
    assert_ne!(rows[0]["_syncId"], rows[1]["_syncId"]);
    assert!(rows.iter().any(|r| r["title"] == "Локальная версия"));
    assert!(rows.iter().any(|r| r["title"] == "Другая версия"));
    b.acknowledge(&token).unwrap();
    let again = roundtrip(&mut b, &mut hub, &both);
    assert_eq!(again.data["tasks"].as_array().unwrap().len(), 2);
    let repeated = roundtrip(&mut b, &mut hub, &again);
    assert_eq!(again.data["tasks"], repeated.data["tasks"]);
    assert!(b.export(&repeated).unwrap().is_empty());
}
#[test]
fn local_assistant_selection_follows_records_when_numeric_ids_are_canonicalized() {
    let (mut client, mut hub) = (Client::default(), Hub::default());
    let mut original = document("Для контекста");
    original.data["uiPreferences"] = json!({"aiSelection":{"tasks":[1],"projectTasks":[2]},"aiContextPresets":[{"id":"test","name":"Набор","selection":{"tasks":[1]}}]});
    let changed = roundtrip(&mut client, &mut hub, &original);
    assert_eq!(
        changed.data["uiPreferences"]["aiSelection"]["tasks"][0],
        changed.data["tasks"][0]["_syncId"]
    );
    assert_eq!(
        changed.data["uiPreferences"]["aiSelection"]["projectTasks"][0],
        changed.data["projects"][0]["_syncId"]
    );
    assert_eq!(
        changed.data["uiPreferences"]["aiContextPresets"][0]["selection"]["tasks"][0],
        changed.data["tasks"][0]["_syncId"]
    );
    assert!(!serde_json::to_string(&hub)
        .unwrap()
        .contains("aiContextPresets"));
}
fn roundtrip(client: &mut Client, hub: &mut Hub, doc: &WorkspaceDocument) -> WorkspaceDocument {
    hub.merge(&client.export(doc).unwrap(), &client.device)
        .unwrap();
    let (merged, receipt) = client.stage(hub.clone(), doc).unwrap();
    client.acknowledge(&receipt).unwrap();
    merged
}
#[test]
fn union_preserves_ids_links_settings_and_cover() {
    let (mut a, mut b, mut hub) = (Client::default(), Client::default(), Hub::default());
    let mut da = document("Маршрут");
    da.data["archiveItems"] = json!([{"id":3,"name":"Книга","category":"Книги","date":"2026-10-07","rating":4.5,"review":""}]);
    da.covers
        .push((3, "data:image/png;base64,iVBORw0KGgo=".into()));
    da.data["tasks"][0]["materialIds"] = json!([3]);
    roundtrip(&mut a, &mut hub, &da);
    let mut db = document("Билеты");
    db.data["palette"] = json!("winter");
    let merged = roundtrip(&mut b, &mut hub, &db);
    assert_eq!(merged.data["tasks"].as_array().unwrap().len(), 2);
    assert_eq!(merged.data["projects"].as_array().unwrap().len(), 1);
    assert_ne!(merged.data["tasks"][0]["id"], merged.data["tasks"][1]["id"]);
    let linked = merged.data["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .find(|t| t["title"] == "Маршрут")
        .unwrap();
    assert_eq!(
        linked["materialIds"][0],
        merged.data["archiveItems"][0]["id"]
    );
    assert_eq!(
        merged.covers[0].0,
        merged.data["archiveItems"][0]["id"].as_i64().unwrap()
    );
    assert_eq!(merged.data["palette"], "winter");
    assert!(!serde_json::to_string(&hub).unwrap().contains("local-only"));
}
#[test]
fn identical_backup_deduplicates_and_retries_are_idempotent() {
    let (mut a, mut b, mut hub) = (Client::default(), Client::default(), Hub::default());
    let da = document("Маршрут");
    let patches = a.export(&da).unwrap();
    assert_eq!(
        serde_json::to_value(&patches).unwrap(),
        serde_json::to_value(a.export(&da).unwrap()).unwrap()
    );
    hub.merge(&patches, &a.device).unwrap();
    let generation = hub.generation;
    assert!(!hub.merge(&patches, &a.device).unwrap());
    assert_eq!(hub.generation, generation);
    let db = roundtrip(&mut b, &mut hub, &da);
    assert_eq!(db.data["tasks"].as_array().unwrap().len(), 1);
}
#[test]
fn independent_fields_merge_same_field_conflicts_keep_both() {
    let (mut a, mut b, mut hub) = (Client::default(), Client::default(), Hub::default());
    let da = roundtrip(&mut a, &mut hub, &document("Маршрут"));
    let db = roundtrip(&mut b, &mut hub, &da);
    let mut da = roundtrip(&mut a, &mut hub, &da);
    let mut db = db;
    da.data["tasks"][0]["title"] = json!("Новый маршрут");
    db.data["tasks"][0]["description"] = json!("Телефон: подробности");
    roundtrip(&mut a, &mut hub, &da);
    let db = roundtrip(&mut b, &mut hub, &db);
    assert_eq!(db.data["tasks"][0]["title"], "Новый маршрут");
    assert_eq!(db.data["tasks"][0]["description"], "Телефон: подробности");
    assert!(hub.conflicts.is_empty());
    let mut da = roundtrip(&mut a, &mut hub, &da);
    let mut db = db;
    da.data["tasks"][0]["title"] = json!("ПК");
    db.data["tasks"][0]["title"] = json!("Телефон");
    roundtrip(&mut a, &mut hub, &da);
    roundtrip(&mut b, &mut hub, &db);
    let conflict = hub.conflicts.iter().find(|c| c.field == "title").unwrap();
    assert!([conflict.kept.clone(), conflict.alternative.clone()].contains(&Some(json!("ПК"))));
    assert!([conflict.kept.clone(), conflict.alternative.clone()].contains(&Some(json!("Телефон"))));
}
#[test]
fn delete_edit_conflict_restores_preserved_contents_in_both_orders() {
    for deleting_first in [true, false] {
        let (mut a, mut b, mut hub) = (Client::default(), Client::default(), Hub::default());
        let mut da = roundtrip(&mut a, &mut hub, &document("Маршрут"));
        let mut db = roundtrip(&mut b, &mut hub, &da);
        da.data["tasks"] = json!([]);
        db.data["tasks"][0]["title"] = json!("Изменено без сети");
        if deleting_first {
            roundtrip(&mut a, &mut hub, &da);
            roundtrip(&mut b, &mut hub, &db);
        } else {
            roundtrip(&mut b, &mut hub, &db);
            roundtrip(&mut a, &mut hub, &da);
        }
        assert!(hub.document(&da).unwrap().data["tasks"]
            .as_array()
            .unwrap()
            .is_empty());
        let conflict = hub
            .conflicts
            .iter()
            .find(|c| c.field == "_deleted")
            .unwrap()
            .clone();
        let folder = std::env::temp_dir().join(format!("life-lan-{}", Uuid::new_v4()));
        std::fs::create_dir_all(&folder).unwrap();
        apply_hub(
            &folder.join("hub.sqlite3"),
            &mut hub,
            &[],
            &a.device,
            Some((conflict.id, true)),
        )
        .unwrap();
        assert_eq!(
            hub.document(&da).unwrap().data["tasks"][0]["title"],
            "Изменено без сети"
        );
        std::fs::remove_dir_all(folder).unwrap();
    }
}
#[test]
fn deletion_without_edit_propagates_without_resurrection() {
    let (mut a, mut b, mut hub) = (Client::default(), Client::default(), Hub::default());
    let mut da = roundtrip(&mut a, &mut hub, &document("Маршрут"));
    let db = roundtrip(&mut b, &mut hub, &da);
    da.data["tasks"] = json!([]);
    roundtrip(&mut a, &mut hub, &da);
    let db = roundtrip(&mut b, &mut hub, &db);
    assert!(db.data["tasks"].as_array().unwrap().is_empty());
    assert!(hub.conflicts.is_empty());
    roundtrip(&mut b, &mut hub, &db);
    assert!(hub.document(&db).unwrap().data["tasks"]
        .as_array()
        .unwrap()
        .is_empty());
}
#[test]
fn unsent_creation_can_be_deleted_and_user_revert_survives_failed_ack() {
    let (mut a, mut hub) = (Client::default(), Hub::default());
    let mut doc = document("Маршрут");
    a.export(&doc).unwrap();
    doc.data["tasks"] = json!([]);
    let doc = roundtrip(&mut a, &mut hub, &doc);
    assert!(doc.data["tasks"].as_array().unwrap().is_empty());
    let mut doc = document("Исходное");
    let mut a = Client::default();
    let mut hub = Hub::default();
    doc = roundtrip(&mut a, &mut hub, &doc);
    doc.data["tasks"][0]["title"] = json!("Изменено");
    hub.merge(&a.export(&doc).unwrap(), &a.device).unwrap();
    a.stage(hub.clone(), &doc).unwrap();
    doc.data["tasks"][0]["title"] = json!("Исходное");
    let doc = roundtrip(&mut a, &mut hub, &doc);
    assert_eq!(doc.data["tasks"][0]["title"], "Исходное");
}
#[test]
fn stale_receipt_rejected_and_clone_gets_distinct_identity() {
    let (mut a, mut hub) = (Client::default(), Hub::default());
    let doc = document("Маршрут");
    hub.merge(&a.export(&doc).unwrap(), &a.device).unwrap();
    let (_, receipt) = a.stage(hub.clone(), &doc).unwrap();
    assert!(a.acknowledge("wrong").is_err());
    a.acknowledge(&receipt).unwrap();
    let mut doc = hub.document(&doc).unwrap();
    let mut copy = doc.data["tasks"][0].clone();
    copy["id"] = json!(copy["id"].as_i64().unwrap() + 1);
    doc.data["tasks"].as_array_mut().unwrap().push(copy);
    let doc = roundtrip(&mut a, &mut hub, &doc);
    assert_eq!(doc.data["tasks"].as_array().unwrap().len(), 2);
}
#[test]
fn ten_thousand_tasks_incremental_change_and_restart() {
    let (mut a, mut hub) = (Client::default(), Hub::default());
    let mut doc = document("Маршрут");
    doc.data["tasks"]=json!((1..=10000).map(|i|json!({"id":i,"title":format!("Task {i}"),"context":"Поездка","date":"2026-10-07","done":false})).collect::<Vec<_>>());
    let mut doc = roundtrip(&mut a, &mut hub, &doc);
    assert!(a.export(&doc).unwrap().is_empty());
    doc.data["tasks"][9999]["done"] = json!(true);
    let changes = a.export(&doc).unwrap();
    assert_eq!(changes.len(), 1);
    let saved = serde_json::to_string(&a).unwrap();
    let mut a: Client = serde_json::from_str(&saved).unwrap();
    roundtrip(&mut a, &mut hub, &doc);
    assert!(a.export(&hub.document(&doc).unwrap()).unwrap().is_empty());
    assert!(numeric_id("test") < (1i64 << 53));
}
#[test]
fn reject_public_addresses_and_invalid_patches() {
    for raw in [
        "8.8.8.8",
        "example.com",
        "https://192.168.1.1",
        "192.168.1.2:0",
        "[::1]:123",
    ] {
        assert!(wire::address(raw).is_err());
    }
    assert!(wire::address("192.168.1.12").is_ok());
    let (mut a, mut hub) = (Client::default(), Hub::default());
    let mut changes = a.export(&document("Маршрут")).unwrap();
    changes[0].field = "__proto__".into();
    assert!(hub.merge(&changes, &a.device).is_err());
}
#[test]
fn encrypted_payload_detects_tampering_and_wrong_direction() {
    let key = B64.encode(XChaCha20Poly1305::generate_key(&mut OsRng));
    let value = json!({"private":"data"});
    let envelope = wire::seal(&key, "request", &value).unwrap();
    let second = wire::seal(&key, "request", &value).unwrap();
    assert_ne!(envelope["nonce"], second["nonce"]);
    let wrong_key = B64.encode(XChaCha20Poly1305::generate_key(&mut OsRng));
    assert!(wire::unseal::<Value>(&wrong_key, "request", envelope.clone()).is_err());
    let encoded = serde_json::to_vec(&envelope).unwrap();
    assert!(!String::from_utf8_lossy(&encoded).contains("private"));
    assert_eq!(
        wire::unseal::<Value>(&key, "request", envelope.clone()).unwrap(),
        value
    );
    assert!(wire::unseal::<Value>(&key, "response", envelope.clone()).is_err());
    let mut altered = envelope;
    altered["ciphertext"] = json!("AAAA");
    assert!(wire::unseal::<Value>(&key, "request", altered).is_err());
}
#[test]
fn actual_tcp_pair_sync_revoke_and_single_use_code() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let address = listener.local_addr().unwrap();
    listener.set_nonblocking(true).unwrap();
    let profile = HostProfile::default();
    let stop = Arc::new(AtomicBool::new(false));
    let data = Arc::new(Mutex::new(HostData {
        profile,
        code: Some("12345678".into()),
        expires: now() + 300000,
        attempts: 0,
        hub: Hub::default(),
    }));
    let folder = std::env::temp_dir().join(format!("life-lan-tcp-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&folder).unwrap();
    spawn_server(
        listener,
        data.clone(),
        stop.clone(),
        folder.join("hub.sqlite3"),
        Arc::new(|_| Ok(())),
    );
    assert!(wire::pair_client(address, "87654321", "Bad").is_err());
    let peer = wire::pair_client(address, "12345678", "Phone").unwrap();
    assert!(wire::pair_client(address, "12345678", "Second").is_err());
    let mut client = Client {
        device: peer.peer.id.clone(),
        ..Client::default()
    };
    let doc = document("Телефон");
    let patches = client.export(&doc).unwrap();
    let result = wire::exchange(&peer, &client.device, 0, patches, None).unwrap();
    let received = result.hub.unwrap();
    assert_eq!(
        received.document(&doc).unwrap().data["tasks"][0]["title"],
        "Телефон"
    );
    let restored: Hub = store(&folder.join("hub.sqlite3"), "hub").unwrap();
    assert_eq!(restored.generation, received.generation);
    let (doc, receipt) = client.stage(received, &doc).unwrap();
    client.acknowledge(&receipt).unwrap();
    let patches = client.export(&doc).unwrap();
    let result = wire::exchange(&peer, &client.device, client.generation, patches, None).unwrap();
    assert!(result.hub.is_none());
    // Even a previously valid encrypted request cannot be replayed on a new socket.
    let hello = json!({"protocol":PROTOCOL,"operation":"sync","peer":peer.peer.id});
    let mut first = wire::connect(address).unwrap();
    wire::write(&mut first, &hello).unwrap();
    let challenge = wire::read_small(&mut first).unwrap()["challenge"]
        .as_str()
        .unwrap()
        .to_owned();
    let request = wire::Request {
        challenge: challenge.clone(),
        device: client.device.clone(),
        generation: client.generation,
        patches: vec![],
        resolve: None,
    };
    let encrypted = wire::seal(
        &peer.peer.key,
        &format!("LifeOS LAN request v1 {}", peer.peer.id),
        &request,
    )
    .unwrap();
    wire::write(&mut first, &encrypted).unwrap();
    wire::read(&mut first).unwrap();
    let generation = data.lock().unwrap().hub.generation;
    let mut second = wire::connect(address).unwrap();
    wire::write(&mut second, &hello).unwrap();
    let next = wire::read_small(&mut second).unwrap();
    assert_ne!(next["challenge"], challenge);
    wire::write(&mut second, &encrypted).unwrap();
    assert!(wire::read(&mut second).is_err());
    assert_eq!(data.lock().unwrap().hub.generation, generation);
    data.lock().unwrap().profile.peers.clear();
    assert!(wire::exchange(&peer, &client.device, client.generation, vec![], None).is_err());
    stop.store(true, Ordering::SeqCst);
    thread::sleep(Duration::from_millis(150));
    std::fs::remove_dir_all(folder).unwrap();
}
#[test]
fn unauthenticated_frame_is_bounded() {
    use std::io::Write;
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let handle = thread::spawn(move || {
        let (mut stream, _) = listener.accept().unwrap();
        wire::timeouts(&stream).unwrap();
        assert!(wire::read_small(&mut stream).is_err());
    });
    let mut stream = TcpStream::connect(addr).unwrap();
    stream.write_all(&100000u32.to_be_bytes()).unwrap();
    handle.join().unwrap();
}
