use super::*;
use serde_json::json;
use std::path::PathBuf;

struct WorkspaceFile(PathBuf);

#[test]
fn personal_day_and_optional_health_records_roundtrip_and_validate() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut doc = repo.load_workspace().unwrap();
    doc.data["lifePreferences"] = json!({"personalDay":{"enabled":true,"start":"22:00"},"nutrition":{"water":false,"calories":true,"macros":false,"micronutrients":true},"weight":true,"illness":true,"nutrientTargets":[{"key":"magnesium","name":"Магний","unit":"мг","target":100.0}]});
    doc.data["weightLogs"] =
        json!([{"id":1,"date":"2026-10-28","kg":74.5,"occurredAt":1793181600000_i64}]);
    doc.data["illnessLogs"] =
        json!([{"id":2,"date":"2026-10-27","until":"2026-10-29","note":"Простуда"}]);
    doc.data["nutrientLogs"] = json!([{"id":3,"date":"2026-10-28","nutrientKey":"magnesium","name":"Магний","unit":"мг","amount":25.0}]);
    doc.data["workouts"] = json!([{"id":4,"date":"2026-10-28","name":"Тренировка","time":"23:00","duration":30,"done":true,"entries":[{"exerciseKey":"pull","name":"Подтягивания","unit":"раз","value":10,"done":true,"sets":1,"effort":4}]}]);
    doc.data["workouts"][0]["effort"] = json!(4);
    doc.data["workouts"][0]["effortRatedAt"] = json!(1793181600000_i64);
    doc.data["nextId"] = json!(5);
    repo.save_workspace(&doc).unwrap();
    drop(repo);
    let mut repo = file.open();
    let stored = repo.load_workspace().unwrap();
    for key in [
        "lifePreferences",
        "weightLogs",
        "illnessLogs",
        "nutrientLogs",
        "workouts",
    ] {
        assert_eq!(stored.data[key], doc.data[key]);
    }
    for (key, value) in [
        ("weightLogs", json!([{"id":1,"date":"2026-10-28","kg":-5}])),
        (
            "illnessLogs",
            json!([{"id":1,"date":"2026-10-28","until":"2026-10-27"}]),
        ),
        (
            "nutrientLogs",
            json!([{"id":1,"date":"2026-10-28","name":"X","nutrientKey":"x","unit":"мг","amount":"25"}]),
        ),
        (
            "lifePreferences",
            json!({"personalDay":{"enabled":true,"start":"25:00"}}),
        ),
    ] {
        let mut bad = stored.clone();
        bad.data[key] = value;
        assert!(validate_workspace(&bad).is_err());
    }
    for rating in [json!(0), json!(6), json!(3.5), json!("4")] {
        let mut bad = stored.clone();
        bad.data["workouts"][0]["effort"] = rating;
        assert!(validate_workspace(&bad).is_err());
    }
    let mut bad = stored;
    bad.data["workouts"][0]["entries"][0]["effort"] = json!(3.5);
    assert!(validate_workspace(&bad).is_err());
}

#[test]
fn workspace_force_kill_child_writer() {
    let Some(root) = std::env::var_os("LIFE_OS_TEST_KILL_ROOT") else {
        return;
    };
    let mut repo = Repository::open(&PathBuf::from(root).join("workspace.sqlite3")).unwrap();
    let mut doc = repo.load_workspace().unwrap();
    doc.data["projects"] =
        json!([{"id":1,"name":"После завершения","description":"","tone":"sun"}]);
    doc.data["tasks"] = json!([{"id":2,"title":"Не потерять","context":"После завершения","date":"2026-10-08","time":"10:00","done":false}]);
    doc.data["thoughts"] =
        json!([{"id":3,"title":"Мысль","body":"Сохранена","context":"Личное","date":"2026-10-08"}]);
    doc.data["nextId"] = json!(4);
    repo.save_workspace(&doc).unwrap();
    use std::io::Write;
    println!("LIFE_OS_COMMITTED");
    std::io::stdout().flush().unwrap();
    loop {
        std::thread::sleep(std::time::Duration::from_secs(1));
    }
}
#[test]
fn committed_entities_survive_real_forced_process_termination() {
    let root =
        std::env::temp_dir().join(format!("lifeos-force-kill-test-{}", uuid::Uuid::new_v4()));
    std::fs::create_dir(&root).unwrap();
    let mut child = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "storage::workspace_tests::workspace_force_kill_child_writer",
            "--nocapture",
        ])
        .env("LIFE_OS_TEST_KILL_ROOT", &root)
        .stdout(std::process::Stdio::piped())
        .spawn()
        .unwrap();
    let stdout = child.stdout.take().unwrap();
    let (send, receive) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        use std::io::BufRead;
        for line in std::io::BufReader::new(stdout)
            .lines()
            .map_while(std::result::Result::ok)
        {
            if line.contains("LIFE_OS_COMMITTED") {
                let _ = send.send(());
                break;
            }
        }
    });
    let committed = receive.recv_timeout(std::time::Duration::from_secs(30));
    let _ = child.kill();
    child.wait().unwrap();
    assert!(
        committed.is_ok(),
        "child must commit before forced termination"
    );
    let mut repo = Repository::open(&root.join("workspace.sqlite3")).unwrap();
    let doc = repo.load_workspace().unwrap();
    for name in ["projects", "tasks", "thoughts"] {
        assert_eq!(doc.data[name].as_array().unwrap().len(), 1);
    }
    let integrity: String = repo
        .connection
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .unwrap();
    assert_eq!(integrity, "ok");
    drop(repo);
    let resolved = std::fs::canonicalize(&root).unwrap();
    assert_eq!(
        resolved.parent(),
        Some(
            std::fs::canonicalize(std::env::temp_dir())
                .unwrap()
                .as_path()
        )
    );
    assert!(resolved
        .file_name()
        .unwrap()
        .to_string_lossy()
        .starts_with("lifeos-force-kill-test-"));
    std::fs::remove_dir_all(resolved).unwrap();
}

#[test]
fn full_wipe_removes_records_legacy_data_and_managed_backups() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut doc = repo.load_workspace().unwrap();
    doc.data["thoughts"] = json!([{"id":1,"title":"Delete me","body":"Private","context":"Личное","date":"2026-10-08"}]);
    repo.save_workspace(&doc).unwrap();
    repo.backup_now("test").unwrap();
    repo.wipe_personal_data().unwrap();
    assert!(crate::backups::list(&repo.backup_root).unwrap().is_empty());
    let doc = repo.load_workspace().unwrap();
    for c in COLLECTIONS {
        assert!(doc.data[c].as_array().unwrap().is_empty());
    }
    drop(repo);
    assert!(file.open().load_workspace().unwrap().data["thoughts"]
        .as_array()
        .unwrap()
        .is_empty());
}

#[cfg(target_os = "windows")]
#[test]
fn blocked_backup_refuses_wipe_before_removing_records() {
    use std::os::windows::fs::OpenOptionsExt;
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut doc = repo.load_workspace().unwrap();
    doc.data["thoughts"] = json!([{"id":1,"title":"Keep on failed wipe","body":"Synthetic","context":"Личное","date":"2026-10-28"}]);
    repo.save_workspace(&doc).unwrap();
    let copy = repo.backup_now("locked-test").unwrap();
    let lock = std::fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(copy)
        .unwrap();
    assert!(repo.wipe_personal_data().is_err());
    assert_eq!(
        repo.load_workspace().unwrap().data["thoughts"]
            .as_array()
            .unwrap()
            .len(),
        1
    );
    drop(lock);
    repo.wipe_personal_data().unwrap();
    assert!(repo.load_workspace().unwrap().data["thoughts"]
        .as_array()
        .unwrap()
        .is_empty());
}

#[test]
fn unsupported_workspace_format_never_becomes_empty_state() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut document = repo.load_workspace().unwrap();
    document.data["projects"] = json!([{"id":1,"name":"Не удалять","description":""}]);
    document.data["nextId"] = json!(2);
    repo.save_workspace(&document).unwrap();
    repo.connection
        .execute(
            "UPDATE workspace_document SET settings=json_set(settings,'$.version',999)",
            [],
        )
        .unwrap();
    assert!(repo.load_workspace().is_err());
    let count: i64 = repo
        .connection
        .query_row(
            "SELECT count(*) FROM workspace_records WHERE collection='projects'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1);
}
impl WorkspaceFile {
    fn new() -> Self {
        Self(
            std::env::temp_dir()
                .join(format!("life-os-workspace-test-{}", crate::domain::id()))
                .join("data.sqlite3"),
        )
    }
    fn open(&self) -> Repository {
        Repository::open(&self.0).unwrap()
    }
}
impl Drop for WorkspaceFile {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(self.0.parent().unwrap());
    }
}

#[test]
fn version_two_upgrade_preserves_records_and_adds_empty_collections() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut document = repo.load_workspace().unwrap();
    document.data["tasks"] = json!([{"id":1,"title":"До обновления","context":"Личное","date":"2026-10-05","done":false}]);
    document.data["nextId"] = json!(2);
    repo.save_workspace(&document).unwrap();
    repo.connection
        .execute("DELETE FROM schema_migrations WHERE version=3", [])
        .unwrap();
    repo.connection
        .execute(
            "UPDATE workspace_document SET settings=json_set(settings,'$.version',29)",
            [],
        )
        .unwrap();
    drop(repo);
    let mut reopened = file.open();
    let actual = reopened.load_workspace().unwrap();
    assert_eq!(actual.data["version"], 32);
    assert_eq!(actual.data["tasks"], document.data["tasks"]);
    for name in ["thoughts", "financeLogs", "exercises"] {
        assert_eq!(actual.data[name], json!([]));
    }
    let integrity: String = reopened
        .connection
        .query_row("PRAGMA quick_check", [], |row| row.get(0))
        .unwrap();
    assert_eq!(integrity, "ok");
}

#[test]
fn workspace_all_collections_covers_and_settings_survive_restart() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut doc = repo.load_workspace().unwrap();
    doc.data["projects"] = json!([{"id":1,"name":"Поездка","description":"Маршрут","tone":"pine"}]);
    doc.data["tasks"] = json!([{"id":2,"title":"Билеты","description":"Выбрать рейс","context":"Поездка","date":"2026-10-02","done":false,"duration":30}]);
    doc.data["events"] = json!([{"id":3,"title":"Тренировка","context":"Личное","date":"2026-10-02","start":"10:00","end":"11:00","tone":"pine"}]);
    doc.data["checkins"] =
        json!([{"at":1790902800000_i64,"mood":4,"energy":3,"stress":2,"note":"После сна"}]);
    doc.data["sleepLogs"] = json!([{"date":"2026-10-02","hours":7.5,"quality":4,"note":""}]);
    doc.data["foodLogs"] = json!([{"id":4,"date":"2026-10-02","name":"Завтрак","calories":350,"protein":20,"fat":15,"carbs":30}]);
    doc.data["savedMeals"] =
        json!([{"id":5,"name":"Завтрак","calories":350,"protein":20,"fat":15,"carbs":30}]);
    doc.data["workouts"] = json!([{"id":6,"date":"2026-10-02","name":"Подтягивания","duration":30,"time":"10:00","done":false}]);
    doc.data["recoveryLogs"] =
        json!([{"id":7,"date":"2026-10-02","kind":"Прогулка","duration":20,"note":"Парк"}]);
    doc.data["waterLogs"] = json!([{"id":8,"date":"2026-10-02","ml":250,"at":1790902800000_i64}]);
    doc.data["trainingGoals"] = json!([{"id":9,"name":"Подтягивания","unit":"раз","focus":"Спина","baseline":2,"current":5,"target":10,"history":[]}]);
    doc.data["archiveItems"] = json!([{"id":10,"name":"Фильм","category":"Фильмы","date":"2026-10-02","rating":5,"review":"Заметка"}]);
    doc.covers = vec![(10, "data:image/png;base64,iVBORw0KGgo=".into())];
    doc.data["taskTemplates"] =
        json!([{"id":11,"name":"Утро","items":[{"title":"План","duration":10}]}]);
    doc.data["thoughts"] =
        json!([{"id":12,"title":"Мысль","body":"Маршрут","context":"Поездка","date":"2026-10-02"}]);
    doc.data["financeLogs"] = json!([{"id":13,"date":"2026-10-02","type":"expense","amount":350.25,"currency":"KZT","category":"Питание","note":"Обед"}]);
    doc.data["exercises"] = json!([{"id":14,"name":"Мои подтягивания","duration":30}]);
    doc.data["palette"] = json!("winter");
    doc.data["languageMode"] = json!("en");
    doc.data["fontMode"] = json!("soft");
    doc.data["nextId"] = json!(15);
    doc.revision = repo.save_workspace(&doc).unwrap();
    drop(repo);
    let actual = file.open().load_workspace().unwrap();
    assert_eq!(actual.data, doc.data);
    assert_eq!(actual.covers, doc.covers);
    assert_eq!(actual.revision, doc.revision);
}
#[test]
fn workspace_rejects_invalid_numbers_and_conflicting_windows_atomically() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut doc = repo.load_workspace().unwrap();
    let original = doc.data.clone();
    doc.data["foodLogs"] = json!([{"id":1,"date":"2026-10-02","name":"Еда","calories":"abc","protein":0,"fat":0,"carbs":0}]);
    assert!(repo.save_workspace(&doc).is_err());
    assert_eq!(repo.load_workspace().unwrap().data, original);
    doc.data = original;
    let mut second = file.open();
    let stale = second.load_workspace().unwrap();
    doc.data["fontMode"] = json!("strict");
    doc.revision = repo.save_workspace(&doc).unwrap();
    assert!(second.save_workspace(&stale).is_err());
    assert_eq!(second.load_workspace().unwrap().data, doc.data);
}

#[test]
fn workspace_roundtrips_material_references_files_and_drafts() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut doc = repo.load_workspace().unwrap();
    let attachment = json!({"name":"plan.txt","size":3,"data":"data:text/plain;base64,YWJj"});
    doc.data["archiveCategories"] = json!(["Материалы", "Игры"]);
    doc.data["archiveItems"] = json!([{"id":40,"name":"План","category":"Материалы","date":"2026-10-06","rating":null,"review":"Заметка","kind":"material","status":"active","originProjectId":41,"url":"https://example.com/plan","attachments":[attachment.clone()]},{"id":43,"name":"Игра","category":"Игры","date":"2026-10-06","rating":7.5,"ratingMax":10,"review":"Заметка","kind":"game","status":"status-44","statusPhase":"done","genres":["RPG"]}]);
    doc.data["projects"] =
        json!([{"id":41,"name":"Поездка","description":"Маршрут","materialIds":[40]}]);
    doc.data["thoughts"] = json!([{"id":42,"title":"Идея","body":"Мой маршрут","date":"2026-10-06","context":"Личное","materialIds":[40]}]);
    doc.data["uiPreferences"]["databaseDrafts"] = json!({"project-41":{"name":"Черновик","review":"Заметка","kind":"material","status":"active","progress":{"current":12,"total":100},"attachments":[attachment]}});
    doc.data["uiPreferences"]["databaseCollections"] = json!([{"name":"Игры","kind":"game","ratingEnabled":true,"ratingMax":10,"statuses":[{"id":"planned","label":"Не пройдено","phase":"planned"},{"id":"status-44","label":"Пройдено","phase":"done"}],"genres":["RPG"]}]);
    doc.data["nextId"] = json!(45);
    doc.revision = repo.save_workspace(&doc).unwrap();
    drop(repo);
    let restored = file.open().load_workspace().unwrap();
    assert_eq!(restored.data, doc.data);
    assert_eq!(restored.data["projects"][0]["materialIds"], json!([40]));
    assert_eq!(
        restored.data["archiveItems"][0]["attachments"][0]["data"],
        json!("data:text/plain;base64,YWJj")
    );
}
#[test]
fn workspace_stress_ten_thousand_tasks_reopens_and_deletes() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    let mut doc = repo.load_workspace().unwrap();
    doc.data["tasks"]=json!((1..=10000).map(|id|json!({"id":id,"title":format!("Задача {id}"),"context":"Личное","date":"2026-10-02","done":false})).collect::<Vec<_>>());
    doc.data["nextId"] = json!(10001);
    doc.revision = repo.save_workspace(&doc).unwrap();
    drop(repo);
    let mut repo = file.open();
    assert_eq!(
        repo.load_workspace().unwrap().data["tasks"]
            .as_array()
            .unwrap()
            .len(),
        10000
    );
    doc.data["tasks"].as_array_mut().unwrap().drain(..9999);
    doc.revision = repo.save_workspace(&doc).unwrap();
    assert_eq!(
        repo.load_workspace().unwrap().data["tasks"],
        doc.data["tasks"]
    );
}
#[test]
fn legacy_import_preserves_original_tables_and_runs_once() {
    let file = WorkspaceFile::new();
    let mut repo = file.open();
    repo.add_inbox("Старая идея".into()).unwrap();
    let before = repo.snapshot().unwrap();
    let doc = repo.load_workspace().unwrap();
    assert!(doc.data["tasks"]
        .as_array()
        .unwrap()
        .iter()
        .any(|item| item["title"] == "Старая идея"));
    assert_eq!(
        repo.snapshot().unwrap().inbox_items.len(),
        before.inbox_items.len()
    );
    assert_eq!(repo.load_workspace().unwrap().revision, doc.revision);
}
