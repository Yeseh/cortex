# Change: Apply Interface Segregation Principle to Storage Adapter

## Why

The current `FilesystemStorageAdapter` class violates the Interface Segregation Principle (ISP) by combining memory, index, and category operations into a single monolithic interface. This forces clients to depend on methods they don't use and results in many pass-through methods that add no value beyond holding shared context.

Similarly, store operations (registry management) are currently standalone functions rather than following the same composition pattern.

## What Changes

- **BREAKING**: Refactor `StorageAdapter` to use composition with four separate storage interfaces
- Split the single `StorageAdapter` interface into four focused interfaces: `MemoryStorage`, `IndexStorage`, `CategoryStorage`, and `StoreStorage`
- Change `StorageAdapter` to a "has-a" relationship: `adapter.memories`, `adapter.indexes`, `adapter.categories`, `adapter.stores`
- Simplify method names since the property name provides context (e.g., `readMemoryFile` → `memories.read`)
- Remove `readCategoryIndex` from the index module; it belongs with categories
- Move index-updating logic out of `writeMemoryFile` to business layer responsibility
- Remove "Port" suffix from interface names (use `CategoryStorage` not `CategoryStoragePort`)
- Add `StoreStorage` interface for store registry operations (`load`, `save`, `remove`)

## Impact

- Affected specs: `storage-filesystem`, `category-core`, `add-store-registry-and-resolution`
- Affected code:
    - `src/core/storage/adapter.ts` - interface definitions
    - `src/core/storage/filesystem/index.ts` - adapter implementation
    - `src/core/storage/filesystem/memories.ts` - memory storage implementation
    - `src/core/storage/filesystem/indexes.ts` - index storage implementation
    - `src/core/storage/filesystem/categories.ts` - category storage implementation
    - `src/core/storage/filesystem/stores.ts` - new store storage implementation
    - `src/core/store/registry.ts` - refactor into StoreStorage pattern
    - `src/core/category/types.ts` - rename `CategoryStorage` interface
    - All consumers of `FilesystemStorageAdapter` (MCP tools, CLI commands, etc.)
