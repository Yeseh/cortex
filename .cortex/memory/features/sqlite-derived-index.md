---
created_at: 2026-02-13T20:26:10.106Z
updated_at: 2026-02-13T21:47:14.829Z
tags:
    - feature
    - sqlite
    - index
    - query
    - design-complete
    - openspec
source: mcp
citations:
    - docs/brainstorms/2026-02-13-sqlite-index-brainstorm.md
---

# Feature: SQLite as Derived Index Layer

**Status:** Design complete — OpenSpec proposals created
**Brainstorm doc:** `docs/brainstorms/2026-02-13-sqlite-index-brainstorm.md`
**OpenSpec proposals:** `refactor-index-storage` (prerequisite), `add-sqlite-index` (main)

## Summary

Replace per-category YAML `index.yaml` files with a single SQLite database per store. The DB is a derived, rebuildable cache — the filesystem (`.md` files) remains the source of truth.

## Key Decisions

- SQLite is an **index layer**, not a storage backend
- No semantic search / sqlite-vec — structured metadata queries are the real need
- Filesystem stays source of truth for git shareability
- DB is rebuildable via `reindex` — disposable if corrupted
- FTS5: **out of scope**, deferred to follow-up
- `bun:sqlite` — built-in, zero external deps
- Package: extend `storage-fs`, not a new package

## Schema

- Two tables: `memories` (JSON tags column, epoch ms dates, explicit category) + `categories`
- WAL mode for concurrent access
- Partial index on `expires_at` for expiration queries

## IndexStorage Interface (final)

Four methods: `reindex()`, `updateEntry()`, `removeEntry()`, `query(filter)`

## MCP Tools

- New `cortex_query_memories` tool exposing `MemoryFilter`
- `cortex_get_recent_memories` stays as convenience, reimplemented on `query()` internally

## Next Steps

1. Execute prerequisite refactor (`refactor-index-storage`)
2. Implement SQLite index layer (`add-sqlite-index`)
