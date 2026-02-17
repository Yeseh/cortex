# Change: Migrate to Cortex client

## Why

With the `Cortex` class in place, the codebase still has `FilesystemRegistry` instantiated directly in 10+ locations. This migration consolidates most usage to the new `Cortex` API, enabling consistent dependency injection for store resolution.

## What Changes

- **Add `CortexContext` pattern** - shared context object with `cortex: Cortex` reference
- **Migrate CLI handlers** - update memory command handlers to use `CortexContext`
- **Migrate MCP Server handlers** - update all tool handlers to use `CortexContext`
- **Update test utilities** - create `createTestContext()` factory using `Cortex.init()`

## Scope Limitation

`FilesystemRegistry` **cannot be removed** in this PR because:
1. It provides mutable operations (`load()`, `save()`) for store management
2. CLI/MCP store commands (add/remove/init) need to modify the config file
3. `Cortex` is currently read-only after initialization

A follow-up proposal should add `addStore()` and `removeStore()` methods to `Cortex` before `FilesystemRegistry` can be fully deprecated.

## Impact

- Affected specs: `add-store-registry-and-resolution`, `storage-filesystem`
- Affected code:
    - `packages/cli/src/context.ts` - use CortexContext pattern
    - `packages/server/src/**` - update tool handlers
    - All tests using direct FilesystemRegistry for read operations
