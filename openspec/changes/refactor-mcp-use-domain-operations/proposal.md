# Change: Refactor MCP tools to use domain operations

## Why

The MCP server (`src/server/memory/tools.ts`) directly manipulates the filesystem and contains duplicated business logic instead of calling domain operations from `src/core/memory/operations.ts`. This makes the code harder to test, reason about, and maintain. The domain model should drive logic; the MCP server should be a thin wrapper that exposes domain operations through the MCP interface.

## What Changes

- Refactor all MCP memory tool handlers to call domain operations (`createMemory`, `getMemory`, `updateMemory`, `moveMemory`, `removeMemory`, `listMemories`, `pruneExpiredMemories`)
- Remove direct filesystem calls (`mkdir`) from MCP tools
- Remove duplicated business logic (memory serialization, index coordination)
- MCP tools become thin wrappers: parse input → call domain operation → format MCP response

## Impact

- Affected specs: `mcp-memory-tools`
- Affected code: `src/server/memory/tools.ts`
- No breaking changes to MCP tool interfaces
- Improves testability and maintainability
