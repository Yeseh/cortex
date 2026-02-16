# Change: Migrate to Cortex client

## Why

With the `Cortex` class in place, the codebase still has `FilesystemRegistry` instantiated directly in 10+ locations. This final migration consolidates all usage to the new `Cortex` API, enabling consistent dependency injection and removing the legacy class.

## What Changes

- **Add `CortexContext` pattern** - shared context object as first parameter to all handlers
- **Migrate CLI handlers** - update all command handlers to receive `CortexContext`
- **Migrate MCP Server handlers** - update all tool handlers to use `CortexContext`
- **BREAKING**: Remove `FilesystemRegistry` class entirely
- **BREAKING**: Remove direct `FilesystemRegistry` instantiation from all packages

## Impact

- Affected specs: `add-store-registry-and-resolution`, `storage-filesystem`
- Affected code:
    - `packages/cli/src/context.ts` - use CortexContext pattern
    - `packages/cli/src/commands/**` - update handler signatures
    - `packages/server/src/**` - update tool handlers
    - `packages/storage-fs/src/filesystem-registry.ts` - removed
    - All tests using FilesystemRegistry directly
