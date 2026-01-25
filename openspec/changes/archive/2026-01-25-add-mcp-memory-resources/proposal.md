# Change: Add MCP Memory Resources

## Why

AI agents benefit from a resource-oriented view of memories for browsing and discovery. MCP resources provide a read-only, URI-based interface for accessing memory content and category listings.

## What Changes

- Add `cortex://memory/{store}/{path}` resource pattern
    - For leaf paths: returns memory content
    - For directory paths: returns category listing
- Create `src/server/memory/resources.ts` with resource handlers

## Impact

- Affected specs: New `mcp-memory-resources` capability
- Affected code: `src/server/memory/resources.ts`
- Dependencies: Requires `add-mcp-server-core` to be implemented first
