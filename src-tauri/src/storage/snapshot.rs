use super::Repository;
use crate::domain::*;
use rusqlite::{Connection, Row};

fn rows<T>(
    connection: &Connection,
    sql: &str,
    map: impl FnMut(&Row<'_>) -> rusqlite::Result<T>,
) -> Result<Vec<T>> {
    Ok(connection
        .prepare(sql)?
        .query_map([], map)?
        .collect::<rusqlite::Result<Vec<_>>>()?)
}
impl Repository {
    pub fn snapshot(&mut self) -> Result<Snapshot> {
        // One read transaction keeps all lists on the same database snapshot.
        let tx = self.connection.transaction()?;
        let snapshot = Snapshot {
            areas: rows(&tx, "SELECT id,name,icon,accent,position,is_archived,created_at,updated_at FROM areas ORDER BY position,id", |r| Ok(Area {
                id:r.get(0)?, name:r.get(1)?, icon:r.get(2)?, accent:r.get(3)?, position:r.get(4)?,
                is_archived:r.get(5)?, created_at:r.get(6)?, updated_at:r.get(7)?,
            }))?,
            projects: rows(&tx, "SELECT id,title,description,area_id,status,next_action,target_date,review_date,created_at,updated_at,archived_at FROM projects ORDER BY updated_at DESC,id", |r| Ok(Project {
                id:r.get(0)?, title:r.get(1)?, description:r.get(2)?, area_id:r.get(3)?, status:r.get(4)?,
                next_action:r.get(5)?, target_date:r.get(6)?, review_date:r.get(7)?, created_at:r.get(8)?,
                updated_at:r.get(9)?, archived_at:r.get(10)?,
            }))?,
            inbox_items: rows(&tx, "SELECT id,content,created_at,processed_at FROM inbox_items ORDER BY created_at DESC,id", |r| Ok(InboxItem {
                id:r.get(0)?, content:r.get(1)?, created_at:r.get(2)?, processed_at:r.get(3)?,
            }))?,
            tasks: rows(&tx, "SELECT id,title,notes,project_id,area_id,status,scheduled_date,due_date,completed_at,created_at,updated_at FROM tasks ORDER BY created_at,id", |r| Ok(Task {
                id:r.get(0)?, title:r.get(1)?, notes:r.get(2)?, project_id:r.get(3)?, area_id:r.get(4)?, status:r.get(5)?,
                scheduled_date:r.get(6)?, due_date:r.get(7)?, completed_at:r.get(8)?, created_at:r.get(9)?, updated_at:r.get(10)?,
            }))?,
            wins: rows(&tx, "SELECT id,title,note,area_id,project_id,task_id,source,occurred_at,created_at FROM wins ORDER BY occurred_at DESC,created_at DESC,id", |r| Ok(Win {
                id:r.get(0)?, title:r.get(1)?, note:r.get(2)?, area_id:r.get(3)?, project_id:r.get(4)?, task_id:r.get(5)?,
                source:r.get(6)?, occurred_at:r.get(7)?, created_at:r.get(8)?,
            }))?,
            checkins: rows(&tx, "SELECT id,date,mood,energy,stress,sleep_minutes,note,created_at,updated_at FROM daily_checkins ORDER BY date DESC", |r| Ok(DailyCheckin {
                id:r.get(0)?, date:r.get(1)?, mood:r.get(2)?, energy:r.get(3)?, stress:r.get(4)?, sleep_minutes:r.get(5)?,
                note:r.get(6)?, created_at:r.get(7)?, updated_at:r.get(8)?,
            }))?,
            reviews: rows(&tx, "SELECT id,type,period_start,period_end,status,current_step,created_at,completed_at FROM reviews ORDER BY period_start DESC,id", |r| Ok(Review {
                id:r.get(0)?, r#type:r.get(1)?, period_start:r.get(2)?, period_end:r.get(3)?, status:r.get(4)?,
                current_step:r.get(5)?, created_at:r.get(6)?, completed_at:r.get(7)?,
            }))?,
            review_entries: rows(&tx, "SELECT id,review_id,section,content,created_at,updated_at FROM review_entries ORDER BY review_id,section", |r| Ok(ReviewEntry {
                id:r.get(0)?, review_id:r.get(1)?, section:r.get(2)?, content:r.get(3)?, created_at:r.get(4)?, updated_at:r.get(5)?,
            }))?,
        };
        tx.commit()?;
        Ok(snapshot)
    }
}
