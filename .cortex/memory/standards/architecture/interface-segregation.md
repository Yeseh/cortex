---
created_at: 2026-02-05T19:16:28.811Z
updated_at: 2026-02-05T19:16:28.811Z
tags:
  - patterns
  - solid
  - isp
source: mcp
---
# Interface Segregation Principle (ISP)

Storage is split into focused interfaces rather than one monolithic adapter.

## The Problem (Anti-pattern)
```typescript
// BAD: Monolithic interface
interface StorageAdapter {
    readMemory, writeMemory, removeMemory, moveMemory,
    readIndex, writeIndex, reindex,
    categoryExists, readCategoryIndex, writeCategoryIndex,
    loadRegistry, saveRegistry
}
```

## The Solution (ISP)
```typescript
// GOOD: Focused interfaces
interface MemoryStorage { read, write, remove, move }
interface IndexStorage { read, write, reindex }
interface CategoryStorage { categoryExists, readCategoryIndex, writeCategoryIndex }
```

## Composition Pattern
```typescript
interface ScopedStorageAdapter {
    memories: MemoryStorage;
    indexes: IndexStorage;
    categories: CategoryStorage;
}
```

## Benefits
- Each interface serves single cohesive purpose
- Easier to mock in tests
- Clearer API surface
- Aligns with user's coding preferences (see global/human/preferences/coding)