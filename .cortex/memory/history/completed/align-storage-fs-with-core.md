---
{created_at: 2026-02-21T15:43:58.605Z,updated_at: 2026-02-21T15:43:58.605Z,tags: [refactor,storage-fs,core,completed],source: mcp}
---
## Completed: Align storage-fs with core module interfaces

**Date:** 2026-02-21
**Branch:** feature/align-storage-fs-with-core → merged to jw/vacuuming

### What Changed

1. **Method renames for consistency:**
   - `read()` → `load()` (MemoryStorage, IndexStorage)
   - `write()` → `save()` (MemoryStorage)
   - `updateSubcategoryDescription()` → `setDescription()` (CategoryStorage)

2. **New storage adapters:**
   - `FilesystemStoreAdapter` - store configuration persistence (store.yaml files)
   - `FilesystemConfigAdapter` - global config management (cortex.yaml files)

3. **Removed:**
   - `FilesystemRegistry` - replaced by new adapters
   - `summary` property from `ListedMemory` and `CategoryMemoryEntry`

4. **StorageAdapter interface updated:**
   - Added required `stores: StoreAdapter` property
   - All four components: memories, indexes, categories, stores

5. **Type aliases added:**
   - `MemoryStorage = MemoryAdapter`
   - `IndexStorage = IndexAdapter`
   - `CategoryStorage = CategoryAdapter`

6. **New error codes:**
   - `STORE_READ_FAILED`
   - `STORE_WRITE_FAILED`

### Test Results
- storage-fs: 93/93 pass ✅
- core: 231/235 pass (4 pre-existing failures in initialize.spec.ts)

### Follow-up Work Needed
- Add unit tests for FilesystemStoreAdapter and FilesystemConfigAdapter
- Update CLI and server packages to consume new interfaces
- Add CONFIG_WRITE_FAILED error code to ConfigErrorCode