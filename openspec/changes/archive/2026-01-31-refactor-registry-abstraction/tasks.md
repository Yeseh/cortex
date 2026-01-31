## 1. Define New Interfaces

- [x] 1.1 Define `Registry` interface in `src/core/storage/adapter.ts`
- [x] 1.2 Define `ScopedStorageAdapter` interface (memories, indexes, categories only)
- [x] 1.3 Define `RegistryError` and related error types
- [x] 1.4 Define `InitStoreError` error type

## 2. Refactor registry.ts to Pure Parsing

- [x] 2.1 Remove `fs` imports from `src/core/store/registry.ts`
- [x] 2.2 Remove `loadStoreRegistry` function (moves to FilesystemRegistry)
- [x] 2.3 Remove `saveStoreRegistry` function (moves to FilesystemRegistry)
- [x] 2.4 Remove `removeStoreRegistry` function (moves to FilesystemRegistry)
- [x] 2.5 Keep `parseStoreRegistry` and `serializeStoreRegistry` as pure functions
- [x] 2.6 Keep `isValidStoreName` and `resolveStorePath` utilities

## 3. Create FilesystemRegistry

- [x] 3.1 Rename `store-storage.ts` to `filesystem-registry.ts`
- [x] 3.2 Implement `initialize()` method for first-time setup
- [x] 3.3 Implement `load()` method with internal caching
- [x] 3.4 Implement `save(registry)` method
- [x] 3.5 Implement `getStore(name)` synchronous factory method
- [x] 3.6 Add private cache field for registry data
- [x] 3.7 Update constructor to take `registryPath` parameter

## 4. Create initializeStore Domain Operation

- [x] 4.1 Create `src/core/store/operations.ts`
- [x] 4.2 Implement `initializeStore(registry, name, path, options)` function
- [x] 4.3 Operation should create store directory via storage backend
- [x] 4.4 Operation should initialize root index via core modules
- [x] 4.5 Operation should add entry to registry

## 5. Update CLI Commands

- [x] 5.1 Refactor `src/cli/commands/init.ts` to use `initializeStore`
- [x] 5.2 Keep `config.yaml` creation in CLI layer
- [x] 5.3 Refactor `src/cli/commands/store.ts` `runStoreInit` to use `initializeStore`
- [x] 5.4 Update other store commands to use new Registry interface

## 6. Clean Up

- [x] 6.1 Delete `src/core/store/store.ts` - **NOTE: Kept store.ts because resolveStore provides local/global fallback resolution (different from registry.getStore)**
- [x] 6.2 Update barrel exports in `src/core/store/index.ts`
- [x] 6.3 Update barrel exports in `src/core/storage/filesystem/index.ts`
- [x] 6.4 Remove deprecated `StoreStorage` references

## 7. Update Dependent Code

- [x] 7.1 Update MCP server to use new `Registry` interface
- [x] 7.2 Update any remaining code using old interface names

## 8. Testing

- [x] 8.1 Update existing registry tests for new interface
- [x] 8.2 Add tests for `initialize()` method
- [x] 8.3 Add tests for `getStore()` factory method
- [x] 8.4 Add tests for `initializeStore` domain operation
- [x] 8.5 Run full test suite

## 9. Documentation

- [x] 9.1 Update code comments and JSDoc
- [x] 9.2 Update architecture documentation if exists - **NOTE: No architecture docs exist**
