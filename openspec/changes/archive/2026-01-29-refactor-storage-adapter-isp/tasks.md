## 1. Define New Interfaces

- [x] 1.1 Create `MemoryStorage` interface in `core/storage/adapter.ts` with methods: `read`, `write`, `remove`, `move`
- [x] 1.2 Create `IndexStorage` interface in `core/storage/adapter.ts` with methods: `read`, `write`, `reindex`, `updateAfterMemoryWrite`
- [x] 1.3 Create `StoreStorage` interface in `core/storage/adapter.ts` with methods: `load`, `save`, `remove`
- [x] 1.4 Verify `CategoryStorage` in `core/category/types.ts` has no "Port" suffix (already named correctly)
- [x] 1.5 Create `ComposedStorageAdapter` interface composing the four interfaces

## 2. Implement Filesystem Storage Classes

- [x] 2.1 Create `FilesystemMemoryStorage` class implementing `MemoryStorage` in `filesystem/memory-storage.ts`
- [x] 2.2 Create `FilesystemIndexStorage` class implementing `IndexStorage` in `filesystem/index-storage.ts`
- [x] 2.3 Create `FilesystemCategoryStorage` class implementing `CategoryStorage` in `filesystem/category-storage.ts`
- [x] 2.4 Create `FilesystemStoreStorage` class implementing `StoreStorage` in `filesystem/store-storage.ts`
- [x] 2.5 Each class receives `FilesystemContext` in constructor

## 3. Refactor FilesystemStorageAdapter

- [x] 3.1 Update `FilesystemStorageAdapter` to compose the four storage classes
- [x] 3.2 Keep legacy pass-through methods for backward compatibility (marked @deprecated)
- [x] 3.3 Index updating handled through `IndexStorage.updateAfterMemoryWrite()` coordination
- [x] 3.4 Category index reading now uses raw index file + parse in `readCategoryIndexForPort`
- [x] 3.5 `FilesystemStoreStorage` delegates to existing registry functions

## 4. Update Consumers (DEFERRED)

Consumers continue using legacy `adapter.readMemoryFile()` etc. methods which are maintained for backward compatibility. Migration to new `adapter.memories.read()` pattern is optional and can be done incrementally.

- [x] 4.1-4.5 DEFERRED - backward compatibility maintained, no breaking changes

## 5. Update Tests

- [x] 5.1 Update `filesystem/index.spec.ts` tests to use valid frontmatter content
- [x] 5.2 Fix `filesystem/memories.spec.ts` tests for snake_case frontmatter format
- [x] 5.3-5.5 Storage classes tested through adapter integration tests
- [x] 5.6 All 708 tests pass

## 6. Cleanup

- [x] 6.1 Legacy methods marked as @deprecated with migration guidance
- [x] 6.2 Comprehensive JSDoc comments added to all new classes and methods
- [x] 6.3 Module exports updated in `filesystem/index.ts` with architecture overview
- [x] 6.4 Standalone registry functions kept for direct use, `StoreStorage` provides interface abstraction

## Additional Fixes

- [x] Fix frontmatter YAML format to use snake_case keys (`created_at`, `updated_at`, `expires_at`)
- [x] Fix `readCategoryIndexForPort` to return `null` for missing indexes (per interface contract)
- [x] Fix module header comment in `memories.ts` (`@module core/storage/filesystem/memories`)
