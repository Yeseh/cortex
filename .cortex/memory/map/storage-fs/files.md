---
created_at: 2026-02-05T19:15:23.897Z
updated_at: 2026-02-05T19:15:23.897Z
tags:
  - map
  - storage-fs
  - files
source: mcp
---
# Storage-FS Package Key Files

## Main Files (`packages/storage-fs/src/`)
- `index.ts` - FilesystemStorageAdapter, FilesystemRegistry, parseMemory, serializeMemory
- `types.ts` - FilesystemStorageAdapterOptions, FilesystemContext

## ISP Storage Classes
- `memory-storage.ts` - FilesystemMemoryStorage (implements MemoryStorage)
- `index-storage.ts` - FilesystemIndexStorage (implements IndexStorage)
- `category-storage.ts` - FilesystemCategoryStorage (implements CategoryStorage)
- `filesystem-registry.ts` - FilesystemRegistry (implements Registry)

## Low-Level Operations
- `memories.ts` - parseMemory(), serializeMemory(), readMemory(), writeMemory(), removeMemory(), moveMemory()
- `indexes.ts` - readIndexFile(), writeIndexFile(), reindexCategoryIndexes(), updateCategoryIndexes()
- `categories.ts` - categoryExists(), ensureCategoryDirectory(), deleteCategoryDirectory()
- `utils.ts` - ok(), err(), isNotFoundError(), resolveStoragePath()

## Test Files
- `memories.spec.ts` - Memory parsing tests
- `index.spec.ts` - Full adapter integration tests
- `categories.spec.ts` - Category operations tests
- `filesystem-registry.spec.ts` - Registry lifecycle tests