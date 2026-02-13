# Change: Add `cortex_get_recent_memories` MCP Tool

## Why

Agents need an easy way to retrieve the most recently updated memories to auto-include as context at session start. Currently `list_memories` returns metadata only (no content, no timestamps) sorted alphabetically — there is no way to get "the N most recently touched memories" without reading every memory individually, causing N+1 round-trips.

## What Changes

- **Add `updatedAt` to `IndexMemoryEntry`**: Store `updatedAt` (optional) in category indexes so recency sorting doesn't require reading every memory file
- **Update index serialization**: Handle `updated_at` in YAML index format
- **Update reindex operation**: Populate `updatedAt` from memory frontmatter during reindex
- **Update index writes**: Include `updatedAt` when updating indexes after memory writes
- **New core operation `getRecentMemories()`**: Walk categories, collect index entries, filter expired, sort by `updatedAt` desc, read full content for top N
- **New MCP tool `cortex_get_recent_memories`**: Thin wrapper over core operation with store, category, limit, and include_expired parameters
- **Surface `updated_at` in `list_memories`**: Since `updatedAt` is now in indexes, expose it in the existing `list_memories` response at near-zero cost

## Impact

- Affected specs: `index`, `mcp-memory-tools`
- Affected code:
    - `packages/core/src/index/types.ts` — `IndexMemoryEntry` type
    - `packages/core/src/serialization.ts` — index parse/serialize + Zod schemas
    - `packages/core/src/memory/operations.ts` — new `getRecentMemories()`, update `listMemories` result
    - `packages/core/src/index/operations.ts` — reindex populates `updatedAt`
    - `packages/server/src/memory/tools.ts` — new tool registration + handler, update `listMemoriesHandler`
    - `packages/storage-fs/src/indexes.ts` — index write includes `updatedAt`
