# Brainstorm: UI Dashboard for Memory System

**Date:** 2026-02-05  
**Participants:** Jesse Wellenberg, Claude (Opus 4.5)  
**Status:** Initial brainstorm complete, API design needs refinement

---

## Executive Summary

Create a UI dashboard for viewing, editing, and maintaining the Cortex memory system, with access statistics to identify usage patterns and hotspots. The dashboard runs as a separate process using shared core libraries, with a pub-sub event system enabling cross-process access tracking stored in SQLite.

---

## Decisions Made

| Aspect                    | Decision                                                 | Rationale                                     |
| ------------------------- | -------------------------------------------------------- | --------------------------------------------- |
| **Target users**          | Developers primarily, potential for end users            | Broader applicability of the pattern          |
| **Deployment**            | Separate process from MCP server                         | Clean separation of concerns                  |
| **Architecture**          | Shared `@yeseh/cortex-core` + `@yeseh/cortex-storage-fs` | Works offline, direct filesystem access       |
| **Frontend**              | Vanilla JS                                               | Minimal dependencies, works offline           |
| **Security**              | Not a concern for v1                                     | Can be added later                            |
| **Priority order**        | View → Edit → Maintain → Statistics                      | Statistics requires backend work              |
| **Stats storage**         | SQLite at `~/.config/cortex/dashboard.db`                | Cross-store (registry-level), queryable       |
| **Stats scope**           | Registry-level (cross-store)                             | Need to see patterns across all stores        |
| **Event tracking**        | Always-on by default, opt-out available                  | Capture agent access patterns                 |
| **Historical data**       | Not retained                                             | Only current counters matter                  |
| **EventBus location**     | `@yeseh/cortex-core`                                     | Domain concept, no dependencies               |
| **TrackedStorageAdapter** | `@yeseh/cortex-core`                                     | Wraps any adapter, not FS-specific            |
| **Stats package**         | New `@yeseh/cortex-stats` package                        | Isolates SQLite dependency                    |
| **CLI integration**       | `cortex dashboard` command                               | CLI imports and starts dashboard              |
| **Standalone binary**     | Future possibility                                       | `npx @yeseh/cortex-dashboard` noted for later |

---

## Feature Scope

### View (Priority 1)

- **Store overview**: List all stores, memory counts, total size
- **Category browser**: Tree navigation, subcategory descriptions, memory counts
- **Memory viewer**: Content preview, metadata (tags, created/updated, expiration), token estimate
- **Search**: Path and tag search initially; content search as future enhancement (performance concerns)

### Edit (Priority 2)

- **Memory editing**: Full content and metadata editing
- **Bulk operations**: Select multiple memories to delete/move/tag
- **Category management**: Create/delete categories, edit descriptions
- **Store management**: Create new stores from the UI
- **Safeguards**: Confirmation dialogs (TBD: undo, soft-delete)

### Maintain (Priority 3)

- **Prune expired memories**: Leverage existing `cortex_prune_memories`
- **Reindex stores**: Leverage existing `cortex_reindex_store`
- **Health checks**: Index inconsistency, orphaned files, empty categories, corrupted frontmatter, missing stores
- **Export/Import**: Backup stores/categories (format TBD)
- **Cleanup**: Find empty categories, memories with no content

### Statistics (Priority 4, but personally valuable)

- **Access tracking**: Memory reads, category lists (primary); writes/deletes (secondary)
- **Metrics**: Read count + last accessed per path
- **Visualization**: Heatmap of access patterns
- **Use case**: Tune and measure agent access patterns on prompt changes
- **Identify**: Hotspots (frequently accessed) and stale data (never read)

---

## Architecture

### Package Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PACKAGES                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     @yeseh/cortex-core                               │   │
│  │  - EventBus interface + createEventBus()                            │   │
│  │  - AccessEvent type definitions                                      │   │
│  │  - TrackedStorageAdapter decorator (wraps any StorageAdapter)       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                       │
│                    ▼               ▼               ▼                       │
│  ┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐   │
│  │ @yeseh/cortex-stats  │ │ @yeseh/cortex-cli│ │ @yeseh/cortex-server │   │
│  │                      │ │                  │ │                      │   │
│  │ - StatsCollector     │ │ - Uses EventBus  │ │ - Uses EventBus      │   │
│  │   interface          │ │ - dashboard cmd  │ │                      │   │
│  │ - SQLiteCollector    │ └──────────────────┘ └──────────────────────┘   │
│  │   (implementation)   │                                                  │
│  │ - StatsReader        │ ┌──────────────────────────────────────────┐   │
│  │   interface          │ │        @yeseh/cortex-dashboard           │   │
│  │                      │ │                                          │   │
│  │ SQLite is internal   │ │  - HTTP server (Express or native)       │   │
│  │ implementation detail│ │  - Static assets (Vanilla JS)            │   │
│  └──────────────────────┘ │  - Uses StatsReader from stats package   │   │
│                           └──────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Event Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RUNTIME PROCESSES                                  │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │ MCP Server  │    │    CLI      │    │  Dashboard  │                     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
│         │                  │                  │                             │
│         ▼                  ▼                  ▼                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │              TrackedStorageAdapter (decorator)                   │       │
│  │  - Wraps FilesystemStorageAdapter                               │       │
│  │  - Intercepts reads → emits events to EventBus                  │       │
│  └─────────────────────────┬───────────────────────────────────────┘       │
│                            │                                               │
│                            ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                    EventBus (core)                               │       │
│  │  - Simple pub-sub interface                                      │       │
│  │  - No dependencies, just callbacks                               │       │
│  │  - Events: MemoryRead, CategoryList, etc.                        │       │
│  └─────────────────────────┬───────────────────────────────────────┘       │
│                            │                                               │
│                            ▼ (subscriber)                                  │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │              SQLiteStatsCollector (stats package)                │       │
│  │  - Subscribes to EventBus                                        │       │
│  │  - Writes to ~/.config/cortex/dashboard.db                       │       │
│  │  - Owns the SQLite dependency                                    │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Proposals (Draft — Needs Refinement)

### EventBus API (Core)

```typescript
// @yeseh/cortex-core/src/events/types.ts

type AccessEventType =
    | 'memory_read'
    | 'memory_write'
    | 'memory_delete'
    | 'memory_move'
    | 'category_list';

interface AccessEvent {
    timestamp: Date;
    store: string;
    path: string;
    eventType: AccessEventType;
    source?: string; // 'mcp' | 'cli' | 'dashboard'
}

type EventHandler = (event: AccessEvent) => void | Promise<void>;

interface EventBus {
    publish(event: AccessEvent): Promise<void>; // awaits all async handlers
    subscribe(handler: EventHandler): () => void; // returns unsubscribe fn
}

function createEventBus(): EventBus;
```

### Stats Package API (Draft)

```typescript
// @yeseh/cortex-stats/src/types.ts

interface AccessStats {
    store: string;
    path: string;
    readCount: number;
    writeCount: number;
    lastAccessed: Date;
}

interface StatsQuery {
    store?: string; // filter by store, omit for all
    limit?: number; // top N results
    sortBy?: 'readCount' | 'lastAccessed';
    eventTypes?: AccessEventType[];
}

// Write interface - used internally by collector
interface StatsCollector {
    record(event: AccessEvent): Promise<void>;
    close(): Promise<void>;
}

// Read interface - used by dashboard
interface StatsReader {
    getStats(query: StatsQuery): Promise<AccessStats[]>;
    getHotspots(limit: number): Promise<AccessStats[]>; // convenience method
    close(): Promise<void>;
}

// Factory that creates both (single DB connection)
interface StatsStore {
    collector: StatsCollector;
    reader: StatsReader;
    close(): Promise<void>;
}

function createStatsStore(dbPath: string): Promise<StatsStore>;
```

### Convenience Factory (Draft)

```typescript
// One-liner setup for processes that want tracking
const { adapter, stats, cleanup } = await createTrackedEnvironment({
    adapterFactory: () => new FilesystemStorageAdapter(root),
    statsDbPath: '~/.config/cortex/dashboard.db',
    source: 'mcp',
});
```

---

## Open Questions & Issues

### 1. SQLite Path Coupling (Unresolved)

**Problem:** The current API proposal leaks the SQLite database path (`~/.config/cortex/dashboard.db`) to consumers like the MCP server. This creates coupling — consumers shouldn't need to know where stats are stored.

**Potential solutions to explore:**

- Stats package provides a default path internally (convention over configuration)
- Configuration lives in a central location (e.g., cortex config file)
- Stats package reads path from environment variable
- Inversion of control — dashboard provides the collector, others just use it

**Status:** Needs design iteration

### 2. Adapter Construction Convenience

**Problem:** Wiring up EventBus → Collector → TrackedAdapter is boilerplate that every consumer would repeat.

**Potential solutions to explore:**

- Factory function that handles wiring
- Builder pattern
- Configuration-driven setup

**Status:** To be designed later

### 3. Health Check Capabilities

**Question:** Should health checks be read-only diagnostics (report issues) or offer auto-fix capabilities?

**Status:** Not yet decided

### 4. Export/Import Formats

**Question:** What formats for backup/export?

- Single memory: `.md` file (same as stored)
- Category export: Zip of memories + index?
- Store export: Full directory structure as zip?
- Cross-store import capability?

**Status:** Not yet decided

### 5. Search Performance

**Noted concern:** Content search on larger stores could be slow.

**Decision:** Start with path + tag search only; content search as future enhancement.

**Potential future approaches:**

- Client-side search (load all to browser)
- Server-side streaming
- Search index (complexity)

---

## SQLite Schema (Proposed)

```sql
-- Aggregated counters (no historical events)
CREATE TABLE access_stats (
    store TEXT NOT NULL,
    path TEXT NOT NULL,
    read_count INTEGER DEFAULT 0,
    write_count INTEGER DEFAULT 0,
    last_accessed TEXT,  -- ISO 8601
    PRIMARY KEY (store, path)
);

CREATE INDEX idx_stats_read_count ON access_stats(read_count DESC);
CREATE INDEX idx_stats_last_accessed ON access_stats(last_accessed DESC);
```

---

## New Packages Required

| Package                   | Purpose                         | Dependencies                                                            |
| ------------------------- | ------------------------------- | ----------------------------------------------------------------------- |
| `@yeseh/cortex-stats`     | Access tracking, SQLite storage | `better-sqlite3` or `bun:sqlite`, `@yeseh/cortex-core`                  |
| `@yeseh/cortex-dashboard` | HTTP server, static assets      | `@yeseh/cortex-core`, `@yeseh/cortex-storage-fs`, `@yeseh/cortex-stats` |

---

## CLI Changes Required

| Command            | Description                                    |
| ------------------ | ---------------------------------------------- |
| `cortex dashboard` | Start the dashboard HTTP server                |
| `cortex server`    | Start the MCP server (new convenience command) |

---

## Next Steps

1. **Resolve SQLite path coupling** — Design how consumers get stats without knowing storage details
2. **Design adapter construction convenience** — Reduce boilerplate for tracked environments
3. **Create formal spec** — Once API is refined, create OpenSpec change proposal
4. **Implement in phases:**
    - Phase 1: EventBus + TrackedStorageAdapter in core
    - Phase 2: Stats package with SQLite
    - Phase 3: Dashboard package with view functionality
    - Phase 4: Edit and maintain functionality
    - Phase 5: Statistics visualization (heatmap)

---

## Session Notes

- Jesse's primary motivation: Measure and tune agent access patterns on prompt changes
- Offline capability is important (local development use case)
- Follows existing Cortex patterns: ISP, composition, clean naming
- No "Port" suffix on interfaces
- Storage adapters handle persistence only, not coordination
