---
created_at: 2026-02-05T19:16:24.284Z
updated_at: 2026-02-05T19:16:24.284Z
tags:
  - patterns
  - architecture
  - hexagonal
source: mcp
---
# Ports and Adapters (Hexagonal Architecture)

Core defines **ports** (interfaces), storage-fs provides **adapters** (implementations).

## Port Interfaces (core/storage/adapter.ts)
```typescript
interface MemoryStorage { read, write, remove, move }
interface IndexStorage { read, write, reindex, updateAfterMemoryWrite }
interface CategoryStorage { categoryExists, readCategoryIndex, writeCategoryIndex, ... }
interface StoreStorage { load, save, remove }
```

## Composed Adapter
```typescript
interface ScopedStorageAdapter {
    memories: MemoryStorage;
    indexes: IndexStorage;
    categories: CategoryStorage;
}
```

## Registry as Factory
```typescript
interface Registry {
    initialize(): Promise<Result<void, Error>>;
    load(): Promise<Result<StoreRegistry, Error>>;
    getStore(name: string): Result<ScopedStorageAdapter, Error>;
}
```

## Benefits
- Core has no filesystem dependencies
- Storage implementations are swappable
- Testable with mocks
- Clear boundaries between domain and infrastructure