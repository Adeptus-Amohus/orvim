//! Field-level journal. Workspace files and device-only settings never travel over the wire.
use crate::storage::{validate_workspace, WorkspaceDocument, COLLECTIONS};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use uuid::Uuid;

pub type Result<T> = std::result::Result<T, String>;
#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
pub struct Stamp {
    pub clock: u64,
    pub device: String,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Cell {
    pub stamp: Stamp,
    pub value: Option<Value>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Entity {
    pub collection: String,
    pub uid: String,
    pub fields: BTreeMap<String, Cell>,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Patch {
    pub collection: String,
    pub uid: String,
    pub field: String,
    pub value: Option<Value>,
    pub stamp: Stamp,
    pub base: Option<Stamp>,
    #[serde(default)]
    pub observed: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Conflict {
    pub id: String,
    pub collection: String,
    pub uid: String,
    pub field: String,
    pub title: String,
    pub kept: Option<Value>,
    pub alternative: Option<Value>,
    pub resolved: bool,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Hub {
    pub generation: u64,
    pub clock: u64,
    pub entities: BTreeMap<String, Entity>,
    pub conflicts: Vec<Conflict>,
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Known {
    pub hash: String,
    pub stamp: Stamp,
}
type Baseline = BTreeMap<String, BTreeMap<String, Known>>;
type ExportFields = BTreeMap<String, Option<Value>>;
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Client {
    pub device: String,
    pub clock: u64,
    pub generation: u64,
    pub aliases: BTreeMap<String, String>,
    pub acknowledged: BTreeMap<String, BTreeMap<String, Known>>,
    pub pending: BTreeMap<String, Patch>,
    pub received: Hub,
    pub staged: Option<(String, Baseline)>,
    pub backed_up: bool,
    #[serde(default)]
    pub last_sync: i64,
    #[serde(default)]
    pub rejected: BTreeMap<String, (String, Option<Entity>)>,
    #[serde(default)]
    pub staged_local: Option<Hub>,
}
impl Default for Client {
    fn default() -> Self {
        Self {
            device: Uuid::new_v4().to_string(),
            clock: 0,
            generation: 0,
            aliases: BTreeMap::new(),
            acknowledged: BTreeMap::new(),
            pending: BTreeMap::new(),
            received: Hub::default(),
            staged: None,
            backed_up: false,
            last_sync: 0,
            rejected: BTreeMap::new(),
            staged_local: None,
        }
    }
}
pub fn hash(value: &impl Serialize) -> String {
    format!(
        "{:x}",
        Sha256::digest(serde_json::to_vec(value).unwrap_or_default())
    )
}
pub fn numeric_id(uid: &str) -> i64 {
    let digest = Sha256::digest(uid.as_bytes());
    ((u64::from_le_bytes(digest[..8].try_into().unwrap()) & ((1u64 << 52) - 1)) + 1) as i64
}
fn entity_key(collection: &str, uid: &str) -> String {
    format!("{collection}/{uid}")
}
fn live(entity: &Entity) -> bool {
    entity
        .fields
        .get("_deleted")
        .and_then(|c| c.value.as_ref())
        .and_then(Value::as_bool)
        != Some(true)
}
fn value(entity: &Entity, field: &str) -> Option<Value> {
    entity.fields.get(field).and_then(|c| c.value.clone())
}
fn allowed(collection: &str) -> bool {
    COLLECTIONS.contains(&collection)
        || [
            "@settings",
            "@categories",
            "@financeCategories",
            "@financeAccounts",
            "@financeBudgets",
        ]
        .contains(&collection)
}
fn safe_field(field: &str) -> bool {
    !["__proto__", "constructor", "prototype", "id", "_syncId"].contains(&field)
        && field.len() <= 100
        && !field.contains('/')
}

impl Hub {
    pub fn merge(&mut self, patches: &[Patch], device: &str) -> Result<bool> {
        if patches.len() > 500_000 {
            return Err("Слишком много изменений для одного обмена.".into());
        }
        let mut changed = false;
        for patch in patches {
            if !allowed(&patch.collection)
                || !safe_field(&patch.field)
                || patch.uid.is_empty()
                || patch.uid.len() > 600
                || patch.stamp.device != device
                || patch.stamp.clock == 0
                || patch.stamp.clock > 9_007_199_254_740_000
                || (patch.collection == "@settings"
                    && ![
                        "waterTarget",
                        "foodTarget",
                        "financeCurrency",
                        "lifePreferences",
                    ]
                    .contains(&patch.uid.as_str()))
            {
                return Err("Некорректное изменение синхронизации.".into());
            }
            self.clock = self.clock.max(patch.stamp.clock);
            let key = entity_key(&patch.collection, &patch.uid);
            let entity = self.entities.entry(key).or_insert_with(|| Entity {
                collection: patch.collection.clone(),
                uid: patch.uid.clone(),
                fields: BTreeMap::new(),
            });
            let previous = entity.fields.get(&patch.field).cloned();
            if previous
                .as_ref()
                .is_some_and(|cell| cell.stamp == patch.stamp || cell.value == patch.value)
            {
                continue;
            }
            // Preserve edits when another device deletes the same record offline.
            let deleting = patch.field == "_deleted" && patch.value == Some(json!(true));
            let deleted = entity
                .fields
                .get("_deleted")
                .filter(|cell| cell.value == Some(json!(true)));
            let concurrent = if deleting {
                entity
                    .fields
                    .iter()
                    .find(|(field, cell)| {
                        !field.starts_with('_')
                            && cell.stamp.clock > patch.observed
                            && cell.stamp.device != device
                    })
                    .map(|(_, cell)| cell.stamp.clone())
            } else if !patch.field.starts_with('_') {
                deleted
                    .filter(|cell| cell.stamp.clock > patch.observed && cell.stamp.device != device)
                    .map(|cell| cell.stamp.clone())
            } else {
                None
            };
            if let Some(other) = concurrent {
                let id = hash(&(
                    "delete-edit",
                    &patch.collection,
                    &patch.uid,
                    &other,
                    &patch.stamp,
                ));
                if !self.conflicts.iter().any(|c| c.id == id) {
                    let title = value(entity, "title")
                        .or_else(|| value(entity, "name"))
                        .and_then(|v| v.as_str().map(str::to_owned))
                        .unwrap_or_else(|| patch.collection.clone());
                    self.conflicts.push(Conflict {
                        id,
                        collection: patch.collection.clone(),
                        uid: patch.uid.clone(),
                        field: "_deleted".into(),
                        title,
                        kept: Some(json!(true)),
                        alternative: Some(json!(false)),
                        resolved: false,
                    });
                    changed = true;
                }
            }
            if let Some(previous) = &previous {
                if patch.field != "_position"
                    && previous.value != patch.value
                    && patch.base.as_ref() != Some(&previous.stamp)
                {
                    let (kept, alternative) = if patch.stamp > previous.stamp {
                        (patch.value.clone(), previous.value.clone())
                    } else {
                        (previous.value.clone(), patch.value.clone())
                    };
                    let id = hash(&(key_of(patch), &previous.stamp, &patch.stamp));
                    if !self.conflicts.iter().any(|c| c.id == id) {
                        let title = value(entity, "title")
                            .or_else(|| value(entity, "name"))
                            .and_then(|v| v.as_str().map(str::to_owned))
                            .unwrap_or_else(|| patch.collection.clone());
                        self.conflicts.push(Conflict {
                            id,
                            collection: patch.collection.clone(),
                            uid: patch.uid.clone(),
                            field: patch.field.clone(),
                            title,
                            kept,
                            alternative,
                            resolved: false,
                        });
                        changed = true;
                    }
                }
            }
            if previous
                .as_ref()
                .is_none_or(|cell| patch.stamp > cell.stamp)
            {
                entity.fields.insert(
                    patch.field.clone(),
                    Cell {
                        stamp: patch.stamp.clone(),
                        value: patch.value.clone(),
                    },
                );
                changed = true;
            }
        }
        if self.conflicts.iter().filter(|c| !c.resolved).count() > 1000 {
            return Err(
                "Накопилось много конфликтов. Разберите их в настройках синхронизации.".into(),
            );
        }
        if changed {
            // Resolved alternatives are retained briefly without a lifetime cap.
            let mut resolved = 0;
            self.conflicts.reverse();
            self.conflicts.retain(|c| {
                if c.resolved {
                    resolved += 1;
                    resolved <= 100
                } else {
                    true
                }
            });
            self.conflicts.reverse();
            self.generation = self
                .generation
                .checked_add(1)
                .ok_or("Счётчик синхронизации переполнен.")?;
        }
        Ok(changed)
    }
    pub fn document(&self, local: &WorkspaceDocument) -> Result<WorkspaceDocument> {
        let mut result = local.clone();
        let root = result
            .data
            .as_object_mut()
            .ok_or("Нет рабочего пространства.")?;
        let mut ids = BTreeSet::new();
        let mut names = BTreeMap::new();
        let mut used_names = BTreeSet::new();
        for entity in self
            .entities
            .values()
            .filter(|e| live(e) && e.collection == "projects")
        {
            let raw = value(entity, "name")
                .and_then(|v| v.as_str().map(str::to_owned))
                .unwrap_or_default();
            let mut name = raw.clone();
            if !used_names.insert(name.clone()) {
                name = format!("{} · {}", raw, &hash(&entity.uid)[..6]);
                used_names.insert(name.clone());
            }
            names.insert(entity.uid.clone(), name);
        }
        result.covers.clear();
        for collection in COLLECTIONS {
            let mut rows = Vec::new();
            for entity in self
                .entities
                .values()
                .filter(|e| live(e) && e.collection == collection)
            {
                let mut row = Map::new();
                for (field, cell) in &entity.fields {
                    if !field.starts_with('_') {
                        if let Some(value) = &cell.value {
                            row.insert(field.clone(), value.clone());
                        }
                    }
                }
                if !["sleepLogs", "stepLogs", "checkins"].contains(&collection) {
                    let id = numeric_id(&entity.uid);
                    if !ids.insert(id) {
                        return Err(
                            "Конфликт идентификаторов. Данные сохранены, обмен остановлен.".into(),
                        );
                    }
                    row.insert("id".into(), json!(id));
                    if collection == "archiveItems" {
                        if let Some(Value::String(cover)) = value(entity, "_cover") {
                            result.covers.push((id, cover));
                        }
                    }
                }
                row.insert("_syncId".into(), json!(entity.uid));
                if collection == "projects" {
                    if let Some(name) = names.get(&entity.uid) {
                        row.insert("name".into(), json!(name));
                    }
                }
                if let Some(Value::String(project)) = value(entity, "_projectRef") {
                    row.insert(
                        "context".into(),
                        json!(names
                            .get(&project)
                            .cloned()
                            .unwrap_or_else(|| "Личное".into())),
                    );
                }
                rows.push((
                    value(entity, "_position")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(0),
                    entity.uid.clone(),
                    Value::Object(row),
                ));
            }
            rows.sort_by(|a, b| (&a.0, &a.1).cmp(&(&b.0, &b.1)));
            root.insert(
                collection.into(),
                json!(rows.into_iter().map(|row| row.2).collect::<Vec<_>>()),
            );
        }
        for entity in self
            .entities
            .values()
            .filter(|e| live(e) && e.collection == "@settings")
        {
            if let Some(v) = value(entity, "value") {
                root.insert(entity.uid.clone(), v);
            }
        }
        let mut categories = Vec::new();
        let mut configs = Vec::new();
        for entity in self
            .entities
            .values()
            .filter(|e| live(e) && e.collection == "@categories")
        {
            categories.push(json!(entity.uid));
            if let Some(config) = value(entity, "config").filter(|v| !v.is_null()) {
                configs.push(config);
            }
        }
        for item in root["archiveItems"].as_array().unwrap() {
            if !categories.contains(&item["category"]) {
                categories.push(item["category"].clone());
            }
        }
        root.insert("archiveCategories".into(), json!(categories));
        let prefs = root.entry("uiPreferences").or_insert_with(|| json!({}));
        if !prefs.is_object() {
            *prefs = json!({});
        }
        prefs["databaseCollections"] = json!(configs);
        for (collection, field) in [
            ("@financeAccounts", "financeAccounts"),
            ("@financeBudgets", "financeBudgets"),
        ] {
            let values = self
                .entities
                .values()
                .filter(|entity| live(entity) && entity.collection == collection)
                .filter_map(|entity| value(entity, "value"))
                .collect::<Vec<_>>();
            prefs[field] = json!(values);
        }
        let finance = self
            .entities
            .values()
            .filter(|e| live(e) && e.collection == "@financeCategories")
            .filter_map(|e| value(e, "value"))
            .collect::<Vec<_>>();
        root.insert("financeCategories".into(), json!(finance));
        root.insert("nextId".into(), json!(ids.last().copied().unwrap_or(0) + 1));
        validate_workspace(&result).map_err(|e| e.to_string())?;
        Ok(result)
    }
}
fn key_of(patch: &Patch) -> String {
    format!("{}/{}/{}", patch.collection, patch.uid, patch.field)
}
impl Client {
    pub fn snapshot_hub(&mut self, document: &WorkspaceDocument) -> Result<Hub> {
        let mut copy = Client {
            device: self.device.clone(),
            clock: self.clock,
            aliases: self.aliases.clone(),
            ..Client::default()
        };
        let mut hub = Hub::default();
        hub.merge(&copy.export(document)?, &copy.device)?;
        self.aliases = copy.aliases;
        self.clock = self.clock.max(hub.clock);
        Ok(hub)
    }
    fn uid(&mut self, collection: &str, item: &Value) -> String {
        let key = if ["sleepLogs", "stepLogs"].contains(&collection) {
            item["date"].to_string()
        } else if collection == "checkins" {
            item["at"].to_string()
        } else {
            item["id"].to_string()
        };
        if ["sleepLogs", "stepLogs", "checkins"].contains(&collection) {
            return format!("natural-{collection}-{key}");
        }
        if let Some(uid) = item["_syncId"]
            .as_str()
            .filter(|u| u.len() <= 160 && numeric_id(u) == item["id"].as_i64().unwrap_or(0))
        {
            return uid.into();
        }
        let alias = format!("{collection}/{key}");
        if let Some(uid) = self.aliases.get(&alias) {
            return uid.clone();
        }
        if let Some(instance) = item["repeatInstanceKey"].as_str().filter(|key| {
            key.len() <= 100
                && key
                    .bytes()
                    .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b':')
        }) {
            let uid = format!("repeat-{collection}-{instance}");
            self.aliases.insert(alias, uid.clone());
            return uid;
        }
        let uid = if self.acknowledged.is_empty() {
            let mut original = item.clone();
            original.as_object_mut().unwrap().remove("_syncId");
            if collection == "projects" {
                format!("initial-project-{}", hash(&item["name"]))
            } else {
                format!("initial-{}", hash(&(collection, original)))
            }
        } else {
            Uuid::new_v4().to_string()
        };
        self.aliases.insert(alias, uid.clone());
        uid
    }
    pub fn export(&mut self, document: &WorkspaceDocument) -> Result<Vec<Patch>> {
        validate_workspace(document).map_err(|e| e.to_string())?;
        let mut identities: BTreeMap<String, BTreeMap<i64, String>> = BTreeMap::new();
        let mut rows = Vec::new();
        let mut projects = BTreeMap::new();
        let mut project_names = BTreeMap::new();
        let mut used = BTreeSet::new();
        for collection in COLLECTIONS {
            let Some(items) = document.data[collection].as_array() else {
                continue;
            };
            let canonical: BTreeMap<&str, i64> = items
                .iter()
                .filter_map(|item| {
                    let id = item["id"].as_i64()?;
                    let uid = item["_syncId"].as_str()?;
                    (uid.len() <= 160 && numeric_id(uid) == id).then_some((uid, id))
                })
                .collect();
            for (position, item) in items.iter().enumerate() {
                let mut uid = self.uid(collection, item);
                let reserved_for_other = canonical
                    .get(uid.as_str())
                    .is_some_and(|id| Some(*id) != item["id"].as_i64());
                if reserved_for_other || !used.insert(entity_key(collection, &uid)) {
                    // Duplicate names/repeat markers do not make local records
                    // the same entity. Keep both and remember the second alias.
                    let local_key = item["id"].to_string();
                    let repaired = format!(
                        "distinct-{}",
                        hash(&(collection, &uid, &local_key, &self.device))
                    );
                    if !used.insert(entity_key(collection, &repaired)) {
                        return Err(
                            "Не удалось различить записи для обмена. Данные сохранены локально."
                                .into(),
                        );
                    }
                    self.aliases
                        .insert(format!("{collection}/{local_key}"), repaired.clone());
                    uid = repaired;
                }
                if let Some(id) = item["id"].as_i64() {
                    identities
                        .entry(collection.into())
                        .or_default()
                        .insert(id, uid.clone());
                }
                if collection == "projects" {
                    if let Some(name) = item["name"].as_str() {
                        projects.insert(name.to_owned(), uid.clone());
                        project_names.insert(uid.clone(), name.to_owned());
                    }
                }
                rows.push((collection, uid, position, item.clone()));
            }
        }
        let cover_map: BTreeMap<i64, String> = document.covers.iter().cloned().collect();
        let mut current: BTreeMap<String, (String, String, ExportFields)> = BTreeMap::new();
        for (collection, uid, position, mut item) in rows {
            let old_id = item["id"].as_i64().unwrap_or(0);
            let explicit_project = item["projectId"]
                .as_i64()
                .and_then(|id| identities.get("projects")?.get(&id))
                .cloned();
            let fields = item.as_object_mut().unwrap();
            fields.remove("id");
            fields.remove("_syncId");
            for (field, target) in [
                ("workoutId", "workouts"),
                ("taskId", "tasks"),
                ("eventId", "events"),
                ("originProjectId", "projects"),
                ("projectId", "projects"),
            ] {
                if let Some(id) = fields.get(field).and_then(Value::as_i64) {
                    if let Some(uid) = identities.get(target).and_then(|m| m.get(&id)) {
                        fields.insert(field.into(), json!(numeric_id(uid)));
                    }
                }
            }
            if let Some(Value::Array(materials)) = fields.get_mut("materialIds") {
                for id in materials {
                    if let Some(uid) = id
                        .as_i64()
                        .and_then(|id| identities.get("archiveItems").and_then(|m| m.get(&id)))
                    {
                        *id = json!(numeric_id(uid));
                    }
                }
            }
            let project = fields
                .get("context")
                .and_then(Value::as_str)
                .and_then(|name| {
                    explicit_project
                        .as_ref()
                        .filter(|uid| {
                            project_names
                                .get(*uid)
                                .is_some_and(|current| current == name)
                        })
                        .or_else(|| projects.get(name))
                        .cloned()
                })
                .or(explicit_project);
            let mut fields: BTreeMap<String, Option<Value>> = fields
                .iter()
                .map(|(k, v)| (k.clone(), Some(v.clone())))
                .collect();
            fields.insert("_deleted".into(), Some(json!(false)));
            fields.insert("_position".into(), Some(json!(position)));
            fields.insert("_projectRef".into(), project.map(Value::String));
            if collection == "archiveItems" {
                fields.insert(
                    "_cover".into(),
                    cover_map.get(&old_id).cloned().map(Value::String),
                );
            }
            if current
                .insert(
                    entity_key(collection, &uid),
                    (collection.into(), uid, fields),
                )
                .is_some()
            {
                return Err("Идентификаторы синхронизации повторяются.".into());
            }
        }
        for field in [
            "waterTarget",
            "foodTarget",
            "financeCurrency",
            "lifePreferences",
        ] {
            if let Some(value) = document.data.get(field) {
                current.insert(
                    entity_key("@settings", field),
                    (
                        "@settings".into(),
                        field.into(),
                        BTreeMap::from([
                            ("value".into(), Some(value.clone())),
                            ("_deleted".into(), Some(json!(false))),
                        ]),
                    ),
                );
            }
        }
        for (collection, field) in [
            ("@financeAccounts", "financeAccounts"),
            ("@financeBudgets", "financeBudgets"),
        ] {
            if let Some(items) = document.data["uiPreferences"][field].as_array() {
                for item in items {
                    let key = if field == "financeAccounts" {
                        item["key"].as_str().unwrap_or_default().to_owned()
                    } else {
                        format!(
                            "{}:{}",
                            item["currency"].as_str().unwrap_or_default(),
                            item["category"].as_str().unwrap_or_default()
                        )
                    };
                    current.insert(
                        entity_key(collection, &key),
                        (
                            collection.into(),
                            key,
                            BTreeMap::from([
                                ("value".into(), Some(item.clone())),
                                ("_deleted".into(), Some(json!(false))),
                            ]),
                        ),
                    );
                }
            }
        }
        for name in document.data["archiveCategories"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(Value::as_str)
        {
            let config = document.data["uiPreferences"]["databaseCollections"]
                .as_array()
                .and_then(|list| list.iter().find(|v| v["name"] == name))
                .cloned();
            current.insert(
                entity_key("@categories", name),
                (
                    "@categories".into(),
                    name.into(),
                    BTreeMap::from([
                        ("config".into(), config),
                        ("_deleted".into(), Some(json!(false))),
                    ]),
                ),
            );
        }
        if let Some(categories) = document.data["financeCategories"].as_array() {
            for category in categories {
                if let Some(name) = category["name"].as_str() {
                    current.insert(
                        entity_key("@financeCategories", name),
                        (
                            "@financeCategories".into(),
                            name.into(),
                            BTreeMap::from([
                                ("value".into(), Some(category.clone())),
                                ("_deleted".into(), Some(json!(false))),
                            ]),
                        ),
                    );
                }
            }
        }
        for (key, known) in &self.acknowledged.clone() {
            if !current.contains_key(key)
                && known
                    .get("_deleted")
                    .is_none_or(|cell| cell.hash != hash(&Some(json!(true))))
            {
                if let Some(entity) = self.received.entities.get(key) {
                    current.insert(
                        key.clone(),
                        (
                            entity.collection.clone(),
                            entity.uid.clone(),
                            BTreeMap::from([("_deleted".into(), Some(json!(true)))]),
                        ),
                    );
                }
            }
        }
        for patch in self.pending.values() {
            let key = entity_key(&patch.collection, &patch.uid);
            if !current.contains_key(&key) && !self.acknowledged.contains_key(&key) {
                current.insert(
                    key,
                    (
                        patch.collection.clone(),
                        patch.uid.clone(),
                        BTreeMap::from([("_deleted".into(), Some(json!(true)))]),
                    ),
                );
            }
        }
        for (key, (collection, uid, mut fields)) in current {
            let known = self.acknowledged.get(&key).cloned().unwrap_or_default();
            // Absent optional fields are deletions. A tombstone never clears preserved record contents.
            if fields.get("_deleted") != Some(&Some(json!(true))) {
                for field in known.keys() {
                    fields.entry(field.clone()).or_insert(None);
                }
            }
            for (field, value) in fields {
                let patch_key = format!("{key}/{field}");
                let sent_pending = self.pending.get(&patch_key).filter(|pending| {
                    self.received
                        .entities
                        .get(&key)
                        .and_then(|e| e.fields.get(&field))
                        .is_some_and(|cell| cell.stamp == pending.stamp)
                });
                if known
                    .get(&field)
                    .is_some_and(|old| old.hash == hash(&value))
                    && sent_pending.is_none()
                {
                    self.pending.remove(&patch_key);
                    continue;
                }
                if self
                    .pending
                    .get(&patch_key)
                    .is_some_and(|old| old.value == value)
                {
                    continue;
                }
                self.clock = self
                    .clock
                    .max(self.received.clock)
                    .checked_add(1)
                    .ok_or("Переполнен счётчик изменений.")?;
                let base = sent_pending
                    .map(|pending| pending.stamp.clone())
                    .or_else(|| known.get(&field).map(|k| k.stamp.clone()));
                let observed = known
                    .values()
                    .map(|cell| cell.stamp.clock)
                    .max()
                    .unwrap_or(0);
                self.pending.insert(
                    patch_key,
                    Patch {
                        collection: collection.clone(),
                        uid: uid.clone(),
                        field: field.clone(),
                        value,
                        stamp: Stamp {
                            clock: self.clock,
                            device: self.device.clone(),
                        },
                        base,
                        observed,
                    },
                );
            }
        }
        Ok(self.pending.values().cloned().collect())
    }
    pub fn stage(
        &mut self,
        hub: Hub,
        local: &WorkspaceDocument,
    ) -> Result<(WorkspaceDocument, String)> {
        let mut canonical = Client {
            device: self.device.clone(),
            generation: 1,
            aliases: self.aliases.clone(),
            ..Client::default()
        };
        let patches = canonical.export(local)?;
        let mut local_hub = Hub::default();
        local_hub.merge(&patches, &self.device)?;
        self.staged_local = Some(local_hub);
        self.rejected.retain(|key, (version, _)| {
            hub.entities
                .get(key)
                .is_some_and(|entity| hash(entity) == *version)
        });
        let effective = self.effective(&hub);
        let mut document = effective.document(local)?;
        if let Some(prefs) = document.data["uiPreferences"].as_object_mut() {
            let rewrite = |selection: &mut Value| {
                if let Some(sources) = selection.as_object_mut() {
                    for (kind, ids) in sources {
                        let collection = if kind == "projectTasks" {
                            "projects"
                        } else {
                            kind.as_str()
                        };
                        if let Some(ids) = ids.as_array_mut() {
                            for id in ids {
                                if id.is_number() {
                                    if let Some(uid) =
                                        self.aliases.get(&format!("{collection}/{id}"))
                                    {
                                        *id = json!(uid);
                                    }
                                }
                            }
                        }
                    }
                }
            };
            if let Some(selection) = prefs.get_mut("aiSelection") {
                rewrite(selection);
            }
            if let Some(presets) = prefs
                .get_mut("aiContextPresets")
                .and_then(Value::as_array_mut)
            {
                for preset in presets {
                    rewrite(&mut preset["selection"]);
                }
            }
        }
        let receipt = Uuid::new_v4().to_string();
        let baseline = effective
            .entities
            .iter()
            .map(|(key, entity)| {
                (
                    key.clone(),
                    entity
                        .fields
                        .iter()
                        .map(|(field, cell)| {
                            (
                                field.clone(),
                                Known {
                                    hash: hash(&cell.value),
                                    stamp: cell.stamp.clone(),
                                },
                            )
                        })
                        .collect(),
                )
            })
            .collect();
        self.clock = self.clock.max(hub.clock);
        self.received = hub;
        self.staged = Some((receipt.clone(), baseline));
        Ok((document, receipt))
    }
    fn effective(&self, hub: &Hub) -> Hub {
        let mut effective = hub.clone();
        for (key, (_, entity)) in &self.rejected {
            match entity {
                Some(local) => {
                    let mut local = local.clone();
                    // Retain observed stamps but locally chosen values; rejection
                    // must not become an outgoing edit or delete on the next retry.
                    if let Some(remote) = hub.entities.get(key) {
                        for (field, cell) in &mut local.fields {
                            if let Some(observed) = remote.fields.get(field) {
                                cell.stamp = observed.stamp.clone();
                            }
                        }
                        for (field, cell) in &remote.fields {
                            local.fields.entry(field.clone()).or_insert_with(|| Cell {
                                stamp: cell.stamp.clone(),
                                value: None,
                            });
                        }
                    }
                    effective.entities.insert(key.clone(), local);
                }
                None => {
                    if let Some(entity) = effective.entities.get_mut(key) {
                        entity.fields.insert(
                            "_deleted".into(),
                            Cell {
                                stamp: Stamp {
                                    clock: hub.clock,
                                    device: self.device.clone(),
                                },
                                value: Some(json!(true)),
                            },
                        );
                    }
                }
            }
        }
        effective
    }
    pub fn comparison(&self, local: &WorkspaceDocument) -> Result<Value> {
        let canonical = self
            .staged_local
            .as_ref()
            .ok_or("Нет сравнения.")?
            .document(local)?;
        Ok(
            json!({"local":canonical,"source":self.received.entities.iter().map(|(key,entity)|(key.clone(),entity.fields.values().max_by_key(|c|c.stamp.clock).map(|c|c.stamp.device.clone()).unwrap_or_default())).collect::<BTreeMap<_,_>>() }),
        )
    }
    pub fn review(
        &mut self,
        receipt: &str,
        rejected: &[String],
        local: &WorkspaceDocument,
    ) -> Result<(WorkspaceDocument, String)> {
        if self
            .staged
            .as_ref()
            .is_none_or(|(token, _)| token != receipt)
        {
            return Err("Сравнение устарело. Выполните обмен снова.".into());
        }
        let local_hub = self
            .staged_local
            .clone()
            .ok_or("Нет локального снимка сравнения.")?;
        for key in rejected {
            let remote = self
                .received
                .entities
                .get(key)
                .ok_or("Запись сравнения не найдена.")?;
            self.rejected.insert(
                key.clone(),
                (hash(remote), local_hub.entities.get(key).cloned()),
            );
        }
        self.stage(self.received.clone(), local)
    }
    pub fn acknowledge(&mut self, receipt: &str) -> Result<()> {
        let (token, baseline) = self.staged.take().ok_or("Обмен уже завершён.")?;
        if token != receipt {
            self.staged = Some((token, baseline));
            return Err("Устаревший результат обмена.".into());
        }
        self.acknowledged = baseline;
        self.generation = self.received.generation;
        self.pending.clear();
        Ok(())
    }
    pub fn review_with_both(
        &mut self,
        receipt: &str,
        rejected: &[String],
        both: &[String],
        local: &WorkspaceDocument,
    ) -> Result<(WorkspaceDocument, String)> {
        let local_hub = self.staged_local.clone().ok_or("Нет сравнения.")?;
        let mut unique = std::collections::BTreeSet::new();
        for key in both {
            if !unique.insert(key) || rejected.contains(key) {
                return Err("Вторая версия должна относиться к отдельной принятой записи.".into());
            }
            let original = local_hub
                .entities
                .get(key)
                .ok_or("Локальная версия отсутствует.")?;
            if !["tasks", "events", "thoughts", "archiveItems"]
                .contains(&original.collection.as_str())
            {
                return Err("Для этой записи нельзя сохранять обе версии отдельно.".into());
            }
        }
        let (mut document, token) = self.review(receipt, rejected, local)?;
        for key in both {
            let original = local_hub
                .entities
                .get(key)
                .ok_or("Локальная версия отсутствует.")?;
            if !["tasks", "events", "thoughts", "archiveItems"]
                .contains(&original.collection.as_str())
            {
                return Err("Для этой записи нельзя сохранять обе версии отдельно.".into());
            }
            let mut copy = original.clone();
            copy.uid = Uuid::new_v4().to_string();
            for field in [
                "source",
                "workoutId",
                "taskId",
                "eventId",
                "originProjectId",
            ] {
                copy.fields.remove(field);
            }
            let mut single = self.effective(&self.received);
            single
                .entities
                .insert(entity_key(&copy.collection, &copy.uid), copy.clone());
            let expanded = single.document(&document)?;
            let row = expanded.data[&copy.collection]
                .as_array()
                .unwrap()
                .iter()
                .find(|row| row["_syncId"] == copy.uid)
                .cloned()
                .ok_or("Не удалось сохранить вторую версию.")?;
            // The new UUID is a local creation; it is published as normal edits
            // after this reviewed workspace has actually been committed.
            document.data[&copy.collection]
                .as_array_mut()
                .unwrap()
                .push(row);
            for cover in expanded
                .covers
                .into_iter()
                .filter(|(id, _)| *id == numeric_id(&copy.uid))
            {
                document.covers.push(cover);
            }
            document.data["nextId"] = json!(document.data["nextId"]
                .as_i64()
                .unwrap_or(1)
                .max(numeric_id(&copy.uid) + 1));
        }
        validate_workspace(&document).map_err(|e| e.to_string())?;
        Ok((document, token))
    }
}
