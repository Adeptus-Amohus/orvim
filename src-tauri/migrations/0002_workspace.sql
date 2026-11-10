-- Preserve the original MVP tables. The complete interface has its own
-- versioned document and individually indexed records, committed atomically.
CREATE TABLE workspace_document (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    revision INTEGER NOT NULL CHECK (revision > 0),
    settings TEXT NOT NULL CHECK (json_valid(settings)),
    updated_at TEXT NOT NULL
);
CREATE TABLE workspace_records (
    collection TEXT NOT NULL,
    record_key TEXT NOT NULL,
    position INTEGER NOT NULL,
    payload TEXT NOT NULL CHECK (json_valid(payload)),
    PRIMARY KEY (collection, record_key)
);
CREATE INDEX workspace_records_order ON workspace_records(collection, position);
CREATE TABLE workspace_covers (
    item_id INTEGER PRIMARY KEY CHECK (item_id > 0),
    source TEXT NOT NULL
);
