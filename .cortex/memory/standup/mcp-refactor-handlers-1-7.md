---
{created_at: 2026-02-21T15:56:41.862Z,updated_at: 2026-02-21T15:56:41.862Z,tags: [standup,mcp,refactor,progress],source: mcp}
---
# MCP Refactor - Handlers 1-7 Complete

## Completed (Tasks 2-7)
- add-memory.ts - Uses `store.getMemory().create()` with metadata structure
- update-memory.ts - Uses `store.getMemory().update()` with 3-state expiration handling
- get-memory.ts - Uses `store.getMemory().get()` with includeExpired option
- remove-memory.ts - Uses `store.getMemory().delete()`
- move-memory.ts - Uses `store.getMemory().move(destMemory)`
- list-memories.ts - Uses `category.listMemories()` and `category.listSubcategories()`

## In Progress (Tasks 8-10)
Starting final three handlers: get-recent-memories, prune-memories, reindex-store