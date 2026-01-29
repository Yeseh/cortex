---
created_at: 2026-01-29T19:54:08.932Z
updated_at: 2026-01-29T19:54:08.932Z
tags:
  - decision
  - architecture
  - storage
  - interfaces
  - isp
source: mcp
---
# ScopedStorageAdapter Interface

**Date:** 2026-01-29

## Decision
Introduce `ScopedStorageAdapter` as the interface returned by `registry.getStore()`. This is distinct from a "root" adapter.

## Interface
```typescript
interface ScopedStorageAdapter {
    memories: MemoryStorage;
    indexes: IndexStorage;
    categories: CategoryStorage;
    // Note: No 'stores' or 'registry' - you're already scoped to a store
}
```

## Context
Previously `ComposedStorageAdapter` had a `stores` property. With the registry refactoring:
- Registry is separate from storage adapters
- Adapters returned from `getStore()` are scoped to a specific store
- No need for store-level operations on a scoped adapter

## Rationale
- Type-honest about what a scoped adapter can do
- Prevents confusion about where store operations live
- Clear separation: registry = meta, adapter = content

## Related
- registry-as-store-factory decision
- `.context/registry-brainstorm.md` - Full brainstorming session