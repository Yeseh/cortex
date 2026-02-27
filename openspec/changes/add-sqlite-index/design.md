## Context

This change replaces per-category YAML index files with a single SQLite database per store. The brainstorm document at `docs/brainstorms/2026-02-13-sqlite-index-brainstorm.md` contains the full design rationale.

## Goals

- Cross-category metadata queries (tags, date ranges, source filtering)
- Sorted and paginated query results
- Surgical index updates (no full reindex on every write/delete)
- Zero external dependencies (`bun:sqlite` is built-in)

## Non-Goals

- FTS5 full-text content search (deferred to follow-up)
- Semantic search / vector embeddings
- Replacing filesystem as source of truth

## Decisions

### Schema

Two tables: `memories` (with JSON `tags` column, epoch ms dates, explicit `category` column) and `categories` (hierarchy with descriptions). See brainstorm doc for full DDL.

### Operational Behavior

- **WAL mode** enabled for concurrent access
- **Auto-rebuild** with log/warning when DB is missing on first access
- **Trust the write path** for staleness — no detection, `reindex` is the escape hatch
- **Agent direct edits** prevented via instructions and file access scoping

### Interface

`IndexStorage` final interface: `reindex()`, `updateEntry()`, `removeEntry()`, `query(filter)`.
No `getIndex`/`putIndex` — covered by query + entry methods.

### MCP Tools

- New `cortex_query_memories` tool exposing `MemoryFilter`
- `cortex_get_recent_memories` stays as convenience, reimplemented on `query()` internally

## Risks / Trade-offs

- **SQLite + git**: DB is `.gitignore`-able since it's derived. No merge conflict risk.
- **Auto-rebuild latency**: First access after clone triggers rebuild. Acceptable for the use case.
- **YAML index removal**: Breaking change. Old `index.yaml` files become inert — manual cleanup.

## Open Questions

None — all resolved during brainstorm sessions.
