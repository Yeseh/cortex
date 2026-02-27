# Brainstorm: SQLite as Derived Index Layer

**Date:** 2026-02-13
**Participants:** Jesse Wellenberg, Claude (Opus 4.6)
**Status:** Design complete — ready for OpenSpec change proposal

---

## Executive Summary

Explored whether Cortex should adopt SQLite as a storage backend to enable semantic search and richer queryability. Through discussion, reframed the goal: Cortex is a **local-first collaborative knowledge system** optimized for filesystem storage, not an enterprise vector database. The selected approach is **SQLite as a derived, rebuildable index layer** on top of the existing filesystem storage — replacing YAML `index.yaml` files entirely with a single SQLite database per store.

---

## Problem Statement

The current filesystem-based index system (per-category `index.yaml` files) has limitations:

1. **Cross-category queries are expensive** — finding memories by tag or recency requires walking every category's index
2. **No full-text content search** — deferred in the dashboard brainstorm due to performance concerns
3. **No metadata combination filters** — e.g., "memories tagged `architecture` updated in the last week"
4. **No aggregate queries** — e.g., "total tokens across a category tree"
5. **Index files are a partial reimplementation of what a database provides** — maintaining them is ongoing overhead

---

## Approaches Explored

### 1. Unified SQLite Storage Backend (Rejected)

**Concept:** Replace the filesystem entirely with SQLite — one DB per store containing memories, indexes, categories, and vector embeddings via `sqlite-vec`.

**Why rejected:**

- **Git merge problem** — SQLite files are binary. Two people adding memories on separate branches creates unresolvable conflicts. Git can't merge binary files, and auto-increment row IDs will collide even for non-overlapping changes.
- **Loses filesystem advantages** — Human-readable `.md` files, per-file git diffs, standard tooling (`grep`, `ripgrep`, editors)
- Project stores (`.cortex/memory`) are committed to git for team collaboration — this is a core use case

**Key insight:** The filesystem backend's per-file-per-memory layout is uniquely good for git collaboration. Each memory is a separate file, so git merges cleanly unless two people edit the _same_ memory. This property cannot be replicated with SQLite.

### 2. Separate Vector Store Composed with Filesystem (Rejected)

**Concept:** Keep filesystem storage for memories, add a separate vector store (sqlite-vec or external service) for semantic search. User composes storage backend with vector backend.

**Why rejected:**

- Sync complexity between two storage systems isn't worth it for the current use case
- Cortex's direction is local project memory, not enterprise-grade domain knowledge stores
- Semantic search is not the primary need — structured queryability is

### 3. SQLite as Derived Index / Cache Layer (Selected) ✅

**Concept:** Replace YAML `index.yaml` files with a single SQLite database per store. The database is **derived from the filesystem** — rebuildable via `reindex`, disposable if corrupted.

**Filesystem layout:**

```
.cortex/memory/
├── cortex.db              ← replaces all index.yaml files
├── decisions/
│   ├── registry-abstraction.md
│   └── scoped-storage-adapter.md
├── standards/
│   └── architecture/
│       └── ports-adapters.md
```

**What the DB stores:**

- All metadata from frontmatter (tags, created_at, updated_at, expires_at, source)
- Category hierarchy (parent/child relationships, descriptions)
- Token estimates
- FTS5 full-text content search: **out of scope** — deferred to follow-up

**What stays on the filesystem:**

- Memory files (markdown with frontmatter) — the **source of truth**
- Category directories — the organizational structure

**Write path:** Write the `.md` file first, then update the SQLite index via structured `updateEntry` call

**Rebuild:** `reindex` scans all `.md` files and rebuilds the DB from scratch. DB is `.gitignore`-able or committable — doesn't matter because it's derivable.

### 4. Richer Single YAML Index (Considered, not selected)

**Concept:** Replace per-category `index.yaml` files with a single store-level YAML index containing all metadata.

**Why not selected:**

- Single file becomes a git conflict hotspot (every memory write touches it)
- Performance degrades as store grows — loading and parsing a large YAML file on every operation
- Essentially reimplements a database in YAML

### 5. No Index / Scan on Query (Considered, not selected)

**Concept:** Remove indexes entirely, scan the filesystem and parse frontmatter on every query.

**Why not selected:**

- Slow for any non-trivial store size
- No full-text search
- Re-parses frontmatter on every query

---

## Decisions Made

### Product Direction

| Aspect                            | Decision                                    | Rationale                                         |
| --------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| **Product direction**             | Local-first collaborative knowledge system  | Not targeting enterprise/production agent memory  |
| **Filesystem as source of truth** | Keep `.md` files with YAML frontmatter      | Git-sharable, human-readable, standard tooling    |
| **SQLite role**                   | Derived index layer, not storage backend    | Rebuildable, disposable, no git merge issues      |
| **Semantic search / sqlite-vec**  | Not pursuing for now                        | Structured queryability is the real need          |
| **Vector store separation**       | Not pursuing for now                        | Sync complexity not justified                     |
| **Agent content search**          | Encourage `grep`/`ripgrep` for local agents | Filesystem format enables standard tools directly |

### Interface & Architecture

| Aspect                                  | Decision                                                                                                | Rationale                                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **`IndexStorage` contract**             | Returns structured `CategoryIndex`, not raw strings                                                     | YAML parsing is a storage concern, not a domain concern                                                   |
| **Merge category index methods**        | `readCategoryIndex`/`writeCategoryIndex` move from `CategoryStorage` to `IndexStorage`                  | Index data management belongs in `IndexStorage`                                                           |
| **`CategoryStorage` renames**           | `categoryExists` → `exists`, `ensureCategoryDirectory` → `ensure`, `deleteCategoryDirectory` → `delete` | Drop filesystem-leaking "directory" naming; composition provides context                                  |
| **`CategoryStorage` remaining methods** | `exists`, `ensure`, `delete`, `updateSubcategoryDescription`, `removeSubcategoryEntry`                  | Conceptual separation: category hierarchy vs index data                                                   |
| **Domain passes structured data**       | `updateEntry(slugPath, IndexMemoryEntry)` replaces `updateAfterMemoryWrite(slugPath, rawContent)`       | Domain validates and constructs structured metadata; storage never parses memory files for indexing       |
| **Surgical deletes**                    | New `removeEntry(slugPath)` method on `IndexStorage`                                                    | Eliminates full `reindex()` on every delete/move                                                          |
| **`query()` on `IndexStorage`**         | Tags match `any`, category scoping is recursive                                                         | `query()` is the storage port; domain operation wraps it with business logic (expiration filtering, etc.) |

### Data Model

| Aspect                          | Decision                                                    | Rationale                                                    |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------ |
| **Enriched `IndexMemoryEntry`** | Add `tags`, `createdAt`, `updatedAt`, `source`, `expiresAt` | Enables filtering/sorting at the storage layer               |
| **Citations in index**          | No — leave out for now                                      | Rarely queried; detail concern for individual memory reads   |
| **Tags storage**                | JSON column on memories table, not a separate table         | Simpler schema; `json_each()` is sufficient at Cortex scale  |
| **Date format**                 | Unix epoch milliseconds (INTEGER)                           | Faster range queries; ms matches JavaScript `Date` precision |
| **Category column**             | Explicitly stored full parent path                          | Avoids string manipulation in queries; enables `LIKE 'x/%'`  |
| **Root-level memories**         | Empty string `""` for category, not NULL                    | Consistent, avoidable NULL handling                          |

### Schema

```sql
CREATE TABLE memories (
    path           TEXT PRIMARY KEY,
    category       TEXT NOT NULL,
    tags           TEXT NOT NULL DEFAULT '[]',
    token_estimate INTEGER NOT NULL DEFAULT 0,
    source         TEXT NOT NULL DEFAULT 'unknown',
    created_at     INTEGER NOT NULL,
    updated_at     INTEGER NOT NULL,
    expires_at     INTEGER,
    summary        TEXT
);

CREATE TABLE categories (
    path        TEXT PRIMARY KEY,
    parent_path TEXT,
    description TEXT
);

CREATE INDEX idx_memories_category ON memories(category);
CREATE INDEX idx_memories_updated_at ON memories(updated_at);
CREATE INDEX idx_memories_expires_at ON memories(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_categories_parent ON categories(parent_path);
```

### MCP Tools

| Aspect                           | Decision                                                                                    | Rationale                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **New `cortex_query_memories`**  | New MCP tool exposing `MemoryFilter` (tags, category, date range, source, sort, pagination) | Primary consumer of `IndexStorage.query()`; enables targeted retrieval for agents  |
| **`cortex_get_recent_memories`** | Keep as convenience tool, reimplement using `query()` internally                            | Simple interface for "give me latest N"; delegates to `query(sortBy: 'updatedAt')` |
| **`cortex_list_memories`**       | Keep for hierarchical browsing                                                              | Still valuable for orientation and category discovery                              |

### Operational Behavior

| Aspect                    | Decision                                             | Rationale                                                                  |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| **Concurrency**           | WAL mode enabled                                     | Multiple readers + writers without blocking; standard SQLite best practice |
| **Missing DB**            | Auto-rebuild with log/warning on first access        | Good first-use experience; user sees "index not found, rebuilding..."      |
| **Stale DB detection**    | Trust the write path; `reindex` is the escape hatch  | Simple; all Cortex writes update the DB; direct file edits are edge case   |
| **Direct agent edits**    | Prevent via agent instructions + file access scoping | Block agents from editing `.cortex/memory/` files directly                 |
| **FTS5**                  | Out of scope — deferred to follow-up                 | Not needed for structured metadata queries; adds schema complexity         |
| **`@yeseh/cortex-stats`** | Separate DB file                                     | Feature not yet implemented; keep concerns isolated                        |

### Package & Migration

| Aspect                       | Decision                        | Rationale                                     |
| ---------------------------- | ------------------------------- | --------------------------------------------- |
| **Package structure**        | Extend `storage-fs`, no rename  | SQLite file is still local filesystem storage |
| **YAML indexes**             | Drop entirely — SQLite only     | No configuration, no two codepaths            |
| **Old `index.yaml` cleanup** | Manual, not system-managed      | System ignores them; they're inert            |
| **`bun:sqlite` dependency**  | Built into Bun, no external dep | Zero dependency cost                          |

---

## Resulting Interface Design

### `IndexStorage` (final)

```typescript
interface IndexStorage {
    /** Rebuild the entire index from filesystem state */
    reindex(): Promise<Result<ReindexResult, StorageAdapterError>>;

    /** Update or insert a single memory entry in the index */
    updateEntry(
        slugPath: string,
        entry: IndexMemoryEntry
    ): Promise<Result<void, StorageAdapterError>>;

    /** Remove a single memory entry from the index */
    removeEntry(slugPath: string): Promise<Result<void, StorageAdapterError>>;

    /** Query memories by filter criteria */
    query(filter: MemoryFilter): Promise<Result<IndexMemoryEntry[], StorageAdapterError>>;
}
```

### Enriched `IndexMemoryEntry`

```typescript
interface IndexMemoryEntry {
    path: string;
    tokenEstimate: number;
    tags: string[];
    createdAt: Date;
    updatedAt: Date;
    source: string;
    expiresAt?: Date;
    summary?: string;
}
```

### `MemoryFilter`

```typescript
type MemoryFilter = {
    category?: string; // recursive scope
    tags?: string[]; // match ANY of these
    updatedAfter?: Date;
    updatedBefore?: Date;
    source?: string;
    sortBy?: 'updatedAt' | 'createdAt' | 'tokenEstimate';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
};
```

### `CategoryStorage` (after refactor)

```typescript
interface CategoryStorage {
    exists(path: string): Promise<Result<boolean, CategoryError>>;
    ensure(path: string): Promise<Result<void, CategoryError>>;
    delete(path: string): Promise<Result<void, CategoryError>>;
    updateSubcategoryDescription(
        parentPath: string,
        subcategoryPath: string,
        description: string | null
    ): Promise<Result<void, CategoryError>>;
    removeSubcategoryEntry(
        parentPath: string,
        subcategoryPath: string
    ): Promise<Result<void, CategoryError>>;
}
```

### Data Flow

```
MCP tool / CLI command
  → core domain operation (e.g., queryMemories, createMemory)
    → validates input, constructs structured data
    → storage.indexes.query(filter)     // reads from SQLite
    → storage.indexes.updateEntry(...)  // writes to SQLite
    → storage.memories.write(...)       // writes .md file
```

---

## Prerequisite Refactor

Before implementing the SQLite index, a prerequisite refactor is needed (can be done independently):

1. **Move index parsing into storage adapters** — `IndexStorage` returns `CategoryIndex`, not strings
2. **Merge category index methods into `IndexStorage`** — eliminate overlap
3. **Rename `CategoryStorage` methods** — drop "directory" naming
4. **Move `parseIndex`/`serializeIndex` into `storage-fs`** — no longer core concerns

Tracked in: `cortex:todo/refactor-index-storage-structured`

---

## Key Insights

1. **SQLite + git don't mix** — Binary files create unresolvable merge conflicts even for non-overlapping changes. This rules out SQLite as the primary storage for project stores shared over git.

2. **Semantic search isn't the killer feature** — What's actually needed is structured metadata queries, cross-category filtering, and better performance. These don't require vector embeddings.

3. **Cortex ≠ enterprise memory** — Production agents with remote databases need a fundamentally different architecture. Cortex should optimize for the local developer workflow: filesystem, git, standard tools.

4. **The `reindex` concept already exists** — The current `reindex` command rebuilds YAML indexes from filesystem state. Replacing YAML indexes with SQLite is a natural evolution of this pattern, not a new concept.

5. **Local agents can use the filesystem directly** — For content search, agents with filesystem access can use `grep`/`ripgrep` on the `.md` files. The tool-only API matters more for remote/production setups.

6. **Domain operations should speak in structured data** — The storage layer should never need to parse memory file formats to maintain its index. Domain validates and constructs structured metadata, storage persists it.

7. **Interface naming should not leak implementation** — "directory" in `CategoryStorage` method names assumes filesystem backend. Clean names (`exists`, `ensure`, `delete`) are backend-agnostic.

---

## Resolved Questions

All open questions from the initial brainstorm have been resolved:

### Schema & Features (Session 2)

1. **SQLite schema design** → Two tables: `memories` (with JSON tags column) + `categories`. Dates as epoch ms, explicit category column with full parent path. See Schema section above.
2. **FTS5** → Out of scope. Deferred to follow-up. Structured metadata queries are the current need.
3. **DB file location** → `cortex.db` in store root (confirmed by filesystem layout decision).

### Operations (Session 2)

4. **Concurrency** → WAL mode enabled.
5. **Missing DB** → Auto-rebuild with log/warning on first access.
6. **Stale DB detection** → Trust the write path. `reindex` is the escape hatch. Prevent agents from editing `.md` files directly via instructions + file access scoping.

### Interface Evolution (Session 2)

7. **`getIndex`/`putIndex`** → Removed from public interface. `query()`, `updateEntry()`, `removeEntry()` cover all use cases. `reindex` handles bulk rebuild internally.
8. **`@yeseh/cortex-stats`** → Separate DB file. Feature not yet implemented; keep concerns isolated.

---

## Next Steps

1. **Execute prerequisite refactor** — `IndexStorage` structured data, merge category index methods, rename methods (tracked in `cortex:todo/refactor-index-storage-structured`)
2. **Create formal OpenSpec change proposal** — Design is settled; translate into spec deltas
3. **Implement SQLite index layer** — Schema, WAL mode, auto-rebuild, query support
4. **Update memory skill instructions** — See "Memory Skill Updates" below

---

## Memory Skill Updates

After the SQLite index and `cortex_query_memories` tool are implemented, the memory skill needs these updates:

### `references/tools.md`

- Add `cortex_query_memories` tool documentation with all filter parameters (tags, category, date range, source, sort, pagination)
- Update `cortex_get_recent_memories` description to note it uses query internally

### `references/loading.md`

- Keep progressive discovery (list → drill → load) as the **default approach** for orientation
- Add "targeted retrieval" guidance: when an agent knows what it's looking for (specific tags, date ranges), use `cortex_query_memories` instead of walking the tree
- Decision guide: browse for orientation, query for specific retrieval

### `references/practices.md`

- Strengthen "use tags consistently" guidance — tags are now directly queryable via `cortex_query_memories`
- Add guidance on when to use query vs. browse

---

## Session Notes

### Session 1 (2026-02-13)

- Jesse's original intent was a full SQLite storage backend with sqlite-vec for semantic search
- The git merge problem was the pivotal discovery that redirected the approach
- Jesse explicitly positioned Cortex as local-first, not enterprise — production agents would need a different system
- Agents should be encouraged to use filesystem tools (grep/ripgrep) for content search rather than being restricted to MCP tools only
- Format changes to indexes and memories are acceptable if needed
- Jesse confirmed YAML parsing belongs in storage, not core — "this should already have been done"
- Jesse wants the CategoryStorage/IndexStorage blur resolved cleanly — index data in IndexStorage, hierarchy management in CategoryStorage
- "Directory" in method names leaks filesystem implementation — should be renamed

### Session 2 (2026-02-13)

- Resolved all remaining open design questions (schema, operations, interface evolution)
- JSON column for tags preferred over separate table — simplicity wins at Cortex's scale
- Dates stored as Unix epoch milliseconds for query performance
- Category column explicitly stored as full parent path for efficient recursive queries
- WAL mode for concurrency — no reason not to
- Auto-rebuild with log/warning on missing DB — good first-use experience
- Stale detection rejected in favor of trusting the write path — fits "simple before smart" preference
- Agent direct file edits identified as the main staleness risk — mitigated via instructions + file access scoping, not detection
- `getIndex`/`putIndex` removed from public interface — `query()`, `updateEntry()`, `removeEntry()` cover all use cases
- `@yeseh/cortex-stats` gets a separate DB — keep concerns isolated
- FTS5 explicitly deferred — not needed for the structured metadata query use case

### Session 3 (2026-02-13)

- Researched impact of SQLite index on memory skill instructions
- Identified three areas needing updates: tools.md (new tool docs), loading.md (targeted retrieval workflow), practices.md (tags now queryable)
- New MCP tool `cortex_query_memories` exposes the full `MemoryFilter` to agents
- `cortex_get_recent_memories` stays as a convenience tool but reimplemented on top of `query()` internally
- `cortex_list_memories` unchanged — still needed for hierarchical browsing and category discovery
- Memory skill's anti-filesystem instructions remain correct and unchanged
- FTS5 explicitly out of scope for this phase — can be revisited later for agents without filesystem access
