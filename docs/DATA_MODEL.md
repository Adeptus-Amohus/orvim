# Data model

> Historical MVP schema. The current workspace uses SQLite schema 3 and document format 31; see [ARCHITECTURE.md](ARCHITECTURE.md). This file describes retained legacy entities, not the whole current model.

SQLite is authoritative. The first schema is
[`0001_initial.sql`](../src-tauri/migrations/0001_initial.sql).

## Shared conventions

- New entity identifiers are UUID v4 strings generated in Rust. The nine built-in
  Areas use stable, valid UUIDs from the migration.
- Timestamps are RFC 3339 / ISO 8601 text, normalized to UTC with milliseconds
  (for example `2026-09-21T07:00:00.000Z`).
- Calendar dates are ISO `YYYY-MM-DD` strings, separate from timestamps.
- Rust validates dates, identifiers, ranges, statuses, lengths, and required text.
  SQL uses bound parameters. Foreign keys and SQL checks are an additional boundary.
- Required titles are trimmed and limited to 200 characters. Inbox captures are
  limited to 5000; project descriptions, task/Win notes, and review reflections
  to 10000; next-action text to 500; check-in notes to 5000.
- Nullable optional text is normalized to null when blank. Project description
  remains a non-null string, with an empty default.
- Updates preserve identity and creation time. Deletion is explicit.

## Entities

| Table            | Fields                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `areas`          | `id`, `name`, `icon`, `accent`, `position`, `is_archived`, `created_at`, `updated_at`                                                          |
| `projects`       | `id`, `title`, `description`, `area_id?`, `status`, `next_action?`, `target_date?`, `review_date?`, `created_at`, `updated_at`, `archived_at?` |
| `inbox_items`    | `id`, `content`, `created_at`, `processed_at?`                                                                                                 |
| `tasks`          | `id`, `title`, `notes?`, `project_id?`, `area_id?`, `status`, `scheduled_date?`, `due_date?`, `completed_at?`, `created_at`, `updated_at`      |
| `wins`           | `id`, `title`, `note?`, `area_id?`, `project_id?`, `task_id?`, `source`, `occurred_at`, `created_at`                                           |
| `daily_checkins` | `id`, unique `date`, `mood?`, `energy?`, `stress?`, `sleep_minutes?`, `note?`, `created_at`, `updated_at`                                      |
| `reviews`        | `id`, `type`, `period_start`, `period_end`, `status`, `current_step`, `created_at`, `completed_at?`                                            |
| `review_entries` | `id`, `review_id`, `section`, `content`, `created_at`, `updated_at`                                                                            |

`?` marks a nullable field; it is documentation notation, not part of the column
name. Identity, status/type, required content, and creation/update timestamps are
never nullable.

### Areas

Default order: Mind, Body, Money, Relationships, Work, Growth, Environment,
Meaning, Administration. `is_archived` is a 0/1 boolean. `icon` and `accent` are
presentation keys, not URLs or dynamically executed markup.

The current UI lists Areas and their associated counts; it does not edit or score
them. Recent Wins means the current local day plus the preceding 29 local days.

### Projects

Statuses: `active`, `paused`, `completed`, `archived`.
Optional fields: Area, next action, target date, review date, archive timestamp.

An archived project must have `archived_at`; every other status must have null.
Archiving again preserves the original archive time. Restoring clears it.
There is no hard project deletion command. Paused projects populate Someday.

### Inbox items

Unprocessed means `processed_at IS NULL`. Marking processed sets the timestamp;
repeating the action preserves it. Restoring clears it. Deletion permanently
removes the capture after UI confirmation.

### Tasks

Statuses: `open`, `completed`, `cancelled`.
Optional fields: notes, project, Area, scheduled date, due date, completion timestamp.

Only completed tasks have `completed_at`. Reopening/cancelling clears it.
Task completion and Win creation are deliberately separate operations.

### Wins

Sources: `manual`, `task_completion`, `project_completion`, `streak`,
`ai_suggestion`. Only manual creation is implemented. The reserved source values
do not introduce automation or AI logic.

Optional fields: note, Area, project, task. A Win may have no task or project.
The UI's selected calendar date is represented as local noon converted to a UTC
`occurred_at` timestamp. The timeline groups by the viewer's local calendar month.
Records sort by occurrence, then creation time, newest first.

### Daily check-ins

All metrics and the note are optional, but at least one must be supplied to save.
Mood/energy/stress are nullable integers in 1–10; sleep is nullable whole minutes
in 0–1440. A unique index on `date` enforces one record per calendar day.
The upsert updates values and `updated_at`, preserving `id` and `created_at`.

Calendar dates use the device's local date rather than a UTC date slice, preventing
evening/morning timezone shifts. Today is refreshed periodically and on focus.

### Reviews and entries

Type: `weekly`. Statuses: `in_progress`, `completed`.
Periods run Monday through Sunday, inclusive, using local calendar dates.
There is one review per type/period start and at most one unfinished review per
type. Start resumes an unfinished review, otherwise opens or creates the current week.

`current_step` is the one additional domain field needed for exact resume,
with values 0–9. A completed review must have `completed_at`; an unfinished one
must not. Completed reviews reject edits.

Reflection section keys: `inbox`, `mind`, `body`, `work`, `money`,
`relationships`, `projects`, `open_loops`, `wins`, `next_week`.
Focuses use the same entry model with keys `focus_1`, `focus_2`, `focus_3`.
Each focus is plain text (up to 200 characters), not a serialized task or foreign
key. Blank focus slots are omitted. A review/section pair is unique.

All reflections, focuses, current step, and completion state are saved in one
transaction. Upserts preserve entry IDs and creation times; removed focus slots
are deleted. Frontend review writes are queued in order.

## Relationships and indexes

- Projects → Areas; Tasks → Projects/Areas; Wins → Areas/Projects/Tasks.
  Optional foreign keys use `ON DELETE SET NULL`.
- Review entries → Reviews is required and uses `ON DELETE CASCADE`.
- Query indexes cover project status/Area, inbox processing/creation time,
  task status/schedule/due date, task project, Win occurrence/Area, and review period.
- Uniqueness covers daily date, review type/period, unfinished review type,
  and review/section.

## Persistence and migration mechanics

`schema_migrations(version, name, applied_at)` is infrastructure metadata, not a
product entity. An immediate transaction serializes migration application.
Applied migrations and their ledger entries commit together; future schema
versions are refused. No automatic reset or reseeding of existing data occurs.

SQLite opens under Tauri's application-local directory with foreign keys enabled,
WAL journaling, and a five-second busy timeout. A Rust mutex serializes repository
access within this app process; IPC work runs on blocking worker threads.
The UI reads a transactionally consistent snapshot across the tables.

Seven Rust tests cover reopening all data types, seed idempotence, one-per-day
upserts, invalid input/foreign keys, status transitions, review completion,
stable focus identities, migration atomicity, and newer-schema refusal.
