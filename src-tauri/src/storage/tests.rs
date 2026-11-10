use super::*;
use crate::domain::*;
use rusqlite::params;
use std::path::PathBuf;

struct TestFile(PathBuf);
impl TestFile {
    fn new() -> Self {
        Self(
            std::env::temp_dir()
                .join(format!("life-os-test-{}", id()))
                .join("workspace.sqlite3"),
        )
    }
    fn open(&self) -> Repository {
        Repository::open(&self.0).unwrap()
    }
}
impl Drop for TestFile {
    fn drop(&mut self) {
        // Only the unique directory created by this test is removed.
        if let Some(parent) = self.0.parent() {
            let _ = std::fs::remove_dir_all(parent);
        }
    }
}
fn project(area: Option<String>) -> ProjectInput {
    ProjectInput {
        id: None,
        title: "Make space for reading".into(),
        description: "A little each day".into(),
        area_id: area,
        status: ProjectStatus::Active,
        next_action: Some("Choose a book".into()),
        target_date: Some("2026-10-01".into()),
        review_date: Some("2026-09-27".into()),
    }
}
fn checkin() -> CheckinInput {
    CheckinInput {
        date: "2026-09-21".into(),
        mood: Some(7),
        energy: Some(6),
        stress: Some(3),
        sleep_minutes: Some(450),
        note: Some("A quiet morning".into()),
    }
}
fn review_input(key: String) -> ReviewInput {
    ReviewInput {
        id: key,
        current_step: 4,
        complete: false,
        focuses: vec!["Leave room to rest".into()],
        entries: REVIEW_SECTIONS
            .iter()
            .map(|section| ReflectionInput {
                section: (*section).into(),
                content: format!("Reflection on {section}"),
            })
            .collect(),
    }
}
#[test]
fn data_survives_reopening_and_seeding_is_idempotent() {
    let file = TestFile::new();
    let (inbox, project_id, win, review, area_ids);
    {
        let mut repo = file.open();
        let snapshot = repo.snapshot().unwrap();
        assert_eq!(snapshot.areas.len(), 9);
        area_ids = snapshot
            .areas
            .iter()
            .map(|a| a.id.clone())
            .collect::<Vec<_>>();
        inbox = repo.add_inbox("  Call the dentist  ".into()).unwrap();
        project_id = repo
            .save_project(project(Some(area_ids[0].clone())))
            .unwrap();
        win = repo
            .add_win(WinInput {
                title: "Made time for myself".into(),
                note: Some("An afternoon outside".into()),
                area_id: Some(area_ids[0].clone()),
                project_id: Some(project_id.clone()),
                task_id: None,
                occurred_at: "2026-09-21T12:00:00+05:00".into(),
            })
            .unwrap();
        repo.save_checkin(checkin()).unwrap();
        review = repo.start_review("2026-09-21".into()).unwrap();
        repo.save_review(review_input(review.clone())).unwrap();
    }
    let mut repo = file.open();
    let snapshot = repo.snapshot().unwrap();
    assert_eq!(
        snapshot
            .areas
            .iter()
            .map(|a| a.id.clone())
            .collect::<Vec<_>>(),
        area_ids
    );
    assert_eq!(snapshot.inbox_items[0].id, inbox);
    assert_eq!(snapshot.inbox_items[0].content, "Call the dentist");
    assert_eq!(snapshot.projects[0].id, project_id);
    assert_eq!(snapshot.wins[0].id, win);
    assert_eq!(snapshot.wins[0].occurred_at, "2026-09-21T07:00:00.000Z");
    assert_eq!(snapshot.checkins[0].sleep_minutes, Some(450));
    assert_eq!(snapshot.reviews[0].id, review);
    assert_eq!(snapshot.reviews[0].current_step, 4);
    assert_eq!(snapshot.review_entries.len(), 11);
    for entry in &snapshot.review_entries {
        identifier(&entry.id).unwrap();
        timestamp(&entry.created_at).unwrap();
    }
    assert_eq!(repo.start_review("2026-09-28".into()).unwrap(), review);
    let count: i64 = repo
        .connection
        .query_row("SELECT COUNT(*) FROM schema_migrations", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 3);
}
#[test]
fn checkin_upsert_keeps_identity_and_creation_time() {
    let file = TestFile::new();
    let mut repo = file.open();
    repo.save_checkin(checkin()).unwrap();
    let original = repo.snapshot().unwrap().checkins.remove(0);
    let mut update = checkin();
    update.mood = Some(9);
    update.note = Some("Changed my mind".into());
    repo.save_checkin(update).unwrap();
    let snapshot = repo.snapshot().unwrap();
    assert_eq!(snapshot.checkins.len(), 1);
    assert_eq!(snapshot.checkins[0].id, original.id);
    assert_eq!(snapshot.checkins[0].created_at, original.created_at);
    assert_eq!(snapshot.checkins[0].mood, Some(9));
    let mut bad = checkin();
    bad.mood = Some(11);
    assert!(repo.save_checkin(bad).is_err());
    let mut bad = checkin();
    bad.date = "2026-02-30".into();
    assert!(repo.save_checkin(bad).is_err());
    let mut bad = checkin();
    bad.sleep_minutes = Some(-1);
    assert!(repo.save_checkin(bad).is_err());
    assert_eq!(repo.snapshot().unwrap().checkins[0].mood, Some(9));
}
#[test]
fn invalid_writes_do_not_change_persisted_data() {
    let file = TestFile::new();
    let mut repo = file.open();
    assert!(repo.add_inbox("   ".into()).is_err());
    assert!(repo.save_project(project(Some(id()))).is_err());
    let mut bad = project(None);
    bad.target_date = Some("not a date".into());
    assert!(repo.save_project(bad).is_err());
    assert!(repo.delete_inbox(id()).is_err());
    let review = repo.start_review("2026-09-21".into()).unwrap();
    repo.save_review(review_input(review.clone())).unwrap();
    let mut bad = review_input(review.clone());
    bad.focuses = vec!["a".into(), "b".into(), "c".into(), "d".into()];
    assert!(repo.save_review(bad).is_err());
    let mut bad = review_input(review);
    bad.entries[0].section = "invalid".into();
    assert!(repo.save_review(bad).is_err());
    let snapshot = repo.snapshot().unwrap();
    assert!(snapshot.projects.is_empty());
    assert!(snapshot.inbox_items.is_empty());
    assert_eq!(snapshot.review_entries.len(), 11);
    assert!(repo.connection.execute("INSERT INTO daily_checkins (id,date,mood,created_at,updated_at) VALUES (?1,'2026-09-22',11,?2,?2)", params![id(),now()]).is_err());
}
#[test]
fn processing_archiving_and_task_completion_are_independent_of_wins() {
    let file = TestFile::new();
    let mut repo = file.open();
    let inbox = repo.add_inbox("Something to think about".into()).unwrap();
    repo.process_inbox(inbox.clone(), true).unwrap();
    assert!(repo.snapshot().unwrap().inbox_items[0]
        .processed_at
        .is_some());
    repo.process_inbox(inbox.clone(), false).unwrap();
    repo.delete_inbox(inbox).unwrap();
    let project_id = repo.save_project(project(None)).unwrap();
    repo.set_project_status(project_id.clone(), ProjectStatus::Archived)
        .unwrap();
    assert!(repo.snapshot().unwrap().projects[0].archived_at.is_some());
    repo.set_project_status(project_id.clone(), ProjectStatus::Active)
        .unwrap();
    let task_id = repo
        .save_task(TaskInput {
            id: None,
            title: "Read a chapter".into(),
            notes: None,
            project_id: Some(project_id),
            area_id: None,
            scheduled_date: Some("2026-09-21".into()),
            due_date: None,
        })
        .unwrap();
    repo.set_task_status(task_id.clone(), TaskStatus::Completed)
        .unwrap();
    let snapshot = repo.snapshot().unwrap();
    assert!(snapshot.projects[0].archived_at.is_none());
    assert!(snapshot.tasks[0].completed_at.is_some());
    assert!(snapshot.wins.is_empty());
    repo.set_task_status(task_id, TaskStatus::Open).unwrap();
    assert!(repo.snapshot().unwrap().tasks[0].completed_at.is_none());
}
#[test]
fn completed_review_is_stable_and_new_week_can_start() {
    let file = TestFile::new();
    let mut repo = file.open();
    let key = repo.start_review("2026-09-21".into()).unwrap();
    let mut input = review_input(key.clone());
    input.current_step = 9;
    input.complete = true;
    repo.save_review(input).unwrap();
    assert_eq!(repo.start_review("2026-09-21".into()).unwrap(), key);
    assert!(repo.save_review(review_input(key.clone())).is_err());
    assert_ne!(repo.start_review("2026-09-28".into()).unwrap(), key);
    let snapshot = repo.snapshot().unwrap();
    assert_eq!(snapshot.reviews.len(), 2);
    assert!(snapshot
        .reviews
        .iter()
        .find(|r| r.id == key)
        .unwrap()
        .completed_at
        .is_some());
}
#[test]
fn focus_edits_preserve_identity_and_removed_focuses_are_deleted() {
    let file = TestFile::new();
    let mut repo = file.open();
    let key = repo.start_review("2026-09-21".into()).unwrap();
    repo.save_review(review_input(key.clone())).unwrap();
    let old = repo
        .snapshot()
        .unwrap()
        .review_entries
        .into_iter()
        .find(|e| e.section == "focus_1")
        .unwrap();
    let mut input = review_input(key.clone());
    input.focuses = vec!["A revised direction".into(), "Another focus".into()];
    repo.save_review(input).unwrap();
    let current = repo.snapshot().unwrap().review_entries;
    let focus = current.iter().find(|e| e.section == "focus_1").unwrap();
    assert_eq!(focus.id, old.id);
    assert_eq!(focus.created_at, old.created_at);
    assert_eq!(focus.content, "A revised direction");
    let mut input = review_input(key);
    input.focuses.clear();
    repo.save_review(input).unwrap();
    assert!(repo
        .snapshot()
        .unwrap()
        .review_entries
        .iter()
        .all(|e| !e.section.starts_with("focus_")));
}
#[test]
fn migration_is_atomic_and_refuses_newer_databases() {
    let mut connection = Connection::open_in_memory().unwrap();
    connection
        .execute_batch("CREATE TABLE wins (existing TEXT);")
        .unwrap();
    assert!(Repository::migrate(&mut connection).is_err());
    let areas: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE name='areas'",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(areas, 0);
    connection.execute_batch("DROP TABLE wins; CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT, applied_at TEXT); INSERT INTO schema_migrations VALUES(99,'future','2026-09-21T00:00:00Z');").unwrap();
    assert!(Repository::migrate(&mut connection).is_err());
    let version: i64 = connection
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert_eq!(version, 99);
}
