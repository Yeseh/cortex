---
created_at: 2026-02-05T19:15:35.674Z
updated_at: 2026-02-05T19:15:35.674Z
tags:
  - map
  - server
  - files
source: mcp
---
# Server Package Key Files

## Entry Points (`packages/server/src/`)
- `index.ts` - Express server entry, HTTP server, mounts /mcp endpoint
- `mcp.ts` - createMcpServer(), createMcpTransport(), createMcpContext()
- `config.ts` - loadServerConfig() from CORTEX_* environment variables
- `errors.ts` - domainErrorToMcpError(), zodErrorToMcpError()
- `health.ts` - Health check router for /health endpoint

## Memory Tools (`memory/`)
- `tools.ts` - MCP tools: cortex_add_memory, cortex_get_memory, cortex_update_memory, cortex_remove_memory, cortex_move_memory, cortex_list_memories, cortex_prune_memories
- `resources.ts` - Memory resources: cortex://memory/{store}/{path}

## Store Tools (`store/`)
- `tools.ts` - MCP tools: cortex_list_stores, cortex_create_store
- `resources.ts` - Store resources: cortex://store/, cortex://store/{name}

## Category Tools (`category/`)
- `tools.ts` - MCP tools: cortex_create_category, cortex_set_category_description, cortex_delete_category