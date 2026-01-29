---
created_at: 2026-01-29T19:53:41.992Z
updated_at: 2026-01-29T19:53:41.992Z
tags:
  - decision
  - architecture
  - registry
  - storage
  - factory-pattern
source: mcp
---
# Registry as Store Factory

**Date:** 2026-01-29

## Decision
The `Registry` interface serves as both the store registry AND the factory for storage adapters via `registry.getStore(name)`.

## Context
When refactoring to support multiple storage backends (filesystem, SQLite), we needed a clean way to obtain scoped storage adapters for specific stores.

## Options Considered
1. **`adapter.forStore(name)`** - Factory on the adapter itself
2. **`registry.getStore(name)`** - Factory on the registry (chosen)
3. **Separate factory class** - Additional abstraction

## Rationale
- Registry is the source of truth for store paths/configuration
- Natural place for the factory method
- Keeps adapter focused on storage operations only
- Registry can cache loaded data, making `getStore()` synchronous

## Implementation
```typescript
interface Registry {
    initialize(): Promise<Result<void, RegistryError>>;
    load(): Promise<Result<StoreRegistry, RegistryError>>;
    save(registry: StoreRegistry): Promise<Result<void, RegistryError>>;
    getStore(name: string): Result<ScopedStorageAdapter, StoreNotFoundError>;  // Sync
}
```

## Related
- `.context/registry-brainstorm.md` - Full brainstorming session