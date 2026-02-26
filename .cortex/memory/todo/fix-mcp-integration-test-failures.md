---
created_at: 2026-02-26T20:03:11.810Z
updated_at: 2026-02-26T20:03:11.810Z
tags: 
  - todo
  - bug
  - mcp-server
  - integration-tests
  - store-tools
  - memory-tools
source: mcp
---
# TODO: Fix 5 Pre-existing MCP Integration Test Failures

## Status
Pre-existing on main. Integration test suite added in PR #48 surfaces these.

## Failures (from `bun test packages/server/tests/`)

### 1. `mcp-store-tools`: `should list stores, create a store...`
`JSON.parse(readTextContent(createResult))` throws `SyntaxError: Unexpected identifier "Error"`.
The `cortex_create_store` tool returns a text error message instead of JSON. Likely a missing globalDataPath in the server context when handling store creation.

### 2. `mcp-store-tools`: `should return duplicate-store error on second create`
`expect(text).toContain('already exists')` fails; actual: `"Error: Server configuration error: globalDataPath is not defined in context."`.
Same root cause as #1 — server context is missing `globalDataPath` for store tool operations.

### 3. `mcp-memory-tools`: `should support add/get/list/update/move/remove memory flow`
After `cortex_move_memory`, `cortex_get_memory` at the new path returns `"MCP error -32602: Memory not found: notes/alpha-renamed"`.
`cortex_move_memory` tool does not correctly update the memory index after moving.

### 4. `mcp-memory-tools`: `should support prune dry-run and apply...`
`expect(dryRunJson.dry_run).toBe(true)` fails; `dry_run` is `undefined`.
Prune dry-run response format doesn't include `dry_run` field — probably a JSON schema mismatch.

### 5. `mcp-errors`: `should return actionable messages for invalid store and path inputs`
`expect(result.isError).toBe(true)` fails; `isError` is `undefined`.
Error responses from MCP tools don't set the `isError` flag correctly.

## Files
- `packages/server/tests/mcp-store-tools.integration.spec.ts`
- `packages/server/tests/mcp-memory-tools.integration.spec.ts`
- `packages/server/tests/mcp-errors.integration.spec.ts`