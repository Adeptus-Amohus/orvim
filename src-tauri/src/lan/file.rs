//! Encrypted snapshots carried over a cable or removable drive. No socket is opened.
use super::*;
use std::collections::BTreeSet;

#[derive(Default, Serialize, Deserialize)]
struct FileState {
    client: Client,
    seen: BTreeSet<String>,
    pending: Option<String>,
}
#[derive(Serialize, Deserialize)]
struct Transfer {
    format: String,
    version: u8,
    device: String,
    created_at: i64,
    hub: Hub,
}

fn signature(e: &model::Entity) -> String {
    model::hash(
        &e.fields
            .iter()
            .filter(|(k, v)| {
                k.as_str() != "_position" && v.value.as_ref().is_some_and(|v| !v.is_null())
            })
            .map(|(k, v)| (k.clone(), v.value.clone()))
            .collect::<std::collections::BTreeMap<_, _>>(),
    )
}
fn rewrite_links(
    entity: &mut model::Entity,
    names: &std::collections::BTreeMap<String, String>,
    ids: &std::collections::BTreeMap<i64, i64>,
) {
    for (field, cell) in &mut entity.fields {
        if field == "_projectRef" {
            if let Some(Value::String(uid)) = &mut cell.value {
                if let Some(new) = names.get(uid) {
                    *uid = new.clone();
                }
            }
        } else if [
            "projectId",
            "originProjectId",
            "workoutId",
            "taskId",
            "eventId",
        ]
        .contains(&field.as_str())
        {
            if let Some(new) = cell
                .value
                .as_ref()
                .and_then(Value::as_i64)
                .and_then(|id| ids.get(&id))
            {
                cell.value = Some(json!(new));
            }
        } else if field == "materialIds" {
            if let Some(Value::Array(values)) = &mut cell.value {
                for value in values {
                    if let Some(new) = value.as_i64().and_then(|id| ids.get(&id)) {
                        *value = json!(new);
                    }
                }
            }
        }
    }
}

fn coalesce_exact(hub: &Hub, incoming: &mut Hub) {
    use std::collections::{BTreeMap, BTreeSet};
    let mut names: BTreeMap<String, String> = BTreeMap::new();
    let mut ids: BTreeMap<i64, i64> = BTreeMap::new();
    let mut used = BTreeSet::new();
    // Resolve parents before children so equivalent links compare equally.
    for kind in [
        "projects",
        "archiveItems",
        "exercises",
        "trainingGoals",
        "workouts",
        "tasks",
        "events",
        "thoughts",
        "foodLogs",
        "waterLogs",
        "savedMeals",
        "taskTemplates",
        "financeLogs",
        "sleepLogs",
        "stepLogs",
        "checkins",
        "recoveryLogs",
        "weightLogs",
        "illnessLogs",
        "nutrientLogs",
    ] {
        let mut index: std::collections::BTreeMap<
            String,
            std::collections::VecDeque<(String, String)>,
        > = std::collections::BTreeMap::new();
        for (key, entity) in hub.entities.iter().filter(|(_, e)| e.collection == kind) {
            index
                .entry(signature(entity))
                .or_default()
                .push_back((key.clone(), entity.uid.clone()));
        }
        for entity in incoming
            .entities
            .values_mut()
            .filter(|e| e.collection == kind)
        {
            rewrite_links(entity, &names, &ids);
            let key = format!("{}/{}", kind, entity.uid);
            if hub.entities.contains_key(&key) {
                used.insert(key);
                continue;
            }
            let fingerprint = signature(entity);
            let matches = index.entry(fingerprint).or_default();
            while matches.front().is_some_and(|(key, _)| used.contains(key)) {
                matches.pop_front();
            }
            if let Some((key, uid)) = matches.pop_front() {
                used.insert(key);
                ids.insert(model::numeric_id(&entity.uid), model::numeric_id(&uid));
                names.insert(entity.uid.clone(), uid.clone());
                entity.uid = uid;
            }
        }
    }
    for entity in incoming.entities.values_mut() {
        rewrite_links(entity, &names, &ids);
    }
}

fn preview(state: &mut FileState, hub: Hub, local: &WorkspaceDocument) -> Result<Value> {
    let (document, receipt) = state.client.stage(hub.clone(), local)?;
    Ok(
        json!({"document":document,"receipt":receipt,"comparison":state.client.comparison(local)?,"conflicts":hub.conflicts.iter().filter(|c|!c.resolved).collect::<Vec<_>>() }),
    )
}
fn import(
    state: &mut FileState,
    mut transfer: Transfer,
    digest: String,
    local: &WorkspaceDocument,
) -> Result<Value> {
    if transfer.format != "orvim-device-transfer"
        || ![1, 2].contains(&transfer.version)
        || Uuid::parse_str(&transfer.device).is_err()
        || transfer.hub.entities.len() > 100_000
    {
        return Err("Это не поддерживаемый файл переноса Orvim.".into());
    }
    if state.seen.contains(&digest) {
        return Ok(json!({"unchanged":true}));
    }
    let mut hub = state.client.snapshot_hub(local)?;
    // Legacy Option<Value> wire payloads represent an explicit null as None.
    // For optional fields both mean "not filled", not two competing values.
    for entity in hub
        .entities
        .values_mut()
        .chain(transfer.hub.entities.values_mut())
    {
        for cell in entity.fields.values_mut() {
            if cell.value.is_none() {
                cell.value = Some(Value::Null);
            }
        }
    }
    coalesce_exact(&hub, &mut transfer.hub);
    let mut patches = Vec::new();
    // A file is a proposal, not proof of which device is newer. Show all
    // differing values for an explicit choice; identical values coalesce.
    for entity in transfer.hub.entities.values() {
        for (field, cell) in &entity.fields {
            if patches.len() >= 500_000 {
                return Err("В файле слишком много изменений.".into());
            }
            hub.clock = hub
                .clock
                .checked_add(1)
                .ok_or("Некорректные метки переноса.")?;
            patches.push(Patch {
                collection: entity.collection.clone(),
                uid: entity.uid.clone(),
                field: field.clone(),
                value: cell.value.clone(),
                stamp: Stamp {
                    clock: hub.clock,
                    device: transfer.device.clone(),
                },
                base: None,
                observed: 0,
            });
        }
    }
    hub.merge(&patches, &transfer.device)?;
    hub.document(local)?;
    state.pending = Some(digest);
    preview(state, hub, local)
}
pub(super) fn action(
    root: &Path,
    operation: &str,
    args: &Value,
    local: Option<&WorkspaceDocument>,
) -> Result<Value> {
    let path = root.join("file-client.sqlite3");
    let mut state: FileState = store(&path, "file-client")?;
    let result = match operation {
        "fileExport" => {
            let local = local.ok_or("Нет данных для переноса.")?;
            let hub = state.client.snapshot_hub(local)?;
            let (canonical, receipt) = state.client.stage(hub.clone(), local)?;
            state.client.acknowledge(&receipt)?;
            let transfer = Transfer {
                format: "orvim-device-transfer".into(),
                version: 2,
                device: state.client.device.clone(),
                created_at: now(),
                hub,
            };
            let bytes = serde_json::to_vec(&transfer).map_err(|e| e.to_string())?;
            let sealed =
                crate::encryption::seal(&bytes, Some(args["password"].as_str().unwrap_or("")))?;
            json!({"document":canonical,"content":String::from_utf8(sealed).map_err(|e|e.to_string())?})
        }
        "fileImport" => {
            let content = args["content"]
                .as_str()
                .filter(|s| s.len() <= 110 * 1024 * 1024)
                .ok_or("Выберите файл переноса до 110 МБ.")?;
            let bytes = crate::encryption::unseal(
                content.as_bytes(),
                Some(args["password"].as_str().unwrap_or("")),
            )?;
            let transfer: Transfer = serde_json::from_slice(&bytes)
                .map_err(|_| "Это не файл переноса между устройствами Orvim.")?;
            let digest = model::hash(
                &serde_json::from_slice::<Value>(&bytes).map_err(|_| "Файл повреждён.")?,
            );
            import(
                &mut state,
                transfer,
                digest,
                local.ok_or("Нет локальных данных.")?,
            )?
        }
        "fileReview" => {
            let rejected: Vec<String> = serde_json::from_value(args["rejected"].clone())
                .map_err(|_| "Некорректный выбор записей.")?;
            let both: Vec<String> =
                serde_json::from_value(args.get("both").cloned().unwrap_or(json!([])))
                    .map_err(|_| "Некорректный выбор копий.")?;
            let (document, receipt) = state.client.review_with_both(
                args["receipt"].as_str().unwrap_or(""),
                &rejected,
                &both,
                local.ok_or("Нет локальных данных.")?,
            )?;
            json!({"document":document,"receipt":receipt})
        }
        "fileResolve" => {
            let mut hub = state.client.received.clone();
            let conflict = hub
                .conflicts
                .iter()
                .find(|c| Some(c.id.as_str()) == args["id"].as_str() && !c.resolved)
                .cloned()
                .ok_or("Различие уже разобрано.")?;
            let key = format!("{}/{}", conflict.collection, conflict.uid);
            let base = hub
                .entities
                .get(&key)
                .and_then(|e| e.fields.get(&conflict.field))
                .map(|c| c.stamp.clone());
            let patch = Patch {
                collection: conflict.collection,
                uid: conflict.uid,
                field: conflict.field,
                value: if args["alternative"].as_bool() == Some(true) {
                    conflict.alternative
                } else {
                    conflict.kept
                },
                stamp: Stamp {
                    clock: hub.clock + 1,
                    device: state.client.device.clone(),
                },
                base,
                observed: hub.clock,
            };
            hub.merge(&[patch], &state.client.device)?;
            for c in &mut hub.conflicts {
                if Some(c.id.as_str()) == args["id"].as_str() {
                    c.resolved = true;
                }
            }
            preview(&mut state, hub, local.ok_or("Нет локальных данных.")?)?
        }
        "fileAck" => {
            state
                .client
                .acknowledge(args["receipt"].as_str().unwrap_or(""))?;
            if let Some(digest) = state.pending.take() {
                state.seen.insert(digest);
            }
            while state.seen.len() > 128 {
                state.seen.pop_first();
            }
            json!({"acknowledged":true})
        }
        _ => return Err("Неизвестное действие переноса.".into()),
    };
    save(&path, "file-client", &state)?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unrated_items_survive_serialized_file_without_false_conflicts() {
        let mut source = FileState::default();
        let mut target = FileState::default();
        let mut doc = super::super::tests::document("Задача");
        doc.data["archiveItems"] = json!([{"id":80,"name":"Без оценки","category":"Книги","date":"2026-10-29","rating":null,"review":""}]);
        let hub = source.client.snapshot_hub(&doc).unwrap();
        let transfer = Transfer {
            format: "orvim-device-transfer".into(),
            version: 1,
            device: source.client.device.clone(),
            created_at: 1,
            hub,
        };
        let wire: Transfer =
            serde_json::from_slice(&serde_json::to_vec(&transfer).unwrap()).unwrap();
        let result = import(&mut target, wire, "unrated".into(), &doc).unwrap();
        assert!(result["conflicts"].as_array().unwrap().is_empty());
        assert_eq!(
            result["document"]["data"]["archiveItems"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn ten_thousand_independent_duplicates_use_indexed_merge() {
        let start = std::time::Instant::now();
        let mut source = FileState::default();
        let mut target = FileState::default();
        let mut doc = super::super::tests::document("Стресс");
        doc.data["tasks"]=json!((0..10_000).map(|i|json!({"id":i+100,"title":format!("Задача {i}"),"context":"Поездка","date":"2026-10-29","done":false})).collect::<Vec<_>>());
        let mut local = doc.clone();
        for row in local.data["tasks"].as_array_mut().unwrap() {
            row["id"] = json!(row["id"].as_i64().unwrap() + 100_000);
        }
        let transfer = Transfer {
            format: "orvim-device-transfer".into(),
            version: 2,
            device: source.client.device.clone(),
            created_at: 1,
            hub: source.client.snapshot_hub(&doc).unwrap(),
        };
        let result = import(&mut target, transfer, "stress".into(), &local).unwrap();
        assert_eq!(
            result["document"]["data"]["tasks"]
                .as_array()
                .unwrap()
                .len(),
            10_000
        );
        eprintln!(
            "USB merge of 10000 independent duplicates: {:?}",
            start.elapsed()
        );
    }
    #[test]
    fn identical_independent_records_coalesce_even_with_different_numeric_ids() {
        let mut source = FileState::default();
        let mut target = FileState::default();
        let doc = super::super::tests::document("Одинаковая задача");
        let mut local = doc.clone();
        local.data["tasks"][0]["id"] = json!(501);
        local.data["projects"][0]["id"] = json!(502);
        let transfer = Transfer {
            format: "orvim-device-transfer".into(),
            version: 2,
            device: source.client.device.clone(),
            created_at: 1,
            hub: source.client.snapshot_hub(&doc).unwrap(),
        };
        let result = import(&mut target, transfer, "same".into(), &local).unwrap();
        assert_eq!(
            result["document"]["data"]["tasks"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            result["document"]["data"]["projects"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn encrypted_file_requires_password_preserves_local_records_and_ack_survives_restart() {
        let root = std::env::temp_dir().join(format!("orvim-file-test-{}", Uuid::new_v4()));
        let source = root.join("source");
        let target = root.join("target");
        std::fs::create_dir_all(&source).unwrap();
        std::fs::create_dir_all(&target).unwrap();
        let mut doc = super::super::tests::document("С телефона");
        doc.data["connectionSettings"] = json!({"apiKey":"SYNTHETIC-DO-NOT-TRANSFER"});
        doc.data["uiPreferences"] = json!({"aiHistory":[{"content":"PRIVATE-CHAT"}]});
        let password = "Orvim test passphrase 2026";
        let exported = action(
            &source,
            "fileExport",
            &json!({"password":password}),
            Some(&doc),
        )
        .unwrap();
        let content = exported["content"].as_str().unwrap();
        let plain = crate::encryption::unseal(content.as_bytes(), Some(password)).unwrap();
        let plain = String::from_utf8(plain.to_vec()).unwrap();
        assert!(!plain.contains("SYNTHETIC-DO-NOT-TRANSFER"));
        assert!(!plain.contains("PRIVATE-CHAT"));
        let local = super::super::tests::document("На ПК");
        assert!(action(
            &target,
            "fileImport",
            &json!({"password":"incorrect passphrase","content":content}),
            Some(&local)
        )
        .is_err());
        let import = action(
            &target,
            "fileImport",
            &json!({"password":password,"content":content}),
            Some(&local),
        )
        .unwrap();
        assert_eq!(
            import["document"]["data"]["tasks"]
                .as_array()
                .unwrap()
                .len(),
            2
        );
        assert_eq!(local.data["tasks"].as_array().unwrap().len(), 1);
        let reviewed = action(
            &target,
            "fileReview",
            &json!({"receipt":import["receipt"],"rejected":[],"both":[]}),
            Some(&local),
        )
        .unwrap();
        let merged: WorkspaceDocument =
            serde_json::from_value(reviewed["document"].clone()).unwrap();
        action(
            &target,
            "fileAck",
            &json!({"receipt":reviewed["receipt"]}),
            None,
        )
        .unwrap();
        assert_eq!(
            action(
                &target,
                "fileImport",
                &json!({"password":password,"content":content}),
                Some(&merged)
            )
            .unwrap()["unchanged"],
            true
        );
        std::fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn file_roundtrip_unions_deduplicates_and_keeps_both_date_versions() {
        let mut source = FileState::default();
        let mut target = FileState::default();
        let mut doc = super::super::tests::document("Общая задача");
        let hub = source.client.snapshot_hub(&doc).unwrap();
        let canonical = hub.document(&doc).unwrap();
        let first = Transfer {
            format: "orvim-device-transfer".into(),
            version: 2,
            device: source.client.device.clone(),
            created_at: 1,
            hub,
        };
        let value = import(&mut target, first, "first".into(), &canonical).unwrap();
        target
            .client
            .acknowledge(value["receipt"].as_str().unwrap())
            .unwrap();
        let merged: WorkspaceDocument = serde_json::from_value(value["document"].clone()).unwrap();
        assert_eq!(merged.data["tasks"].as_array().unwrap().len(), 1);
        doc = merged.clone();
        doc.data["tasks"][0]["date"] = json!("2026-11-01");
        doc.data["thoughts"] = json!([{"id":99,"title":"Новая мысль","body":"Текст","date":"2026-10-29","context":"Личное"}]);
        let hub = source.client.snapshot_hub(&doc).unwrap();
        let second = Transfer {
            format: "orvim-device-transfer".into(),
            version: 2,
            device: source.client.device.clone(),
            created_at: 2,
            hub,
        };
        let result = import(&mut target, second, "second".into(), &merged).unwrap();
        let preview: WorkspaceDocument =
            serde_json::from_value(result["document"].clone()).unwrap();
        assert_eq!(preview.data["tasks"].as_array().unwrap().len(), 1);
        assert_eq!(preview.data["thoughts"].as_array().unwrap().len(), 1);
        assert!(result["conflicts"]
            .as_array()
            .unwrap()
            .iter()
            .any(|c| c["field"] == "date"
                && c["kept"] == "2026-11-01"
                && c["alternative"] == "2026-10-07"));
        assert_eq!(
            merged.data["tasks"][0]["date"], "2026-10-07",
            "preview must not mutate local records"
        );
    }
}
