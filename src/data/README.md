# Local data adapter

`repository.ts` is the only frontend boundary to native persistence. It exposes
typed operations over Tauri IPC; React components never execute SQL.

The source of truth is the Rust-owned SQLite database in the application-local
data directory. The application layer loads a read snapshot and refreshes it
after successful mutations. Errors are surfaced to the UI. A regular browser
cannot access the database and never falls back to localStorage or mock data.

Keep future export or integration clients behind these domain/application
boundaries. See [the data model](../../docs/DATA_MODEL.md).
