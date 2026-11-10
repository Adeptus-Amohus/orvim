# SQLite migrations

`0001_initial.sql` creates all eight domain tables, relational constraints, query
indexes, and nine default Areas with stable UUIDs.

The migration runner in `src/storage/mod.rs` opens an immediate transaction,
creates/reads `schema_migrations`, applies unapplied SQL, and writes the version,
name, and UTC application timestamp before committing. Any failure rolls back
the entire migration. A schema newer than the application supports is refused.

To evolve the schema, add the next numbered SQL file and register its
`include_str!` in the migration list. Never rewrite a distributed migration.
Validate both new databases and upgrades with the storage tests. Runtime
databases, WAL files, and shared-memory sidecars must never be committed.
