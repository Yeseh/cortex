---
created_at: 2026-02-26T20:00:47.679Z
updated_at: 2026-02-26T20:02:57.635Z
tags: 
  - todo
  - bug
  - mcp-server
  - cold-start
  - partial-fix
source: mcp
---
# TODO: Fix MCP Server Self-Bootstrap Bugs — PARTIALLY FIXED

## Status
Bug 2 and Bug 3 fixed in PR #48 (`fix/tracked-bugs`). Bug 1 remains in `context.ts`.

## Fixed in PR #48

### Bug 2: Null store guard — FIXED
`StoreClient.load()` now correctly returns `err({ code: 'STORE_NOT_INITIALIZED' })` when storage returns `ok(null)`. The MCP server startup now handles `STORE_NOT_INITIALIZED` by calling `StoreClient.initialize()` with defaults, then reloading.

### Bug 3: Auto-init incomplete — FIXED
MCP server startup now auto-initializes the default store when `STORE_NOT_INITIALIZED` is returned, ensuring the server can start on a fresh machine.

## Still Open

### Bug 1: Adapter factory uses store name as filesystem path
**File:** `packages/server/src/context.ts` lines 117-121  
The `adapterFactory` receives the store name from `Cortex.getStore(name)` but passes it directly to `FilesystemStorageAdapter({ rootDirectory: storeName })`. Should read `config.stores[storeName].properties.path` instead. This is still an issue in the MCP server path specifically.

## Expected Behavior
MCP server starts cleanly on a fresh machine with no prior setup. Auto-creates config and default store, serves tools immediately.