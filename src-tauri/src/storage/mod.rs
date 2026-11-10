mod actions;
mod reflections;
mod snapshot;
mod workspace;
pub use workspace::WorkspaceDocument;
pub(crate) use workspace::{validate_workspace, COLLECTIONS};
#[cfg(test)]
mod tests;
#[cfg(test)]
mod workspace_tests;

use crate::domain::{Error, Result};
use rusqlite::{Connection, TransactionBehavior};
use std::path::{Path, PathBuf};
use std::time::Duration;

pub struct Repository {
    pub(super) connection: Connection,
    pub(crate) backup_root: PathBuf,
    pub(crate) backup_error: Option<String>,
    pub(super) last_backup: Option<std::time::Instant>,
}

impl Repository {
    pub fn open(path: &Path) -> Result<Self> {
        Self::open_with_backups(
            path,
            &path
                .parent()
                .unwrap_or(Path::new("."))
                .join("automatic-backups"),
        )
    }
    pub fn open_with_backups(path: &Path, backup_root: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut connection = crate::encryption::open(path).map_err(Error::Validation)?;
        connection.busy_timeout(Duration::from_secs(5))?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "synchronous", "FULL")?;
        let has_document: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='workspace_document')",[],|r|r.get(0))?;
        let has_migrations: bool = connection.query_row("SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='schema_migrations')", [], |r| r.get(0))?;
        let schema: i64 = if has_migrations {
            connection.query_row(
                "SELECT COALESCE(MAX(version),0) FROM schema_migrations",
                [],
                |r| r.get(0),
            )?
        } else {
            0
        };
        if schema > 3 {
            return Err(Error::Validation(
                "База создана более новой версией Orvim. Она не изменена.".into(),
            ));
        }
        if has_document {
            let format: Option<i64> = connection
                .query_row(
                    "SELECT json_extract(settings,'$.version') FROM workspace_document WHERE id=1",
                    [],
                    |r| r.get(0),
                )
                .ok();
            if format.is_some_and(|v| v > 32) {
                return Err(Error::Validation(
                    "Данные созданы более новой версией Orvim. Они не изменены.".into(),
                ));
            }
        }
        if has_document || schema > 0 {
            let old_version: Option<String> =
                std::fs::read_to_string(path.with_extension("app-version")).ok();
            if schema < 3 || old_version.as_deref() != Some(env!("CARGO_PKG_VERSION")) {
                std::fs::create_dir_all(backup_root)?;
                let copy = backup_root.join(format!(
                    "orvim-{}-before-version-{}.sqlite3",
                    chrono::Utc::now().format("%Y%m%dT%H%M%S%3f"),
                    uuid::Uuid::new_v4()
                ));
                connection.execute("VACUUM INTO ?1", [copy.to_string_lossy().as_ref()])?;
                let backup = crate::encryption::open(&copy).map_err(Error::Validation)?;
                backup.pragma_update(None, "secure_delete", "ON")?;
                if has_document {
                    backup.execute("UPDATE workspace_document SET settings=json_remove(settings,'$.connectionSettings','$.webdavSettings','$.updateSettings','$.lanSettings')",[])?;
                }
                backup.execute_batch("VACUUM")?;
                drop(backup);
                crate::backups::prune(backup_root).map_err(Error::Validation)?;
            }
        }
        crate::backups::protect_existing(backup_root).map_err(Error::Validation)?;
        Self::migrate(&mut connection)?;
        std::fs::write(
            path.with_extension("app-version"),
            env!("CARGO_PKG_VERSION"),
        )?;
        Ok(Self {
            connection,
            backup_root: backup_root.to_path_buf(),
            backup_error: None,
            last_backup: None,
        })
    }

    pub fn backup_now(&mut self, reason: &str) -> Result<PathBuf> {
        let document = self.load_workspace()?;
        let path = crate::backups::write_snapshot(&self.backup_root, &document, reason)
            .map_err(Error::Validation)?;
        self.last_backup = Some(std::time::Instant::now());
        self.backup_error = None;
        Ok(path)
    }

    fn migrate(connection: &mut Connection) -> Result<()> {
        // Migrations must never run against a future schema.
        let migrations = [
            (
                1_i64,
                "initial",
                include_str!("../../migrations/0001_initial.sql"),
            ),
            (
                2_i64,
                "workspace",
                include_str!("../../migrations/0002_workspace.sql"),
            ),
            (
                3_i64,
                "workspace_v30",
                include_str!("../../migrations/0003_workspace_v30.sql"),
            ),
        ];
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        transaction.execute_batch(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL
            );",
        )?;
        let version: i64 = transaction.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )?;
        if version > migrations.last().map_or(0, |m| m.0) {
            return Err(Error::Validation("This database was created by a newer Orvim version. Open it with that version to protect your data.".into()));
        }
        for (next, name, sql) in migrations {
            if next > version {
                transaction.execute_batch(sql)?;
                transaction.execute(
                    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?1, ?2, ?3)",
                    rusqlite::params![next, name, crate::domain::now()],
                )?;
            }
        }
        transaction.commit()?;
        Ok(())
    }
}

impl Repository {
    pub fn wipe_personal_data(&mut self) -> Result<()> {
        // Fail before changing records if a managed copy cannot be removed.
        // Otherwise an error after commit could let the open UI save stale data.
        for copy in crate::backups::list(&self.backup_root).map_err(Error::Validation)? {
            std::fs::remove_file(
                crate::backups::selected(&self.backup_root, copy["name"].as_str().unwrap())
                    .map_err(Error::Validation)?,
            )?;
        }
        self.connection.pragma_update(None, "secure_delete", "ON")?;
        let revision: i64 = self.connection.query_row(
            "SELECT revision FROM workspace_document WHERE id=1",
            [],
            |r| r.get(0),
        )?;
        let tx = self
            .connection
            .transaction_with_behavior(TransactionBehavior::Immediate)?;
        for table in [
            "workspace_records",
            "workspace_covers",
            "review_entries",
            "reviews",
            "wins",
            "tasks",
            "projects",
            "inbox_items",
            "daily_checkins",
            "areas",
        ] {
            tx.execute(&format!("DELETE FROM {table}"), [])?;
        }
        let settings = serde_json::json!({"version":30,"nextId":1,"archiveCategories":[],"waterTarget":2000,"foodTarget":0,"uiPreferences":{},"activePage":"home"});
        tx.execute(
            "UPDATE workspace_document SET settings=?1,revision=?2 WHERE id=1",
            rusqlite::params![settings.to_string(), revision + 1],
        )?;
        tx.commit()?;
        // The commit above is the point of no return. Maintenance failure must
        // not report an aborted wipe and revive the old frontend snapshot.
        let cleanup = self
            .connection
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;")
            .err();
        self.last_backup = Some(std::time::Instant::now());
        self.backup_error = cleanup
            .map(|error| format!("Записи удалены; очистка свободного места не завершена: {error}"));
        Ok(())
    }
}
