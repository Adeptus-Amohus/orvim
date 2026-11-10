use super::Repository;
use crate::domain::*;
use chrono::{Datelike, Duration, Weekday};
use rusqlite::{params, OptionalExtension};
use std::collections::HashSet;

impl Repository {
    pub fn save_checkin(&mut self, input: CheckinInput) -> Result<()> {
        date(&input.date)?;
        for (name, value) in [
            ("Mood", input.mood),
            ("Energy", input.energy),
            ("Stress", input.stress),
        ] {
            if value.is_some_and(|v| !(1..=10).contains(&v)) {
                return Err(Error::Validation(format!(
                    "{name} must be between 1 and 10."
                )));
            }
        }
        if input
            .sleep_minutes
            .is_some_and(|v| !(0..=1440).contains(&v))
        {
            return Err(Error::Validation(
                "Sleep must be between 0 and 24 hours.".into(),
            ));
        }
        let note = optional(input.note, "Check-in note", 5000)?;
        if input.mood.is_none()
            && input.energy.is_none()
            && input.stress.is_none()
            && input.sleep_minutes.is_none()
            && note.is_none()
        {
            return Err(Error::Validation(
                "Add at least one value or a note to save a check-in.".into(),
            ));
        }
        let stamp = now();
        self.connection.execute(
            "INSERT INTO daily_checkins (id,date,mood,energy,stress,sleep_minutes,note,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8)
             ON CONFLICT(date) DO UPDATE SET mood=excluded.mood,energy=excluded.energy,stress=excluded.stress,sleep_minutes=excluded.sleep_minutes,note=excluded.note,updated_at=excluded.updated_at",
            params![id(),input.date,input.mood,input.energy,input.stress,input.sleep_minutes,note,stamp],
        )?;
        Ok(())
    }
    pub fn start_review(&mut self, period_start: String) -> Result<String> {
        let start = date(&period_start)?;
        if start.weekday() != Weekday::Mon {
            return Err(Error::Validation(
                "A weekly review starts on Monday.".into(),
            ));
        }
        let end = start
            .checked_add_signed(Duration::days(6))
            .ok_or_else(|| Error::Validation("Review date is out of range.".into()))?;
        let tx = self.connection.transaction()?;
        let existing: Option<String> = tx.query_row(
            "SELECT id FROM reviews WHERE status='in_progress' OR period_start=?1 ORDER BY CASE WHEN status='in_progress' THEN 0 ELSE 1 END LIMIT 1",
            [&period_start], |r| r.get(0),
        ).optional()?;
        let key = if let Some(existing) = existing {
            existing
        } else {
            let key = id();
            tx.execute(
                "INSERT INTO reviews (id,type,period_start,period_end,status,current_step,created_at) VALUES (?1,'weekly',?2,?3,'in_progress',0,?4)",
                params![key,period_start,end.to_string(),now()],
            )?;
            key
        };
        tx.commit()?;
        Ok(key)
    }
    pub fn save_review(&mut self, input: ReviewInput) -> Result<()> {
        identifier(&input.id)?;
        if !(0..=9).contains(&input.current_step) || (input.complete && input.current_step != 9) {
            return Err(Error::Validation(
                "Complete a review from its final step.".into(),
            ));
        }
        if input.focuses.len() > 3 {
            return Err(Error::Validation(
                "Choose at most three focuses for next week.".into(),
            ));
        }
        let mut sections = HashSet::new();
        let mut entries = Vec::new();
        for entry in input.entries {
            if !REVIEW_SECTIONS.contains(&entry.section.as_str())
                || !sections.insert(entry.section.clone())
            {
                return Err(Error::Validation(
                    "Invalid or repeated review section.".into(),
                ));
            }
            let content = optional(Some(entry.content), "Reflection", 10000)?.unwrap_or_default();
            entries.push((entry.section, content));
        }
        if sections.len() != REVIEW_SECTIONS.len() {
            return Err(Error::Validation(
                "All review sections must be included when saving.".into(),
            ));
        }
        let focus_count = input.focuses.len();
        for (index, focus) in input.focuses.into_iter().enumerate() {
            let content = required(&focus, "Focus", 200)?;
            entries.push((format!("focus_{}", index + 1), content));
        }
        let stamp = now();
        let tx = self.connection.transaction()?;
        let status: Option<String> = tx
            .query_row("SELECT status FROM reviews WHERE id=?1", [&input.id], |r| {
                r.get(0)
            })
            .optional()?;
        match status.as_deref() {
            None => return Err(Error::NotFound),
            Some("completed") => {
                return Err(Error::Validation("A completed review is read-only.".into()))
            }
            _ => {}
        }
        for index in (focus_count + 1)..=3 {
            tx.execute(
                "DELETE FROM review_entries WHERE review_id=?1 AND section=?2",
                params![input.id, format!("focus_{index}")],
            )?;
        }
        for (section, content) in entries {
            tx.execute(
                "INSERT INTO review_entries (id,review_id,section,content,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?5)
                 ON CONFLICT(review_id,section) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at",
                params![id(),input.id,section,content,stamp],
            )?;
        }
        tx.execute(
            "UPDATE reviews SET current_step=?2,status=?3,completed_at=?4 WHERE id=?1",
            params![
                input.id,
                input.current_step,
                if input.complete {
                    "completed"
                } else {
                    "in_progress"
                },
                input.complete.then_some(stamp)
            ],
        )?;
        tx.commit()?;
        Ok(())
    }
}
