## 1. Define New Interfaces

- [ ] 1.1 Create `MemoryStorage` interface in `core/storage/adapter.ts` with methods: `read`, `write`, `remove`, `move`
- [ ] 1.2 Create `IndexStorage` interface in `core/storage/adapter.ts` with methods: `read`, `write`, `reindex`
- [ ] 1.3 Create `StoreStorage` interface in `core/storage/adapter.ts` with methods: `load`, `save`, `remove`
- [ ] 1.4 Verify `CategoryStorage` in `core/category/types.ts` has no "Port" suffix (already named correctly)
- [ ] 1.5 Update `StorageAdapter` interface to compose the four interfaces: `memories: MemoryStorage`, `indexes: IndexStorage`, `categories: CategoryStorage`, `stores: StoreStorage`

## 2. Implement Filesystem Storage Classes

- [ ] 2.1 Create `FilesystemMemoryStorage` class implementing `MemoryStorage` in `filesystem/memories.ts`
- [ ] 2.2 Create `FilesystemIndexStorage` class implementing `IndexStorage` in `filesystem/indexes.ts`
- [ ] 2.3 Create `FilesystemCategoryStorage` class implementing `CategoryStorage` in `filesystem/categories.ts`
- [ ] 2.4 Create `FilesystemStoreStorage` class implementing `StoreStorage` in `filesystem/stores.ts`
- [ ] 2.5 Each class receives `FilesystemContext` in constructor

## 3. Refactor FilesystemStorageAdapter

- [ ] 3.1 Update `FilesystemStorageAdapter` to compose the four storage classes
- [ ] 3.2 Remove all pass-through methods from `FilesystemStorageAdapter`
- [ ] 3.3 Remove automatic index updating from memory write operations
- [ ] 3.4 Move `readCategoryIndex` logic from indexes.ts to categories.ts (if not already there)
- [ ] 3.5 Refactor store registry functions from `core/store/registry.ts` into `FilesystemStoreStorage`

## 4. Update Consumers

- [ ] 4.1 Update MCP memory tools to use `adapter.memories.*` pattern
- [ ] 4.2 Update MCP category tools to use `adapter.categories.*` pattern
- [ ] 4.3 Update MCP store tools to use `adapter.stores.*` pattern
- [ ] 4.4 Update CLI commands to use new adapter pattern
- [ ] 4.5 Add index update calls to business layer where memory writes occur

## 5. Update Tests

- [ ] 5.1 Update `filesystem/index.spec.ts` tests for new adapter structure
- [ ] 5.2 Update `filesystem/memories.spec.ts` tests for `FilesystemMemoryStorage` class
- [ ] 5.3 Add tests for `FilesystemIndexStorage` class
- [ ] 5.4 Add tests for `FilesystemCategoryStorage` class
- [ ] 5.5 Add tests for `FilesystemStoreStorage` class
- [ ] 5.6 Update `core/store/registry.spec.ts` tests for new pattern

## 6. Cleanup

- [ ] 6.1 Remove deprecated method signatures from interfaces
- [ ] 6.2 Update JSDoc comments to reflect new architecture
- [ ] 6.3 Update module exports in `filesystem/index.ts`
- [ ] 6.4 Consider deprecating standalone functions in `core/store/registry.ts` or re-exporting from storage module
