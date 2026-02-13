## 1. SQLite Schema & Infrastructure

- [ ] 1.1 Create SQLite schema (memories table with JSON tags, categories table, indexes)
- [ ] 1.2 Implement DB initialization with WAL mode
- [ ] 1.3 Implement auto-rebuild with log/warning when DB is missing on first access

## 2. IndexStorage Implementation

- [ ] 2.1 Implement `updateEntry(slugPath, entry)` — upsert memory + category rows
- [ ] 2.2 Implement `removeEntry(slugPath)` — delete memory row, clean up orphan categories
- [ ] 2.3 Implement `query(filter)` — build SQL from MemoryFilter, execute, return IndexMemoryEntry[]
- [ ] 2.4 Implement `reindex()` — drop and rebuild all tables from filesystem `.md` files

## 3. Core Domain Updates

- [ ] 3.1 Add `MemoryFilter` type to core
- [ ] 3.2 Add `queryMemories` domain operation wrapping `IndexStorage.query()` with business logic (expiration filtering)
- [ ] 3.3 Reimplement `getRecentMemories` to delegate to `query(sortBy: 'updatedAt', ...)`
- [ ] 3.4 Update `createMemory`, `updateMemory`, `removeMemory`, `moveMemory` to call `updateEntry`/`removeEntry`

## 4. MCP Tool

- [ ] 4.1 Add `cortex_query_memories` MCP tool with MemoryFilter input schema
- [ ] 4.2 Update `cortex_get_recent_memories` handler to use query internally

## 5. Cleanup

- [ ] 5.1 Remove YAML index reading/writing code from storage-fs
- [ ] 5.2 Remove `index.yaml`-related constants and helpers from core
- [ ] 5.3 Add `cortex.db` to `.gitignore` template

## 6. Tests

- [ ] 6.1 Storage-fs: SQLite index CRUD tests
- [ ] 6.2 Storage-fs: query tests (tags, date range, category scoping, sort, pagination)
- [ ] 6.3 Storage-fs: auto-rebuild and WAL mode tests
- [ ] 6.4 Core: queryMemories domain operation tests
- [ ] 6.5 Server: cortex_query_memories MCP tool tests
- [ ] 6.6 Ensure all existing tests pass
