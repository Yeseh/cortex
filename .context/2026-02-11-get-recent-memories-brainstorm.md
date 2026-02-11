# Brainstorm: `cortex_get_recent_memories` MCP Tool

**Date**: 2026-02-11  
**Issue**: https://github.com/Yeseh/cortex/issues/18  
**Inspiration**: https://github.blog/ai-and-ml/github-copilot/building-an-agentic-memory-system-for-github-copilot/

## Problem

Agents need an easy way to retrieve the most recent memories to auto-include as context at the start of a session. Currently `list_memories` returns metadata only (no content, no timestamps), sorted alphabetically by path. There is no way to get "the N most recently touched memories" without reading every memory individually.

## Decisions

### 1. Recency is based on `updated_at`

- Sort by `updated_at` descending (most recently updated first)
- Creation also sets `updated_at`, so newly created memories naturally appear as "recent"
- `created_at` is not used for sorting

### 2. Flexible scope — store-wide or category-scoped

- `category` parameter is optional
- When omitted: walks all categories in the store, collects all memories, sorts globally by `updated_at`, returns top N
- When provided: scopes to that category (and subcategories)
- Consistent with the rest of the API's flexibility

### 3. New dedicated MCP tool: `cortex_get_recent_memories`

- Follows the "explicit methods over overloading" principle
- Naming follows existing verb-led pattern: `cortex_[verb]_memor(y|ies)`
- MCP-only for now — no CLI command

### 4. Returns full memory content

- Primary use case is auto-including context in prompts
- Returns the raw markdown body (no YAML frontmatter)
- Avoids N+1 `get_memory` calls
- Only a handful of memories at a time (default limit: 5)

### 5. Store `updatedAt` in category indexes

- Add `updatedAt` (optional) to `IndexMemoryEntry`
- Enables sorting by recency without reading every memory file
- Reindexing populates `updatedAt` from memory file frontmatter
- Stale indexes (missing `updatedAt`): treat as null, sort those entries last

### 6. Also surface `updated_at` in `list_memories`

- Since `updatedAt` is being added to the index anyway, expose it in the existing `list_memories` response too
- Near-zero cost, improves API consistency

## Tool Design

### Input Schema

| Parameter         | Type    | Required | Default | Description                           |
| ----------------- | ------- | -------- | ------- | ------------------------------------- |
| `store`           | string  | yes      | —       | Store name                            |
| `category`        | string  | no       | —       | Scope to a category (+ subcategories) |
| `limit`           | number  | no       | 5       | Max number of memories to return      |
| `include_expired` | boolean | no       | false   | Include expired memories              |

### Output Schema

```json
{
    "category": "string (category path or 'all')",
    "count": "number",
    "memories": [
        {
            "path": "string",
            "content": "string (raw markdown body)",
            "updated_at": "string (ISO 8601)",
            "token_estimate": "number",
            "tags": ["string"]
        }
    ]
}
```

### Sorting

- Results sorted by `updated_at` descending (most recent first)
- Memories with null/missing `updated_at` (stale indexes) sort last

## Implementation Scope

### Index changes (`IndexMemoryEntry`)

- Add optional `updatedAt?: Date` field to `IndexMemoryEntry` type
- Update `reindexCategoryIndexes()` to read `updated_at` from memory frontmatter and populate the index entry
- Update `updateAfterMemoryWrite()` to include `updatedAt` when updating index entries
- Update index serialization/deserialization to handle the new field

### New core operation

- New `getRecentMemories()` function in core memory operations
- Accepts: `{ category?, limit?, includeExpired?, now? }` + scoped storage adapter
- Algorithm: walk categories recursively, collect index entries, filter expired, sort by `updatedAt` desc, slice to limit, read full content for each
- Start simple: walk everything, sort, slice (no early-termination optimization)

### New MCP tool

- Tool name: `cortex_get_recent_memories`
- Thin wrapper over core `getRecentMemories()`
- Maps core result to MCP response format

### Update `list_memories`

- Add `updated_at` (optional) to the `list_memories` MCP response per memory entry
- Source from the (now-available) `updatedAt` in index entries

## Edge Cases

| Scenario                                               | Behavior                                                                      |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Empty store / category                                 | Return empty array, `count: 0`                                                |
| Fewer memories than `limit`                            | Return all available, `count` reflects actual                                 |
| All recent memories expired (`include_expired: false`) | Return empty / fewer than `limit` — filter expired first, then sort and slice |
| Category doesn't exist                                 | Return error (consistent with `list_memories`)                                |
| Memory with empty content                              | Include in results — empty content is valid                                   |
| Stale index (no `updatedAt`)                           | Treat as null, sort last; reindex fixes it                                    |

## Out of Scope (for now)

- **Token budget parameter** (`max_tokens`): Callers can manage this themselves using `token_estimate` in the response
- **CLI command** (`cortex recent`): Keep MCP-only for now
- **Early-termination optimization**: Simple walk-all approach is fine; future storage backends may make this moot
- **`created_at` in indexes**: Not adding now, can be added later if needed
