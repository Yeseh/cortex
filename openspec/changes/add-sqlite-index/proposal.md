# Change: Replace YAML indexes with SQLite derived index layer

## Why

Per-category YAML `index.yaml` files limit queryability: cross-category tag search, metadata filtering, date range queries, and sorted/paginated results all require walking every category's index. SQLite provides these capabilities natively with zero external dependencies (`bun:sqlite`).

## What Changes

- Replace all per-category `index.yaml` files with a single `cortex.db` SQLite database per store
- SQLite is a **derived index** — the filesystem (`.md` files) remains the source of truth
- `IndexStorage` interface gains `updateEntry()`, `removeEntry()`, and `query()` methods
- `getIndex()`/`putIndex()` removed — replaced by `query()` and entry-level operations
- New `cortex_query_memories` MCP tool exposing `MemoryFilter` (tags, category, date range, source, sort, pagination)
- `cortex_get_recent_memories` reimplemented on top of `query()` internally
- WAL mode for concurrent access, auto-rebuild on missing DB
- **BREAKING** — `index.yaml` files are no longer read or written

**Depends on:** `refactor-index-storage` (prerequisite refactor)

## Impact

- Affected specs: `index`, `storage-filesystem`, `mcp-memory-tools`
- Affected code: `packages/storage-fs/src/index-storage.ts` (major rewrite), `packages/core/src/memory/operations.ts`, `packages/server/src/memory/tools.ts`
- New dependency: `bun:sqlite` (built-in, no external package)
