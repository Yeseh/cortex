# Change: Add MCP Reindex Tool

## Why

AI agents managing memory stores via MCP cannot rebuild category indexes when they become corrupted or out of sync. The CLI provides `cortex store reindex`, but agents operating purely through MCP have no equivalent capability. This forces human intervention for index maintenance tasks.

## What Changes

- Add a `cortex_reindex_store` tool to the MCP server that rebuilds category indexes for a specified store
- The tool delegates to the existing `adapter.indexes.reindex()` domain operation
- Follows the same pattern as other MCP memory tools (required store parameter, Zod validation, error translation)

## Impact

- Affected specs: `mcp-memory-tools`
- Affected code: `packages/server/src/memory/tools.ts`
- No breaking changes - this is a new additive tool
