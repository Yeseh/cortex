---
{created_at: 2026-02-17T20:19:56.964Z,updated_at: 2026-02-17T20:40:44.903Z,tags: [completed,migration,cortex-client,pr-38],source: mcp}
---
# Completed: Migrate to Cortex Client (PR #38)

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

**Follow-up**: See `todo/add-cortex-mutation-methods` for plan to add store mutation methods to Cortex.

## PR
https://github.com/Yeseh/cortex/pull/38

## Archive
`openspec/changes/archive/2026-02-17-migrate-to-cortex-client/`