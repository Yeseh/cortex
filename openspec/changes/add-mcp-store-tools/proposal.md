# Change: Add MCP Store Tools

## Why

AI agents need to discover and manage stores via MCP. Store tools enable agents to list available stores and explicitly create new stores when needed.

## What Changes

- Add `list_stores` MCP tool - returns all stores in the data folder
- Add `create_store` MCP tool - explicitly creates a new store
- Create `src/server/store/tools.ts` with tool implementations
- Create `src/server/store/index.ts` for registration

## Impact

- Affected specs: New `mcp-store-tools` capability
- Affected code: `src/server/store/`
- Dependencies: Requires `add-mcp-server-core` to be implemented first
