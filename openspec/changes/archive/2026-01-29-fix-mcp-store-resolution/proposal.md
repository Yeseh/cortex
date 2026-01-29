# Change: Fix MCP store resolution to use registry

## Why

MCP memory tools are constructing store paths incorrectly by appending the store name to a hardcoded memory subdirectory (`~/.config/cortex/memory/{storeName}`) instead of looking up the actual path from the store registry (`stores.yaml`). This causes memories to be written to wrong locations (e.g., `memory/default/` instead of `memory/`).

The store resolution spec (`add-store-registry-and-resolution`) defines how stores should be resolved via the registry, but MCP tools don't use this mechanism.

## What Changes

- Add `resolveStorePath` function to `core/store/registry.ts` that looks up a store name in a registry and returns its path
- Update MCP memory tools (`server/memory/tools.ts`) to use registry-based resolution instead of path construction
- Update MCP category tools (`server/category/tools.ts`) to use registry-based resolution
- Add spec requirement that MCP tools SHALL resolve stores via the registry

## Impact

- Affected specs: `mcp-memory-tools`, `add-store-registry-and-resolution`
- Affected code:
    - `src/core/store/registry.ts` - add `resolveStorePath` function
    - `src/server/memory/tools.ts` - use registry resolution
    - `src/server/category/tools.ts` - use registry resolution
