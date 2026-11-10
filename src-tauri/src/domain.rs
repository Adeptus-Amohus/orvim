use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("Local database error: {0}")]
    Sql(#[from] rusqlite::Error),
    #[error("Could not access local storage: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Validation(String),
    #[error("This item no longer exists. Refresh and try again.")]
    NotFound,
}
pub type Result<T> = std::result::Result<T, Error>;

pub fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
pub fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}
pub fn required(value: &str, label: &str, max: usize) -> Result<String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > max {
        return Err(Error::Validation(format!(
            "{label} must contain 1–{max} characters."
        )));
    }
    Ok(value.to_owned())
}
pub fn optional(value: Option<String>, label: &str, max: usize) -> Result<Option<String>> {
    value
        .filter(|s| !s.trim().is_empty())
        .map(|s| required(&s, label, max))
        .transpose()
}
pub fn date(value: &str) -> Result<NaiveDate> {
    let parsed = NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|_| Error::Validation("Use a valid date in YYYY-MM-DD format.".into()))?;
    if parsed.to_string() != value {
        return Err(Error::Validation("Use a date in YYYY-MM-DD format.".into()));
    }
    Ok(parsed)
}
pub fn optional_date(value: Option<String>) -> Result<Option<String>> {
    value
        .filter(|s| !s.is_empty())
        .map(|s| date(&s).map(|_| s))
        .transpose()
}
pub fn timestamp(value: &str) -> Result<String> {
    DateTime::parse_from_rfc3339(value)
        .map(|d| {
            d.with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Millis, true)
        })
        .map_err(|_| Error::Validation("Use a valid ISO timestamp.".into()))
}
pub fn identifier(value: &str) -> Result<()> {
    uuid::Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| Error::Validation("Invalid item identifier.".into()))
}
pub fn optional_identifier(value: &Option<String>) -> Result<()> {
    if let Some(value) = value {
        identifier(value)?;
    }
    Ok(())
}
pub fn changed(rows: usize) -> Result<()> {
    if rows == 0 {
        Err(Error::NotFound)
    } else {
        Ok(())
    }
}

macro_rules! text_enum {
    ($name:ident { $($variant:ident => $value:literal),+ $(,)? }) => {
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
        pub enum $name { $(#[serde(rename = $value)] $variant),+ }
        impl $name {
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$variant => $value),+ }
            }
        }
        impl rusqlite::types::FromSql for $name {
            fn column_result(value: rusqlite::types::ValueRef<'_>) -> rusqlite::types::FromSqlResult<Self> {
                match value.as_str()? {
                    $($value => Ok(Self::$variant),)+
                    _ => Err(rusqlite::types::FromSqlError::InvalidType),
                }
            }
        }
    }
}
text_enum!(ProjectStatus { Active => "active", Paused => "paused", Completed => "completed", Archived => "archived" });
text_enum!(TaskStatus { Open => "open", Completed => "completed", Cancelled => "cancelled" });
text_enum!(WinSource { Manual => "manual", TaskCompletion => "task_completion", ProjectCompletion => "project_completion", Streak => "streak", AiSuggestion => "ai_suggestion" });

#[derive(Debug, Serialize)]
pub struct Area {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub accent: String,
    pub position: i64,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Serialize)]
pub struct Project {
    pub id: String,
    pub title: String,
    pub description: String,
    pub area_id: Option<String>,
    pub status: ProjectStatus,
    pub next_action: Option<String>,
    pub target_date: Option<String>,
    pub review_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub archived_at: Option<String>,
}
#[derive(Debug, Deserialize)]
pub struct ProjectInput {
    pub id: Option<String>,
    pub title: String,
    pub description: String,
    pub area_id: Option<String>,
    pub status: ProjectStatus,
    pub next_action: Option<String>,
    pub target_date: Option<String>,
    pub review_date: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct InboxItem {
    pub id: String,
    pub content: String,
    pub created_at: String,
    pub processed_at: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub notes: Option<String>,
    pub project_id: Option<String>,
    pub area_id: Option<String>,
    pub status: TaskStatus,
    pub scheduled_date: Option<String>,
    pub due_date: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Deserialize)]
pub struct TaskInput {
    pub id: Option<String>,
    pub title: String,
    pub notes: Option<String>,
    pub project_id: Option<String>,
    pub area_id: Option<String>,
    pub scheduled_date: Option<String>,
    pub due_date: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct Win {
    pub id: String,
    pub title: String,
    pub note: Option<String>,
    pub area_id: Option<String>,
    pub project_id: Option<String>,
    pub task_id: Option<String>,
    pub source: WinSource,
    pub occurred_at: String,
    pub created_at: String,
}
#[derive(Debug, Deserialize)]
pub struct WinInput {
    pub title: String,
    pub note: Option<String>,
    pub area_id: Option<String>,
    pub project_id: Option<String>,
    pub task_id: Option<String>,
    pub occurred_at: String,
}
#[derive(Debug, Serialize)]
pub struct DailyCheckin {
    pub id: String,
    pub date: String,
    pub mood: Option<i32>,
    pub energy: Option<i32>,
    pub stress: Option<i32>,
    pub sleep_minutes: Option<i32>,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Deserialize)]
pub struct CheckinInput {
    pub date: String,
    pub mood: Option<i32>,
    pub energy: Option<i32>,
    pub stress: Option<i32>,
    pub sleep_minutes: Option<i32>,
    pub note: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct Review {
    pub id: String,
    pub r#type: String,
    pub period_start: String,
    pub period_end: String,
    pub status: String,
    pub current_step: i32,
    pub created_at: String,
    pub completed_at: Option<String>,
}
#[derive(Debug, Serialize)]
pub struct ReviewEntry {
    pub id: String,
    pub review_id: String,
    pub section: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}
#[derive(Debug, Deserialize)]
pub struct ReflectionInput {
    pub section: String,
    pub content: String,
}
#[derive(Debug, Deserialize)]
pub struct ReviewInput {
    pub id: String,
    pub current_step: i32,
    pub entries: Vec<ReflectionInput>,
    pub focuses: Vec<String>,
    pub complete: bool,
}
pub const REVIEW_SECTIONS: [&str; 10] = [
    "inbox",
    "mind",
    "body",
    "work",
    "money",
    "relationships",
    "projects",
    "open_loops",
    "wins",
    "next_week",
];
#[derive(Debug, Serialize)]
pub struct Snapshot {
    pub areas: Vec<Area>,
    pub projects: Vec<Project>,
    pub inbox_items: Vec<InboxItem>,
    pub tasks: Vec<Task>,
    pub wins: Vec<Win>,
    pub checkins: Vec<DailyCheckin>,
    pub reviews: Vec<Review>,
    pub review_entries: Vec<ReviewEntry>,
}
