---
created_at: 2026-02-26T20:03:11.810Z
updated_at: 2026-02-27T19:38:46.095Z
tags: 
  - resolved
  - tests
  - context
  - server
  - mcp
source: mcp
---
# TODO: Fix MCP Integration Test Failures — RESOLVED

## Status
All 9 failing unit tests fixed on 2026-02-27. 1099/1099 tests pass. TypeScript clean.

## What Was Fixed

### 1. `context.ts` — default store path wrong
Changed `resolve(storesDir, 'global')` → `resolve(storesDir, 'default')`. Default store directory is now `<dataPath>/stores/default`.

### 2. `context.ts` — invalid YAML threw instead of returning err
`reload()` result was not checked. Now returns `err({ code: 'CONFIG_READ_FAILED', ... })` when reload fails.

### 3. `context.ts` — catch block threw instead of returning err
Changed `throw new Error(...)` → `return err({ code: 'CONTEXT_CREATION_FAILED', ... })`.

### 4. `context.ts` — default store directory not created on disk
Added `await mkdir(resolve(storesDir, 'default'), { recursive: true })` after `initializeConfig`.

### 5. `store/index.spec.ts` — createTestCortexContext used ServerConfig as .config
Was: `{ ...ctx, config, globalDataPath: testDir }` (ServerConfig).
Now: `{ ...ctx, config: configAdapter, globalDataPath: testDir }` (ConfigAdapter). Also removed unused `config` variable and `ServerConfig` import.

### 6. `server/index.spec.ts` — impossible path tests expected throw
Tests expected `.rejects.toThrow()` but `createCortexContext` now returns `err`. Updated to `expect(result.ok()).toBe(false)`.

### 7. `store/tools.spec.ts` — unused imports
Removed `ok`, `CortexContext`, `createMockCortex`, `createMockStoreClient`, `anyMock`, and `Mock` type imports.