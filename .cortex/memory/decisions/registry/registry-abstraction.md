---
created_at: 2026-01-31T14:47:42.765Z
updated_at: 2026-01-31T14:47:42.765Z
tags:
  - architecture
  - decision
  - registry
  - abstraction
source: mcp
---
## Registry Abstraction Decision

**Date:** 2026-01-31
**PR:** #9 (merged)

### Context
The store registry was tightly coupled to filesystem operations, making it difficult to test and potentially support alternative backends.

### Decision
- Created backend-agnostic `Registry` interface with `initialize()`, `load()`, `save()`, `getStore()` methods
- `getStore()` is synchronous, enabled by caching registry data after `load()`
- Created `ScopedStorageAdapter` interface (subset of ComposedStorageAdapter without stores)
- Created `FilesystemRegistry` as the concrete implementation
- Created `initializeStore` domain operation for atomic store creation

### Key Design Notes
- `store.ts` was **NOT deleted** because `resolveStore` provides local/global fallback resolution (different from `registry.getStore()`)
- Memory operations now accept `ScopedStorageAdapter` instead of `ComposedStorageAdapter`
- Registry caches data internally for synchronous `getStore()` after async `load()`

### File Locations
- Interface: `src/core/storage/adapter.ts`
- Implementation: `src/core/storage/filesystem/filesystem-registry.ts`
- Domain operation: `src/core/store/operations.ts`