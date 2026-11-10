CREATE TABLE areas (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
  icon TEXT NOT NULL,
  accent TEXT NOT NULL,
  position INTEGER NOT NULL,
  is_archived INTEGER NOT NULL DEFAULT 0 CHECK(is_archived IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE projects (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'completed', 'archived')),
  next_action TEXT,
  target_date TEXT,
  review_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  CHECK((status = 'archived') = (archived_at IS NOT NULL))
);
CREATE TABLE inbox_items (
  id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL CHECK(length(trim(content)) BETWEEN 1 AND 5000),
  created_at TEXT NOT NULL,
  processed_at TEXT
);
CREATE TABLE tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  notes TEXT,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK(status IN ('open', 'completed', 'cancelled')),
  scheduled_date TEXT,
  due_date TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE TABLE wins (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL CHECK(length(trim(title)) BETWEEN 1 AND 200),
  note TEXT,
  area_id TEXT REFERENCES areas(id) ON DELETE SET NULL,
  project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK(source IN ('manual', 'task_completion', 'project_completion', 'streak', 'ai_suggestion')),
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE daily_checkins (
  id TEXT PRIMARY KEY NOT NULL,
  date TEXT NOT NULL UNIQUE,
  mood INTEGER CHECK(mood BETWEEN 1 AND 10),
  energy INTEGER CHECK(energy BETWEEN 1 AND 10),
  stress INTEGER CHECK(stress BETWEEN 1 AND 10),
  sleep_minutes INTEGER CHECK(sleep_minutes BETWEEN 0 AND 1440),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE reviews (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL CHECK(type = 'weekly'),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL CHECK(period_end >= period_start),
  status TEXT NOT NULL CHECK(status IN ('in_progress', 'completed')),
  current_step INTEGER NOT NULL DEFAULT 0 CHECK(current_step BETWEEN 0 AND 9),
  created_at TEXT NOT NULL,
  completed_at TEXT,
  UNIQUE(type, period_start),
  CHECK((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE UNIQUE INDEX one_unfinished_weekly_review ON reviews(type) WHERE status = 'in_progress';
CREATE TABLE review_entries (
  id TEXT PRIMARY KEY NOT NULL,
  review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  section TEXT NOT NULL CHECK(section IN ('inbox', 'mind', 'body', 'work', 'money', 'relationships', 'projects', 'open_loops', 'wins', 'next_week', 'focus_1', 'focus_2', 'focus_3')),
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(review_id, section)
);
CREATE INDEX projects_status_area ON projects(status, area_id);
CREATE INDEX inbox_unprocessed ON inbox_items(processed_at, created_at DESC);
CREATE INDEX tasks_status_schedule ON tasks(status, scheduled_date, due_date);
CREATE INDEX tasks_project ON tasks(project_id);
CREATE INDEX wins_occurred ON wins(occurred_at DESC);
CREATE INDEX wins_area ON wins(area_id, occurred_at DESC);
CREATE INDEX reviews_period ON reviews(period_start DESC);

-- Stable UUIDs for the built-in areas. Seeding runs only with migration 1.
INSERT INTO areas (id, name, icon, accent, position, created_at, updated_at) VALUES
('87156b3e-c58a-4bd2-bc0a-4d681fb63a01', 'Mind', 'brain', 'violet', 0, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('87156b3e-c58a-4bd2-bc0a-4d681fb63a02', 'Body', 'heart', 'rose', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('87156b3e-c58a-4bd2-bc0a-4d681fb63a03', 'Money', 'wallet', 'amber', 2, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('87156b3e-c58a-4bd2-bc0a-4d681fb63a04', 'Relationships', 'users', 'pink', 3, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('87156b3e-c58a-4bd2-bc0a-4d681fb63a05', 'Work', 'briefcase', 'blue', 4, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('87156b3e-c58a-4bd2-bc0a-4d681fb63a06', 'Growth', 'sprout', 'green', 5, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('87156b3e-c58a-4bd2-bc0a-4d681fb63a07', 'Environment', 'house', 'teal', 6, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('87156b3e-c58a-4bd2-bc0a-4d681fb63a08', 'Meaning', 'compass', 'indigo', 7, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')),
('87156b3e-c58a-4bd2-bc0a-4d681fb63a09', 'Administration', 'folder', 'slate', 8, strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now'));
