## Context

Agents using Cortex need to bootstrap context at session start by retrieving the most recently updated memories. The current API requires listing memories (metadata-only, alphabetically sorted) and then reading each one individually — an N+1 problem with no recency information available.

This change touches core types, serialization, index operations, memory operations, and the MCP server — a cross-cutting change spanning 4 packages.

**Reference**: [GitHub Issue #18](https://github.com/Yeseh/cortex/issues/18), [GitHub Blog: Agentic Memory](https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/)

## Goals / Non-Goals

**Goals:**

- Enable recency-based memory retrieval with full content in a single call
- Store `updatedAt` in category indexes to avoid reading every memory file for sorting
- Expose `updatedAt` in existing `list_memories` for API consistency
- Keep the implementation simple (walk-all, sort, slice)

**Non-Goals:**

- Token budget parameter (`max_tokens`) — callers can use `token_estimate` in the response
- CLI command (`cortex recent`) — MCP-only for now
- Early-termination optimization — simple approach is fine at current scale
- Adding `created_at` to indexes — not needed for this use case

## Decisions

### 1. Recency = `updatedAt`

Sort by `updated_at` descending. Creation also sets `updated_at`, so new memories appear as recent. No separate `created_at` in indexes.

### 2. `updatedAt` is optional on `IndexMemoryEntry`

Existing indexes without `updatedAt` remain valid. Stale entries (missing `updatedAt`) sort last. Reindexing populates the field from memory frontmatter.

### 3. Walk-all algorithm (no early termination)

`getRecentMemories()` walks all categories, collects all index entries, filters expired, sorts by `updatedAt` desc, slices to limit, then reads full content for the top N. This is simple and correct. The number of memories in a typical store is small enough that this is fast.

### 4. Full content in response

The primary use case is auto-including context in prompts. Returning content avoids N+1 `get_memory` calls. Only a handful of memories at a time (default limit: 5).

### 5. New dedicated tool, not overloading `list_memories`

Following the "explicit methods over overloading" principle. `list_memories` returns metadata for browsing; `get_recent_memories` returns full content for context injection. Different use cases, different response shapes.

### 6. Store-wide or category-scoped

`category` parameter is optional. When omitted, walks all categories in the store. When provided, scopes to that category and subcategories. Consistent with rest of API.

## Data Flow

```
Agent calls cortex_get_recent_memories(store, category?, limit?, include_expired?)
  → MCP handler validates input, gets ScopedStorageAdapter
    → Core getRecentMemories() walks categories via index storage
      → Collects IndexMemoryEntry[] with updatedAt from each category index
      → Filters expired (using memory storage if needed)
      → Sorts by updatedAt desc (nulls last)
      → Slices to limit
      → Reads full content for each via memory storage
      → Returns GetRecentMemoriesResult
    → MCP handler formats response (snake_case JSON)
  → Returns to agent
```

## Affected Files

| Package      | File                       | Change                                                                                                                           |
| ------------ | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `core`       | `src/index/types.ts`       | Add `updatedAt?: Date` to `IndexMemoryEntry`                                                                                     |
| `core`       | `src/serialization.ts`     | Add `updated_at` to Zod schema, handle in parse/serialize                                                                        |
| `core`       | `src/memory/operations.ts` | New `getRecentMemories()`, update `createMemory`/`updateMemory` to write `updatedAt` to index, add `updatedAt` to `ListedMemory` |
| `core`       | `src/index/operations.ts`  | Reindex populates `updatedAt` from frontmatter                                                                                   |
| `server`     | `src/memory/tools.ts`      | New tool registration + handler, update `listMemoriesHandler`                                                                    |
| `storage-fs` | `src/indexes.ts`           | No changes expected (uses core serialization)                                                                                    |

## Risks / Trade-offs

- **Walk-all performance**: At large scale (thousands of memories), walking every category could be slow. Mitigation: acceptable for current use case; future optimization or storage backends can address this.
- **Stale indexes**: Existing indexes lack `updatedAt`. Mitigation: graceful degradation (nulls sort last); reindex fixes it.
- **Index size increase**: Each entry gains one optional timestamp field. Mitigation: negligible overhead.

## Open Questions

None — the brainstorm document resolved all key design questions.
