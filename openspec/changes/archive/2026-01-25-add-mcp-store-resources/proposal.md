# Change: Add MCP Store Resources

## Why

AI agents benefit from a resource-oriented view of stores for browsing and discovery. MCP resources provide a read-only, URI-based interface for accessing store metadata and listings.

## What Changes

- Add `cortex://store/` resource - lists all stores
- Add `cortex://store/{name}` resource - store metadata and root category listing
- Create `src/server/store/resources.ts` with resource handlers

## Impact

- Affected specs: New `mcp-store-resources` capability
- Affected code: `src/server/store/resources.ts`
- Dependencies: Requires `add-mcp-server-core` to be implemented first
