---
created_at: 2026-02-26T20:03:23.697Z
updated_at: 2026-02-26T20:03:23.697Z
tags: 
  - fix
  - core
  - cli
  - mcp
  - completed
  - pr-48
source: mcp
---
# Completed: Fix null store config and CLI auto-init

**Date:** 2026-02-26
**Branch:** fix/tracked-bugs → PR #48

## What Changed

### Core (`packages/core/src/store/`)
- `store-client.ts`: `StoreClient.load()` now returns `STORE_NOT_INITIALIZED` (new error code) when `store.yaml` doesn't exist (previously passed `null as StoreData`, causing crashes)
- `store-client.ts`: `StoreClient.initialize()` now propagates `initializeStore()` errors instead of silently swallowing them
- `store-client.ts`: Removed unused imports (`Store`, `StoreName`, `ConfigStore`, `MemoryPath`) and `as StoreData` cast
- `result.ts`: Added `'STORE_NOT_INITIALIZED'` to `StoreErrorCode` union
- `operations/initialize.spec.ts`: Fixed stale `REGISTRY_READ_FAILED` → `STORE_READ_FAILED`

### CLI (`packages/cli/src/create-cli-command.ts`)
- Uses `FilesystemConfigAdapter.initialize()` to auto-create default config on fresh installs
- Correctly reads `storeEntry.properties.path` when building `adapterFactory`
- Error message changed from `"is not configured"` to `"not found"` for missing stores

### MCP Server (`packages/server/src/index.ts`)
- Handles `STORE_NOT_INITIALIZED` at startup by auto-initializing store with `kind: 'filesystem'`, then reloading
- Removed `as StoreData` cast, removed optional-chaining on guaranteed-non-null `store.value`

## Test Results
- Unit tests: 906 → 934 pass (28 new integration tests pass)
- 5 pre-existing MCP integration test failures remain (see `todo/fix-mcp-integration-test-failures`)