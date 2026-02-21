---
{created_at: 2026-02-21T15:44:20.982Z,updated_at: 2026-02-21T15:44:20.982Z,tags: [standup,mcp,refactor,blocked],source: mcp}
---
# MCP CortexContext Refactor - Started

## Goal
Update MCP server memory tool handlers to use CortexContext and fluent client API, matching the CLI command pattern.

## Current Status
- Created worktree: `.worktrees/mcp-cortex-context` on branch `refactor/mcp-cortex-context`
- Created implementation plan: `.context/plans/2026-02-21-mcp-cortex-context-refactor.md`

## Blockers Found
Test utilities in MCP server still reference removed exports:
- `serializeStoreRegistry` - removed from `@yeseh/cortex-core`
- `FilesystemRegistry` - removed from `@yeseh/cortex-storage-fs`

These are used in `packages/server/src/memory/tools/test-utils.ts` and need to be updated before proceeding with handler refactor.

## Next Steps
1. Fix test utilities to remove references to deleted exports
2. Update test setup to use `Cortex.init()` pattern (matches CLI test pattern)
3. Proceed with handler updates per plan