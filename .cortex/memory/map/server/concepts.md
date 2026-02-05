---
created_at: 2026-02-05T19:16:07.608Z
updated_at: 2026-02-05T19:16:07.608Z
tags:
  - map
  - server
  - concepts
  - mcp
source: mcp
---
# Server Package Key Concepts

## MCP Tools
- Memory: cortex_add_memory, cortex_get_memory, cortex_update_memory, cortex_remove_memory, cortex_move_memory, cortex_list_memories, cortex_prune_memories
- Category: cortex_create_category, cortex_set_category_description, cortex_delete_category
- Store: cortex_list_stores, cortex_create_store

## MCP Resources
- Memory: cortex://memory/{store}/{path}
- Store: cortex://store/, cortex://store/{name}

## Tool Registration Pattern
```typescript
server.tool(
    'tool_name',
    'Tool description',
    inputSchema.shape,
    async (input) => handler(ctx, parseInput(schema, input))
);
```

## Error Translation
- InvalidParams: Client-correctable (invalid path, not found)
- InvalidRequest: Malformed request (parse failures)
- InternalError: Infrastructure failures (registry, storage)

## Configuration
- Environment variables: CORTEX_PORT, CORTEX_HOST, CORTEX_DATA_PATH
- Default data path: ~/.config/cortex/

## Store Resolution
- Registry loaded from ${dataPath}/stores.yaml
- Store looked up by name
- Returns ScopedStorageAdapter