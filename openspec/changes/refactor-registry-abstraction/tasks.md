## 1. Define New Interfaces

- [ ] 1.1 Define `Registry` interface in `src/core/storage/adapter.ts`
- [ ] 1.2 Define `ScopedStorageAdapter` interface (memories, indexes, categories only)
- [ ] 1.3 Define `RegistryError` and related error types
- [ ] 1.4 Define `InitStoreError` error type

## 2. Refactor registry.ts to Pure Parsing

- [ ] 2.1 Remove `fs` imports from `src/core/store/registry.ts`
- [ ] 2.2 Remove `loadStoreRegistry` function (moves to FilesystemRegistry)
- [ ] 2.3 Remove `saveStoreRegistry` function (moves to FilesystemRegistry)
- [ ] 2.4 Remove `removeStoreRegistry` function (moves to FilesystemRegistry)
- [ ] 2.5 Keep `parseStoreRegistry` and `serializeStoreRegistry` as pure functions
- [ ] 2.6 Keep `isValidStoreName` and `resolveStorePath` utilities

## 3. Create FilesystemRegistry

- [ ] 3.1 Rename `store-storage.ts` to `filesystem-registry.ts`
- [ ] 3.2 Implement `initialize()` method for first-time setup
- [ ] 3.3 Implement `load()` method with internal caching
- [ ] 3.4 Implement `save(registry)` method
- [ ] 3.5 Implement `getStore(name)` synchronous factory method
- [ ] 3.6 Add private cache field for registry data
- [ ] 3.7 Update constructor to take `registryPath` parameter

## 4. Create initializeStore Domain Operation

- [ ] 4.1 Create `src/core/store/operations.ts`
- [ ] 4.2 Implement `initializeStore(registry, name, path, options)` function
- [ ] 4.3 Operation should create store directory via storage backend
- [ ] 4.4 Operation should initialize root index via core modules
- [ ] 4.5 Operation should add entry to registry

## 5. Update CLI Commands

- [ ] 5.1 Refactor `src/cli/commands/init.ts` to use `initializeStore`
- [ ] 5.2 Keep `config.yaml` creation in CLI layer
- [ ] 5.3 Refactor `src/cli/commands/store.ts` `runStoreInit` to use `initializeStore`
- [ ] 5.4 Update other store commands to use new Registry interface

## 6. Clean Up

- [ ] 6.1 Delete `src/core/store/store.ts`
- [ ] 6.2 Update barrel exports in `src/core/store/index.ts`
- [ ] 6.3 Update barrel exports in `src/core/storage/filesystem/index.ts`
- [ ] 6.4 Remove deprecated `StoreStorage` references

## 7. Update Dependent Code

- [ ] 7.1 Update MCP server to use new `Registry` interface
- [ ] 7.2 Update any remaining code using old interface names

## 8. Testing

- [ ] 8.1 Update existing registry tests for new interface
- [ ] 8.2 Add tests for `initialize()` method
- [ ] 8.3 Add tests for `getStore()` factory method
- [ ] 8.4 Add tests for `initializeStore` domain operation
- [ ] 8.5 Run full test suite

## 9. Documentation

- [ ] 9.1 Update code comments and JSDoc
- [ ] 9.2 Update architecture documentation if exists
