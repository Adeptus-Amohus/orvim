# Future AI and integration approach

> Historical plan written before integrations existed. Optional AI and external connections are now implemented. See [ARCHITECTURE.md](ARCHITECTURE.md), [PRIVACY.md](PRIVACY.md) and [OPENAI_CONNECTION.md](OPENAI_CONNECTION.md) for the current behavior.

This document describes a possible future boundary. No AI provider, SDK,
authentication, cloud call, export feature, or MCP server is implemented.

## Source of truth

**Database = source of truth.** SQLite contains the canonical domain entities,
relationships, identities, and migrations. An interpretation or exported file
must not silently become a competing database.

**Markdown/JSON = portable representation.** Future exporters should read domain
data through the application/repository boundary, preserving UUIDs, dates, and
relationships. Exports are snapshots or interchange formats. A future importer
must validate and explicitly apply changes through domain operations.

**AI = optional interpreter.** A future provider could help interpret information
the user explicitly chooses to share. The normal application must remain useful
without it. Provider-specific credentials, network calls, prompts, and responses
belong in separate adapters, not React screens, schema migrations, or normal
repository methods. Suggestions must not silently change canonical data.

**MCP = potential integration layer.** A future MCP server could expose narrow
read queries and authorized domain operations. It should reuse the application
boundary and validation instead of accepting arbitrary SQL or bypassing invariants.

## Existing seams

- `src/domain/` and Rust `domain.rs`: data contracts and invariants.
- `src/data/repository.ts`: typed frontend operations over local Tauri IPC.
- `src-tauri/src/storage/`: authoritative local queries, writes, and migrations.
- `src/application/`: loading, user actions, and review-save sequencing.

New integration clients can use these boundaries without coupling presentation
to a provider. There are no speculative provider interfaces or fake AI controls.

The `ai_suggestion` Win source is reserved because it is part of the requested
domain model. It is not emitted by this MVP and adds no AI-dependent behavior.
