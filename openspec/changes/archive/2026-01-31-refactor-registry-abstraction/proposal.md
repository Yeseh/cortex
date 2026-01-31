# Change: Abstract the Registry and make it the store factory

## Why

The current `StoreStorage` interface and `FilesystemStoreStorage` implementation have several issues:

1. The naming is confusing ("StoreStorage" sounds like it stores stores)
2. `src/core/store/registry.ts` directly calls filesystem APIs, breaking the abstraction
3. There's no clean way to obtain a storage adapter for a specific store
4. `src/core/store/store.ts` uses a filesystem-specific resolution approach that doesn't fit a multi-backend world

This refactoring makes the registry backend-agnostic (enabling future SQLite support) and establishes it as the factory for storage adapters.

## What Changes

**Renames:**

- `StoreStorage` → `Registry`
- `FilesystemStoreStorage` → `FilesystemRegistry`

**Interface changes:**

- `load(path)` → `load()` (path is constructor parameter)
- `save(path, registry)` → `save(registry)`
- Add `initialize()` for first-time registry setup
- Add `getStore(name)` as synchronous factory method returning `ScopedStorageAdapter`
- Registry caches loaded data internally

**New domain operation:**

- `initializeStore(registry, name, path, options)` for creating new stores

**Deletions:**

- Delete `src/core/store/store.ts` (superseded by registry-based resolution)

## Impact

- Affected specs: `add-store-registry-and-resolution`, `storage-filesystem`, `cli-store`
- Affected code:
    - `src/core/store/registry.ts` - Pure parsing/serialization only
    - `src/core/storage/filesystem/store-storage.ts` → `filesystem-registry.ts`
    - `src/core/storage/adapter.ts` - Interface updates
    - `src/cli/commands/init.ts` - Use `initializeStore`
    - `src/cli/commands/store.ts` - Use `initializeStore`
- **BREAKING**: Interface renames (internal, not user-facing)
