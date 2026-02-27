# Server Module Unit Test Coverage Plan (Colocated Specs + Shared Helpers)

**Goal:** Add comprehensive unit tests for all server module logic in `packages/server/src`, with colocated `*.spec.ts` files and reusable test infrastructure in a shared `test-helpers.spec.ts`.

**Scope:** `packages/server/src/**`

**Primary constraints:**
- Colocate tests with implementation using `*.spec.ts` file paths.
- Extract reusable mocks/common operations into `packages/server/src/test-helpers.spec.ts`.
- Use Bun test and strict TypeScript patterns used by this monorepo.
- Per project rule, preexisting failing tests must be fixed before adding net-new test work.

---

## 1) Baseline and sequencing

1. Run baseline tests:
   - `bun test packages/server`
2. If preexisting failures exist, fix those first.
3. Implement tests in narrow-to-broad sequence:
   - shared helper + pure utilities
   - handler/tool unit tests
   - registration/wiring tests
   - server startup/runtime tests
   - full package test run

**Exit criteria:** baseline is green (or explicitly documented blockers resolved first).

---

## 2) Shared helper module design

Create:
- `packages/server/src/test-helpers.spec.ts`

Centralize reusable test primitives:

### 2.1 Result builders
- `okResult<T>(value: T)`
- `errResult<E>(error: E)`

### 2.2 MCP error and response assertions
- `expectMcpInvalidParams(fn, messagePart?)`
- `expectMcpInternalError(fn, messagePart?)`
- `expectTextResponseContains(response, text)`
- `parseResponseJson(response)` for JSON encoded `textResponse` payloads

### 2.3 Mock context factories
- `createMockCortexContext(overrides?)`
- `createMockCortex(overrides?)`
- `createMockStoreClient(overrides?)`
- `createMockCategoryClient(overrides?)`
- `createMockMemoryClient(overrides?)`

### 2.4 MCP server registration harness
- `createMockMcpServer()` that captures `registerTool` and `tool` calls so registration can be asserted without real transport.

### 2.5 Environment + time helpers
- `withEnv(overrides, fn)` (save/restore env around tests)
- fixed time helpers for deterministic timestamps and expiry checks

**Exit criteria:** individual spec files import helpers rather than recreating mocks/utilities.

---

## 3) Required colocated spec files

## 3.1 Top-level server modules
- `packages/server/src/index.spec.ts`
- `packages/server/src/mcp.spec.ts`
- `packages/server/src/config.spec.ts`
- `packages/server/src/context.spec.ts`
- `packages/server/src/errors.spec.ts`
- `packages/server/src/response.spec.ts`
- `packages/server/src/health.spec.ts`

## 3.2 Store modules
- `packages/server/src/store/index.spec.ts`
- `packages/server/src/store/tools.spec.ts`
- `packages/server/src/store/shared.spec.ts`

## 3.3 Category modules
- `packages/server/src/category/index.spec.ts`
- `packages/server/src/category/tools.spec.ts`

## 3.4 Memory modules
- `packages/server/src/memory/index.spec.ts`
- `packages/server/src/memory/tools/index.spec.ts`
- `packages/server/src/memory/tools/shared.spec.ts`
- `packages/server/src/memory/tools/add-memory.spec.ts`
- `packages/server/src/memory/tools/get-memory.spec.ts`
- `packages/server/src/memory/tools/update-memory.spec.ts`
- `packages/server/src/memory/tools/remove-memory.spec.ts`
- `packages/server/src/memory/tools/move-memory.spec.ts`
- `packages/server/src/memory/tools/list-memories.spec.ts`
- `packages/server/src/memory/tools/prune-memories.spec.ts`
- `packages/server/src/memory/tools/reindex-store.spec.ts`
- `packages/server/src/memory/tools/get-recent-memories.spec.ts`

---

## 4) Test matrix by module

## 4.1 `config.ts`
- defaults when env is unset
- env overrides parsing (`CORTEX_*` vars)
- numeric coercion and validation failure paths
- invalid enum values produce `CONFIG_VALIDATION_FAILED`
- `getDefaultDataPath()` and `getMemoryPath()` return expected derived paths

## 4.2 `context.ts`
- `validateStorePath` absolute/relative behavior
- `createCortexContext` success path initializes config + cortex context shape
- initialization failure path returns `CONFIG_INIT_FAILED`
- adapter-factory behavior via `createCortexContext` outcomes:
  - missing store
  - unsupported store kind
  - missing filesystem path

## 4.3 `errors.ts`
- domain code mapping to MCP `ErrorCode`
- zod issue aggregation formatting
- unknown code fallback to `InternalError`
- `handleDomainError` with string/error cause handling

## 4.4 `response.ts` + `health.ts`
- `textResponse`, `jsonResponse`, `errorResponse` payload shape
- `errorResponse` sets `isError`
- `createHealthResponse` returns JSON response with status/version/dataPath

## 4.5 `mcp.ts`
- `createMcpServer` uses configured name/version
- `createMcpTransport` stateless config
- `createMcpContext` includes server + transport

## 4.6 `store/shared.ts`
- category hierarchy conversion for nested/empty/undefined definitions
- stable sorting by path

## 4.7 `store/tools.ts`
- `listStores` handles ENOENT as empty list
- `listStores` returns error on non-ENOENT failures
- `listStoresFromContext` sorts and maps metadata
- `listStoresHandler` emits JSON text response
- `createStoreHandler` cases:
  - invalid input
  - duplicate store
  - store client error
  - missing `globalDataPath`
  - initialize failure
  - fs mkdir failure
  - success output

## 4.8 `store/index.ts`
- registers expected tool names and schema for `cortex_create_store`
- registration routes to handler with parsed input

## 4.9 `category/tools.ts`
- schema validation via registration parser
- `createCategoryHandler` success and domain-error mapping
- `setCategoryDescriptionHandler` set + clear behavior and error mapping
- `deleteCategoryHandler` success and invalid/root/protected mappings
- `registerCategoryTools` mode behavior:
  - `free`: create + delete + set-description registered
  - `subcategories`: same registrations, mode context enforced
  - `strict`: create/delete omitted, set-description still registered

## 4.10 `category/index.ts`
- re-export/wiring sanity checks

## 4.11 `memory/tools/shared.ts`
- `parseInput` success and validation failure formatting
- `translateMemoryError` mapping for known memory codes
- fallback mapping for unknown codes

## 4.12 Memory handlers (`add/get/update/remove/move/list/prune/reindex/get-recent`)
For each handler:
- success path output
- store resolution failure -> InvalidParams
- downstream operation failures mapped to expected MCP error class

Additional command-specific cases:
- `update-memory`: no update fields rejected
- `list-memories`: include-expired filtering and category resolution errors
- `prune-memories`: dry-run and real output shape
- `reindex-store`: warnings passthrough
- `get-recent-memories`: category validation + default limit behavior

## 4.13 `memory/tools/index.ts` and `memory/index.ts`
- all expected MCP tool names registered
- each registration validates input then calls corresponding handler
- module export surface remains stable

## 4.14 `index.ts` (server startup)
- config invalid -> `CONFIG_INVALID`
- context creation failure -> `SERVER_START_FAILED`
- default store client/load failures -> `SERVER_START_FAILED`
- successful startup path:
  - memory/store/category tools registered
  - MCP transport connected
  - `/health` returns health response
  - server `close()` closes MCP + Bun server

---

## 5) Execution order

1. `test-helpers.spec.ts`
2. pure/common modules (`response`, `errors`, `config`, `health`, `store/shared`, `memory/tools/shared`, `mcp`)
3. store/category tool handler specs
4. memory tool handler specs
5. registration/wiring specs (`store/index`, `category/index`, `memory/index`, `memory/tools/index`)
6. top-level startup tests (`context`, `index`)
7. full server package test run and cleanup

---

## 6) Acceptance criteria

- Every logic-bearing `packages/server/src/**/*.ts` file has a colocated `*.spec.ts` (barrel-only files can be lightweight).
- Shared operations/mocks live in `packages/server/src/test-helpers.spec.ts`.
- Tests are deterministic (fixed env/time and controlled mocks).
- `bun test packages/server` passes.

Optional hardening:
- run `bunx tsc --build` after test additions if type risk appears.

---

## 7) Handoff notes for next agent

- Focus on exported handlers and registration boundaries; avoid over-mocking internals when behavior can be asserted via public function contracts.
- Keep MCP response assertions explicit (content shape + text payload), not snapshot-heavy.
- For dynamic imports in category handlers, add minimal seams only if needed to keep tests robust.
- If startup (`index.ts`) tests are brittle due to `Bun.serve`, isolate via injected/mocked boundaries and assert result contracts rather than full network behavior.
