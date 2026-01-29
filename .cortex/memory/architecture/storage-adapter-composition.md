---
created_at: 2026-01-28T20:49:33.271Z
updated_at: 2026-01-29T16:36:21.478Z
tags: [architecture, storage, isp, composition, interfaces]
source: mcp
---
The `StorageAdapter` uses composition with four focused storage interfaces following ISP:

```typescript
interface ComposedStorageAdapter {
    memories: MemoryStorage;    // read, write, remove, move
    indexes: IndexStorage;      // read, write, reindex, updateAfterMemoryWrite
    categories: CategoryStorage; // exists, readIndex, writeIndex, ensureDirectory, deleteDirectory, updateSubcategoryDescription, removeSubcategoryEntry
    stores: StoreStorage;       // load, save, remove
}
```

**Usage patterns:**
- New code: `adapter.memories.read(path)`, `adapter.categories.exists(path)`
- Legacy code: `adapter.readMemoryFile(path)` (deprecated but maintained)

**Implementation files:**
- `FilesystemMemoryStorage` in `filesystem/memory-storage.ts`
- `FilesystemIndexStorage` in `filesystem/index-storage.ts`
- `FilesystemCategoryStorage` in `filesystem/category-storage.ts`
- `FilesystemStoreStorage` in `filesystem/store-storage.ts`

Each implementation receives `FilesystemContext` and delegates to existing functions. The business layer coordinates operations across interfaces (e.g., updating indexes after writing memories via `indexes.updateAfterMemoryWrite()`).

PR: https://github.com/Yeseh/cortex/pull/2