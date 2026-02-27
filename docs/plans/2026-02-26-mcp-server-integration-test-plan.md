# MCP Server Integration Test Plan (Real Server + HTTP/MCP Assertions)

**Goal:** Create integration tests for the MCP server that start the real server process, call HTTP endpoints (`/health`, `/mcp`), execute MCP tools, and verify responses, errors, and side effects.

**Scope:** `packages/server/tests/**`

**Core requirements:**
- Run the real server entrypoint (`packages/server/src/index.ts`) in tests.
- Send real HTTP requests to `/health` and `/mcp`.
- Assert status codes, response payloads, and tool-level outcomes.
- Isolate test state (`HOME`, data paths, ports) per test/suite.

---

## 1) Directory and file layout

Create the integration suite under server root:

- `packages/server/tests/test-helpers.ts`
- `packages/server/tests/mcp-health.integration.spec.ts`
- `packages/server/tests/mcp-bootstrap.integration.spec.ts`
- `packages/server/tests/mcp-memory-tools.integration.spec.ts`
- `packages/server/tests/mcp-category-tools.integration.spec.ts`
- `packages/server/tests/mcp-store-tools.integration.spec.ts`
- `packages/server/tests/mcp-errors.integration.spec.ts`
- `packages/server/tests/mcp-workflow.integration.spec.ts`

Optional split for scale:
- `packages/server/tests/mcp-recent-reindex.integration.spec.ts`
- `packages/server/tests/mcp-category-modes.integration.spec.ts`

---

## 2) Server process strategy

Run server as subprocess via Bun in integration tests:
- command: `bun run src/index.ts`
- cwd: `packages/server`
- env overrides:
  - `HOME=<temp-home>`
  - `CORTEX_DATA_PATH=<temp-data-path>`
  - `CORTEX_PORT=<allocated-free-port>`
  - `CORTEX_HOST=127.0.0.1`
  - `CORTEX_DEFAULT_STORE=default` (or `global`, depending on scenario)

Startup readiness:
1. spawn process
2. poll `/health` until 200 or timeout
3. fail test early with captured stderr on timeout

Shutdown:
- send SIGTERM
- await process exit
- force kill on timeout

---

## 3) MCP request contract for tests

Use direct JSON-RPC 2.0 POST requests to `/mcp`:

- `initialize`
- `tools/list`
- `tools/call` (for `cortex_*` tools)

Helpers should build typed request envelopes and parse response envelopes.

Minimum helper APIs (`packages/server/tests/test-helpers.ts`):
- `createServerSandbox()`
- `startServer(sandbox)`
- `stopServer(proc)`
- `waitForHealth(baseUrl, timeoutMs)`
- `postMcp(method, params, id?)`
- `callTool(name, arguments)`
- `expectMcpSuccess(response)`
- `expectMcpError(response, messageContains?)`

---

## 4) State isolation and fixtures

Per test or per describe block:
1. create temp sandbox (`mkdtemp`)
2. build isolated `HOME` and `CORTEX_DATA_PATH`
3. optionally pre-seed store/category files if needed
4. start server
5. run MCP interactions
6. stop server and cleanup filesystem

Avoid sharing server process across unrelated suites unless test time becomes excessive.

---

## 5) Integration scenarios

## 5.1 Health endpoint (`mcp-health.integration.spec.ts`)
- `GET /health` returns 200
- payload contains:
  - `status: "healthy"`
  - `version`
  - `dataPath` matching env
- unknown route returns 404

## 5.2 MCP bootstrap (`mcp-bootstrap.integration.spec.ts`)
- `initialize` succeeds
- `tools/list` returns expected tool names:
  - memory tools (`cortex_add_memory`, `cortex_get_memory`, ...)
  - store tools (`cortex_list_stores`, `cortex_create_store`)
  - category tools (mode-dependent)

## 5.3 Memory tools (`mcp-memory-tools.integration.spec.ts`)
- create store (`cortex_create_store`) for scenario setup
- add/get/list/update/move/remove memory flows
- prune (`cortex_prune_memories`) dry-run and normal mode
- recent (`cortex_get_recent_memories`) limit and ordering sanity
- reindex (`cortex_reindex_store`) returns success with warnings array

Assertions:
- MCP response shape (`result.content`)
- expected text/json payload fragments
- follow-up tool calls reflect state changes

## 5.4 Category tools (`mcp-category-tools.integration.spec.ts`)
- create category success
- set/clear description success
- delete category success
- invalid path / protected category behavior mapped as MCP errors

## 5.5 Store tools (`mcp-store-tools.integration.spec.ts`)
- list stores initially
- create store success
- list stores includes created store
- duplicate store create returns error response

## 5.6 Error handling (`mcp-errors.integration.spec.ts`)
- tool call with invalid args returns `InvalidParams` style error
- unknown tool returns protocol error
- invalid store/path inputs produce actionable messages
- oversized request body to `/mcp` returns 413 (body size guard)

## 5.7 End-to-end workflow (`mcp-workflow.integration.spec.ts`)
Single workflow scenario:
1. initialize + list tools
2. create store
3. create category
4. add/update/get/list/move/remove memory
5. list stores / recent memories / reindex
6. verify final state via list/get errors

---

## 6) Assertion strategy

For each scenario, assert three levels:
1. **Transport-level**: HTTP status, JSON parseability
2. **Protocol-level**: JSON-RPC envelope correctness (`result` vs `error`)
3. **Domain-level**: content includes expected path/store/category/data values

Avoid full snapshot assertions for entire payloads; assert stable fields and semantic outcomes.

---

## 7) Execution commands and scripts

Recommended server package scripts:
- add `"test:integration": "bun test tests"` to `packages/server/package.json`

Execution:
- `cd packages/server && bun run test:integration`
- targeted file: `bun test tests/mcp-memory-tools.integration.spec.ts`

CI recommendation:
1. run unit tests
2. run integration tests in isolated environment
3. publish logs/artifacts on failure (stdout/stderr + request/response traces)

---

## 8) Implementation order

1. `tests/test-helpers.ts` (sandbox + server lifecycle + MCP client)
2. health + bootstrap suites
3. store and category suites
4. memory tool suites
5. error suite
6. full workflow suite
7. stabilize timing/retries and remove flakiness

---

## 9) Acceptance criteria

- Integration tests exist under `packages/server/tests/`.
- Tests start the real MCP server process and call live endpoints.
- `/health` and `/mcp` behavior is validated with protocol-aware assertions.
- Core tool families (memory/store/category) are covered with success + failure cases.
- `bun test packages/server/tests` (or `bun run test:integration`) passes reliably.

---

## 10) Handoff notes for next agent

- Keep tests black-box and protocol-level; avoid mocking MCP internals in integration suites.
- Use deterministic setup and strict cleanup to prevent state leakage.
- Centralize retry/backoff logic in helpers to reduce flaky startup failures.
- If any tool behavior is currently unstable due to known core bugs, mark those tests as pending with explicit issue links and keep the rest of the suite green.
