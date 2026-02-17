---
{created_at: 2026-02-17T20:37:32.301Z,updated_at: 2026-02-17T20:37:32.301Z,tags: [todo,cortex,api,follow-up,pr-38],source: mcp}
---
# TODO: Add Store Mutation Methods to Cortex

## Priority
Medium

## Description
Add `addStore()` and `removeStore()` methods to the `Cortex` class to enable store management without using `FilesystemRegistry` directly.

## Context
PR #38 migrated read operations to use `Cortex.getStore()`, but store mutation (add/remove stores) still requires `FilesystemRegistry` because `Cortex` is read-only after initialization.

## Current State
- `FilesystemRegistry` provides: `load()`, `save()`, `getStore()`
- `Cortex` provides: `fromConfig()`, `init()`, `initialize()`, `getStore()`
- Store add/remove commands in CLI and MCP server still use `FilesystemRegistry`

## Proposed API
```typescript
class Cortex {
    // Existing methods...
    
    // New mutation methods
    addStore(name: string, definition: StoreDefinition): Promise<Result<void, StoreError>>;
    removeStore(name: string): Promise<Result<void, StoreError>>;
    
    // For syncing changes to disk
    save(): Promise<Result<void, ConfigError>>;
}
```

## Tasks
- [ ] Add internal `registry` mutation methods to Cortex
- [ ] Add `save()` method to persist config changes
- [ ] Migrate CLI store commands (add/remove/init) to use Cortex
- [ ] Migrate MCP store tools to use Cortex
- [ ] Deprecate `FilesystemRegistry.save()` and `FilesystemRegistry.load()`
- [ ] Eventually remove `FilesystemRegistry` entirely

## Blocked By
- PR #38 must be merged first