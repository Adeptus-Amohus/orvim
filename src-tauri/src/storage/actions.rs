use super::Repository;
use crate::domain::*;
use rusqlite::params;

impl Repository {
    pub fn add_inbox(&mut self, content: String) -> Result<String> {
        let content = required(&content, "Capture", 5000)?;
        let key = id();
        self.connection.execute(
            "INSERT INTO inbox_items (id,content,created_at) VALUES (?1,?2,?3)",
            params![key, content, now()],
        )?;
        Ok(key)
    }
    pub fn process_inbox(&mut self, key: String, processed: bool) -> Result<()> {
        identifier(&key)?;
        changed(self.connection.execute(
            "UPDATE inbox_items SET processed_at=CASE WHEN ?2 THEN COALESCE(processed_at,?3) ELSE NULL END WHERE id=?1",
            params![key,processed,now()],
        )?)
    }
    pub fn delete_inbox(&mut self, key: String) -> Result<()> {
        identifier(&key)?;
        changed(
            self.connection
                .execute("DELETE FROM inbox_items WHERE id=?1", [key])?,
        )
    }
    pub fn save_project(&mut self, input: ProjectInput) -> Result<String> {
        optional_identifier(&input.id)?;
        optional_identifier(&input.area_id)?;
        let title = required(&input.title, "Project title", 200)?;
        let description =
            optional(Some(input.description), "Description", 10000)?.unwrap_or_default();
        let next = optional(input.next_action, "Next action", 500)?;
        let target = optional_date(input.target_date)?;
        let review = optional_date(input.review_date)?;
        let stamp = now();
        let archived = (input.status == ProjectStatus::Archived).then(|| stamp.clone());
        if let Some(key) = input.id {
            changed(self.connection.execute(
                "UPDATE projects SET title=?2,description=?3,area_id=?4,status=?5,next_action=?6,target_date=?7,review_date=?8,updated_at=?9,archived_at=CASE WHEN ?5='archived' THEN COALESCE(archived_at,?10) ELSE NULL END WHERE id=?1",
                params![key,title,description,input.area_id,input.status.as_str(),next,target,review,stamp,archived],
            )?)?;
            Ok(key)
        } else {
            let key = id();
            self.connection.execute(
                "INSERT INTO projects (id,title,description,area_id,status,next_action,target_date,review_date,created_at,updated_at,archived_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?9,?10)",
                params![key,title,description,input.area_id,input.status.as_str(),next,target,review,stamp,archived],
            )?;
            Ok(key)
        }
    }
    pub fn set_project_status(&mut self, key: String, status: ProjectStatus) -> Result<()> {
        identifier(&key)?;
        changed(self.connection.execute(
            "UPDATE projects SET status=?2,updated_at=?3,archived_at=CASE WHEN ?2='archived' THEN COALESCE(archived_at,?3) ELSE NULL END WHERE id=?1",
            params![key,status.as_str(),now()],
        )?)
    }
    pub fn save_task(&mut self, input: TaskInput) -> Result<String> {
        optional_identifier(&input.id)?;
        optional_identifier(&input.project_id)?;
        optional_identifier(&input.area_id)?;
        let title = required(&input.title, "Action title", 200)?;
        let notes = optional(input.notes, "Action notes", 10000)?;
        let scheduled = optional_date(input.scheduled_date)?;
        let due = optional_date(input.due_date)?;
        let stamp = now();
        if let Some(key) = input.id {
            changed(self.connection.execute(
                "UPDATE tasks SET title=?2,notes=?3,project_id=?4,area_id=?5,scheduled_date=?6,due_date=?7,updated_at=?8 WHERE id=?1",
                params![key,title,notes,input.project_id,input.area_id,scheduled,due,stamp],
            )?)?;
            Ok(key)
        } else {
            let key = id();
            self.connection.execute(
                "INSERT INTO tasks (id,title,notes,project_id,area_id,status,scheduled_date,due_date,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,'open',?6,?7,?8,?8)",
                params![key,title,notes,input.project_id,input.area_id,scheduled,due,stamp],
            )?;
            Ok(key)
        }
    }
    pub fn set_task_status(&mut self, key: String, status: TaskStatus) -> Result<()> {
        identifier(&key)?;
        changed(self.connection.execute(
            "UPDATE tasks SET status=?2,updated_at=?3,completed_at=CASE WHEN ?2='completed' THEN COALESCE(completed_at,?3) ELSE NULL END WHERE id=?1",
            params![key,status.as_str(),now()],
        )?)
    }
    pub fn add_win(&mut self, input: WinInput) -> Result<String> {
        optional_identifier(&input.area_id)?;
        optional_identifier(&input.project_id)?;
        optional_identifier(&input.task_id)?;
        let title = required(&input.title, "Win title", 200)?;
        let note = optional(input.note, "Win note", 10000)?;
        let occurred = timestamp(&input.occurred_at)?;
        let key = id();
        self.connection.execute(
            "INSERT INTO wins (id,title,note,area_id,project_id,task_id,source,occurred_at,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
            params![key,title,note,input.area_id,input.project_id,input.task_id,WinSource::Manual.as_str(),occurred,now()],
        )?;
        Ok(key)
    }
    pub fn delete_win(&mut self, key: String) -> Result<()> {
        identifier(&key)?;
        changed(
            self.connection
                .execute("DELETE FROM wins WHERE id=?1", [key])?,
        )
    }
}
