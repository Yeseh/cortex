---
created_at: 2026-02-26T19:29:06.312Z
updated_at: 2026-02-26T19:29:06.312Z
tags: 
  - testing
  - server
  - mcp
  - completed
source: mcp
---
# Server Unit Test Coverage (PR #47)

Added comprehensive colocated unit tests for the entire `packages/server/src` module tree.

**Result:** 408 passing tests across 28 files (was 0 dedicated server tests before).

**Key additions:**
- `test-helpers.spec.ts` — shared mock factories (createMockCortexContext, createMockMemoryClient, createMockStoreClient, createMockCortex, createMockMcpServer) and assertion helpers (expectMcpInvalidParams, withEnv)
- All handler specs use mock factories from test-helpers
- `index.spec.ts` — server startup integration tests using real temp dirs and sequential ports starting at 19800
- `context.spec.ts` — validateStorePath and createCortexContext tests with real filesystem

**Also fixed:** `memory/index.ts` was missing `reindexStoreHandler` / `reindexStoreInputSchema` exports — added in same PR.

**Known limitation:** `createServer()` SERVER_START_FAILED branches 2 & 3 (store-client/load failures) cannot be tested without module-level mocking (prohibited). Would require DI on createServer() to test.