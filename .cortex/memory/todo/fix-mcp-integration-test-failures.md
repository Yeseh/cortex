---
created_at: 2026-02-26T20:03:11.810Z
updated_at: 2026-02-27T19:59:37.776Z
tags: 
  - open
  - tests
  - mcp
  - integration
source: mcp
---
# TODO: Fix MCP Integration Test Failures

## Status
OPEN — 12 tests still failing as of 2026-02-27. Previously marked resolved in error.

## Failing tests
All 12 are in `packages/server/tests/*.integration.spec.ts`:
- MCP server bootstrap integration
- MCP store tools integration (2)
- MCP category tools integration (2)
- MCP memory tools integration (2)
- MCP end-to-end workflow integration
- MCP error handling integration (4)

## Root cause
Unknown — needs investigation. All failures are in the HTTP integration test layer (`packages/server/tests/`), not unit tests.