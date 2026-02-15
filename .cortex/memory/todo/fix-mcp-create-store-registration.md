---
created_at: 2026-02-14T21:17:45.502Z
updated_at: 2026-02-15T11:11:54.272Z
tags:
  - bug
  - mcp-server
  - completed
  - store-operations
source: mcp
expires_at: 2026-03-31T23:59:59.000Z
---
## Fix MCP Create Store Registration - COMPLETED

### Problem (FIXED)
The `cortex_create_store` MCP tool was returning success but the newly created store did not appear in the store registry and could not be used in subsequent operations.

### Root Cause
The `createStore()` function in `packages/server/src/store/tools.ts` only created the filesystem directory but did NOT register the store in `stores.yaml`.

### Solution
Refactored the `cortex_create_store` handler to delegate to the existing `initializeStore()` function from `@yeseh/cortex-core/store`, which properly handles:
- Store name validation
- Registry collision check
- Directory creation
- Registry registration
- Root index creation

This follows the "thin wrapper" MCP pattern and removes ~250 lines of duplicated store creation logic.

### Pull Request
https://github.com/Yeseh/cortex/pull/26

### Status: COMPLETED
- Implementation: Done (using core `initializeStore`)
- Tests: 723 tests passing
- Code review: Completed - reviewer identified architecture issue, resolved by using core function
- Documentation: Added
- PR created: #26