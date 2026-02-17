---
{created_at: 2026-02-17T20:19:56.964Z,updated_at: 2026-02-17T20:37:22.308Z,tags: [in-progress,migration,cortex-client,pr-38],source: mcp}
---
# In Progress: Migrate to Cortex Client (PR #38)

## Date
2026-02-17

## Summary
Migrated MCP server and CLI to use `Cortex` client facade instead of direct `FilesystemRegistry` access for **read-only** store operations.

## Key Changes
- Added `CortexContext` interface to core with `cortex: Cortex` reference
- Updated `ToolContext` to include `cortex` instance
- Refactored all MCP tool handlers to use `ctx.cortex.getStore()`
- Migrated health endpoint and memory resources
- Updated test utilities with `createTestContext()` factory
- Updated CLI context to use Cortex client

## Stats
- 39 files changed
- 932 insertions, 678 deletions
- 757 tests passing

## Scope Limitation
`FilesystemRegistry` **not removed** because:
- It provides mutable operations (`load()`, `save()`) for store management
- CLI/MCP store commands (add/remove/init) need to modify the config file
- `Cortex` is currently read-only after initialization

**Follow-up needed**: Add `addStore()` and `removeStore()` methods to `Cortex` class before `FilesystemRegistry` can be deprecated.

## PR
https://github.com/Yeseh/cortex/pull/38

## Commits
1. `refactor(mcp): migrate server to Cortex client for dependency injection`
2. `chore: update tasks.md with completed items`
3. `docs: update proposal to reflect FilesystemRegistry scope limitation`