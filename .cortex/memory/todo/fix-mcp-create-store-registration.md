---
created_at: 2026-02-14T21:17:45.502Z
updated_at: 2026-02-14T21:36:37.724Z
tags:
  - bug
  - mcp-server
  - store-operations
  - testing
source: mcp
expires_at: 2026-03-31T23:59:59.000Z
---
## Issue
MCP server test TC-MCP-011 (Store Operations) revealed that `cortex_create_store` returns success but the newly created store does not appear in the store registry and cannot be used in subsequent operations.

## Expected Behavior
- `cortex_create_store` should create a store AND register it in the registry
- The new store should appear in `cortex_list_stores` output
- The new store should be immediately usable in memory operations

## Actual Behavior
- `cortex_create_store` returns `{"created": "test-store"}`
- Store does not appear in `cortex_list_stores`
- Attempting to use the store results in "Store 'test-store' is not registered" error

## Test Evidence
```
cortex_create_store(name: "test-store") → {"created": "test-store"}
cortex_list_stores() → only shows "cortex" and "default"
cortex_add_memory(store: "test-store", ...) → Error: Store not registered
```

## Investigation Needed
- Review MCP server `create_store` tool implementation in `packages/server/src/store/tools.ts`
- Check if store is only being created on filesystem but not registered in memory
- Verify core `createStore` operation vs registry registration are both being called

## Priority
Medium - Feature works for pre-existing stores, but dynamic store creation via MCP is broken